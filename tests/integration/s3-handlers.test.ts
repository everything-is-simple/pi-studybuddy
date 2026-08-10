import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import { createGlobalDb } from "../../src/data/global";
import { S3Context, createS3Handlers } from "../../src/agent-host/handlers/s3";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import type { PracticeSession, PracticeResult, QuestionDTO } from "../../src/contract/types";
import type { RpcError } from "../../src/contract/types";
import type { QuestionGenerator } from "../../src/agent-host/handlers/s3/question-generator";
import { createMockQuestionGenerator } from "../../src/agent-host/handlers/s3/question-generator";
import { normalizeText } from "../../src/agent-host/handlers/s3/grader";

/**
 * T-M1-003 S3 handler 集成测试（06-API §3.5 + 07-WF §2.4 + 05-ERD §3.3）
 *
 * 在隔离目录落地真实 SQLite，验证 handler×semester.db 真实读写：
 *   - createSession：questionCount 5-20 CHECK + moduleIds 1-10 校验 + 题型比例分布
 *   - createSession：AI 失败 → 不创建空 session → INTERNAL_ERROR
 *   - getQuestions：作答前 DTO 防泄露（不含 correct_answer/acceptable_answers/explanation）
 *   - submit：规则批改三策略（单选精确/多选 deepEquals/填空 normalize+多等价）
 *   - submit：session 状态机 in_progress→submitted→graded
 *   - submit：已 graded 重复 submit 拒绝（BAD_REQUEST）
 *   - getResult：含逐题正确答案+解析
 *   - listSessions：列表
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-003\。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-003\\integration";

function isRpcError(e: unknown): e is RpcError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}

describe("T-M1-003 S3 handler 集成测试", () => {
  let ctx: S3Context;
  let s1Ctx: S1Context;
  let handlers: ReturnType<typeof createS3Handlers>;
  let s1Handlers: ReturnType<typeof createS1Handlers>;
  let semesterId: string;
  let courseId: string;

  function ensurePracticeModules(params: unknown): void {
    const value = params as { courseId?: string; moduleIds?: string[] };
    if (!value.courseId || !Array.isArray(value.moduleIds)) return;
    const db = ctx.semesterDb(semesterId);
    const now = new Date().toISOString();
    for (const moduleId of value.moduleIds) {
      const materialId = `fixture-material-${moduleId}`;
      db.prepare(
        "INSERT OR IGNORE INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at) VALUES (@materialId, @courseId, 'fixture.pdf', 'pdf', 1, 'application/pdf', @storageKey, 'upload', 'completed', 1, @now, @now, @now)",
      ).run({ materialId, courseId: value.courseId, storageKey: `${materialId}.pdf`, now });
      db.prepare(
        "INSERT OR IGNORE INTO knowledge_modules (id, course_instance_id, material_id, module_name, importance, learn_status, source_evidence_json, ai_generated, created_at, updated_at) VALUES (@moduleId, @courseId, @materialId, @moduleName, 3, 'not_started', '[]', 0, @now, @now)",
      ).run({ moduleId, courseId: value.courseId, materialId, moduleName: `fixture-${moduleId}`, now });
    }
  }

  function call<M extends keyof typeof handlers>(method: M, params: unknown): unknown {
    if (method === "practice.createSession") ensurePracticeModules(params);
    return (handlers[method] as (p: unknown) => unknown)(params);
  }

  function seedModulesForContext(targetCtx: S3Context, targetCourseId: string, moduleIds: string[]): void {
    const db = targetCtx.semesterDb(semesterId);
    const now = new Date().toISOString();
    for (const moduleId of moduleIds) {
      const materialId = `fixture-material-${moduleId}`;
      db.prepare(
        "INSERT OR IGNORE INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at) VALUES (@materialId, @courseId, 'fixture.pdf', 'pdf', 1, 'application/pdf', @storageKey, 'upload', 'completed', 1, @now, @now, @now)",
      ).run({ materialId, courseId: targetCourseId, storageKey: `${materialId}.pdf`, now });
      db.prepare(
        "INSERT OR IGNORE INTO knowledge_modules (id, course_instance_id, material_id, module_name, importance, learn_status, source_evidence_json, ai_generated, created_at, updated_at) VALUES (@moduleId, @courseId, @materialId, @moduleName, 3, 'not_started', '[]', 0, @now, @now)",
      ).run({ moduleId, courseId: targetCourseId, materialId, moduleName: `fixture-${moduleId}`, now });
    }
  }

  function callS1<M extends keyof typeof s1Handlers>(method: M, params: unknown): unknown {
    return (s1Handlers[method] as (p: unknown) => unknown)(params);
  }

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    ctx = new S3Context(ISOLATION_DIR);
    handlers = createS3Handlers(ctx);
    s1Ctx = new S1Context(ISOLATION_DIR);
    s1Handlers = createS1Handlers(s1Ctx);

    const sem = callS1("semesters.create", {
      label: "S3测试学期",
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

  describe("createSession", () => {
    it("CRE-01 成功创建练习会话（status=in_progress）", () => {
      const session = call("practice.createSession", {
        courseId,
        moduleIds: ["mod-1"],
        questionCount: 5,
      }) as PracticeSession;
      expect(session.id).toBeTruthy();
      expect(session.status).toBe("in_progress");
      expect(session.questionCount).toBe(5);
      expect(session.courseId).toBe(courseId);
      expect(session.startedAt).toBeTruthy();
    });

    it("CRE-02 questionCount < 5 → BAD_REQUEST", () => {
      try {
        call("practice.createSession", {
          courseId,
          moduleIds: ["mod-1"],
          questionCount: 4,
        });
        expect.fail("应抛出 BAD_REQUEST");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("CRE-03 questionCount > 20 → BAD_REQUEST", () => {
      try {
        call("practice.createSession", {
          courseId,
          moduleIds: ["mod-1"],
          questionCount: 21,
        });
        expect.fail("应抛出 BAD_REQUEST");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("CRE-04 moduleIds 为空 → BAD_REQUEST", () => {
      try {
        call("practice.createSession", {
          courseId,
          moduleIds: [],
          questionCount: 5,
        });
        expect.fail("应抛出 BAD_REQUEST");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("CRE-05 moduleIds > 10 → BAD_REQUEST", () => {
      try {
        call("practice.createSession", {
          courseId,
          moduleIds: Array.from({ length: 11 }, (_, i) => `mod-${i}`),
          questionCount: 5,
        });
        expect.fail("应抛出 BAD_REQUEST");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("CRE-06 题型分布比例（单选 60%/多选 20%/填空 20%）", () => {
      const session = call("practice.createSession", {
        courseId,
        moduleIds: ["mod-ratio"],
        questionCount: 10,
      }) as PracticeSession;
      const questions = call("practice.getQuestions", { sessionId: session.id }) as QuestionDTO[];
      const singleCount = questions.filter((q) => q.questionType === "single_choice").length;
      const multiCount = questions.filter((q) => q.questionType === "multiple_choice").length;
      const fillCount = questions.filter((q) => q.questionType === "fill_blank").length;
      expect(singleCount).toBe(6); // 60% of 10
      expect(multiCount).toBe(2); // 20% of 10
      expect(fillCount).toBe(2); // remainder
    });

    it("CRE-07 maxScore 正确计算（单选 1 分 + 多选 2 分 + 填空 1 分）", () => {
      const session = call("practice.createSession", {
        courseId,
        moduleIds: ["mod-score"],
        questionCount: 10,
      }) as PracticeSession;
      // 6 single(1) + 2 multi(2) + 2 fill(1) = 6 + 4 + 2 = 12
      expect(session.maxScore).toBe(12);
    });
  });

  describe("AI 失败不创建空 session", () => {
    it("CRE-08 QuestionGenerator 抛异常 → INTERNAL_ERROR + 不创建 session", () => {
      const failGen: QuestionGenerator = {
        generate() {
          throw new Error("LLM connection failed");
        },
      };
      const failCtx = new S3Context(ISOLATION_DIR, failGen);
      const failHandlers = createS3Handlers(failCtx);
      seedModulesForContext(failCtx, courseId, ["fail-mod"]);
      try {
        (failHandlers["practice.createSession"] as (p: unknown) => unknown)({
          courseId,
          moduleIds: ["fail-mod"],
          questionCount: 5,
        });
        expect.fail("应抛出 INTERNAL_ERROR");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("INTERNAL_ERROR");
      }
      // 验证不创建空 session
      const sessions = (failHandlers["practice.listSessions"] as (p: unknown) => unknown)({ courseId }) as PracticeSession[];
      const failSessions = sessions.filter((s) => s.moduleIds.includes("fail-mod"));
      expect(failSessions.length).toBe(0);
      failCtx.dispose();
    });

    it("CRE-09 QuestionGenerator 返回空数组 → INTERNAL_ERROR", () => {
      const emptyGen: QuestionGenerator = {
        generate() {
          return [];
        },
      };
      const emptyCtx = new S3Context(ISOLATION_DIR, emptyGen);
      const emptyHandlers = createS3Handlers(emptyCtx);
      seedModulesForContext(emptyCtx, courseId, ["empty-mod"]);
      try {
        (emptyHandlers["practice.createSession"] as (p: unknown) => unknown)({
          courseId,
          moduleIds: ["empty-mod"],
          questionCount: 5,
        });
        expect.fail("应抛出 INTERNAL_ERROR");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("INTERNAL_ERROR");
      }
      emptyCtx.dispose();
    });
  });

  describe("getQuestions 防泄露", () => {
    it("GETQ-01 作答前 DTO 不含 correct_answer/acceptable_answers/explanation", () => {
      const session = call("practice.createSession", {
        courseId,
        moduleIds: ["leak-mod"],
        questionCount: 5,
      }) as PracticeSession;
      const questions = call("practice.getQuestions", { sessionId: session.id }) as QuestionDTO[];
      expect(questions.length).toBe(5);
      for (const q of questions) {
        // QuestionDTO 只有 id/questionType/questionStem/options/score
        expect(q).toHaveProperty("id");
        expect(q).toHaveProperty("questionType");
        expect(q).toHaveProperty("questionStem");
        expect(q).toHaveProperty("score");
        // 不应包含防泄露字段
        expect(q).not.toHaveProperty("correctAnswer");
        expect(q).not.toHaveProperty("acceptableAnswers");
        expect(q).not.toHaveProperty("explanation");
        expect(q).not.toHaveProperty("correct_answer");
        expect(q).not.toHaveProperty("acceptable_answers");
      }
    });
  });

  describe("submit 规则批改三策略", () => {
    let session: PracticeSession;
    let questions: QuestionDTO[];

    beforeAll(() => {
      session = call("practice.createSession", {
        courseId,
        moduleIds: ["grade-mod"],
        questionCount: 10,
      }) as PracticeSession;
      questions = call("practice.getQuestions", { sessionId: session.id }) as QuestionDTO[];
    });

    it("GRADE-01 单选精确匹配：正确答案 → isCorrect=true", () => {
      const singleQ = questions.find((q) => q.questionType === "single_choice")!;
      // mock 正确答案是 "选项A"
      const result = call("practice.submit", {
        sessionId: session.id,
        answers: [{ questionId: singleQ.id, value: "选项A" }],
      }) as PracticeResult;
      // 只提交了 1 题，但批改了所有题
      const item = result.items.find((i) => i.question.id === singleQ.id);
      expect(item).toBeDefined();
      expect(item!.isCorrect).toBe(true);
    });

    it("GRADE-02 单选精确匹配：错误答案 → isCorrect=false", () => {
      // 需要新 session
      const s = call("practice.createSession", {
        courseId,
        moduleIds: ["grade-mod-2"],
        questionCount: 5,
      }) as PracticeSession;
      const qs = call("practice.getQuestions", { sessionId: s.id }) as QuestionDTO[];
      const singleQ = qs.find((q) => q.questionType === "single_choice")!;
      const result = call("practice.submit", {
        sessionId: s.id,
        answers: [{ questionId: singleQ.id, value: "选项B" }],
      }) as PracticeResult;
      const item = result.items.find((i) => i.question.id === singleQ.id);
      expect(item!.isCorrect).toBe(false);
    });

    it("GRADE-03 多选 deepEquals：顺序不同也正确", () => {
      const s = call("practice.createSession", {
        courseId,
        moduleIds: ["grade-mod-3"],
        questionCount: 5,
      }) as PracticeSession;
      const qs = call("practice.getQuestions", { sessionId: s.id }) as QuestionDTO[];
      const multiQ = qs.find((q) => q.questionType === "multiple_choice")!;
      // mock 正确答案是 ["选项A", "选项B"]，提交反序
      const result = call("practice.submit", {
        sessionId: s.id,
        answers: [{ questionId: multiQ.id, value: ["选项B", "选项A"] }],
      }) as PracticeResult;
      const item = result.items.find((i) => i.question.id === multiQ.id);
      expect(item!.isCorrect).toBe(true);
    });

    it("GRADE-04 多选 deepEquals：部分正确 → isCorrect=false", () => {
      const s = call("practice.createSession", {
        courseId,
        moduleIds: ["grade-mod-4"],
        questionCount: 5,
      }) as PracticeSession;
      const qs = call("practice.getQuestions", { sessionId: s.id }) as QuestionDTO[];
      const multiQ = qs.find((q) => q.questionType === "multiple_choice")!;
      const result = call("practice.submit", {
        sessionId: s.id,
        answers: [{ questionId: multiQ.id, value: ["选项A"] }],
      }) as PracticeResult;
      const item = result.items.find((i) => i.question.id === multiQ.id);
      expect(item!.isCorrect).toBe(false);
    });

    it("GRADE-05 填空 normalize：全角→半角后匹配", () => {
      const s = call("practice.createSession", {
        courseId,
        moduleIds: ["grade-mod-5"],
        questionCount: 5,
      }) as PracticeSession;
      const qs = call("practice.getQuestions", { sessionId: s.id }) as QuestionDTO[];
      const fillQ = qs.find((q) => q.questionType === "fill_blank")!;
      // mock 正确答案是 "正确答案"，提交全角版本
      const result = call("practice.submit", {
        sessionId: s.id,
        answers: [{ questionId: fillQ.id, value: " 正确答案 " }],
      }) as PracticeResult;
      const item = result.items.find((i) => i.question.id === fillQ.id);
      expect(item!.isCorrect).toBe(true);
    });

    it("GRADE-06 填空多等价答案：acceptableAnswers 匹配", () => {
      const s = call("practice.createSession", {
        courseId,
        moduleIds: ["grade-mod-6"],
        questionCount: 5,
      }) as PracticeSession;
      const qs = call("practice.getQuestions", { sessionId: s.id }) as QuestionDTO[];
      const fillQ = qs.find((q) => q.questionType === "fill_blank")!;
      // mock 可接受答案包括 "对的"
      const result = call("practice.submit", {
        sessionId: s.id,
        answers: [{ questionId: fillQ.id, value: "对的" }],
      }) as PracticeResult;
      const item = result.items.find((i) => i.question.id === fillQ.id);
      expect(item!.isCorrect).toBe(true);
    });

    it("GRADE-07 填空 normalize 函数：全角转半角+trim+小写+去多余空格", () => {
      expect(normalizeText(" ＡＢＣ ")).toBe("abc");
      expect(normalizeText("Hello  World")).toBe("hello world");
      expect(normalizeText("Ａ Ｂ")).toBe("a b");
    });
  });

  describe("session 状态机", () => {
    it("STATE-01 submit 后 session status → graded", () => {
      const session = call("practice.createSession", {
        courseId,
        moduleIds: ["state-mod-1"],
        questionCount: 5,
      }) as PracticeSession;
      expect(session.status).toBe("in_progress");

      const result = call("practice.submit", {
        sessionId: session.id,
        answers: [],
      }) as PracticeResult;

      expect(result.sessionId).toBe(session.id);
      // 读回 session 验证状态
      const sessions = call("practice.listSessions", { courseId }) as PracticeSession[];
      const updated = sessions.find((s) => s.id === session.id);
      expect(updated!.status).toBe("graded");
      expect(updated!.gradedAt).toBeTruthy();
      expect(updated!.submittedAt).toBeTruthy();
    });

    it("STATE-02 已 graded 重复 submit → BAD_REQUEST", () => {
      const session = call("practice.createSession", {
        courseId,
        moduleIds: ["state-mod-2"],
        questionCount: 5,
      }) as PracticeSession;
      call("practice.submit", { sessionId: session.id, answers: [] });

      try {
        call("practice.submit", { sessionId: session.id, answers: [] });
        expect.fail("应抛出 BAD_REQUEST");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("STATE-03 submit 写 practice_submitted + practice_graded 事件", () => {
      const session = call("practice.createSession", {
        courseId,
        moduleIds: ["state-mod-3"],
        questionCount: 5,
      }) as PracticeSession;
      call("practice.submit", { sessionId: session.id, answers: [] });

      // 通过 S1Context 查 study_events
      const db = s1Ctx.semesterDb(semesterId);
      const events = db
        .prepare(
          `SELECT * FROM study_events WHERE source_system = 'S3' AND source_ref_id = @sid ORDER BY occurred_at`,
        )
        .all({ sid: session.id }) as Array<{ event_type: string }>;
      const types = events.map((e) => e.event_type);
      expect(types).toContain("practice_submitted");
      expect(types).toContain("practice_graded");
    });
  });

  describe("getResult", () => {
    it("RES-01 含逐题正确答案 + 解析", () => {
      const session = call("practice.createSession", {
        courseId,
        moduleIds: ["res-mod-1"],
        questionCount: 5,
      }) as PracticeSession;
      call("practice.submit", { sessionId: session.id, answers: [] });

      const result = call("practice.getResult", { sessionId: session.id }) as PracticeResult;
      expect(result.items.length).toBe(5);
      for (const item of result.items) {
        expect(item.correctAnswer).toBeDefined();
        expect(item.explanation).toBeTruthy();
      }
    });

    it("RES-02 未批改 session 查看结果 → BAD_REQUEST", () => {
      const session = call("practice.createSession", {
        courseId,
        moduleIds: ["res-mod-2"],
        questionCount: 5,
      }) as PracticeSession;
      try {
        call("practice.getResult", { sessionId: session.id });
        expect.fail("应抛出 BAD_REQUEST");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("listSessions", () => {
    it("LIST-01 按 courseId 过滤列表", () => {
      const sessions = call("practice.listSessions", { courseId }) as PracticeSession[];
      expect(sessions.length).toBeGreaterThan(0);
      for (const s of sessions) {
        expect(s.courseId).toBe(courseId);
      }
    });

    it("LIST-02 无 courseId 返回全部", () => {
      const sessions = call("practice.listSessions", {}) as PracticeSession[];
      expect(sessions.length).toBeGreaterThan(0);
    });
  });

  describe("CHECK 约束（05-ERD §3.3）", () => {
    it("CHECK-01 questionCount CHECK BETWEEN 5 AND 20（数据库层校验）", () => {
      // handler 层已校验 5-20，DB 层 CHECK 也约束
      // 此测试验证 handler 校验先于 DB CHECK 触发
      try {
        call("practice.createSession", {
          courseId,
          moduleIds: ["check-mod"],
          questionCount: 0,
        });
        expect.fail("应抛出 BAD_REQUEST");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("CHECK-02 session status CHECK IN (in_progress, submitted, graded)", () => {
      // 通过正常流程验证 status 只出现这三个值
      const session = call("practice.createSession", {
        courseId,
        moduleIds: ["check-mod-2"],
        questionCount: 5,
      }) as PracticeSession;
      expect(["in_progress", "submitted", "graded"]).toContain(session.status);
    });
  });
});
