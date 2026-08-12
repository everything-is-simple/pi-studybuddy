/**
 * T-M5-004 RED：S4 错题（CTRL-MISTAKE-03 重做正确/错误显式化 + 详情失败重试 + 作答历史）。
 *
 * 权威依据：09-UI §4.7（错题详情/复盘）+ T-M5-004 prompt §4.5（重做正确、重做错误、
 * 状态刷新、evidence_count 变化、失败和重试）。
 *
 * 现状缺口（T-M5-001 S4-02/G-P1-04）：mistakes.redo 支持 correct?: boolean，但 UI 只
 * 提供「重做」一个动作（恒 correct=false，无法表达"重做正确"）；详情加载失败无重试；
 * evidence 作答历史未展示。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { Mistake, MistakeWithEvidence, WeakPoint } from "../../src/contract/types";
import { MistakesTab } from "../../src/renderer/components/tabs/MistakesTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mistakeA(): Mistake {
  return {
    id: "mistake-1", questionId: "first-question", courseId: "course-1", status: "needs_review",
    redoCount: 0, createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z",
  };
}

function detailA(): MistakeWithEvidence {
  return {
    ...mistakeA(),
    errorCause: "概念不清",
    errorCauseConfirmedBy: "student",
    errorCauseAiSuggestion: "建议先复习极限定义（仅供参考）",
    practiceAnswerId: "answer-1",
    questionStem: "函数 f(x)=x² 在 x=0 处的极限是？",
    questionType: "single_choice",
    studentAnswer: "B",
    correctAnswer: "A",
    acceptableAnswers: ["A"],
    explanation: "x→0 时 x² 趋近于 0。",
    evidence: [
      { id: "ev-1", mistakeId: "mistake-1", sourcePracticeAnswerId: "answer-1", evidenceType: "initial_wrong", recordedAt: "2026-08-11T00:00:00.000Z", createdAt: "2026-08-11T00:00:00.000Z" },
    ],
  };
}

function weakPoint(): WeakPoint {
  return {
    id: "wp-1", courseId: "course-1", moduleId: "mod-1", status: "active", evidenceCount: 2,
    firstEvidencedAt: "2026-08-11T00:00:00.000Z", lastEvidencedAt: "2026-08-11T00:00:00.000Z",
    createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z",
  };
}

function button(host: HTMLDivElement, text: string): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes(text)) as HTMLButtonElement | undefined;
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

describe("T-M5-004 CTRL-MISTAKE 重做显式化/详情重试/作答历史", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("RED 1: 详情同时提供「重做正确」与「重做错误」两个显式动作", async () => {
    const rpc = createMockRpcClient({
      "mistakes.list": () => [mistakeA()],
      "weakPoints.list": () => [],
      "mistakes.get": () => detailA(),
      "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }),
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => button(host, "查看详情")?.click());
    await flush();

    const redoCorrect = button(host, "重做正确");
    const redoWrong = button(host, "重做错误");
    expect(redoCorrect, "应有「重做正确」按钮").toBeTruthy();
    expect(redoWrong, "应有「重做错误」按钮").toBeTruthy();
  });

  it("RED 2a: 点击「重做正确」调用 mistakes.redo({id, correct:true})", async () => {
    const redo = vi.fn();
    const rpc = createMockRpcClient({
      "mistakes.list": () => [mistakeA()],
      "weakPoints.list": () => [],
      "mistakes.get": () => detailA(),
      "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }),
      "mistakes.redo": (params: unknown) => {
        redo(params);
        return { mistakeId: "mistake-1", correct: (params as { correct: boolean }).correct, evidenceCount: 2, weakPointFormed: false, updatedAt: "2026-08-11T00:00:00.000Z" };
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => button(host, "查看详情")?.click());
    await flush();

    await act(async () => button(host, "重做正确")?.click());
    await flush();
    expect(redo).toHaveBeenCalledWith({ id: "mistake-1", correct: true });
  });

  it("RED 2b: 点击「重做错误」调用 mistakes.redo({id, correct:false})", async () => {
    const redo = vi.fn();
    const rpc = createMockRpcClient({
      "mistakes.list": () => [mistakeA()],
      "weakPoints.list": () => [],
      "mistakes.get": () => detailA(),
      "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }),
      "mistakes.redo": (params: unknown) => {
        redo(params);
        return { mistakeId: "mistake-1", correct: (params as { correct: boolean }).correct, evidenceCount: 2, weakPointFormed: false, updatedAt: "2026-08-11T00:00:00.000Z" };
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => button(host, "查看详情")?.click());
    await flush();

    await act(async () => button(host, "重做错误")?.click());
    await flush();
    expect(redo).toHaveBeenCalledWith({ id: "mistake-1", correct: false });
  });

  it("RED 3: 详情加载失败显示「重试加载详情」并可重试", async () => {
    let getCalls = 0;
    const rpc = createMockRpcClient({
      "mistakes.list": () => [mistakeA()],
      "weakPoints.list": () => [],
      "mistakes.get": () => {
        getCalls += 1;
        if (getCalls === 1) return Promise.reject(new Error("detail boom"));
        return detailA();
      },
      "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }),
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => button(host, "查看详情")?.click());
    await flush();

    expect(host.textContent).toContain("暂时无法加载错题详情");
    const retryButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("重试"));
    expect(retryButton, "详情失败应有重试按钮").toBeTruthy();
    await act(async () => retryButton?.click());
    await flush();
    expect(host.textContent).toContain("已确认错因");
  });

  it("RED 4: 详情展示作答历史（evidence 记录），不使用完整 UUID", async () => {
    const rpc = createMockRpcClient({
      "mistakes.list": () => [mistakeA()],
      "weakPoints.list": () => [],
      "mistakes.get": () => detailA(),
      "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }),
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => button(host, "查看详情")?.click());
    await flush();

    expect(host.textContent).toContain("首次错误");
    expect(host.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("RED 5: 详情展示题干/我的答案/正确答案/解析（完整复盘，方案 A）", async () => {
    const rpc = createMockRpcClient({
      "mistakes.list": () => [mistakeA()],
      "weakPoints.list": () => [],
      "mistakes.get": () => detailA(),
      "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }),
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => button(host, "查看详情")?.click());
    await flush();

    expect(host.textContent).toContain("函数 f(x)=x² 在 x=0 处的极限是？");
    expect(host.textContent).toContain("我的答案");
    expect(host.textContent).toContain("正确答案");
    expect(host.textContent).toContain("x→0 时 x² 趋近于 0。");
  });

  it("RED 6: 复盘内容含敏感路径/UUID 时净化，不进入 DOM", async () => {
    const rpc = createMockRpcClient({
      "mistakes.list": () => [mistakeA()],
      "weakPoints.list": () => [],
      "mistakes.get": () => ({
        ...detailA(),
        questionStem: "题目 C:\\secret\\path 8f8f8f8f-0000-0000-0000-000000000000 泄露",
        explanation: "at stack.js:12 boom",
      }),
      "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }),
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => button(host, "查看详情")?.click());
    await flush();

    expect(host.textContent).not.toContain("secret");
    expect(host.textContent).not.toContain("C:\\");
    expect(host.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(host.textContent).not.toContain("at stack.js");
  });
});
