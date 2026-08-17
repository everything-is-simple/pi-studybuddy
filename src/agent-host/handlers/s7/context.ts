/**
 * T-M2-003 S7 handler 共享上下文（03-Arch §6.2 + §3.3 whisper.cpp Adapter）
 *
 * 复用 S1-S6 Context 模式：管理 global.db / semester.db 句柄缓存。
 * 额外注入 WhisperCppAdapter（可注入，默认 mock 确定性，08-Test §5.4 不连真实 whisper.cpp）+
 * whisperCliPath/whisperModelPath（CLI/模型路径只来自配置，03-Arch §3.3 不猜路径不回退云端）+
 * tmpRoot（原始音频暂存根目录，finally 清理）。
 */
import { DatabaseSync } from "../../../data/sqlite";
import { applyPragmas } from "../../../data/db";
import path from "node:path";
import type { WhisperCppAdapter } from "./whisper-adapter";
import { createMockWhisperAdapter, createRealWhisperAdapter } from "./whisper-adapter";

export interface S7ContextOptions {
  /** WhisperCppAdapter（可注入，默认 mock 确定性，08-Test §5.4） */
  whisperAdapter?: WhisperCppAdapter;
  /** 允许未配置时使用 mock；生产路径应设为 false，避免能力缺失被伪装为成功。 */
  allowMockWhisper?: boolean;
  /** whisper.cpp CLI 路径（仅 createRealWhisperAdapter 用，03-Arch §3.3） */
  whisperCliPath?: string;
  /** whisper.cpp 模型路径（仅 createRealWhisperAdapter 用，03-Arch §3.3） */
  whisperModelPath?: string;
  /** 原始音频暂存根目录（默认 <dataRoot>/tmp/class-capture，07-WF §2.7 finally 清理） */
  tmpRoot?: string;
}

export class S7Context {
  private _globalDb: DatabaseSync | null = null;
  private _semesterDbs = new Map<string, DatabaseSync>();
  readonly whisperAdapter: WhisperCppAdapter;
  readonly whisperCliPath: string;
  readonly whisperModelPath: string;
  readonly tmpRoot: string;

  constructor(
    private readonly dataRoot: string,
    options?: S7ContextOptions,
  ) {
    this.whisperCliPath = options?.whisperCliPath ?? "";
    this.whisperModelPath = options?.whisperModelPath ?? "";
    this.whisperAdapter = options?.whisperAdapter ?? (options?.allowMockWhisper === false
      ? createRealWhisperAdapter({ cliPath: this.whisperCliPath, modelPath: this.whisperModelPath })
      : createMockWhisperAdapter());
    this.tmpRoot = options?.tmpRoot ?? path.join(dataRoot, "tmp", "class-capture");
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
