import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildStudyContextSections } from "../../src/agent/context-pack";
import { createGlobalDb } from "../../src/data/global";
import { createSemesterDb } from "../../src/data/semester";

/**
 * T-M1-008 context-pack 单件测试（03-Arch §2.3 before_agent_start 多源上下文注入）
 *
 * 断言：
 *   - 无 L1 画像 + 无库 → sections 为空
 *   - 有 L1 画像 + 激活学期 + 课程 + 最近事件 → sections 含画像/学期/课程/事件
 *   - 有 L1 画像但无激活学期 → 仅含 L1 段
 *
 * 数据隔离：H:\pi-studybuddy-tmp\runs\T-M1-008\context-pack\（AGENTS.md §5.3）
 */

const BASE = "H:\\pi-studybuddy-tmp\\runs\\T-M1-008\\context-pack";

function now(): string {
  return new Date().toISOString();
}

describe("buildStudyContextSections", () => {
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

  it("无 L1 画像 + 无库 → sections 为空", async () => {
    const { sections } = await buildStudyContextSections({ dataRoot: BASE });
    expect(sections).toEqual([]);
  });

  it("有 L1 画像 + 激活学期 + 课程 + 最近事件 → sections 含画像/学期/课程/事件", async () => {
    // L1 画像
    writeFileSync(
      path.join(BASE, "memory", "l1", "learner-profile.json"),
      JSON.stringify({
        basic_info: { name: "小明", grade_level: "高三" },
        learning_preferences: { preferred_subjects: ["数学", "物理"] },
      }),
      "utf8",
    );

    // 激活学期 + 课程
    const global = createGlobalDb(BASE);
    global.db
      .prepare(
        `INSERT INTO semesters
          (id, student_name, semester_label, start_date, end_date, timezone, status, db_relative_path, ready, created_at, updated_at)
         VALUES (@id, @sn, @label, @start, @end, 'Asia/Shanghai', 'active', @path, 1, @now, @now)`,
      )
      .run({
        id: "sem-1",
        sn: "小明",
        label: "2026春季",
        start: "2026-02-01",
        end: "2026-07-31",
        path: "semester/sem-1/sem.db",
        now: now(),
      });

    const sem = createSemesterDb(BASE, "sem-1");
    sem.db
      .prepare(
        `INSERT INTO course_instances
          (id, semester_id, course_name, subject, created_at, updated_at)
         VALUES (@id, @sem, @name, @subject, @now, @now)`,
      )
      .run({ id: "c-1", sem: "sem-1", name: "高等数学", subject: "数学", now: now() });

    // 最近事件
    writeFileSync(
      path.join(BASE, "memory", "l1", "events.jsonl"),
      ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9"].map((e) => JSON.stringify({ id: e })).join("\n"),
      "utf8",
    );

    const { sections } = await buildStudyContextSections({ dataRoot: BASE });
    const joined = sections.join("\n");
    expect(joined).toContain("小明");
    expect(joined).toContain("高三");
    expect(joined).toContain("数学、物理");
    expect(joined).toContain("2026春季");
    expect(joined).toContain("高等数学");
    // 最近事件取末尾 8 行（e2~e9），不含最早 e1
    expect(joined).toContain("e9");
    expect(joined).not.toContain('"id":"e1"');

    global.db.close();
    sem.db.close();
  });

  it("有 L1 画像但无激活学期 → 仅含 L1 段（无学期/课程段）", async () => {
    // 复用上一用例已创建的 L1 画像；此处用全新空目录模拟只有画像
    const empty = path.join(BASE, "profile-only");
    mkdirSync(path.join(empty, "memory", "l1"), { recursive: true });
    writeFileSync(
      path.join(empty, "memory", "l1", "learner-profile.json"),
      JSON.stringify({ basic_info: { name: "小红" }, learning_preferences: { preferred_subjects: [] } }),
      "utf8",
    );

    const { sections } = await buildStudyContextSections({ dataRoot: empty });
    const joined = sections.join("\n");
    expect(joined).toContain("小红");
    expect(joined).not.toContain("当前学期");
  });
});