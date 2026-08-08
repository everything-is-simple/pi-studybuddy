/**
 * T-M3-001 sessions.* RPC handlers（06-API §3.1，对话 Tab 承载）
 *
 * 会话管理基础：list/get/delete/context。内存仓库承载（T-M3-001 骨架范围，
 * 不读真实 pi 会话目录，真实读取属 T-M3-003）。
 */
import type { SessionStore } from "../session-store";

export function createSessionHandlers(store: SessionStore) {
  return {
    "sessions.list": (params: unknown): ReturnType<SessionStore["list"]> => {
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
  };
}
