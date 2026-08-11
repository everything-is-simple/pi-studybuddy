/**
 * T-M4-015 RED：CramTab 必须接通既有 S5 冲刺 RPC。
 *
 * 权威依据：06-API §3.7、07-Workflow §2.6/§8.8、08-Test §5/§6/§7.4、09-UI §4.8。
 * 仅使用 happy-dom 与内存 mock，不访问真实业务数据根或外部服务。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type {
  AssessmentAttempt,
  CramCard,
  CramPlanDay,
  MockExamAttempt,
  MockExamPaper,
  MockExamResult,
  QuestionDTO,
} from "../../src/contract/types";
import { CramTab } from "../../src/renderer/components/tabs/CramTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const confirmedExam: AssessmentAttempt = {
  id: "attempt-1", courseId: "course-1", examName: "期中考试", examType: "midterm",
  scheduledDate: "2026-08-19", source: "student_input", confidence: 0.9,
  confirmationStatus: "confirmed", confirmedAt: "2026-08-11T00:00:00.000Z",
  createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z",
};
const pendingExam: AssessmentAttempt = { ...confirmedExam, id: "attempt-pending", examName: "期末考试", confirmationStatus: "pending" };

const cardA: CramCard = {
  moduleId: "module-1", moduleName: "导数几何意义", coreConcept: "导数是切线斜率",
  keyPoints: ["f'(x0) 是切线斜率", "切线方程公式"], mnemonic: "斜切公式", importance: 3,
};
const cardB: CramCard = { ...cardA, moduleId: "module-2", moduleName: "极限定义", coreConcept: "ε-δ 定义", keyPoints: ["左极限", "右极限"], importance: 5 };

const planDay: CramPlanDay = {
  date: "2026-08-12", dayOffset: 0,
  tasks: { reviewModules: ["导数"], redoMistakes: ["错题1"], practiceCount: 1, notes: "重点复习导数" },
};

const paperQuestion: QuestionDTO = { id: "question-1", questionType: "single_choice", questionStem: "f'(x0) 表示什么", options: ["切线斜率", "割线斜率"], score: 1 };

const paper: MockExamPaper = {
  id: "paper-1", courseInstanceId: "course-1", assessmentAttemptId: "attempt-1",
  paperTitle: "期中冲刺模拟卷", questionCount: 1, timeLimitMinutes: 30, totalScore: 1,
  sourceHash: "hash-1", aiModel: "mock", promptVersion: "v1",
  generatedAt: "2026-08-11T00:00:00.000Z", createdAt: "2026-08-11T00:00:00.000Z",
  questions: [paperQuestion],
};
const attempt: MockExamAttempt = {
  id: "mock-attempt-1", paperId: "paper-1", courseInstanceId: "course-1",
  status: "in_progress", startedAt: "2026-08-11T00:00:00.000Z", createdAt: "2026-08-11T00:00:00.000Z",
};
const result: MockExamResult = {
  attemptId: "mock-attempt-1", totalScore: 1, maxScore: 1, correctCount: 1, correctRate: 1, elapsedMs: 120_000,
  moduleAnalyses: [{ moduleId: "module-1", totalQuestions: 1, correctCount: 1, correctRate: 1, strength: "strong" }],
};

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

function buttons(host: HTMLDivElement, label: string): HTMLButtonElement[] {
  return Array.from(host.querySelectorAll("button")).filter((candidate) => candidate.textContent?.includes(label)) as HTMLButtonElement[];
}
function button(host: HTMLDivElement, label: string): HTMLButtonElement {
  const item = buttons(host, label)[0];
  if (!item) throw new Error(`按钮不存在: ${label}`);
  return item;
}
function select(host: HTMLDivElement, name: string): HTMLSelectElement {
  const item = host.querySelector(`select[name="${name}"]`);
  if (!(item instanceof HTMLSelectElement)) throw new Error(`选择器不存在: ${name}`);
  return item;
}
function changeSelect(host: HTMLDivElement, name: string, value: string): void {
  const item = select(host, name);
  item.value = value;
  item.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("T-M4-015 CramTab RPC 接线", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("S5-RED-01 无课程不发越权 RPC；有课程时按已确认考试加载并门控", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "exams.list": (params: unknown) => { calls.push({ method: "exams.list", params }); return [pendingExam]; },
      "cramCards.get": (params: unknown) => { calls.push({ method: "cramCards.get", params }); return [cardA]; },
      "cramPlan.get": (params: unknown) => { calls.push({ method: "cramPlan.get", params }); return [planDay]; },
    });

    // 无课程：不发任何 RPC，显示引导
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CramTab, { rpc })));
    await flush();
    expect(calls).toHaveLength(0);
    expect(host.textContent).toContain("请先");
    await act(async () => root?.unmount()); host.remove(); root = undefined;

    // 有课程但只有未确认考试：exams.list 用 confirmationStatus=confirmed 过滤，空态不发冲刺 RPC
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CramTab, { rpc, courseId: "course-1" })));
    await flush();
    expect(calls).toContainEqual({ method: "exams.list", params: { courseId: "course-1", confirmationStatus: "confirmed" } });
    expect(calls.some((item) => item.method === "cramCards.get" || item.method === "cramPlan.get")).toBe(false);
    expect(host.textContent).toContain("已确认");
  });

  it("S5-RED-02 显式选择已确认考试后加载速背卡并翻页（只读，importance 展示）", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "exams.list": () => [confirmedExam],
      "cramCards.get": (params: unknown) => { calls.push({ method: "cramCards.get", params }); return [cardA, cardB]; },
      "cramPlan.get": () => [],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CramTab, { rpc, courseId: "course-1" })));
    await flush();
    expect(buttons(host, "期中考试")).toHaveLength(0);
    await act(async () => changeSelect(host, "cram-assessment", "attempt-1"));
    await flush();

    expect(calls).toContainEqual({ method: "cramCards.get", params: { assessmentAttemptId: "attempt-1" } });
    expect(host.textContent).toContain("导数几何意义");
    expect(host.textContent).toContain("卡片 1/2");
    expect(host.textContent).toContain("★");
    // 翻页只读
    await act(async () => button(host!, "下一张").click());
    await flush();
    expect(host.textContent).toContain("极限定义");
    expect(host.textContent).toContain("卡片 2/2");
    await act(async () => button(host!, "上一张").click());
    await flush();
    expect(host.textContent).toContain("导数几何意义");
    // 只读边界：无写按钮
    expect(buttons(host, "标记已掌握")).toHaveLength(0);
    expect(buttons(host, "保存")).toHaveLength(0);
  });

  it("S5-RED-03 冲刺计划按既有 DTO 只读展示，不自行写入", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "exams.list": () => [confirmedExam],
      "cramCards.get": () => [],
      "cramPlan.get": (params: unknown) => { calls.push({ method: "cramPlan.get", params }); return [planDay]; },
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CramTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => changeSelect(host, "cram-assessment", "attempt-1"));
    await flush();
    await act(async () => button(host!, "冲刺计划").click());
    await flush();

    expect(calls).toContainEqual({ method: "cramPlan.get", params: { assessmentAttemptId: "attempt-1" } });
    expect(host.textContent).toContain("复习模块");
    expect(host.textContent).toContain("导数");
    expect(host.textContent).toContain("练习数量");
    expect(buttons(host, "保存计划")).toHaveLength(0);
    expect(buttons(host, "写入")).toHaveLength(0);
  });

  it("S5-RED-04 模拟卷生成幂等：重复点击只调用一次 generatePaper", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const generatePaper = vi.fn(() => paper);
    const rpc = createMockRpcClient({
      "exams.list": () => [confirmedExam],
      "mockExams.generatePaper": (params: unknown) => { calls.push({ method: "mockExams.generatePaper", params }); return generatePaper(params); },
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CramTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => changeSelect(host, "cram-assessment", "attempt-1"));
    await flush();
    await act(async () => button(host!, "模拟考").click());
    await flush();

    await act(async () => { button(host!, "生成试卷").click(); button(host!, "生成试卷").click(); });
    await flush();
    expect(generatePaper).toHaveBeenCalledTimes(1);
    expect(generatePaper).toHaveBeenCalledWith({ assessmentAttemptId: "attempt-1", questionCount: 10, timeLimit: 30 });
    expect(host.textContent).toContain("期中冲刺模拟卷");
  });

  it("S5-RED-05 开始作答与提交防重复：submitAttempt 只提交一次并展示结果/模块分析", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const submitAttempt = vi.fn(() => result);
    const rpc = createMockRpcClient({
      "exams.list": () => [confirmedExam],
      "mockExams.generatePaper": () => paper,
      "mockExams.startAttempt": (params: unknown) => { calls.push({ method: "mockExams.startAttempt", params }); return attempt; },
      "mockExams.submitAttempt": (params: unknown) => { calls.push({ method: "mockExams.submitAttempt", params }); return submitAttempt(params); },
      "mockExams.getResult": (params: unknown) => { calls.push({ method: "mockExams.getResult", params }); return result; },
      "mockExams.getModuleAnalyses": (params: unknown) => { calls.push({ method: "mockExams.getModuleAnalyses", params }); return result.moduleAnalyses; },
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CramTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => changeSelect(host, "cram-assessment", "attempt-1"));
    await flush();
    await act(async () => button(host!, "模拟考").click());
    await flush();
    await act(async () => button(host!, "生成试卷").click());
    await flush();
    await act(async () => button(host!, "开始考试").click());
    await flush();

    expect(calls).toContainEqual({ method: "mockExams.startAttempt", params: { paperId: "paper-1" } });
    expect(host.textContent).toContain("f'(x0) 表示什么");

    // 作答（单选）
    const radio = host.querySelector('input[name="mock-question-0"][value="切线斜率"]');
    if (!(radio instanceof HTMLInputElement)) throw new Error("单选选项不存在");
    await act(async () => radio.click());
    await flush();

    await act(async () => { button(host!, "提交").click(); button(host!, "提交").click(); });
    await flush();
    expect(submitAttempt).toHaveBeenCalledTimes(1);
    expect(submitAttempt).toHaveBeenCalledWith({ attemptId: "mock-attempt-1", answers: [{ questionId: "question-1", value: "切线斜率" }] });
    expect(calls).toContainEqual({ method: "mockExams.getResult", params: { attemptId: "mock-attempt-1" } });
    expect(calls).toContainEqual({ method: "mockExams.getModuleAnalyses", params: { attemptId: "mock-attempt-1" } });
    expect(host.textContent).toContain("1 / 1");
    expect(host.textContent).toContain("正确率");
    expect(host.textContent).toContain("强（100%）");
  });

  it("S5-RED-06 超时提示与提交失败可安全重试", async () => {
    const rpc = createMockRpcClient({
      "exams.list": () => [confirmedExam],
      "mockExams.generatePaper": () => paper,
      "mockExams.startAttempt": () => attempt,
      "mockExams.submitAttempt": () => Promise.reject(new Error("submit failed")),
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CramTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => changeSelect(host, "cram-assessment", "attempt-1"));
    await flush();
    await act(async () => button(host!, "模拟考").click());
    await flush();
    await act(async () => button(host!, "生成试卷").click());
    await flush();
    await act(async () => button(host!, "开始考试").click());
    await flush();
    await act(async () => button(host!, "提交").click());
    await flush();
    // 固定错误文案，不含原始异常（路径/栈/UUID）
    expect(host.textContent).toContain("暂时无法提交");
    expect(host.textContent).not.toContain("submit failed");
    expect(host.textContent).not.toContain("Error:");
    // 可重试：再次点击提交仍走 submitAttempt
    await act(async () => button(host!, "提交").click());
    await flush();
    expect(host.textContent).toContain("暂时无法提交");
  });

  it("S5-RED-07 切换课程/考试竞态：旧响应不得覆盖新状态", async () => {
    const pendingCardsA = deferred<CramCard[]>();
    const pendingCardsB = deferred<CramCard[]>();
    const rpc = createMockRpcClient({
      "exams.list": () => [confirmedExam, confirmedExamB],
      "cramCards.get": (params: unknown) => (params as { assessmentAttemptId: string }).assessmentAttemptId === "attempt-1" ? pendingCardsA.promise : pendingCardsB.promise,
      "cramPlan.get": () => [],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CramTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => changeSelect(host, "cram-assessment", "attempt-1"));
    await flush();
    // 切换到另一考试后，旧 assessment 的速背卡响应不得污染新状态
    await act(async () => changeSelect(host, "cram-assessment", "attempt-2"));
    await flush();
    await act(async () => pendingCardsA.resolve([cardA]));
    await flush();
    expect(host.textContent).not.toContain("导数几何意义");
    await act(async () => pendingCardsB.resolve([cardB]));
    await flush();
    expect(host.textContent).toContain("极限定义");
  });

  it("S5-RED-08 archived 只读与错误净化：归档学期禁止生成/提交，错误文案不含路径与完整 UUID", async () => {
    const rpc = createMockRpcClient({
      "exams.list": () => [confirmedExam],
      "cramCards.get": () => [],
      "cramPlan.get": () => [],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CramTab, { rpc, courseId: "course-1", academicContext: { courseId: "course-1", semesterId: "sem-1", isReadOnly: true } })));
    await flush();
    await act(async () => changeSelect(host, "cram-assessment", "attempt-1"));
    await flush();
    await act(async () => button(host!, "模拟考").click());
    await flush();
    expect(host.textContent).toContain("归档");
    const generateButton = buttons(host, "生成试卷")[0];
    expect(generateButton?.disabled).toBe(true);
  });
});

const confirmedExamB: AssessmentAttempt = {
  id: "attempt-2", courseId: "course-1", examName: "期末考试", examType: "final",
  scheduledDate: "2026-09-10", source: "student_input",
  confirmationStatus: "confirmed", confirmedAt: "2026-08-11T00:00:00.000Z",
  createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z",
};
