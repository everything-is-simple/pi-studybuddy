/**
 * T-M1-002 S2 资料管理 handler（06-API §3.4 materials.* + 07-WF §2.3）
 *
 * 9 方法：list / upload / get / delete / replaceText / convert / retryConversion / generateNote / retryAiGeneration
 *
 * 状态机（07-WF §8.3）：
 *   pending → converting → converted → note_generating → completed
 *   失败分支：conversion_failed / pending_quality_check
 *
 * Job 登记入口（convert/retry/generate/retryAi）：仅写 jobs(status=pending) + 触发 Material 状态迁移，
 * 不执行真实转换器/AI（独立后续任务）。
 *
 * 路径安全（05-ERD §3.2.1 触发器约定）：storage_key 拒绝 ../:\:/ 路径逃逸
 * MIME 服务端验证（不信浏览器）
 */
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import type { Material, Job, JobType, RpcError } from "../../../contract/types";
import type { S2Context } from "./context";
import type { TextExtractResult } from "./text-extractor";
import { mapMaterial, mapJob } from "./dto";
import { notFound, badRequest } from "./errors";
import { findSemesterByCourseId, findSemesterByMaterialId } from "./lookup";
import { writeMaterialUploadedEvent } from "./events";
import type { SqlParams } from "../../../data/sqlite";

function now(): string {
  return new Date().toISOString();
}

/** 扩展名 → MIME 允许清单（服务端验证，不信浏览器，05-ERD §3.2.1 + 06-API §3.4） */
const EXT_MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  md: "text/markdown",
  image: "image/*",
  doc: "application/msword",
  ppt: "application/vnd.ms-powerpoint",
  xls: "application/vnd.ms-excel",
};

/** file_type 分类（图片统一归 image） */
function classifyFileType(fileName: string): { fileType: string; ext: string } {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const imageExts = ["png", "jpg", "jpeg", "gif", "bmp", "webp"];
  if (imageExts.includes(ext)) return { fileType: "image", ext };
  const allowedExts = ["pdf", "docx", "pptx", "xlsx", "txt", "md", "doc", "ppt", "xls"];
  if (allowedExts.includes(ext)) return { fileType: ext, ext };
  throw badRequest(`不支持的文件类型：${ext || "未知"}，请上传 PDF/DOCX/PPTX/XLSX/TXT/MD/图片`);
}

/** 路径安全检查（拒绝路径逃逸，05-ERD §3.2.1 触发器约定） */
function validateStorageKey(fileName: string): void {
  if (fileName.includes("..") || fileName.includes(":\\") || fileName.includes(":/") || fileName.includes("\\")) {
    throw badRequest("文件名包含非法字符或路径逃逸，已拒绝");
  }
}

/** MIME 服务端验证（不信浏览器，按扩展名判定） */
function validateMime(fileName: string, mime: string): { fileType: string } {
  const { fileType, ext } = classifyFileType(fileName);
  const expected = EXT_MIME_MAP[fileType] ?? EXT_MIME_MAP[ext];
  if (!expected) throw badRequest(`不支持的文件类型：${fileType}`);
  // image/* 通配
  if (expected.endsWith("/*")) {
    if (!mime.startsWith("image/")) throw badRequest(`MIME 类型 ${mime} 与文件扩展名 ${ext} 不一致，已拒绝`);
  } else if (mime !== expected) {
    throw badRequest(`MIME 类型 ${mime} 与文件扩展名 ${ext} 不一致，已拒绝`);
  }
  return { fileType };
}

/** Material 状态机校验（07-WF §8.3） */
function assertCanConvert(currentStatus: string): void {
  const allowed = ["pending", "conversion_failed"];
  if (!allowed.includes(currentStatus)) {
    throw badRequest(`资料当前状态 ${currentStatus} 不允许转换，仅 pending/conversion_failed 可转换`);
  }
}

function assertCanGenerateNote(currentStatus: string): void {
  const allowed = ["converted", "pending_quality_check"];
  if (!allowed.includes(currentStatus)) {
    throw badRequest(`资料当前状态 ${currentStatus} 不允许生成笔记，仅 converted/pending_quality_check 可生成`);
  }
}

/** 按 file_type 推断 job_type（05-ERD §3.2.7 CHECK 七类） */
function inferConvertJobType(fileType: string): JobType {
  const map: Record<string, JobType> = {
    pdf: "convert_pdf",
    docx: "convert_docx",
    pptx: "convert_pptx",
    xlsx: "convert_xlsx",
    image: "ocr_image",
    doc: "wps_convert",
    ppt: "wps_convert",
    xls: "wps_convert",
    txt: "convert_pdf", // txt 走通用管道（占位）
    md: "convert_pdf", // md 走通用管道（占位）
  };
  return map[fileType] ?? "convert_pdf";
}

export function createMaterialHandlers(ctx: S2Context) {
  return {
    "materials.list": (params: unknown): Material[] => {
      const { courseId, status } = (params ?? {}) as { courseId?: string; status?: string };

      if (courseId) {
        const { db } = findSemesterByCourseId(ctx, courseId);
        return queryMaterials(db, { courseId, status });
      }

      // 无 courseId：遍历所有学期库
      const result: Material[] = [];
      const semesters = ctx.globalDb
        .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL")
        .all() as Array<{ id: string }>;
      for (const s of semesters) {
        const db = ctx.semesterDb(s.id);
        result.push(...queryMaterials(db, { status }));
      }
      return result;
    },

    "materials.upload": (params: unknown): Material => {
      const { courseId, file } = params as { courseId: string; file: { name: string; size: number; mime: string } };
      // 1. 路径安全
      validateStorageKey(file.name);
      // 2. MIME 服务端验证
      const { fileType } = validateMime(file.name, file.mime);

      const { db, semesterId } = findSemesterByCourseId(ctx, courseId);
      const id = randomUUID();
      const ts = now();
      // storage_key 相对路径（05-ERD §3.2.1）
      const storageKey = `semester/${semesterId}/storage/${file.name}`;

      db.prepare(
        `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at)
         VALUES (@id, @cid, @fileName, @fileType, @fileSize, @mimeType, @storageKey, 'upload', 'pending', 0, @ts, @ts, @ts)`,
      ).run({
        id,
        cid: courseId,
        fileName: file.name,
        fileType,
        fileSize: file.size,
        mimeType: file.mime,
        storageKey,
        ts,
      });

      // 写 material_uploaded 事件（07-WF §2.3 步骤 1，source_system='S2'）
      writeMaterialUploadedEvent(db, semesterId, courseId, id);

      const row = db.prepare("SELECT * FROM materials WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapMaterial(row);
    },

    "materials.get": (params: unknown): Material => {
      const { id } = params as { id: string };
      const { db } = findSemesterByMaterialId(ctx, id);
      const row = db.prepare("SELECT * FROM materials WHERE id = @id").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!row) throw notFound("未找到该资料，请检查是否已删除");
      return mapMaterial(row);
    },

    "materials.delete": (params: unknown): void => {
      const { id } = params as { id: string };
      const { db } = findSemesterByMaterialId(ctx, id);
      const existing = db.prepare("SELECT * FROM materials WHERE id = @id AND deleted_at IS NULL").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!existing) throw notFound("未找到该资料，请检查是否已删除");

      const ts = now();
      db.prepare("UPDATE materials SET deleted_at = @ts, updated_at = @ts WHERE id = @id").run({ id, ts });
    },

    "materials.replaceText": (params: unknown): Material => {
      const { id, text } = params as { id: string; text: string };
      const { db, semesterId: _semesterId } = findSemesterByMaterialId(ctx, id);
      const existing = db.prepare("SELECT * FROM materials WHERE id = @id AND deleted_at IS NULL").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!existing) throw notFound("未找到该资料，请检查是否已删除");

      const ts = now();
      const contentHash = createHash("sha256").update(text).digest("hex");

      // 写 normalized_texts（跳过转换直写，07-WF §2.3 步骤 4 失败恢复 replaceText）
      // UNIQUE(material_id) 约束：先删后插
      db.prepare("DELETE FROM normalized_texts WHERE material_id = @id").run({ id });
      db.prepare(
        `INSERT INTO normalized_texts (id, material_id, content, content_hash, char_count, created_at)
         VALUES (@nid, @id, @content, @hash, @charCount, @ts)`,
      ).run({ nid: randomUUID(), id, content: text, hash: contentHash, charCount: text.length, ts });

      // Material → converted（跳过转换）
      db.prepare(
        "UPDATE materials SET status = 'converted', converted_at = @ts, updated_at = @ts WHERE id = @id",
      ).run({ id, ts });

      const row = db.prepare("SELECT * FROM materials WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapMaterial(row);
    },

    "materials.convert": async (params: unknown): Promise<Job> => {
      const { id } = params as { id: string };
      const { db, semesterId } = findSemesterByMaterialId(ctx, id);
      const existing = db.prepare("SELECT * FROM materials WHERE id = @id AND deleted_at IS NULL").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!existing) throw notFound("未找到该资料，请检查是否已删除");

      // 状态机校验
      assertCanConvert(existing.status as string);
      const jobType = inferConvertJobType(existing.file_type as string);

      const job = createJobAndTransition(ctx, db, semesterId, id, jobType, "converting");

      // wps_convert：注入 WpsAdapter 时执行真实转换（03-Arch §3.3，旧格式→新格式中间格式）
      if (jobType === "wps_convert" && ctx.wps) {
        return runWpsConversion(ctx, db, job.id, existing);
      }
      // 文本提取 job（convert_*/ocr_image）：注入对应 extractor/ocr 时执行真实提取（07-WF §2.3）
      const extractFn = resolveExtractionFn(ctx, jobType);
      if (extractFn) {
        return runTextConversion(ctx, db, job.id, existing, extractFn);
      }
      return job;
    },

    "materials.retryConversion": async (params: unknown): Promise<Job> => {
      const { id } = params as { id: string };
      const { db, semesterId } = findSemesterByMaterialId(ctx, id);
      const existing = db.prepare("SELECT * FROM materials WHERE id = @id AND deleted_at IS NULL").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!existing) throw notFound("未找到该资料，请检查是否已删除");

      // 仅 conversion_failed 可 retry
      if (existing.status !== "conversion_failed") {
        throw badRequest(`资料当前状态 ${existing.status as string} 不允许重试转换，仅 conversion_failed 可重试`);
      }

      // 查最近的 convert_* Job，校验 retry_count < max_retries
      const lastJob = db
        .prepare(
          `SELECT * FROM jobs WHERE material_id = @id AND job_type LIKE 'convert_%' ORDER BY created_at DESC LIMIT 1`,
        )
        .get({ id }) as Record<string, unknown> | undefined;
      if (!lastJob) throw badRequest("未找到历史转换作业，无法重试");

      const retryCount = (lastJob.retry_count as number) ?? 0;
      const maxRetries = (lastJob.max_retries as number) ?? 3;
      if (retryCount >= maxRetries) {
        throw badRequest(`重试次数已达上限（${maxRetries} 次），无法继续重试`);
      }

      const jobType = lastJob.job_type as JobType;
      // 新建 retry Job，retry_count = 上一条 + 1
      const job = createJobAndTransition(ctx, db, semesterId, id, jobType, "converting", retryCount + 1);

      // wps_convert：重试同样执行真实转换（数据从既有 materials 行解析，03-Arch §3.3）
      if (jobType === "wps_convert" && ctx.wps) {
        return runWpsConversion(ctx, db, job.id, existing);
      }
      // 文本提取 job：重试同样执行真实提取（07-WF §2.3）
      const extractFn = resolveExtractionFn(ctx, jobType);
      if (extractFn) {
        return runTextConversion(ctx, db, job.id, existing, extractFn);
      }
      return job;
    },

    "materials.generateNote": (params: unknown): Job => {
      const { id } = params as { id: string };
      const { db, semesterId } = findSemesterByMaterialId(ctx, id);
      const existing = db.prepare("SELECT * FROM materials WHERE id = @id AND deleted_at IS NULL").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!existing) throw notFound("未找到该资料，请检查是否已删除");

      // 状态机校验：仅 converted / pending_quality_check 可生成笔记
      assertCanGenerateNote(existing.status as string);

      return createJobAndTransition(ctx, db, semesterId, id, "generate_note", "note_generating");
    },

    "materials.retryAiGeneration": (params: unknown): Job => {
      const { id } = params as { id: string };
      const { db, semesterId } = findSemesterByMaterialId(ctx, id);
      const existing = db.prepare("SELECT * FROM materials WHERE id = @id AND deleted_at IS NULL").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!existing) throw notFound("未找到该资料，请检查是否已删除");

      // 仅 pending_quality_check 可 retryAi
      if (existing.status !== "pending_quality_check") {
        throw badRequest(
          `资料当前状态 ${existing.status as string} 不允许重试笔记生成，仅 pending_quality_check 可重试`,
        );
      }

      // 查最近的 generate_note Job
      const lastJob = db
        .prepare(
          `SELECT * FROM jobs WHERE material_id = @id AND job_type = 'generate_note' ORDER BY created_at DESC LIMIT 1`,
        )
        .get({ id }) as Record<string, unknown> | undefined;
      if (!lastJob) throw badRequest("未找到历史笔记生成作业，无法重试");

      const retryCount = (lastJob.retry_count as number) ?? 0;
      const maxRetries = (lastJob.max_retries as number) ?? 3;
      if (retryCount >= maxRetries) {
        throw badRequest(`重试次数已达上限（${maxRetries} 次），无法继续重试`);
      }

      return createJobAndTransition(ctx, db, semesterId, id, "generate_note", "note_generating", retryCount + 1);
    },
  };
}

/** 查询资料列表 */
function queryMaterials(
  db: import("../../../data/sqlite").DatabaseSync,
  opts: { courseId?: string; status?: string },
): Material[] {
  const conditions = ["deleted_at IS NULL"];
  const values: SqlParams = {};
  if (opts.courseId) {
    conditions.push("course_instance_id = @cid");
    values.cid = opts.courseId;
  }
  if (opts.status) {
    conditions.push("status = @status");
    values.status = opts.status;
  }
  const rows = db
    .prepare(`SELECT * FROM materials WHERE ${conditions.join(" AND ")} ORDER BY uploaded_at DESC`)
    .all(values) as Record<string, unknown>[];
  return rows.map(mapMaterial);
}

/** 创建 Job + 触发 Material 状态迁移（统一入口） */
function createJobAndTransition(
  _ctx: S2Context,
  db: import("../../../data/sqlite").DatabaseSync,
  _semesterId: string,
  materialId: string,
  jobType: JobType,
  newStatus: string,
  retryCount = 0,
): Job {
  const ts = now();
  const jobId = randomUUID();
  db.prepare(
    `INSERT INTO jobs (id, material_id, job_type, status, retry_count, max_retries, created_at, updated_at)
     VALUES (@id, @mid, @jobType, 'pending', @retryCount, 3, @ts, @ts)`,
  ).run({ id: jobId, mid: materialId, jobType, retryCount, ts });

  // Material 状态迁移
  db.prepare("UPDATE materials SET status = @status, updated_at = @ts WHERE id = @id").run({
    id: materialId,
    status: newStatus,
    ts,
  });

  const row = db.prepare("SELECT * FROM jobs WHERE id = @id").get({ id: jobId }) as Record<string, unknown>;
  return mapJob(row);
}

/** WPS 转换失败固定文案（03-Arch §3.3，不泄漏路径/stdout/stderr） */
const MSG_WPS_FAILED = "旧版办公文件转换失败，请检查文件是否完整或已损坏";

/** 文本提取失败固定文案（03-Arch §3.3 + 08-Test §3.3.2，不泄漏路径/stdout/stderr） */
const MSG_EXTRACT_FAILED = "文档文本提取失败，请检查文件是否完整或已损坏";

/** 从异常中提取安全错误消息：仅保留 RpcError 的 message，其余用固定文案（§9.3 日志脱敏） */
function safeWpsErrorMessage(e: unknown): string {
  if (
    e &&
    typeof e === "object" &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  ) {
    return (e as RpcError).message;
  }
  return MSG_WPS_FAILED;
}

/**
 * 按 job_type 解析文本提取函数（07-WF §2.3 分派矩阵）。
 *
 * 仅当对应 adapter 已注入时才返回函数；未注入返回 undefined（保持"仅登记 Job"语义）。
 *   convert_pdf/convert_docx/convert_pptx/convert_xlsx → TextExtractor.extract(fileType)
 *   ocr_image → OcrAdapter.recognize
 */
function resolveExtractionFn(
  ctx: S2Context,
  jobType: JobType,
): ((filePath: string) => Promise<TextExtractResult>) | undefined {
  switch (jobType) {
    case "convert_pdf":
    case "convert_docx":
    case "convert_pptx":
    case "convert_xlsx": {
      if (!ctx.textExtractor) return undefined;
      const fileType = jobType.replace("convert_", "");
      return (fp) => ctx.textExtractor!.extract(fp, fileType);
    }
    case "ocr_image": {
      if (!ctx.ocr) return undefined;
      return (fp) => ctx.ocr!.recognize(fp).then((r) => ({ text: r.text }));
    }
    default:
      return undefined;
  }
}

/**
 * 执行文本提取真实转换（07-WF §2.3 + 05-ERD §3.2.2）。
 *
 * 流程：Job→running → extractFn(inPath) →
 *   成功：写 normalized_texts（先删后插，UNIQUE(material_id)）+ Material→converted + Job→completed
 *   失败：Material→conversion_failed + Job→failed（error_message 固定文案，不泄漏路径）
 */
async function runTextConversion(
  ctx: S2Context,
  db: import("../../../data/sqlite").DatabaseSync,
  jobId: string,
  material: Record<string, unknown>,
  extractFn: (filePath: string) => Promise<TextExtractResult>,
  meta?: { source?: string },
): Promise<Job> {
  const materialId = material.id as string;
  const storageKey = material.storage_key as string;
  const inPath = path.join(ctx.dataRootPath, storageKey);

  const startedAt = now();
  db.prepare("UPDATE jobs SET status = 'running', started_at = @ts, updated_at = @ts WHERE id = @id").run({
    id: jobId,
    ts: startedAt,
  });

  try {
    const { text } = await extractFn(inPath);
    // 成功：写 normalized_texts（先删后插，UNIQUE(material_id)，05-ERD §3.2.2）
    writeNormalizedText(ctx, db, materialId, text, meta);
    const ts = now();
    db.prepare(
      "UPDATE materials SET status = 'converted', converted_at = @ts, updated_at = @ts WHERE id = @id",
    ).run({ id: materialId, ts });
    db.prepare("UPDATE jobs SET status = 'completed', completed_at = @ts, updated_at = @ts WHERE id = @id").run({
      id: jobId,
      ts,
    });
  } catch (e) {
    // 失败：Material→conversion_failed + Job→failed（error_message 固定文案，不泄漏路径/stdout/stderr）
    const ts = now();
    db.prepare("UPDATE materials SET status = 'conversion_failed', updated_at = @ts WHERE id = @id").run({
      id: materialId,
      ts,
    });
    db.prepare(
      `UPDATE jobs SET status = 'failed', error_code = 'INTERNAL_ERROR', error_message = @msg,
         completed_at = @ts, updated_at = @ts WHERE id = @id`,
    ).run({ id: jobId, ts, msg: safeWpsErrorMessage(e) });
  }

  const row = db.prepare("SELECT * FROM jobs WHERE id = @id").get({ id: jobId }) as Record<string, unknown>;
  return mapJob(row);
}

/**
 * 写 normalized_texts（05-ERD §3.2.2）：content_hash + char_count + source_type + extraction_meta_json。
 * UNIQUE(material_id) 约束：先删后插（ref replaceText 既有语义）。
 */
function writeNormalizedText(
  _ctx: S2Context,
  db: import("../../../data/sqlite").DatabaseSync,
  materialId: string,
  text: string,
  meta?: { source?: string },
): void {
  const ts = now();
  const contentHash = createHash("sha256").update(text).digest("hex");
  const extractionMeta = meta?.source ? JSON.stringify({ source: meta.source }) : null;
  db.prepare("DELETE FROM normalized_texts WHERE material_id = @id").run({ id: materialId });
  db.prepare(
    `INSERT INTO normalized_texts (id, material_id, content, content_hash, char_count, source_type, extraction_meta_json, created_at)
     VALUES (@nid, @id, @content, @hash, @charCount, @sourceType, @meta, @ts)`,
  ).run({
    nid: randomUUID(),
    id: materialId,
    content: text,
    hash: contentHash,
    charCount: text.length,
    sourceType: "upload",
    meta: extractionMeta,
    ts,
  });
}

/**
 * 执行 WPS 真实转换（03-Arch §3.3 旧格式→新格式中间格式）。
 *
 * 流程：Job→running → adapter.convert(inPath, outDir) →
 *   成功：Material→converted + Job→completed
 *   失败：Material→conversion_failed + Job→failed（error_message 固定文案，不泄漏路径）
 *
 * 边界（T-M1-006 §2 非目标）：本桥只做格式转换，**不写 normalized_texts**（文本提取属 T-M1-007）。
 */
async function runWpsConversion(
  ctx: S2Context,
  db: import("../../../data/sqlite").DatabaseSync,
  jobId: string,
  material: Record<string, unknown>,
): Promise<Job> {
  const materialId = material.id as string;
  const storageKey = material.storage_key as string;
  // storage_key 形如 semester/<id>/storage/<file>（materials.upload 写入），解析真实路径
  const inPath = path.join(ctx.dataRootPath, storageKey);
  const outDir = path.dirname(inPath);

  const startedAt = now();
  db.prepare("UPDATE jobs SET status = 'running', started_at = @ts, updated_at = @ts WHERE id = @id").run({
    id: jobId,
    ts: startedAt,
  });

  try {
    const result = await ctx.wps!.convert(inPath, outDir);
    // 成功：写 normalized_texts（中间格式文本提取，07-WF §2.3）+ Material→converted + Job→completed
    // T-M1-007 补齐：格式转换后对中间格式（docx/pptx/xlsx）提取文本并写 normalized_texts
    if (ctx.textExtractor) {
      const intermediateType = intermediateFileType(result.outFileName);
      const { text } = await ctx.textExtractor.extract(result.outPath, intermediateType);
      writeNormalizedText(ctx, db, materialId, text, { source: "wps_convert" });
    }
    const ts = now();
    db.prepare(
      "UPDATE materials SET status = 'converted', converted_at = @ts, updated_at = @ts WHERE id = @id",
    ).run({ id: materialId, ts });
    db.prepare("UPDATE jobs SET status = 'completed', completed_at = @ts, updated_at = @ts WHERE id = @id").run({
      id: jobId,
      ts,
    });
  } catch (e) {
    // 失败：Material→conversion_failed + Job→failed（error_message 固定文案，不泄漏路径/stdout/stderr）
    const ts = now();
    db.prepare("UPDATE materials SET status = 'conversion_failed', updated_at = @ts WHERE id = @id").run({
      id: materialId,
      ts,
    });
    db.prepare(
      `UPDATE jobs SET status = 'failed', error_code = 'INTERNAL_ERROR', error_message = @msg,
         completed_at = @ts, updated_at = @ts WHERE id = @id`,
    ).run({ id: jobId, ts, msg: safeWpsErrorMessage(e) });
  }

  const row = db.prepare("SELECT * FROM jobs WHERE id = @id").get({ id: jobId }) as Record<string, unknown>;
  return mapJob(row);
}

/** 从中间格式文件名推断 file_type（doc→docx / ppt→pptx / xls→xlsx，07-WF §2.3） */
function intermediateFileType(outFileName: string): string {
  const ext = outFileName.toLowerCase().split(".").pop() ?? "";
  return ext === "docx" ? "docx" : ext === "pptx" ? "pptx" : ext === "xlsx" ? "xlsx" : "docx";
}
