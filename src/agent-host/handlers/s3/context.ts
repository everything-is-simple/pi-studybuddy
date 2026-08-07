/**
 * T-M1-003 S3 handler 共享上下文（03-Arch §6.2 + §4 数据层）
 *
 * 复用 S1/S2Context 模式：管理 global.db / semester.db 句柄缓存。
 * 额外注入 QuestionGenerator 接口（默认 mock 确定性生成），供 createSession 调用。
 */
import { DatabaseSync } from "../../../data/sqlite";
import { applyPragmas } from "../../../data/db";
import path from "node:path";
import type { QuestionGenerator } from "./question-generator";
import { createMockQuestionGenerator } from "./question-generator";

export class S3Context {
  private _globalDb: DatabaseSync | null = null;
  private _semesterDbs = new Map<string, DatabaseSync>();
  readonly questionGenerator: QuestionGenerator;

  constructor(
    private readonly dataRoot: string,
    questionGenerator?: QuestionGenerator,
  ) {
    this.questionGenerator = questionGenerator ?? createMockQuestionGenerator();
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
