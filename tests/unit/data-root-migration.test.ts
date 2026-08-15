import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  initializeDataRoot,
  prepareDataRootMigration,
  resolveStartupDataRoot,
} from "../../src/main/data-root-init";
import { DatabaseSync } from "../../src/data/sqlite";
import { createSemesterDb } from "../../src/data/semester";

const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-010\\data-root-migration";
const OLD_ROOT = path.join(RUN_ROOT, "old-root");
const NEW_ROOT = path.join(RUN_ROOT, "new-root");
const REGISTRY = path.join(RUN_ROOT, "control", "data-root.json");

function clean(): void {
  rmSync(RUN_ROOT, { recursive: true, force: true });
  mkdirSync(RUN_ROOT, { recursive: true });
}

function seedRoot(root: string): void {
  initializeDataRoot(root);
  writeFileSync(path.join(root, "config", "settings.json"), "{\"dailyGoalMinutes\":45}", "utf8");
  writeFileSync(path.join(root, "storage", "fixture.txt"), "asset", "utf8");
  const db = new DatabaseSync(path.join(root, "global.db"));
  db.prepare(
    "INSERT INTO semesters (id, student_name, semester_label, start_date, end_date, timezone, status, db_relative_path, ready, created_at, updated_at) VALUES ('sem-migration', '测试', '迁移学期', '2026-09-01', '2027-01-31', 'Asia/Shanghai', 'active', 'semester/sem-migration/sem.db', 1, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')",
  ).run();
  db.close();
  const semester = createSemesterDb(root, "sem-migration");
  semester.db.close();
}

describe("T-M5-010 data-root restart migration", () => {
  beforeEach(clean);
  afterEach(() => rmSync(RUN_ROOT, { recursive: true, force: true }));

  it("DRM-01 copies managed assets, validates the target, then schedules its next launch", () => {
    seedRoot(OLD_ROOT);

    prepareDataRootMigration({ currentRoot: OLD_ROOT, targetRoot: NEW_ROOT, registryPath: REGISTRY });

    expect(existsSync(path.join(NEW_ROOT, "global.db"))).toBe(true);
    expect(existsSync(path.join(NEW_ROOT, "storage", "fixture.txt"))).toBe(true);
    expect(resolveStartupDataRoot({ defaultRoot: OLD_ROOT, registryPath: REGISTRY })).toEqual({
      dataRoot: NEW_ROOT,
      source: "scheduled",
      recovered: false,
    });
  });
  it("DRM-01B initializes and reads the scheduled root after restart", () => {
    seedRoot(OLD_ROOT);
    prepareDataRootMigration({ currentRoot: OLD_ROOT, targetRoot: NEW_ROOT, registryPath: REGISTRY });
    const resolution = resolveStartupDataRoot({ defaultRoot: OLD_ROOT, registryPath: REGISTRY });
    initializeDataRoot(resolution.dataRoot);
    const db = new DatabaseSync(path.join(resolution.dataRoot, "global.db"));
    const row = db.prepare("SELECT semester_label FROM semesters WHERE id = 'sem-migration'").get() as { semester_label: string };
    db.close();
    expect(resolution.dataRoot).toBe(NEW_ROOT);
    expect(row.semester_label).toBe("迁移学期");
  });

  it("DRM-01C rejects migration when a registered semester database is missing", () => {
    seedRoot(OLD_ROOT);
    rmSync(path.join(OLD_ROOT, "semester", "sem-migration"), { recursive: true, force: true });

    expect(() => prepareDataRootMigration({ currentRoot: OLD_ROOT, targetRoot: NEW_ROOT, registryPath: REGISTRY }))
      .toThrow("当前数据根不可用，无法迁移");
    expect(existsSync(NEW_ROOT)).toBe(false);
    expect(existsSync(REGISTRY)).toBe(false);
  });

  it("DRM-02 an invalid scheduled target retains the last known-good root and clears the bad switch", () => {
    seedRoot(OLD_ROOT);
    mkdirSync(path.dirname(REGISTRY), { recursive: true });
    writeFileSync(REGISTRY, JSON.stringify({ activeRoot: OLD_ROOT, pendingRoot: path.join(RUN_ROOT, "missing") }), "utf8");

    expect(resolveStartupDataRoot({ defaultRoot: OLD_ROOT, registryPath: REGISTRY })).toEqual({
      dataRoot: OLD_ROOT,
      source: "recovered",
      recovered: true,
    });
    expect(resolveStartupDataRoot({ defaultRoot: OLD_ROOT, registryPath: REGISTRY })).toEqual({
      dataRoot: OLD_ROOT,
      source: "active",
      recovered: false,
    });
  });

  it("DRM-03 an environment root remains highest priority and never consumes a pending switch", () => {
    seedRoot(OLD_ROOT);
    prepareDataRootMigration({ currentRoot: OLD_ROOT, targetRoot: NEW_ROOT, registryPath: REGISTRY });

    expect(resolveStartupDataRoot({
      defaultRoot: OLD_ROOT,
      registryPath: REGISTRY,
      environmentRoot: path.join(RUN_ROOT, "environment-root"),
    })).toEqual({
      dataRoot: path.join(RUN_ROOT, "environment-root"),
      source: "environment",
      recovered: false,
    });
    expect(resolveStartupDataRoot({ defaultRoot: OLD_ROOT, registryPath: REGISTRY })).toMatchObject({
      dataRoot: NEW_ROOT,
      source: "scheduled",
    });
  });
});
