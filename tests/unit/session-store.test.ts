/**
 * T-M3-001 RED: session-store 内存会话仓库单件测试
 *
 * 权威依据：06-API §3.1（sessions.list/get/delete，对话 Tab 承载）
 *
 * 数据隔离：纯内存仓库 + fixture，不触碰文件系统与真实 pi 会话目录
 * （03-Arch §4.1 + AGENTS.md §9.5 物理隔离）。
 */
import { describe, it, expect } from "vitest";
import { createSessionStore } from "../../src/agent-host/session-store";

const FIXTURE = [
  { id: "sess-001", name: "极限学习", updatedAt: "2026-08-08T09:00:00Z", preview: "ε-δ 定义" },
  { id: "sess-002", name: "导数练习", updatedAt: "2026-08-08T10:00:00Z", preview: "导数定义 5 题" },
];

describe("session-store 内存仓库（06-API §3.1）", () => {
  it("list 返回全部会话摘要（按 updatedAt 降序）", () => {
    const store = createSessionStore(FIXTURE);
    const list = store.list();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe("sess-002"); // 最新在前
    expect(list[1].id).toBe("sess-001");
  });

  it("list 支持 limit 截断", () => {
    const store = createSessionStore(FIXTURE);
    expect(store.list({ limit: 1 })).toHaveLength(1);
  });

  it("get 返回含 context 的完整会话", () => {
    const store = createSessionStore(FIXTURE);
    const session = store.get("sess-001");
    expect(session?.name).toBe("极限学习");
    expect(session?.context).toBeDefined();
    expect(typeof session?.context.messages).toBe("number");
    expect(typeof session?.context.tokens).toBe("number");
    expect(session?.context.compressed).toBe(false);
  });

  it("get 未知 id 返回 undefined", () => {
    const store = createSessionStore(FIXTURE);
    expect(store.get("nope")).toBeUndefined();
  });

  it("delete 删除会话并返回是否命中", () => {
    const store = createSessionStore(FIXTURE);
    expect(store.delete("sess-001")).toBe(true);
    expect(store.get("sess-001")).toBeUndefined();
    expect(store.list()).toHaveLength(1);
    expect(store.delete("nope")).toBe(false);
  });

  it("context 返回会话上下文压缩状态", () => {
    const store = createSessionStore(FIXTURE);
    const ctx = store.context("sess-001");
    expect(ctx?.messages).toBeTypeOf("number");
    expect(ctx?.tokens).toBeTypeOf("number");
  });

  it("无 fixture 时 list 为空且不抛错", () => {
    const store = createSessionStore();
    expect(store.list()).toEqual([]);
  });
});
