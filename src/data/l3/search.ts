/**
 * T-M3-003 L3 承载层 search（05-ERD §4.3）
 *
 * OR-combined MATCH 检索：query 经 bigram 分词 → buildMatchQuery →
 * chunks_fts MATCH → 按 session_id 聚合返回最近命中。
 * 本层为承载能力（无钩子依赖）。
 */
import type { DataDb } from "../db";
import { tokenizeBigram, buildMatchQuery } from "./bigram";

/** 检索命中（含聚合后的会话上下文摘要） */
export interface ChunkHit {
  session_id: string;
  content: string;
  role: string;
  created_at: string;
}

/**
 * 检索 chunk（OR-combined MATCH）。
 * @param db   L3 conversation.sqlite 句柄
 * @param query 用户查询文本（内部做 bigram 分词）
 * @param limit 最多返回命中条数（按 created_at 倒序，默认 10）
 */
export function searchChunks(db: DataDb, query: string, limit = 10): ChunkHit[] {
  const tokens = tokenizeBigram(query);
  const matchQuery = buildMatchQuery(tokens);
  if (!matchQuery) return [];

  const rows = db.db
    .prepare(
      `SELECT c.session_id, c.content, c.role, c.created_at
       FROM chunks_fts f
       JOIN chunks c ON c.rowid = f.rowid
       WHERE chunks_fts MATCH ?
       ORDER BY c.created_at DESC
       LIMIT ?`,
    )
    .all(matchQuery, limit) as Array<{ session_id: string; content: string; role: string; created_at: string }>;

  return rows.map((r) => ({
    session_id: r.session_id,
    content: r.content,
    role: r.role,
    created_at: r.created_at,
  }));
}

/** 聚合辅助：按 session_id 归并命中，取每会话最近一条内容摘要 */
export function aggregateBySession(hits: ChunkHit[]): Array<{ session_id: string; preview: string; updatedAt: string }> {
  const bySession = new Map<string, ChunkHit>();
  for (const hit of hits) {
    const prev = bySession.get(hit.session_id);
    if (!prev || hit.created_at > prev.created_at) {
      bySession.set(hit.session_id, hit);
    }
  }
  return [...bySession.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((h) => ({
      session_id: h.session_id,
      preview: h.content,
      updatedAt: h.created_at,
    }));
}
