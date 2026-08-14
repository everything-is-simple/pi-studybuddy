/**
 * E2E-04 期末冲刺全链（08-Test §6.1）
 *
 * 流程：专用真实 SQLite 测试数据库（S1/S2/S5 prerequisite）→ confirmed 考试
 * → 生成模拟卷 → 限时作答 → 批改 → 查看弱项分析 → 速背卡 → 冲刺计划
 *
 * 重点：本用例不通过 test.* RPC 或 handler 内置 seed 写入业务数据。样本课程、资料、
 * 知识模块、已确认/未确认考试在启动真实 Electron 前构建到独立数据库；Electron 进程仅经
 * 正式 handler 读取和写入该数据库。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { launchElectron, type LaunchedApp } from "./helpers/electron-launcher";
import { RpcDriver } from "./helpers/rpc-driver";
import { prepareSprintTestDatabase, type SprintTestDatabaseFixture } from "../helpers/test-database";
import { assertNoLeakage, isRpcError } from "./helpers/fixtures";
import type {
  MockExamPaper,
  MockExamAttempt,
  MockExamResult,
  MockExamModuleAnalysis,
  CramCard,
  CramPlanDay,
  QuestionDTO,
  Answer,
} from "../../src/contract/types";

const TEST_DATABASE_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-004\\e2e-test-database\\sprint";

describe("E2E-04 期末冲刺全链", () => {
  let app: LaunchedApp;
  let rpc: RpcDriver;
  let fixture: SprintTestDatabaseFixture;
  let paperId: string;
  let attemptId: string;

  beforeAll(async () => {
    fixture = prepareSprintTestDatabase(TEST_DATABASE_ROOT);
    app = await launchElectron("e2e-04", { reuseDataRoot: true, dataRoot: TEST_DATABASE_ROOT });
    expect(app.dataRoot).toBe(TEST_DATABASE_ROOT);
    rpc = new RpcDriver(app.channel);
    await rpc.init();
  }, 60_000);

  afterAll(async () => {
    await app?.dispose();
  });

  /** 按当前本地确定性题目规则构造全对答案；题干和结果均由真实 handler 写入测试 SQLite。 */
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

  it("E04-01 专用测试数据库中的未确认考试生成模拟卷被拒（规则优先 §7.4）", async () => {
    try {
      await rpc.call("mockExams.generatePaper", {
        assessmentAttemptId: fixture.unconfirmedExamId,
        questionCount: 5,
      });
      throw new Error("未确认考试应拒绝生成模拟卷但未拒绝");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as { code: string }).code).toBe("BAD_REQUEST");
    }
  });

  it("E04-02 已确认考试经正式 handler 生成并持久化模拟卷", async () => {
    const paper = await rpc.call<MockExamPaper>("mockExams.generatePaper", {
      assessmentAttemptId: fixture.confirmedExamId,
      questionCount: 5,
    });
    expect(paper.id).toBeTruthy();
    expect(paper.assessmentAttemptId).toBe(fixture.confirmedExamId);
    expect(paper.questionCount).toBe(5);
    expect(paper.totalScore).toBeGreaterThan(0);
    paperId = paper.id;
  });

  it("E04-03 getPaper 作答前不泄露答案", async () => {
    const paper = await rpc.call<MockExamPaper>("mockExams.getPaper", { paperId });
    expect(paper.id).toBe(paperId);
    for (const q of paper.questions) assertNoLeakage(q);
  });

  it("E04-04 startAttempt → in_progress", async () => {
    const attempt = await rpc.call<MockExamAttempt>("mockExams.startAttempt", { paperId });
    expect(attempt.paperId).toBe(paperId);
    expect(attempt.status).toBe("in_progress");
    attemptId = attempt.id;
  });

  it("E04-05 submitAttempt 规则批改全对 → graded + 总分正确", async () => {
    const paper = await rpc.call<MockExamPaper>("mockExams.getPaper", { paperId });
    const result = await rpc.call<MockExamResult>("mockExams.submitAttempt", {
      attemptId,
      answers: buildAllCorrectAnswers(paper.questions),
    });
    expect(result.attemptId).toBe(attemptId);
    expect(result.totalScore).toBe(result.maxScore);
    expect(result.correctCount).toBe(paper.questions.length);
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

  it("E04-07 getResult 读回已持久化的评分结果", async () => {
    const result = await rpc.call<MockExamResult>("mockExams.getResult", { attemptId });
    expect(result.attemptId).toBe(attemptId);
    expect(result.maxScore).toBeGreaterThan(0);
  });

  it("E04-08 getModuleAnalyses 返回专用测试数据库模块的分析", async () => {
    const analyses = await rpc.call<MockExamModuleAnalysis[]>("mockExams.getModuleAnalyses", { attemptId });
    expect(analyses.length).toBeGreaterThan(0);
    expect(analyses.every((analysis) => analysis.moduleId === fixture.moduleId)).toBe(true);
    expect(analyses.every((analysis) => ["strong", "medium", "weak"].includes(analysis.strength))).toBe(true);
  });

  it("E04-09 cramCards / cramPlan 只读计算不依赖外部服务", async () => {
    const cards = await rpc.call<CramCard[]>("cramCards.get", { assessmentAttemptId: fixture.confirmedExamId });
    const plan = await rpc.call<CramPlanDay[]>("cramPlan.get", { assessmentAttemptId: fixture.confirmedExamId });
    expect(Array.isArray(cards)).toBe(true);
    expect(Array.isArray(plan)).toBe(true);
    expect(cards.every((card) => card.moduleId === fixture.moduleId)).toBe(true);
    expect(plan.length).toBeGreaterThan(0);
  });

  it("E04-10 确定性只读调用不写入不同结果", async () => {
    const first = await rpc.call<CramCard[]>("cramCards.get", { assessmentAttemptId: fixture.confirmedExamId });
    const second = await rpc.call<CramCard[]>("cramCards.get", { assessmentAttemptId: fixture.confirmedExamId });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
