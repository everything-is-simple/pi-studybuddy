/**
 * T-M3-002 RED: agent.send 受控发射扩展——tool_call/tool_result 事件对
 *
 * 权威依据：09-UI §4.2（工具调用视图：AI 每次调用工具可视化展示）+ 07-WF §2.8
 * 步骤 3（AI 自主调用工具 → tool_call/tool_result）+ 08-Test §5.4（受控夹具全 mock）。
 *
 * 复用 makeSimulatedApp 夹具：真实装配 createAgentHost，renderer 端订阅
 * agent.events + 调用 agent.send，断言 tool_call/tool_result 事件序列与
 * payload 结构化字段（脱敏摘要，无完整 UUID/路径）。
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

describe("agent.send → tool_call/tool_result 集成（09-UI §4.2 + 07-WF §2.8）", () => {
  let agentHost: ReturnType<typeof createAgentHost>;
  let hostManager: ReturnType<typeof createHostManager>;
  let client: ReturnType<typeof createRpcClient>;

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

  it("输入含「出题」→ 收到 message_start + token + tool_call + tool_result + context_compressed 序列", async () => {
    const received: AgentEvent[] = [];
    const unsubscribe = client.subscribe("agent.events", undefined, (payload) => {
      received.push(payload as AgentEvent);
    });

    await client.call("agent.send", {
      sessionId: "sess-001",
      text: "帮我出 5 道导数定义题",
    });

    expect(received[0].kind).toBe("message_start");
    expect(received[received.length - 1].kind).toBe("context_compressed");
    const kinds = received.map((e) => e.kind);
    expect(kinds).toContain("tool_call");
    expect(kinds).toContain("tool_result");
    // 顺序：tool_call 必须出现在 tool_result 之前
    expect(kinds.indexOf("tool_call")).toBeGreaterThan(0);
    expect(kinds.indexOf("tool_result")).toBeGreaterThan(kinds.indexOf("tool_call"));

    unsubscribe();
  });

  it("tool_call payload 结构化：toolCallId/toolName/inputSummary 脱敏", async () => {
    const received: AgentEvent[] = [];
    const unsubscribe = client.subscribe("agent.events", undefined, (payload) => {
      received.push(payload as AgentEvent);
    });

    await client.call("agent.send", {
      sessionId: "sess-002",
      text: "帮我生成练习题目",
    });

    const toolCall = received.find((e) => e.kind === "tool_call");
    expect(toolCall).toBeDefined();
    const tc = toolCall!.payload as {
      toolCallId: string;
      toolName: string;
      inputSummary: string;
    };
    expect(tc.toolName).toMatch(/^studybuddy_/);
    expect(typeof tc.toolCallId).toBe("string");
    expect(tc.toolCallId.length).toBeLessThanOrEqual(32);
    expect(typeof tc.inputSummary).toBe("string");
    // 摘要 ≤120 字符（脱敏截断）
    expect(tc.inputSummary.length).toBeLessThanOrEqual(120);
    // 无完整 UUID
    expect(JSON.stringify(tc)).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);

    unsubscribe();
  });

  it("tool_result payload 结构化：toolCallId 与 tool_call 配对 + resultSummary 脱敏", async () => {
    const received: AgentEvent[] = [];
    const unsubscribe = client.subscribe("agent.events", undefined, (payload) => {
      received.push(payload as AgentEvent);
    });

    await client.call("agent.send", {
      sessionId: "sess-003",
      text: "朗读这段内容",
    });

    const toolCall = received.find((e) => e.kind === "tool_call");
    const toolResult = received.find((e) => e.kind === "tool_result");
    expect(toolCall).toBeDefined();
    expect(toolResult).toBeDefined();
    const tc = toolCall!.payload as { toolCallId: string };
    const tr = toolResult!.payload as {
      toolCallId: string;
      isError: boolean;
      resultSummary: string;
    };
    expect(tr.toolCallId).toBe(tc.toolCallId);
    expect(typeof tr.isError).toBe("boolean");
    expect(tr.resultSummary.length).toBeLessThanOrEqual(160);
    expect(JSON.stringify(tr)).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);

    unsubscribe();
  });

  it("无触发词时保持 T-M3-001 基线序列（无 tool 事件）", async () => {
    const received: AgentEvent[] = [];
    const unsubscribe = client.subscribe("agent.events", undefined, (payload) => {
      received.push(payload as AgentEvent);
    });

    await client.call("agent.send", {
      sessionId: "sess-004",
      text: "帮我理解极限的 ε-δ 定义",
    });

    const kinds = received.map((e) => e.kind);
    expect(kinds).not.toContain("tool_call");
    expect(kinds).not.toContain("tool_result");
    expect(kinds[0]).toBe("message_start");
    expect(kinds[kinds.length - 1]).toBe("context_compressed");

    unsubscribe();
  });
});
