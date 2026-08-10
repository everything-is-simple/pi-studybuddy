import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { createGlobalDb } from "../../src/data/global";
import { S2Context, createS2Handlers } from "../../src/agent-host/handlers/s2";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import type {
  Material,
  StructuredNote,
  MindMap,
  KnowledgeModule,
  Job,
} from "../../src/contract/types";
import type { RpcError } from "../../src/contract/types";
import { stageTestMaterial } from "../helpers/material-import";

/**
 * T-M1-002 S2 handler 集成测试（06-API §3.4 + 07-WF §2.3 + 05-ERD §3.2）
 *
 * 在隔离目录落地真实 SQLite，验证 handler×semester.db 真实读写：
 *   - materials.upload：MIME 验证 + storage_key 路径安全（拒绝 ../:/）
 *   - Material 状态机：pending→converting→converted→completed（Job 登记入口）
 *   - Job 登记入口：convert/retry/generate/retryAi 仅写 jobs 行 + 状态迁移，不执行转换器/AI
 *   - materials.replaceText：跳过转换直写 normalized_texts
 *   - materials.delete：软删除
 *   - notes.* / modules.* / jobs.* CRUD + KnowledgeModule 学习状态机
 *   - retry 次数上限：retry_count < max_retries（默认 3）
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-002\。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-002\\integration";
const FIXTURE_DIR = `${ISOLATION_DIR}\\fixtures`;

function isRpcError(e: unknown): e is RpcError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}

describe("T-M1-002 S2 handler 集成测试", () => {
  let ctx: S2Context;
  let s1Ctx: S1Context;
  let handlers: ReturnType<typeof createS2Handlers>;
  let s1Handlers: ReturnType<typeof createS1Handlers>;
  let semesterId: string;
  let courseId: string;
  const STORAGE_DIR = `${ISOLATION_DIR}\\semester\\__s2_test_sem__\\storage`;

  function call<M extends keyof typeof handlers>(method: M, params: unknown): unknown {
    return (handlers[method] as (p: unknown) => unknown)(params);
  }

  function callS1<M extends keyof typeof s1Handlers>(method: M, params: unknown): unknown {
    return (s1Handlers[method] as (p: unknown) => unknown)(params);
  }

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    ctx = new S2Context(ISOLATION_DIR);
    handlers = createS2Handlers(ctx);
    // 复用 S1 handlers 创建学期+课程作为 S2 测试前置
    s1Ctx = new S1Context(ISOLATION_DIR);
    s1Handlers = createS1Handlers(s1Ctx);

    const sem = callS1("semesters.create", {
      label: "S2测试学期",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      timezone: "Asia/Shanghai",
    }) as { id: string };
    semesterId = sem.id;

    const course = callS1("courses.create", {
      semesterId,
      courseName: "测试课程",
      subject: "数学",
    }) as { id: string };
    courseId = course.id;

    mkdirSync(STORAGE_DIR, { recursive: true });
  });

  afterAll(() => {
    ctx?.dispose();
    s1Ctx?.dispose();
    for (let i = 0; i < 3; i++) {
      try {
        rmSync(ISOLATION_DIR, { recursive: true, force: true });
        break;
      } catch {
        // 忽略 EBUSY
      }
    }
  });

  describe("materials.* — 资料管理 + 状态机 + 路径安全", () => {
    let materialId: string;

    it("MAT-01 upload：写 materials(status=pending) + material_uploaded 事件", () => {
      const file = stageTestMaterial(ISOLATION_DIR, FIXTURE_DIR, "test.pdf", "application/pdf", "fake pdf content");
      const result = call("materials.upload", { courseId, file }) as Material;
      materialId = result.id;
      expect(result.courseId).toBe(courseId);
      expect(result.fileType).toBe("pdf");
      expect(result.mimeType).toBe("application/pdf");
      expect(result.status).toBe("pending");
      expect(result.sourceType).toBe("upload");
      expect(result.permissionConfirmed).toBe(0);
      expect(result.deletedAt).toBeUndefined();
      expect(result.storageKey).toContain("test.pdf");

      // 验证 study_events 写入
      const events = callS1("events.list", { semesterId, eventType: "material_uploaded" }) as unknown[];
      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it("MAT-02 upload：拒绝 ../ 路径逃逸（BAD_REQUEST）", () => {
      expect(() =>
        call("materials.upload", {
          courseId,
          file: { name: "../../../etc/passwd", size: 100, mime: "application/pdf" },
        }),
      ).toThrowError(/拒绝|非法|逃逸/);
    });

    it("MAT-03 upload：拒绝 :\\ 路径（BAD_REQUEST）", () => {
      expect(() =>
        call("materials.upload", {
          courseId,
          file: { name: "C:\\Windows\\system32\\evil.pdf", size: 100, mime: "application/pdf" },
        }),
      ).toThrowError(/拒绝|非法|逃逸/);
    });

    it("MAT-04 upload：MIME 与扩展不一致拒绝（BAD_REQUEST，服务端验证不信浏览器）", () => {
      expect(() =>
        call("materials.upload", {
          courseId,
          file: { name: "evil.pdf", size: 100, mime: "application/x-msdownload" },
        }),
      ).toThrowError(/MIME|类型|拒绝/);
    });

    it("MAT-05 list：按 courseId 返回资料", () => {
      const list = call("materials.list", { courseId }) as Material[];
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((m) => m.id === materialId)).toBe(true);
    });

    it("MAT-06 list：按 status 过滤", () => {
      const pending = call("materials.list", { courseId, status: "pending" }) as Material[];
      expect(pending.every((m) => m.status === "pending")).toBe(true);
      const completed = call("materials.list", { courseId, status: "completed" }) as Material[];
      expect(completed.length).toBe(0);
    });

    it("MAT-07 get：返回 Material", () => {
      const m = call("materials.get", { id: materialId }) as Material;
      expect(m.id).toBe(materialId);
      expect(m.fileName).toBe("test.pdf");
    });

    it("MAT-08 get：不存在抛 NOT_FOUND", () => {
      expect(() => call("materials.get", { id: "nonexistent-id" })).toThrowError(/未找到|不存在/);
    });

    it("MAT-09 convert：登记 Job(pending, job_type=convert_pdf) + Material→converting", async () => {
      const job = (await call("materials.convert", { id: materialId })) as Job;
      expect(job.materialId).toBe(materialId);
      expect(job.jobType).toBe("convert_pdf");
      expect(job.status).toBe("pending");
      expect(job.retryCount).toBe(0);
      expect(job.maxRetries).toBe(3);

      const m = call("materials.get", { id: materialId }) as Material;
      expect(m.status).toBe("converting");
    });

    it("MAT-10 retryConversion：conversion_failed→converting + retry_count++", async () => {
      // 模拟转换失败
      const db = ctx.semesterDb(semesterId);
      db.prepare("UPDATE materials SET status = 'conversion_failed' WHERE id = @id").run({ id: materialId });
      db.prepare("UPDATE jobs SET status = 'failed' WHERE material_id = @id").run({ id: materialId });

      const job = (await call("materials.retryConversion", { id: materialId })) as Job;
      expect(job.retryCount).toBe(1);
      expect(job.status).toBe("pending");

      const m = call("materials.get", { id: materialId }) as Material;
      expect(m.status).toBe("converting");
    });

    it("MAT-11 retryConversion：retry_count >= max_retries 拒绝", async () => {
      const db = ctx.semesterDb(semesterId);
      db.prepare("UPDATE materials SET status = 'conversion_failed' WHERE id = @id").run({ id: materialId });
      db.prepare("UPDATE jobs SET retry_count = 3, status = 'failed' WHERE material_id = @id").run({ id: materialId });

      await expect(call("materials.retryConversion", { id: materialId })).rejects.toThrowError(/重试|上限|max|超过/);
    });

    it("MAT-12 replaceText：跳过转换直写 normalized_texts + status→converted", () => {
      const m = call("materials.replaceText", { id: materialId, text: "手动粘贴的纯文本内容" }) as Material;
      expect(m.status).toBe("converted");
      expect(m.convertedAt).toBeDefined();

      const db = ctx.semesterDb(semesterId);
      const norm = db
        .prepare("SELECT * FROM normalized_texts WHERE material_id = @id")
        .get({ id: materialId }) as Record<string, unknown>;
      expect(norm).toBeDefined();
      expect(norm.content).toBe("手动粘贴的纯文本内容");
      expect(norm.content_hash).toBeDefined();
    });

    it("MAT-13 generateNote：登记 Job(pending, job_type=generate_note) + Material→note_generating", () => {
      const job = call("materials.generateNote", { id: materialId }) as Job;
      expect(job.jobType).toBe("generate_note");
      expect(job.status).toBe("pending");

      const m = call("materials.get", { id: materialId }) as Material;
      expect(m.status).toBe("note_generating");
    });

    it("MAT-14 retryAiGeneration：pending_quality_check→note_generating + retry_count++", () => {
      const db = ctx.semesterDb(semesterId);
      db.prepare("UPDATE materials SET status = 'pending_quality_check' WHERE id = @id").run({ id: materialId });
      db.prepare("UPDATE jobs SET status = 'failed' WHERE material_id = @id AND job_type = 'generate_note'").run({
        id: materialId,
      });

      const job = call("materials.retryAiGeneration", { id: materialId }) as Job;
      expect(job.jobType).toBe("generate_note");
      expect(job.status).toBe("pending");

      const m = call("materials.get", { id: materialId }) as Material;
      expect(m.status).toBe("note_generating");
    });

    it("MAT-15 retryAiGeneration：retry_count >= max_retries 拒绝", () => {
      const db = ctx.semesterDb(semesterId);
      db.prepare("UPDATE materials SET status = 'pending_quality_check' WHERE id = @id").run({ id: materialId });
      db.prepare("UPDATE jobs SET retry_count = 3, status = 'failed' WHERE material_id = @id AND job_type = 'generate_note'").run({
        id: materialId,
      });
      expect(() => call("materials.retryAiGeneration", { id: materialId })).toThrowError(/重试|上限|max|超过/);
    });

    it("MAT-16 状态机：convert 非 pending/conversion_failed 拒绝", async () => {
      // material 当前 note_generating，convert 应拒绝
      await expect(call("materials.convert", { id: materialId })).rejects.toThrowError(/状态|迁移|不允许/);
    });

    it("MAT-17 delete：软删除（deleted_at 不为空，list 不返回）", () => {
      const result = call("materials.delete", { id: materialId });
      expect(result).toBeUndefined();
      const m = call("materials.get", { id: materialId }) as Material;
      expect(m.deletedAt).toBeDefined();
      const list = call("materials.list", { courseId }) as Material[];
      expect(list.some((x) => x.id === materialId)).toBe(false);
    });
  });

  describe("notes.* / modules.* — 笔记与知识模块", () => {
    let noteMaterialId: string;
    let moduleId: string;

    it("NOTE-01 前置：上传新资料供 notes 测试", () => {
      const file = stageTestMaterial(ISOLATION_DIR, FIXTURE_DIR, "note-test.pdf", "application/pdf", "note test content");
      const m = call("materials.upload", { courseId, file }) as Material;
      noteMaterialId = m.id;
      // 直接 SQL 写一条 structured_notes + mind_maps + knowledge_modules 供 notes/modules 测试
      const db = ctx.semesterDb(semesterId);
      const ts = new Date().toISOString();
      db.prepare(
        `INSERT INTO structured_notes (id, material_id, course_instance_id, note_markdown, highlights_json, prompt_version, model, ai_generated, created_at, updated_at)
         VALUES (@id, @mid, @cid, '# 测试笔记', '[]', 'v1', 'test-model', 1, @ts, @ts)`,
      ).run({ id: "note-test-id", mid: noteMaterialId, cid: courseId, ts });
      db.prepare(
        `INSERT INTO mind_maps (id, material_id, course_instance_id, markmap_json, created_at)
         VALUES (@id, @mid, @cid, '{"text":"root"}', @ts)`,
      ).run({ id: "mindmap-test-id", mid: noteMaterialId, cid: courseId, ts });
      db.prepare(
        `INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name, learn_status, source_evidence_json, ai_generated, created_at, updated_at)
         VALUES (@id, @cid, @mid, '测试模块', 'not_started', '{"material_id":"x"}', 1, @ts, @ts)`,
      ).run({ id: "module-test-id", cid: courseId, mid: noteMaterialId, ts });
      moduleId = "module-test-id";
    });

    it("NOTE-02 notes.get：返回 StructuredNote（含 Markdown + highlights）", () => {
      const note = call("notes.get", { materialId: noteMaterialId }) as StructuredNote;
      expect(note.materialId).toBe(noteMaterialId);
      expect(note.noteMarkdown).toBe("# 测试笔记");
      expect(Array.isArray(note.highlights)).toBe(true);
      expect(note.promptVersion).toBe("v1");
      expect(note.model).toBe("test-model");
      expect(note.aiGenerated).toBe(1);
    });

    it("NOTE-03 notes.update：写 note_markdown + highlights_json + updated_at", () => {
      const updated = call("notes.update", {
        materialId: noteMaterialId,
        noteMarkdown: "# 编辑后的笔记",
        highlights: [{ text: "重点1", color: "yellow" }],
      }) as StructuredNote;
      expect(updated.noteMarkdown).toBe("# 编辑后的笔记");
      expect(updated.highlights.length).toBe(1);
      expect(updated.highlights[0].text).toBe("重点1");

      const db = ctx.semesterDb(semesterId);
      const row = db
        .prepare("SELECT * FROM structured_notes WHERE material_id = @id")
        .get({ id: noteMaterialId }) as Record<string, unknown>;
      expect(row.note_markdown).toBe("# 编辑后的笔记");
      expect(row.highlights_json).toContain("重点1");
    });

    it("NOTE-04 notes.getMindMap：返回 MindMap（markmap_json 字符串）", () => {
      const mm = call("notes.getMindMap", { materialId: noteMaterialId }) as MindMap;
      expect(mm.materialId).toBe(noteMaterialId);
      expect(typeof mm.markmapJson).toBe("string");
      expect(mm.markmapJson).toContain("root");
    });

    it("MOD-01 modules.list：按 courseId 返回", () => {
      const list = call("modules.list", { courseId }) as KnowledgeModule[];
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((m) => m.id === moduleId)).toBe(true);
    });

    it("MOD-02 modules.list：按 learnStatus 过滤", () => {
      const notStarted = call("modules.list", { courseId, learnStatus: "not_started" }) as KnowledgeModule[];
      expect(notStarted.every((m) => m.learnStatus === "not_started")).toBe(true);
      const mastered = call("modules.list", { courseId, learnStatus: "mastered" }) as KnowledgeModule[];
      expect(mastered.length).toBe(0);
    });

    it("MOD-03 modules.get：返回 KnowledgeModule（含 sourceEvidenceJson 回链）", () => {
      const m = call("modules.get", { id: moduleId }) as KnowledgeModule;
      expect(m.id).toBe(moduleId);
      expect(m.moduleName).toBe("测试模块");
      expect(m.sourceEvidenceJson).toContain("material_id");
      expect(m.materialId).toBe(noteMaterialId);
    });

    it("MOD-04 updateLearnStatus：not_started→learning", () => {
      const m = call("modules.updateLearnStatus", { id: moduleId, learnStatus: "learning" }) as KnowledgeModule;
      expect(m.learnStatus).toBe("learning");
    });

    it("MOD-05 updateLearnStatus：learning→mastered", () => {
      const m = call("modules.updateLearnStatus", { id: moduleId, learnStatus: "mastered" }) as KnowledgeModule;
      expect(m.learnStatus).toBe("mastered");
    });

    it("MOD-06 updateLearnStatus：mastered→needs_review", () => {
      const m = call("modules.updateLearnStatus", { id: moduleId, learnStatus: "needs_review" }) as KnowledgeModule;
      expect(m.learnStatus).toBe("needs_review");
    });

    it("MOD-07 updateLearnStatus：非法值拒绝（BAD_REQUEST）", () => {
      expect(() =>
        call("modules.updateLearnStatus", { id: moduleId, learnStatus: "invalid_status" }),
      ).toThrowError(/状态|非法|不允许/);
    });
  });

  describe("jobs.* — 作业查询", () => {
    it("JOB-01 jobs.list：按 materialId 返回", async () => {
      // 先上传一个新资料触发 convert
      const file = stageTestMaterial(ISOLATION_DIR, FIXTURE_DIR, "job-test.pdf", "application/pdf", "job test");
      const m = call("materials.upload", { courseId, file }) as Material;
      await call("materials.convert", { id: m.id });
      const jobs = call("jobs.list", { materialId: m.id }) as Job[];
      expect(jobs.length).toBeGreaterThanOrEqual(1);
      expect(jobs.every((j) => j.materialId === m.id)).toBe(true);
    });

    it("JOB-02 jobs.list：按 status 过滤", () => {
      const pending = call("jobs.list", { status: "pending" }) as Job[];
      expect(pending.every((j) => j.status === "pending")).toBe(true);
      const running = call("jobs.list", { status: "running" }) as Job[];
      expect(running.length).toBe(0);
    });

    it("JOB-03 jobs.get：返回 Job", () => {
      const list = call("jobs.list", { status: "pending" }) as Job[];
      if (list.length > 0) {
        const job = call("jobs.get", { id: list[0].id }) as Job;
        expect(job.id).toBe(list[0].id);
        expect(job.jobType).toBeDefined();
        expect(["pending", "running", "completed", "failed"]).toContain(job.status);
      }
    });

    it("JOB-04 jobs.get：不存在抛 NOT_FOUND", () => {
      expect(() => call("jobs.get", { id: "nonexistent-job" })).toThrowError(/未找到|不存在/);
    });
  });

  describe("状态机边界", () => {
    it("STM-01 convert 在 completed 状态拒绝", async () => {
      const file = stageTestMaterial(ISOLATION_DIR, FIXTURE_DIR, "stm-test.pdf", "application/pdf", "stm test");
      const m = call("materials.upload", { courseId, file }) as Material;
      const db = ctx.semesterDb(semesterId);
      db.prepare("UPDATE materials SET status = 'completed' WHERE id = @id").run({ id: m.id });
      await expect(call("materials.convert", { id: m.id })).rejects.toThrowError(/状态|迁移|不允许/);
    });

    it("STM-02 generateNote 在 pending 状态拒绝（必须先 converted）", () => {
      const file = stageTestMaterial(ISOLATION_DIR, FIXTURE_DIR, "stm-test2.pdf", "application/pdf", "stm test 2");
      const m = call("materials.upload", { courseId, file }) as Material;
      // pending 状态调 generateNote 应拒绝
      expect(() => call("materials.generateNote", { id: m.id })).toThrowError(/状态|迁移|不允许|转换/);
    });
  });
});
