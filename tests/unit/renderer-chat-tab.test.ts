/**
 * T-M3-001 RED: ChatTab 对话 Tab 静态渲染测试
 *
 * 权威依据：09-UI §4.2（对话 Tab 默认主入口：欢迎语 + 输入区 + 消息列表
 * + 会话列表）+ 07-WF §2.8（对话路径）。
 *
 * 测试策略：renderToStaticMarkup 静态渲染断言（沿用 renderer-layout.test.ts
 * 范式，不引入 jsdom/@testing-library）。
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatTab } from "../../src/renderer/components/tabs/ChatTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

/** 静态渲染辅助：props 全默认 */
function renderChatTab(): string {
  return renderToStaticMarkup(
    React.createElement(ChatTab, { rpc: createMockRpcClient({}) }),
  );
}

describe("ChatTab 对话 Tab（09-UI §4.2 默认主入口）", () => {
  it("渲染欢迎语「你好，今天想学点什么？」", () => {
    const html = renderChatTab();
    expect(html).toContain("你好，今天想学点什么？");
  });

  it("渲染 🤖 标识（AI 解读明确标注，02-PRD §1.2）", () => {
    const html = renderChatTab();
    expect(html).toContain("🤖");
  });

  it("渲染消息输入框", () => {
    const html = renderChatTab();
    expect(html).toContain("type=\"text\"");
  });

  it("渲染发送按钮", () => {
    const html = renderChatTab();
    expect(html).toContain("发送");
  });

  it("渲染会话列表区（initialSessions 数据）", () => {
    const rpc = createMockRpcClient({});
    const html = renderToStaticMarkup(
      React.createElement(ChatTab, {
        rpc,
        initialSessions: [
          { id: "sess-001", name: "极限学习", updatedAt: "2026-08-08T09:00:00Z", preview: "ε-δ 定义" },
          { id: "sess-002", name: "导数练习", updatedAt: "2026-08-08T10:00:00Z", preview: "导数定义 5 题" },
        ],
      }),
    );
    expect(html).toContain("极限学习");
    expect(html).toContain("导数练习");
  });

  it("渲染用户消息与 AI 回复（props 消息列表）", () => {
    const rpc = createMockRpcClient({});
    const html = renderToStaticMarkup(
      React.createElement(ChatTab, {
        rpc,
        initialMessages: [
          { role: "user", text: "帮我理解极限的 ε-δ 定义" },
          { role: "assistant", text: "极限的 ε-δ 定义是…" },
        ],
      }),
    );
    expect(html).toContain("帮我理解极限的 ε-δ 定义");
    expect(html).toContain("极限的 ε-δ 定义是…");
  });

  it("消息输入不泄漏完整 UUID（安全不变量 §9.3）", () => {
    const html = renderChatTab();
    expect(html).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
  });
});
