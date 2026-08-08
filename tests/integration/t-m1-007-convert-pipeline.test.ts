import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { createGlobalDb } from "../../src/data/global";
import { S2Context, createS2Handlers } from "../../src/agent-host/handlers/s2";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import {
  createMockTextExtractor,
  createFailingTextExtractor,
} from "../../src/agent-host/handlers/s2/text-extractor";
import { createMockWpsAdapter } from "../../src/agent-host/handlers/s2/wps-adapter";
import { createMockOcrAdapter, createFailingOcrAdapter } from "../../src/agent-host/handlers/s1/ocr-adapter";
import type { Material, Job } from "../../src/contract/types";

/**
 * T-M1-007 S2 资料转换管道集成测试（07-WF §2.3 + 05-ERD §3.2.2 + 08-Test §3.3.2）
 *
 * 注入 TextExtractor / OcrAdapter / WpsAdapter（mock/failing）验证 materials.convert 编排：
 *   - convert_pdf/convert_docx/convert_pptx/convert_xlsx/ocr_image 注入 extractor/ocr → 真实提取 + 写 normalized_texts + Material→converted + Job→completed
 *   - wps_convert 注入 wps + textExtractor → 格式转换 + 中间格式文本提取 + 写 normalized_texts
 *   - 提取失败 → Material→conversion_failed + Job→failed（error_message 固定文案，不泄漏路径）
 *   - 未注入 adapter → 仅登记 Job（pending），不执行（保持既有"Job 登记入口"语义）
 *
 * 数据隔离（AGENTS.md §5.3 + 08-Test §5.4）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-007\，不连真实库。
 * 每个 describe 用独立子目录，避免跨用例磁盘句柄 EBUSY。
 */
const ISOLATION_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M1-007\\integration";

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
    label: "S2 转换管道测试学期",
    startDate: "2026-09-01",
    endDate: "2027-01-31",
    timezone: "Asia/Shanghai",
  }) as { id: string };
  const course = (s1Handlers["courses.create"] as (p: unknown) => unknown)({
    semesterId: sem.id,
    courseName: "转换管道测试课程",
    subject: "数学",
  }) as { id: string };

  const storageDir = join(dir, "semester", sem.id, "storage");
  mkdirSync(storageDir, { recursive: true });
  return { ctx: null as unknown as S2Context, handlers: null as unknown as ReturnType<typeof createS2Handlers>, s1Ctx, semesterId: sem.id, courseId: course.id, storageDir };
}

/** 上传文件（真实落盘到 storage 目录模拟上传），返回 Material */
function upload(f: Fixture, fileName: string, mime: string): Material {
  writeFileSync(join(f.storageDir, fileName), "fake file content");
  return (f.handlers["materials.upload"] as (p: unknown) => unknown)({
    courseId: f.courseId,
    file: { name: fileName, size: 100, mime },
  }) as Material;
}

function convert(f: Fixture, id: string): Promise<Job> {
  return (f.handlers["materials.convert"] as (p: unknown) => Promise<Job>)({ id });
}

/** 查 normalized_texts 行 */
function normRow(f: Fixture, materialId: string): Record<string, unknown> | undefined {
  const db = f.ctx.semesterDb(f.semesterId);
  return db.prepare("SELECT * FROM normalized_texts WHERE material_id = @id").get({ id: materialId }) as
    | Record<string, unknown>
    | undefined;
}

describe("T-M1-007 S2 资料转换管道集成测试", () => {
  describe("注入 mock TextExtractor — convert_* 成功写 normalized_texts", () => {
    let f: Fixture;

    beforeAll(() => {
      f = setupFixture("text-mock");
      f.ctx = new S2Context(join(ISOLATION_ROOT, "text-mock"), undefined, createMockTextExtractor());
      f.handlers = createS2Handlers(f.ctx);
    });

    afterAll(() => {
      f.ctx.dispose();
      f.s1Ctx.dispose();
    });

    it("CONV-01 convert(pdf) → job_type=convert_pdf + mock 成功 → Material→converted + normalized_texts 写入", async () => {
      const m = upload(f, "notes.pdf", "application/pdf");
      const job = await convert(f, m.id);
      expect(job.jobType).toBe("convert_pdf");
      expect(job.status).toBe("completed");
      expect(job.completedAt).toBeDefined();

      const after = f.handlers["materials.get"]({ id: m.id }) as Material;
      expect(after.status).toBe("converted");
      expect(after.convertedAt).toBeDefined();

      const norm = normRow(f, m.id);
      expect(norm).toBeDefined();
      const expectedText = "这是 pdf 文档的 mock 文本提取结果。";
      expect(norm!.content).toBe(expectedText);
      expect(norm!.content_hash).toBe(createHash("sha256").update(expectedText).digest("hex"));
      expect(norm!.char_count).toBe(expectedText.length);
      expect(norm!.source_type).toBe("upload");
    });

    it("CONV-02 convert(docx) + convert(pptx) + convert(xlsx) → converted + normalized_texts 写入", async () => {
      const types: Array<[string, string, string]> = [
        ["word.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "convert_docx"],
        ["deck.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "convert_pptx"],
        ["sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "convert_xlsx"],
      ];
      for (const [name, mime, jobType] of types) {
        const m = upload(f, name, mime);
        const job = await convert(f, m.id);
        expect(job.jobType).toBe(jobType);
        expect(job.status).toBe("completed");
        const norm = normRow(f, m.id);
        expect(norm).toBeDefined();
        expect(norm!.content_hash).toBe(createHash("sha256").update(norm!.content as string).digest("hex"));
      }
    });

    it("CONV-03 状态机：已 converted 的资料重复 convert 被拒绝（仅 pending/conversion_failed 可转换）", async () => {
      const m = upload(f, "idem.pdf", "application/pdf");
      await convert(f, m.id);
      // 第二次 convert 应被状态机拒绝，而非重复写 normalized_texts
      await expect(convert(f, m.id)).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("不允许转换"),
      });
      const db = f.ctx.semesterDb(f.semesterId);
      const rows = db.prepare("SELECT * FROM normalized_texts WHERE material_id = @id").all({ id: m.id });
      expect(rows.length).toBe(1);
    });
  });

  describe("注入 mock OcrAdapter — ocr_image 成功写 normalized_texts", () => {
    let f: Fixture;

    beforeAll(() => {
      f = setupFixture("ocr-mock");
      f.ctx = new S2Context(join(ISOLATION_ROOT, "ocr-mock"), undefined, undefined, createMockOcrAdapter());
      f.handlers = createS2Handlers(f.ctx);
    });

    afterAll(() => {
      f.ctx.dispose();
      f.s1Ctx.dispose();
    });

    it("CONV-04 convert(image) → job_type=ocr_image + mock OCR → converted + normalized_texts 写入", async () => {
      const m = upload(f, "schedule.png", "image/png");
      const job = await convert(f, m.id);
      expect(job.jobType).toBe("ocr_image");
      expect(job.status).toBe("completed");

      const after = f.handlers["materials.get"]({ id: m.id }) as Material;
      expect(after.status).toBe("converted");

      const norm = normRow(f, m.id);
      expect(norm).toBeDefined();
      expect(norm!.content).toContain("课程表");
    });
  });

  describe("注入 mock WpsAdapter + mock TextExtractor — wps_convert 中间格式补提取", () => {
    let f: Fixture;

    beforeAll(() => {
      f = setupFixture("wps-text");
      f.ctx = new S2Context(
        join(ISOLATION_ROOT, "wps-text"),
        createMockWpsAdapter(),
        createMockTextExtractor(),
      );
      f.handlers = createS2Handlers(f.ctx);
    });

    afterAll(() => {
      f.ctx.dispose();
      f.s1Ctx.dispose();
    });

    it("CONV-05 convert(doc) → wps 格式转换 + 中间格式文本提取 + normalized_texts 写入", async () => {
      const m = upload(f, "legacy.doc", "application/msword");
      const job = await convert(f, m.id);
      expect(job.jobType).toBe("wps_convert");
      expect(job.status).toBe("completed");

      const after = f.handlers["materials.get"]({ id: m.id }) as Material;
      expect(after.status).toBe("converted");

      // T-M1-007 补齐：wps_convert 成功后写 normalized_texts（中间格式 docx 提取）
      const norm = normRow(f, m.id);
      expect(norm).toBeDefined();
      expect(norm!.extraction_meta_json).toContain("wps_convert");
    });
  });

  describe("注入 failing extractor/ocr — 失败路径", () => {
    let f: Fixture;

    beforeAll(() => {
      f = setupFixture("text-fail");
      f.ctx = new S2Context(join(ISOLATION_ROOT, "text-fail"), undefined, createFailingTextExtractor());
      f.handlers = createS2Handlers(f.ctx);
    });

    afterAll(() => {
      f.ctx.dispose();
      f.s1Ctx.dispose();
    });

    it("CONV-06 convert(pdf) → extractor 抛错 → Material→conversion_failed + Job→failed（固定文案不泄漏路径）", async () => {
      const m = upload(f, "broken.pdf", "application/pdf");
      const job = await convert(f, m.id);
      expect(job.jobType).toBe("convert_pdf");
      expect(job.status).toBe("failed");
      expect(job.errorCode).toBe("INTERNAL_ERROR");
      expect(job.errorMessage).toContain("提取失败");
      // 失败路径 error_message 不泄漏路径/stdout/stderr
      expect(job.errorMessage).not.toContain(ISOLATION_ROOT);
      expect(job.errorMessage).not.toContain("stdout");
      expect(job.errorMessage).not.toContain("stderr");

      const after = f.handlers["materials.get"]({ id: m.id }) as Material;
      expect(after.status).toBe("conversion_failed");
      const norm = normRow(f, m.id);
      expect(norm).toBeUndefined();
    });
  });

  describe("注入 failing OCR — ocr_image 失败路径", () => {
    let f: Fixture;

    beforeAll(() => {
      f = setupFixture("ocr-fail");
      f.ctx = new S2Context(join(ISOLATION_ROOT, "ocr-fail"), undefined, undefined, createFailingOcrAdapter());
      f.handlers = createS2Handlers(f.ctx);
    });

    afterAll(() => {
      f.ctx.dispose();
      f.s1Ctx.dispose();
    });

    it("CONV-07 convert(image) → OCR 抛错 → conversion_failed + Job→failed（固定文案不泄漏路径）", async () => {
      const m = upload(f, "bad.png", "image/png");
      const job = await convert(f, m.id);
      expect(job.jobType).toBe("ocr_image");
      expect(job.status).toBe("failed");
      expect(job.errorCode).toBe("INTERNAL_ERROR");
      expect(job.errorMessage).toContain("识别失败");
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

    it("CONV-08 convert(pdf) 未注入 extractor → Job(pending) + Material→converting（不执行转换器）", async () => {
      const m = upload(f, "noadapter.pdf", "application/pdf");
      const job = await convert(f, m.id);
      expect(job.jobType).toBe("convert_pdf");
      expect(job.status).toBe("pending");

      const after = f.handlers["materials.get"]({ id: m.id }) as Material;
      expect(after.status).toBe("converting");
      const norm = normRow(f, m.id);
      expect(norm).toBeUndefined();
    });
  });
});