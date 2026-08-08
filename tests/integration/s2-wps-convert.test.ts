import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createGlobalDb } from "../../src/data/global";
import { S2Context, createS2Handlers } from "../../src/agent-host/handlers/s2";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import {
  createMockWpsAdapter,
  createFailingWpsAdapter,
} from "../../src/agent-host/handlers/s2/wps-adapter";
import type { Material, Job } from "../../src/contract/types";

/**
 * T-M1-006 S2 wps_convert 集成测试（03-Arch §3.3 + 08-Test §3.3.1 + 07-WF §2.3）
 *
 * 注入 WpsAdapter（mock/failing）验证 materials.convert 对旧版 doc/ppt/xls 的真实转换路径：
 *   - mock 成功：Material→converted + Job→completed（写 converted_at，**不写 normalized_texts**，属 T-M1-007）
 *   - failing 失败：Material→conversion_failed + Job→failed（error_message 固定文案，不泄漏路径）
 *   - 未注入 adapter：仅登记 Job（pending），不执行转换（保持既有"Job 登记入口"语义）
 *
 * 数据隔离（AGENTS.md §5.3 + 08-Test §5.4）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-006\，不连真实 WPS。
 * 每个 describe 用独立子目录，避免跨用例磁盘句柄 EBUSY。
 */
const ISOLATION_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M1-006\\integration";

interface Fixture {
  ctx: S2Context;
  handlers: ReturnType<typeof createS2Handlers>;
  s1Ctx: S1Context;
  semesterId: string;
  courseId: string;
  storageDir: string;
}

/** 在指定子目录建立全新学期/课程夹具，返回上下文（test 结束前由 afterAll 释放） */
function setupFixture(name: string): Fixture {
  const dir = join(ISOLATION_ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  createGlobalDb(dir);

  const s1Ctx = new S1Context(dir);
  const s1Handlers = createS1Handlers(s1Ctx);
  const sem = (s1Handlers["semesters.create"] as (p: unknown) => unknown)({
    label: "S2 WPS 测试学期",
    startDate: "2026-09-01",
    endDate: "2027-01-31",
    timezone: "Asia/Shanghai",
  }) as { id: string };
  const course = (s1Handlers["courses.create"] as (p: unknown) => unknown)({
    semesterId: sem.id,
    courseName: "WPS 转换测试课程",
    subject: "数学",
  }) as { id: string };

  const storageDir = join(dir, "semester", sem.id, "storage");
  mkdirSync(storageDir, { recursive: true });
  return { ctx: null as unknown as S2Context, handlers: null as unknown as ReturnType<typeof createS2Handlers>, s1Ctx, semesterId: sem.id, courseId: course.id, storageDir };
}

/** 上传旧版文件，返回 Material（真实落盘到 storage 目录模拟上传） */
function uploadLegacy(f: Fixture, fileName: string, mime: string): Material {
  writeFileSync(join(f.storageDir, fileName), "fake legacy content");
  return (f.handlers["materials.upload"] as (p: unknown) => unknown)({
    courseId: f.courseId,
    file: { name: fileName, size: 100, mime },
  }) as Material;
}

function convert(f: Fixture, id: string): Promise<Job> {
  return (f.handlers["materials.convert"] as (p: unknown) => Promise<Job>)({ id });
}

describe("T-M1-006 S2 wps_convert 集成测试", () => {
  describe("注入 mock adapter — 成功路径", () => {
    let f: Fixture;

    beforeAll(() => {
      f = setupFixture("mock");
      f.ctx = new S2Context(join(ISOLATION_ROOT, "mock"), createMockWpsAdapter());
      f.handlers = createS2Handlers(f.ctx);
    });

    afterAll(() => {
      f.ctx.dispose();
      f.s1Ctx.dispose();
    });

    it("WPS-01 convert(doc) → job_type=wps_convert + mock 成功 → Material→converted + Job→completed", async () => {
      const m = uploadLegacy(f, "legacy.doc", "application/msword");
      expect(m.fileType).toBe("doc");

      const job = await convert(f, m.id);
      expect(job.materialId).toBe(m.id);
      expect(job.jobType).toBe("wps_convert");
      expect(job.status).toBe("completed");
      expect(job.completedAt).toBeDefined();

      const after = f.handlers["materials.get"]({ id: m.id }) as Material;
      expect(after.status).toBe("converted");
      expect(after.convertedAt).toBeDefined();

      // 边界：本桥只做格式转换，不写 normalized_texts（文本提取属 T-M1-007）
      const db = f.ctx.semesterDb(f.semesterId);
      const norm = db.prepare("SELECT * FROM normalized_texts WHERE material_id = @id").get({ id: m.id });
      expect(norm).toBeUndefined();
    });

    it("WPS-02 convert(ppt) → job_type=wps_convert + mock 成功 → converted", async () => {
      const m = uploadLegacy(f, "deck.ppt", "application/vnd.ms-powerpoint");
      const job = await convert(f, m.id);
      expect(job.jobType).toBe("wps_convert");
      expect(job.status).toBe("completed");
    });
  });

  describe("注入 failing adapter — 失败路径", () => {
    let f: Fixture;

    beforeAll(() => {
      f = setupFixture("failing");
      f.ctx = new S2Context(join(ISOLATION_ROOT, "failing"), createFailingWpsAdapter());
      f.handlers = createS2Handlers(f.ctx);
    });

    afterAll(() => {
      f.ctx.dispose();
      f.s1Ctx.dispose();
    });

    it("WPS-03 convert(xls) → adapter 抛错 → Material→conversion_failed + Job→failed（固定文案不泄漏路径）", async () => {
      const m = uploadLegacy(f, "sheet.xls", "application/vnd.ms-excel");
      const job = await convert(f, m.id);
      expect(job.jobType).toBe("wps_convert");
      expect(job.status).toBe("failed");
      expect(job.errorCode).toBe("INTERNAL_ERROR");
      expect(job.errorMessage).toContain("转换失败");
      // 失败路径 Job 的 error_message 不泄漏路径/stdout/stderr
      expect(job.errorMessage).not.toContain(ISOLATION_ROOT);
      expect(job.errorMessage).not.toContain("stdout");
      expect(job.errorMessage).not.toContain("stderr");

      const after = f.handlers["materials.get"]({ id: m.id }) as Material;
      expect(after.status).toBe("conversion_failed");
    });
  });

  describe("未注入 adapter — 仅登记 Job（保持既有语义）", () => {
    let f: Fixture;

    beforeAll(() => {
      f = setupFixture("noadapter");
      f.ctx = new S2Context(join(ISOLATION_ROOT, "noadapter"));
      f.handlers = createS2Handlers(f.ctx);
    });

    afterAll(() => {
      f.ctx.dispose();
      f.s1Ctx.dispose();
    });

    it("WPS-04 convert(doc) 未注入 adapter → Job(pending) + Material→converting（不执行转换器）", async () => {
      const m = uploadLegacy(f, "noadapter.doc", "application/msword");
      const job = await convert(f, m.id);
      expect(job.jobType).toBe("wps_convert");
      // 未注入 adapter：仅登记 Job，保持 pending + Material→converting（03-Arch §3.3 延后执行）
      expect(job.status).toBe("pending");

      const after = f.handlers["materials.get"]({ id: m.id }) as Material;
      expect(after.status).toBe("converting");
    });
  });
});