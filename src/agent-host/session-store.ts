/**
 * T-M3-001 session-store 内存会话仓库（06-API §3.1 对话 Tab 承载）
 *
 * 承载 renderer ↔ agent-host 的会话管理基础（sessions.list/get/delete/context）。
 * T-M3-001 范围：纯内存仓库 + fixture，**不读取真实 pi 会话目录 ~/.pi/agent/**
 * （03-Arch §4.1 + AGENTS.md §9.5 物理隔离）——真实 pi 会话读取属 T-M3-003。
 */
import type { Session, SessionContext, SessionSummary } from "../contract/types";

export interface SessionStore {
  list(params?: { limit?: number; cursor?: string }): SessionSummary[];
  get(id: string): Session | undefined;
  delete(id: string): boolean;
  context(id: string): SessionContext | undefined;
}

/** 默认 fixture 会话（对话 Tab 承载层可用数据，来源学习场景语义） */
export function defaultSessionFixture(): SessionSummary[] {
  return [
    {
      id: "sess-001",
      name: "极限学习",
      updatedAt: "2026-08-08T09:00:00Z",
      preview: "ε-δ 定义",
    },
    {
      id: "sess-002",
      name: "导数练习",
      updatedAt: "2026-08-08T10:00:00Z",
      preview: "导数定义 5 题",
    },
  ];
}

/** 创建内存会话仓库；fixture 缺省为空列表，默认 fixture 由 agent-host 装配时注入 */
export function createSessionStore(fixture?: SessionSummary[]): SessionStore {
  const sessions = new Map<string, SessionSummary>();
  for (const s of fixture ?? []) {
    sessions.set(s.id, s);
  }

  return {
    list(params) {
      const sorted = [...sessions.values()].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );
      return params?.limit !== undefined ? sorted.slice(0, params.limit) : sorted;
    },
    get(id) {
      const summary = sessions.get(id);
      if (!summary) return undefined;
      return {
        ...summary,
        context: {
          systemPrompt: "学习对话（pi 原生承载，T-M3-001 骨架）",
          messages: summary.id === "sess-001" ? 12 : 5,
          tokens: summary.id === "sess-001" ? 1240 : 520,
          compressed: false,
        },
      };
    },
    delete(id) {
      return sessions.delete(id);
    },
    context(id) {
      return this.get(id)?.context;
    },
  };
}
