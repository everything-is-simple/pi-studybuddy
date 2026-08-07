import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import { createGlobalDb } from "../../src/data/global";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import { S5Context } from "../../src/agent-host/handlers/s5/context";
import { createS5Tools, S5_TOOL_NAMES, S5_TOOL_COUNT } from "../../src/agent/tools/s5/tools";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

/**
 * T-M2-001 S5 registerTool 工具单件测试（08-Test §3.1 + 03-Arch §2.2 ToolDefinition 契约）
 *
 * 每个工具 ≥4 条契约断言（08-Test §3.1）：
 *   - ToolDefinition 必填 name/label/description/parameters/execute
 *   - 工具名匹配 ^studybuddy_[a-z_]+$（03-Arch §2.2）
 *   - execute 成功返回 {content, details} 结构
 *   - execute 失败 throw Error（业务错误）
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M2-001\unit-tools。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-001\\unit-tools";

describe("T-M2-001 S5 registerTool 工具单件测试", () => {
  let s1Ctx: S1Context;
  let s5Ctx: S5Context;
  let s1Handlers: ReturnType<typeof createS1Handlers>;
  let tools: ToolDefinition[];
  let semesterId: string;
  let courseId: string;
  let confirmedAttemptId: string;
  let paperId: string;
  let attemptId: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    s1Ctx = new S1Context(ISOLATION_DIR);
    s1Handlers = createS1Handlers(s1Ctx);
    s5Ctx = new S5Context(ISOLATION_DIR);
    tools = createS5Tools(s5Ctx);

    // 夹具：学期 + 课程 + 知识模块 + 已确认考试
    const sem = (s1Handlers["semesters.create"] as (p: unknown) => unknown)({
      label: "S5工具测试学期",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      timezone: "Asia/Shanghai",
    }) as { id: string };
    semesterId = sem.id;

    const course = (s1Handlers["courses.create"] as (p: unknown) => unknown)({
      semesterId,
      courseName: "S5工具测试课程",
      subject: "数学",
    }) as { id: string };
    courseId = course.id;

    // 建 material + knowledge_module（mock_exam_questions FK）
    const db0 = s1Ctx.semesterDb(semesterId);
    const ts = new Date().toISOString();
    db0.prepare(
      `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes,
        mime_type, storage_key, uploaded_at, created_at, updated_at)
       VALUES (@id, @cid, @fn, @ft, @fs, @mt, @sk, @ts, @ts, @ts)`,
    ).run({
      id: "s5-tool-mat-1",
      cid: courseId,
      fn: "test.pdf",
      ft: "pdf",
      fs: 1000,
      mt: "application/pdf",
      sk: "test/material.pdf",
      ts,
    });
    db0.prepare(
      `INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name,
        source_evidence_json, created_at, updated_at)
       VALUES (@id, @cid, @mid, @mn, @se, @ts, @ts)`,
    ).run({
      id: "s5-tool-mod-1",
      cid: courseId,
      mid: "s5-tool-mat-1",
      mn: "S5工具测试模块",
      se: "[]",
      ts,
    });

    // 已确认考试
    const exam = (s1Handlers["exams.add"] as (p: unknown) => unknown)({
      courseId,
      examName: "期末考试",
      examType: "final",
      scheduledDate: "2027-01-20",
      source: "student_input",
    }) as { id: string };
    (s1Handlers["exams.confirm"] as (p: unknown) => unknown)({ id: exam.id, confirmed: true });
    confirmedAttemptId = exam.id;
  });

  afterAll(() => {
    s1Ctx?.dispose();
    s5Ctx?.dispose();
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
    it("TOOLSET-01 返回 2 个工具（S5_TOOL_COUNT === 2）", () => {
      expect(tools.length).toBe(2);
      expect(S5_TOOL_COUNT).toBe(2);
    });

    it("TOOLSET-02 工具名清单与 S5_TOOL_NAMES 一致", () => {
      const names = tools.map((t) => t.name);
      expect(names).toEqual([...S5_TOOL_NAMES]);
    });

    it("TOOLSET-03 所有工具名匹配 ^studybuddy_[a-z_]+$", () => {
      for (const tool of tools) {
        expect(tool.name).toMatch(/^studybuddy_[a-z_]+$/);
      }
    });
  });

  describe("工具 1: studybuddy_generate_mock_exam", () => {
    const tool = () => tools[0];

    it("GEN-01 ToolDefinition 必填字段齐全（name/label/description/parameters/execute）", () => {
      const t = tool();
      expect(t.name).toBe("studybuddy_generate_mock_exam");
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.parameters).toBeDefined();
      expect(typeof t.execute).toBe("function");
    });

    it("GEN-02 execute 成功生成模拟卷，返回 {content, details}", async () => {
      const result = await tool().execute("gen-1", {
        assessmentAttemptId: confirmedAttemptId,
        questionCount: 5,
      });
      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("details");
      expect(result.details).toHaveProperty("paperId");
      expect(result.details).toHaveProperty("questionCount");
      expect(result.details.questionCount).toBe(5);
      paperId = result.details.paperId;
    });

    it("GEN-03 details 含 paperId / questionCount / totalScore", async () => {
      const result = await tool().execute("gen-2", {
        assessmentAttemptId: confirmedAttemptId,
        questionCount: 5,
      });
      expect(result.details.paperId).toBe(paperId); // 幂等：同参数返回同 paper
      expect(result.details.questionCount).toBe(5);
      expect(result.details.totalScore).toBeGreaterThan(0);
    });

    it("GEN-04 execute 失败 throw Error（未确认考试 → BAD_REQUEST）", async () => {
      // 建一个未确认考试（examType 必须在 CHECK 约束白名单内：midterm/final/makeup/retake/quiz）
      const exam2 = (s1Handlers["exams.add"] as (p: unknown) => unknown)({
        courseId,
        examName: "未确认测验",
        examType: "quiz",
        scheduledDate: "2027-01-15",
        source: "student_input",
      }) as { id: string };
      await expect(
        tool().execute("gen-fail", {
          assessmentAttemptId: exam2.id,
          questionCount: 5,
        }),
      ).rejects.toThrow();
    });
  });

  describe("工具 2: studybuddy_submit_mock_exam", () => {
    const tool = () => tools[1];

    it("SUB-01 ToolDefinition 必填字段齐全", () => {
      const t = tool();
      expect(t.name).toBe("studybuddy_submit_mock_exam");
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.parameters).toBeDefined();
      expect(typeof t.execute).toBe("function");
    });

    it("SUB-02 execute 成功提交模拟考，返回 {content, details}", async () => {
      // 先 startAttempt
      const s5Handlers = createS5Tools(s5Ctx);
      // 使用 handler 直接 startAttempt（通过内部 handler 调用）
      // 由于 tools 是薄封装，这里通过先 generatePaper 拿 paperId，再 startAttempt + submit
      // paperId 已在 GEN-02 设置
      const handlersModule = await import("../../src/agent-host/handlers/s5");
      const handlers = handlersModule.createS5Handlers(s5Ctx);
      const attempt = (handlers["mockExams.startAttempt"] as (p: unknown) => unknown)({
        paperId,
      }) as { id: string };
      attemptId = attempt.id;

      const result = await tool().execute("sub-1", {
        attemptId,
        answers: [],
      });
      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("details");
      expect(result.details).toHaveProperty("attemptId");
      expect(result.details).toHaveProperty("totalScore");
      expect(result.details).toHaveProperty("correctCount");
    });

    it("SUB-03 details 含 attemptId / totalScore / correctCount / maxScore", async () => {
      // 用另一个 attempt 测试（再 startAttempt + submit）
      const handlersModule = await import("../../src/agent-host/handlers/s5");
      const handlers = handlersModule.createS5Handlers(s5Ctx);
      const attempt = (handlers["mockExams.startAttempt"] as (p: unknown) => unknown)({
        paperId,
      }) as { id: string };

      const result = await tool().execute("sub-2", {
        attemptId: attempt.id,
        answers: [],
      });
      expect(result.details.attemptId).toBe(attempt.id);
      expect(result.details.maxScore).toBeGreaterThan(0);
      expect(result.details.correctCount).toBeGreaterThanOrEqual(0);
    });

    it("SUB-04 execute 失败 throw Error（attemptId 不存在 → NOT_FOUND）", async () => {
      await expect(
        tool().execute("sub-fail", {
          attemptId: "nonexistent-attempt-id",
          answers: [],
        }),
      ).rejects.toThrow();
    });
  });
});
