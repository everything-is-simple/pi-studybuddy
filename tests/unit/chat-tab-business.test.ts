/**
 * T-M3-006 RED: ChatTab 会话切换业务化 + 业务态补全测试
 *
 * 权威依据：09-UI §4.2（会话标题栏联动）+ 09-UI §7（会话即对话 Tab 内容，
 * 左侧栏选中会话，主内容区加载该会话）。
 *
 * 测试策略：renderToStaticMarkup 静态渲染断言（不引入 jsdom）。
 * 裁决 5：选中会话状态 AppShell 提升 → ChatTab 新增受控 activeSessionId。
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatTab } from "../../src/renderer/components/tabs/ChatTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

describe("ChatTab 会话切换业务化（T-M3-006，09-UI §4.2 + §7）", () => {
  it("受控 activeSessionId → 渲染当前会话标题（会话即对话 Tab 内容）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ChatTab, {
        rpc: createMockRpcClient({}),
        activeSessionId: "sess-001",
        initialSessions: [{ id: "sess-001", name: "极限学习", updatedAt: "2026-08-08T09:00:00Z" }],
      }),
    );
    expect(html).toContain("极限学习");
  });

  it("activeSessionId 无匹配会话 → 回退提示（不渲染错误）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ChatTab, {
        rpc: createMockRpcClient({}),
        activeSessionId: "sess-404",
      }),
    );
    expect(html).toContain("选择会话");
  });

  it("会话加载失败 → 错误态提示（可重试语义）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ChatTab, {
        rpc: createMockRpcClient({}),
        activeSessionId: "sess-001",
        initialSessions: [{ id: "sess-001", name: "极限学习", updatedAt: "2026-08-08T09:00:00Z" }],
        sessionLoadError: "会话读取失败",
      }),
    );
    expect(html).toContain("会话读取失败");
    expect(html).toContain("重试");
  });

  it("无会话 + 无选中 → 会话空态（保持既有「暂无会话」语义）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ChatTab, { rpc: createMockRpcClient({}) }),
    );
    expect(html).toContain("暂无会话");
  });

  it("会话切换回调不泄漏完整 UUID（安全不变量 §9.3）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ChatTab, {
        rpc: createMockRpcClient({}),
        activeSessionId: "sess-001",
      }),
    );
    expect(html).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
  });
});
