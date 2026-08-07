/**
 * T-M0-008 RED: renderer 三栏布局 + TabBar 骨架渲染测试
 *
 * 权威依据：09-UI §2.1（三栏结构）+ §4.1（标签页总览）+ §4.2（对话默认）
 *
 * 测试策略：
 * - Tab 定义纯数据断言（9 Tab + 顺序 + 默认 chat）
 * - TabBar / AppShell 用 react-dom/server renderToStaticMarkup 做静态渲染断言
 * - 不引入 jsdom / @testing-library/react（避免新增未批准依赖）
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TABS, DEFAULT_TAB_ID, type TabDef } from "../../src/renderer/tabs";
import { TabBar } from "../../src/renderer/components/TabBar";
import { AppShell } from "../../src/renderer/components/AppShell";

// ---------- Tab 定义（09-UI §4.1） ----------

describe("Tab 定义（09-UI §4.1）", () => {
  it("应有 9 个 Tab", () => {
    expect(TABS).toHaveLength(9);
  });

  it('默认 Tab 应为 chat（对话，09-UI §4.2 铁律：对话是基础功能非可选）', () => {
    expect(DEFAULT_TAB_ID).toBe("chat");
  });

  it("Tab 顺序：对话/首页/资料/笔记/练习/错题/冲刺/报告/采集", () => {
    const ids = TABS.map((t: TabDef) => t.id);
    expect(ids).toEqual([
      "chat",
      "home",
      "materials",
      "notes",
      "practice",
      "mistakes",
      "cram",
      "report",
      "capture",
    ]);
  });

  it("每个 Tab 有 emoji + 中文 label", () => {
    for (const tab of TABS) {
      expect(tab.emoji).toBeTruthy();
      expect(tab.label).toBeTruthy();
      expect(tab.label.length).toBeGreaterThan(0);
    }
  });

  it("对话 Tab label 为「对话」", () => {
    const chat = TABS.find((t) => t.id === "chat");
    expect(chat).toBeDefined();
    expect(chat!.label).toBe("对话");
  });
});

// ---------- TabBar 组件（09-UI §4.1） ----------

describe("TabBar 组件（09-UI §4.1）", () => {
  function renderTabBar(activeId: string): string {
    return renderToStaticMarkup(
      React.createElement(TabBar, {
        tabs: TABS,
        activeTabId: activeId,
        onSelectTab: () => {},
      }),
    );
  }

  it("渲染全部 9 个 Tab label", () => {
    const html = renderTabBar(DEFAULT_TAB_ID);
    expect(html).toContain("对话");
    expect(html).toContain("首页");
    expect(html).toContain("资料");
    expect(html).toContain("笔记");
    expect(html).toContain("练习");
    expect(html).toContain("错题");
    expect(html).toContain("冲刺");
    expect(html).toContain("报告");
    expect(html).toContain("采集");
  });

  it("默认对话 Tab 激活（aria-selected=true）", () => {
    const html = renderTabBar(DEFAULT_TAB_ID);
    // 对话 tab 应有 aria-selected="true"
    expect(html).toContain('aria-selected="true"');
    // 第一个 aria-selected="true" 应出现在对话 tab 上下文中
    const firstActiveIdx = html.indexOf('aria-selected="true"');
    const chatIdx = html.indexOf("对话");
    expect(firstActiveIdx).toBeGreaterThan(-1);
    expect(chatIdx).toBeGreaterThan(-1);
    // 对话在第一个激活 tab 附近（同一 button 元素内，含内联样式故间距较大）
    expect(Math.abs(firstActiveIdx - chatIdx)).toBeLessThan(500);
  });

  it("非默认 Tab 不激活（aria-selected=false）", () => {
    const html = renderTabBar(DEFAULT_TAB_ID);
    expect(html).toContain('aria-selected="false"');
  });
});

// ---------- AppShell 组件（09-UI §2.1） ----------

describe("AppShell 组件（09-UI §2.1 三栏布局）", () => {
  function renderShell(): string {
    return renderToStaticMarkup(React.createElement(AppShell));
  }

  it("渲染标题栏", () => {
    const html = renderShell();
    expect(html).toContain("pi-studybuddy");
  });

  it("渲染左侧栏（导航区占位）", () => {
    const html = renderShell();
    expect(html).toContain("导航");
  });

  it("渲染主内容区（TabBar 所在）", () => {
    const html = renderShell();
    expect(html).toContain("对话");
    expect(html).toContain("首页");
  });

  it("渲染右侧面板（上下文区占位）", () => {
    const html = renderShell();
    expect(html).toContain("上下文");
  });

  it("渲染状态栏", () => {
    const html = renderShell();
    expect(html).toContain("模型");
    expect(html).toContain("备份");
  });

  it("渲染朗读控制条占位区", () => {
    const html = renderShell();
    expect(html).toContain("TTS");
  });
});
