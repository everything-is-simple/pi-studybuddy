/**
 * T-M0-006 数据层基础：数据库打开 + PRAGMA 应用 + 完整性断言（05-ERD §9 + §8.3）
 */
import { DatabaseSync } from "./sqlite";

/** 数据层统一句柄：路径 + 已打开并应用 PRAGMA 的数据库 */
export interface DataDb {
  path: string;
  db: DatabaseSync;
}

/** 打开 SQLite 数据库（不存在则创建） */
export function openDatabase(path: string): DatabaseSync {
  return new DatabaseSync(path);
}

/** 应用 05-ERD §9 统一 PRAGMA 配置 */
export function applyPragmas(db: DatabaseSync): void {
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA cache_size = -64000");
  db.exec("PRAGMA temp_store = MEMORY");
  db.exec("PRAGMA mmap_size = 268435456");
}

/** 断言数据库完整性（05-ERD §8.3）：PRAGMA integrity_check 非 'ok' 则抛错 */
export function assertIntegrity(db: DatabaseSync): void {
  const rows = db.prepare("PRAGMA integrity_check").all() as Array<{ integrity_check: string }>;
  if (!rows || rows.length !== 1 || rows[0].integrity_check !== "ok") {
    const detail = rows?.map((r) => r.integrity_check).join("; ") ?? "unknown";
    throw new Error(`integrity_check failed: ${detail}`);
  }
}