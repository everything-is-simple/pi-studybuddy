/**
 * T-M2-008 RED: ReportTab 报告 Tab 静态渲染测试
 *
 * 权威依据：09-UI §4.9（家长报告学生侧）+ §7.2（隐私边界）+ §7.5（单机零云）
 *
 * 测试策略：
 * - 报告列表渲染（类型/周期）+ ShortId（不含完整 UUID）
 * - 报告内容脱敏展示
 * - 生成入口
 * - 投递状态
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportTab } from "../../src/renderer/components/tabs/ReportTab";
import type { ParentReport } from "../../src/contract/types";

// ---------- 夹具数据 ----------

const fixtureReports: ParentReport[] = [
  {
    reportKey: "a1b2c3d4-5678-9012-abcd-ef0123456789",
    semesterId: "sem-001",
    reportType: "weekly",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-07",
    contentJson: {
      summary: "本周完成 5 次练习，正确率 80%",
      sections: [
        { title: "学习进度", content: "完成 3 个知识模块" },
        { title: "薄弱点", content: "极限定义需加强" },
      ],
    },
    contentHash: "abc123def456",
    ruleGenerated: 1,
    aiPolished: 0,
    privacyCheckPassed: 1,
    generatedAt: "2026-08-08T00:00:00Z",
    createdAt: "2026-08-08T00:00:00Z",
  },
  {
    reportKey: "b2c3d4e5-6789-0123-abcd-ef1234567890",
    semesterId: "sem-001",
    reportType: "daily",
    periodStart: "2026-08-08",
    periodEnd: "2026-08-08",
    contentJson: {
      summary: "今日完成 2 次练习",
      sections: [{ title: "学习进度", content: "复习导数" }],
    },
    contentHash: "xyz789uvw012",
    ruleGenerated: 1,
    aiPolished: 0,
    privacyCheckPassed: 1,
    generatedAt: "2026-08-08T12:00:00Z",
    createdAt: "2026-08-08T12:00:00Z",
  },
];

// ---------- ReportTab 报告列表 ----------

describe("ReportTab 报告列表（09-UI §4.9）", () => {
  it("渲染报告列表", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReportTab, { reports: fixtureReports }),
    );
    expect(html).toContain("周报");
    expect(html).toContain("日报");
  });

  it("渲染报告周期", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReportTab, { reports: fixtureReports }),
    );
    expect(html).toContain("2026-08-01");
    expect(html).toContain("2026-08-07");
  });

  it("渲染生成入口", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReportTab, { reports: fixtureReports }),
    );
    expect(html).toContain("生成");
  });

  it("ShortId：不展示完整 UUID（§11.1 铁律）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReportTab, { reports: fixtureReports }),
    );
    expect(html).not.toContain("a1b2c3d4-5678-9012-abcd-ef0123456789");
    expect(html).not.toContain("b2c3d4e5-6789-0123-abcd-ef1234567890");
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("ShortId：展示短 ID（前 8 位 + …）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReportTab, { reports: fixtureReports }),
    );
    expect(html).toContain("a1b2c3d4");
  });
});

// ---------- ReportTab 报告内容 ----------

describe("ReportTab 报告内容（脱敏展示，§7.2）", () => {
  it("渲染选中报告内容", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReportTab, {
        reports: fixtureReports,
        selectedReport: fixtureReports[0],
      }),
    );
    expect(html).toContain("本周完成 5 次练习");
    expect(html).toContain("学习进度");
    expect(html).toContain("完成 3 个知识模块");
  });

  it("渲染规则生成标识（非 AI，§7.4）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReportTab, {
        reports: fixtureReports,
        selectedReport: fixtureReports[0],
      }),
    );
    // ruleGenerated=1 表示规则生成，不应有 AI 生成标记
    expect(html).not.toContain("AI 生成");
  });

  it("渲染隐私检查通过标识（§7.2）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReportTab, {
        reports: fixtureReports,
        selectedReport: fixtureReports[0],
      }),
    );
    // privacyCheckPassed=1 应有隐私检查通过标识
    expect(html).toContain("隐私检查");
  });

  it("不展示完整 UUID（§11.1 隐私边界）", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReportTab, {
        reports: fixtureReports,
        selectedReport: fixtureReports[0],
      }),
    );
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

// ---------- ReportTab 空状态 ----------

describe("ReportTab 空状态", () => {
  it("无报告时渲染提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReportTab, { reports: [] }),
    );
    expect(html).toContain("暂无");
  });
});
