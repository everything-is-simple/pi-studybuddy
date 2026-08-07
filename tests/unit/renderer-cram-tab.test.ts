/**
 * T-M2-008 RED: CramTab 冲刺 Tab 静态渲染测试
 *
 * 权威依据：09-UI §4.8（冲刺：模拟考/速背卡/冲刺计划）+ §7.4（确定性只读）
 *
 * 测试策略：
 * - 速背卡渲染（知识点/关键点）+ 确定性只读（不含 AI 标记）
 * - 冲刺计划渲染（日期/任务）+ 确定性只读
 * - 模拟考入口
 * - 三选一子切换
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CramTab } from "../../src/renderer/components/tabs/CramTab";
import type { CramCard, CramPlanDay } from "../../src/contract/types";

// ---------- 夹具数据 ----------

const fixtureCards: CramCard[] = [
  {
    moduleId: "mod-001",
    moduleName: "极限与连续",
    coreConcept: "ε-δ 定义",
    keyPoints: ["任意性", "存在性", "唯一性"],
    mnemonic: "任意小存在大",
    commonExamPattern: "证明题",
    easyMistake: "混淆任意与存在",
    importance: 5,
  },
  {
    moduleId: "mod-002",
    moduleName: "导数与微分",
    coreConcept: "导数定义",
    keyPoints: ["极限形式", "几何意义"],
    importance: 4,
  },
];

const fixturePlan: CramPlanDay[] = [
  {
    date: "2026-08-08",
    dayOffset: 0,
    tasks: {
      reviewModules: ["mod-001", "mod-002"],
      redoMistakes: ["m-001"],
      practiceCount: 2,
      notes: "重点复习极限定义",
    },
  },
  {
    date: "2026-08-09",
    dayOffset: 1,
    tasks: {
      reviewModules: ["mod-003"],
      redoMistakes: [],
      practiceCount: 1,
      notes: "导数练习",
    },
  },
];

// ---------- CramTab 速背卡 ----------

describe("CramTab 速背卡（09-UI §4.8 + §7.4 确定性只读）", () => {
  it("渲染速背卡核心概念", () => {
    const html = renderToStaticMarkup(
      React.createElement(CramTab, { subTab: "speedCards", cards: fixtureCards }),
    );
    expect(html).toContain("ε-δ 定义");
    expect(html).toContain("导数定义");
  });

  it("渲染速背卡关键点", () => {
    const html = renderToStaticMarkup(
      React.createElement(CramTab, { subTab: "speedCards", cards: fixtureCards }),
    );
    expect(html).toContain("任意性");
    expect(html).toContain("存在性");
  });

  it("渲染速背卡模块名", () => {
    const html = renderToStaticMarkup(
      React.createElement(CramTab, { subTab: "speedCards", cards: fixtureCards }),
    );
    expect(html).toContain("极限与连续");
    expect(html).toContain("导数与微分");
  });

  it("确定性只读：速背卡不含 AI 生成标记（§7.4）", () => {
    const html = renderToStaticMarkup(
      React.createElement(CramTab, { subTab: "speedCards", cards: fixtureCards }),
    );
    // 速背卡是确定性只读 DTO，不调 LLM，不应有 AI 标记
    expect(html).not.toContain("AI 生成");
    expect(html).not.toContain("仅供参考");
  });

  it("空状态：无速背卡时渲染提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(CramTab, { subTab: "speedCards", cards: [] }),
    );
    expect(html).toContain("暂无");
  });
});

// ---------- CramTab 冲刺计划 ----------

describe("CramTab 冲刺计划（09-UI §4.8 + §7.4 确定性只读）", () => {
  it("渲染冲刺计划日期", () => {
    const html = renderToStaticMarkup(
      React.createElement(CramTab, { subTab: "plan", plan: fixturePlan }),
    );
    expect(html).toContain("2026-08-08");
    expect(html).toContain("2026-08-09");
  });

  it("渲染冲刺计划任务", () => {
    const html = renderToStaticMarkup(
      React.createElement(CramTab, { subTab: "plan", plan: fixturePlan }),
    );
    expect(html).toContain("重点复习极限定义");
    expect(html).toContain("导数练习");
  });

  it("渲染练习数量", () => {
    const html = renderToStaticMarkup(
      React.createElement(CramTab, { subTab: "plan", plan: fixturePlan }),
    );
    expect(html).toContain("2");
    expect(html).toContain("1");
  });

  it("确定性只读：冲刺计划不含 AI 生成标记（§7.4）", () => {
    const html = renderToStaticMarkup(
      React.createElement(CramTab, { subTab: "plan", plan: fixturePlan }),
    );
    expect(html).not.toContain("AI 生成");
    expect(html).not.toContain("仅供参考");
  });

  it("空状态：无计划时渲染提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(CramTab, { subTab: "plan", plan: [] }),
    );
    expect(html).toContain("暂无");
  });
});

// ---------- CramTab 模拟考入口 ----------

describe("CramTab 模拟考入口（09-UI §4.8）", () => {
  it("渲染模拟考入口按钮", () => {
    const html = renderToStaticMarkup(
      React.createElement(CramTab, { subTab: "mockExam" }),
    );
    expect(html).toContain("模拟考");
  });

  it("渲染生成试卷入口", () => {
    const html = renderToStaticMarkup(
      React.createElement(CramTab, { subTab: "mockExam" }),
    );
    expect(html).toContain("生成");
  });
});

// ---------- CramTab 默认子 Tab ----------

describe("CramTab 默认渲染", () => {
  it("未指定子 Tab 时默认渲染速背卡入口", () => {
    const html = renderToStaticMarkup(
      React.createElement(CramTab, { cards: fixtureCards }),
    );
    // 默认应渲染速背卡内容
    expect(html).toContain("ε-δ 定义");
  });

  it("不展示完整 UUID（§11.1 隐私边界）", () => {
    const html = renderToStaticMarkup(
      React.createElement(CramTab, { subTab: "speedCards", cards: fixtureCards }),
    );
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
