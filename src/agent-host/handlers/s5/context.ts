/**
 * T-M2-001 S5 handler 共享上下文（03-Arch §6.2 + §4 数据层）
 *
 * 复用 S1/S2/S3/S4Context 模式：管理 global.db / semester.db 句柄缓存。
 * 额外注入 MockExamGenerator 接口（默认 mock 确定性生成），供 generatePaper 调用。
 */
import { DatabaseSync } from "../../../data/sqlite";
import { applyPragmas } from "../../../data/db";
import path from "node:path";
import type { MockExamGenerator } from "./mock-exam-generator";
import { createMockMockExamGenerator } from "./mock-exam-generator";

export interface S5ContextOptions {
  mockExamGenerator?: MockExamGenerator;
}

export class S5Context {
  private _globalDb: DatabaseSync | null = null;
  private _semesterDbs = new Map<string, DatabaseSync>();
  readonly mockExamGenerator: MockExamGenerator;

  constructor(
    private readonly dataRoot: string,
    options?: S5ContextOptions,
  ) {
    this.mockExamGenerator = options?.mockExamGenerator ?? createMockMockExamGenerator();
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
