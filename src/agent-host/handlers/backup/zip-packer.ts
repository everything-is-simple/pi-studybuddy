/**
 * T-M2-005 zip 打包器（05-ERD §8.1 备份 zip 内部结构 + 07-WF §5）
 *
 * 打包流程：
 *   1. 通过 courseInstanceId 定位 semester.db
 *   2. 查询 course_name / semester_label（manifest 字段）
 *   3. 按 course_instance_id 过滤导出 data/*.jsonl（直接关联 + 间接关联表）
 *   4. 复制 storage_key 指向的资料文件到 storage/
 *   5. 生成 manifest.json（10 字段）
 *   6. 计算 content_hash=SHA-256（目录全部文件按路径排序）
 *   7. 打包为 zip 文件写入 targetPath
 *
 * 安全（AGENTS.md §9.4）：
 *   - 不泄漏路径/SQL/栈到日志
 *   - 错误消息固定文案
 */
import { mkdirSync, writeFileSync, copyFileSync, existsSync, rmSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import type { BackupContext, BackupProgressEvent } from "./context";
import type { BackupType } from "../../../contract/types";
import { findSemesterByCourseId, getSemesterLabel, getCourseName } from "./lookup";
import { badRequest, MSG } from "./errors";
import { packDirectory } from "./zip";
function resolveStoragePath(dataRoot: string, storageKey: string): { source: string; archiveRelative: string } {
  const normalizedKey = storageKey.replaceAll("\\", "/");
  const segments = normalizedKey.split("/");
  if (!normalizedKey || path.posix.isAbsolute(normalizedKey) || segments.includes("..") || segments.includes(".")) {
    throw badRequest(MSG.PATH_TRAVERSAL_DETECTED);
  }
  const root = path.resolve(dataRoot);
  const source = path.resolve(root, ...segments);
  if (source !== root && !source.startsWith(`${root}${path.sep}`)) {
    throw badRequest(MSG.PATH_TRAVERSAL_DETECTED);
  }
  return { source, archiveRelative: segments.join("/") };
}

/** 当前 schema_version（05-ERD §8.1） */
export const SCHEMA_VERSION = "1.0";

/**
 * 备份表配置（05-ERD §3 学期库表）
 *
 * direct: 直接有 course_instance_id 字段的表
 * indirect: 通过外键间接关联的表（子查询过滤）
 */
interface TableConfig {
  table: string;
  type: "direct" | "indirect";
  /** indirect 类型的子查询列（如 material_id）+ 子查询表（如 materials） */
  indirectColumn?: string;
  indirectRefTable?: string;
}

const BACKUP_TABLES: TableConfig[] = [
  // S1
  { table: "course_instances", type: "direct" },
  { table: "assessment_attempts", type: "direct" },
  { table: "schedule_entries", type: "direct" },
  { table: "study_tasks", type: "direct" },
  { table: "study_events", type: "direct" },
  // S2
  { table: "materials", type: "direct" },
  { table: "normalized_texts", type: "indirect", indirectColumn: "material_id", indirectRefTable: "materials" },
  { table: "structured_notes", type: "indirect", indirectColumn: "material_id", indirectRefTable: "materials" },
  { table: "mind_maps", type: "indirect", indirectColumn: "material_id", indirectRefTable: "materials" },
  { table: "knowledge_modules", type: "direct" },
  { table: "material_chunks", type: "indirect", indirectColumn: "material_id", indirectRefTable: "materials" },
  { table: "jobs", type: "indirect", indirectColumn: "material_id", indirectRefTable: "materials" },
  // S3
  { table: "questions", type: "direct" },
  { table: "practice_sessions", type: "direct" },
  { table: "practice_answers", type: "direct" },
  // S4
  { table: "mistakes", type: "direct" },
  { table: "mistake_evidence", type: "indirect", indirectColumn: "mistake_id", indirectRefTable: "mistakes" },
  { table: "weak_points", type: "direct" },
  // S5
  { table: "mock_exam_papers", type: "direct" },
  { table: "mock_exam_questions", type: "indirect", indirectColumn: "mock_paper_id", indirectRefTable: "mock_exam_papers" },
  { table: "mock_exam_attempts", type: "direct" },
  { table: "mock_exam_answers", type: "indirect", indirectColumn: "mock_attempt_id", indirectRefTable: "mock_exam_attempts" },
  { table: "mock_exam_module_analyses", type: "indirect", indirectColumn: "mock_attempt_id", indirectRefTable: "mock_exam_attempts" },
  // S6 parent_reports / report_deliveries 按 semester 维度，不按 course 导出
];

/** manifest.json 结构（05-ERD §8.1） */
export interface BackupManifest {
  course_instance_id: string;
  course_name: string;
  semester_id: string;
  semester_label: string;
  backup_type: BackupType;
  backup_date: string;
  content_hash: string;
  schema_version: string;
  tables: string[];
  file_count: number;
  total_size_bytes: number;
}

/** 打包结果 */
export interface PackResult {
  zipFilename: string;
  zipPath: string;
  contentHash: string;
  fileSizeBytes: number;
  manifest: BackupManifest;
}

/**
 * 打包单课程为 zip。
 *
 * @param ctx BackupContext
 * @param courseInstanceId 课程实例 ID
 * @param targetPath 目标目录（zip 文件写入此目录）
 * @param backupType 备份类型
 * @param emit 可选进度回调
 */
export function packCourse(
  ctx: BackupContext,
  courseInstanceId: string,
  targetPath: string,
  backupType: BackupType,
  emit?: (event: BackupProgressEvent) => void,
): PackResult {
  // 1. 定位 semester.db
  const { db, semesterId } = findSemesterByCourseId(ctx, courseInstanceId);
  const courseName = getCourseName(db, courseInstanceId);
  const semesterLabel = getSemesterLabel(ctx, semesterId);

  // 2. 创建临时打包目录
  const backupDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const tempDir = path.join(ctx.dataRootPath, ".backup-tmp", `${courseInstanceId}-${Date.now()}`);
  const dataDir = path.join(tempDir, "data");
  const storageDir = path.join(tempDir, "storage");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(storageDir, { recursive: true });

  try {
    // 3. 导出 data/*.jsonl
    const exportedTables: string[] = [];
    for (const config of BACKUP_TABLES) {
      const rows = queryTableByCourse(db, config, courseInstanceId);
      if (rows.length > 0) {
        const jsonl = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
        writeFileSync(path.join(dataDir, `${config.table}.jsonl`), jsonl, "utf8");
        exportedTables.push(config.table);
      }
      emit?.({ backupRecordId: "", phase: "packing", progress: 0 });
    }

    // 4. 复制 storage 文件
    const materials = db
      .prepare("SELECT storage_key FROM materials WHERE course_instance_id = @id AND deleted_at IS NULL")
      .all({ id: courseInstanceId }) as Array<{ storage_key: string }>;

    let fileCount = exportedTables.length;
    for (const m of materials) {
      const storage = resolveStoragePath(ctx.dataRootPath, m.storage_key);
      const archivePath = path.join(storageDir, storage.archiveRelative);
      if (existsSync(storage.source)) {
        mkdirSync(path.dirname(archivePath), { recursive: true });
        copyFileSync(storage.source, archivePath);
        fileCount++;
      }
    }

    // 5. 生成 manifest.json（content_hash + total_size_bytes 先占位，最后一次性回填）
    // 先计算 total_size_bytes（不含 manifest.json，因为 manifest 还没写）
    const totalSizeBytes = computeDataSize(dataDir) + computeStorageSize(storageDir);

    const manifest: BackupManifest = {
      course_instance_id: courseInstanceId,
      course_name: courseName,
      semester_id: semesterId,
      semester_label: semesterLabel,
      backup_type: backupType,
      backup_date: backupDate,
      content_hash: "", // 占位，下面回填
      schema_version: SCHEMA_VERSION,
      tables: exportedTables,
      file_count: fileCount,
      total_size_bytes: totalSizeBytes,
    };

    // 6. 计算 content_hash（manifest.json 排除 content_hash 字段，按目录全部文件排序）
    // 先写临时 manifest（content_hash 为空），计算目录 hash，再回填
    writeFileSync(path.join(tempDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

    // content_hash = SHA-256(目录全部文件按路径排序)
    // 注意：manifest.json 的 content_hash 字段不参与 hash 计算（自指问题）
    const contentHash = computeDirectoryHashExcludingManifestContentHash(tempDir);
    manifest.content_hash = contentHash;

    // 重新写 manifest（含正确 content_hash，total_size_bytes 已在第一步填好）
    writeFileSync(path.join(tempDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

    // 7. 打包为 zip
    const zipFilename = sanitizeFilename(`${courseName}-${backupDate}.zip`);
    mkdirSync(targetPath, { recursive: true });
    const zipPath = path.join(targetPath, zipFilename);
    const zipBuf = packDirectory(tempDir);
    writeFileSync(zipPath, zipBuf);

    emit?.({ backupRecordId: "", phase: "completed", progress: 100 });

    return {
      zipFilename,
      zipPath,
      contentHash,
      fileSizeBytes: zipBuf.length,
      manifest,
    };

  } finally {
    // 清理临时目录
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // 忽略清理失败
    }
  }
}

/** 打包一个学期的所有数据库业务行与其资料文件。 */
export function packSemester(
  ctx: BackupContext,
  semesterId: string,
  targetPath: string,
  emit?: (event: BackupProgressEvent) => void,
): PackResult {
  const db = ctx.semesterDb(semesterId);
  const label = getSemesterLabel(ctx, semesterId);
  const backupDate = new Date().toISOString().slice(0, 10);
  const tempDir = path.join(ctx.dataRootPath, ".backup-tmp", `semester-${semesterId}-${Date.now()}`);
  const dataDir = path.join(tempDir, "data");
  const globalDir = path.join(tempDir, "global");
  const storageDir = path.join(tempDir, "storage");
  const exportsDir = path.join(tempDir, "exports");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(globalDir, { recursive: true });
  mkdirSync(storageDir, { recursive: true });
  mkdirSync(exportsDir, { recursive: true });
  try {
    const tableNames = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string }>).map(({ name }) => name);
    const exportedTables: string[] = [];
    for (const [index, table] of tableNames.entries()) {
      const rows = db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
      if (rows.length > 0) {
        writeFileSync(path.join(dataDir, `${table}.jsonl`), `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
        exportedTables.push(table);
      }
      emit?.({ backupRecordId: "", phase: "packing", progress: Math.round((index + 1) / tableNames.length * 70) });
    }
    const storageKeys = db.prepare("SELECT storage_key FROM materials WHERE deleted_at IS NULL").all() as Array<{ storage_key: string }>;
    for (const { storage_key } of storageKeys) {
      const storage = resolveStoragePath(ctx.dataRootPath, storage_key);
      const archivePath = path.join(storageDir, storage.archiveRelative);
      if (existsSync(storage.source)) {
        mkdirSync(path.dirname(archivePath), { recursive: true });
        copyFileSync(storage.source, archivePath);
      }
    }
    const targets = ctx.globalDb
      .prepare("SELECT * FROM parent_report_targets WHERE semester_id = @semesterId AND deleted_at IS NULL")
      .all({ semesterId }) as Record<string, unknown>[];
    if (targets.length > 0) {
      writeFileSync(path.join(globalDir, "parent_report_targets.jsonl"), `${targets.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
    }
    copySemesterExports(ctx.dataRootPath, semesterId, exportsDir);
    const globalSize = computeDataSize(globalDir);
    const exportsSize = computeDataSize(exportsDir);
    const manifest: BackupManifest = {
      course_instance_id: "",
      course_name: "",
      semester_id: semesterId,
      semester_label: label,
      backup_type: "semester",
      backup_date: backupDate,
      content_hash: "",
      schema_version: SCHEMA_VERSION,
      tables: exportedTables,
      file_count: exportedTables.length + storageKeys.length + (targets.length > 0 ? 1 : 0) + countFiles(exportsDir),
      total_size_bytes: computeDataSize(dataDir) + computeStorageSize(storageDir) + globalSize + exportsSize,
    };
    writeFileSync(path.join(tempDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    const contentHash = computeDirectoryHashExcludingManifestContentHash(tempDir);
    manifest.content_hash = contentHash;
    writeFileSync(path.join(tempDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    const zipFilename = sanitizeFilename(`${label}-${backupDate}-semester.zip`);
    mkdirSync(targetPath, { recursive: true });
    const zipPath = path.join(targetPath, zipFilename);
    const zip = packDirectory(tempDir);
    writeFileSync(zipPath, zip);
    emit?.({ backupRecordId: "", phase: "completed", progress: 100 });
    return { zipFilename, zipPath, contentHash, fileSizeBytes: zip.length, manifest };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/** 查询表数据（按 course_instance_id 过滤） */
function queryTableByCourse(
  db: import("../../../data/sqlite").DatabaseSync,
  config: TableConfig,
  courseInstanceId: string,
): Record<string, unknown>[] {
  if (config.type === "direct") {
    if (config.table === "course_instances") {
      return db.prepare("SELECT * FROM course_instances WHERE id = @id").all({ id: courseInstanceId }) as Record<string, unknown>[];
    }
    return db
      .prepare(`SELECT * FROM ${config.table} WHERE course_instance_id = @id`)
      .all({ id: courseInstanceId }) as Record<string, unknown>[];
  } else {
    // indirect: 子查询过滤
    const col = config.indirectColumn!;
    const refTable = config.indirectRefTable!;
    return db
      .prepare(
        `SELECT * FROM ${config.table} WHERE ${col} IN (SELECT id FROM ${refTable} WHERE course_instance_id = @id)`,
      )
      .all({ id: courseInstanceId }) as Record<string, unknown>[];
  }
}

/** 计算 content_hash（排除 manifest.json 的 content_hash 字段，避免自指） */
function computeDirectoryHashExcludingManifestContentHash(dir: string): string {
  const files: Array<{ filename: string; data: Buffer }> = [];

  function collect(baseDir: string, currentDir: string) {
    for (const item of readdirSync(currentDir)) {
      const fullPath = path.join(currentDir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        collect(baseDir, fullPath);
      } else {
        const relPath = path.relative(baseDir, fullPath).split(path.sep).join("/");
        files.push({ filename: relPath, data: readFileSync(fullPath) });
      }
    }
  }
  collect(dir, dir);
  files.sort((a, b) => a.filename.localeCompare(b.filename));

  const hash = createHash("sha256");
  for (const f of files) {
    if (f.filename === "manifest.json") {
      // 排除 content_hash 字段后参与 hash
      const manifest = JSON.parse(f.data.toString("utf8"));
      const { content_hash, ...rest } = manifest;
      hash.update(f.filename);
      hash.update(JSON.stringify(rest));
    } else {
      hash.update(f.filename);
      hash.update(f.data);
    }
  }
  return hash.digest("hex");
}

/** 计算目录大小（字节） */
function computeDataSize(dir: string): number {
  let size = 0;
  function walk(currentDir: string) {
    for (const item of readdirSync(currentDir)) {
      const fullPath = path.join(currentDir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) walk(fullPath);
      else size += stat.size;
    }
  }
  walk(dir);
  return size;
}

/** 计算目录大小（与 computeDataSize 同逻辑，语义化命名） */
function computeStorageSize(dir: string): number {
  return computeDataSize(dir);
}
function copySemesterExports(dataRoot: string, semesterId: string, destination: string): void {
  const source = path.join(dataRoot, "exports", semesterId);
  if (!existsSync(source)) return;
  copyDirectory(source, destination);
}

function copyDirectory(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  for (const item of readdirSync(source)) {
    const sourcePath = path.join(source, item);
    const destinationPath = path.join(destination, item);
    if (statSync(sourcePath).isDirectory()) copyDirectory(sourcePath, destinationPath);
    else copyFileSync(sourcePath, destinationPath);
  }
}

function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).reduce((count, item) => {
    const itemPath = path.join(dir, item);
    return count + (statSync(itemPath).isDirectory() ? countFiles(itemPath) : 1);
  }, 0);
}

/** 文件名安全化（移除非法字符） */
function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_");
}
