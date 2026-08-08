/**
 * T-M3-001 RED: sessions.* RPC handler 往返集成测试
 *
 * 权威依据：06-API §3.1（sessions.list/get/delete）+ 09-UI §4.2（对话 Tab 承载）
 *
 * 复用 makeSimulatedApp 夹具：真实装配 createAgentHost，renderer 端调用
 * sessions.* 方法断言返回数据。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MessageChannel } from "node:worker_threads";
import { createHostManager } from "../../src/main/host-manager";
import { createAgentHost } from "../../src/agent-host";
import { createRpcClient, type AnyMessagePort } from "../../src/contract/rpc";

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

describe("sessions.* RPC handlers（06-API §3.1）", () => {
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

  it("sessions.list 返回会话摘要列表", async () => {
    const result = (await client.call("sessions.list", {})) as Array<{
      id: string;
      name: string;
      updatedAt: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const s of result) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.name).toBe("string");
      expect(typeof s.updatedAt).toBe("string");
    }
  });

  it("sessions.get 返回含 context 的会话", async () => {
    const list = (await client.call("sessions.list", {})) as Array<{ id: string }>;
    const result = (await client.call("sessions.get", { id: list[0].id })) as {
      id: string;
      name: string;
      context: { systemPrompt: string; messages: number; tokens: number; compressed: boolean };
    };
    expect(result.id).toBe(list[0].id);
    expect(typeof result.context.systemPrompt).toBe("string");
    expect(typeof result.context.messages).toBe("number");
  });

  it("sessions.delete 删除会话", async () => {
    const before = (await client.call("sessions.list", {})) as Array<{ id: string }>;
    const target = before[0].id;
    const delResult = (await client.call("sessions.delete", { id: target })) as void;
    expect(delResult).toBeUndefined();
    const after = (await client.call("sessions.list", {})) as Array<{ id: string }>;
    expect(after.find((s) => s.id === target)).toBeUndefined();
  });

  it("sessions.context 返回上下文状态", async () => {
    const list = (await client.call("sessions.list", {})) as Array<{ id: string }>;
    const ctx = (await client.call("sessions.context", { id: list[0].id })) as {
      messages: number;
      tokens: number;
      compressed: boolean;
    };
    expect(typeof ctx.messages).toBe("number");
    expect(typeof ctx.compressed).toBe("boolean");
  });
});
