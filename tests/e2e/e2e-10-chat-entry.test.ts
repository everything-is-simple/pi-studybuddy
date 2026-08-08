/**
 * E2E-10 对话 Tab 默认主入口 + AI 流式事件（08-Test §6.5 + 02-PRD §3.11）
 *
 * 流程：启动应用 → 对话默认主入口（DEFAULT_TAB_ID=chat 语义，承载层 agent.send）
 *   → 发送"帮我理解极限的 ε-δ 定义" → agent.events 流式序列
 *   → 会话列表可见
 *
 * 断言（08-Test §6.5 关键断言 + AGENTS.md §9.3 防泄露）：
 *   - agent.send 返回 eventCount>0（受控夹具序列已发射）
 *   - Streams["agent.events"] 事件序列：message_start → token×N → context_compressed
 *   - 事件 payload 无完整 UUID（防泄露，AGENTS.md §9.3）
 *   - 默认会话列表（defaultSessionFixture 的 sess-001/002）可查
 *   - sessions.context 返回承载层上下文（systemPrompt/messages/tokens）
 *   - L1 画像注入语义：before_agent_start 钩子由 T-M1-008 集成测试覆盖，
 *     此处经承载层 sessions.context systemPrompt 断言承载就绪
 *
 * 数据隔离（AGENTS.md §5.3）：写 H:\pi-studybuddy-tmp\runs\T-M3-008\e2e\e2e-10\
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { launchElectron, type LaunchedApp } from "./helpers/electron-launcher";
import { RpcDriver } from "./helpers/rpc-driver";
import type {
  SessionSummary,
  Session,
  SessionContext,
  AgentEvent,
} from "../../src/contract/types";

/** 完整 UUID 正则（防泄露断言，AGENTS.md §9.3） */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

/** 断言事件对象无完整 UUID（防泄露铁律） */
function assertNoUuidInEvent(ev: AgentEvent): void {
  expect(JSON.stringify(ev)).not.toMatch(UUID_RE);
}

describe("E2E-10 对话 Tab 默认主入口 + AI 流式事件", () => {
  let app: LaunchedApp;
  let rpc: RpcDriver;

  beforeAll(async () => {
    app = await launchElectron("e2e-10");
    rpc = new RpcDriver(app.channel);
    await rpc.init();
  }, 60_000);

  afterAll(async () => {
    await app?.dispose();
  });

  it("E10-01 启动 + RPC 通道连通（system.ping）", async () => {
    const res = await rpc.call<{ pong: string; timestamp: number }>("system.ping", { message: "e2e-10" });
    expect(res.pong).toBe("e2e-10");
    expect(typeof res.timestamp).toBe("number");
  });

  it("E10-02 默认会话列表可查（sessions.list）— 对话默认主入口承载层就绪", async () => {
    const list = await rpc.call<SessionSummary[]>("sessions.list", {});
    expect(Array.isArray(list)).toBe(true);
    // defaultSessionFixture 注入 sess-001/sess-002（06-API §3.1 会话骨架）
    expect(list.some((s) => s.id === "sess-001")).toBe(true);
    expect(list.some((s) => s.id === "sess-002")).toBe(true);
  });

  it("E10-03 会话详情可查（sessions.get）→ 含承载层上下文", async () => {
    const session = await rpc.call<Session>("sessions.get", { id: "sess-001" });
    expect(session.id).toBe("sess-001");
    expect(session.context).toBeTruthy();
    expect(typeof session.context.systemPrompt).toBe("string");
    expect(typeof session.context.messages).toBe("number");
  });

  it("E10-04 会话上下文可查（sessions.context）— L1 画像承载语义", async () => {
    const ctx = await rpc.call<SessionContext>("sessions.context", { id: "sess-001" });
    expect(ctx.systemPrompt).toContain("学习对话");
    expect(ctx.messages).toBeGreaterThan(0);
    expect(typeof ctx.compressed).toBe("boolean");
  });

  it("E10-05 发送消息（agent.send）→ 返回 eventCount>0", async () => {
    const res = await rpc.call<{ eventCount: number }>("agent.send", {
      sessionId: "sess-001",
      text: "帮我理解极限的 ε-δ 定义",
    });
    expect(res.eventCount).toBeGreaterThan(0);
  });

  it("E10-06 流式事件序列：message_start → token×N → context_compressed（08-Test §6.5）", async () => {
    // 用原始 channel 监听收集本批发出的完整事件序列（确定性，避免竞态）
    const collected: AgentEvent[] = [];
    const listener = (msg: unknown) => {
      const m = msg as { type?: string; topic?: string; payload?: unknown };
      if (m?.type === "event" && m.topic === "agent.events") {
        collected.push(m.payload as AgentEvent);
      }
    };
    app.channel.on("message", listener);
    try {
      await rpc.call("agent.send", {
        sessionId: "sess-001",
        text: "帮我理解极限的 ε-δ 定义",
      });
      // agent.send 同步发射序列，call 返回后事件已全部到达
      const kinds = collected.map((e) => e.kind);
      expect(kinds[0]).toBe("message_start");
      expect(kinds).toContain("token");
      expect(kinds[kinds.length - 1]).toBe("context_compressed");
      const last = collected[collected.length - 1];
      expect((last.payload as { compressed: boolean }).compressed).toBe(true);
      // 顺序合法性：message_start 在最前，context_compressed 在最后
      expect(kinds.indexOf("message_start")).toBeLessThan(kinds.indexOf("context_compressed"));
    } finally {
      app.channel.removeListener("message", listener);
    }
  });

  it("E10-07 事件 payload 无完整 UUID（防泄露，AGENTS.md §9.3）", async () => {
    const collected: AgentEvent[] = [];
    const listener = (msg: unknown) => {
      const m = msg as { type?: string; topic?: string; payload?: unknown };
      if (m?.type === "event" && m.topic === "agent.events") {
        collected.push(m.payload as AgentEvent);
      }
    };
    app.channel.on("message", listener);
    try {
      await rpc.call("agent.send", {
        sessionId: "sess-001",
        text: "帮我理解极限的 ε-δ 定义",
      });
      expect(collected.length).toBeGreaterThan(0);
      for (const ev of collected) {
        assertNoUuidInEvent(ev);
      }
    } finally {
      app.channel.removeListener("message", listener);
    }
  });

  it("E10-08 空会话/空文本不发射事件（agent.send 防御）", async () => {
    const res = await rpc.call<{ eventCount: number }>("agent.send", {
      sessionId: "",
      text: "",
    });
    expect(res.eventCount).toBe(0);
  });
});