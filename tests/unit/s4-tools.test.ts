import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import { createGlobalDb } from "../../src/data/global";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import { S3Context, createS3Handlers } from "../../src/agent-host/handlers/s3";
import { S4Context } from "../../src/agent-host/handlers/s4/context";
import { createS4Tools, S4_TOOL_NAMES, S4_TOOL_COUNT } from "../../src/agent/tools/s4/tools";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

/**
 * T-M1-004 S4 registerTool 工具单件测试（08-Test §3.1 + 03-Arch §2.2 ToolDefinition 契约）
 *
 * 每个工具 ≥4 条契约断言（08-Test §3.1）：
 *   - ToolDefinition 必填 name/label/description/parameters/execute
 *   - 工具名匹配 ^studybuddy_[a-z_]+$（03-Arch §2.2）
 *   - execute 成功返回 {content, details} 结构
 *   - execute 失败 throw Error（业务错误）
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-004\。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-004\\unit-tools";

describe("T-M1-004 S4 registerTool 工具单件测试", () => {
  let s1Ctx: S1Context;
  let s3Ctx: S3Context;
  let s4Ctx: S4Context;
  let s1Handlers: ReturnType<typeof createS1Handlers>;
  let s3Handlers: ReturnType<typeof createS3Handlers>;
  let tools: ToolDefinition[];
  let semesterId: string;
  let courseId: string;
  let practiceAnswerId: string;
  let mistakeId: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    s1Ctx = new S1Context(ISOLATION_DIR);
    s1Handlers = createS1Handlers(s1Ctx);
    s3Ctx = new S3Context(ISOLATION_DIR);
    s3Handlers = createS3Handlers(s3Ctx);
    s4Ctx = new S4Context(ISOLATION_DIR);
    tools = createS4Tools(s4Ctx);

    // 夹具：学期 + 课程
    const sem = (s1Handlers["semesters.create"] as (p: unknown) => unknown)({
      label: "S4工具测试学期",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      timezone: "Asia/Shanghai",
    }) as { id: string };
    semesterId = sem.id;
    const course = (s1Handlers["courses.create"] as (p: unknown) => unknown)({
      semesterId: sem.id,
      courseName: "S4工具测试课程",
      subject: "数学",
    }) as { id: string };
    courseId = course.id;

    // T-M4-013：practice.createSession 校验 module→course 归属，预置 S4 工具测试使用的真实模块。
    const fixtureDb = s1Ctx.semesterDb(semesterId);
    const ts = new Date().toISOString();
    fixtureDb.prepare(
      `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes,
        mime_type, storage_key, source_type, status, permission_confirmed,
        uploaded_at, created_at, updated_at)
       VALUES ('s4-mat-1', @cid, 'test.pdf', 'pdf', 1000, 'application/pdf',
               'test/material.pdf', 'upload', 'completed', 1, @ts, @ts, @ts)`,
    ).run({ cid: courseId, ts });
    fixtureDb.prepare(
      `INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name,
        importance, learn_status, source_evidence_json, ai_generated, created_at, updated_at)
       VALUES ('s4-mod-1', @cid, 's4-mat-1', 'S4工具测试模块', 3, 'not_started', '[]', 0, @ts, @ts)`,
    ).run({ cid: courseId, ts });

    // 夹具：S3 练习 session + submit（空答案 → 全错 → is_correct=0）
    const session = (s3Handlers["practice.createSession"] as (p: unknown) => unknown)({
      courseId,
      moduleIds: ["s4-mod-1"],
      questionCount: 5,
    }) as { id: string };
    const result = (s3Handlers["practice.submit"] as (p: unknown) => unknown)({
      sessionId: session.id,
      answers: [],
    }) as { items: Array<{ question: { id: string }; isCorrect: boolean }> };

    // 取第一条错误答题的 ID（通过 getResult 无法拿 practiceAnswerId，需直接查库）
    const db = s3Ctx.semesterDb(sem.id);
    const answerRow = db
      .prepare("SELECT id FROM practice_answers WHERE practice_session_id = @sid AND is_correct = 0 LIMIT 1")
      .get({ sid: session.id }) as { id: string };
    practiceAnswerId = answerRow.id;
    void result;
  });

  afterAll(() => {
    s1Ctx?.dispose();
    s3Ctx?.dispose();
    s4Ctx?.dispose();
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
    it("TOOLSET-01 返回 4 个工具（S4_TOOL_COUNT === 4）", () => {
      expect(tools.length).toBe(4);
      expect(S4_TOOL_COUNT).toBe(4);
    });

    it("TOOLSET-02 工具名清单与 S4_TOOL_NAMES 一致", () => {
      const names = tools.map((t) => t.name);
      expect(names).toEqual([...S4_TOOL_NAMES]);
    });

    it("TOOLSET-03 所有工具名匹配 ^studybuddy_[a-z_]+$", () => {
      for (const tool of tools) {
        expect(tool.name).toMatch(/^studybuddy_[a-z_]+$/);
      }
    });
  });

  describe("工具 1: studybuddy_archive_mistake", () => {
    const tool = () => tools[0];

    it("AM-01 ToolDefinition 必填字段齐全（name/label/description/parameters/execute）", () => {
      const t = tool();
      expect(t.name).toBe("studybuddy_archive_mistake");
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.parameters).toBeDefined();
      expect(typeof t.execute).toBe("function");
    });

    it("AM-02 execute 成功归档错题，返回 {content, details}", async () => {
      const result = await tool().execute("am-1", { practiceAnswerId });
      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("details");
      expect(result.details).toHaveProperty("mistakeId");
      expect(result.details).toHaveProperty("status");
      expect(result.details.status).toBe("needs_review");
      mistakeId = result.details.mistakeId;
    });

    it("AM-03 details 含 mistakeId / status / redoCount", async () => {
      const result = await tool().execute("am-2", { practiceAnswerId });
      expect(result.details.mistakeId).toBe(mistakeId); // 幂等：同一答题归档返回同一 mistake
      expect(result.details.status).toBe("needs_review");
      expect(result.details.redoCount).toBe(0);
    });

    it("AM-04 execute 失败 throw Error（practiceAnswerId 不存在 → NOT_FOUND）", async () => {
      await expect(
        tool().execute("am-fail", { practiceAnswerId: "nonexistent-answer-id" }),
      ).rejects.toThrow();
    });
  });

  describe("工具 2: studybuddy_confirm_error_cause", () => {
    const tool = () => tools[1];

    it("CE-01 ToolDefinition 必填字段齐全", () => {
      const t = tool();
      expect(t.name).toBe("studybuddy_confirm_error_cause");
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.parameters).toBeDefined();
      expect(typeof t.execute).toBe("function");
    });

    it("CE-02 execute 成功确认错因（六分类），返回 {content, details}", async () => {
      const result = await tool().execute("ce-1", {
        id: mistakeId,
        category: "concept_unclear",
        causeNote: "概念混淆",
      });
      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("details");
      expect(result.details.errorCategory).toBe("concept_unclear");
      expect(result.details.errorCauseConfirmedBy).toBe("student");
    });

    it("CE-03 details 含 mistakeId / errorCategory / errorCauseConfirmedBy", async () => {
      const result = await tool().execute("ce-2", {
        id: mistakeId,
        category: "misread",
      });
      expect(result.details.mistakeId).toBe(mistakeId);
      expect(result.details.errorCategory).toBe("misread");
      expect(result.details.errorCauseConfirmedBy).toBe("student");
    });

    it("CE-04 execute 失败 throw Error（无效分类 → BAD_REQUEST）", async () => {
      await expect(
        tool().execute("ce-fail", {
          id: mistakeId,
          category: "invalid_category" as never,
        }),
      ).rejects.toThrow();
    });
  });

  describe("工具 3: studybuddy_redo_mistake", () => {
    const tool = () => tools[2];

    it("RM-01 ToolDefinition 必填字段齐全", () => {
      const t = tool();
      expect(t.name).toBe("studybuddy_redo_mistake");
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.parameters).toBeDefined();
      expect(typeof t.execute).toBe("function");
    });

    it("RM-02 execute 重做错误，返回 {content, details}", async () => {
      const result = await tool().execute("rm-1", { id: mistakeId, correct: false });
      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("details");
      expect(result.details.correct).toBe(false);
      expect(result.details).toHaveProperty("evidenceCount");
      expect(result.details).toHaveProperty("weakPointFormed");
    });

    it("RM-03 details 含 mistakeId / correct / evidenceCount / weakPointFormed", async () => {
      const result = await tool().execute("rm-2", { id: mistakeId, correct: false });
      expect(result.details.mistakeId).toBe(mistakeId);
      expect(result.details.correct).toBe(false);
      expect(typeof result.details.evidenceCount).toBe("number");
      expect(typeof result.details.weakPointFormed).toBe("boolean");
    });

    it("RM-04 execute 失败 throw Error（mistakeId 不存在 → NOT_FOUND）", async () => {
      await expect(
        tool().execute("rm-fail", { id: "nonexistent-mistake-id", correct: true }),
      ).rejects.toThrow();
    });
  });

  describe("工具 4: studybuddy_aggregate_weak_point", () => {
    const tool = () => tools[3];

    it("AW-01 ToolDefinition 必填字段齐全", () => {
      const t = tool();
      expect(t.name).toBe("studybuddy_aggregate_weak_point");
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.parameters).toBeDefined();
      expect(typeof t.execute).toBe("function");
    });

    it("AW-02 execute 成功返回薄弱点列表，返回 {content, details}", async () => {
      const result = await tool().execute("aw-1", {});
      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("details");
      expect(result.details).toHaveProperty("count");
      expect(result.details).toHaveProperty("weakPoints");
    });

    it("AW-03 details 含 count / weakPoints", async () => {
      const result = await tool().execute("aw-2", { courseId });
      expect(typeof result.details.count).toBe("number");
      expect(Array.isArray(result.details.weakPoints)).toBe(true);
    });

    it("AW-04 execute 支持按 courseId 过滤（不存在的 courseId → NOT_FOUND）", async () => {
      await expect(
        tool().execute("aw-fail", { courseId: "nonexistent-course-id" }),
      ).rejects.toThrow();
    });
  });
});
