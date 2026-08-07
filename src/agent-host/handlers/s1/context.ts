/**
 * T-M1-001 S1 handler 共享上下文（03-Arch §6.2 + §4 数据层）
 *
 * 管理 global.db / semester.db 句柄缓存，handler 通过此上下文访问数据层。
 * 测试时注入临时目录（PI_STUDYBUDDY_DATA_ROOT 隔离）。
 */
import { DatabaseSync } from "../../../data/sqlite";
import { applyPragmas } from "../../../data/db";
import path from "node:path";

export class S1Context {
  private _globalDb: DatabaseSync | null = null;
  private _semesterDbs = new Map<string, DatabaseSync>();

  constructor(private readonly dataRoot: string) {}

  /** 打开或复用 global.db（含 PRAGMA） */
  get globalDb(): DatabaseSync {
    if (!this._globalDb) {
      const dbPath = path.join(this.dataRoot, "global.db");
      this._globalDb = new DatabaseSync(dbPath);
      applyPragmas(this._globalDb);
    }
    return this._globalDb;
  }

  /** 打开或复用 semester/<id>/sem.db（含 PRAGMA） */
  semesterDb(semesterId: string): DatabaseSync {
    let db = this._semesterDbs.get(semesterId);
    if (!db) {
      const dbPath = path.join(this.dataRoot, "semester", semesterId, "sem.db");
      db = new DatabaseSync(dbPath);
      applyPragmas(db);
      this._semesterDbs.set(semesterId, db);
    }
    return db;
  }

  get dataRootPath(): string {
    return this.dataRoot;
  }

  dispose(): void {
    this._globalDb?.close();
    for (const db of this._semesterDbs.values()) db.close();
    this._globalDb = null;
    this._semesterDbs.clear();
  }
}
