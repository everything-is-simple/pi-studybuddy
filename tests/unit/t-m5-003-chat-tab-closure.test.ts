/**
 * T-M5-003 RED：ChatTab 真实会话/错题/模型/文件引用闭环（renderer 侧）
 *
 * 权威依据：09-UI §4.2（发送携带当前会话 + 学习场景元数据 + 模型选择器）、
 * §7（会话即对话 Tab 内容）、AGENTS.md §9.3（失败可见不静默 catch）。
 *
 * RED 目标（当前生产行为必须失败）：
 *   C-RED-04 发送与工具跳转携带 AppShell activeSessionId（非 sess-001 常量）。
 *   C-RED-05 关联错题从真实 mistakes.list 选择；sessionMeta.mistakeIds 仅含选中项。
 *   C-RED-07 modelsConfig.get/set 失败显示固定中文错误 + 可重试；set 失败不乐观选中。
 *   C-RED-08 sessions.list / agent.send 失败可见（固定中文错误），无静默 catch。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { ChatTab, type ChatMessage } from "../../src/renderer/components/tabs/ChatTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";
import type { Mistake, ModelProvider } from "../../src/contract/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 与 t-m4-014 相同的 DOM 测试辅助 */
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

function messageInput(host: HTMLDivElement): HTMLInputElement {
  const item = host.querySelector('input[placeholder^="输入消息"]');
  if (!(item instanceof HTMLInputElement)) throw new Error("消息输入框不存在");
  return item;
}

function modelSelect(host: HTMLDivElement): HTMLSelectElement {
  // 模型选择器无 aria-label；学科选择器有 aria-label="学科"
  const item = host.querySelector("select:not([aria-label])");
  if (!(item instanceof HTMLSelectElement)) throw new Error("模型选择器不存在");
  return item;
}

/** 设置受控 input 值（React 受控组件 native setter） */
function setInputValue(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const ACTIVE_ID = "uuid-real-session-1";
const ACTIVE_SESSION = { id: ACTIVE_ID, name: "新会话", updatedAt: "2026-08-12T00:00:00.000Z" };

const MISTAKE: Mistake = {
  id: "mistake-1", questionId: "question-1", courseId: "course-1", status: "needs_review", redoCount: 0,
  createdAt: "2026-08-12T00:00:00.000Z", updatedAt: "2026-08-12T00:00:00.000Z",
};

const DEEPSEEK: ModelProvider = {
  id: "deepseek", name: "DeepSeek 直连", providerType: "openai-compatible",
  models: [{ id: "deepseek-chat", name: "DeepSeek Chat", input: ["text"] }],
};

describe("T-M5-003 ChatTab 真实闭环（RED）", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  function mount(jsx: React.ReactElement): void {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root?.render(jsx));
  }

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
  });

  it("C-RED-04a 发送携带 AppShell activeSessionId（非 sess-001 常量）", async () => {
    const send = vi.fn(() => ({ eventCount: 1 }));
    mount(
      React.createElement(ChatTab, {
        rpc: createMockRpcClient({ "agent.send": send }),
        activeSessionId: ACTIVE_ID,
        initialSessions: [ACTIVE_SESSION],
        initialMessages: [],
      }),
    );
    setInputValue(messageInput(host!), "帮我理解极限");
    button(host!, "发送").click();
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
    const params = send.mock.calls[0][0] as { sessionId: string };
    expect(params.sessionId).toBe(ACTIVE_ID);
    expect(params.sessionId).not.toBe("sess-001");
  });

  it("C-RED-04b 工具跳转携带当前会话（非 sess-001 常量）", async () => {
    const onNavigateTab = vi.fn();
    const messages: ChatMessage[] = [
      {
        role: "assistant",
        text: "已生成 5 题",
        toolCalls: [
          { toolCallId: "call-1", toolName: "studybuddy_generate_questions", inputSummary: "出题", status: "done" },
        ],
      },
    ];
    mount(
      React.createElement(ChatTab, {
        rpc: createMockRpcClient({}),
        activeSessionId: ACTIVE_ID,
        initialSessions: [ACTIVE_SESSION],
        initialMessages: messages,
        onNavigateTab,
      }),
    );
    const jump = host!.querySelector('button[data-tab]');
    if (!(jump instanceof HTMLButtonElement)) throw new Error("跳转按钮不存在");
    act(() => jump.click());
    expect(onNavigateTab).toHaveBeenCalledTimes(1);
    const [tabId, context] = onNavigateTab.mock.calls[0] as [string, { sessionId?: string }];
    expect(context.sessionId).toBe(ACTIVE_ID);
    expect(tabId).toBe("practice");
  });

  it("C-RED-05 关联错题从真实 mistakes.list 选择，sessionMeta.mistakeIds 仅含选中项", async () => {
    const send = vi.fn(() => ({ eventCount: 1 }));
    mount(
      React.createElement(ChatTab, {
        rpc: createMockRpcClient({
          "mistakes.list": () => [MISTAKE],
          "agent.send": send,
        }),
        activeSessionId: ACTIVE_ID,
        initialSessions: [ACTIVE_SESSION],
        academicContext: { semesterId: "sem-1", courseId: "course-1" },
      }),
    );
    // 点击「+ 关联错题」→ 打开真实错题选择器（列出 mistakes.list 结果）
    button(host!, "+ 关联错题").click();
    await flush();
    expect(host!.textContent).toContain("mistake-1");
    // 选择真实错题 → chip 出现，发送后 sessionMeta 仅含选中项
    const option = buttons(host!, "mistake-1")[0];
    act(() => option.click());
    setInputValue(messageInput(host!), "讲讲这道错题");
    button(host!, "发送").click();
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
    const params = send.mock.calls[0][0] as { sessionMeta?: { mistakeIds?: string[] } };
    expect(params.sessionMeta?.mistakeIds).toEqual(["mistake-1"]);
    expect(params.sessionMeta?.mistakeIds).not.toContain("mist-001");
  });

  it("C-RED-07a modelsConfig.get 失败显示固定中文错误 + 可重试", async () => {
    mount(
      React.createElement(ChatTab, {
        rpc: createMockRpcClient({
          "models.list": () => [DEEPSEEK],
          "modelsConfig.get": () => Promise.reject({ code: "INTERNAL", message: "读取配置失败" }),
        }),
      }),
    );
    await flush();
    expect(host!.textContent).toContain("模型配置读取失败");
    expect(buttons(host!, "重试").length).toBeGreaterThan(0);
  });

  it("C-RED-07b modelsConfig.set 失败：显示固定错误且不乐观选中", async () => {
    const setCfg = vi.fn(() => Promise.reject({ code: "INTERNAL", message: "保存配置失败" }));
    mount(
      React.createElement(ChatTab, {
        rpc: createMockRpcClient({
          "models.list": () => [DEEPSEEK],
          "modelsConfig.get": () => ({ provider: "", model: "" }),
          "modelsConfig.set": setCfg,
        }),
      }),
    );
    await flush();
    const sel = modelSelect(host!);
    sel.value = "deepseek:deepseek-chat";
    act(() => sel.dispatchEvent(new Event("change", { bubbles: true })));
    await flush();
    expect(setCfg).toHaveBeenCalledWith({ provider: "deepseek", model: "deepseek-chat" });
    expect(host!.textContent).toContain("模型保存失败");
    // 保存失败 → 下拉不残留未保存选项（重挂载后重新查询，value 为空）
    expect(modelSelect(host!).value).toBe("");
  });

  it("C-RED-08a sessions.list 失败显示固定中文错误（不静默）", async () => {
    mount(
      React.createElement(ChatTab, {
        rpc: createMockRpcClient({
          "sessions.list": () => Promise.reject({ code: "INTERNAL", message: "会话读取失败" }),
        }),
        activeSessionId: ACTIVE_ID,
      }),
    );
    await flush();
    expect(host!.textContent).toContain("会话读取失败");
    expect(buttons(host!, "重试").length).toBeGreaterThan(0);
  });

  it("C-RED-08b agent.send 失败显示固定中文错误（不静默）", async () => {
    const send = vi.fn(() =>
      Promise.reject({ code: "MODEL_NOT_CONFIGURED", message: "模型未配置" }),
    );
    mount(
      React.createElement(ChatTab, {
        rpc: createMockRpcClient({ "agent.send": send }),
        activeSessionId: ACTIVE_ID,
        initialSessions: [ACTIVE_SESSION],
      }),
    );
    setInputValue(messageInput(host!), "帮我理解极限");
    button(host!, "发送").click();
    await flush();
    expect(host!.textContent).toContain("模型未配置");
  });
});
