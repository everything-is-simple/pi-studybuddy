import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { updateLearnerProfile } from "../../src/data/l1-profile";

/**
 * T-M3-003 L1 画像写回单件测试（05-ERD §4.1）
 *
 * 断言：
 *   - preferred_subjects / goals 写回 learner-profile.json
 *   - version "1.0" 保持不变（结构兼容）
 *   - 其他字段（basic_info/learning_preferences 其余项）不被破坏
 *   - 原子写：无 .tmp 残留文件
 *   - 画像文件缺失时创建默认结构后再写回
 *
 * 数据隔离：H:\pi-studybuddy-tmp\runs\T-M3-003\l1\（AGENTS.md §5.3）
 */

const BASE = "H:\\pi-studybuddy-tmp\\runs\\T-M3-003\\l1";

describe("updateLearnerProfile", () => {
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

  const profilePath = () => path.join(BASE, "memory", "l1", "learner-profile.json");

  it("写回 preferred_subjects + goals，version 保持不变，其他字段不破坏", () => {
    writeFileSync(
      profilePath(),
      JSON.stringify({
        version: "1.0",
        student_id: "local-student",
        basic_info: { name: "小明", grade_level: "高三" },
        learning_preferences: { preferred_subjects: ["数学"], difficulty_tolerance: 3, review_style: "spaced_repetition" },
        weak_points_summary: [],
        goals: [],
        study_patterns: { avg_daily_minutes: 60, most_productive_time: "20:00", consistency_score: 0.5 },
      }),
      "utf8",
    );

    updateLearnerProfile(BASE, { preferred_subjects: ["数学", "物理"], goals: ["极限练习"] });

    const profile = JSON.parse(readFileSync(profilePath(), "utf8"));
    expect(profile.version).toBe("1.0");
    expect(profile.basic_info.name).toBe("小明");
    expect(profile.learning_preferences.preferred_subjects).toEqual(["数学", "物理"]);
    expect(profile.goals).toEqual(["极限练习"]);
    expect(profile.learning_preferences.difficulty_tolerance).toBe(3);
    expect(profile.study_patterns.avg_daily_minutes).toBe(60);
  });

  it("原子写：无 .tmp 残留文件", () => {
    const leftovers = readdirSync(path.join(BASE, "memory", "l1")).filter((f) => f.includes(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("画像文件缺失时创建默认结构再写回（不抛错）", () => {
    const empty = path.join(BASE, "fresh");
    mkdirSync(path.join(empty, "memory", "l1"), { recursive: true });

    updateLearnerProfile(empty, { preferred_subjects: ["化学"], goals: ["期中冲刺"] });

    expect(existsSync(path.join(empty, "memory", "l1", "learner-profile.json"))).toBe(true);
    const profile = JSON.parse(readFileSync(path.join(empty, "memory", "l1", "learner-profile.json"), "utf8"));
    expect(profile.version).toBe("1.0");
    expect(profile.learning_preferences.preferred_subjects).toEqual(["化学"]);
    expect(profile.goals).toEqual(["期中冲刺"]);
  });

  it("部分更新：只写 preferred_subjects 不碰 goals（缺省参数不覆盖）", () => {
    writeFileSync(
      profilePath(),
      JSON.stringify({ version: "1.0", goals: ["已有目标"], learning_preferences: { preferred_subjects: [] } }),
      "utf8",
    );

    updateLearnerProfile(BASE, { preferred_subjects: ["英语"] });

    const profile = JSON.parse(readFileSync(profilePath(), "utf8"));
    expect(profile.learning_preferences.preferred_subjects).toEqual(["英语"]);
    expect(profile.goals).toEqual(["已有目标"]);
  });
});
