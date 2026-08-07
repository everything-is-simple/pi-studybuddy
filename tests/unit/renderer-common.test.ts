/**
 * T-M1-009 RED: 公共组件静态渲染测试
 *
 * 权威依据：09-UI §11.1（不展示完整 UUID）+ §7.2（隐私边界 UI 断言）
 *
 * 测试策略：
 * - EmptyState/LoadingState/ErrorState/ShortId/TabContainer 用 renderToStaticMarkup 断言
 * - ShortId 不展示完整 UUID（§11.1 铁律）
 * - ErrorState 错误消息不含内部栈/SQL/路径（§7.2 隐私边界）
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmptyState } from "../../src/renderer/components/common/EmptyState";
import { LoadingState } from "../../src/renderer/components/common/LoadingState";
import { ErrorState } from "../../src/renderer/components/common/ErrorState";
import { ShortId } from "../../src/renderer/components/common/ShortId";
import { TabContainer } from "../../src/renderer/components/common/TabContainer";

// ---------- EmptyState ----------

describe("EmptyState 组件", () => {
  it("渲染空状态消息", () => {
    const html = renderToStaticMarkup(
      React.createElement(EmptyState, { message: "暂无学期，请新建" }),
    );
    expect(html).toContain("暂无学期，请新建");
  });

  it("无消息时渲染默认提示", () => {
    const html = renderToStaticMarkup(React.createElement(EmptyState, {}));
    expect(html).toContain("暂无数据");
  });
});

// ---------- LoadingState ----------

describe("LoadingState 组件", () => {
  it("渲染加载中提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(LoadingState, { message: "加载学习中…" }),
    );
    expect(html).toContain("加载学习中…");
  });

  it("无消息时渲染默认提示", () => {
    const html = renderToStaticMarkup(React.createElement(LoadingState, {}));
    expect(html).toContain("加载中");
  });
});

// ---------- ErrorState ----------

describe("ErrorState 组件", () => {
  it("渲染中文可操作错误消息", () => {
    const html = renderToStaticMarkup(
      React.createElement(ErrorState, { message: "加载失败，请稍后重试" }),
    );
    expect(html).toContain("加载失败，请稍后重试");
  });

  it("错误消息不含内部栈信息（§7.2 隐私边界）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ErrorState, { message: "操作失败，请稍后重试" }),
    );
    // 不含 SQL 语句、文件路径、堆栈跟踪关键词
    expect(html).not.toContain("SELECT ");
    expect(html).not.toContain("at /");
    expect(html).not.toContain(".ts:");
    expect(html).not.toContain("node_modules");
  });

  it("不展示完整 UUID（§11.1 隐私边界）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ErrorState, { message: "操作失败，请稍后重试" }),
    );
    // 不含 36 字符 UUID 格式
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

// ---------- ShortId ----------

describe("ShortId 组件（§11.1 不展示完整 UUID）", () => {
  it("渲染短 ID（前 8 位 + …）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShortId, { id: "a1b2c3d4-5678-9012-abcd-ef0123456789" }),
    );
    expect(html).toContain("a1b2c3d4");
    expect(html).toContain("…");
  });

  it("不展示完整 UUID（§11.1 铁律）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShortId, { id: "a1b2c3d4-5678-9012-abcd-ef0123456789" }),
    );
    // 不含完整 UUID（36 字符格式）
    expect(html).not.toContain("a1b2c3d4-5678-9012-abcd-ef0123456789");
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("短 ID（<8 字符）原样展示", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShortId, { id: "abc123" }),
    );
    expect(html).toContain("abc123");
  });
});

// ---------- TabContainer ----------

describe("TabContainer 组件", () => {
  it("渲染子内容", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        TabContainer,
        null,
        React.createElement("div", null, "Tab 内容测试"),
      ),
    );
    expect(html).toContain("Tab 内容测试");
  });
});
