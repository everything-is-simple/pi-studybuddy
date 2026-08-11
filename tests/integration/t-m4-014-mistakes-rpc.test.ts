/**
 * T-M4-014 RED：MistakesTab 必须接通既有 S4 错题 RPC。
 *
 * 权威依据：06-API §3.6、07-Workflow §2.5/§8.6/§8.7、08-Test §5/§6、09-UI §4.7。
 * 仅使用 happy-dom 与内存 mock，不访问真实业务数据根或外部服务。
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

const mistakeA: Mistake = {
  id: "mistake-1", questionId: "first-question", courseId: "course-1", status: "needs_review", redoCount: 0,
  createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z",
};
const mistakeB: Mistake = { ...mistakeA, id: "mistake-2", questionId: "next-question" };
const detailA: MistakeWithEvidence = {
  ...mistakeA,
  evidence: [{ id: "evidence-1", mistakeId: mistakeA.id, sourcePracticeAnswerId: "answer-1", evidenceType: "initial_wrong", recordedAt: "2026-08-11T00:00:00.000Z", createdAt: "2026-08-11T00:00:00.000Z" }],
};
const detailB: MistakeWithEvidence = { ...detailA, ...mistakeB, evidence: [{ ...detailA.evidence[0], id: "evidence-2", mistakeId: mistakeB.id }] };
const weakPoint: WeakPoint = {
  id: "weak-point-1", courseId: "course-1", moduleId: "module-1", status: "active", evidenceCount: 2,
  firstEvidencedAt: "2026-08-11T00:00:00.000Z", lastEvidencedAt: "2026-08-11T00:00:00.000Z",
  createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z",
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

function category(host: HTMLDivElement, value: string): HTMLInputElement {
  const item = host.querySelector(`input[name="error-category"][value="${value}"]`);
  if (!(item instanceof HTMLInputElement)) throw new Error(`错因选项不存在: ${value}`);
  return item;
}

describe("T-M4-014 MistakesTab RPC 接线", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("以当前 courseId 加载错题和薄弱点；选择错题后读取详情和 AI 建议", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "mistakes.list": (params: unknown) => { calls.push({ method: "mistakes.list", params }); return [mistakeA, mistakeB]; },
      "weakPoints.list": (params: unknown) => { calls.push({ method: "weakPoints.list", params }); return [weakPoint]; },
      "mistakes.get": (params: unknown) => { calls.push({ method: "mistakes.get", params }); return detailA; },
      "mistakes.suggestErrorCause": (params: unknown) => { calls.push({ method: "mistakes.suggestErrorCause", params }); return { suggestion: "可能混淆了定义条件", confidence: "low" as const }; },
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" })));
    await flush();

    expect(calls).toContainEqual({ method: "mistakes.list", params: { courseId: "course-1" } });
    expect(calls).toContainEqual({ method: "weakPoints.list", params: { courseId: "course-1" } });
    expect(buttons(host, "查看详情")).toHaveLength(2);
    await act(async () => buttons(host!, "查看详情")[0].click());
    await flush();
    expect(calls).toContainEqual({ method: "mistakes.get", params: { id: "mistake-1" } });
    expect(calls).toContainEqual({ method: "mistakes.suggestErrorCause", params: { id: "mistake-1" } });
    expect(host.textContent).toContain("AI 建议（仅供参考）");
    expect(host.textContent).toContain("可能混淆了定义条件");
  });

  it("学生明确选择六分类后才确认错因，并防止重复 mutation", async () => {
    const confirm = vi.fn(() => ({ ...mistakeA, errorCategory: "formula_error" as const, errorCauseConfirmedBy: "student" }));
    const rpc = createMockRpcClient({
      "mistakes.list": () => [mistakeA], "weakPoints.list": () => [], "mistakes.get": () => detailA,
      "mistakes.suggestErrorCause": () => ({ suggestion: "仅是建议", confidence: "low" as const }),
      "mistakes.confirmErrorCause": (params: unknown) => confirm(params),
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" }))); await flush();
    await act(async () => button(host!, "查看详情").click()); await flush();
    const choice = category(host, "formula_error");
    await act(async () => choice.click());
    await act(async () => { button(host!, "确认错因").click(); button(host!, "确认错因").click(); });
    await flush();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith({ id: "mistake-1", category: "formula_error" });
    expect(host.textContent).toContain("已确认错因");
  });

  it("重做成功后刷新当前错题和薄弱点，重复点击只提交一次", async () => {
    const pendingRedo = deferred<{ mistakeId: string; correct: boolean; evidenceCount: number; weakPointFormed: boolean; updatedAt: string }>();
    const redo = vi.fn(() => pendingRedo.promise);
    const list = vi.fn(() => [mistakeA]);
    const weakPoints = vi.fn(() => [weakPoint]);
    const rpc = createMockRpcClient({
      "mistakes.list": list, "weakPoints.list": weakPoints, "mistakes.get": () => detailA,
      "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }), "mistakes.redo": () => redo(),
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" }))); await flush();
    await act(async () => button(host!, "查看详情").click()); await flush();
    await act(async () => { button(host!, "重做").click(); button(host!, "重做").click(); });
    expect(redo).toHaveBeenCalledTimes(1);
    await act(async () => pendingRedo.resolve({ mistakeId: "mistake-1", correct: true, evidenceCount: 2, weakPointFormed: true, updatedAt: "2026-08-11T00:00:00.000Z" }));
    await flush(); await flush();
    expect(list.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(weakPoints.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("错题选择竞态时，旧详情响应不能覆盖最新选择", async () => {
    const pendingA = deferred<MistakeWithEvidence>();
    const rpc = createMockRpcClient({
      "mistakes.list": () => [mistakeA, mistakeB], "weakPoints.list": () => [],
      "mistakes.get": (params: unknown) => (params as { id: string }).id === mistakeA.id ? pendingA.promise : detailB,
      "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }),
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" }))); await flush();
    await act(async () => buttons(host!, "查看详情")[0].click());
    await act(async () => buttons(host!, "查看详情")[1].click()); await flush();
    pendingA.resolve(detailA); await flush();
    expect(host.textContent).toContain("next-que");
    expect(host.textContent).not.toContain("first-qu");
  });

  it("课程列表切换时，旧列表响应不能覆盖当前课程", async () => {
    const pendingCourseA = deferred<Mistake[]>();
    const pendingCourseB = deferred<Mistake[]>();
    const courseA = { ...mistakeA, errorCause: "课程 A 错因" };
    const courseB = { ...mistakeB, errorCause: "课程 B 错因" };
    const list = vi.fn((params: unknown) => (params as { courseId?: string }).courseId === "course-1" ? pendingCourseA.promise : pendingCourseB.promise);
    const rpc = createMockRpcClient({
      "mistakes.list": list, "weakPoints.list": () => [], "mistakes.get": () => detailA,
      "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }),
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" })));
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-2" })));
    await act(async () => pendingCourseB.resolve([courseB])); await flush();
    await act(async () => pendingCourseA.resolve([courseA])); await flush();
    expect(host.textContent).toContain("课程 B 错因");
    expect(host.textContent).not.toContain("课程 A 错因");
  });

  it("上下文往返时，旧 redo 响应不能解除新 mutation 的重复点击保护", async () => {
    const pendingOld = deferred<{ mistakeId: string; correct: boolean; evidenceCount: number; weakPointFormed: boolean; updatedAt: string }>();
    const pendingNew = deferred<{ mistakeId: string; correct: boolean; evidenceCount: number; weakPointFormed: boolean; updatedAt: string }>();
    const redo = vi.fn(() => redo.mock.calls.length === 1 ? pendingOld.promise : pendingNew.promise);
    const rpc = createMockRpcClient({
      "mistakes.list": () => [mistakeA], "weakPoints.list": () => [], "mistakes.get": () => detailA,
      "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }), "mistakes.redo": () => redo(),
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" })));
    await flush(); await flush(); await act(async () => button(host!, "查看详情").click()); await flush();
    await act(async () => button(host!, "重做").click());
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-2" })));
    await flush(); await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" })));
    await flush(); await act(async () => button(host!, "查看详情").click()); await flush();
    await act(async () => button(host!, "重做").click());
    expect(redo).toHaveBeenCalledTimes(2);
    await act(async () => pendingOld.resolve({ mistakeId: "mistake-1", correct: true, evidenceCount: 2, weakPointFormed: true, updatedAt: "2026-08-11T00:00:00.000Z" }));
    await flush();
    expect(button(host!, "正在提交").disabled).toBe(true);
    await act(async () => pendingNew.resolve({ mistakeId: "mistake-1", correct: true, evidenceCount: 3, weakPointFormed: true, updatedAt: "2026-08-11T00:00:00.000Z" }));
    await flush();
  });

  it("详情请求或 mutation 在卸载后返回，不更新已卸载组件", async () => {
    const pendingDetail = deferred<MistakeWithEvidence>();
    const pendingRedo = deferred<{ mistakeId: string; correct: boolean; evidenceCount: number; weakPointFormed: boolean; updatedAt: string }>();
    const rpc = createMockRpcClient({
      "mistakes.list": () => [mistakeA], "weakPoints.list": () => [],
      "mistakes.get": () => pendingDetail.promise, "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }),
      "mistakes.redo": () => pendingRedo.promise,
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" })));
    await flush(); await act(async () => button(host!, "查看详情").click());
    await act(async () => root?.unmount());
    pendingDetail.resolve(detailA); pendingRedo.resolve({ mistakeId: "mistake-1", correct: true, evidenceCount: 2, weakPointFormed: true, updatedAt: "2026-08-11T00:00:00.000Z" });
    await flush();
  });

  it("mutation 在卸载后返回，不更新已卸载组件", async () => {
    const pendingRedo = deferred<{ mistakeId: string; correct: boolean; evidenceCount: number; weakPointFormed: boolean; updatedAt: string }>();
    const rpc = createMockRpcClient({
      "mistakes.list": () => [mistakeA], "weakPoints.list": () => [], "mistakes.get": () => detailA,
      "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }), "mistakes.redo": () => pendingRedo.promise,
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" })));
    await flush(); await act(async () => button(host!, "查看详情").click()); await flush();
    await act(async () => button(host!, "重做").click());
    await act(async () => root?.unmount());
    pendingRedo.resolve({ mistakeId: "mistake-1", correct: true, evidenceCount: 2, weakPointFormed: true, updatedAt: "2026-08-11T00:00:00.000Z" });
    await flush();
  });

  it("mutation 失败只显示固定错误，不把原始路径或栈展示到 DOM", async () => {
    const rawError = "Error: C:\\private\\secret.ts\n at hidden";
    const rpc = createMockRpcClient({
      "mistakes.list": () => [mistakeA], "weakPoints.list": () => [], "mistakes.get": () => detailA,
      "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }),
      "mistakes.redo": () => Promise.reject({ code: "INTERNAL", message: rawError }),
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" }))); await flush();
    await act(async () => button(host!, "查看详情").click()); await flush();
    await act(async () => button(host!, "重做").click()); await flush();
    expect(host.textContent).toContain("重做提交失败，请稍后重试。");
    expect(host.innerHTML).not.toContain(rawError);
    expect(host.textContent).not.toContain("C:\\private");
  });

  it("行内路径、栈和 secret 文本也只能显示固定净化文案", async () => {
    const hostile = "异常，C:\\private\\secret.ts；/home/student/private.txt；inline Error: hidden at stackFrame；api-key: sk-secret";
    const rpc = createMockRpcClient({
      "mistakes.list": () => [{ ...mistakeA, errorCause: hostile }], "weakPoints.list": () => [],
      "mistakes.get": () => ({ ...detailA, errorCause: hostile, errorCauseAiSuggestion: hostile }),
      "mistakes.suggestErrorCause": () => ({ suggestion: hostile, confidence: "low" as const }),
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1" })));
    await flush();
    expect(host.textContent).not.toContain("secret.ts");
    await act(async () => button(host!, "查看详情").click()); await flush();
    expect(host.textContent).not.toContain("secret.ts");
    expect(host.textContent).not.toContain("stackFrame");
    expect(host.textContent).not.toContain("sk-secret");
    expect(host.textContent).toContain("错因内容已隐藏。");
    expect(host.textContent).toContain("建议内容已隐藏。");
  });

  it("归档学期为只读，且 mutation 错误不把原始路径或栈展示到 DOM", async () => {
    const confirm = vi.fn(() => Promise.reject({ code: "INTERNAL", message: "Error: C:\\private\\secret.ts\\n at hidden" }));
    const redo = vi.fn(() => Promise.reject({ code: "INTERNAL", message: "Error: C:\\private\\secret.ts\\n at hidden" }));
    const rpc = createMockRpcClient({
      "mistakes.list": () => [mistakeA], "weakPoints.list": () => [], "mistakes.get": () => detailA,
      "mistakes.suggestErrorCause": () => ({ suggestion: "建议", confidence: "medium" as const }),
      "mistakes.confirmErrorCause": () => confirm(), "mistakes.redo": () => redo(),
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(MistakesTab, { rpc, courseId: "course-1", academicContext: { courseId: "course-1", semesterId: "semester-1", isReadOnly: true } }))); await flush();
    await act(async () => button(host!, "查看详情").click()); await flush();
    expect(host.textContent).toContain("只读");
    expect(button(host, "重做").disabled).toBe(true);
    expect(button(host, "确认错因").disabled).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
    expect(host.innerHTML).not.toContain("C:\\private");
  });
});


