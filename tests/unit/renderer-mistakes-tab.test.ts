/**
 * T-M1-009 RED: MistakesTab 错题 Tab 静态渲染测试
 *
 * 权威依据：09-UI §4.7（错题改错与薄弱点）+ §7.3（错因学生确认 + AI 不确定标记）
 *
 * 测试策略：
 * - 错题列表 + ShortId（不展示完整 UUID）
 * - 错因六分类选项
 * - AI 建议含"仅供参考"字样（不确定标记）
 * - 重做按钮
 * - 薄弱点列表 + 状态机
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MistakesTab } from "../../src/renderer/components/tabs/MistakesTab";
import type { Mistake, WeakPoint, MistakeWithEvidence } from "../../src/contract/types";

// ---------- 夹具数据 ----------

const fixtureMistakes: Mistake[] = [
  {
    id: "a1b2c3d4-5678-9012-abcd-ef0123456789",
    questionId: "q-001",
    courseId: "course-001",
    status: "needs_review",
    redoCount: 0,
    errorCategory: "concept_unclear",
    errorCause: "对极限的 ε-δ 定义理解不深",
    errorCauseConfirmedBy: "student",
    errorCauseAiSuggestion: "可能是对 ε-δ 定义中任意性与存在性的混淆",
    createdAt: "2026-08-05T00:00:00Z",
    updatedAt: "2026-08-05T00:00:00Z",
  },
  {
    id: "b2c3d4e5-6789-0123-abcd-ef1234567890",
    questionId: "q-002",
    courseId: "course-001",
    status: "mastered",
    redoCount: 1,
    lastRedoCorrect: 1,
    masteredAt: "2026-08-07T00:00:00Z",
    createdAt: "2026-08-04T00:00:00Z",
    updatedAt: "2026-08-07T00:00:00Z",
  },
];

const fixtureMistakeWithEvidence: MistakeWithEvidence = {
  ...fixtureMistakes[0],
  evidence: [
    {
      id: "evi-001",
      mistakeId: fixtureMistakes[0].id,
      sourcePracticeAnswerId: "pa-001",
      evidenceType: "initial_wrong",
      recordedAt: "2026-08-05T00:00:00Z",
      createdAt: "2026-08-05T00:00:00Z",
    },
  ],
};

const fixtureWeakPoints: WeakPoint[] = [
  {
    id: "wp-001",
    courseId: "course-001",
    moduleId: "mod-001",
    status: "active",
    evidenceCount: 3,
    firstEvidencedAt: "2026-08-01T00:00:00Z",
    lastEvidencedAt: "2026-08-07T00:00:00Z",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-07T00:00:00Z",
  },
];

// ---------- MistakesTab 错题列表 ----------

describe("MistakesTab 错题列表（09-UI §4.7）", () => {
  it("渲染错题列表", () => {
    const html = renderToStaticMarkup(
      React.createElement(MistakesTab, { mistakes: fixtureMistakes }),
    );
    // 渲染错题条目（至少有错题相关标识）
    expect(html).toContain("错题");
  });

  it("ShortId：不展示完整 UUID（§11.1 铁律）", () => {
    const html = renderToStaticMarkup(
      React.createElement(MistakesTab, { mistakes: fixtureMistakes }),
    );
    // 不含完整 UUID（36 字符格式）
    expect(html).not.toContain("a1b2c3d4-5678-9012-abcd-ef0123456789");
    expect(html).not.toContain("b2c3d4e5-6789-0123-abcd-ef1234567890");
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("ShortId：展示短 ID（前 8 位 + …）", () => {
    const html = renderToStaticMarkup(
      React.createElement(MistakesTab, { mistakes: fixtureMistakes }),
    );
    expect(html).toContain("a1b2c3d4");
    expect(html).toContain("…");
  });

  it("渲染错题状态：needs_review（待复习）", () => {
    const html = renderToStaticMarkup(
      React.createElement(MistakesTab, { mistakes: fixtureMistakes }),
    );
    expect(html).toContain("待复习");
  });

  it("渲染错题状态：mastered（已掌握）", () => {
    const html = renderToStaticMarkup(
      React.createElement(MistakesTab, { mistakes: fixtureMistakes }),
    );
    expect(html).toContain("已掌握");
  });
});

// ---------- MistakesTab 错因六分类 + AI 不确定标记 ----------

describe("MistakesTab 错因六分类 + AI 不确定标记（§7.3）", () => {
  it("渲染错因六分类选项", () => {
    const html = renderToStaticMarkup(
      React.createElement(MistakesTab, {
        mistakes: fixtureMistakes,
        selectedMistake: fixtureMistakeWithEvidence,
      }),
    );
    // 六分类中文标签
    expect(html).toContain("概念不清");
    expect(html).toContain("看错题");
    expect(html).toContain("公式错");
    expect(html).toContain("步骤缺");
    expect(html).toContain("时间紧");
    expect(html).toContain("其他");
  });

  it('AI 建议含"仅供参考"字样（§7.3 不确定标记）', () => {
    const html = renderToStaticMarkup(
      React.createElement(MistakesTab, {
        mistakes: fixtureMistakes,
        selectedMistake: fixtureMistakeWithEvidence,
      }),
    );
    // AI 建议应带"仅供参考"标记
    expect(html).toContain("仅供参考");
  });

  it("渲染学生已确认的错因", () => {
    const html = renderToStaticMarkup(
      React.createElement(MistakesTab, {
        mistakes: fixtureMistakes,
        selectedMistake: fixtureMistakeWithEvidence,
      }),
    );
    expect(html).toContain("对极限的 ε-δ 定义理解不深");
  });

  it("渲染重做按钮", () => {
    const html = renderToStaticMarkup(
      React.createElement(MistakesTab, {
        mistakes: fixtureMistakes,
        selectedMistake: fixtureMistakeWithEvidence,
      }),
    );
    expect(html).toContain("重做");
  });
});

// ---------- MistakesTab 薄弱点列表 ----------

describe("MistakesTab 薄弱点列表（§4.7）", () => {
  it("渲染薄弱点列表", () => {
    const html = renderToStaticMarkup(
      React.createElement(MistakesTab, {
        mistakes: fixtureMistakes,
        weakPoints: fixtureWeakPoints,
      }),
    );
    expect(html).toContain("薄弱点");
  });

  it("渲染薄弱点状态：active（活跃）", () => {
    const html = renderToStaticMarkup(
      React.createElement(MistakesTab, {
        mistakes: fixtureMistakes,
        weakPoints: fixtureWeakPoints,
      }),
    );
    expect(html).toContain("活跃");
  });

  it("渲染薄弱点证据数", () => {
    const html = renderToStaticMarkup(
      React.createElement(MistakesTab, {
        mistakes: fixtureMistakes,
        weakPoints: fixtureWeakPoints,
      }),
    );
    expect(html).toContain("3");
  });

  it("渲染 TTS 朗读按钮位置（§5.2 预留）", () => {
    const html = renderToStaticMarkup(
      React.createElement(MistakesTab, {
        mistakes: fixtureMistakes,
        selectedMistake: fixtureMistakeWithEvidence,
      }),
    );
    expect(html).toContain("朗读");
  });
});

// ---------- MistakesTab 空状态 ----------

describe("MistakesTab 空状态", () => {
  it("无错题时渲染提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(MistakesTab, { mistakes: [] }),
    );
    expect(html).toContain("暂无");
  });
});
