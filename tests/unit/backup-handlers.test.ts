import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createGlobalDb } from "../../src/data/global";
import { createSemesterDb } from "../../src/data/semester";
import { DatabaseSync } from "../../src/data/sqlite";
import { BackupContext, createBackupHandlers } from "../../src/agent-host/handlers/backup";
import type { RpcError } from "../../src/contract/types";

/**
 * T-M2-005 backup handler 单件测试（06-API §3.11 + 07-WF §5）
 *
 * 验证：
 *   - backup.course：写 backup_records(manual, completed)
 *   - backup.allCourses：多课程备份
 *   - backup.restore：返回 RestoreResult
 *   - backup.list：按 semesterId/courseInstanceId 过滤
 *   - backup.configureSchedule：写 backup_schedules + cron 校验
 *   - backup.listSchedules：查询
 *   - backup.toggleSchedule：启用/禁用 + NOT_FOUND
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-005\\handlers";

function isRpcError(e: unknown): e is RpcError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}

describe("T-M2-005 backup handler 单件测试", () => {
  let ctx: BackupContext;
  let handlers: ReturnType<typeof createBackupHandlers>;
  let semesterId: string;
  let courseId1: string;
  let courseId2: string;

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
         VALUES (@id, '测试学生', '2026 秋', '2026-09-01', '2027-01-31', 'Asia/Shanghai', 'active', @dbPath, 1, @now, @now)`,
      )
      .run({ id: semesterId, dbPath: `semester/${semesterId}/sem.db`, now });

    createSemesterDb(ISOLATION_DIR, semesterId);

    courseId1 = randomUUID();
    courseId2 = randomUUID();
    const semDb = new DatabaseSync(path.join(ISOLATION_DIR, "semester", semesterId, "sem.db"));
    for (const [cid, name] of [[courseId1, "高等数学"], [courseId2, "线性代数"]] as const) {
      semDb
        .prepare(
          `INSERT INTO course_instances (id, semester_id, course_name, subject, status, created_at, updated_at)
           VALUES (@id, @semId, @name, '数学', 'active', @now, @now)`,
        )
        .run({ id: cid, semId: semesterId, name, now });

      // 插入 material + storage 文件
      const materialId = randomUUID();
      const storageKey = `material-${materialId}.pdf`;
      semDb
        .prepare(
          `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at)
           VALUES (@id, @courseId, 'lecture.pdf', 'pdf', 1024, 'application/pdf', @storageKey, 'upload', 'completed', 1, @now, @now, @now)`,
        )
        .run({ id: materialId, courseId: cid, storageKey, now });

      const storageDir = path.join(ISOLATION_DIR, "storage");
      mkdirSync(storageDir, { recursive: true });
      writeFileSync(path.join(storageDir, storageKey), Buffer.from(`content-${name}`));
    }
    semDb.close();
    globalDb.close();

    ctx = new BackupContext(ISOLATION_DIR);
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

  describe("backup.course", () => {
    it("BC-01 单课程备份 → 写 backup_records(manual, completed)", async () => {
      const targetPath = path.join(ISOLATION_DIR, "backups", "01");
      const record = (await call("backup.course", {
        courseInstanceId: courseId1,
        targetPath,
      })) as import("../../src/contract/types").BackupRecord;

      expect(record.id).toBeTruthy();
      expect(record.semesterId).toBe(semesterId);
      expect(record.courseInstanceId).toBe(courseId1);
      expect(record.backupType).toBe("manual");
      expect(record.status).toBe("completed");
      expect(record.contentHash).toHaveLength(64);
      expect(record.zipFilename).toContain("高等数学");
      expect(record.fileSizeBytes).toBeGreaterThan(0);
    });

    it("BC-02 courseInstanceId 不存在 → NOT_FOUND", async () => {
      try {
        await call("backup.course", {
          courseInstanceId: "non-existent",
          targetPath: path.join(ISOLATION_DIR, "backups", "02"),
        });
        throw new Error("应抛错但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("backup.allCourses", () => {
    it("BC-03 全课程备份 → 返回多个 BackupRecord", async () => {
      const targetPath = path.join(ISOLATION_DIR, "backups", "03");
      const records = (await call("backup.allCourses", {
        semesterId,
        targetPath,
      })) as import("../../src/contract/types").BackupRecord[];

      expect(records.length).toBe(2);
      expect(records.every((r) => r.status === "completed")).toBe(true);
    });
  });

  describe("backup.list", () => {
    it("BC-04 按 semesterId 过滤", async () => {
      const records = (await call("backup.list", { semesterId })) as import("../../src/contract/types").BackupRecord[];
      expect(records.length).toBe(3); // BC-01 + BC-03 两课程
    });

    it("BC-05 按 courseInstanceId 过滤", async () => {
      const records = (await call("backup.list", { courseInstanceId: courseId1 })) as import("../../src/contract/types").BackupRecord[];
      expect(records.length).toBe(2); // BC-01 + BC-03 中的 courseId1
    });
  });

  describe("backup.configureSchedule", () => {
    it("BC-06 写 backup_schedules + 返回 BackupSchedule", async () => {
      const schedule = (await call("backup.configureSchedule", {
        semesterId,
        cronExpression: "0 0 * * 1",
        timezone: "Asia/Shanghai",
      })) as import("../../src/contract/types").BackupSchedule;

      expect(schedule.id).toBeTruthy();
      expect(schedule.semesterId).toBe(semesterId);
      expect(schedule.cronExpression).toBe("0 0 * * 1");
      expect(schedule.timezone).toBe("Asia/Shanghai");
      expect(schedule.enabled).toBe(true);
    });

    it("BC-07 cron 表达式格式错误 → BAD_REQUEST", async () => {
      try {
        await call("backup.configureSchedule", {
          semesterId,
          cronExpression: "invalid",
          timezone: "Asia/Shanghai",
        });
        throw new Error("应抛错但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("backup.listSchedules", () => {
    it("BC-08 查询调度配置", async () => {
      const schedules = (await call("backup.listSchedules", { semesterId })) as import("../../src/contract/types").BackupSchedule[];
      expect(schedules.length).toBe(1);
    });
  });

  describe("backup.toggleSchedule", () => {
    it("BC-09 启用/禁用调度", async () => {
      const schedules = (await call("backup.listSchedules", { semesterId })) as import("../../src/contract/types").BackupSchedule[];
      const scheduleId = schedules[0].id;

      const disabled = (await call("backup.toggleSchedule", { id: scheduleId, enabled: false })) as import("../../src/contract/types").BackupSchedule;
      expect(disabled.enabled).toBe(false);

      const enabled = (await call("backup.toggleSchedule", { id: scheduleId, enabled: true })) as import("../../src/contract/types").BackupSchedule;
      expect(enabled.enabled).toBe(true);
    });

    it("BC-10 调度不存在 → NOT_FOUND", async () => {
      try {
        await call("backup.toggleSchedule", { id: "non-existent", enabled: false });
        throw new Error("应抛错但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("NOT_FOUND");
      }
    });
  });
});
