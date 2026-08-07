/**
 * T-M0-006 全局库 global.db 建库能力（05-ERD §2 + §7.1）
 */
import { DatabaseSync } from "./sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { applyPragmas, assertIntegrity, type DataDb } from "./db";
import {
  GLOBAL_SCHEMA_SQL,
  GLOBAL_TABLES,
  GLOBAL_INDEXES,
} from "./schema/global.sql";

export { GLOBAL_TABLES, GLOBAL_INDEXES };

/** 在已打开并应用 PRAGMA 的数据库上建 global.db 全部表 + 索引 */
export function initGlobalDb(db: DatabaseSync): void {
  db.exec(GLOBAL_SCHEMA_SQL);
}

/**
 * 在 dir 下创建 global.db 并建库 + integrity 断言。
 * @param dir 业务数据根目录（测试注入隔离目录）
 */
export function createGlobalDb(dir: string): DataDb {
  const filePath = path.join(dir, "global.db");
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(filePath);
  applyPragmas(db);
  initGlobalDb(db);
  assertIntegrity(db);
  return { path: filePath, db };
}