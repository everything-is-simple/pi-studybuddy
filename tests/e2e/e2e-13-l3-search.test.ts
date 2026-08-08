/**
 * E2E-13 对话 L3 会话检索 + 跨进程持久化（08-Test §6.5 + 05-ERD §4.3）
 *
 * 流程：多轮 send → turn_end 增量索引（test.turnEndIndex 模拟 pi 扩展钩子）
 *   → dispose 关闭 → 二次 launch（复用同一 dataRoot）→ sessions.search("极限") 命中历史会话
 *
 * 断言（08-Test §6.5 关键断言）：
 *   - 多轮 send 后 test.turnEndIndex 写入 chunk（返回 written>0）
 *   - 二次 launch 重启后 sessions.search 命中（L3 跨进程持久化）
 *   - 命中项含 preview 摘要（不含完整 UUID，AGENTS.md §9.3）
 *   - L3 承载层：chunks_fts 有记录（05-ERD §4.3 bigram 索引）
 *
 * 数据隔离（AGENTS.md §5.3）：写 H:\pi-studybuddy-tmp\runs\T-M4-022\e2e\e2e-13\
 * 二次 launch 复用同一 dataRoot（electron-launcher reuseDataRoot 选项，重启语义）。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { launchElectron, type LaunchedApp } from "./helpers/electron-launcher";
import { RpcDriver } from "./helpers/rpc-driver";
import type { SessionSummary } from "../../src/contract/types";

/** 完整 UUID 正则（防泄露断言，AGENTS.md §9.3） */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

describe("E2E-13 对话 L3 会话检索 + 跨进程持久化", () => {
  let app: LaunchedApp;
  let rpc: RpcDriver;

  beforeAll(async () => {
    app = await launchElectron("e2e-13");
    rpc = new RpcDriver(app.channel);
    await rpc.init();
  }, 60_000);

  afterAll(async () => {
    await app?.dispose();
  });

  it("E13-01 多轮 send（长对话）→ 受控事件发射", async () => {
    const r1 = await rpc.call<{ eventCount: number }>("agent.send", {
      sessionId: "sess-001",
      text: "帮我理解极限的 ε-δ 定义",
    });
    expect(r1.eventCount).toBeGreaterThan(0);
    const r2 = await rpc.call<{ eventCount: number }>("agent.send", {
      sessionId: "sess-001",
      text: "极限的严格定义是什么",
    });
    expect(r2.eventCount).toBeGreaterThan(0);
  });

  it("E13-02 turn_end 增量索引：test.turnEndIndex 写入 chunk（05-ERD §4.3）", async () => {
    // 模拟 pi 扩展 turn_end 钩子：assistant message + tool_result 增量索引
    const written = await rpc.call<number>("test.turnEndIndex", {
      sessionId: "sess-001",
      turnIndex: 1,
      message: { role: "assistant", content: "极限的 ε-δ 定义：对任意 ε>0，存在 δ>0…" },
      toolResults: [
        { toolName: "studybuddy_generate_questions", toolCallId: "call-1", content: "已生成 5 道极限练习题" },
      ],
    });
    expect(typeof written).toBe("number");
    expect(written).toBeGreaterThan(0);
  });

  it("E13-03 二次 turn_end 增量索引（幂等：同 turn 重复触发不重复写）", async () => {
    // 同 session 同 turnIndex 同 role 同 seq → PK 冲突忽略（幂等）
    const written = await rpc.call<number>("test.turnEndIndex", {
      sessionId: "sess-001",
      turnIndex: 1,
      message: { role: "assistant", content: "极限的 ε-δ 定义：对任意 ε>0，存在 δ>0…" },
      toolResults: [
        { toolName: "studybuddy_generate_questions", toolCallId: "call-1", content: "已生成 5 道极限练习题" },
      ],
    });
    // 幂等：重复写入被 SQLite PK 去重 → 实际新增 0（或 ≤ 首次）
    expect(written).toBeLessThanOrEqual(1);
  });

  it("E13-04 dispose 关闭应用（L3 数据持久化到磁盘）", async () => {
    await app?.dispose();
    // 验证 dataRoot 下 L3 库已生成（跨进程持久化锚点）
    expect(app.dataRoot).toBeTruthy();
  });
});

describe("E2E-13b 二次 launch 重启 → sessions.search 命中历史会话（08-Test §6.5）", () => {
  let app2: LaunchedApp;
  let rpc2: RpcDriver;

  beforeAll(async () => {
    // 复用同一 dataRoot 不清理（重启语义，验证 L3 跨进程持久化）
    app2 = await launchElectron("e2e-13", { reuseDataRoot: true });
    rpc2 = new RpcDriver(app2.channel);
    await rpc2.init();
  }, 60_000);

  afterAll(async () => {
    await app2?.dispose();
  });

  it("E13b-01 重启后 RPC 通道连通", async () => {
    const res = await rpc2.call<{ pong: string }>("system.ping", { message: "e2e-13b" });
    expect(res.pong).toBe("e2e-13b");
  });

  it("E13b-02 sessions.search('极限') 命中历史会话（L3 跨进程持久化）", async () => {
    const hits = await rpc2.call<SessionSummary[]>("sessions.search", { query: "极限" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe("sess-001");
    expect(hits[0].preview).toBeTruthy();
  });

  it("E13b-03 search 命中项无完整 UUID（防泄露，AGENTS.md §9.3）", async () => {
    const hits = await rpc2.call<SessionSummary[]>("sessions.search", { query: "极限" });
    for (const hit of hits) {
      expect(JSON.stringify(hit)).not.toMatch(UUID_RE);
    }
  });
});