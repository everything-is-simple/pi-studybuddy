import { describe, it, expect } from "vitest";
import { tokenizeBigram, buildMatchQuery } from "../../src/data/l3/bigram";

/**
 * T-M3-003 L3 承载层 bigram 分词器单件测试（05-ERD §4.3）
 *
 * 断言：
 *   - CJK 切 bigram："学习计划" → ["学习","习计","计划"]
 *   - ASCII 整词小写："practice" → ["practice"]
 *   - 混合文本分段处理
 *   - 完整 UUID 不产出 token（UUID 泄漏基线 7/7 不可破）
 *   - OR-combined MATCH 查询构造
 */

describe("tokenizeBigram", () => {
  it("CJK 切 bigram：学习计划 → 学习/习计/计划", () => {
    expect(tokenizeBigram("学习计划")).toEqual(["学习", "习计", "计划"]);
  });

  it("CJK 两字词：高等数学 → 高等/等数/数学", () => {
    expect(tokenizeBigram("高等数学")).toEqual(["高等", "等数", "数学"]);
  });

  it("单 CJK 字不产出 bigram（长度不足）", () => {
    expect(tokenizeBigram("学")).toEqual([]);
  });

  it("ASCII 整词小写：practice → practice", () => {
    expect(tokenizeBigram("practice")).toEqual(["practice"]);
  });

  it("ASCII 大小写归一化为小写", () => {
    expect(tokenizeBigram("Practice")).toEqual(["practice"]);
    expect(tokenizeBigram("LIMIT")).toEqual(["limit"]);
  });

  it("混合文本：CJK bigram + ASCII 词分别处理", () => {
    const tokens = tokenizeBigram("极限练习 practice");
    expect(tokens).toContain("极限");
    expect(tokens).toContain("限练");
    expect(tokens).toContain("练习");
    expect(tokens).toContain("practice");
  });

  it("完整 UUID 不产出 token（UUID 泄漏基线）", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(tokenizeBigram(`历史会话 ${uuid} 检索`)).not.toContain(uuid);
    // UUID 中的 ASCII 片段不应被整词索引
    expect(tokenizeBigram(uuid)).toEqual([]);
  });

  it("标点/空白分隔的 ASCII 词各自成词", () => {
    expect(tokenizeBigram("epsilon-delta")).toEqual(["epsilon", "delta"]);
  });

  it("空输入/纯标点 → 空数组", () => {
    expect(tokenizeBigram("")).toEqual([]);
    expect(tokenizeBigram("  ，。！ ")).toEqual([]);
  });
});

describe("buildMatchQuery", () => {
  it("OR-combined MATCH 查询构造", () => {
    expect(buildMatchQuery(["学习", "习计", "计划"])).toBe('"学习" OR "习计" OR "计划"');
  });

  it("空 token → 空查询", () => {
    expect(buildMatchQuery([])).toBe("");
  });

  it("单个 token 不加 OR", () => {
    expect(buildMatchQuery(["极限"])).toBe('"极限"');
  });
});
