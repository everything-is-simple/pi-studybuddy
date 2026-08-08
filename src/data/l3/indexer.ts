/**
 * T-M3-003 L3 承载层 indexer（05-ERD §4.3）
 *
 * conversation.sqlite 打开 + chunks 行写入 + bigram 分词写入 chunks_fts。
 * 本层为承载能力（无钩子依赖），turn_end 增量索引接线归 T-M3-005。
 */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { openDatabase, applyPragmas, type DataDb } from "../db";
import { CONVERSATION_SCHEMA_SQL } from "../schema/conversation.sql";
import { tokenizeBigram } from "./bigram";

/** chunks 表写入输入（对齐 05-ERD §4.3 chunks 列） */
export interface ChunkInput {
  id: string;
  session_id: string;
  content: string;
  role: "user" | "assistant" | "tool";
  source_type?: string;
  created_at: string;
  last_offset: number;
  last_mtime_ms: number;
}

/**
 * 打开（或创建）L3 conversation.sqlite。
 * 建表幂等：chunks 已存在则跳过 DDL（CREATE 非幂等，重复 exec 抛 "table already exists"）。
 */
export function openConversationDb(dbPath: string): DataDb {
  // 父目录不存在时 SQLite 报 "unable to open database file"，先建目录（数据根隔离场景）
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const raw = openDatabase(dbPath);
  applyPragmas(raw);
  const exists = raw
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','virtual table') AND name = 'chunks'")
    .get();
  if (!exists) {
    raw.exec(CONVERSATION_SCHEMA_SQL);
  }
  return { path: dbPath, db: raw };
}

/**
 * 写入一个 chunk：chunks 行 + chunks_fts 全文索引。
 * bigram 分词由应用层实现（05-ERD §4.3"bigram 分词由应用层实现...写入 chunks_fts"）：
 * 分词 token 以空格 join 写入 chunks_fts.content 列（外部内容表 + unicode61 仍可用，
 * 应用层已保证 token 为可检索单元；完整 UUID 已在分词层过滤）。
 */
export function insertChunk(db: DataDb, chunk: ChunkInput): void {
  db.db
    .prepare(
      `INSERT INTO chunks (id, session_id, content, role, source_type, created_at, last_offset, last_mtime_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      chunk.id,
      chunk.session_id,
      chunk.content,
      chunk.role,
      chunk.source_type ?? null,
      chunk.created_at,
      chunk.last_offset,
      chunk.last_mtime_ms,
    );

  const tokens = tokenizeBigram(chunk.content);
  if (tokens.length) {
    db.db
      .prepare("INSERT INTO chunks_fts (rowid, content) VALUES ((SELECT rowid FROM chunks WHERE id = ?), ?)")
      .run(chunk.id, tokens.join(" "));
  }
}

/** 便捷：按目录路径打开 L3 库（memory/l3/conversation.sqlite 语义） */
export function openConversationDbAt(dataRoot: string): DataDb {
  return openConversationDb(path.join(dataRoot, "memory", "l3", "conversation.sqlite"));
}
