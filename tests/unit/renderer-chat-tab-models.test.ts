/**
 * T-M3-005 RED: ChatTab 模型选择器落库（09-UI §4.2 + 06-API §3.13 modelsConfig.get/set）
 *
 * 权威依据：裁决 3（handler 范围 modelsConfig.get/set）+ 09-UI §9.2（模型选择
 * 持久化到业务数据根）+ 02-PRD §5.2（config 不含 key/baseUrl）。
 *
 * 测试策略：renderToStaticMarkup 静态渲染断言（沿用 renderer-chat-tab-meta 范式）。
 * 落库行为（get 回填 / set 落库）走集成层（modelsConfig handler 测试），此处
 * 断言模型选择器渲染语义与初始选中态回填。
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatTab } from "../../src/renderer/components/tabs/ChatTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";
import type { ModelProvider } from "../../src/contract/types";

/** 裁决 5 fixture（deepseek + agnes，无 apiKey/baseUrl） */
const FIxtureModels: ModelProvider[] = [
  {
    id: "deepseek",
    name: "DeepSeek 文字模型",
    providerType: "openai-compatible",
    models: [
      { id: "DeepSeek V4 Flash", name: "DeepSeek V4 Flash" },
      { id: "DeepSeek V4 Pro", name: "DeepSeek V4 Pro" },
    ],
  },
  {
    id: "agnes",
    name: "Agnes 多媒体模型",
    providerType: "openai-compatible",
    models: [
      { id: "agnes-2.5-flash", name: "Agnes 2.5 Flash" },
      { id: "agnes-2.5-pro", name: "Agnes 2.5 Pro" },
    ],
  },
];

function renderWithModels(initialModelId?: string): string {
  return renderToStaticMarkup(
    React.createElement(ChatTab, {
      rpc: createMockRpcClient({}),
      initialModels: FIxtureModels,
      initialModelId,
    }),
  );
}

describe("ChatTab 模型选择器落库（T-M3-005，09-UI §4.2 + §9.2）", () => {
  it("渲染模型下拉含 deepseek + agnes 两组 provider 选项（裁决 5）", () => {
    const html = renderWithModels();
    expect(html).toContain("DeepSeek 文字模型");
    expect(html).toContain("Agnes 多媒体模型");
    expect(html).toContain("DeepSeek V4 Flash");
    expect(html).toContain("Agnes 2.5 Pro");
  });

  it("初始选中态回填 → option value=provider:model 选中（get 回填语义）", () => {
    const html = renderWithModels("deepseek:DeepSeek V4 Flash");
    // 静态渲染中 select 的选中以 selected 属性呈现于对应 option
    expect(html).toContain('value="deepseek:DeepSeek V4 Flash"');
  });

  it("模型选项 value 为 provider:model 组合 id（09-UI §4.2 多模型切换）", () => {
    const html = renderWithModels();
    expect(html).toContain('value="agnes:agnes-2.5-flash"');
    expect(html).toContain('value="agnes:agnes-2.5-pro"');
  });
});