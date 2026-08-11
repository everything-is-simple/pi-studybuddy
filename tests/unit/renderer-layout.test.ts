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
import { AppShell, appShellViewReducer, initialAppShellViewState } from "../../src/renderer/components/AppShell";
import { createInitialSemesterCourseState, semesterCourseReducer } from "../../src/renderer/semester-course-state";

// ---------- Tab 定义（09-UI §4.1） ----------

describe("Tab 定义（09-UI §4.1）", () => {
  it("应有 10 个 Tab（T-M4-019 新增备份入口）", () => {
    expect(TABS).toHaveLength(10);
  });

  it('默认 Tab 应为 chat（对话，09-UI §4.2 铁律：对话是基础功能非可选）', () => {
    expect(DEFAULT_TAB_ID).toBe("chat");
  });

  it("Tab 顺序：对话/首页/资料/笔记/练习/错题/冲刺/报告/采集/备份（T-M4-019）", () => {
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
      "backup",
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

describe("AppShell 设置导航状态（09-UI §3.1 / §13.3）", () => {
  it("打开和返回设置不会改变已有工作台 Tab", () => {
    let state = initialAppShellViewState();
    state = appShellViewReducer(state, { type: "selectTab", tabId: "notes" });
    state = appShellViewReducer(state, { type: "openSettings" });
    expect(state).toEqual({ activeTabId: "notes", settingsOpen: true });

    state = appShellViewReducer(state, { type: "closeSettings" });
    expect(state).toEqual({ activeTabId: "notes", settingsOpen: false });
  });

  it("打开设置或切换工作台 Tab 不会覆盖 AppShell 的学期/课程上下文", () => {
    let academicState = createInitialSemesterCourseState();
    academicState = semesterCourseReducer(academicState, { type: "toggleSemester", semesterId: "semester-1" });
    academicState = semesterCourseReducer(academicState, {
      type: "selectCourse",
      semesterId: "semester-1",
      courseId: "course-1",
    });

    let viewState = initialAppShellViewState();
    viewState = appShellViewReducer(viewState, { type: "selectTab", tabId: "notes" });
    viewState = appShellViewReducer(viewState, { type: "openSettings" });
    viewState = appShellViewReducer(viewState, { type: "closeSettings" });
    viewState = appShellViewReducer(viewState, { type: "selectTab", tabId: "practice" });

    expect(viewState).toEqual({ activeTabId: "practice", settingsOpen: false });
    expect(academicState).toEqual({
      context: { semesterId: "semester-1", courseId: "course-1" },
      expandedSemesterIds: ["semester-1"],
    });
  });
});

describe("AppShell 组件（09-UI §2.1 三栏布局）", () => {
  function renderShell(): string {
    return renderToStaticMarkup(React.createElement(AppShell));
  }

  it("渲染标题栏", () => {
    const html = renderShell();
    expect(html).toContain("pi-studybuddy");
  });

  it("渲染左侧栏（T-M3-006 会话管理 UI：会话/搜索/新建）", () => {
    const html = renderShell();
    // 09-UI §3.3 + §7：左侧栏由占位升级为 SessionSidebar
    expect(html).toContain("会话");
    expect(html).toContain("搜索会话");
    expect(html).toContain("新建会话");
    // 09-UI §3.1：设置位于左侧导航，而不是第 10 个工作台 Tab。
    expect(html).toContain("⚙ 设置");
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
  it("在左侧树位置渲染学期导航，并以安全的未选择上下文替换旧标题占位", () => {
    const html = renderShell();
    expect(html).toContain('aria-label="学期和课程"');
    expect(html).toContain("正在等待本机学习数据连接…");
    expect(html).toContain("未选择学期 / 未选择课程");
    expect(html).not.toContain("学期名 / 课程名");
  });
});
