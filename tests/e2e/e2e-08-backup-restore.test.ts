/**
 * E2E-08 备份与恢复全链（08-Test §6.4）
 *
 * 流程：建课程+资料+练习 → 单课程备份到 tmp 目录 → zip 存在 → content_hash 校验
 *   → 损坏 zip → BAD_REQUEST → 从 zip 恢复 → 课程数据回来 → integrity_check 通过
 *
 * 断言（08-Test §7.6 备份恢复 + §7.1 闭环完整性）：
 *   - backup.course 返回 zipFilename + content_hash + status=completed（每课程独立 zip §7.6）
 *   - zip 文件真实存在于 targetPath（备份到本地其他目录 §7.6）
 *   - 损坏 zip → restore → BAD_REQUEST（content_hash 校验 §7.6）
 *   - backup.restore → success + integrity_check=ok + tablesImported 含关键表（SQLite 崩溃后可恢复 §7.6）
 *   - 恢复后课程/资料/练习数据回来（数据贯通 §7.1）
 *
 * 数据隔离（AGENTS.md §5.3）：写 H:\pi-studybuddy-tmp\runs\T-M4-022\e2e\e2e-08\
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { launchElectron, type LaunchedApp } from "./helpers/electron-launcher";
import { RpcDriver } from "./helpers/rpc-driver";
import { SEMESTER_FIXTURE, PRACTICE_FIXTURE, isRpcError } from "./helpers/fixtures";
import type {
  Semester,
  CourseInstance,
  Material,
  PracticeSession,
  BackupRecord,
  RestoreResult,
} from "../../src/contract/types";

describe("E2E-08 备份与恢复全链", () => {
  let app: LaunchedApp;
  let rpc: RpcDriver;
  let semesterId: string;
  let courseId: string;
  let materialId: string;
  let targetPath: string;
  let backupRecord: BackupRecord;
  let resultSemesterId: string;
  let restoredCourseId: string;

  beforeAll(async () => {
    app = await launchElectron("e2e-08");
    rpc = new RpcDriver(app.channel);
    await rpc.init();

    // 前置：创建学期 + 课程 + 资料 + 练习
    const sem = await rpc.call<Semester>("semesters.create", SEMESTER_FIXTURE);
    semesterId = sem.id;
    const course = await rpc.call<CourseInstance>("courses.create", {
      semesterId,
      courseName: "E2E-08 备份课程",
      subject: "数学",
    });
    courseId = course.id;

    const material = await rpc.call<Material>("materials.upload", {
      courseId,
      file: { name: "backup-chapter.pdf", size: 1024, mime: "application/pdf" },
    });
    materialId = material.id;

    await rpc.call<PracticeSession>("practice.createSession", {
      courseId,
      moduleIds: PRACTICE_FIXTURE.moduleIds,
      questionCount: PRACTICE_FIXTURE.questionCount,
    });

    // 备份目标目录（本地其他目录，§7.6）
    targetPath = path.join(app.dataRoot, "backups");
  }, 60_000);

  afterAll(async () => {
    await app?.dispose();
  });

  it("E08-01 单课程备份（backup.course）— zip 存在 + content_hash §7.6", async () => {
    const record = await rpc.call<BackupRecord>("backup.course", {
      courseInstanceId: courseId,
      targetPath,
    });
    expect(record.id).toBeTruthy();
    expect(record.courseInstanceId).toBe(courseId);
    expect(record.backupType).toBe("manual");
    expect(record.status).toBe("completed");
    expect(record.contentHash).toBeTruthy();
    expect(record.fileSizeBytes).toBeGreaterThan(0);
    expect(record.zipFilename.length).toBeGreaterThan(0);
    backupRecord = record;

    // zip 真实存在于本地其他目录（备份到本地其他目录 §7.6）
    const zipPath = path.join(targetPath, record.zipFilename);
    expect(fs.existsSync(zipPath)).toBe(true);
    expect(fs.statSync(zipPath).isFile()).toBe(true);
    expect(fs.statSync(zipPath).size).toBe(record.fileSizeBytes);
  });

  it("E08-02 备份记录可查询（backup.list）且状态 completed", async () => {
    const records = await rpc.call<BackupRecord[]>("backup.list", { courseInstanceId: courseId });
    expect(records.some((r) => r.id === backupRecord.id)).toBe(true);
    const found = records.find((r) => r.id === backupRecord.id);
    expect(found?.status).toBe("completed");
    expect(found?.contentHash).toBe(backupRecord.contentHash);
  });

  it("E08-03 损坏 zip → restore → BAD_REQUEST（content_hash 校验 §7.6）", async () => {
    // 读取合法 zip，翻转数据区一个字节模拟损坏
    const zipPath = path.join(targetPath, backupRecord.zipFilename);
    const buf = fs.readFileSync(zipPath);
    const corrupt = Buffer.from(buf);
    corrupt[Math.floor(corrupt.length / 2)] ^= 0xff;
    const corruptPath = path.join(targetPath, "corrupt.zip");
    fs.writeFileSync(corruptPath, corrupt);

    try {
      await rpc.call("backup.restore", {
        zipPath: corruptPath,
        targetSemesterId: semesterId,
        conflictResolution: "create_new",
      });
      throw new Error("损坏 zip 应拒绝恢复但未拒绝");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as { code: string }).code).toBe("BAD_REQUEST");
    }
  });

  it("E08-04 从 zip 恢复 → 新学期 → 课程数据回来 + integrity_check 通过（§7.6）", async () => {
    // 模拟"删除课程数据"：恢复到全新 semester B（课程在 B 中不存在 → 无冲突新建）
    const semB = await rpc.call<Semester>("semesters.create", {
      label: "2026春季 恢复目标 E2E",
      startDate: "2026-02-01",
      endDate: "2026-07-31",
      timezone: "Asia/Shanghai",
    });
    const zipPath = path.join(targetPath, backupRecord.zipFilename);
    const result = await rpc.call<RestoreResult>("backup.restore", {
      zipPath,
      targetSemesterId: semB.id,
      conflictResolution: "create_new",
    });
    expect(result.success).toBe(true);
    expect(result.integrityCheck).toBe("ok");
    expect(result.restoredCourseId).toBeTruthy();
    // 关键表全部导入（§7.1 数据贯通）
    expect(result.tablesImported).toContain("course_instances");
    expect(result.tablesImported).toContain("materials");
    expect(result.tablesImported).toContain("practice_sessions");
    resultSemesterId = semB.id;
    restoredCourseId = result.restoredCourseId;
  });

  it("E08-05 恢复后课程/资料/练习数据回来（§7.1 数据贯通）", async () => {
    const courses = await rpc.call<CourseInstance[]>("courses.list", { semesterId: resultSemesterId });
    const restored = courses.find((c) => c.id === restoredCourseId);
    expect(restored).toBeTruthy();
    expect(restored?.courseName).toBe("E2E-08 备份课程");

    const materials = await rpc.call<Material[]>("materials.list", { courseId: restoredCourseId });
    expect(materials.some((m) => m.id === materialId)).toBe(true);

    const sessions = await rpc.call<PracticeSession[]>("practice.listSessions", {
      courseId: restoredCourseId,
    });
    expect(sessions.length).toBeGreaterThan(0);
  });
});