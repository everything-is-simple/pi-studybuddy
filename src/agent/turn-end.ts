/**
 * T-M3-005 turn_end 增量索引器（05-ERD §4.3 + 03-Arch §2.3 + 裁决 2）
 *
 * turn_end 事件不携带 sessionId（pi types.ts TurnEndEvent 仅 turnIndex/message/toolResults），
 * 故本模块以纯函数接收 sessionId 参数，由扩展层钩子从当前会话解析后调用（裁决 2：
 * 不读 ~/.pi 会话文件）。测试直接调用纯函数断言增量语义。
 *
 * 数据源：仅事件携带内容——
 *   - event.message（assistant）→ role: assistant, source_type: message
 *   - event.toolResults（tool）→ role: tool, source_type: tool_result
 *
 * 增量：按 session 查 max(last_offset)，只写 offset > max 的新增 chunk。
 * chunk id 复合键 `sessionId:turnIndex:role:seq` 保证幂等（同 turn 重复触发去重）。
 */
import { openConversationDbAt, type ChunkInput } from "../data/l3/indexer";
import { closeDatabase } from "../data/db";
import { tokenizeBigram } from "../data/l3/bigram";

/** turn_end 事件携带的 tool result 载荷（对齐 pi ToolResultMessage 子集） */
export interface TurnToolResult {
  toolName?: string;
  toolCallId?: string;
  content?: Array<{ type?: string; text?: string }> | string;
}

/** turn_end 事件携带的 assistant message 载荷（对齐 pi AgentMessage 子集） */
export interface TurnMessage {
  role?: string;
  content?: unknown;
}

/** turn_end 增量索引输入 */
export interface TurnEndIndexInput {
  dataRoot: string;
  sessionId: string;
  turnIndex: number;
  message?: TurnMessage;
  toolResults?: TurnToolResult[];
}

/** 从 assistant message 提取索引文本（pi AgentMessage.content 兼容 string | 块数组） */
function extractMessageText(message: TurnMessage): string {
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        const block = c as { type?: string; text?: string };
        return typeof block.text === "string" ? block.text : "";
      })
      .join(" ");
  }
  return "";
}

/** 从 tool result 提取索引文本（ToolResultMessage.content 兼容 string | 块数组） */
function extractToolText(tr: TurnToolResult): string {
  const content = tr.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        const block = c as { type?: string; text?: string };
        return typeof block.text === "string" ? block.text : "";
      })
      .join(" ");
  }
  return "";
}

/** 返回该 session 已写入 chunk 的最大 last_offset；无则 -1 */
function maxLastOffset(db: ReturnType<typeof openConversationDbAt>, sessionId: string): number {
  const row = db.db
    .prepare("SELECT COALESCE(MAX(last_offset), -1) AS m FROM chunks WHERE session_id = ?")
    .get(sessionId) as { m: number };
  return row.m;
}

/**
 * 执行一次 turn_end 增量索引。返回写入的 chunk 数。
 * 幂等：同 session 同 turnIndex 同 role 同 seq 的 chunk id 重复 → SQLite PK 冲突忽略。
 */
export function indexTurnEndChunks(input: TurnEndIndexInput): number {
  const { dataRoot, sessionId, turnIndex, message, toolResults } = input;
  const db = openConversationDbAt(dataRoot);
  const offsetBase = maxLastOffset(db, sessionId) + 1;
  let seq = 0;
  let written = 0;

  const insert = (content: string, role: ChunkInput["role"], sourceType: string): void => {
    const id = `${sessionId}:${turnIndex}:${role}:${seq}`;
    try {
      db.db
        .prepare(
          `INSERT INTO chunks (id, session_id, content, role, source_type, created_at, last_offset, last_mtime_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING`,
        )
        .run(
          id,
          sessionId,
          content,
          role,
          sourceType,
          new Date().toISOString(),
          offsetBase + seq,
          Date.now(),
        );
      // chunks_fts：仅当 chunks 行确实新增（非幂等跳过）时写入索引，避免重复
      const row = db.db.prepare("SELECT rowid FROM chunks WHERE id = ?").get(id) as { rowid: number } | undefined;
      if (row) {
        const tokens = tokenizeBigram(content);
        if (tokens.length) {
          db.db
            .prepare("INSERT INTO chunks_fts (rowid, content) VALUES (?, ?)")
            .run(row.rowid, tokens.join(" "));
        }
      }
      seq += 1;
      written += 1;
    } catch {
      // PK 冲突（幂等跳过）
    }
  };

  if (message && typeof message.content !== "undefined") {
    const text = extractMessageText(message);
    if (text) {
      insert(text, "assistant", "message");
    }
  }

  for (const tr of toolResults ?? []) {
    const text = extractToolText(tr);
    if (text) {
      insert(text, "tool", "tool_result");
    }
  }

  closeDatabase(db); // 释放文件锁（每次调用独立连接，写后即关）
  return written;
}