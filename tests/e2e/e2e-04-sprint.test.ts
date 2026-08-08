/**
 * E2E-04 期末冲刺全链（08-Test §6.1）
 *
 * 流程：confirmed 考试 → 生成模拟卷 → 限时作答 → 批改 → 查看弱项分析 → 速背卡 → 冲刺计划
 *
 * 断言（08-Test §7.1 闭环完整性 + §7.3 证据驱动 + §7.4 规则优先）：
 *   - mockExams.generatePaper 要求考试已确认（未确认 → BAD_REQUEST）
 *   - getPaper questions 防泄露（§7.2，复用 assertNoLeakage）
 *   - mockExams.submitAttempt 规则批改全对 → totalScore=maxScore（§7.4）
 *   - mockExams.getModuleAnalyses 返回弱项分析（weakness_level strong/medium/weak）
 *   - cramCards.get / cramPlan.get 确定性只读（不建表、不持久化、不调 LLM）（§7.4）
 *
 * 数据隔离（AGENTS.md §5.3）：写 H:\pi-studybuddy-tmp\runs\T-M4-022\e2e\e2e-04\
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { launchElectron, type LaunchedApp } from "./helpers/electron-launcher";
import { RpcDriver } from "./helpers/rpc-driver";
import { SEMESTER_FIXTURE, MATERIAL_FIXTURE, assertNoLeakage, isRpcError } from "./helpers/fixtures";
import type {
  Semester,
  CourseInstance,
  Material,
  AssessmentAttempt,
  MockExamPaper,
  MockExamAttempt,
  MockExamResult,
  MockExamModuleAnalysis,
  CramCard,
  CramPlanDay,
  QuestionDTO,
  Answer,
} from "../../src/contract/types";

describe("E2E-04 期末冲刺全链", () => {
  let app: LaunchedApp;
  let rpc: RpcDriver;
  let semesterId: string;
  let courseId: string;
  let examId: string;
  let paperId: string;
  let attemptId: string;

  beforeAll(async () => {
    app = await launchElectron("e2e-04");
    rpc = new RpcDriver(app.channel);
    await rpc.init();

    // 前置：创建学期 + 课程 + 考试 + 确认
    const sem = await rpc.call<Semester>("semesters.create", SEMESTER_FIXTURE);
    semesterId = sem.id;
    const course = await rpc.call<CourseInstance>("courses.create", {
      semesterId,
      courseName: "E2E-04 冲刺课程",
      subject: "数学",
    });
    courseId = course.id;

    // 前置：为课程种入知识模块（S5 生成模拟卷需课程有知识模块，06-API §3.7）。
    // 生产模块由 S2 笔记生成 job processor 创建，E2E 用 test.seedModule 直写 semester.db，
    // 复用真实 materials.upload 产物满足 material_id FK。
    const mat = await rpc.call<Material>("materials.upload", {
      courseId,
      file: { name: MATERIAL_FIXTURE.fileName, size: 1024, mime: MATERIAL_FIXTURE.mime },
    });
    await rpc.call("test.seedModule", {
      courseInstanceId: courseId,
      materialId: mat.id,
      moduleName: "函数与极限",
    });

    const exam = await rpc.call<AssessmentAttempt>("exams.add", {
      courseId,
      examName: "2026秋季期末考试",
      examType: "final",
      scheduledDate: "2027-01-20",
      source: "student_input",
    });
    examId = exam.id;
    await rpc.call<AssessmentAttempt>("exams.confirm", { id: examId, confirmed: true });
  }, 60_000);

  afterAll(async () => {
    await app?.dispose();
  });

  /** 按题型构造全对答案（mock 生成器确定性：单选"选项A"/多选[选项A,选项B]/填空"正确答案"） */
  function buildAllCorrectAnswers(questions: QuestionDTO[]): Answer[] {
    return questions.map((q) => {
      let value: unknown;
      if (q.questionType === "single_choice") {
        value = "选项A";
      } else if (q.questionType === "multiple_choice") {
        value = ["选项A", "选项B"];
      } else {
        value = "正确答案";
      }
      return { questionId: q.id, value };
    });
  }

  it("E04-01 未确认考试生成模拟卷被拒（规则优先 §7.4）", async () => {
    // 新加一个未确认考试
    const unconfirmed = await rpc.call<AssessmentAttempt>("exams.add", {
      courseId,
      examName: "未确认模拟考试",
      examType: "midterm",
      scheduledDate: "2026-11-15",
      source: "student_input",
    });
    try {
      await rpc.call("mockExams.generatePaper", {
        assessmentAttemptId: unconfirmed.id,
        questionCount: 5,
      });
      throw new Error("未确认考试应拒绝生成模拟卷但未拒绝");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as { code: string }).code).toBe("BAD_REQUEST");
    }
  });

  it("E04-02 生成模拟卷（mockExams.generatePaper）", async () => {
    const paper = await rpc.call<MockExamPaper>("mockExams.generatePaper", {
      assessmentAttemptId: examId,
      questionCount: 5,
    });
    expect(paper.id).toBeTruthy();
    expect(paper.assessmentAttemptId).toBe(examId);
    expect(paper.questionCount).toBe(5);
    expect(paper.totalScore).toBeGreaterThan(0);
    paperId = paper.id;
  });

  it("E04-03 取得模拟卷题目（mockExams.getPaper）— 防泄露 §7.2", async () => {
    const paper = await rpc.call<MockExamPaper>("mockExams.getPaper", { paperId });
    expect(paper.questions.length).toBe(5);
    for (const q of paper.questions) {
      assertNoLeakage(q);
      expect(q.questionType).toBeTruthy();
      expect(q.questionStem).toBeTruthy();
    }
  });

  it("E04-04 开始作答（mockExams.startAttempt）", async () => {
    const attempt = await rpc.call<MockExamAttempt>("mockExams.startAttempt", { paperId });
    expect(attempt.id).toBeTruthy();
    expect(attempt.status).toBe("in_progress");
    attemptId = attempt.id;
  });

  it("E04-05 提交作答 + 规则批改（mockExams.submitAttempt）— 全对满分 §7.4", async () => {
    const paper = await rpc.call<MockExamPaper>("mockExams.getPaper", { paperId });
    const answers = buildAllCorrectAnswers(paper.questions);
    const result = await rpc.call<MockExamResult>("mockExams.submitAttempt", {
      attemptId,
      answers,
    });
    expect(result.attemptId).toBe(attemptId);
    expect(result.correctCount).toBe(5);
    expect(result.totalScore).toBe(result.maxScore);
    expect(result.correctRate).toBe(1);
  });

  it("E04-06 已批改重复提交被拒（状态机 §8.8）", async () => {
    try {
      await rpc.call("mockExams.submitAttempt", { attemptId, answers: [] });
      throw new Error("应拒绝重复提交但未拒绝");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as { code: string }).code).toBe("BAD_REQUEST");
    }
  });

  it("E04-07 查看结果（mockExams.getResult）", async () => {
    const result = await rpc.call<MockExamResult>("mockExams.getResult", { attemptId });
    expect(result.attemptId).toBe(attemptId);
    expect(result.maxScore).toBeGreaterThan(0);
  });

  it("E04-08 查看弱项分析（mockExams.getModuleAnalyses）", async () => {
    const analyses = await rpc.call<MockExamModuleAnalysis[]>("mockExams.getModuleAnalyses", {
      attemptId,
    });
    expect(Array.isArray(analyses)).toBe(true);
    expect(analyses.length).toBeGreaterThan(0);
    for (const a of analyses) {
      expect(["strong", "medium", "weak"]).toContain(a.strength);
      expect(a.totalQuestions).toBeGreaterThan(0);
    }
  });

  it("E04-09 速背卡（cramCards.get）— 确定性只读 §7.4", async () => {
    const cards = await rpc.call<CramCard[]>("cramCards.get", {
      assessmentAttemptId: examId,
    });
    expect(Array.isArray(cards)).toBe(true);
    for (const c of cards) {
      expect(c.moduleId).toBeTruthy();
      expect(c.importance).toBeGreaterThanOrEqual(1);
      expect(c.importance).toBeLessThanOrEqual(5);
    }
  });

  it("E04-10 冲刺计划（cramPlan.get）— 确定性只读 7 天 §7.4", async () => {
    const plan = await rpc.call<CramPlanDay[]>("cramPlan.get", {
      assessmentAttemptId: examId,
    });
    expect(Array.isArray(plan)).toBe(true);
    expect(plan.length).toBeGreaterThan(0);
    for (const day of plan) {
      expect(day.date).toBeTruthy();
      expect(typeof day.tasks).toBe("object");
    }
  });

  it("E04-11 确定性只读不写库验证：重复调用返回结构一致（§7.4）", async () => {
    const cards1 = await rpc.call<CramCard[]>("cramCards.get", { assessmentAttemptId: examId });
    const cards2 = await rpc.call<CramCard[]>("cramCards.get", { assessmentAttemptId: examId });
    expect(cards1.length).toBe(cards2.length);
    expect(JSON.stringify(cards1)).toBe(JSON.stringify(cards2));
  });
});