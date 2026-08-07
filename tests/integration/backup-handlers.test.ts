import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createGlobalDb } from "../../src/data/global";
import { createSemesterDb } from "../../src/data/semester";
import { DatabaseSync } from "../../src/data/sqlite";
import { BackupContext, createBackupHandlers, type BackupProgressEvent } from "../../src/agent-host/handlers/backup";

/**
 * T-M2-005 backup handler 集成测试（06-API §3.11 + 07-WF §5 + 05-ERD §8.1-§8.3）
 *
 * 验证全链路：
 *   - backup.course → backup.list → backup.restore 往返
 *   - Streams["backup.progress"] 推送进度
 *   - backup_records 状态机 in_progress → completed
 *   - backup_schedules CRUD 全链路
 *   - 跨库读写（global.db backup_records + semester.db 数据导出）
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M2-005\integration。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-005\\integration";

describe("T-M2-005 backup handler 集成测试", () => {
  let ctx: BackupContext;
  let handlers: ReturnType<typeof createBackupHandlers>;
  let semesterId: string;
  let courseId: string;
  let zipPath: string;
  const progressEvents: BackupProgressEvent[] = [];

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
         VALUES (@id, '测试学生', '集成测试学期', '2026-09-01', '2027-01-31', 'Asia/Shanghai', 'active', @dbPath, 1, @now, @now)`,
      )
      .run({ id: semesterId, dbPath: `semester/${semesterId}/sem.db`, now });

    createSemesterDb(ISOLATION_DIR, semesterId);

    courseId = randomUUID();
    const semDb = new DatabaseSync(path.join(ISOLATION_DIR, "semester", semesterId, "sem.db"));
    semDb
      .prepare(
        `INSERT INTO course_instances (id, semester_id, course_name, subject, status, created_at, updated_at)
         VALUES (@id, @semId, '集成测试课程', '数学', 'active', @now, @now)`,
      )
      .run({ id: courseId, semId: semesterId, now });

    const materialId = randomUUID();
    const storageKey = `material-${materialId}.pdf`;
    semDb
      .prepare(
        `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at)
         VALUES (@id, @courseId, 'integration.pdf', 'pdf', 256, 'application/pdf', @storageKey, 'upload', 'completed', 1, @now, @now, @now)`,
      )
      .run({ id: materialId, courseId, storageKey, now });

    const storageDir = path.join(ISOLATION_DIR, "storage");
    mkdirSync(storageDir, { recursive: true });
    writeFileSync(path.join(storageDir, storageKey), Buffer.from("integration test content"));

    semDb.close();
    globalDb.close();

    // 注入 emit 回调捕获 Streams 事件
    ctx = new BackupContext(ISOLATION_DIR, {
      emit: (event) => progressEvents.push(event),
    });
    handlers = createBackupHandlers(ctx);
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

  function call<M extends keyof typeof handlers>(method: M, params: unknown): unknown {
    return (handlers[method] as (p: unknown) => unknown)(params);
  }

  it("INT-01 backup.course → backup.list → backup.restore 全链路往返", async () => {
    // 1. 备份
    const targetPath = path.join(ISOLATION_DIR, "integration-backups");
    const record = (await call("backup.course", {
      courseInstanceId: courseId,
      targetPath,
    })) as import("../../src/contract/types").BackupRecord;

    expect(record.status).toBe("completed");
    expect(record.contentHash).toHaveLength(64);
    zipPath = path.join(targetPath, record.zipFilename);

    // 2. 查询
    const list = (await call("backup.list", { semesterId })) as import("../../src/contract/types").BackupRecord[];
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(record.id);

    // 3. 恢复到新学期
    const targetSemId = randomUUID();
    const globalDb = new DatabaseSync(path.join(ISOLATION_DIR, "global.db"));
    const now = new Date().toISOString();
    globalDb
      .prepare(
        `INSERT INTO semesters (id, student_name, semester_label, start_date, end_date, timezone, status, db_relative_path, ready, created_at, updated_at)
         VALUES (@id, '测试学生', '恢复目标学期', '2027-02-01', '2027-06-30', 'Asia/Shanghai', 'active', @dbPath, 1, @now, @now)`,
      )
      .run({ id: targetSemId, dbPath: `semester/${targetSemId}/sem.db`, now });
    globalDb.close();
    createSemesterDb(ISOLATION_DIR, targetSemId);

    const restoreResult = (await call("backup.restore", {
      zipPath,
      targetSemesterId: targetSemId,
      conflictResolution: "none",
    })) as import("../../src/contract/types").RestoreResult;

    expect(restoreResult.success).toBe(true);
    expect(restoreResult.integrityCheck).toBe("ok");
    expect(restoreResult.tablesImported).toContain("course_instances");
    expect(restoreResult.tablesImported).toContain("materials");
    expect(restoreResult.filesRestored).toBe(1);
  });

  it("INT-02 Streams['backup.progress'] 推送进度事件", () => {
    // INT-01 已触发备份，progressEvents 应有事件
    expect(progressEvents.length).toBeGreaterThan(0);
    const hasCompleted = progressEvents.some((e) => e.phase === "completed");
    expect(hasCompleted).toBe(true);
  });

  it("INT-03 backup_records 状态机 in_progress → completed", async () => {
    // 查询 global.db 中 backup_records 的状态
    const rows = ctx.globalDb
      .prepare("SELECT status FROM backup_records WHERE course_instance_id = @id")
      .all({ id: courseId }) as Array<{ status: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.status === "completed")).toBe(true);
  });

  it("INT-04 backup_schedules CRUD 全链路", async () => {
    // Create
    const schedule = (await call("backup.configureSchedule", {
      semesterId,
      cronExpression: "0 0 1 * *",
      timezone: "Asia/Shanghai",
    })) as import("../../src/contract/types").BackupSchedule;
    expect(schedule.enabled).toBe(true);

    // List
    const list = (await call("backup.listSchedules", { semesterId })) as import("../../src/contract/types").BackupSchedule[];
    expect(list.length).toBe(1);

    // Toggle (disable)
    const disabled = (await call("backup.toggleSchedule", {
      id: schedule.id,
      enabled: false,
    })) as import("../../src/contract/types").BackupSchedule;
    expect(disabled.enabled).toBe(false);

    // Toggle (enable)
    const enabled = (await call("backup.toggleSchedule", {
      id: schedule.id,
      enabled: true,
    })) as import("../../src/contract/types").BackupSchedule;
    expect(enabled.enabled).toBe(true);
  });

  it("INT-05 跨库读写（global.db backup_records + semester.db 数据导出）", async () => {
    // 验证 backup_records 在 global.db
    const globalRows = ctx.globalDb
      .prepare("SELECT * FROM backup_records WHERE semester_id = @id")
      .all({ id: semesterId }) as Array<Record<string, unknown>>;
    expect(globalRows.length).toBeGreaterThan(0);

    // 验证 semester.db 有 course_instances 数据（导出源）
    const semDb = ctx.semesterDb(semesterId);
    const semRows = semDb
      .prepare("SELECT * FROM course_instances WHERE id = @id")
      .all({ id: courseId }) as Array<Record<string, unknown>>;
    expect(semRows.length).toBe(1);
  });
});
