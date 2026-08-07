import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DatabaseSync } from "../../src/data/sqlite";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import {
  initGlobalDb,
  GLOBAL_TABLES,
  GLOBAL_INDEXES,
} from "../../src/data/global";
import {
  initSemesterDb,
  SEMESTER_TABLES,
  SEMESTER_TRIGGERS,
} from "../../src/data/semester";
import { initConversationDb } from "../../src/data/memory";
import { applyPragmas, assertIntegrity } from "../../src/data/db";
import { initMemoryL1, initMemoryL2, initMemoryL3 } from "../../src/data/memory";

/**
 * T-M0-006 数据层 schema 单件测试（05-ERD §2-§4 + §6 + §9）
 *
 * 断言建库后 sqlite_master 实际存在：
 *   - global.db 4 表 + 8 索引（GLOBAL-XX）
 *   - semester.db 25 表 + 9 触发器（SEMESTER-XX）
 *   - CHECK / UNIQUE 约束生效
 *   - 9 个触发器行为生效（TRG-XX）
 *   - PRAGMA 配置（PRAGMA-01）
 *   - L3 FTS5 虚拟表 + L1/L2 目录骨架（L3-01 / L1L2-01）
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M0-006\，不污染业务数据根。
 */

const ISOLATION_DIR = path.join(
  process.env.LOCALAPPDATA
    ? "H:\\pi-studybuddy-tmp\\runs\\T-M0-006"
    : "H:\\pi-studybuddy-tmp\\runs\\T-M0-006",
);

function isoDir(): string {
  const dir = path.join(ISOLATION_DIR, "unit");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** 通用 ISO 8601 UTC 时间戳（审计列 created_at/updated_at 无默认值，fixture 需显式提供） */
const TS = "2026-08-07T00:00:00Z";

/** 查 sqlite_master 中指定类型的对象名集合 */
function masterNames(db: DatabaseSync, type: string): Set<string> {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = ? ORDER BY name")
    .all(type) as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

describe("T-M0-006 数据层 schema 单件测试", () => {
  let db: DatabaseSync;

  beforeAll(() => {
    mkdirSync(ISOLATION_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
  });

  describe("GLOBAL 全局库 schema（05-ERD §2 + §7.1）", () => {
    beforeAll(() => {
      db = new DatabaseSync(":memory:");
      applyPragmas(db);
      initGlobalDb(db);
    });

    afterAll(() => {
      db.close();
    });

    it("GLOBAL-01 initGlobalDb 后含 4 表 + 8 索引", () => {
      const tables = masterNames(db, "table");
      for (const t of GLOBAL_TABLES) expect(tables).toContain(t);
      const indexes = masterNames(db, "index");
      for (const i of GLOBAL_INDEXES) expect(indexes).toContain(i);
      expect(GLOBAL_TABLES.length).toBe(4);
      expect(GLOBAL_INDEXES.length).toBe(8);
    });

    it("GLOBAL-02 semesters CHECK 约束生效（非法 status / 越界日期拒绝）", () => {
      const baseCols = `(id, student_name, semester_label, start_date, end_date, db_relative_path, created_at, updated_at)`;
      const ok = db.prepare(
        `INSERT INTO semesters ${baseCols}
         VALUES (@id, '学生', '2026 秋', '2026-09-01', '2027-01-15', 'semester/2026-autumn/sem.db', '${TS}', '${TS}')`,
      );
      expect(() => ok.run({ id: "s-ok" })).not.toThrow();
      // 非法 status → CHECK 拒绝
      const bad = db.prepare(
        `INSERT INTO semesters (id, student_name, semester_label, start_date, end_date, db_relative_path, status, created_at, updated_at)
         VALUES (@id, '学生', '2026 秋', '2026-09-01', '2027-01-15', 'semester/x/sem.db', 'bogus', '${TS}', '${TS}')`,
      );
      expect(() => bad.run({ id: "s-bad" })).toThrow(/CHECK/);
      // end_date > start_date 违反 → CHECK 拒绝
      const badRange = db.prepare(
        `INSERT INTO semesters ${baseCols}
         VALUES (@id, '学生', '2026 秋', '2027-01-15', '2026-09-01', 'semester/x/sem.db', '${TS}', '${TS}')`,
      );
      expect(() => badRange.run({ id: "s-range" })).toThrow(/CHECK/);
    });
  });

  describe("SEMESTER 学期库 schema（05-ERD §3）", () => {
    beforeAll(() => {
      db = new DatabaseSync(":memory:");
      applyPragmas(db);
      initSemesterDb(db);
    });

    afterAll(() => {
      db.close();
    });

    it("SEMESTER-01 initSemesterDb 后含 25 表 + 9 触发器", () => {
      const tables = masterNames(db, "table");
      for (const t of SEMESTER_TABLES) expect(tables).toContain(t);
      const triggers = masterNames(db, "trigger");
      for (const trg of SEMESTER_TRIGGERS) expect(triggers).toContain(trg);
      expect(SEMESTER_TABLES.length).toBe(25);
      expect(SEMESTER_TRIGGERS.length).toBe(9);
    });

    it("SEMESTER-02 schedule_entries CHECK（end_time > start_time）生效", () => {
      db.prepare(
        `INSERT INTO course_instances (id, semester_id, course_name, subject, created_at, updated_at)
         VALUES ('c1', 's1', '数学', '数学', '${TS}', '${TS}')`,
      ).run();
      const ok = db.prepare(
        `INSERT INTO schedule_entries (id, course_instance_id, weekday, start_time, end_time, created_at, updated_at)
         VALUES ('e1', 'c1', 1, '08:00', '09:00', '${TS}', '${TS}')`,
      );
      expect(() => ok.run()).not.toThrow();
      const bad = db.prepare(
        `INSERT INTO schedule_entries (id, course_instance_id, weekday, start_time, end_time, created_at, updated_at)
         VALUES ('e2', 'c1', 1, '09:00', '08:00', '${TS}', '${TS}')`,
      );
      expect(() => bad.run()).toThrow();
    });

    it("SEMESTER-03 mock_exam_questions CHECK（选择题必有 options / 填空无 options）生效", () => {
      // 完整父链：course → assessment_attempt(confirmed) → mock_exam_paper
      db.prepare(
        `INSERT INTO course_instances (id, semester_id, course_name, subject, created_at, updated_at)
         VALUES ('c3', 's1', '数学', '数学', '${TS}', '${TS}')`,
      ).run();
      db.prepare(
        `INSERT INTO assessment_attempts (id, course_instance_id, exam_name, exam_type, confirmation_status, created_at, updated_at)
         VALUES ('aa3', 'c3', '期中', 'midterm', 'confirmed', '${TS}', '${TS}')`,
      ).run();
      db.prepare(
        `INSERT INTO mock_exam_papers (id, course_instance_id, assessment_attempt_id, paper_title, question_count, total_score, source_hash, ai_model, prompt_version, generated_at, created_at)
         VALUES ('p3', 'c3', 'aa3', '模拟卷', 5, 100, 'hash', 'model', 'v1', '${TS}', '${TS}')`,
      ).run();
      // 填空题型带 options → CHECK 拒绝
      const badFill = db.prepare(
        `INSERT INTO mock_exam_questions (id, mock_paper_id, question_index, question_type, question_stem, options_json, score, created_at)
         VALUES ('q1', 'p3', 0, 'fill_blank', '题干', '["a"]', 1, '${TS}')`,
      );
      expect(() => badFill.run()).toThrow();
      // 选择题无 options → CHECK 拒绝
      const badChoice = db.prepare(
        `INSERT INTO mock_exam_questions (id, mock_paper_id, question_index, question_type, question_stem, score, created_at)
         VALUES ('q2', 'p3', 1, 'single_choice', '题干', 1, '${TS}')`,
      );
      expect(() => badChoice.run()).toThrow();
    });
  });

  describe("TRG 学期库触发器行为（05-ERD §6）", () => {
    beforeAll(() => {
      db = new DatabaseSync(":memory:");
      applyPragmas(db);
      initSemesterDb(db);
    });

    afterAll(() => {
      db.close();
    });

    it("TRG-01 trg_question_course_consistency：question 与 practice_session course 不一致被拒", () => {
      db.prepare(
        `INSERT INTO course_instances (id, semester_id, course_name, subject, created_at, updated_at) VALUES ('cA', 's1', '数学', '数学', '${TS}', '${TS}')`,
      ).run();
      db.prepare(
        `INSERT INTO course_instances (id, semester_id, course_name, subject, created_at, updated_at) VALUES ('cB', 's1', '物理', '物理', '${TS}', '${TS}')`,
      ).run();
      db.prepare(
        `INSERT INTO practice_sessions (id, course_instance_id, question_count, question_types_json, module_ids_json, started_at, created_at)
         VALUES ('ps1', 'cA', 5, '{}', '[]', '${TS}', '${TS}')`,
      ).run();
      // question 挂在 cB，但 session 属于 cA → 拒绝
      const bad = db.prepare(
        `INSERT INTO questions (id, practice_session_id, course_instance_id, question_type, question_stem, score, created_at)
         VALUES ('q1', 'ps1', 'cB', 'single_choice', '题干', 1, '${TS}')`,
      );
      expect(() => bad.run()).toThrow();
    });

    it("TRG-02 trg_mistake_idempotent_archive：同一 question 重复建 mistake 被拒", () => {
      db.prepare(
        `INSERT INTO course_instances (id, semester_id, course_name, subject, created_at, updated_at) VALUES ('c1t', 's1', '数学', '数学', '${TS}', '${TS}')`,
      ).run();
      db.prepare(
        `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, uploaded_at, created_at, updated_at)
         VALUES ('m1', 'c1t', 'a.pdf', 'pdf', 1, 'application/pdf', 'materials/m1.pdf', '${TS}', '${TS}', '${TS}')`,
      ).run();
      db.prepare(
        `INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name, source_evidence_json, created_at, updated_at)
         VALUES ('km1', 'c1t', 'm1', '极限', '{}', '${TS}', '${TS}')`,
      ).run();
      db.prepare(
        `INSERT INTO questions (id, course_instance_id, question_type, question_stem, score, created_at)
         VALUES ('q1t', 'c1t', 'fill_blank', '题干', 1, '${TS}')`,
      ).run();
      const insertMistake = db.prepare(
        `INSERT INTO mistakes (id, question_id, course_instance_id, created_at, updated_at)
         VALUES (@id, 'q1t', 'c1t', '${TS}', '${TS}')`,
      );
      insertMistake.run({ id: "mk1" });
      // 同一 question 再次建 mistake → 幂等拒绝
      expect(() => insertMistake.run({ id: "mk2" })).toThrow();
    });

    it("TRG-03 trg_mockpaper_attempt_confirmed：unconfirmed 考试建模拟卷被拒", () => {
      db.prepare(
        `INSERT INTO course_instances (id, semester_id, course_name, subject, created_at, updated_at) VALUES ('c1m', 's1', '数学', '数学', '${TS}', '${TS}')`,
      ).run();
      db.prepare(
        `INSERT INTO assessment_attempts (id, course_instance_id, exam_name, exam_type, created_at, updated_at)
         VALUES ('aa1', 'c1m', '期中', 'midterm', '${TS}', '${TS}')`,
      ).run();
      const bad = db.prepare(
        `INSERT INTO mock_exam_papers (id, course_instance_id, assessment_attempt_id, paper_title, question_count, total_score, source_hash, ai_model, prompt_version, generated_at, created_at)
         VALUES ('p1', 'c1m', 'aa1', '模拟卷', 5, 100, 'hash', 'model', 'v1', '${TS}', '${TS}')`,
      );
      expect(() => bad.run()).toThrow();
    });

    it("TRG-04 trg_material_storage_key_safety：storage_key 含 .. 或 : 被拒（08-Test §5.4）", () => {
      db.prepare(
        `INSERT INTO course_instances (id, semester_id, course_name, subject, created_at, updated_at) VALUES ('c1s', 's1', '数学', '数学', '${TS}', '${TS}')`,
      ).run();
      const badDot = db.prepare(
        `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, uploaded_at, created_at, updated_at)
         VALUES ('m1', 'c1s', 'a.pdf', 'pdf', 1, 'application/pdf', '../evil.pdf', '${TS}', '${TS}', '${TS}')`,
      );
      expect(() => badDot.run()).toThrow();
      const badColon = db.prepare(
        `INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, uploaded_at, created_at, updated_at)
         VALUES ('m2', 'c1s', 'a.pdf', 'pdf', 1, 'application/pdf', 'C:/evil.pdf', '${TS}', '${TS}', '${TS}')`,
      );
      expect(() => badColon.run()).toThrow();
    });
  });

  describe("PRAGMA 配置（05-ERD §9）", () => {
    it("PRAGMA-01 journal_mode=wal + foreign_keys=1", () => {
      // WAL 仅对持久化文件库生效（:memory: 恒为 memory），故用隔离目录文件库验证
      const file = path.join(isoDir(), "pragma.db");
      rmSync(file, { force: true });
      const d = new DatabaseSync(file);
      applyPragmas(d);
      const jm = d.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
      expect(jm.journal_mode).toBe("wal");
      const fk = d.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
      expect(fk.foreign_keys).toBe(1);
      d.close();
    });
  });

  describe("L3 / L1 / L2 三层记忆（05-ERD §4）", () => {
    it("L3-01 initConversationDb 创建 chunks 表 + chunks_fts 虚拟表", () => {
      const d = new DatabaseSync(":memory:");
      applyPragmas(d);
      initConversationDb(d);
      const names = masterNames(d, "table");
      expect(names).toContain("chunks");
      expect(names).toContain("chunks_fts");
      d.close();
    });

    it("L1/L2-01 initMemoryL1/L2 创建目录骨架 + 默认 JSON", () => {
      const dir = path.join(isoDir(), "l1l2");
      rmSync(dir, { recursive: true, force: true });
      initMemoryL1(dir);
      initMemoryL2(dir);
      expect(existsSync(path.join(dir, "memory", "l1", "learner-profile.json"))).toBe(true);
      expect(existsSync(path.join(dir, "memory", "l1", "events.jsonl"))).toBe(true);
      expect(existsSync(path.join(dir, "memory", "l2", "wiki-index", "inverted_index.json"))).toBe(true);
      expect(existsSync(path.join(dir, "memory", "l2", "wiki-index", "graph_edges.json"))).toBe(true);
    });

    it("L3-02 initMemoryL3 创建 conversation.sqlite 且 integrity ok", () => {
      const dir = path.join(isoDir(), "l3");
      rmSync(dir, { recursive: true, force: true });
      const result = initMemoryL3(dir);
      expect(existsSync(path.join(dir, "memory", "l3", "conversation.sqlite"))).toBe(true);
      expect(() => assertIntegrity(result.db)).not.toThrow();
      result.db.close();
    });
  });
});