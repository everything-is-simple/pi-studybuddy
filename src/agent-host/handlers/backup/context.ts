/**
 * T-M2-005 备份恢复 handler 共享上下文（03-Arch §6.2 + 07-WF §5）
 *
 * 复用 S1-S7 Context 模式：管理 global.db / semester.db 句柄缓存。
 * 额外注入 Streams["backup.progress"] 推送回调（可选，集成测试注入）。
 *
 * 数据层访问：
 *   - globalDb：backup_records / backup_schedules / semesters（05-ERD §2）
 *   - semesterDb：course_instances / materials / ... （05-ERD §3，导出/导入用）
 */
import { DatabaseSync } from "../../../data/sqlite";
import { applyPragmas } from "../../../data/db";
import path from "node:path";

/** Streams["backup.progress"] 推送载荷（streams.ts §backup.progress，06-API §4） */
export interface BackupProgressEvent {
  backupRecordId: string;
  phase: "packing" | "unpacking" | "importing" | "completed" | "failed";
  progress: number; // 0-100
}

export interface BackupContextOptions {
  /** Streams["backup.progress"] 推送回调（可选，集成测试注入） */
  emit?: (event: BackupProgressEvent) => void;
}

export class BackupContext {
  private _globalDb: DatabaseSync | null = null;
  private _semesterDbs = new Map<string, DatabaseSync>();
  readonly emit?: (event: BackupProgressEvent) => void;

  constructor(
    private readonly dataRoot: string,
    options?: BackupContextOptions,
  ) {
    this.emit = options?.emit;
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
