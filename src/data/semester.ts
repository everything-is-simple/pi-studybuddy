/**
 * T-M0-006 学期库 semester.db 建库能力（05-ERD §3 + §6 + §7.2）
 */
import { DatabaseSync } from "./sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { applyPragmas, assertIntegrity, type DataDb } from "./db";
import {
  SEMESTER_SCHEMA_SQL,
  SEMESTER_TABLES,
  SEMESTER_TRIGGERS,
} from "./schema/semester.sql";

export { SEMESTER_TABLES, SEMESTER_TRIGGERS };

/** 在已打开并应用 PRAGMA 的数据库上建 semester.db 全部表 + 触发器 + 索引 */
export function initSemesterDb(db: DatabaseSync): void {
  db.exec(SEMESTER_SCHEMA_SQL);
}

/**
 * 在 dir 下创建 semester/<semesterId>/sem.db 并建库 + integrity 断言（05-ERD §1.3）。
 * @param dir 业务数据根目录（测试注入隔离目录）
 * @param semesterId 学期 id（用于相对路径 semester/<id>/sem.db）
 */
export function createSemesterDb(dir: string, semesterId: string): DataDb {
  const semDir = path.join(dir, "semester", semesterId);
  mkdirSync(semDir, { recursive: true });
  const filePath = path.join(semDir, "sem.db");
  const db = new DatabaseSync(filePath);
  applyPragmas(db);
  initSemesterDb(db);
  assertIntegrity(db);
  return { path: filePath, db };
}