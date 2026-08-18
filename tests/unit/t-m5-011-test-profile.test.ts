import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { initializeDataRoot } from "../../src/main/data-root-init";
import { seedTestProfile } from "../../src/main/test-profile";
import { DatabaseSync } from "../../src/data/sqlite";

const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-011\\test-profile-unit";
const previousFlag = process.env.PI_STUDYBUDDY_TEST_PROFILE;
let caseNumber = 0;
let dataRoot = "";

function restoreFlag(): void {
  if (previousFlag === undefined) delete process.env.PI_STUDYBUDDY_TEST_PROFILE;
  else process.env.PI_STUDYBUDDY_TEST_PROFILE = previousFlag;
}

describe("T-M5-011 方案 B 测试 profile", () => {
  beforeAll(() => {
    fs.rmSync(RUN_ROOT, { recursive: true, force: true });
  });

  beforeEach(() => {
    caseNumber += 1;
    dataRoot = path.join(RUN_ROOT, `case-${caseNumber}`);
    initializeDataRoot(dataRoot);
    delete process.env.PI_STUDYBUDDY_TEST_PROFILE;
  });

  afterEach(() => {
    restoreFlag();
  });

  it("TP-01 未显式启用时不写入合成业务数据", () => {
    seedTestProfile(dataRoot);
    const db = new DatabaseSync(path.join(dataRoot, "global.db"));
    const row = db.prepare("SELECT COUNT(*) AS count FROM semesters").get() as { count: number };
    db.close();

    expect(row.count).toBe(0);
    expect(fs.existsSync(path.join(dataRoot, ".test-profile-seeded"))).toBe(false);
  });

  it("TP-02 显式启用后经正式 handler 幂等创建合成 fixture 且不生成凭据", () => {
    process.env.PI_STUDYBUDDY_TEST_PROFILE = "1";
    seedTestProfile(dataRoot);
    seedTestProfile(dataRoot);

    const globalDb = new DatabaseSync(path.join(dataRoot, "global.db"));
    const semester = globalDb.prepare("SELECT id, semester_label FROM semesters").get() as {
      id: string;
      semester_label: string;
    };
    const semesterCount = globalDb.prepare("SELECT COUNT(*) AS count FROM semesters").get() as { count: number };
    globalDb.close();

    const semesterDb = new DatabaseSync(path.join(dataRoot, "semester", semester.id, "sem.db"));
    const counts = {
      courses: (semesterDb.prepare("SELECT COUNT(*) AS count FROM course_instances").get() as { count: number }).count,
      materials: (semesterDb.prepare("SELECT COUNT(*) AS count FROM materials").get() as { count: number }).count,
      modules: (semesterDb.prepare("SELECT COUNT(*) AS count FROM knowledge_modules").get() as { count: number }).count,
      exams: (semesterDb.prepare("SELECT COUNT(*) AS count FROM assessment_attempts WHERE confirmation_status = 'confirmed'").get() as { count: number }).count,
    };
    semesterDb.close();

    expect(semesterCount.count).toBe(1);
    expect(semester.semester_label).toBe("Synthetic Test Semester");
    expect(counts).toEqual({ courses: 1, materials: 1, modules: 1, exams: 1 });
    expect(fs.existsSync(path.join(dataRoot, ".test-profile-seeded"))).toBe(true);
    expect(fs.existsSync(path.join(dataRoot, "config", "credentials.json"))).toBe(false);
  });
});
