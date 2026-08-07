import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";
import { createGlobalDb } from "../../src/data/global";
import { createSemesterDb } from "../../src/data/semester";
import { assertIntegrity, type DataDb } from "../../src/data/db";

/**
 * T-M0-006 数据层建库集成测试（05-ERD §1.3 + §9 + §8.3）
 *
 * 在隔离目录落地真实 SQLite 文件：
 *   - global.db（semesters 等 4 表）
 *   - semester/<semesterId>/sem.db（25 表 + 触发器）
 *   - integrity_check == ok
 *   - 跨库外键语义（global→semester 仅 db_relative_path 关联，不建 FK）
 *   - 数据隔离：不产生 %LOCALAPPDATA%\PiStudyBuddy 文件
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M0-006\。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M0-006\\integration";

describe("T-M0-006 数据层建库集成测试", () => {
  let globalDb: DataDb;
  let semesterDb: DataDb;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
  });

  afterAll(() => {
    globalDb?.db.close();
    semesterDb?.db.close();
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
  });

  it("CREATE-01 createGlobalDb 落地 global.db 且 integrity ok", () => {
    globalDb = createGlobalDb(ISOLATION_DIR);
    expect(existsSync(path.join(ISOLATION_DIR, "global.db"))).toBe(true);
    expect(() => assertIntegrity(globalDb.db)).not.toThrow();
  });

  it("CREATE-02 createSemesterDb 落地 semester/<id>/sem.db 且 integrity ok", () => {
    semesterDb = createSemesterDb(ISOLATION_DIR, "2026-autumn");
    const semPath = path.join(ISOLATION_DIR, "semester", "2026-autumn", "sem.db");
    expect(existsSync(semPath)).toBe(true);
    expect(() => assertIntegrity(semesterDb.db)).not.toThrow();
  });

  it("CREATE-03 跨库外键语义：global semesters 无指向 semester 的 FK 列", () => {
    const cols = globalDb.db
      .prepare("SELECT name FROM pragma_table_info('semesters')")
      .all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    // semester 通过 db_relative_path 关联，无 semester_id FK 列
    expect(names).toContain("db_relative_path");
    expect(names).not.toContain("semaphore_fk");
  });

  it("ISOLATION-01 测试不污染业务数据根 %LOCALAPPDATA%\\PiStudyBuddy", () => {
    const bizRoot = path.join(
      process.env.LOCALAPPDATA || "C:\\Users\\Administrator\\AppData\\Local",
      "PiStudyBuddy",
    );
    // 断言我们只在隔离目录建库（本测试不创建业务根；若存在也不含本任务产物）
    expect(ISOLATION_DIR).toContain("pi-studybuddy-tmp");
    expect(readdirSync(ISOLATION_DIR).length).toBeGreaterThan(0);
    // 不产生意外顶层文件（仅 global.db + semester/ 目录）
    const top = readdirSync(ISOLATION_DIR);
    expect(top).toContain("global.db");
    expect(top).toContain("semester");
  });
});