/**
 * E2E-09 定期调度备份（08-Test §6.4）
 *
 * 流程：配置 cron(每分钟,测试用) → 校验 cron_expression → 查询调度 → 启用/禁用
 *
 * 断言（08-Test §7.6 备份恢复："定期调度默认每周一/可配置每月一 | cron_expression 校验"）：
 *   - backup.configureSchedule 写入 backup_schedules（enabled=true + cron_expression 落库）
 *   - 非法 cron_expression → BAD_REQUEST（cron_expression 校验 §7.6）
 *   - backup.listSchedules 返回已配置调度
 *   - backup.toggleSchedule 启用/禁用往返（enabled true→false→true）
 *   - 课程级调度（courseInstanceId 维度）可配置
 *
 * 说明：T-M2-005 落地的是 backup_schedules 配置表 + 7 handler（无运行态 cron 守护进程）。
 *   E2E-09 验证"定期调度"的配置能力全链（配置→校验→查询→启停），真实时间触发的守护进程
 *   不在 T-M2-005 范围，进 .record 偏差记录。
 *
 * 数据隔离（AGENTS.md §5.3）：写 H:\pi-studybuddy-tmp\runs\T-M2-009\e2e\e2e-09\
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { launchElectron, type LaunchedApp } from "./helpers/electron-launcher";
import { RpcDriver } from "./helpers/rpc-driver";
import { SEMESTER_FIXTURE, isRpcError } from "./helpers/fixtures";
import type { Semester, CourseInstance, BackupSchedule } from "../../src/contract/types";

describe("E2E-09 定期调度备份", () => {
  let app: LaunchedApp;
  let rpc: RpcDriver;
  let semesterId: string;
  let courseId: string;
  let scheduleId: string;

  beforeAll(async () => {
    app = await launchElectron("e2e-09");
    rpc = new RpcDriver(app.channel);
    await rpc.init();

    const sem = await rpc.call<Semester>("semesters.create", SEMESTER_FIXTURE);
    semesterId = sem.id;
    const course = await rpc.call<CourseInstance>("courses.create", {
      semesterId,
      courseName: "E2E-09 调度课程",
      subject: "英语",
    });
    courseId = course.id;
  }, 60_000);

  afterAll(async () => {
    await app?.dispose();
  });

  it("E09-01 配置调度（backup.configureSchedule）— 每分钟 cron 落库 §7.6", async () => {
    const schedule = await rpc.call<BackupSchedule>("backup.configureSchedule", {
      semesterId,
      cronExpression: "* * * * *", // 每分钟，测试用
      timezone: "Asia/Shanghai",
    });
    expect(schedule.id).toBeTruthy();
    expect(schedule.semesterId).toBe(semesterId);
    expect(schedule.cronExpression).toBe("* * * * *");
    expect(schedule.timezone).toBe("Asia/Shanghai");
    expect(schedule.enabled).toBe(true);
    scheduleId = schedule.id;
  });

  it("E09-02 非法 cron_expression → BAD_REQUEST（cron_expression 校验 §7.6）", async () => {
    try {
      await rpc.call("backup.configureSchedule", {
        semesterId,
        cronExpression: "not-a-cron",
        timezone: "Asia/Shanghai",
      });
      throw new Error("非法 cron 应拒绝但未拒绝");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as { code: string }).code).toBe("BAD_REQUEST");
    }
  });

  it("E09-03 查询调度（backup.listSchedules）返回已配置项", async () => {
    const schedules = await rpc.call<BackupSchedule[]>("backup.listSchedules", { semesterId });
    expect(schedules.some((s) => s.id === scheduleId)).toBe(true);
    const found = schedules.find((s) => s.id === scheduleId);
    expect(found?.enabled).toBe(true);
    expect(found?.cronExpression).toBe("* * * * *");
  });

  it("E09-04 禁用调度（backup.toggleSchedule disable）→ enabled=false", async () => {
    const schedule = await rpc.call<BackupSchedule>("backup.toggleSchedule", {
      id: scheduleId,
      enabled: false,
    });
    expect(schedule.enabled).toBe(false);
  });

  it("E09-05 重新启用调度（backup.toggleSchedule enable）→ enabled=true", async () => {
    const schedule = await rpc.call<BackupSchedule>("backup.toggleSchedule", {
      id: scheduleId,
      enabled: true,
    });
    expect(schedule.enabled).toBe(true);
  });

  it("E09-06 课程级调度可配置（courseInstanceId 维度）", async () => {
    const schedule = await rpc.call<BackupSchedule>("backup.configureSchedule", {
      semesterId,
      courseInstanceId: courseId,
      cronExpression: "0 3 * * 1", // 默认每周一 03:00
      timezone: "Asia/Shanghai",
    });
    expect(schedule.id).toBeTruthy();
    expect(schedule.courseInstanceId).toBe(courseId);
    expect(schedule.cronExpression).toBe("0 3 * * 1");
  });
});