/**
 * T-M2-005 zip 解包与恢复（05-ERD §8.2 恢复流程 + 07-WF §5）
 *
 * 恢复流程（05-ERD §8.2）：
 *   1. 解压 zip 到临时目录
 *   2. 读取 manifest.json，校验 content_hash
 *   3. 校验 schema_version 兼容性
 *   4. 检查目标学期是否存在同名课程（冲突 overwrite/create_new/none）
 *   5. 导入 data/*.jsonl 到 semester.db（按表依赖顺序，临时关闭 FK）
 *   6. 复制 storage/ 文件到目标学期 storage 目录
 *   7. PRAGMA integrity_check
 *
 * 安全（AGENTS.md §9.4）：
 *   - content_hash 不匹配 → CONTENT_HASH_MISMATCH
 *   - schema_version 不兼容 → SCHEMA_VERSION_INCOMPATIBLE
 *   - integrity_check 失败 → INTEGRITY_CHECK_FAILED
 *   - zip 炸弹防护（条目数/解压比上限）
 *   - 路径逃逸防护（storage/ 文件不逃逸目标目录）
 *   - 错误消息固定文案，不泄漏路径/SQL/栈
 */
import { readFileSync, rmSync, mkdirSync, existsSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { BackupContext } from "./context";
import type { RestoreResult } from "../../../contract/types";
import type { BackupManifest } from "./zip-packer";
import { SCHEMA_VERSION } from "./zip-packer";
import { unpackToDirectory, ZipBombError, PathTraversalError } from "./zip";
import { badRequest, internalError, MSG } from "./errors";

/** 导入顺序（按表依赖关系，父表先于子表） */
const IMPORT_ORDER = [
  // S1
  "course_instances",
  "assessment_attempts",
  "schedule_entries",
  "study_tasks",
  "study_events",
  // S2
  "materials",
  "normalized_texts",
  "structured_notes",
  "mind_maps",
  "knowledge_modules",
  "material_chunks",
  "jobs",
  // S3
  "questions",
  "practice_sessions",
  "practice_answers",
  // S4
  "mistakes",
  "mistake_evidence",
  "weak_points",
  // S5
  "mock_exam_papers",
  "mock_exam_questions",
  "mock_exam_attempts",
  "mock_exam_answers",
  "mock_exam_module_analyses",
  // S6
  "parent_reports",
  "report_deliveries",
];

/** 恢复参数 */
export interface RestoreOptions {
  zipPath: string;
  targetSemesterId: string;
  conflictResolution?: "overwrite" | "create_new" | "none";
}

/**
 * 解包并恢复课程数据。
 *
 * @param ctx BackupContext
 * @param options 恢复参数
 * @returns RestoreResult
 */
export function restoreCourse(ctx: BackupContext, options: RestoreOptions): RestoreResult {
  const { zipPath, targetSemesterId, conflictResolution = "none" } = options;

  // 1. 解压 zip 到临时目录
  const tempDir = path.join(ctx.dataRootPath, ".restore-tmp", `${Date.now()}-${randomUUID()}`);
  mkdirSync(tempDir, { recursive: true });

  let manifest: BackupManifest;
  let importedTables: string[] = [];
  let filesRestored = 0;
  let restoredCourseId = "";
  let conflictResolved: "overwrite" | "create_new" | "none" = "none";

  try {
    // 1. 解压（含 zip 炸弹防护 + 路径逃逸防护）
    const zipBuf = readFileSync(zipPath);
    try {
      unpackToDirectory(zipBuf, tempDir);
    } catch (e) {
      if (e instanceof ZipBombError) throw badRequest(MSG.ZIP_BOMB_DETECTED);
      if (e instanceof PathTraversalError) throw badRequest(MSG.PATH_TRAVERSAL_DETECTED);
      throw badRequest(MSG.BACKUP_FAILED);
    }

    // 2. 读取 manifest.json + 校验 content_hash
    const manifestPath = path.join(tempDir, "manifest.json");
    if (!existsSync(manifestPath)) throw badRequest(MSG.BACKUP_FAILED);
    manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as BackupManifest;

    // content_hash 校验（排除 manifest.json 的 content_hash 字段）
    const computedHash = computeDirectoryHashExcludingManifestContentHash(tempDir);
    if (computedHash !== manifest.content_hash) {
      throw badRequest(MSG.CONTENT_HASH_MISMATCH);
    }

    // 3. schema_version 兼容性校验
    if (manifest.schema_version !== SCHEMA_VERSION) {
      throw badRequest(MSG.SCHEMA_VERSION_INCOMPATIBLE);
    }

    // 4. 冲突检查 + 处理
    if (manifest.backup_type === "semester") {
      return restoreSemester(ctx, tempDir, manifest, targetSemesterId, conflictResolution);
    }

    const semDb = ctx.semesterDb(targetSemesterId);
    const existingCourse = semDb
      .prepare("SELECT id FROM course_instances WHERE course_name = @name AND deleted_at IS NULL")
      .get({ name: manifest.course_name }) as { id: string } | undefined;

    if (existingCourse) {
      if (conflictResolution === "overwrite") {
        // 软删除现有课程
        semDb
          .prepare("UPDATE course_instances SET deleted_at = @now WHERE id = @id")
          .run({ id: existingCourse.id, now: new Date().toISOString() });
        conflictResolved = "overwrite";
        restoredCourseId = manifest.course_instance_id;
      } else if (conflictResolution === "create_new") {
        // 生成新 course_instance_id
        restoredCourseId = randomUUID();
        conflictResolved = "create_new";
      } else {
        // none → 默认 create_new
        restoredCourseId = randomUUID();
        conflictResolved = "create_new";
      }
    } else {
      // 无冲突
      restoredCourseId = conflictResolution === "create_new" ? randomUUID() : manifest.course_instance_id;
      conflictResolved = "none";
    }

    // 5. 导入 data/*.jsonl 到 semester.db
    const dataDir = path.join(tempDir, "data");
    if (existsSync(dataDir)) {
      // 临时关闭 FK 约束
      semDb.exec("PRAGMA foreign_keys = OFF");
      try {
        for (const table of IMPORT_ORDER) {
          const jsonlPath = path.join(dataDir, `${table}.jsonl`);
          if (!existsSync(jsonlPath)) continue;

          const lines = readFileSync(jsonlPath, "utf8").trim().split("\n").filter(Boolean);
          if (lines.length === 0) continue;

          for (const line of lines) {
            const row = JSON.parse(line) as Record<string, unknown>;
            if (table === "course_instances") {
              row.id = restoredCourseId;
              row.semester_id = targetSemesterId;
            }
            if (table === "materials" && typeof row.storage_key === "string") {
              row.storage_key = mapStorageKey(row.storage_key, manifest.semester_id, targetSemesterId);
            }
            if (
              table !== "course_instances" &&
              row.course_instance_id === manifest.course_instance_id &&
              restoredCourseId !== manifest.course_instance_id
            ) {
              row.course_instance_id = restoredCourseId;
            }
            insertRow(semDb, table, row);
          }
          importedTables.push(table);
        }
      } finally {
        semDb.exec("PRAGMA foreign_keys = ON");
      }
    }

    const storageSrcDir = path.join(tempDir, "storage");
    if (existsSync(storageSrcDir)) {
      for (const archiveFile of collectFiles(storageSrcDir)) {
        const relative = path.relative(storageSrcDir, archiveFile).split(path.sep).join("/");
        const sourceKey = relative.startsWith("semester/") ? relative : `storage/${relative}`;
        const targetKey = mapStorageKey(sourceKey, manifest.semester_id, targetSemesterId);
        const destination = path.resolve(ctx.dataRootPath, targetKey);
        const root = path.resolve(ctx.dataRootPath) + path.sep;
        if (!destination.startsWith(root)) throw badRequest(MSG.PATH_TRAVERSAL_DETECTED);
        mkdirSync(path.dirname(destination), { recursive: true });
        copyFileSync(archiveFile, destination);
        filesRestored++;
      }
    }

    // 7. PRAGMA integrity_check
    const integrityResult = semDb.prepare("PRAGMA integrity_check").all() as Array<{ integrity_check: string }>;
    const integrityCheck = integrityResult[0]?.integrity_check === "ok" ? "ok" : "warning";
    if (integrityCheck !== "ok") {
      throw internalError(MSG.INTEGRITY_CHECK_FAILED);
    }

    return {
      success: true,
      restoredCourseId,
      conflictResolved,
      tablesImported: importedTables,
      filesRestored,
      integrityCheck,
      schemaVersion: manifest.schema_version,
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

function restoreSemester(
  ctx: BackupContext,
  tempDir: string,
  manifest: BackupManifest,
  targetSemesterId: string,
  conflictResolution: "overwrite" | "create_new" | "none",
): RestoreResult {
  if (conflictResolution !== "overwrite") {
    throw badRequest("恢复整学期备份前请确认覆盖目标学期");
  }
  const db = ctx.semesterDb(targetSemesterId);
  const dataDir = path.join(tempDir, "data");
  const importedTables: string[] = [];
  let filesRestored = 0;
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN IMMEDIATE");
    for (const table of [...IMPORT_ORDER].reverse()) db.exec(`DELETE FROM ${table}`);
    for (const table of IMPORT_ORDER) {
      const jsonlPath = path.join(dataDir, `${table}.jsonl`);
      if (!existsSync(jsonlPath)) continue;
      const lines = readFileSync(jsonlPath, "utf8").trim().split("\n").filter(Boolean);
      for (const line of lines) {
        const row = JSON.parse(line) as Record<string, unknown>;
        if ("semester_id" in row) row.semester_id = targetSemesterId;
        if (table === "materials" && typeof row.storage_key === "string") {
          row.storage_key = mapStorageKey(row.storage_key, manifest.semester_id, targetSemesterId);
        }
        insertRow(db, table, row);
      }
      importedTables.push(table);
    }
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* no active transaction */ }
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }

  const storageSrcDir = path.join(tempDir, "storage");
  if (existsSync(storageSrcDir)) {
    for (const archiveFile of collectFiles(storageSrcDir)) {
      const relative = path.relative(storageSrcDir, archiveFile).split(path.sep).join("/");
      const sourceKey = relative.startsWith("semester/") ? relative : `storage/${relative}`;
      const targetKey = mapStorageKey(sourceKey, manifest.semester_id, targetSemesterId);
      const destination = path.resolve(ctx.dataRootPath, targetKey);
      const root = path.resolve(ctx.dataRootPath) + path.sep;
      if (!destination.startsWith(root)) throw badRequest(MSG.PATH_TRAVERSAL_DETECTED);
      mkdirSync(path.dirname(destination), { recursive: true });
      copyFileSync(archiveFile, destination);
      filesRestored++;
    }
  }

  restoreSemesterTargets(ctx, tempDir, targetSemesterId);
  restoreSemesterExports(ctx.dataRootPath, tempDir, targetSemesterId);
  const integrity = db.prepare("PRAGMA integrity_check").all() as Array<{ integrity_check: string }>;
  if (integrity[0]?.integrity_check !== "ok") throw internalError(MSG.INTEGRITY_CHECK_FAILED);
  return {
    success: true,
    restoredCourseId: "",
    conflictResolved: "overwrite",
    tablesImported: importedTables,
    filesRestored,
    integrityCheck: "ok",
    schemaVersion: manifest.schema_version,
  };
}

function restoreSemesterTargets(ctx: BackupContext, tempDir: string, targetSemesterId: string): void {
  const jsonlPath = path.join(tempDir, "global", "parent_report_targets.jsonl");
  if (!existsSync(jsonlPath)) return;
  const db = ctx.globalDb;
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM parent_report_targets WHERE semester_id = @semesterId").run({ semesterId: targetSemesterId });
    for (const line of readFileSync(jsonlPath, "utf8").split("\n").filter(Boolean)) {
      const row = JSON.parse(line) as Record<string, unknown>;
      row.semester_id = targetSemesterId;
      insertRow(db, "parent_report_targets", row);
    }
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* no active transaction */ }
    throw error;
  }
}

function restoreSemesterExports(dataRoot: string, tempDir: string, semesterId: string): void {
  const sourceRoot = path.join(tempDir, "exports");
  if (!existsSync(sourceRoot)) return;
  const destinationRoot = path.join(dataRoot, "exports", semesterId);
  copyDirectorySafely(sourceRoot, destinationRoot);
}

function copyDirectorySafely(sourceRoot: string, destinationRoot: string): void {
  mkdirSync(destinationRoot, { recursive: true });
  for (const item of readdirSync(sourceRoot)) {
    const source = path.join(sourceRoot, item);
    const destination = path.join(destinationRoot, item);
    const resolved = path.resolve(destination);
    const root = path.resolve(destinationRoot);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) throw badRequest(MSG.PATH_TRAVERSAL_DETECTED);
    if (statSync(source).isDirectory()) copyDirectorySafely(source, destination);
    else copyFileSync(source, destination);
  }
}

/** 动态 INSERT 一行到指定表 */
function collectFiles(root: string): string[] {
  const files: string[] = [];
  for (const item of readdirSync(root)) {
    const fullPath = path.join(root, item);
    if (statSync(fullPath).isDirectory()) files.push(...collectFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function mapStorageKey(storageKey: string, sourceSemesterId: string, targetSemesterId: string): string {
  const sourcePrefix = `semester/${sourceSemesterId}/`;
  if (storageKey.startsWith(sourcePrefix)) return `semester/${targetSemesterId}/${storageKey.slice(sourcePrefix.length)}`;
  return storageKey;
}

 /** 动态 INSERT 一行到指定表 */
function insertRow(
  db: import("../../../data/sqlite").DatabaseSync,
  table: string,
  row: Record<string, unknown>,
): void {
  const columns = Object.keys(row);
  const placeholders = columns.map((c) => `@${c}`).join(", ");
  const columnList = columns.join(", ");
  db.prepare(`INSERT OR REPLACE INTO ${table} (${columnList}) VALUES (${placeholders})`).run(
    row as Record<string, string | number | bigint | Uint8Array | null>,
  );
}

/** 计算 content_hash（排除 manifest.json 的 content_hash 字段，与 zip-packer 一致） */
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
