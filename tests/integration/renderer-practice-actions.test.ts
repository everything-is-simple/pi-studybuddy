/**
 * T-M5-004 RED：S3 练习（CTRL-PRACTICE-06 结果页加入错题 + 静态空态按钮可达性）。
 *
 * 权威依据：09-UI §4.6（练习结果）+ T-M5-004 prompt §4.4（S3：提交/结果/失败重试/
 * 重复点击防线）+ T-M5-001 Review A P1（empty/static 兼容分支渲染无 production action
 * 的命令按钮必须检查可达性或移除）。
 *
 * 现状缺口（T-M5-001 G-P1-04/S3-03）：ResultView 只显示结果，无「加入错题」按钮；
 * IdlePhase 静态分支渲染无 onClick 的「开始练习」按钮。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { KnowledgeModule, PracticeResult, PracticeSession, QuestionDTO } from "../../src/contract/types";
import { PracticeTab } from "../../src/renderer/components/tabs/PracticeTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function question(id: string, stem: string): QuestionDTO {
  return { id, questionType: "single_choice", questionStem: stem, options: ["A", "B"], score: 5 };
}

function session(): PracticeSession {
  return {
    id: "sess-p", courseId: "course-b", moduleIds: ["mod-a"], questionCount: 1, status: "graded",
    startedAt: "2026-08-09T00:00:00.000Z", createdAt: "2026-08-09T00:00:00.000Z",
  };
}

function result(practiceAnswerId?: string): PracticeResult {
  return {
    sessionId: "sess-p", totalScore: 0, maxScore: 5, correctCount: 0, elapsedMs: 1000,
    gradedAt: "2026-08-09T00:00:00.000Z",
    items: [{ question: question("q-a", "第一题题干"), isCorrect: false, correctAnswer: "A", explanation: "解析", practiceAnswerId }],
  };
}

function moduleItem(id: string, courseId: string, moduleName: string): KnowledgeModule {
  return {
    id, courseId, materialId: "mat-a", moduleName, summary: "摘要", importance: 3, difficulty: 3,
    learnStatus: "learning", sourceEvidenceJson: "{}", aiGenerated: 1,
    createdAt: "2026-08-09T00:00:00.000Z", updatedAt: "2026-08-09T00:00:00.000Z",
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

describe("T-M5-004 CTRL-PRACTICE 加入错题与静态按钮", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("RED 1: 静态空态分支不再渲染无 action 的「开始练习」按钮", () => {
    // 无 rpc 的静态分支（IdlePhase）不得展示命令式但无动作的按钮（Review A P1）
    const html = renderToStaticMarkup(React.createElement(PracticeTab, {}));
    expect(html).toContain("练习");
    expect(html).not.toContain("<button");
  });

  it("RED 2: 静态结果视图「加入错题」按钮为禁用态（无 rpc 不冒充可点击）", () => {
    // 无 rpc 的静态结果分支：按钮存在但 disabled，避免无 action 可点击按钮（Review A P1）
    const html = renderToStaticMarkup(React.createElement(PracticeTab, {
      session: session(),
      questions: [question("q-a", "第一题题干")],
      result: result("pa-1"),
      phase: "result",
    }));
    expect(html).toContain("第一题题干");
    expect(html).toContain("加入错题");
    // disabled 按钮不得可点击
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("RED 3: 运行时结果页错误题目「加入错题」按钮可点击，调用 mistakes.archive({practiceAnswerId})", async () => {
    const archiveCalls: Array<{ practiceAnswerId: string }> = [];
    const rpc = createMockRpcClient({
      "modules.list": () => [moduleItem("mod-a", "course-b", "极限与连续")],
      "practice.createSession": () => session(),
      "practice.getQuestions": () => [question("q-a", "第一题题干")],
      "practice.submit": () => undefined,
      "practice.getResult": () => result("pa-1"),
      "mistakes.archive": (params: unknown) => {
        archiveCalls.push(params as { practiceAnswerId: string });
        return { id: "mist-1", questionId: "q-a", courseId: "course-b", status: "needs_review", redoCount: 0, createdAt: "2026-08-09T00:00:00.000Z", updatedAt: "2026-08-09T00:00:00.000Z" };
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(PracticeTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b" },
    })));
    await flush();

    // 选择模块
    const moduleSelect = host.querySelector<HTMLSelectElement>("#practice-module");
    expect(moduleSelect, "应渲染模块选择器").toBeTruthy();
    await act(async () => {
      moduleSelect!.value = "mod-a";
      moduleSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    // 开始练习
    const startButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("开始练习"));
    expect(startButton, "应渲染开始练习按钮").toBeTruthy();
    await act(async () => startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();

    // 作答：选择选项 A
    const radio = host.querySelector<HTMLInputElement>('input[type="radio"]');
    expect(radio, "应渲染单选题选项").toBeTruthy();
    await act(async () => {
      radio!.checked = true;
      radio!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    // 提交
    const submitButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("提交"));
    await act(async () => submitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();

    // 结果页：加入错题
    expect(host.textContent).toContain("练习结果");
    const archiveButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("加入错题"));
    expect(archiveButton, "结果页错误题目应有「加入错题」按钮").toBeTruthy();
    await act(async () => archiveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();

    expect(archiveCalls).toEqual([{ practiceAnswerId: "pa-1" }]);
  });

  it("RED 4: 加入错题失败显示固定中文错误且不泄漏异常", async () => {
    const rpc = createMockRpcClient({
      "modules.list": () => [moduleItem("mod-a", "course-b", "极限与连续")],
      "practice.createSession": () => session(),
      "practice.getQuestions": () => [question("q-a", "第一题题干")],
      "practice.submit": () => undefined,
      "practice.getResult": () => result("pa-1"),
      "mistakes.archive": () => Promise.reject(new Error("archive leak /x stack")),
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(PracticeTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b" },
    })));
    await flush();

    const moduleSelect = host.querySelector<HTMLSelectElement>("#practice-module");
    await act(async () => {
      moduleSelect!.value = "mod-a";
      moduleSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
    const startButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("开始练习"));
    await act(async () => startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();
    const radio = host.querySelector<HTMLInputElement>('input[type="radio"]');
    await act(async () => {
      radio!.checked = true;
      radio!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
    const submitButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("提交"));
    await act(async () => submitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();

    const archiveButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("加入错题"));
    await act(async () => archiveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();

    expect(host.textContent).toContain("加入错题失败");
    expect(host.textContent).not.toContain("archive leak");
    expect(host.textContent).not.toContain("/x");
  });
});
