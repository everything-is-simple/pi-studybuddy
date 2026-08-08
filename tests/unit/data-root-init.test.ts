import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { initializeDataRoot } from "../../src/main/data-root-init";
import { DatabaseSync } from "../../src/data/sqlite";
import { applyPragmas, assertIntegrity } from "../../src/data/db";

/** Windows SQLite WAL 文件可能短暂锁定，清理时容错 */
function safeRmSync(p: string): void {
  try {
    rmSync(p, { recursive: true, force: true });
  } catch {
    // Windows EBUSY：WAL 文件可能短暂锁定，忽略清理失败
  }
}

/**
 * T-M4-001 业务数据根初始化单件测试（03-Arch §1.2 + §4.3 + 05-ERD §2）
 *
 * 断言：
 *   - INIT-01 global.db 落地 + integrity ok
 *   - INIT-02 六个子目录全部创建
 *   - INIT-03 幂等：二次调用不报错（schema IF NOT EXISTS + mkdir recursive）
 *   - INIT-04 global.db 4 表存在
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M4-001\。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M4-001\\unit";

const EXPECTED_SUBDIRS = [
  "semester",
  "storage",
  "config",
  "exports",
  "memory/l1",
  "memory/l3",
];

const EXPECTED_TABLES = [
  "semesters",
  "parent_report_targets",
  "backup_records",
  "backup_schedules",
];

describe("T-M4-001 业务数据根初始化", () => {
  beforeAll(() => {
    safeRmSync(ISOLATION_DIR);
    mkdirSync(ISOLATION_DIR, { recursive: true });
  });

  afterAll(() => {
    safeRmSync(ISOLATION_DIR);
  });

  it("INIT-01 initializeDataRoot 落地 global.db 且 integrity ok", () => {
    const globalDbPath = initializeDataRoot(ISOLATION_DIR);
    expect(existsSync(globalDbPath)).toBe(true);
    expect(existsSync(path.join(ISOLATION_DIR, "global.db"))).toBe(true);

    const db = new DatabaseSync(path.join(ISOLATION_DIR, "global.db"));
    applyPragmas(db);
    expect(() => assertIntegrity(db)).not.toThrow();
    db.close();
  });

  it("INIT-02 六个子目录全部创建", () => {
    for (const sub of EXPECTED_SUBDIRS) {
      expect(existsSync(path.join(ISOLATION_DIR, sub))).toBe(true);
    }
  });

  it("INIT-03 幂等：二次调用不报错", () => {
    expect(() => initializeDataRoot(ISOLATION_DIR)).not.toThrow();
    expect(existsSync(path.join(ISOLATION_DIR, "global.db"))).toBe(true);
  });

  it("INIT-04 global.db 4 表存在", () => {
    const db = new DatabaseSync(path.join(ISOLATION_DIR, "global.db"));
    applyPragmas(db);
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const tableNames = rows.map((r) => r.name);
    for (const t of EXPECTED_TABLES) {
      expect(tableNames).toContain(t);
    }
    db.close();
  });
});
