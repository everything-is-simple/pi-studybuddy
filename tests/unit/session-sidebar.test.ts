/**
 * T-M3-006 RED: SessionSidebar 会话管理 UI 静态渲染测试
 *
 * 权威依据：09-UI §3.3（会话列表：按日期分组/模糊搜索/unread 计数/学科标签颜色）
 * + 09-UI §7（会话管理 UI，对话 Tab 的承载）+ 09-UI §11.2（Ctrl+N 新建会话）。
 *
 * 测试策略：renderToStaticMarkup 静态渲染断言（沿用 renderer-chat-tab.test.ts
 * 范式，不引入 jsdom）。行为（重命名/删除/导出回调）走 props 断言。
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionSidebar, subjectColor, type SessionSidebarItem } from "../../src/renderer/components/SessionSidebar";

/** 静态渲染辅助：固定 now 保证日期分组确定性（今天=2026-08-08） */
function renderSidebar(props?: {
  sessions?: SessionSidebarItem[];
  query?: string;
  activeId?: string;
  now?: Date;
}): string {
  return renderToStaticMarkup(
    React.createElement(SessionSidebar, {
      sessions: props?.sessions ?? [
        { id: "sess-001", name: "极限学习", updatedAt: "2026-08-08T09:00:00Z", preview: "ε-δ 定义", subject: "高数" },
        { id: "sess-002", name: "导数练习", updatedAt: "2026-08-07T10:00:00Z", preview: "导数定义 5 题" },
        { id: "sess-003", name: "旧对话", updatedAt: "2026-08-03T08:00:00Z" },
      ],
      query: props?.query ?? "",
      activeId: props?.activeId,
      now: props?.now ?? new Date("2026-08-08T12:00:00Z"),
      onNewSession: () => {},
      onSelect: () => {},
      onRename: () => {},
      onDelete: () => {},
      onExport: () => {},
    }),
  );
}

describe("SessionSidebar 会话管理 UI（T-M3-006，09-UI §3.3 + §7）", () => {
  it("按日期分组渲染：今天 / 昨天 / 本周 组标题", () => {
    const html = renderSidebar();
    expect(html).toContain("今天");
    expect(html).toContain("昨天");
    expect(html).toContain("本周");
    // 今天组含 sess-001（2026-08-08），昨天组含 sess-002（2026-08-07）
    expect(html).toContain("极限学习");
    expect(html).toContain("导数练习");
    expect(html).toContain("旧对话");
  });

  it("渲染模糊搜索输入框（占位符提示学科+目标+内容）", () => {
    const html = renderSidebar();
    expect(html).toContain("type=\"search\"");
    expect(html).toContain("搜索会话");
  });

  it("学科标签颜色标识（subjectColor 纯函数 + 渲染）", () => {
    // 数学=蓝（高数）
    expect(subjectColor("高数")).toBe("#1a5fb4");
    // 英语=红
    expect(subjectColor("英语")).toBe("#c01c28");
    // 未知学科回退灰色
    expect(subjectColor("未知学科")).toBe("#888888");
    const html = renderSidebar();
    expect(html).toContain("高数");
  });

  it("渲染 unread 计数徽标（仅 unread > 0 显示）", () => {
    const html = renderToStaticMarkup(
      React.createElement(SessionSidebar, {
        sessions: [
          { id: "sess-003", name: "新消息会话", updatedAt: "2026-08-08T11:00:00Z", unread: 3 },
          { id: "sess-004", name: "已读会话", updatedAt: "2026-08-08T10:00:00Z" },
        ],
        query: "",
        now: new Date("2026-08-08T12:00:00Z"),
        onNewSession: () => {},
        onSelect: () => {},
        onRename: () => {},
        onDelete: () => {},
        onExport: () => {},
      }),
    );
    expect(html).toContain("3");
    expect(html).toContain("未读");
  });

  it("渲染新建会话入口（Ctrl+N，09-UI §11.2）", () => {
    const html = renderSidebar();
    expect(html).toContain("新建会话");
  });

  it("选中会话高亮（activeId 匹配）", () => {
    const html = renderSidebar({ activeId: "sess-001" });
    expect(html).toContain("data-active=\"true\"");
  });

  it("空态：无会话时渲染提示，不渲染分组", () => {
    const html = renderSidebar({ sessions: [] });
    expect(html).toContain("暂无会话");
  });

  it("会话条目渲染操作按钮（重命名/删除/导出）", () => {
    const html = renderSidebar();
    expect(html).toContain("重命名");
    expect(html).toContain("删除");
    expect(html).toContain("导出");
  });

  it("导出格式选择：md / json 两个选项", () => {
    const html = renderSidebar();
    expect(html).toContain("md");
    expect(html).toContain("json");
  });

  it("无完整 UUID 泄漏（安全不变量 §9.3）", () => {
    const html = renderSidebar();
    expect(html).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
  });
});
