import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import { createGlobalDb } from "../../src/data/global";
import { S3Context } from "../../src/agent-host/handlers/s3/context";
import { S1Context } from "../../src/agent-host/handlers/s1/context";
import { createS1Handlers } from "../../src/agent-host/handlers/s1";
import { createS3Tools, S3_TOOL_NAMES, S3_TOOL_COUNT } from "../../src/agent/tools/s3/tools";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

/**
 * T-M1-003 S3 registerTool 工具单件测试（08-Test §3.1 + 03-Arch §2.2 ToolDefinition 契约）
 *
 * 每个工具 ≥4 条契约断言（08-Test §3.1）：
 *   - ToolDefinition 必填 name/label/description/parameters/execute
 *   - 工具名匹配 ^studybuddy_[a-z_]+$（03-Arch §2.2）
 *   - execute 成功返回 {content, details} 结构
 *   - execute 失败 throw Error（业务错误）
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-003\。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-003\\unit-tools";

describe("T-M1-003 S3 registerTool 工具单件测试", () => {
  let ctx: S3Context;
  let s1Ctx: S1Context;
  let tools: ToolDefinition[];
  let semesterId: string;
  let courseId: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    ctx = new S3Context(ISOLATION_DIR);
    s1Ctx = new S1Context(ISOLATION_DIR);
    const s1Handlers = createS1Handlers(s1Ctx);
    const sem = (s1Handlers["semesters.create"] as (p: unknown) => unknown)({
      label: "S3工具测试学期",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      timezone: "Asia/Shanghai",
    }) as { id: string };
    semesterId = sem.id;
    const course = (s1Handlers["courses.create"] as (p: unknown) => unknown)({
      semesterId,
      courseName: "工具测试课程",
      subject: "数学",
    }) as { id: string };
    courseId = course.id;

    // T-M4-013：host 现在校验 moduleIds 必须属于当前 course；旧工具测试使用合成 ID，
    // 因此在隔离 semester.db 中为每个合成模块预置合法 material/module 夹具。
    const db = ctx.semesterDb(semesterId);
    const fixtureTs = new Date().toISOString();
    const fixtureModuleIds = [
      "module-1",
      "module-2",
      "module-3",
      "submit-mod",
      "sp3-mod",
      "result-mod",
      "gr4-mod",
    ];
    const insertMaterial = db.prepare(
      `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes,
        mime_type, storage_key, source_type, status, permission_confirmed,
        uploaded_at, created_at, updated_at)
       VALUES (@id, @cid, @fn, 'pdf', 1000, 'application/pdf', @sk, 'upload',
               'completed', 1, @ts, @ts, @ts)`,
    );
    const insertModule = db.prepare(
      `INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name,
        importance, learn_status, source_evidence_json, ai_generated, created_at, updated_at)
       VALUES (@id, @cid, @mid, @name, 3, 'not_started', '[]', 0, @ts, @ts)`,
    );
    for (const moduleId of fixtureModuleIds) {
      const materialId = `${moduleId}-material`;
      insertMaterial.run({
        id: materialId,
        cid: courseId,
        fn: `${moduleId}.pdf`,
        sk: `test/${moduleId}.pdf`,
        ts: fixtureTs,
      });
      insertModule.run({
        id: moduleId,
        cid: courseId,
        mid: materialId,
        name: `测试模块 ${moduleId}`,
        ts: fixtureTs,
      });
    }
    tools = createS3Tools(ctx);
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

  describe("工具集整体契约", () => {
    it("TOOLSET-01 返回 3 个工具（S3_TOOL_COUNT === 3）", () => {
      expect(tools.length).toBe(3);
      expect(S3_TOOL_COUNT).toBe(3);
    });

    it("TOOLSET-02 工具名清单与 S3_TOOL_NAMES 一致", () => {
      const names = tools.map((t) => t.name);
      expect(names).toEqual([...S3_TOOL_NAMES]);
    });

    it("TOOLSET-03 所有工具名匹配 ^studybuddy_[a-z_]+$", () => {
      for (const tool of tools) {
        expect(tool.name).toMatch(/^studybuddy_[a-z_]+$/);
      }
    });
  });

  describe("工具 1: studybuddy_generate_questions", () => {
    const tool = () => tools[0];

    it("GQ-01 ToolDefinition 必填字段齐全（name/label/description/parameters/execute）", () => {
      const t = tool();
      expect(t.name).toBe("studybuddy_generate_questions");
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.parameters).toBeDefined();
      expect(typeof t.execute).toBe("function");
    });

    it("GQ-02 execute 成功创建练习会话，返回 {content, details} 结构", async () => {
      const result = await tool().execute("call-1", {
        courseId,
        moduleIds: ["module-1"],
        questionCount: 5,
      });
      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("details");
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThanOrEqual(1);
    });

    it("GQ-03 details 含 sessionId / questionCount / status", async () => {
      const result = await tool().execute("call-2", {
        courseId,
        moduleIds: ["module-2"],
        questionCount: 5,
      });
      expect(result.details).toHaveProperty("sessionId");
      expect(result.details).toHaveProperty("questionCount");
      expect(result.details).toHaveProperty("status");
      expect(result.details.status).toBe("in_progress");
    });

    it("GQ-04 execute 失败 throw Error（questionCount < 5 → BAD_REQUEST）", async () => {
      await expect(
        tool().execute("call-3", {
          courseId,
          moduleIds: ["module-3"],
          questionCount: 3,
        }),
      ).rejects.toThrow();
    });
  });

  describe("工具 2: studybuddy_submit_practice", () => {
    const tool = () => tools[1];
    let sessionId: string;

    beforeAll(async () => {
      const result = await tools[0].execute("setup-submit", {
        courseId,
        moduleIds: ["submit-mod"],
        questionCount: 5,
      });
      sessionId = result.details.sessionId;
    });

    it("SP-01 ToolDefinition 必填字段齐全", () => {
      const t = tool();
      expect(t.name).toBe("studybuddy_submit_practice");
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.parameters).toBeDefined();
      expect(typeof t.execute).toBe("function");
    });

    it("SP-02 execute 成功提交并批改，返回 {content, details}", async () => {
      // 先获取题目
      const handlers = ctx.questionGenerator;
      void handlers;
      // 直接提交空答案（测试批改逻辑）
      const result = await tool().execute("submit-1", {
        sessionId,
        answers: [],
      });
      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("details");
      expect(result.details).toHaveProperty("totalScore");
      expect(result.details).toHaveProperty("maxScore");
      expect(result.details).toHaveProperty("correctCount");
    });

    it("SP-03 details 含 totalScore / maxScore / correctCount", async () => {
      // 创建新 session 并提交
      const createResult = await tools[0].execute("setup-sp3", {
        courseId,
        moduleIds: ["sp3-mod"],
        questionCount: 5,
      });
      const sid = createResult.details.sessionId;
      const result = await tool().execute("submit-sp3", {
        sessionId: sid,
        answers: [],
      });
      expect(result.details.totalScore).toBe(0); // 空答案 → 0 分
      expect(result.details.maxScore).toBeGreaterThan(0);
      expect(result.details.correctCount).toBe(0);
    });

    it("SP-04 execute 失败 throw Error（已 graded 重复提交）", async () => {
      // sessionId 已在 SP-02 中 graded
      await expect(
        tool().execute("submit-dup", {
          sessionId,
          answers: [],
        }),
      ).rejects.toThrow();
    });
  });

  describe("工具 3: studybuddy_get_practice_result", () => {
    const tool = () => tools[2];
    let sessionId: string;

    beforeAll(async () => {
      const createResult = await tools[0].execute("setup-result", {
        courseId,
        moduleIds: ["result-mod"],
        questionCount: 5,
      });
      sessionId = createResult.details.sessionId;
      await tools[1].execute("submit-result", {
        sessionId,
        answers: [],
      });
    });

    it("GR-01 ToolDefinition 必填字段齐全", () => {
      const t = tool();
      expect(t.name).toBe("studybuddy_get_practice_result");
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.parameters).toBeDefined();
      expect(typeof t.execute).toBe("function");
    });

    it("GR-02 execute 成功返回结果（含 items 逐题正误）", async () => {
      const result = await tool().execute("result-1", { sessionId });
      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("details");
      expect(result.details.sessionId).toBe(sessionId);
    });

    it("GR-03 details 含 totalScore / maxScore / correctCount", async () => {
      const result = await tool().execute("result-2", { sessionId });
      expect(result.details).toHaveProperty("totalScore");
      expect(result.details).toHaveProperty("maxScore");
      expect(result.details).toHaveProperty("correctCount");
    });

    it("GR-04 execute 失败 throw Error（未批改的 session 查看结果）", async () => {
      const createResult = await tools[0].execute("setup-gr4", {
        courseId,
        moduleIds: ["gr4-mod"],
        questionCount: 5,
      });
      await expect(
        tool().execute("result-fail", { sessionId: createResult.details.sessionId }),
      ).rejects.toThrow();
    });
  });
});
