/**
 * T-M0-006 L3 会话检索 schema DDL（05-ERD §4.3）
 *
 * chunks 表 + chunks_fts FTS5 虚拟表（bigram 分词由应用层实现，M3 对话任务）。
 */

/** L3 conversation.sqlite DDL（chunks 表 + chunks_fts 虚拟表） */
export const CONVERSATION_SCHEMA_SQL = `
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  role TEXT NOT NULL,
  source_type TEXT,
  created_at TEXT NOT NULL,
  last_offset INTEGER NOT NULL,
  last_mtime_ms INTEGER NOT NULL
);

CREATE INDEX idx_chunk_session ON chunks(session_id);
CREATE INDEX idx_chunk_offset ON chunks(last_offset);

CREATE VIRTUAL TABLE chunks_fts USING fts5(
  content,
  content='chunks',
  content_rowid='rowid',
  tokenize='unicode61'
);
`;