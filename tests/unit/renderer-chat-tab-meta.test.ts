/**
 * T-M3-003 RED: ChatTab 学习场景业务化静态渲染测试
 *
 * 权威依据：09-UI §4.2（📐 学科标签/目标：…/关联错题：#…）+ 07-WF §2.8
 * （学生在对话里问错题 → @引用错题 ID → AI 读取 S4 错题上下文）。
 *
 * 测试策略：renderToStaticMarkup 静态渲染断言（沿用 renderer-chat-tab.test.ts
 * 范式，不引入 jsdom）。行为测试（agent.send sessionMeta 携带）走集成层。
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatTab } from "../../src/renderer/components/tabs/ChatTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

function renderWithMeta(meta: { subject?: string; goal?: string; mistakeIds?: string[] }): string {
  return renderToStaticMarkup(
    React.createElement(ChatTab, {
      rpc: createMockRpcClient({}),
      initialSubject: meta.subject,
      initialGoal: meta.goal,
      initialMistakeIds: meta.mistakeIds,
    }),
  );
}

describe("ChatTab 学习场景业务化（T-M3-003，09-UI §4.2）", () => {
  it("默认渲染学科选择器（选择学科占位 + 选项列表）", () => {
    const html = renderWithMeta({});
    expect(html).toContain("选择学科");
    expect(html).toContain("高数");
    expect(html).toContain("物理");
    expect(html).toContain("📐");
  });

  it("学科选中态 → 头部显示学科标签（选中值渲染）", () => {
    const html = renderWithMeta({ subject: "高数" });
    // select 的 value 以 selected 属性呈现
    expect(html).toContain('value="高数"');
  });

  it("学习目标设置 → 目标输入框含当前值（如：极限练习）", () => {
    const html = renderWithMeta({ goal: "极限练习" });
    expect(html).toContain("极限练习");
    expect(html).toContain("目标");
  });

  it("关联错题 → 渲染 #id chip（可移除按钮）", () => {
    const html = renderWithMeta({ mistakeIds: ["mist-001"] });
    expect(html).toContain("#mist-001");
    expect(html).toContain("移除错题");
    expect(html).toContain("+ 关联错题");
  });

  it("多错题关联 → 渲染多个 chip", () => {
    const html = renderWithMeta({ mistakeIds: ["mist-001", "mist-002"] });
    expect(html).toContain("#mist-001");
    expect(html).toContain("#mist-002");
  });

  it("无错题 → 不渲染 chip，仅保留添加按钮", () => {
    const html = renderWithMeta({});
    expect(html).not.toContain("#mist-");
    expect(html).toContain("+ 关联错题");
  });
});
