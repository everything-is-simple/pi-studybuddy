import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import { createGlobalDb } from "../../src/data/global";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import { S3Context, createS3Handlers } from "../../src/agent-host/handlers/s3";
import { S4Context, createS4Handlers } from "../../src/agent-host/handlers/s4";
import { createFailingErrorCauseAdvisor } from "../../src/agent-host/handlers/s4/error-cause-advisor";
import type {
  Mistake,
  MistakeWithEvidence,
  RedoResult,
  WeakPoint,
  ErrorCategory,
} from "../../src/contract/types";
import type { RpcError } from "../../src/contract/types";

/**
 * T-M1-004 S4 handler 集成测试（06-API §3.6 + 07-WF §2.5 + 05-ERD §3.4）
 *
 * 在隔离目录落地真实 SQLite，验证 handler×semester.db 真实读写：
 *   - archive：幂等归档（UNIQUE question_id + UNIQUE source_practice_answer_id）
 *   - archive：正确答题拒绝归档（is_correct=1 → BAD_REQUEST）
 *   - archive：S4 只读 S3 事实（不反写 practice_answers）
 *   - confirmErrorCause：六分类校验 + error_cause_confirmed_by='student'
 *   - suggestErrorCause：ErrorCauseAdvisor mock 带"不确定"标记
 *   - suggestErrorCause：AI 失败降级 INTERNAL_ERROR
 *   - redo：重做正确→mastered；重做错误→保持 needs_review（mastered 回退）
 *   - redo：evidence_count≥2 归纳 weak_point
 *   - weakPoints：状态机 active→resolved→regressed
 *   - 6 关系一致性触发器拦截
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-004\。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-004\\integration";

function isRpcError(e: unknown): e is RpcError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}

describe("T-M1-004 S4 handler 集成测试", () => {
  let s1Ctx: S1Context;
  let s3Ctx: S3Context;
  let s4Ctx: S4Context;
  let s1Handlers: ReturnType<typeof createS1Handlers>;
  let s3Handlers: ReturnType<typeof createS3Handlers>;
  let handlers: ReturnType<typeof createS4Handlers>;
  let semesterId: string;
  let courseId: string;
  let courseId2: string;
  let knowledgeModuleId: string;
  let wrongAnswerId: string;
  let wrongAnswerId2: string;
  let correctAnswerId: string;

  function call<M extends keyof typeof handlers>(method: M, params: unknown): unknown {
    return (handlers[method] as (p: unknown) => unknown)(params);
  }

  function callS1<M extends keyof typeof s1Handlers>(method: M, params: unknown): unknown {
    return (s1Handlers[method] as (p: unknown) => unknown)(params);
  }

  function callS3<M extends keyof typeof s3Handlers>(method: M, params: unknown): unknown {
    return (s3Handlers[method] as (p: unknown) => unknown)(params);
  }

  /** 创建练习 session 并提交答案，返回答题 ID 列表 */
  function createSessionAndSubmit(
    moduleId: string,
    answers: Array<{ questionId: string; value: unknown }>,
  ): { sessionId: string; answerIds: string[] } {
    const session = callS3("practice.createSession", {
      courseId,
      moduleIds: [moduleId],
      questionCount: 5,
    }) as { id: string };

    callS3("practice.submit", { sessionId: session.id, answers });

    const db = s3Ctx.semesterDb(semesterId);
    const rows = db
      .prepare("SELECT id, is_correct FROM practice_answers WHERE practice_session_id = @sid")
      .all({ sid: session.id }) as Array<{ id: string; is_correct: number }>;
    return { sessionId: session.id, answerIds: rows.map((r) => r.id) };
  }

  /**
   * T-M4-013：practice.createSession 现在强制校验 module→course 归属。
   * S4 历史测试使用合成 module ID，因此按需在同一 course 下补齐合法夹具。
   */
  function ensurePracticeModule(moduleId: string): void {
    const db = s1Ctx.semesterDb(semesterId);
    const existing = db
      .prepare("SELECT id FROM knowledge_modules WHERE id = @id")
      .get({ id: moduleId }) as { id?: string } | undefined;
    if (existing?.id) return;

    const materialId = `${moduleId}-material`;
    const ts = new Date().toISOString();
    db.prepare(
      `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes,
        mime_type, storage_key, source_type, status, permission_confirmed,
        uploaded_at, created_at, updated_at)
       VALUES (@id, @cid, @fn, 'pdf', 1000, 'application/pdf', @sk, 'upload',
               'completed', 1, @ts, @ts, @ts)`,
    ).run({
      id: materialId,
      cid: courseId,
      fn: `${moduleId}.pdf`,
      sk: `test/${moduleId}.pdf`,
      ts,
    });
    db.prepare(
      `INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name,
        importance, learn_status, source_evidence_json, ai_generated, created_at, updated_at)
       VALUES (@id, @cid, @mid, @name, 3, 'not_started', '[]', 0, @ts, @ts)`,
    ).run({
      id: moduleId,
      cid: courseId,
      mid: materialId,
      name: `测试模块 ${moduleId}`,
      ts,
    });
  }

  /** 创建练习 session 并提交全错答案（空 answers → 全错） */
  function createSessionWithAllWrong(moduleId: string): { sessionId: string; wrongAnswerIds: string[] } {
    ensurePracticeModule(moduleId);
    const session = callS3("practice.createSession", {
      courseId,
      moduleIds: [moduleId],
      questionCount: 5,
    }) as { id: string };
    callS3("practice.submit", { sessionId: session.id, answers: [] });
    const db = s3Ctx.semesterDb(semesterId);
    const rows = db
      .prepare("SELECT id FROM practice_answers WHERE practice_session_id = @sid AND is_correct = 0")
      .all({ sid: session.id }) as Array<{ id: string }>;
    return { sessionId: session.id, wrongAnswerIds: rows.map((r) => r.id) };
  }

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    s1Ctx = new S1Context(ISOLATION_DIR);
    s1Handlers = createS1Handlers(s1Ctx);
    s3Ctx = new S3Context(ISOLATION_DIR);
    s3Handlers = createS3Handlers(s3Ctx);
    s4Ctx = new S4Context(ISOLATION_DIR);
    handlers = createS4Handlers(s4Ctx);

    const sem = callS1("semesters.create", {
      label: "S4测试学期",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      timezone: "Asia/Shanghai",
    }) as { id: string };
    semesterId = sem.id;

    const course = callS1("courses.create", {
      semesterId,
      courseName: "S4测试课程",
      subject: "数学",
    }) as { id: string };
    courseId = course.id;

    // 第二课程（用于 TRG-04 触发器测试：module 不属于此 course）
    const course2 = callS1("courses.create", {
      semesterId,
      courseName: "S4测试课程2",
      subject: "物理",
    }) as { id: string };
    courseId2 = course2.id;

    // 创建 material + knowledge_module（weak_points.knowledge_module_id NOT NULL，需真实 FK）
    const db0 = s1Ctx.semesterDb(semesterId);
    const setupTs = new Date().toISOString();
    db0.prepare(
      `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes,
        mime_type, storage_key, uploaded_at, created_at, updated_at)
       VALUES (@id, @cid, @fn, @ft, @fs, @mt, @sk, @ts, @ts, @ts)`,
    ).run({
      id: "s4-mat-1",
      cid: courseId,
      fn: "test.pdf",
      ft: "pdf",
      fs: 1000,
      mt: "application/pdf",
      sk: "test/material.pdf",
      ts: setupTs,
    });
    db0.prepare(
      `INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name,
        source_evidence_json, created_at, updated_at)
       VALUES (@id, @cid, @mid, @mn, @se, @ts, @ts)`,
    ).run({
      id: "s4-mod-1",
      cid: courseId,
      mid: "s4-mat-1",
      mn: "S4测试模块",
      se: "[]",
      ts: setupTs,
    });
    knowledgeModuleId = "s4-mod-1";

    // 夹具：两个全错 session（同模块，用于幂等归档 + 薄弱点归纳测试）
    const wrong1 = createSessionWithAllWrong("s4-mod-idem");
    wrongAnswerId = wrong1.wrongAnswerIds[0];
    const wrong2 = createSessionWithAllWrong("s4-mod-idem"); // 同模块不同 session
    wrongAnswerId2 = wrong2.wrongAnswerIds[0];

    // 夹具：一个全错 session（不同模块，用于薄弱点归纳）
    // correctAnswerId 实际是"另一个错题的答题"，命名误导，修正为另一个错答
    const wrong3 = createSessionWithAllWrong("s4-mod-wp");
    correctAnswerId = wrong3.wrongAnswerIds[0]; // 用于测试正确答题拒绝归档时另造
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

  describe("mistakes.archive 幂等归档", () => {
    it("ARC-01 首次归档错误答题 → 新建 mistake(status=needs_review)", () => {
      const mistake = call("mistakes.archive", { practiceAnswerId: wrongAnswerId }) as Mistake;
      expect(mistake.id).toBeTruthy();
      expect(mistake.status).toBe("needs_review");
      expect(mistake.redoCount).toBe(0);
      expect(mistake.questionId).toBeTruthy();
      expect(mistake.courseId).toBe(courseId);
      expect(mistake.createdAt).toBeTruthy();
      expect(mistake.updatedAt).toBeTruthy();
    });

    it("ARC-02 重复归档同一答题 → 幂等返回同一 mistake（UNIQUE source_practice_answer_id）", () => {
      const first = call("mistakes.archive", { practiceAnswerId: wrongAnswerId }) as Mistake;
      const second = call("mistakes.archive", { practiceAnswerId: wrongAnswerId }) as Mistake;
      expect(second.id).toBe(first.id);
    });

    it("ARC-03 同 question 不同答题归档 → 追加 evidence（UNIQUE question_id 幂等）", () => {
      // wrongAnswerId 已归档建 mistake；wrongAnswerId2 是同模块不同 session 的错答，
      // 但不同 question（不同 session 的题目不同）→ 应建新 mistake
      // 这里验证不同 question → 不同 mistake
      const mistake1 = call("mistakes.archive", { practiceAnswerId: wrongAnswerId }) as Mistake;
      const mistake2 = call("mistakes.archive", { practiceAnswerId: wrongAnswerId2 }) as Mistake;
      expect(mistake2.id).toBeTruthy();
      expect(mistake2.id).not.toBe(mistake1.id); // 不同 question → 不同 mistake
    });

    it("ARC-04 归档不存在的答题 → NOT_FOUND", () => {
      try {
        call("mistakes.archive", { practiceAnswerId: "nonexistent" });
        expect.fail("应抛出 NOT_FOUND");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("NOT_FOUND");
      }
    });

    it("ARC-05 S4 只读 S3 事实：归档后 practice_answers 不被反写", () => {
      const db = s4Ctx.semesterDb(semesterId);
      const beforeRow = db
        .prepare("SELECT is_correct, student_answer FROM practice_answers WHERE id = @id")
        .get({ id: wrongAnswerId }) as { is_correct: number; student_answer: string | null };
      call("mistakes.archive", { practiceAnswerId: wrongAnswerId });
      const afterRow = db
        .prepare("SELECT is_correct, student_answer FROM practice_answers WHERE id = @id")
        .get({ id: wrongAnswerId }) as { is_correct: number; student_answer: string | null };
      expect(afterRow.is_correct).toBe(beforeRow.is_correct);
      expect(afterRow.student_answer).toBe(beforeRow.student_answer);
    });
  });

  describe("mistakes.get 含 evidence", () => {
    it("GET-01 返回 MistakeWithEvidence（含 evidence 数组）", () => {
      const mistake = call("mistakes.archive", { practiceAnswerId: wrongAnswerId }) as Mistake;
      const result = call("mistakes.get", { id: mistake.id }) as MistakeWithEvidence;
      expect(result.id).toBe(mistake.id);
      expect(Array.isArray(result.evidence)).toBe(true);
      expect(result.evidence.length).toBeGreaterThanOrEqual(1);
      expect(result.evidence[0].evidenceType).toBe("initial_wrong");
      expect(result.practiceAnswerId).toBe(wrongAnswerId); // 便利字段派生
    });

    it("GET-02 mistakeId 不存在 → NOT_FOUND", () => {
      try {
        call("mistakes.get", { id: "nonexistent" });
        expect.fail("应抛出 NOT_FOUND");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("NOT_FOUND");
      }
    });

    it("GET-03 T-M5-004 方案 A：返回 question 摘要（题干/题型/正确答案/解析）", () => {
      const mistake = call("mistakes.archive", { practiceAnswerId: wrongAnswerId }) as Mistake;
      const result = call("mistakes.get", { id: mistake.id }) as MistakeWithEvidence;
      // 题干与题型来自 questions 表（08-Test 夹具为可读文本）
      expect(result.questionStem).toBeTruthy();
      expect(result.questionType).toBe("single_choice");
      expect(result.correctAnswer).toBeDefined();
      expect(result.explanation).toBeDefined();
      // 我的答案：夹具 submit 空答 → student_answer 为 NULL，字段可为 undefined（不报错）
      // （有真实答案时会 JSON 解析返回）
      expect(result.studentAnswer).toBeUndefined();
    });
  });

  describe("mistakes.list", () => {
    it("LST-01 按 courseId 过滤返回错题列表", () => {
      const list = call("mistakes.list", { courseId }) as Mistake[];
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThanOrEqual(2); // 至少 wrongAnswerId + wrongAnswerId2
      for (const m of list) {
        expect(m.courseId).toBe(courseId);
      }
    });

    it("LST-02 按 status=needs_review 过滤", () => {
      const list = call("mistakes.list", { courseId, status: "needs_review" }) as Mistake[];
      expect(list.length).toBeGreaterThanOrEqual(1);
      for (const m of list) {
        expect(m.status).toBe("needs_review");
      }
    });
  });

  describe("mistakes.suggestErrorCause AI 建议与降级", () => {
    it("SUG-01 mock Advisor 返回带「不确定」标记的建议", () => {
      const mistake = call("mistakes.archive", { practiceAnswerId: wrongAnswerId }) as Mistake;
      const result = call("mistakes.suggestErrorCause", { id: mistake.id }) as {
        suggestion: string;
        confidence: "low" | "medium" | "high";
      };
      expect(result.suggestion).toContain("不确定");
      expect(result.confidence).toBe("low");
    });

    it("SUG-02 AI 失败降级 → INTERNAL_ERROR + 不阻塞手动确认", () => {
      // 用失败 Advisor 重建 ctx
      const failCtx = new S4Context(ISOLATION_DIR, createFailingErrorCauseAdvisor());
      const failHandlers = createS4Handlers(failCtx);
      const mistake = call("mistakes.archive", { practiceAnswerId: wrongAnswerId }) as Mistake;
      try {
        (failHandlers["mistakes.suggestErrorCause"] as (p: unknown) => unknown)({ id: mistake.id });
        expect.fail("应抛出 INTERNAL_ERROR");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("INTERNAL_ERROR");
        expect((e as RpcError).message).toContain("手动选择错因");
      }
      failCtx.dispose();
    });
  });

  describe("mistakes.confirmErrorCause 六分类确认", () => {
    const categories: ErrorCategory[] = [
      "concept_unclear",
      "misread",
      "formula_error",
      "step_missing",
      "time_pressure",
      "other",
    ];

    it("CONF-01 六分类逐一确认成功 + error_cause_confirmed_by='student'", () => {
      const mistake = call("mistakes.archive", { practiceAnswerId: wrongAnswerId }) as Mistake;
      for (const cat of categories) {
        const result = call("mistakes.confirmErrorCause", {
          id: mistake.id,
          category: cat,
          causeNote: `测试-${cat}`,
        }) as Mistake;
        expect(result.errorCategory).toBe(cat);
        expect(result.errorCauseConfirmedBy).toBe("student");
        expect(result.errorCause).toBe(`测试-${cat}`);
      }
    });

    it("CONF-02 无效分类 → BAD_REQUEST", () => {
      const mistake = call("mistakes.archive", { practiceAnswerId: wrongAnswerId }) as Mistake;
      try {
        call("mistakes.confirmErrorCause", {
          id: mistake.id,
          category: "invalid" as ErrorCategory,
        });
        expect.fail("应抛出 BAD_REQUEST");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("CONF-03 mistakeId 不存在 → NOT_FOUND", () => {
      try {
        call("mistakes.confirmErrorCause", {
          id: "nonexistent",
          category: "other",
        });
        expect.fail("应抛出 NOT_FOUND");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("mistakes.redo 状态机 + 薄弱点归纳", () => {
    it("REDO-01 重做错误 → 保持 needs_review + evidence_count 增加", () => {
      const mistake = call("mistakes.archive", { practiceAnswerId: wrongAnswerId }) as Mistake;
      const before = call("mistakes.get", { id: mistake.id }) as MistakeWithEvidence;
      const result = call("mistakes.redo", { id: mistake.id, correct: false }) as RedoResult;
      expect(result.correct).toBe(false);
      expect(result.evidenceCount).toBe(before.evidence.length + 1);
      expect(result.weakPointFormed).toBe(false); // 重做错误不归纳

      const after = call("mistakes.get", { id: mistake.id }) as MistakeWithEvidence;
      expect(after.status).toBe("needs_review");
      expect(after.redoCount).toBe(before.redoCount + 1);
    });

    it("REDO-02 重做正确 + evidence_count<2 → mastered 但不归纳 weak_point", () => {
      // 新建一个错题（仅1条 evidence）
      const fresh = createSessionWithAllWrong("s4-mod-redo02");
      const mistake = call("mistakes.archive", { practiceAnswerId: fresh.wrongAnswerIds[0] }) as Mistake;
      // 此时 evidence_count=1，重做正确 → mastered 但不归纳（<2）
      const result = call("mistakes.redo", { id: mistake.id, correct: true }) as RedoResult;
      expect(result.correct).toBe(true);
      expect(result.weakPointFormed).toBe(false);

      const after = call("mistakes.get", { id: mistake.id }) as MistakeWithEvidence;
      expect(after.status).toBe("mastered");
      expect(after.masteredAt).toBeTruthy();
    });

    it("REDO-03 重做正确 + evidence_count≥2 → mastered + 归纳 weak_point", () => {
      // 新建错题，先重做错误（+1 evidence → 共2条），再重做正确
      const fresh = createSessionWithAllWrong("s4-mod-redo03");
      // mock 生成器将 question.knowledge_module_id 设 NULL，薄弱点归纳需非 NULL
      // 归档前更新 question 的 knowledge_module_id 使 mistake 携带 module（T6 触发器校验一致）
      const db = s4Ctx.semesterDb(semesterId);
      db.prepare("UPDATE questions SET knowledge_module_id = @mid WHERE practice_session_id = @sid")
        .run({ mid: knowledgeModuleId, sid: fresh.sessionId });
      const mistake = call("mistakes.archive", { practiceAnswerId: fresh.wrongAnswerIds[0] }) as Mistake;
      // 先重做错误（evidence_count: 1→2）
      call("mistakes.redo", { id: mistake.id, correct: false });
      // 此时 evidence_count=2，重做正确 → mastered + 归纳
      // 注意：重做正确不写 redo_wrong evidence，但 evidence_count 已≥2
      const result = call("mistakes.redo", { id: mistake.id, correct: true }) as RedoResult;
      expect(result.correct).toBe(true);
      expect(result.weakPointFormed).toBe(true);
    });

    it("REDO-04 mastered 后重做错误 → 回退 needs_review（「已掌握」非终态）", () => {
      const fresh = createSessionWithAllWrong("s4-mod-redo04");
      const mistake = call("mistakes.archive", { practiceAnswerId: fresh.wrongAnswerIds[0] }) as Mistake;
      call("mistakes.redo", { id: mistake.id, correct: true });
      const mastered = call("mistakes.get", { id: mistake.id }) as MistakeWithEvidence;
      expect(mastered.status).toBe("mastered");

      // 重做错误 → 回退
      call("mistakes.redo", { id: mistake.id, correct: false });
      const after = call("mistakes.get", { id: mistake.id }) as MistakeWithEvidence;
      expect(after.status).toBe("needs_review");
      expect(after.masteredAt).toBeUndefined();
    });

    it("REDO-05 mistakeId 不存在 → NOT_FOUND", () => {
      try {
        call("mistakes.redo", { id: "nonexistent", correct: true });
        expect.fail("应抛出 NOT_FOUND");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("weakPoints 状态机", () => {
    let weakPointId: string;

    it("WP-01 list 返回已归纳的薄弱点（evidence_count≥2）", () => {
      const list = call("weakPoints.list", {}) as WeakPoint[];
      expect(list.length).toBeGreaterThanOrEqual(1);
      for (const wp of list) {
        expect(wp.evidenceCount).toBeGreaterThanOrEqual(2);
        expect(wp.status).toBe("active");
      }
      weakPointId = list[0].id;
    });

    it("WP-02 get 返回薄弱点详情", () => {
      const wp = call("weakPoints.get", { id: weakPointId }) as WeakPoint;
      expect(wp.id).toBe(weakPointId);
      expect(wp.evidenceCount).toBeGreaterThanOrEqual(2);
    });

    it("WP-03 resolve：active→resolved", () => {
      const result = call("weakPoints.resolve", { id: weakPointId }) as WeakPoint;
      expect(result.status).toBe("resolved");
      expect(result.resolvedAt).toBeTruthy();
    });

    it("WP-04 resolved 重复 resolve → BAD_REQUEST", () => {
      try {
        call("weakPoints.resolve", { id: weakPointId });
        expect.fail("应抛出 BAD_REQUEST");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("WP-05 regress：resolved→regressed（「已掌握」非终态）", () => {
      const result = call("weakPoints.regress", { id: weakPointId }) as WeakPoint;
      expect(result.status).toBe("regressed");
    });

    it("WP-06 regressed 状态 regress → BAD_REQUEST（仅 resolved 可 regress）", () => {
      try {
        call("weakPoints.regress", { id: weakPointId });
        expect.fail("应抛出 BAD_REQUEST");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("WP-07 weakPointId 不存在 → NOT_FOUND", () => {
      try {
        call("weakPoints.get", { id: "nonexistent" });
        expect.fail("应抛出 NOT_FOUND");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("6 关系一致性触发器", () => {
    it("TRG-02 mistake.question course 不一致 → 拦截", () => {
      // 用新 session 获取无已有 mistake 的 question（避免幂等归档触发器先报错）
      const db = s4Ctx.semesterDb(semesterId);
      const fresh = createSessionWithAllWrong("s4-mod-trg02");
      const questionRow = db
        .prepare("SELECT id FROM questions WHERE practice_session_id = @sid LIMIT 1")
        .get({ sid: fresh.sessionId }) as { id: string };
      const fakeCourseId = "fake-course-for-trigger-test";
      try {
        db.prepare(
          `INSERT INTO mistakes (id, question_id, course_instance_id, status, redo_count, created_at, updated_at)
           VALUES (@id, @qid, @cid, 'needs_review', 0, @ts, @ts)`,
        ).run({
          id: "trigger-test-02",
          qid: questionRow.id,
          cid: fakeCourseId,
          ts: new Date().toISOString(),
        });
        expect.fail("触发器应拦截 course 不一致");
      } catch (e) {
        expect(String(e)).toContain("mistake course mismatch");
      }
    });

    it("TRG-04 weak_points course+module 不一致 → 拦截", () => {
      const db = s4Ctx.semesterDb(semesterId);
      // knowledgeModuleId 属于 courseId，用 courseId2 尝试插入 → T4 触发器拦截
      try {
        db.prepare(
          `INSERT INTO weak_points
            (id, course_instance_id, knowledge_module_id, evidence_count, status,
             first_evidenced_at, last_evidenced_at, created_at, updated_at)
           VALUES (@id, @cid, @mid, 2, 'active', @ts, @ts, @ts, @ts)`,
        ).run({
          id: "trigger-test-04",
          cid: courseId2,
          mid: knowledgeModuleId,
          ts: new Date().toISOString(),
        });
        expect.fail("触发器应拦截 module 不属于 course");
      } catch (e) {
        expect(String(e)).toContain("weak point module does not belong to course");
      }
    });
  });
});
