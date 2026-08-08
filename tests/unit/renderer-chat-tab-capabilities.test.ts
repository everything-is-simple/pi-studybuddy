/**
 * T-M3-002 RED: ChatTab pi 原生能力承载静态渲染测试
 *
 * 权威依据：09-UI §4.2（工具调用视图/上下文压缩/@文件引用/多模型切换承载表）
 * + 07-WF §2.8（步骤 2 流式回复+工具视图、步骤 4 @引用）。
 *
 * 测试策略：renderToStaticMarkup 静态渲染断言（沿用 renderer-chat-tab.test.ts
 * 范式，不引入 jsdom）。行为测试（事件消费）走集成层。
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatTab, type ChatMessage } from "../../src/renderer/components/tabs/ChatTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";
import type { ModelProvider } from "../../src/contract/types";

/** 工具调用视图辅助：初始消息含 toolCalls */
function renderWithToolCalls(messages: ChatMessage[]): string {
  return renderToStaticMarkup(
    React.createElement(ChatTab, {
      rpc: createMockRpcClient({}),
      initialMessages: messages,
    }),
  );
}

const MODEL_FIXTURE: ModelProvider[] = [
  {
    id: "local",
    name: "本地模型",
    providerType: "local",
    models: [{ id: "deepseek-r1", name: "DeepSeek R1", contextWindow: 65536 }],
  },
  {
    id: "cloud",
    name: "云端模型",
    providerType: "openai-compatible",
    models: [{ id: "gpt-5", name: "GPT-5", contextWindow: 262144 }],
  },
];

describe("ChatTab 工具调用视图（09-UI §4.2 + 07-WF §2.8 步骤 3）", () => {
  it("渲染 tool_call 工具卡片（工具名 + 脱敏输入摘要）", () => {
    const html = renderWithToolCalls([
      {
        role: "assistant",
        text: "",
        toolCalls: [
          {
            toolCallId: "call-1",
            toolName: "studybuddy_generate_questions",
            status: "running",
            inputSummary: "高数极限 5 题",
          },
        ],
      },
    ]);
    expect(html).toContain("studybuddy_generate_questions");
    expect(html).toContain("高数极限 5 题");
  });

  it("tool_result 后卡片显示结果摘要（✅ 状态）", () => {
    const html = renderWithToolCalls([
      {
        role: "assistant",
        text: "",
        toolCalls: [
          {
            toolCallId: "call-1",
            toolName: "studybuddy_generate_questions",
            status: "done",
            inputSummary: "出 5 道题",
            resultSummary: "已生成 5 道题",
          },
        ],
      },
    ]);
    expect(html).toContain("已生成 5 道题");
    expect(html).toContain("✅");
  });

  it("tool_result isError 时卡片显示失败状态（⚠️）", () => {
    const html = renderWithToolCalls([
      {
        role: "assistant",
        text: "",
        toolCalls: [
          {
            toolCallId: "call-2",
            toolName: "studybuddy_generate_questions",
            status: "error",
            inputSummary: "出 5 道题",
            resultSummary: "题目生成失败",
          },
        ],
      },
    ]);
    expect(html).toContain("题目生成失败");
    expect(html).toContain("⚠️");
  });

  it("工具卡片摘要不泄漏完整 UUID（安全不变量 §9.3）", () => {
    const html = renderWithToolCalls([
      {
        role: "assistant",
        text: "",
        toolCalls: [
          {
            toolCallId: "call-1",
            toolName: "studybuddy_generate_questions",
            status: "done",
            inputSummary: "用户 3f2b1c4d-9a8e-4f6b-8c2d-1a2b3c4d5e6f 出题",
            resultSummary: "ok",
          },
        ],
      },
    ]);
    expect(html).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
  });
});

describe("ChatTab 上下文压缩提示条（09-UI §4.2 onContextUsageChange 语义）", () => {
  it("initialCompressed 时渲染压缩提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(ChatTab, {
        rpc: createMockRpcClient({}),
        initialCompressed: true,
      }),
    );
    expect(html).toContain("长对话已自动压缩");
  });

  it("未压缩时不渲染提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(ChatTab, { rpc: createMockRpcClient({}) }),
    );
    expect(html).not.toContain("长对话已自动压缩");
  });
});

describe("ChatTab 模型选择器（09-UI §4.2 多模型切换 + 06-API §3.13）", () => {
  it("渲染模型下拉列表（providers + models）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ChatTab, {
        rpc: createMockRpcClient({}),
        initialModels: MODEL_FIXTURE,
        initialModelId: "local:deepseek-r1",
      }),
    );
    expect(html).toContain("模型");
    expect(html).toContain("DeepSeek R1");
    expect(html).toContain("GPT-5");
  });

  it("无模型数据时不渲染选择器", () => {
    const html = renderToStaticMarkup(
      React.createElement(ChatTab, { rpc: createMockRpcClient({}) }),
    );
    expect(html).not.toContain("DeepSeek R1");
  });
});

describe("ChatTab @文件引用选择器（09-UI §4.2 + 07-WF §2.8 步骤 4）", () => {
  it("initialPickerOpen 时渲染当前课程资料选择器", () => {
    const html = renderToStaticMarkup(
      React.createElement(ChatTab, {
        rpc: createMockRpcClient({}),
        initialPickerOpen: true,
        initialMaterials: [
          { id: "mat-1", name: "第2章笔记.pdf", courseId: "course-1" },
          { id: "mat-2", name: "极限练习.docx", courseId: "course-1" },
        ],
      }),
    );
    expect(html).toContain("引用资料");
    expect(html).toContain("第2章笔记.pdf");
    expect(html).toContain("极限练习.docx");
  });

  it("选择器关闭时不渲染资料列表", () => {
    const html = renderToStaticMarkup(
      React.createElement(ChatTab, { rpc: createMockRpcClient({}) }),
    );
    expect(html).not.toContain("引用资料");
  });
});
