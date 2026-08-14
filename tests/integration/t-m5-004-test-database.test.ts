import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { DatabaseSync } from "../../src/data/sqlite";
import { applyPragmas } from "../../src/data/db";
import { prepareSprintTestDatabase } from "../helpers/test-database";

const TEST_DB_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-004\\test-database-builder";
const PRODUCTION_ROOT = path.join(process.env.LOCALAPPDATA ?? "C:\\Users\\Administrator\\AppData\\Local", "PiStudyBuddy");

describe("T-M5-004 专用测试数据库", () => {
  it("TESTDB-00：专用测试数据库根与真实业务数据根物理隔离", () => {
    expect(path.resolve(TEST_DB_ROOT).toLowerCase()).not.toBe(path.resolve(PRODUCTION_ROOT).toLowerCase());
    expect(TEST_DB_ROOT).toContain("pi-studybuddy-tmp");
  });

  it("TESTDB-01：用真实 SQLite + 正式 handler 构造 S1-S5 样本，并可由新连接读回", () => {
    const fixture = prepareSprintTestDatabase(TEST_DB_ROOT);
    expect(fs.existsSync(path.join(TEST_DB_ROOT, "global.db"))).toBe(true);
    const semesterDbPath = path.join(TEST_DB_ROOT, "semester", fixture.semesterId, "sem.db");
    expect(fs.existsSync(semesterDbPath)).toBe(true);

    const globalDb = new DatabaseSync(path.join(TEST_DB_ROOT, "global.db"));
    const semesterDb = new DatabaseSync(semesterDbPath);
    applyPragmas(globalDb);
    applyPragmas(semesterDb);
    try {
      const semester = globalDb.prepare("SELECT id FROM semesters WHERE id = @id").get({ id: fixture.semesterId }) as { id: string } | undefined;
      const course = semesterDb.prepare("SELECT id FROM course_instances WHERE id = @id").get({ id: fixture.courseId }) as { id: string } | undefined;
      const material = semesterDb.prepare("SELECT id, status FROM materials WHERE id = @id").get({ id: fixture.materialId }) as { id: string; status: string } | undefined;
      const module = semesterDb.prepare("SELECT id, material_id FROM knowledge_modules WHERE id = @id").get({ id: fixture.moduleId }) as { id: string; material_id: string } | undefined;
      const exams = semesterDb.prepare("SELECT confirmation_status FROM assessment_attempts WHERE id IN (@confirmed, @unconfirmed) ORDER BY confirmation_status").all({ confirmed: fixture.confirmedExamId, unconfirmed: fixture.unconfirmedExamId }) as Array<{ confirmation_status: string }>;

      expect(semester?.id).toBe(fixture.semesterId);
      expect(course?.id).toBe(fixture.courseId);
      expect(material).toMatchObject({ id: fixture.materialId, status: "converted" });
      expect(module).toMatchObject({ id: fixture.moduleId, material_id: fixture.materialId });
      expect(exams.map((row) => row.confirmation_status).sort()).toEqual(["confirmed", "pending"]);
    } finally {
      globalDb.close();
      semesterDb.close();
    }
  });

});
