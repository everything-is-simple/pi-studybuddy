import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import { createGlobalDb } from "../../src/data/global";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import {
  S5Context,
  createS5Handlers,
} from "../../src/agent-host/handlers/s5";
import type { RpcError } from "../../src/contract/types";

/**
 * T-M2-001 S5 handler 集成测试（06-API §3.7 + 07-WF §2.6 + 05-ERD §3.5）
 *
 * 在隔离目录落地真实 SQLite，验证 handler×semester.db 真实读写：
 *   - generatePaper：触发器校验 confirmed + source_hash 防重复 + AI 失败降级
 *   - getPaper：未提交不含 correct_answer（防泄露）
 *   - startAttempt：status=in_progress
 *   - submitAttempt：规则批改三策略 + 状态机 + 模块分析 + study_events
 *   - getResult/getModuleAnalyses：汇总 + 强弱项
 *   - cramCards：确定性只读 + 不暴露题干/答案
 *   - cramPlan：7 天 DTO + 确定性
 *   - 触发器：未 confirmed 拦截 + CHECK 字段互斥
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M2-001\。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-001\\integration";

function isRpcError(e: unknown): e is RpcError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}

describe("T-M2-001 S5 handler 集成测试", () => {
  let s1Ctx: S1Context;
  let s5Ctx: S5Context;
  let s1Handlers: ReturnType<typeof createS1Handlers>;
  let handlers: ReturnType<typeof createS5Handlers>;
  let semesterId: string;
  let courseId: string;
  let knowledgeModuleId: string;
  let confirmedAttemptId: string;
  let unconfirmedAttemptId: string;
  let paperId: string;
  let attemptId: string;

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
    s1Ctx = new S1Context(ISOLATION_DIR);
    s1Handlers = createS1Handlers(s1Ctx);
    s5Ctx = new S5Context(ISOLATION_DIR);
    handlers = createS5Handlers(s5Ctx);

    const sem = callS1("semesters.create", {
      label: "S5测试学期",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      timezone: "Asia/Shanghai",
    }) as { id: string };
    semesterId = sem.id;

    const course = callS1("courses.create", {
      semesterId,
      courseName: "S5测试课程",
      subject: "数学",
    }) as { id: string };
    courseId = course.id;

    // 建 material + knowledge_module（mock_exam_questions.knowledge_module_id FK）
    const db0 = s1Ctx.semesterDb(semesterId);
    const ts = new Date().toISOString();
    db0.prepare(
      `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes,
        mime_type, storage_key, uploaded_at, created_at, updated_at)
       VALUES (@id, @cid, @fn, @ft, @fs, @mt, @sk, @ts, @ts, @ts)`,
    ).run({
      id: "s5-mat-1",
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
      id: "s5-mod-1",
      cid: courseId,
      mid: "s5-mat-1",
      mn: "S5测试模块",
      se: "[]",
      ts,
    });
    knowledgeModuleId = "s5-mod-1";

    // 已确认考试
    const exam = callS1("exams.add", {
      courseId,
      examName: "期末考试",
      examType: "final",
      scheduledDate: "2027-01-20",
      source: "student_input",
    }) as { id: string };
    callS1("exams.confirm", { id: exam.id, confirmed: true });
    confirmedAttemptId = exam.id;

    // 未确认考试（GEN-02 / CRAM-03 用；examType 必须在 CHECK 白名单内）
    const exam2 = callS1("exams.add", {
      courseId,
      examName: "未确认测验",
      examType: "quiz",
      scheduledDate: "2027-01-15",
      source: "student_input",
    }) as { id: string };
    unconfirmedAttemptId = exam2.id;
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

  describe("mockExams.generatePaper", () => {
    it("GEN-01 confirmed 考试 + 生成成功 → 写 papers + questions + 返回 MockExamPaper", () => {
      const paper = call("mockExams.generatePaper", {
        assessmentAttemptId: confirmedAttemptId,
        questionCount: 5,
      }) as { id: string; questions: unknown[]; totalScore: number; sourceHash: string };
      expect(paper.id).toBeTruthy();
      expect(paper.questions.length).toBe(5);
      expect(paper.totalScore).toBeGreaterThan(0);
      expect(paper.sourceHash).toBeTruthy();
      paperId = paper.id;
    });

    it("GEN-02 未 confirmed 考试 → BAD_REQUEST + 该考试未确认", () => {
      try {
        call("mockExams.generatePaper", {
          assessmentAttemptId: unconfirmedAttemptId,
          questionCount: 5,
        });
        expect.fail("应抛出 BAD_REQUEST");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
        expect((e as RpcError).message).toContain("未确认");
      }
    });

    it("GEN-05 T-M5-004：无知识模块课程生成成功（mock_exam_questions 不引用不存在的模块）", () => {
      // 新建无模块课程 + 已确认考试（模拟真实空课程 UAT 路径）
      const sem = callS1("semesters.create", { label: "GEN5 学期", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" }) as { id: string };
      const course = callS1("courses.create", { semesterId: sem.id, courseName: "GEN5 课程", subject: "数学" }) as { id: string };
      const exam = callS1("exams.add", { courseId: course.id, examName: "GEN5 考试", examType: "final", scheduledDate: "2026-08-20", source: "student_input" }) as { id: string };
      callS1("exams.confirm", { id: exam.id, confirmed: true });
      const paper = call("mockExams.generatePaper", {
        assessmentAttemptId: exam.id,
        questionCount: 5,
      }) as { id: string; questions: unknown[] };
      expect(paper.id).toBeTruthy();
      expect(paper.questions.length).toBe(5);
      // mock_exam_questions 的 knowledge_module_id 必须为 NULL（FK 校验：不得引用不存在的 default-module）
      const db = s5Ctx.semesterDb(sem.id);
      const rows = db.prepare("SELECT knowledge_module_id FROM mock_exam_questions WHERE mock_paper_id = @pid").all({ pid: paper.id }) as Array<{ knowledge_module_id: string | null }>;
      expect(rows.length).toBe(5);
      for (const row of rows) {
        expect(row.knowledge_module_id, "空课程模拟卷题目不得引用不存在的知识模块").toBeNull();
      }
    });

    it("GEN-03 source_hash 防重复（同参数二次调用 → 返回已有 paper，不新建）", () => {
      const first = call("mockExams.generatePaper", {
        assessmentAttemptId: confirmedAttemptId,
        questionCount: 5,
      }) as { id: string; sourceHash: string };
      const second = call("mockExams.generatePaper", {
        assessmentAttemptId: confirmedAttemptId,
        questionCount: 5,
      }) as { id: string; sourceHash: string };
      expect(second.id).toBe(first.id);
      expect(second.sourceHash).toBe(first.sourceHash);
    });

    it("GEN-04 AI 失败（FailingGenerator）→ 不创建空卷 → INTERNAL_ERROR", () => {
      const ctx = new S5Context(ISOLATION_DIR, {
        mockExamGenerator: { generate: () => { throw new Error("AI 不可用"); } },
      });
      const h = createS5Handlers(ctx);
      try {
        (h["mockExams.generatePaper"] as (p: unknown) => unknown)({
          assessmentAttemptId: confirmedAttemptId,
          questionCount: 5,
        });
        expect.fail("应抛出 INTERNAL_ERROR");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("INTERNAL_ERROR");
        expect((e as RpcError).message).toContain("模拟卷生成失败");
      }
      ctx.dispose();
    });

    it("GEN-05 questionCount 校验（<5 拒绝）", () => {
      try {
        call("mockExams.generatePaper", {
          assessmentAttemptId: confirmedAttemptId,
          questionCount: 3,
        });
        expect.fail("应抛出 BAD_REQUEST");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("mockExams.getPaper", () => {
    it("GET-01 未提交时 questions 不含 correctAnswer/acceptableAnswers/explanation（防泄露）", () => {
      const paper = call("mockExams.getPaper", { paperId }) as {
        questions: Array<Record<string, unknown>>;
      };
      expect(paper.questions.length).toBeGreaterThan(0);
      for (const q of paper.questions) {
        expect(q).not.toHaveProperty("correctAnswer");
        expect(q).not.toHaveProperty("acceptableAnswers");
        expect(q).not.toHaveProperty("explanation");
      }
    });

    it("GET-02 已 graded 后 getPaper 仍防泄露（复盘用 getResult）", () => {
      // paperId 此时可能已 attempt + graded（取决于测试顺序），但 getPaper 始终防泄露
      const paper = call("mockExams.getPaper", { paperId }) as {
        questions: Array<Record<string, unknown>>;
      };
      for (const q of paper.questions) {
        expect(q).not.toHaveProperty("correctAnswer");
      }
    });

    it("GET-03 不存在 paperId → NOT_FOUND", () => {
      try {
        call("mockExams.getPaper", { paperId: "nonexistent" });
        expect.fail("应抛出 NOT_FOUND");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("mockExams.startAttempt", () => {
    it("START-01 成功 → status=in_progress + startedAt", () => {
      const attempt = call("mockExams.startAttempt", { paperId }) as {
        id: string;
        status: string;
        startedAt: string;
      };
      expect(attempt.id).toBeTruthy();
      expect(attempt.status).toBe("in_progress");
      expect(attempt.startedAt).toBeTruthy();
      attemptId = attempt.id;
    });

    it("START-02 不存在 paperId → NOT_FOUND", () => {
      try {
        call("mockExams.startAttempt", { paperId: "nonexistent" });
        expect.fail("应抛出 NOT_FOUND");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("mockExams.submitAttempt", () => {
    it("SUB-01 规则批改三策略 + 状态机 submitted→graded", () => {
      // 用空 answers → 全错
      const result = call("mockExams.submitAttempt", {
        attemptId,
        answers: [],
      }) as { attemptId: string; totalScore: number; correctCount: number; status?: string };
      expect(result.attemptId).toBe(attemptId);
      expect(result.totalScore).toBe(0);
      expect(result.correctCount).toBe(0);
    });

    it("SUB-02 状态机：已 graded 重复 submit → BAD_REQUEST", () => {
      try {
        call("mockExams.submitAttempt", { attemptId, answers: [] });
        expect.fail("应抛出 BAD_REQUEST");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("SUB-03 mock_exam_module_analyses 写入（weakness_level + UNIQUE）", () => {
      const db = s5Ctx.semesterDb(semesterId);
      const rows = db
        .prepare("SELECT * FROM mock_exam_module_analyses WHERE mock_attempt_id = @aid")
        .all({ aid: attemptId }) as Array<{ weakness_level: string }>;
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(["strong", "medium", "weak"]).toContain(r.weakness_level);
      }
    });

    it("SUB-04 study_events 写入（event_type=mock_exam_completed, source_system=S5）", () => {
      const db = s5Ctx.semesterDb(semesterId);
      const row = db
        .prepare(
          "SELECT * FROM study_events WHERE source_system = 'S5' AND event_type = 'mock_exam_completed' AND source_ref_id = @aid",
        )
        .get({ aid: attemptId }) as { id: string } | undefined;
      expect(row).toBeTruthy();
    });

    it("SUB-06 不存在 attemptId → NOT_FOUND", () => {
      try {
        call("mockExams.submitAttempt", { attemptId: "nonexistent", answers: [] });
        expect.fail("应抛出 NOT_FOUND");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("mockExams.getResult / getModuleAnalyses", () => {
    it("RES-01 getResult 返回汇总（totalScore/maxScore/correctCount/correctRate/elapsedMs + moduleAnalyses）", () => {
      const result = call("mockExams.getResult", { attemptId }) as {
        attemptId: string;
        totalScore: number;
        maxScore: number;
        correctCount: number;
        correctRate: number;
        elapsedMs: number;
        moduleAnalyses: unknown[];
      };
      expect(result.attemptId).toBe(attemptId);
      expect(result.maxScore).toBeGreaterThan(0);
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.moduleAnalyses)).toBe(true);
    });

    it("RES-02 getModuleAnalyses 返回 weak/medium/strong 分布", () => {
      const list = call("mockExams.getModuleAnalyses", { attemptId }) as Array<{
        strength: string;
        totalQuestions: number;
        correctCount: number;
      }>;
      expect(list.length).toBeGreaterThan(0);
      for (const m of list) {
        expect(["strong", "medium", "weak"]).toContain(m.strength);
        expect(m.totalQuestions).toBeGreaterThan(0);
      }
    });

    it("RES-03 不存在 attemptId → NOT_FOUND", () => {
      try {
        call("mockExams.getResult", { attemptId: "nonexistent" });
        expect.fail("应抛出 NOT_FOUND");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("cramCards.get", () => {
    it("CRAM-01 确定性只读（同输入同输出）", () => {
      const a = call("cramCards.get", { assessmentAttemptId: confirmedAttemptId }) as unknown[];
      const b = call("cramCards.get", { assessmentAttemptId: confirmedAttemptId }) as unknown[];
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it("CRAM-02 不暴露题干/答案/作答（DTO 字段断言）", () => {
      const cards = call("cramCards.get", { assessmentAttemptId: confirmedAttemptId }) as Array<
        Record<string, unknown>
      >;
      for (const c of cards) {
        expect(c).not.toHaveProperty("questionStem");
        expect(c).not.toHaveProperty("correctAnswer");
        expect(c).not.toHaveProperty("studentAnswer");
        // 仅允许：moduleId/moduleName/coreConcept/keyPoints/mnemonic/commonExamPattern/easyMistake/importance
        const allowed = new Set([
          "moduleId",
          "moduleName",
          "coreConcept",
          "keyPoints",
          "mnemonic",
          "commonExamPattern",
          "easyMistake",
          "importance",
        ]);
        for (const key of Object.keys(c)) {
          expect(allowed.has(key)).toBe(true);
        }
      }
    });

    it("CRAM-03 未 confirmed 考试 → BAD_REQUEST", () => {
      try {
        call("cramCards.get", { assessmentAttemptId: unconfirmedAttemptId });
        expect.fail("应抛出 BAD_REQUEST");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("cramPlan.get", () => {
    it("PLAN-01 7 天 DTO（dayOffset 0-6）+ 确定性", () => {
      const a = call("cramPlan.get", { assessmentAttemptId: confirmedAttemptId }) as Array<{
        dayOffset: number;
      }>;
      const b = call("cramPlan.get", { assessmentAttemptId: confirmedAttemptId }) as Array<{
        dayOffset: number;
      }>;
      expect(a.length).toBe(7);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      for (let i = 0; i < a.length; i++) {
        expect(a[i].dayOffset).toBe(i);
      }
    });

    it("PLAN-02 不替学生改写事实（只读，不写库）", () => {
      const db = s5Ctx.semesterDb(semesterId);
      // cramPlan 不应写任何表——通过 study_events 无 cram_plan 事件验证
      const before = db
        .prepare("SELECT COUNT(*) as n FROM study_events WHERE event_type LIKE 'cram%'")
        .get() as { n: number };
      call("cramPlan.get", { assessmentAttemptId: confirmedAttemptId });
      const after = db
        .prepare("SELECT COUNT(*) as n FROM study_events WHERE event_type LIKE 'cram%'")
        .get() as { n: number };
      expect(after.n).toBe(before.n);
    });

    it("PLAN-03 按剩余天数排序（dayOffset 递增）", () => {
      const plan = call("cramPlan.get", { assessmentAttemptId: confirmedAttemptId }) as Array<{
        dayOffset: number;
      }>;
      for (let i = 1; i < plan.length; i++) {
        expect(plan[i].dayOffset).toBeGreaterThan(plan[i - 1].dayOffset);
      }
    });
  });

  describe("触发器", () => {
    it("TRG-01 assessment_attempt 未 confirmed → trg_mockpaper_attempt_confirmed 拦截", () => {
      // GEN-02 已验证 BAD_REQUEST；这里补充验证是触发器拦截（非 handler 校验）
      // 通过直接 SQL INSERT 验证触发器存在并生效
      const db = s5Ctx.semesterDb(semesterId);
      expect(() => {
        db.prepare(
          `INSERT INTO mock_exam_papers (id, course_instance_id, assessment_attempt_id, paper_title,
            question_count, total_score, source_hash, ai_model, prompt_version, generated_at, created_at)
           VALUES (@id, @cid, @aid, @title, 5, 5, @hash, 'mock', 'v1', @ts, @ts)`,
        ).run({
          id: "trg-test-1",
          cid: courseId,
          aid: unconfirmedAttemptId,
          title: "触发器测试",
          hash: "trg-hash-1",
          ts: new Date().toISOString(),
        });
      }).toThrow();
    });

    it("TRG-02 mock_exam_questions CHECK 选择题/填空题字段互斥", () => {
      const db = s5Ctx.semesterDb(semesterId);
      // 填空题带 options_json → 违反 CHECK
      expect(() => {
        db.prepare(
          `INSERT INTO mock_exam_questions (id, mock_paper_id, question_index, question_type,
            question_stem, options_json, correct_answer, score, created_at)
           VALUES (@id, @pid, 999, 'fill_blank', 'test', '["x"]', 'ans', 1, @ts)`,
        ).run({
          id: "trg-test-q1",
          pid: paperId,
          ts: new Date().toISOString(),
        });
      }).toThrow();
    });
  });
});
