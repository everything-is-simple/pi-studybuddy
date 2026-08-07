/**
 * T-M1-009 RED: NotesTab 笔记 Tab 静态渲染测试
 *
 * 权威依据：09-UI §4.5（笔记预览与导图）+ §7.3（知识模块带 source_evidence 回链）
 *
 * 测试策略：
 * - 传入夹具 note/modules 断言渲染输出
 * - 知识模块带 sourceEvidenceJson 回链
 * - 学习状态流转（not_started→learning→mastered→needs_review）
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NotesTab } from "../../src/renderer/components/tabs/NotesTab";
import type { StructuredNote, KnowledgeModule } from "../../src/contract/types";

// ---------- 夹具数据 ----------

const fixtureNote: StructuredNote = {
  id: "note-001",
  materialId: "mat-001",
  courseId: "course-001",
  noteMarkdown: "# 高等数学第一章\n\n## 极限与连续\n\n极限是微积分的基础概念...",
  highlights: [{ text: "极限是微积分的基础概念", color: "#ffeb3b" }],
  promptVersion: "v1.0",
  model: "mock-model",
  aiGenerated: 1,
  createdAt: "2026-08-02T00:00:00Z",
  updatedAt: "2026-08-02T00:00:00Z",
};

const fixtureModules: KnowledgeModule[] = [
  {
    id: "mod-001",
    courseId: "course-001",
    materialId: "mat-001",
    moduleName: "极限与连续",
    summary: "极限的定义、性质与计算",
    importance: 5,
    difficulty: 3,
    learnStatus: "learning",
    sourceEvidenceJson: JSON.stringify({ materialId: "mat-001", page: 12 }),
    aiGenerated: 1,
    createdAt: "2026-08-02T00:00:00Z",
    updatedAt: "2026-08-02T00:00:00Z",
  },
  {
    id: "mod-002",
    courseId: "course-001",
    materialId: "mat-001",
    moduleName: "导数与微分",
    summary: "导数的定义与运算法则",
    importance: 4,
    difficulty: 4,
    learnStatus: "not_started",
    sourceEvidenceJson: JSON.stringify({ materialId: "mat-001", page: 25 }),
    aiGenerated: 1,
    createdAt: "2026-08-02T00:00:00Z",
    updatedAt: "2026-08-02T00:00:00Z",
  },
];

// ---------- NotesTab 渲染 ----------

describe("NotesTab 组件（09-UI §4.5 笔记）", () => {
  it("渲染笔记预览内容", () => {
    const html = renderToStaticMarkup(
      React.createElement(NotesTab, { note: fixtureNote }),
    );
    expect(html).toContain("高等数学第一章");
    expect(html).toContain("极限与连续");
  });

  it("渲染知识模块列表", () => {
    const html = renderToStaticMarkup(
      React.createElement(NotesTab, { note: fixtureNote, modules: fixtureModules }),
    );
    expect(html).toContain("极限与连续");
    expect(html).toContain("导数与微分");
  });

  it("知识模块带 sourceEvidence 回链（§7.3）", () => {
    const html = renderToStaticMarkup(
      React.createElement(NotesTab, { note: fixtureNote, modules: fixtureModules }),
    );
    // 知识模块应展示回链提示（来源资料或证据非空）
    expect(html).toContain("来源");
  });

  it("渲染学习状态标识", () => {
    const html = renderToStaticMarkup(
      React.createElement(NotesTab, { note: fixtureNote, modules: fixtureModules }),
    );
    // 学习中状态
    expect(html).toContain("学习中");
    // 未开始状态
    expect(html).toContain("未开始");
  });

  it("渲染 TTS 朗读按钮位置（§5.2 预留）", () => {
    const html = renderToStaticMarkup(
      React.createElement(NotesTab, { note: fixtureNote }),
    );
    // 朗读按钮文案
    expect(html).toContain("朗读");
  });

  it("空状态：无笔记时渲染提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(NotesTab, { note: undefined }),
    );
    expect(html).toContain("暂无");
  });

  it("不展示完整 UUID（§11.1 隐私边界）", () => {
    const html = renderToStaticMarkup(
      React.createElement(NotesTab, { note: fixtureNote, modules: fixtureModules }),
    );
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
