/**
 * T-M1-002 S2 handler 共享上下文（03-Arch §6.2 + §4 数据层）
 *
 * 复用 S1Context 模式：管理 global.db / semester.db 句柄缓存。
 * handler 通过此上下文访问数据层。测试时注入临时目录（PI_STUDYBUDDY_DATA_ROOT 隔离）。
 */
import { DatabaseSync } from "../../../data/sqlite";
import { applyPragmas } from "../../../data/db";
import path from "node:path";
import type { WpsAdapter } from "./wps-adapter";
import type { TextExtractor } from "./text-extractor";
import type { OcrAdapter } from "../s1/ocr-adapter";

export class S2Context {
  private _globalDb: DatabaseSync | null = null;
  private _semesterDbs = new Map<string, DatabaseSync>();

  constructor(
    private readonly dataRoot: string,
    private readonly wpsAdapter?: WpsAdapter,
    private readonly textExtractorAdapter?: TextExtractor,
    private readonly ocrAdapter?: OcrAdapter,
  ) {}

  /** WPS 转换 Adapter（可注入，默认未注入则 wps_convert 仅登记 Job，03-Arch §3.3） */
  get wps(): WpsAdapter | undefined {
    return this.wpsAdapter;
  }

  /** 文档文本提取器（可注入，默认未注入则 convert_* 仅登记 Job，07-WF §2.3） */
  get textExtractor(): TextExtractor | undefined {
    return this.textExtractorAdapter;
  }

  /** OCR Adapter（可注入，默认未注入则 ocr_image 仅登记 Job，复用于图片识别，07-WF §2.3） */
  get ocr(): OcrAdapter | undefined {
    return this.ocrAdapter;
  }

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
