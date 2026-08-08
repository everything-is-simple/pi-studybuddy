/**
 * T-M3-001/003 sessions.* RPC handlers（06-API §3.1，对话 Tab 承载）
 *
 * 会话管理基础：list/get/delete/context（内存仓库承载，T-M3-001 骨架范围，
 * 不读真实 pi 会话目录）。
 * T-M3-003 扩展：
 *   - sessions.search：L3 会话检索（05-ERD §4.3，conversation.sqlite bigram MATCH），
 *     命中 session_id 映射内存仓库 SessionSummary（缺失时用检索库内容生成摘要条目）
 *   - sessions.updateMeta 不走 RPC（裁决：会话元数据写回走 agent.send 参数携带，
 *     不新增契约方法）
 */
import path from "node:path";
import type { SessionSummary } from "../../contract/types";
import type { SessionStore } from "../session-store";
import { openConversationDb } from "../../data/l3/indexer";
import { searchChunks, aggregateBySession } from "../../data/l3/search";

export interface SessionHandlerOptions {
  store: SessionStore;
  /** 业务数据根（L3 检索库 %LOCALAPPDATA%\PiStudyBuddy\memory\l3\conversation.sqlite） */
  dataRoot: string;
}

export function createSessionHandlers({ store, dataRoot }: SessionHandlerOptions) {
  return {
    "sessions.list": (params: unknown): SessionSummary[] => {
      const { limit, cursor } = (params ?? {}) as { limit?: number; cursor?: string };
      return store.list({ limit, cursor });
    },
    "sessions.get": (params: unknown): ReturnType<SessionStore["get"]> => {
      const { id } = params as { id: string };
      return store.get(id);
    },
    "sessions.context": (params: unknown): ReturnType<SessionStore["context"]> => {
      const { id } = params as { id: string };
      return store.context(id);
    },
    "sessions.delete": (params: unknown): void => {
      const { id } = params as { id: string };
      store.delete(id);
    },
    "sessions.search": (params: unknown): SessionSummary[] => {
      const { query } = params as { query: string };
      if (!query?.trim()) return [];
      const dbPath = path.join(dataRoot, "memory", "l3", "conversation.sqlite");
      try {
        const db = openConversationDb(dbPath);
        try {
          const hits = searchChunks(db, query, 20);
          const agg = aggregateBySession(hits);
          return agg.map((a) => {
            const known = store.get(a.session_id);
            return {
              id: a.session_id,
              name: known?.name ?? `会话 ${a.session_id}`,
              updatedAt: a.updatedAt,
              preview: a.preview.slice(0, 80),
              ...(known?.subject !== undefined ? { subject: known.subject } : {}),
              ...(known?.goal !== undefined ? { goal: known.goal } : {}),
              ...(known?.mistakeIds !== undefined ? { mistakeIds: known.mistakeIds } : {}),
            } satisfies SessionSummary;
          });
        } finally {
          db.db.close();
        }
      } catch {
        // L3 库不存在/不可读 → 返回空（不阻塞，检索库尚未建立属正常态）
        return [];
      }
    },
  };
}
