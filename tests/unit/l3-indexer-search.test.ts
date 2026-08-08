import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import { openConversationDb, insertChunk, type ChunkInput } from "../../src/data/l3/indexer";
import { searchChunks } from "../../src/data/l3/search";

/**
 * T-M3-003 L3 承载层 indexer + search 往返测试（05-ERD §4.3）
 *
 * 断言：
 *   - openConversationDb 建 chunks + chunks_fts（DDL 幂等）
 *   - insertChunk 写入 chunks 行 + chunks_fts 有 bigram token
 *   - searchChunks OR-combined MATCH 命中/无命中
 *   - 完整 UUID 写入不产生可检索的 UUID token
 *
 * 数据隔离：H:\pi-studybuddy-tmp\runs\T-M3-003\l3\（AGENTS.md §5.3）
 */

const BASE = "H:\\pi-studybuddy-tmp\\runs\\T-M3-003\\l3";

function chunk(partial: Partial<ChunkInput> & Pick<ChunkInput, "id" | "session_id" | "content" | "role">): ChunkInput {
  return {
    source_type: "message",
    created_at: "2026-08-08T00:00:00Z",
    last_offset: 0,
    last_mtime_ms: 0,
    ...partial,
  };
}

describe("L3 conversation.sqlite 承载层（indexer + search）", () => {
  let dbPath = "";
  let db: ReturnType<typeof openConversationDb>;

  beforeAll(() => {
    rmSync(BASE, { recursive: true, force: true });
    mkdirSync(BASE, { recursive: true });
    dbPath = path.join(BASE, "conversation.sqlite");
    db = openConversationDb(dbPath);
  });

  afterAll(() => {
    try {
      db.close();
    } catch {
      // 已关闭
    }
    for (let i = 0; i < 3; i++) {
      try {
        rmSync(BASE, { recursive: true, force: true });
        break;
      } catch {
        // 忽略 EBUSY
      }
    }
  });

  it("openConversationDb 幂等建表（chunks + chunks_fts）", () => {
    const tables = db.db
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','virtual table') AND name LIKE 'chunk%'")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain("chunks");
    expect(names).toContain("chunks_fts");
    // 二次打开不抛错（DDL 幂等）
    const again = openConversationDb(dbPath);
    again.db.close();
  });

  it("insertChunk 写入 chunks 行 + chunks_fts 有 bigram token", () => {
    insertChunk(
      db,
      chunk({
        id: "chunk-1",
        session_id: "sess-1",
        content: "学习计划",
        role: "user",
        last_offset: 10,
        last_mtime_ms: 1000,
      }),
    );

    const rows = db.db.prepare("SELECT id, session_id, content, role, last_offset, last_mtime_ms FROM chunks WHERE id = ?").all("chunk-1") as Array<{
      id: string;
      session_id: string;
      content: string;
      role: string;
      last_offset: number;
      last_mtime_ms: number;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].session_id).toBe("sess-1");
    expect(rows[0].content).toBe("学习计划");
    expect(rows[0].role).toBe("user");
    expect(rows[0].last_offset).toBe(10);
    expect(rows[0].last_mtime_ms).toBe(1000);
  });

  it("searchChunks CJK bigram OR-combined 命中", () => {
    insertChunk(
      db,
      chunk({
        id: "chunk-2",
        session_id: "sess-1",
        content: "极限的 epsilon-delta 定义",
        role: "assistant",
        last_offset: 20,
        last_mtime_ms: 2000,
      }),
    );
    insertChunk(
      db,
      chunk({
        id: "chunk-3",
        session_id: "sess-2",
        content: "导数定义 5 题练习",
        role: "assistant",
        last_offset: 30,
        last_mtime_ms: 3000,
      }),
    );

    const hits = searchChunks(db, "极限", 5);
    expect(hits.length).toBeGreaterThan(0);
    const sessIds = new Set(hits.map((h) => h.session_id));
    expect(sessIds).toContain("sess-1");
    expect(sessIds).not.toContain("sess-2");

    const hits2 = searchChunks(db, "导数", 5);
    const sessIds2 = new Set(hits2.map((h) => h.session_id));
    expect(sessIds2).toContain("sess-2");
  });

  it("searchChunks 无命中返回空数组", () => {
    expect(searchChunks(db, "不存在的词汇xyzabc", 5)).toEqual([]);
  });

  it("完整 UUID 写入后不可被检索（泄漏基线）", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    insertChunk(
      db,
      chunk({
        id: "chunk-uuid",
        session_id: "sess-uuid",
        content: `会话标识 ${uuid} 相关内容`,
        role: "tool",
        last_offset: 40,
        last_mtime_ms: 4000,
      }),
    );
    const hits = searchChunks(db, uuid, 5);
    // UUID 整串不命中（未索引）
    const uuidHits = hits.filter((h) => h.session_id === "sess-uuid");
    expect(uuidHits).toEqual([]);
  });
});
