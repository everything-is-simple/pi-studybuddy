import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildStudyContextSections } from "../../src/agent/context-pack";

/**
 * T-M3-003 context-pack 扩展单件测试（03-Arch §2.3 + 09-UI §4.2）
 *
 * 在既有 L1 画像/学期/事件注入之上断言新增段：
 *   - sessionMeta.subject → 【当前学科】段
 *   - sessionMeta.goal → 【学习目标】段
 *   - sessionMeta.mistakeIds → 【关联错题】段（只含错因摘要，不含题干/答案/证据）
 *   - 缺失来源跳过对应段（不阻塞）
 *   - 错题注入经注入的查找器（mistakes.get 语义），可测试
 *
 * 数据隔离：H:\pi-studybuddy-tmp\runs\T-M3-003\context-pack\（AGENTS.md §5.3）
 */

const BASE = "H:\\pi-studybuddy-tmp\\runs\\T-M3-003\\context-pack";

describe("buildStudyContextSections（学科/目标/错题扩展）", () => {
  beforeAll(() => {
    rmSync(BASE, { recursive: true, force: true });
    mkdirSync(path.join(BASE, "memory", "l1"), { recursive: true });
  });

  afterAll(() => {
    for (let i = 0; i < 3; i++) {
      try {
        rmSync(BASE, { recursive: true, force: true });
        break;
      } catch {
        // 忽略 EBUSY
      }
    }
  });

  it("sessionMeta.subject + goal → 注入学科段与目标段", async () => {
    const { sections } = await buildStudyContextSections({
      dataRoot: BASE,
      sessionMeta: { subject: "高数", goal: "极限练习" },
    });
    const joined = sections.join("\n");
    expect(joined).toContain("当前学科");
    expect(joined).toContain("高数");
    expect(joined).toContain("学习目标");
    expect(joined).toContain("极限练习");
  });

  it("sessionMeta.mistakeIds → 经注入查找器读错题，只含摘要不含题干/答案/证据", async () => {
    const mistakeLookup = async (id: string) => {
      if (id === "mist-001") {
        return {
          id: "mist-001",
          errorCauseCategory: "concept_unclear",
          errorCauseSummary: "极限概念不清",
          // 模拟泄漏风险字段（应被过滤）
          questionContent: "题干原文不得注入",
          correctAnswer: "答案不得注入",
          evidence: ["证据原文不得注入"],
        };
      }
      return undefined;
    };

    const { sections } = await buildStudyContextSections({
      dataRoot: BASE,
      sessionMeta: { mistakeIds: ["mist-001"] },
      mistakeLookup,
    });
    const joined = sections.join("\n");
    expect(joined).toContain("关联错题");
    expect(joined).toContain("mist-001");
    expect(joined).toContain("极限概念不清");
    // 摘要白名单：题干/答案/证据不注入
    expect(joined).not.toContain("题干原文不得注入");
    expect(joined).not.toContain("答案不得注入");
    expect(joined).not.toContain("证据原文不得注入");
  });

  it("错题 ID 找不到 → 跳过该错题段（不阻塞）", async () => {
    const mistakeLookup = async () => undefined;
    const { sections } = await buildStudyContextSections({
      dataRoot: BASE,
      sessionMeta: { mistakeIds: ["mist-404"] },
      mistakeLookup,
    });
    const joined = sections.join("\n");
    expect(joined).not.toContain("关联错题");
  });

  it("无 sessionMeta → 不产生学科/目标/错题段（向后兼容）", async () => {
    const { sections } = await buildStudyContextSections({ dataRoot: BASE });
    const joined = sections.join("\n");
    expect(joined).not.toContain("当前学科");
    expect(joined).not.toContain("学习目标");
    expect(joined).not.toContain("关联错题");
  });

  it("既有 L1 画像段保持注入", async () => {
    writeFileSync(
      path.join(BASE, "memory", "l1", "learner-profile.json"),
      JSON.stringify({
        basic_info: { name: "小明", grade_level: "高三" },
        learning_preferences: { preferred_subjects: ["数学"] },
        goals: ["极限练习"],
      }),
      "utf8",
    );
    const { sections } = await buildStudyContextSections({
      dataRoot: BASE,
      sessionMeta: { subject: "数学", goal: "极限练习" },
    });
    const joined = sections.join("\n");
    expect(joined).toContain("小明");
    expect(joined).toContain("当前学科");
  });
});
