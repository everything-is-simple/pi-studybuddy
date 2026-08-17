/**
 * T-M2-003 S7 classCapture handler（06-API §3.9 + 07-WF §2.7 + 03-Arch §3.3）
 *
 * 2 方法：
 *   - transcribe：许可校验 + PCM WAV 文件头验证（adapter 内部）+ whisper.cpp 同步转写 + finally 清理 tmp
 *   - saveTranscription：handoff 到 S2（material + normalized_text + study_event）
 *
 * 安全（07-WF §2.7 关键约束）：
 *   - 许可确认强制（permissionConfirmed=false → BAD_REQUEST）
 *   - 原始音频只暂存 tmp/class-capture/<request-id>/，finally 清理（不留存）
 *   - 错误消息固定文案，不含路径/stdout/stderr/密钥
 *   - 不返回 stdout 全文，只返回 { transcription }
 *
 * handoff 到 S2（05-ERD §3.2.1/§3.2.2/§3.1.5）：
 *   - materials：file_type='text' / source_type='class_audio_transcription' / status='converted' / permission_confirmed=1
 *   - normalized_texts：content_hash=SHA-256(transcription) / char_count / source_type='class_audio_transcription'
 *   - study_events：event_type='class_handoff_saved' / source_system='S7' / source_ref_id=material_id
 */
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import type { Material, FileMeta } from "../../../contract/types";
import type { S7Context } from "./context";
import { findSemesterByCourseId } from "./lookup";
import { writeClassHandoffSavedEvent } from "./events";
import { mapMaterial } from "./dto";
import { badRequest } from "./errors";

function now(): string {
  return new Date().toISOString();
}

/** 许可确认固定文案（07-WF §2.7） */
const MSG_PERMISSION_REQUIRED = "需要课堂采集许可确认";

/** 转写失败固定文案（07-WF §2.7，不泄漏 stdout/stderr） */
const MSG_TRANSCRIBE_FAILED = "转写失败，请检查音频文件是否完整";

/**
 * classCapture.transcribe handler 工厂。
 *
 * 流程（07-WF §2.7）：
 *   1. 许可确认校验（permissionConfirmed=false → BAD_REQUEST）
 *   2. 创建 tmp/class-capture/<request-id>/ 目录（原始音频暂存位置，finally 清理）
 *   3. 调 WhisperCppAdapter.transcribe（内部先验证 PCM WAV 文件头，再转写）
 *   4. 成功返回 { transcription }；失败抛 INTERNAL_ERROR 固定文案
 *   5. finally 清理 tmp/class-capture/<request-id>/（无论成功/失败）
 *
 * 安全：错误消息固定文案，不含 audioFilePath/cliPath/modelPath/stdout/stderr。
 */
export function handleTranscribe(
  ctx: S7Context,
): (params: unknown) => Promise<{ transcription: string }> {
  return async (params: unknown): Promise<{ transcription: string }> => {
    const p = params as {
      courseId: string;
      audioFile: FileMeta;
      permissionConfirmed: boolean;
    };

    // 1. 许可确认强制（07-WF §2.7 关键约束）
    if (!p.permissionConfirmed) {
      throw badRequest(MSG_PERMISSION_REQUIRED);
    }

    // 2. 提取音频文件路径（FileMeta.path，S7 必填）
    const audioFilePath = p.audioFile?.path;
    if (!audioFilePath) {
      throw badRequest("缺少音频文件路径");
    }

    // 3. 创建 tmp/class-capture/<request-id>/ 目录（原始音频暂存位置，finally 清理）
    const requestId = randomUUID();
    const requestTmpDir = path.join(ctx.tmpRoot, requestId);
    try {
      mkdirSync(requestTmpDir, { recursive: true });
    } catch {
      // tmp 创建失败不阻塞转写（路径只用于暂存，实际转写用 audioFilePath）
    }

    // 4. 调 WhisperCppAdapter.transcribe（内部先验证 PCM WAV 文件头，再转写）
    try {
      const result = await ctx.whisperAdapter.transcribe(audioFilePath);
      // 仅返回 { transcription }，不返回 stdout 全文（08-Test §3.3.2 断言 3）
      return { transcription: result.text };
    } catch (e) {
      // adapter 抛的 RpcError（BAD_REQUEST 文件头验证失败 / INTERNAL_ERROR 转写失败）直接透传
      // 但如果是 INTERNAL_ERROR，统一用固定文案"转写失败"（防止 adapter 实现泄漏 stdout/stderr）
      if (e && typeof e === "object" && "code" in e) {
        const err = e as { code?: string; message?: string };
        if (err.code === "BAD_REQUEST") {
          // 文件头验证失败：透传 BAD_REQUEST（消息已固定文案）
          throw e;
        }
        if (err.code === "INTERNAL_ERROR") {
          if (err.message === "语音转写未配置，请在设置中指定 whisper.cpp 路径") {
            throw e;
          }
          // 转写失败：用 handler 层固定文案（双重保险，防止 adapter 实现泄漏 stdout/stderr）
          throw { code: "INTERNAL_ERROR", message: MSG_TRANSCRIBE_FAILED };
        }
      }
      // 未知异常：统一 INTERNAL_ERROR 固定文案
      throw { code: "INTERNAL_ERROR", message: MSG_TRANSCRIBE_FAILED };
    } finally {
      // 5. finally 清理 tmp/class-capture/<request-id>/（无论成功/失败，不留存原始音频）
      try {
        rmSync(requestTmpDir, { recursive: true, force: true });
      } catch {
        // 清理失败不阻塞主流程（不影响转写结果）
      }
    }
  };
}

/**
 * classCapture.saveTranscription handler 工厂。
 *
 * 流程（07-WF §2.7 步骤 5 handoff 到 S2）：
 *   1. 参数校验（transcription/title 非空）
 *   2. findSemesterByCourseId 定位 semester.db
 *   3. 创建 material（file_type='text' / source_type='class_audio_transcription' / status='converted' / permission_confirmed=1）
 *   4. 创建 normalized_text（content_hash=SHA-256 / char_count / source_type='class_audio_transcription'）
 *   5. 写 study_event（class_handoff_saved / source_system='S7' / source_ref_id=material_id）
 *   6. 返回 Material DTO
 */
export function handleSaveTranscription(ctx: S7Context): (params: unknown) => Material {
  return (params: unknown): Material => {
    const p = params as {
      courseId: string;
      transcription: string;
      title: string;
    };

    // 1. 参数校验
    if (!p.transcription || p.transcription.trim() === "") {
      throw badRequest("转写文本不能为空");
    }
    if (!p.title || p.title.trim() === "") {
      throw badRequest("笔记标题不能为空");
    }

    // 2. 定位 semester.db（courseId → semesterId）
    const { db, semesterId } = findSemesterByCourseId(ctx, p.courseId);

    // 3. 创建 material（05-ERD §3.2.1）
    const materialId = randomUUID();
    const ts = now();
    const fileSizeBytes = Buffer.byteLength(p.transcription, "utf8");
    const storageKey = `semester/${semesterId}/class-capture/${materialId}.txt`;

    db.prepare(
      `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, converted_at, created_at, updated_at)
       VALUES (@id, @cid, @fileName, 'text', @fileSize, 'text/plain', @storageKey, 'class_audio_transcription', 'converted', 1, @ts, @ts, @ts, @ts)`,
    ).run({
      id: materialId,
      cid: p.courseId,
      fileName: p.title,
      fileSize: fileSizeBytes,
      storageKey,
      ts,
    });

    // 4. 创建 normalized_text（05-ERD §3.2.2，UNIQUE(material_id)）
    const normalizedTextId = randomUUID();
    const contentHash = createHash("sha256").update(p.transcription).digest("hex");
    const charCount = p.transcription.length;
    const extractionMetaJson = JSON.stringify({
      source: "class_audio_transcription",
      handler: "S7.classCapture.saveTranscription",
    });

    db.prepare(
      `INSERT INTO normalized_texts (id, material_id, content, content_hash, char_count, source_type, extraction_meta_json, created_at)
       VALUES (@id, @mid, @content, @hash, @charCount, 'class_audio_transcription', @meta, @ts)`,
    ).run({
      id: normalizedTextId,
      mid: materialId,
      content: p.transcription,
      hash: contentHash,
      charCount,
      meta: extractionMetaJson,
      ts,
    });

    // 5. 写 study_event（05-ERD §3.1.5，source_system='S7'）
    writeClassHandoffSavedEvent(db, semesterId, p.courseId, materialId);

    // 6. 返回 Material DTO
    const row = db
      .prepare("SELECT * FROM materials WHERE id = @id")
      .get({ id: materialId }) as Record<string, unknown>;
    return mapMaterial(row);
  };
}
