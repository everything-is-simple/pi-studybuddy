/**
 * T-M3-004 RED: ChatTab 工具卡片跳转按钮静态渲染测试
 *
 * 权威依据：09-UI §4.2（工具调用可跳转："AI 调用 studybuddy_generate_note 后，
 * 『查看』按钮跳转到笔记 Tab"）+ 07-WF §2.8 步骤 3（"已生成 5 题 [去练习]"）
 * + 08-Test §6.5 E2E-11（跳转练习 Tab）+ T-M3-004 裁决 3（统一文案 [去<Tab名>]，
 * 无目标 Tab 不渲染按钮）。
 *
 * 测试策略：renderToStaticMarkup 静态渲染断言（沿用 renderer-chat-tab-capabilities
 * 范式，不引入 jsdom）。onNavigateTab 回调触发行为走集成层断言（React 事件
 * 处理器经 data-tab 属性可被 E2E-11 端到端点击验证，归 T-M3-007）。
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatTab, type ChatMessage } from "../../src/renderer/components/tabs/ChatTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

/** 工具调用视图辅助：initialMessages 含 toolCalls */
function renderWithToolCalls(messages: ChatMessage[]): string {
  return renderToStaticMarkup(
    React.createElement(ChatTab, {
      rpc: createMockRpcClient({}),
      initialMessages: messages,
    }),
  );
}

/** 构造 done 状态工具卡片的辅助消息 */
function doneToolMessage(toolName: string, resultSummary: string): ChatMessage[] {
  return [
    {
      role: "assistant",
      text: "",
      toolCalls: [
        {
          toolCallId: "call-1",
          toolName,
          status: "done",
          inputSummary: "请求摘要",
          resultSummary,
        },
      ],
    },
  ];
}

describe("ChatTab 工具卡片跳转按钮（09-UI §4.2 + 07-WF §2.8 步骤 3 + 裁决 3）", () => {
  it("generate_questions done → 渲染 [去练习] 按钮（E2E-11 文案）", () => {
    const html = renderWithToolCalls(doneToolMessage("studybuddy_generate_questions", "已生成 5 题"));
    expect(html).toContain("已生成 5 题");
    expect(html).toContain("去练习");
    // 跳转按钮带 data-tab 属性（E2E-11 点击断言 + onNavigateTab 回调钩子）
    expect(html).toContain("data-tab=\"practice\"");
  });

  it("generate_note done → 渲染 [去笔记] 按钮（09-UI §4.2 查看语义）", () => {
    const html = renderWithToolCalls(doneToolMessage("studybuddy_generate_note", "已生成结构化笔记"));
    expect(html).toContain("去笔记");
    expect(html).toContain("data-tab=\"notes\"");
  });

  it("upload_material done → 渲染 [去资料] 按钮（07-WF §2.8 衔接）", () => {
    const html = renderWithToolCalls(doneToolMessage("studybuddy_upload_material", "已上传"));
    expect(html).toContain("去资料");
    expect(html).toContain("data-tab=\"materials\"");
  });

  it("generate_mock_exam done → 渲染 [去冲刺] 按钮", () => {
    const html = renderWithToolCalls(doneToolMessage("studybuddy_generate_mock_exam", "已生成模拟卷"));
    expect(html).toContain("去冲刺");
    expect(html).toContain("data-tab=\"cram\"");
  });

  it("tts_speak done → 不渲染跳转按钮（朗读控制条全局，裁决 1/3）", () => {
    const html = renderWithToolCalls(doneToolMessage("studybuddy_tts_speak", "已开始朗读"));
    expect(html).not.toContain("data-tab=");
    expect(html).not.toContain("去");
  });

  it("backup_course done → 不渲染跳转按钮（TabBar 无 backup Tab，裁决 1a）", () => {
    const html = renderWithToolCalls(doneToolMessage("studybuddy_backup_course", "已备份"));
    expect(html).not.toContain("data-tab=");
  });

  it("running 状态卡片不渲染跳转按钮（仅 done 可跳转）", () => {
    const html = renderWithToolCalls([
      {
        role: "assistant",
        text: "",
        toolCalls: [
          {
            toolCallId: "call-1",
            toolName: "studybuddy_generate_questions",
            status: "running",
            inputSummary: "出题中",
          },
        ],
      },
    ]);
    expect(html).not.toContain("data-tab=");
  });

  it("error 状态卡片不渲染跳转按钮（失败无跳转语义）", () => {
    const html = renderWithToolCalls(doneToolMessage("studybuddy_generate_questions", "").map((m) => ({
      ...m,
      toolCalls: [{ ...(m.toolCalls as NonNullable<ChatMessage["toolCalls"]>)[0], status: "error" as const }],
    })));
    expect(html).not.toContain("data-tab=");
  });
});
