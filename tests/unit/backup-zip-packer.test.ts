import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createGlobalDb } from "../../src/data/global";
import { createSemesterDb } from "../../src/data/semester";
import { DatabaseSync } from "../../src/data/sqlite";
import { BackupContext } from "../../src/agent-host/handlers/backup/context";
import { packCourse, SCHEMA_VERSION, type BackupManifest } from "../../src/agent-host/handlers/backup/zip-packer";
import { unpackZip } from "../../src/agent-host/handlers/backup/zip";

/**
 * T-M2-005 zip-packer 单件测试（05-ERD §8.1 + 07-WF §5）
 *
 * 验证：
 *   - manifest.json 字段完整（10 字段）
 *   - data/*.jsonl 按 course_instance_id 过滤导出
 *   - storage/ 复制该课程 storage_key 指向的资料文件
 *   - content_hash=SHA-256 计算正确
 *   - zip 文件名格式 <course-name>-<backup-date>.zip
 *   - 空课程可备份
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M2-005\。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-005\\zip-packer";

describe("T-M2-005 zip-packer 单件测试", () => {
  let ctx: BackupContext;
  let semesterId: string;
  let courseId: string;
  let storageKey: string;
  const courseName = "高等数学";
  const semesterLabel = "2026 秋";

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });

    // 1. 初始化 global.db
    createGlobalDb(ISOLATION_DIR);

    // 2. 插入学期记录
    semesterId = randomUUID();
    const globalDb = new DatabaseSync(path.join(ISOLATION_DIR, "global.db"));
    const now = new Date().toISOString();
    globalDb
      .prepare(
        `INSERT INTO semesters (id, student_name, semester_label, start_date, end_date, timezone, status, db_relative_path, ready, created_at, updated_at)
         VALUES (@id, @studentName, @label, @startDate, @endDate, @tz, 'active', @dbPath, 1, @now, @now)`,
      )
      .run({
        id: semesterId,
        studentName: "测试学生",
        label: semesterLabel,
        startDate: "2026-09-01",
        endDate: "2027-01-31",
        tz: "Asia/Shanghai",
        dbPath: `semester/${semesterId}/sem.db`,
        now,
      });

    // 3. 初始化 semester.db
    createSemesterDb(ISOLATION_DIR, semesterId);

    // 4. 插入 course_instance
    courseId = randomUUID();
    const semDbPath = path.join(ISOLATION_DIR, "semester", semesterId, "sem.db");
    const semDb = new DatabaseSync(semDbPath);
    semDb
      .prepare(
        `INSERT INTO course_instances (id, semester_id, course_name, subject, status, created_at, updated_at)
         VALUES (@id, @semId, @name, '数学', 'active', @now, @now)`,
      )
      .run({ id: courseId, semId: semesterId, name: courseName, now });

    // 5. 插入 material + storage 文件
    const materialId = randomUUID();
    storageKey = `semester/${semesterId}/storage/material-${materialId}.pdf`;
    semDb
      .prepare(
        `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at)
         VALUES (@id, @courseId, @fileName, 'pdf', 1024, 'application/pdf', @storageKey, 'upload', 'completed', 1, @now, @now, @now)`,
      )
      .run({ id: materialId, courseId, fileName: "lecture1.pdf", storageKey, now });

    const storagePath = path.join(ISOLATION_DIR, storageKey);
    mkdirSync(path.dirname(storagePath), { recursive: true });
    writeFileSync(storagePath, Buffer.from("fake pdf content"));

    // 6. 插入 knowledge_module（直接关联表）
    semDb
      .prepare(
        `INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name, importance, learn_status, source_evidence_json, ai_generated, created_at, updated_at)
         VALUES (@id, @courseId, @materialId, '模块1', 5, 'not_started', '[]', 0, @now, @now)`,
      )
      .run({ id: randomUUID(), courseId, materialId, now });

    // 7. 插入 normalized_text（间接关联，通过 material_id）
    semDb
      .prepare(
        `INSERT INTO normalized_texts (id, material_id, content, content_hash, char_count, source_type, created_at)
         VALUES (@id, @materialId, 'normalized content', 'fake-hash', 100, 'upload', @now)`,
      )
      .run({ id: randomUUID(), materialId, now });

    semDb.close();
    globalDb.close();
    ctx = new BackupContext(ISOLATION_DIR);
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

  it("PACK-01 manifest.json 字段完整（10 字段）", () => {
    const targetPath = path.join(ISOLATION_DIR, "backups", "01");
    const result = packCourse(ctx, courseId, targetPath, "manual");

    const manifest = result.manifest;
    expect(manifest.course_instance_id).toBe(courseId);
    expect(manifest.course_name).toBe(courseName);
    expect(manifest.semester_id).toBe(semesterId);
    expect(manifest.semester_label).toBe(semesterLabel);
    expect(manifest.backup_type).toBe("manual");
    expect(manifest.backup_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(manifest.content_hash).toHaveLength(64); // SHA-256 hex
    expect(manifest.schema_version).toBe(SCHEMA_VERSION);
    expect(Array.isArray(manifest.tables)).toBe(true);
    expect(manifest.tables.length).toBeGreaterThan(0);
    expect(manifest.file_count).toBeGreaterThan(0);
    expect(manifest.total_size_bytes).toBeGreaterThan(0);
  });

  it("PACK-02 data/*.jsonl 按 course_instance_id 过滤导出", () => {
    const targetPath = path.join(ISOLATION_DIR, "backups", "02");
    const result = packCourse(ctx, courseId, targetPath, "manual");

    // 解压验证
    const zipBuf = readFileSync(result.zipPath);
    const entries = unpackZip(zipBuf);

    // 应包含 course_instances.jsonl
    const courseJsonl = entries.find((e) => e.filename === "data/course_instances.jsonl");
    expect(courseJsonl).toBeDefined();
    const courseRows = courseJsonl!.data.toString("utf8").trim().split("\n").map(JSON.parse);
    expect(courseRows.length).toBe(1);
    expect(courseRows[0].id).toBe(courseId);
    expect(courseRows[0].course_name).toBe(courseName);

    // 应包含 materials.jsonl
    const materialsJsonl = entries.find((e) => e.filename === "data/materials.jsonl");
    expect(materialsJsonl).toBeDefined();
    const materialRows = materialsJsonl!.data.toString("utf8").trim().split("\n").map(JSON.parse);
    expect(materialRows.length).toBe(1);

    // 应包含 knowledge_modules.jsonl（直接关联）
    const modulesJsonl = entries.find((e) => e.filename === "data/knowledge_modules.jsonl");
    expect(modulesJsonl).toBeDefined();

    // 应包含 normalized_texts.jsonl（间接关联，通过 material_id）
    const normJsonl = entries.find((e) => e.filename === "data/normalized_texts.jsonl");
    expect(normJsonl).toBeDefined();
    const normRows = normJsonl!.data.toString("utf8").trim().split("\n").map(JSON.parse);
    expect(normRows.length).toBe(1);
  });

  it("PACK-03 storage/ 复制该课程资料文件", () => {
    const targetPath = path.join(ISOLATION_DIR, "backups", "03");
    const result = packCourse(ctx, courseId, targetPath, "manual");

    const zipBuf = readFileSync(result.zipPath);
    const entries = unpackZip(zipBuf);

    // storage/ 下应有 material-*.pdf
    const storageFiles = entries.filter((e) => e.filename === `storage/${storageKey}`);
    expect(storageFiles.length).toBe(1);
    expect(storageFiles[0].data.toString("utf8")).toBe("fake pdf content");
  });

  it("PACK-04 content_hash=SHA-256 计算正确（64 字符 hex）", () => {
    const targetPath = path.join(ISOLATION_DIR, "backups", "04");
    const result = packCourse(ctx, courseId, targetPath, "manual");

    expect(result.contentHash).toHaveLength(64);
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.manifest.content_hash).toBe(result.contentHash);
  });

  it("PACK-05 zip 文件名格式 <course-name>-<backup-date>.zip", () => {
    const targetPath = path.join(ISOLATION_DIR, "backups", "05");
    const result = packCourse(ctx, courseId, targetPath, "manual");

    expect(result.zipFilename).toMatch(/^高等数学-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(existsSync(result.zipPath)).toBe(true);
  });

  it("PACK-06 zip 文件大小 > 0", () => {
    const targetPath = path.join(ISOLATION_DIR, "backups", "06");
    const result = packCourse(ctx, courseId, targetPath, "manual");
    expect(result.fileSizeBytes).toBeGreaterThan(0);
    expect(existsSync(result.zipPath)).toBe(true);
  });
  it("PACK-07 rejects storage_key escaping the data root", () => {
    const semDbPath = path.join(ISOLATION_DIR, "semester", semesterId, "sem.db");
    const semDb = new DatabaseSync(semDbPath);
    semDb.prepare("UPDATE materials SET storage_key = @storageKey WHERE course_instance_id = @courseId").run({
      storageKey: "semester/../..\u002foutside-secret.txt",
      courseId,
    });
    semDb.close();

    expect(() => packCourse(ctx, courseId, path.join(ISOLATION_DIR, "backups", "07"), "manual"))
      .toThrow("备份文件包含不安全的路径");
  });
});
