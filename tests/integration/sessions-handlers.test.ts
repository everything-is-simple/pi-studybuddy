/**
 * T-M3-001/T-M5-003 RED: sessions.* RPC handler 往返集成测试
 *
 * 权威依据：06-API §3.1（sessions.list/get/delete）+ 09-UI §4.2（对话 Tab 承载）
 * + 09-UI §7（T-M5-003 真实会话：生产空数据根 + agent.send 首条消息物化）。
 *
 * 复用 makeSimulatedApp 夹具：真实装配 createAgentHost，renderer 端调用
 * sessions.* 方法断言返回数据。数据隔离：PI_STUDYBUDDY_DATA_ROOT → runs 隔离目录。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MessageChannel } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { createHostManager } from "../../src/main/host-manager";
import { createAgentHost } from "../../src/agent-host";
import { createRpcClient, type AnyMessagePort } from "../../src/contract/rpc";

const RUN_ROOT = path.join("H:", "pi-studybuddy-tmp", "runs", "T-M5-003", "integration-sessions-handlers");
const DATA_ROOT = path.join(RUN_ROOT, "data");

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

describe("sessions.* RPC handlers（06-API §3.1 + T-M5-003 真实会话）", () => {
  let agentHost: ReturnType<typeof createAgentHost>;
  let hostManager: ReturnType<typeof createHostManager>;
  let client: ReturnType<typeof createRpcClient>;

  beforeAll(async () => {
    process.env.PI_STUDYBUDDY_DATA_ROOT = DATA_ROOT;
    fs.rmSync(RUN_ROOT, { recursive: true, force: true });
    fs.mkdirSync(DATA_ROOT, { recursive: true });
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
    delete process.env.PI_STUDYBUDDY_DATA_ROOT;
    fs.rmSync(RUN_ROOT, { recursive: true, force: true });
  });

  it("sessions.list 生产空数据根返回空（T-M5-003：不注入 fixture）", async () => {
    const result = (await client.call("sessions.list", {})) as Array<{
      id: string;
      name: string;
      updatedAt: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it("sessions.get 返回含 context 的会话（agent.send 首条消息物化后）", async () => {
    const id = randomUUID();
    await client.call("agent.send", { sessionId: id, text: "帮我理解极限的 ε-δ 定义" });
    const result = (await client.call("sessions.get", { id })) as {
      id: string;
      name: string;
      context: { systemPrompt: string; messages: number; tokens: number; compressed: boolean };
    };
    expect(result.id).toBe(id);
    expect(result.name).toBe("新会话");
    expect(typeof result.context.systemPrompt).toBe("string");
    expect(typeof result.context.messages).toBe("number");
  });

  it("sessions.delete 删除会话", async () => {
    const id = randomUUID();
    await client.call("agent.send", { sessionId: id, text: "待删除会话" });
    const delResult = (await client.call("sessions.delete", { id })) as void;
    expect(delResult).toBeUndefined();
    const after = (await client.call("sessions.list", {})) as Array<{ id: string }>;
    expect(after.find((s) => s.id === id)).toBeUndefined();
  });

  it("sessions.context 返回上下文状态", async () => {
    const id = randomUUID();
    await client.call("agent.send", { sessionId: id, text: "上下文会话" });
    const ctx = (await client.call("sessions.context", { id })) as {
      messages: number;
      tokens: number;
      compressed: boolean;
    };
    expect(typeof ctx.messages).toBe("number");
    expect(typeof ctx.compressed).toBe("boolean");
  });
});
