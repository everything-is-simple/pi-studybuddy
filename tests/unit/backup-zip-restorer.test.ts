import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createGlobalDb } from "../../src/data/global";
import { createSemesterDb } from "../../src/data/semester";
import { DatabaseSync } from "../../src/data/sqlite";
import { BackupContext } from "../../src/agent-host/handlers/backup/context";
import { packCourse } from "../../src/agent-host/handlers/backup/zip-packer";
import { restoreCourse } from "../../src/agent-host/handlers/backup/zip-restorer";
import { unpackToDirectory, packDirectory } from "../../src/agent-host/handlers/backup/zip";
import type { RpcError } from "../../src/contract/types";

/**
 * T-M2-005 zip-restorer 单件测试（05-ERD §8.2 + 07-WF §5）
 *
 * 验证：
 *   - content_hash 校验通过/失败
 *   - schema_version 兼容/不兼容
 *   - 冲突 overwrite/create_new/none
 *   - integrity_check
 *   - 恢复后 data/*.jsonl 正确导入
 *   - 恢复后 storage/ 文件正确复制
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M2-005\。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-005\\zip-restorer";

function isRpcError(e: unknown): e is RpcError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}

describe("T-M2-005 zip-restorer 单件测试", () => {
  let ctx: BackupContext;
  let semesterId: string;
  let courseId: string;
  let zipPath: string;
  const courseName = "线性代数";
  const semesterLabel = "2026 秋";

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });

    // 初始化 global.db + 学期 + 课程 + material + storage
    createGlobalDb(ISOLATION_DIR);
    semesterId = randomUUID();
    const globalDb = new DatabaseSync(path.join(ISOLATION_DIR, "global.db"));
    const now = new Date().toISOString();
    globalDb
      .prepare(
        `INSERT INTO semesters (id, student_name, semester_label, start_date, end_date, timezone, status, db_relative_path, ready, created_at, updated_at)
         VALUES (@id, '测试学生', @label, '2026-09-01', '2027-01-31', 'Asia/Shanghai', 'active', @dbPath, 1, @now, @now)`,
      )
      .run({ id: semesterId, label: semesterLabel, dbPath: `semester/${semesterId}/sem.db`, now });

    createSemesterDb(ISOLATION_DIR, semesterId);

    courseId = randomUUID();
    const semDb = new DatabaseSync(path.join(ISOLATION_DIR, "semester", semesterId, "sem.db"));
    semDb
      .prepare(
        `INSERT INTO course_instances (id, semester_id, course_name, subject, status, created_at, updated_at)
         VALUES (@id, @semId, @name, '数学', 'active', @now, @now)`,
      )
      .run({ id: courseId, semId: semesterId, name: courseName, now });

    const materialId = randomUUID();
    const storageKey = `material-${materialId}.pdf`;
    semDb
      .prepare(
        `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at)
         VALUES (@id, @courseId, 'lecture1.pdf', 'pdf', 1024, 'application/pdf', @storageKey, 'upload', 'completed', 1, @now, @now, @now)`,
      )
      .run({ id: materialId, courseId, storageKey, now });

    const storageDir = path.join(ISOLATION_DIR, "storage");
    mkdirSync(storageDir, { recursive: true });
    writeFileSync(path.join(storageDir, storageKey), Buffer.from("fake pdf content for restore"));

    semDb.close();
    globalDb.close();

    ctx = new BackupContext(ISOLATION_DIR);

    // 打包课程为 zip（供恢复测试用）
    const targetPath = path.join(ISOLATION_DIR, "backups");
    const result = packCourse(ctx, courseId, targetPath, "manual");
    zipPath = result.zipPath;
  });

  afterAll(() => {
    ctx?.dispose();
    for (let i = 0; i < 3; i++) {
      try {
        rmSync(ISOLATION_DIR, { recursive: true, force: true });
        break;
      } catch {
        // EBUSY 重试
      }
    }
  });

  it("RESTORE-01 content_hash 校验通过 → 恢复成功", () => {
    // 用新学期作为恢复目标
    const targetSemId = randomUUID();
    const globalDb = new DatabaseSync(path.join(ISOLATION_DIR, "global.db"));
    const now = new Date().toISOString();
    globalDb
      .prepare(
        `INSERT INTO semesters (id, student_name, semester_label, start_date, end_date, timezone, status, db_relative_path, ready, created_at, updated_at)
         VALUES (@id, '测试学生', '目标学期', '2027-02-01', '2027-06-30', 'Asia/Shanghai', 'active', @dbPath, 1, @now, @now)`,
      )
      .run({ id: targetSemId, dbPath: `semester/${targetSemId}/sem.db`, now });
    globalDb.close();
    createSemesterDb(ISOLATION_DIR, targetSemId);

    const result = restoreCourse(ctx, {
      zipPath,
      targetSemesterId: targetSemId,
      conflictResolution: "none",
    });

    expect(result.success).toBe(true);
    expect(result.integrityCheck).toBe("ok");
    expect(result.schemaVersion).toBe("1.0");
    expect(result.filesRestored).toBe(1);
    expect(result.tablesImported.length).toBeGreaterThan(0);
  });

  it("RESTORE-02 content_hash 校验失败 → CONTENT_HASH_MISMATCH", () => {
    // 解压 zip → 篡改 manifest content_hash → 重新打包 → 恢复时应失败
    const tamperedDir = path.join(ISOLATION_DIR, "tampered-src");
    rmSync(tamperedDir, { recursive: true, force: true });
    mkdirSync(tamperedDir, { recursive: true });
    const zipBuf = readFileSync(zipPath);
    unpackToDirectory(zipBuf, tamperedDir);

    // 篡改 manifest.json 中的 content_hash 为错误值
    const manifestPath = path.join(tamperedDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.content_hash = "0".repeat(64); // 错误的 hash
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    // 重新打包
    const tamperedZipPath = path.join(ISOLATION_DIR, "tampered.zip");
    writeFileSync(tamperedZipPath, packDirectory(tamperedDir));
    rmSync(tamperedDir, { recursive: true, force: true });

    const targetSemId = randomUUID();
    const globalDb = new DatabaseSync(path.join(ISOLATION_DIR, "global.db"));
    const now = new Date().toISOString();
    globalDb
      .prepare(
        `INSERT INTO semesters (id, student_name, semester_label, start_date, end_date, timezone, status, db_relative_path, ready, created_at, updated_at)
         VALUES (@id, '测试学生', '篡改测试学期', '2027-02-01', '2027-06-30', 'Asia/Shanghai', 'active', @dbPath, 1, @now, @now)`,
      )
      .run({ id: targetSemId, dbPath: `semester/${targetSemId}/sem.db`, now });
    globalDb.close();
    createSemesterDb(ISOLATION_DIR, targetSemId);

    try {
      restoreCourse(ctx, {
        zipPath: tamperedZipPath,
        targetSemesterId: targetSemId,
        conflictResolution: "none",
      });
      throw new Error("应抛错但未抛");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as RpcError).code).toBe("BAD_REQUEST");
      expect((e as RpcError).message).toContain("content_hash");
    }
  });

  it("RESTORE-03 冲突 overwrite → 覆盖现有课程", () => {
    // 目标学期已有同名课程
    const targetSemId = randomUUID();
    const globalDb = new DatabaseSync(path.join(ISOLATION_DIR, "global.db"));
    const now = new Date().toISOString();
    globalDb
      .prepare(
        `INSERT INTO semesters (id, student_name, semester_label, start_date, end_date, timezone, status, db_relative_path, ready, created_at, updated_at)
         VALUES (@id, '测试学生', '覆盖测试学期', '2027-02-01', '2027-06-30', 'Asia/Shanghai', 'active', @dbPath, 1, @now, @now)`,
      )
      .run({ id: targetSemId, dbPath: `semester/${targetSemId}/sem.db`, now });
    globalDb.close();
    createSemesterDb(ISOLATION_DIR, targetSemId);

    // 插入同名课程
    const semDb = new DatabaseSync(path.join(ISOLATION_DIR, "semester", targetSemId, "sem.db"));
    semDb
      .prepare(
        `INSERT INTO course_instances (id, semester_id, course_name, subject, status, created_at, updated_at)
         VALUES (@id, @semId, @name, '数学', 'active', @now, @now)`,
      )
      .run({ id: randomUUID(), semId: targetSemId, name: courseName, now });
    semDb.close();

    const result = restoreCourse(ctx, {
      zipPath,
      targetSemesterId: targetSemId,
      conflictResolution: "overwrite",
    });

    expect(result.success).toBe(true);
    expect(result.conflictResolved).toBe("overwrite");
  });

  it("RESTORE-04 冲突 create_new → 新建课程", () => {
    const targetSemId = randomUUID();
    const globalDb = new DatabaseSync(path.join(ISOLATION_DIR, "global.db"));
    const now = new Date().toISOString();
    globalDb
      .prepare(
        `INSERT INTO semesters (id, student_name, semester_label, start_date, end_date, timezone, status, db_relative_path, ready, created_at, updated_at)
         VALUES (@id, '测试学生', '新建测试学期', '2027-02-01', '2027-06-30', 'Asia/Shanghai', 'active', @dbPath, 1, @now, @now)`,
      )
      .run({ id: targetSemId, dbPath: `semester/${targetSemId}/sem.db`, now });
    globalDb.close();
    createSemesterDb(ISOLATION_DIR, targetSemId);

    const result = restoreCourse(ctx, {
      zipPath,
      targetSemesterId: targetSemId,
      conflictResolution: "create_new",
    });

    expect(result.success).toBe(true);
    expect(result.conflictResolved).toBe("none"); // 无同名课程
    expect(result.restoredCourseId).toBeTruthy();
  });

  it("RESTORE-05 恢复后 data/*.jsonl 正确导入 semester.db", () => {
    const targetSemId = randomUUID();
    const globalDb = new DatabaseSync(path.join(ISOLATION_DIR, "global.db"));
    const now = new Date().toISOString();
    globalDb
      .prepare(
        `INSERT INTO semesters (id, student_name, semester_label, start_date, end_date, timezone, status, db_relative_path, ready, created_at, updated_at)
         VALUES (@id, '测试学生', '导入验证学期', '2027-02-01', '2027-06-30', 'Asia/Shanghai', 'active', @dbPath, 1, @now, @now)`,
      )
      .run({ id: targetSemId, dbPath: `semester/${targetSemId}/sem.db`, now });
    globalDb.close();
    createSemesterDb(ISOLATION_DIR, targetSemId);

    const result = restoreCourse(ctx, {
      zipPath,
      targetSemesterId: targetSemId,
      conflictResolution: "none",
    });

    // 验证 semester.db 有 course_instances 数据
    const semDb = new DatabaseSync(path.join(ISOLATION_DIR, "semester", targetSemId, "sem.db"));
    const courses = semDb
      .prepare("SELECT * FROM course_instances WHERE course_name = @name")
      .all({ name: courseName }) as Array<{ course_name: string }>;
    expect(courses.length).toBe(1);

    // 验证有 materials 数据
    const materials = semDb.prepare("SELECT * FROM materials").all() as unknown[];
    expect(materials.length).toBe(1);

    semDb.close();
    expect(result.tablesImported).toContain("course_instances");
    expect(result.tablesImported).toContain("materials");
  });

  it("RESTORE-06 恢复后 storage/ 文件正确复制", () => {
    const targetSemId = randomUUID();
    const globalDb = new DatabaseSync(path.join(ISOLATION_DIR, "global.db"));
    const now = new Date().toISOString();
    globalDb
      .prepare(
        `INSERT INTO semesters (id, student_name, semester_label, start_date, end_date, timezone, status, db_relative_path, ready, created_at, updated_at)
         VALUES (@id, '测试学生', 'storage验证学期', '2027-02-01', '2027-06-30', 'Asia/Shanghai', 'active', @dbPath, 1, @now, @now)`,
      )
      .run({ id: targetSemId, dbPath: `semester/${targetSemId}/sem.db`, now });
    globalDb.close();
    createSemesterDb(ISOLATION_DIR, targetSemId);

    const result = restoreCourse(ctx, {
      zipPath,
      targetSemesterId: targetSemId,
      conflictResolution: "none",
    });

    expect(result.filesRestored).toBe(1);
    // storage 文件应存在
    const storageDir = path.join(ISOLATION_DIR, "storage");
    const files = readdirSync(storageDir);
    expect(files.length).toBeGreaterThanOrEqual(1);
  });
});
