/**
 * T-M2-002 S6 handler 共享上下文（03-Arch §6.2 + §4 数据层）
 *
 * 复用 S1-S5 Context 模式：管理 global.db / semester.db 句柄缓存。
 * 额外注入 ReportPolisher（AI 润色接口，默认 mock 确定性）+ DeliveryChannels（4 渠道 mock）+
 * credentialGetter（credential-vault 集成点，解密失败抛 INTERNAL_ERROR）。
 */
import { DatabaseSync } from "../../../data/sqlite";
import { applyPragmas } from "../../../data/db";
import path from "node:path";
import type { ReportPolisher } from "./report-polisher";
import { createMockReportPolisher } from "./report-polisher";
import type { DeliveryChannels } from "./delivery-channels";
import { createMockDeliveryChannels } from "./delivery-channels";

export interface S6ContextOptions {
  reportPolisher?: ReportPolisher;
  deliveryChannels?: DeliveryChannels;
  /** credential-vault.get 集成点（08-Test §5.4 不连真实 vault，测试用 mock 注入） */
  credentialGetter?: (key: string) => string;
}

export class S6Context {
  private _globalDb: DatabaseSync | null = null;
  private _semesterDbs = new Map<string, DatabaseSync>();
  readonly reportPolisher: ReportPolisher;
  readonly deliveryChannels: DeliveryChannels;
  readonly credentialGetter: (key: string) => string;

  constructor(
    private readonly dataRoot: string,
    options?: S6ContextOptions,
  ) {
    this.reportPolisher = options?.reportPolisher ?? createMockReportPolisher();
    this.deliveryChannels = options?.deliveryChannels ?? createMockDeliveryChannels();
    this.credentialGetter = options?.credentialGetter ?? ((key: string) => key);
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
