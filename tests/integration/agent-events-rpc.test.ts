/**
 * T-M3-001 RED: agent.send → Streams["agent.events"] 受控发射集成测试
 *
 * 权威依据：07-WF §2.8（对话路径步骤 2：renderer → agent-host → 流式回复
 * Streams["agent.events"]）+ 06-API §4（agent.events 主题）+ 09-UI §4.2
 * （pi 原生能力承载：流式回复走 agent.events）。
 *
 * 复用 host-rpc.test.ts 的 makeSimulatedApp 夹具：真实装配 createAgentHost，
 * MessageChannel 模拟 Electron 编排，renderer 端 createRpcClient 订阅事件。
 *
 * 数据隔离：纯内存，无文件系统写入。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MessageChannel } from "node:worker_threads";
import { createHostManager } from "../../src/main/host-manager";
import { createAgentHost } from "../../src/agent-host";
import { createRpcClient, type AnyMessagePort } from "../../src/contract/rpc";
import type { AgentEvent } from "../../src/contract/types";

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

describe("agent.send → agent.events 集成（07-WF §2.8 + 06-API §4）", () => {
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

  it("订阅 agent.events 后调用 agent.send → 收到 message_start/token/context_compressed 序列", async () => {
    received = [];
    const unsubscribe = client.subscribe("agent.events", undefined, (payload) => {
      received.push(payload as AgentEvent);
    });

    const result = (await client.call("agent.send", {
      sessionId: "sess-001",
      text: "帮我理解极限的 ε-δ 定义",
    })) as { eventCount: number };

    // 受控发射：message_start + 至少 1 个 token + context_compressed
    expect(result.eventCount).toBeGreaterThanOrEqual(3);
    expect(received.length).toBe(result.eventCount);
    expect(received[0].kind).toBe("message_start");
    expect(received[0].sessionId).toBe("sess-001");
    // 中间应有 token
    const tokenCount = received.filter((e) => e.kind === "token").length;
    expect(tokenCount).toBeGreaterThanOrEqual(1);
    // 最后应为 context_compressed
    expect(received[received.length - 1].kind).toBe("context_compressed");
    // 所有事件同属一个 session
    for (const ev of received) {
      expect(ev.sessionId).toBe("sess-001");
    }

    unsubscribe();
  });

  it("未订阅时 agent.send 仍正常返回（事件不投递不抛错）", async () => {
    const result = (await client.call("agent.send", {
      sessionId: "sess-002",
      text: "hello",
    })) as { eventCount: number };
    expect(typeof result.eventCount).toBe("number");
  });

  it("agent.send 参数不含完整 UUID/密钥（安全不变量 §9.3）", async () => {
    // payload 校验：token 内容不包含 UUID 模式
    const result = (await client.call("agent.send", {
      sessionId: "sess-003",
      text: "test",
    })) as { eventCount: number };
    expect(result.eventCount).toBeGreaterThanOrEqual(3);
    for (const ev of received) {
      const raw = JSON.stringify(ev.payload);
      // 拒绝完整 UUID（8-4-4-4-12 形态）
      expect(raw).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
    }
  });
});
