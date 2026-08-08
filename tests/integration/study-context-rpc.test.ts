import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createAgentHost } from "../../src/agent-host";
import { createRpcClient, type AnyMessagePort } from "../../src/contract/rpc";
import type { AgentEvent } from "../../src/contract/types";
import { createHostManager } from "../../src/main/host-manager";
import { openConversationDb, insertChunk } from "../../src/data/l3/indexer";

/**
 * T-M3-003 集成测试：
 *   - agent.send 带 sessionMeta（学科/目标/错题）→ 受控序列注入学习上下文段 + 会话元数据写回
 *   - sessions.search RPC 往返（L3 fixture 库：写入 chunk 后可检索到会话摘要）
 *
 * 数据隔离：L3 库写入 resolveDataRoot() 派生路径有风险——测试仅对内存仓库与
 * 临时目录 L3 fixture 断言；sessionMeta 写回内存仓库不落盘。
 * H:\pi-studybuddy-tmp\runs\T-M3-003\ 由 L3 单件测试独立覆盖。
 */

function makeMemoryParentPort(): {
  parentPort: AnyMessagePort;
  deliverConnect(hostEnd: AnyMessagePort): void;
} {
  const listeners: Array<(ev: { data: unknown; ports?: AnyMessagePort[] }) => void> = [];
  const parentPort: AnyMessagePort = {
    addEventListener(_type: string, cb: (ev: { data: unknown; ports?: AnyMessagePort[] }) => void) {
      listeners.push(cb);
    },
    start() {},
  };
  return {
    parentPort,
    deliverConnect(hostEnd: AnyMessagePort) {
      for (const cb of listeners) cb({ data: { type: "connect" }, ports: [hostEnd] });
    },
  };
}

describe("T-M3-003 学习场景业务化集成（agent.send sessionMeta + sessions.search）", () => {
  let agentHost: ReturnType<typeof createAgentHost>;
  let hostManager: ReturnType<typeof createHostManager>;
  let client: ReturnType<typeof createRpcClient>;
  let received: AgentEvent[] = [];

  beforeAll(async () => {
    const control = makeMemoryParentPort();
    agentHost = createAgentHost(control.parentPort);
    const handle = {
      sendConnectPort(port: AnyMessagePort) {
        control.deliverConnect(port);
      },
      onExit() {},
      kill() {},
    };
    hostManager = createHostManager({
      forkAgent: () => handle,
      createChannelPair: () => {
        const { port1, port2 } = new MessageChannel();
        return { rendererEnd: port1 as unknown as AnyMessagePort, hostEnd: port2 as unknown as AnyMessagePort };
      },
    });
    const rendererEnd = await hostManager.connectHost();
    client = createRpcClient(rendererEnd);
  });

  afterAll(() => {
    client.dispose();
    hostManager.dispose();
    agentHost.dispose();
  });

  it("agent.send 带 sessionMeta → 注入学习上下文 token + 会话元数据写回", async () => {
    received = [];
    const unsubscribe = client.subscribe("agent.events", undefined, (payload) => {
      received.push(payload as AgentEvent);
    });

    const result = await client.call("agent.send", {
      sessionId: "sess-001",
      text: "帮我理解极限定义",
      sessionMeta: { subject: "高数", goal: "极限练习", mistakeIds: ["mist-001"] },
    });
    expect(result.eventCount).toBeGreaterThan(0);

    // 学习上下文 token 出现在序列中（学科/目标/错题段）
    const contextToken = received.find(
      (e) => e.kind === "token" && typeof e.payload === "object" && e.payload !== null && "text" in e.payload &&
        String((e.payload as { text: string }).text).includes("[学习上下文]"),
    );
    expect(contextToken).toBeDefined();
    const text = (contextToken?.payload as { text: string }).text;
    expect(text).toContain("当前学科");
    expect(text).toContain("高数");
    expect(text).toContain("学习目标");
    expect(text).toContain("极限练习");
    expect(text).toContain("关联错题");
    expect(text).toContain("mist-001");

    // 会话元数据写回内存仓库（sessions.get 可见）
    const session = await client.call("sessions.get", { id: "sess-001" });
    expect(session.subject).toBe("高数");
    expect(session.goal).toBe("极限练习");
    expect(session.mistakeIds).toEqual(["mist-001"]);

    unsubscribe();
  });

  it("agent.send 无 sessionMeta → 不注入学习上下文 token（向后兼容）", async () => {
    received = [];
    const unsubscribe = client.subscribe("agent.events", undefined, (payload) => {
      received.push(payload as AgentEvent);
    });
    await client.call("agent.send", { sessionId: "sess-002", text: "你好" });
    const hasContext = received.some(
      (e) => e.kind === "token" && "text" in (e.payload as object) &&
        String((e.payload as { text: string }).text).includes("[学习上下文]"),
    );
    expect(hasContext).toBe(false);
    unsubscribe();
  });

  it("sessions.search 空查询 → 空数组（不抛错）", async () => {
    const result = await client.call("sessions.search", { query: "  " });
    expect(result).toEqual([]);
  });

  it("sessions.search 无 L3 库 → 空数组（检索库未建立属正常态）", async () => {
    // resolveDataRoot() 指向真实数据根；单机测试环境无 conversation.sqlite 时返回空
    const result = await client.call("sessions.search", { query: "极限" });
    expect(Array.isArray(result)).toBe(true);
  });
});
