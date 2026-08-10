/**
 * T-M4-013 RED：PracticeTab 必须接通 S3 既有 RPC。
 *
 * 权威依据：09-UI §4.6、06-API §3.5、08-Test §5.7/§6/§7.2、AGENTS.md §5。
 * 仅使用 happy-dom 与内存 mock，不访问真实业务数据根或外部服务。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type {
  KnowledgeModule,
  PracticeResult,
  PracticeSession,
  QuestionDTO,
} from "../../src/contract/types";
import { PracticeTab } from "../../src/renderer/components/tabs/PracticeTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const fixtureModule: KnowledgeModule = {
  id: "module-1",
  courseId: "course-1",
  materialId: "material-1",
  moduleName: "极限定义",
  summary: "极限的基本定义",
  importance: 5,
  difficulty: 3,
  learnStatus: "not_started",
  sourceEvidenceJson: "{}",
  aiGenerated: 0,
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

const fixtureModuleB: KnowledgeModule = {
  ...fixtureModule,
  id: "module-2",
  moduleName: "导数定义",
};

const fixtureSession: PracticeSession = {
  id: "session-1",
  courseId: "course-1",
  moduleIds: ["module-2"],
  questionCount: 5,
  timeLimit: 600,
  status: "in_progress",
  startedAt: "2026-08-10T00:00:00.000Z",
  createdAt: "2026-08-10T00:00:00.000Z",
};

const fixtureQuestions: QuestionDTO[] = [
  {
    id: "question-1",
    questionType: "single_choice",
    questionStem: "下列哪个是极限的定义？",
    options: ["ε-δ 定义", "牛顿定义"],
    score: 2,
  },
];

const fixtureResult: PracticeResult = {
  sessionId: "session-1",
  totalScore: 2,
  maxScore: 2,
  correctCount: 1,
  elapsedMs: 12_000,
  items: [
    {
      question: fixtureQuestions[0],
      isCorrect: true,
      correctAnswer: "ε-δ 定义",
      explanation: "ε-δ 定义是极限的严格数学定义",
      practiceAnswerId: "answer-1",
    },
  ],
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

function findSelect(host: HTMLDivElement): HTMLSelectElement {
  const element = host.querySelector('select[aria-label="选择知识模块"]');
  if (!(element instanceof HTMLSelectElement)) throw new Error("知识模块选择器不存在");
  return element;
}

function findButton(host: HTMLDivElement, label: string): HTMLButtonElement {
  const element = Array.from(host.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(label));
  if (!(element instanceof HTMLButtonElement)) throw new Error(`按钮不存在: ${label}`);
  return element;
}

describe("T-M4-013 PracticeTab RPC 接线", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("明确选择模块后创建会话并读取作答前题目，且不泄露答案字段", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "modules.list": () => [fixtureModule, fixtureModuleB],
      "practice.createSession": (params: unknown) => {
        calls.push({ method: "practice.createSession", params });
        return fixtureSession;
      },
      "practice.getQuestions": (params: unknown) => {
        calls.push({ method: "practice.getQuestions", params });
        return fixtureQuestions;
      },
    });

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(PracticeTab, { rpc, courseId: "course-1" })));
    await flush();

    expect(findSelect(host).value).toBe("");
    expect(host.textContent).toContain("选择知识模块");
    expect(calls).toEqual([]);

    await act(async () => {
      findSelect(host).value = "module-2";
      findSelect(host).dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    await act(async () => findButton(host!, "开始练习").click());
    await flush();

    expect(calls).toContainEqual({
      method: "practice.createSession",
      params: expect.objectContaining({
        courseId: "course-1",
        moduleIds: ["module-2"],
      }),
    });
    const createParams = calls.find((call) => call.method === "practice.createSession")?.params as { questionCount: number };
    expect(createParams.questionCount).toBeGreaterThanOrEqual(5);
    expect(createParams.questionCount).toBeLessThanOrEqual(20);
    expect(calls).toContainEqual({ method: "practice.getQuestions", params: { sessionId: "session-1" } });
    expect(host.textContent).toContain("下列哪个是极限的定义？");
    expect(host.innerHTML).not.toContain("correct_answer");
    expect(host.innerHTML).not.toContain("acceptable_answers");
    expect(host.innerHTML).not.toContain("explanation");
    expect(host.textContent).not.toContain("正确答案");
  });

  it("提交答案后才读取并展示练习结果，重复提交被阻止", async () => {
    const submit = vi.fn(() => fixtureResult);
    const getResult = vi.fn(() => fixtureResult);
    const rpc = createMockRpcClient({
      "modules.list": () => [fixtureModule, fixtureModuleB],
      "practice.createSession": () => fixtureSession,
      "practice.getQuestions": () => fixtureQuestions,
      "practice.submit": (params: unknown) => {
        submit(params);
        return fixtureResult;
      },
      "practice.getResult": (params: unknown) => {
        getResult(params);
        return fixtureResult;
      },
    });

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(PracticeTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => {
      findSelect(host!).value = "module-1";
      findSelect(host!).dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
    await act(async () => findButton(host!, "开始练习").click());
    await flush();

    const answer = host.querySelector('input[aria-label="题目 1 选项 A"]');
    expect(answer).toBeInstanceOf(HTMLInputElement);
    await act(async () => (answer as HTMLInputElement).click());
    await act(async () => findButton(host!, "提交").click());
    await flush();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      sessionId: "session-1",
      answers: [{ questionId: "question-1", value: "ε-δ 定义" }],
    });
    expect(getResult).toHaveBeenCalledTimes(1);
    expect(getResult).toHaveBeenCalledWith({ sessionId: "session-1" });
    expect(host.textContent).toContain("正确答案");
    expect(host.textContent).toContain("ε-δ 定义是极限的严格数学定义");

    const submitButton = findButton(host, "提交");
    expect(submitButton.disabled).toBe(true);
    await act(async () => submitButton.click());
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("practice.timer payload 更新计时器，超时后仍可提交", async () => {
    let timerCallback: ((payload: unknown) => void) | undefined;
    const rpc = {
      call: vi.fn((method: string) => {
        switch (method) {
          case "modules.list": return Promise.resolve([fixtureModule, fixtureModuleB]);
          case "practice.createSession": return Promise.resolve(fixtureSession);
          case "practice.getQuestions": return Promise.resolve(fixtureQuestions);
          default: return Promise.reject({ code: "UNKNOWN_METHOD", message: method });
        }
      }),
      subscribe: vi.fn((_topic: string, _key: string | undefined, on: (payload: unknown) => void) => {
        timerCallback = on;
        return () => { timerCallback = undefined; };
      }),
      dispose: vi.fn(),
    };

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(PracticeTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => {
      findSelect(host!).value = "module-2";
      findSelect(host!).dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => findButton(host!, "开始练习").click());
    await flush();

    expect(rpc.subscribe).toHaveBeenCalledWith("practice.timer", "session-1", expect.any(Function));
    expect(timerCallback).toBeTypeOf("function");
    await act(async () => timerCallback?.({ sessionId: "session-1", elapsedMs: 120_000, remainingMs: 480_000 }));
    expect(host.textContent).toContain("08:00");
    await act(async () => timerCallback?.({ sessionId: "session-1", elapsedMs: 600_000, remainingMs: 0 }));
    expect(host.textContent).toContain("已超时");
    expect(findButton(host, "提交").disabled).toBe(false);
  });

  it("作答前即使 runtime payload 带敏感字段值，字段值也不进入 DOM", async () => {
    const unsafeQuestion = {
      ...fixtureQuestions[0],
      correct_answer: "SECRET_CORRECT_VALUE",
      acceptable_answers: ["SECRET_ACCEPTABLE_VALUE"],
      explanation: "SECRET_EXPLANATION_VALUE",
    } as unknown as QuestionDTO;
    const rpc = createMockRpcClient({
      "modules.list": () => [fixtureModule, fixtureModuleB],
      "practice.createSession": () => fixtureSession,
      "practice.getQuestions": () => [unsafeQuestion],
    });

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(PracticeTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => {
      findSelect(host!).value = "module-2";
      findSelect(host!).dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => findButton(host!, "开始练习").click());
    await flush();

    expect(host.innerHTML).not.toContain("SECRET_CORRECT_VALUE");
    expect(host.innerHTML).not.toContain("SECRET_ACCEPTABLE_VALUE");
    expect(host.innerHTML).not.toContain("SECRET_EXPLANATION_VALUE");
    expect(host.innerHTML).not.toContain("correct_answer");
    expect(host.innerHTML).not.toContain("acceptable_answers");
    expect(host.innerHTML).not.toContain("explanation");
  });

  it("submit 成功但 getResult 首次失败时只重试 getResult，不重复提交", async () => {
    let resultCalls = 0;
    let submitCalls = 0;
    const rpc = createMockRpcClient({
      "modules.list": () => [fixtureModule, fixtureModuleB],
      "practice.createSession": () => fixtureSession,
      "practice.getQuestions": () => fixtureQuestions,
      "practice.submit": () => {
        submitCalls += 1;
        return fixtureResult;
      },
      "practice.getResult": () => {
        resultCalls += 1;
        if (resultCalls === 1) return Promise.reject({ code: "TEMPORARY", message: "暂时失败" });
        return fixtureResult;
      },
    });

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(PracticeTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => {
      findSelect(host!).value = "module-2";
      findSelect(host!).dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => findButton(host!, "开始练习").click());
    await flush();
    await act(async () => findButton(host!, "提交").click());
    await flush();

    expect(submitCalls).toBe(1);
    expect(resultCalls).toBe(1);
    expect(host.textContent).toContain("读取练习结果");
    const retryButton = findButton(host, "重试读取结果");
    await act(async () => retryButton.click());
    await flush();
    expect(submitCalls).toBe(1);
    expect(resultCalls).toBe(2);
    expect(host.textContent).toContain("正确答案");
  });

  it("课程切换后延迟的旧 createSession/getQuestions 响应不能写回当前练习", async () => {
    const delayedSession = deferred<PracticeSession>();
    const rpc = createMockRpcClient({
      "modules.list": (params: unknown) => (params as { courseId: string }).courseId === "course-1" ? [fixtureModule] : [{ ...fixtureModule, id: "module-2", courseId: "course-2", moduleName: "导数" }],
      "practice.createSession": () => delayedSession.promise,
      "practice.getQuestions": () => fixtureQuestions,
    });

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(PracticeTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => {
      findSelect(host!).value = "module-1";
      findSelect(host!).dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => findButton(host!, "开始练习").click());
    await act(async () => root?.render(React.createElement(PracticeTab, { rpc, courseId: "course-2" })));
    await flush();
    delayedSession.resolve(fixtureSession);
    await flush();

    expect(findSelect(host).value).toBe("");
    expect(host.textContent).toContain("导数");
    expect(host.textContent).not.toContain("下列哪个是极限的定义？");
  });

  it("RPC 原始路径和错误栈不会进入 DOM", async () => {
    const rawError = "Error: C:\\student\\private\\secret.ts\n    at hidden (C:\\student\\private\\secret.ts:1:1)";
    const rpc = createMockRpcClient({
      "modules.list": () => [fixtureModule, fixtureModuleB],
      "practice.createSession": () => Promise.reject({ code: "INTERNAL", message: rawError }),
    });

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(PracticeTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => {
      findSelect(host!).value = "module-1";
      findSelect(host!).dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => findButton(host!, "开始练习").click());
    await flush();

    expect(host.textContent).toContain("暂时无法创建练习");
    expect(host.innerHTML).not.toContain(rawError);
    expect(host.textContent).not.toContain("C:\\student");
  });

  it("归档课程为只读时不允许创建练习", async () => {
    const createSession = vi.fn(() => fixtureSession);
    const rpc = createMockRpcClient({
      "modules.list": () => [fixtureModule, fixtureModuleB],
      "practice.createSession": createSession,
    });

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(PracticeTab, {
      rpc,
      courseId: "course-1",
      academicContext: { courseId: "course-1", semesterId: "semester-1", isReadOnly: true },
    })));
    await flush();

    expect(host.textContent).toContain("只读");
    const select = findSelect(host);
    await act(async () => {
      select.value = "module-1";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
    await act(async () => findButton(host!, "开始练习").click());
    expect(createSession).not.toHaveBeenCalled();
  });
});
