/**
 * T-M1-004 S4 handler 共享上下文（03-Arch §6.2 + §4 数据层）
 *
 * 复用 S1/S2/S3Context 模式：管理 global.db / semester.db 句柄缓存。
 * 额外注入 ErrorCauseAdvisor 接口（默认 mock 带确定性建议 + "不确定"标记），供 suggestErrorCause 调用。
 */
import { DatabaseSync } from "../../../data/sqlite";
import { applyPragmas } from "../../../data/db";
import path from "node:path";
import type { ErrorCauseAdvisor } from "./error-cause-advisor";
import { createMockErrorCauseAdvisor } from "./error-cause-advisor";

export class S4Context {
  private _globalDb: DatabaseSync | null = null;
  private _semesterDbs = new Map<string, DatabaseSync>();
  readonly errorCauseAdvisor: ErrorCauseAdvisor;

  constructor(
    private readonly dataRoot: string,
    errorCauseAdvisor?: ErrorCauseAdvisor,
  ) {
    this.errorCauseAdvisor = errorCauseAdvisor ?? createMockErrorCauseAdvisor();
  }

  get globalDb(): DatabaseSync {
    if (!this._globalDb) {
      const dbPath = path.join(this.dataRoot, "global.db");
      this._globalDb = new DatabaseSync(dbPath);
      applyPragmas(this._globalDb);
    }
    return this._globalDb;
  }

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
