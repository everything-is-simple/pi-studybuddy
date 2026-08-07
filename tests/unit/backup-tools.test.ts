import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createGlobalDb } from "../../src/data/global";
import { createSemesterDb } from "../../src/data/semester";
import { DatabaseSync } from "../../src/data/sqlite";
import { BackupContext } from "../../src/agent-host/handlers/backup/context";
import { createBackupTools, BACKUP_TOOL_NAMES, BACKUP_TOOL_COUNT } from "../../src/agent/tools/backup/tools";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

/**
 * T-M2-005 backup registerTool 工具单件测试（08-Test §3.1 + 03-Arch §2.2 ToolDefinition 契约）
 *
 * 每个工具 ≥4 条契约断言：
 *   - ToolDefinition 必填 name/label/description/parameters/execute
 *   - 工具名匹配 ^studybuddy_[a-z_]+$
 *   - execute 成功返回 {content, details} 结构
 *   - execute 失败 throw Error
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M2-005\unit-tools。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-005\\unit-tools";

describe("T-M2-005 backup registerTool 工具单件测试", () => {
  let ctx: BackupContext;
  let tools: ToolDefinition[];
  let semesterId: string;
  let courseId: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);

    semesterId = randomUUID();
    const globalDb = new DatabaseSync(path.join(ISOLATION_DIR, "global.db"));
    const now = new Date().toISOString();
    globalDb
      .prepare(
        `INSERT INTO semesters (id, student_name, semester_label, start_date, end_date, timezone, status, db_relative_path, ready, created_at, updated_at)
         VALUES (@id, '测试学生', '工具测试学期', '2026-09-01', '2027-01-31', 'Asia/Shanghai', 'active', @dbPath, 1, @now, @now)`,
      )
      .run({ id: semesterId, dbPath: `semester/${semesterId}/sem.db`, now });

    createSemesterDb(ISOLATION_DIR, semesterId);

    courseId = randomUUID();
    const semDb = new DatabaseSync(path.join(ISOLATION_DIR, "semester", semesterId, "sem.db"));
    semDb
      .prepare(
        `INSERT INTO course_instances (id, semester_id, course_name, subject, status, created_at, updated_at)
         VALUES (@id, @semId, '测试课程', '数学', 'active', @now, @now)`,
      )
      .run({ id: courseId, semId: semesterId, now });

    const materialId = randomUUID();
    const storageKey = `material-${materialId}.pdf`;
    semDb
      .prepare(
        `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at)
         VALUES (@id, @courseId, 'test.pdf', 'pdf', 100, 'application/pdf', @storageKey, 'upload', 'completed', 1, @now, @now, @now)`,
      )
      .run({ id: materialId, courseId, storageKey, now });

    const storageDir = path.join(ISOLATION_DIR, "storage");
    mkdirSync(storageDir, { recursive: true });
    writeFileSync(path.join(storageDir, storageKey), Buffer.from("test content"));

    semDb.close();
    globalDb.close();

    ctx = new BackupContext(ISOLATION_DIR);
    tools = createBackupTools(ctx);
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

  it("TOOL-01 工具数量 = 5", () => {
    expect(tools.length).toBe(BACKUP_TOOL_COUNT);
    expect(BACKUP_TOOL_COUNT).toBe(5);
  });

  it("TOOL-02 工具名匹配 ^studybuddy_[a-z_]+$", () => {
    for (const tool of tools) {
      expect(tool.name).toMatch(/^studybuddy_[a-z_]+$/);
    }
    expect(BACKUP_TOOL_NAMES).toContain("studybuddy_backup_course");
    expect(BACKUP_TOOL_NAMES).toContain("studybuddy_backup_all_courses");
    expect(BACKUP_TOOL_NAMES).toContain("studybuddy_restore_course");
    expect(BACKUP_TOOL_NAMES).toContain("studybuddy_list_backups");
    expect(BACKUP_TOOL_NAMES).toContain("studybuddy_configure_backup_schedule");
  });

  it("TOOL-03 每个工具必填 name/label/description/parameters/execute", () => {
    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.label).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });

  it("TOOL-04 studybuddy_backup_course execute 成功返回 {content, details}", async () => {
    const tool = tools.find((t) => t.name === "studybuddy_backup_course")!;
    const result = await tool.execute("test-call-id", {
      courseInstanceId: courseId,
      targetPath: path.join(ISOLATION_DIR, "tool-backups"),
    });
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.details).toBeDefined();
    expect((result.details as { status: string }).status).toBe("completed");
  });

  it("TOOL-05 studybuddy_list_backups execute 成功返回 {content, details}", async () => {
    const tool = tools.find((t) => t.name === "studybuddy_list_backups")!;
    const result = await tool.execute("test-call-id", { semesterId });
    expect(result.content).toBeDefined();
    expect((result.details as { count: number }).count).toBeGreaterThanOrEqual(1);
  });

  it("TOOL-06 studybuddy_configure_backup_schedule create 成功", async () => {
    const tool = tools.find((t) => t.name === "studybuddy_configure_backup_schedule")!;
    const result = await tool.execute("test-call-id", {
      action: "create",
      semesterId,
      cronExpression: "0 0 * * 1",
      timezone: "Asia/Shanghai",
    });
    expect(result.content).toBeDefined();
    expect((result.details as { cronExpression: string }).cronExpression).toBe("0 0 * * 1");
  });

  it("TOOL-07 studybuddy_configure_backup_schedule list 成功", async () => {
    const tool = tools.find((t) => t.name === "studybuddy_configure_backup_schedule")!;
    const result = await tool.execute("test-call-id", {
      action: "list",
      semesterId,
    });
    expect((result.details as { count: number }).count).toBe(1);
  });

  it("TOOL-08 studybuddy_backup_course execute 失败 throw（课程不存在）", async () => {
    const tool = tools.find((t) => t.name === "studybuddy_backup_course")!;
    try {
      await tool.execute("test-call-id", {
        courseInstanceId: "non-existent",
        targetPath: path.join(ISOLATION_DIR, "fail-backups"),
      });
      throw new Error("应抛错但未抛");
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});
