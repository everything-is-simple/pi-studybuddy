/**
 * T-M3-002 RED: models.list RPC 往返集成
 *
 * 权威依据：06-API §3.13（models.list 契约）+ AGENTS.md §9.5（物理隔离：
 * T-M3-002 受控 fixture 数据源，不读真实 ~/.pi/agent，真实读取属 T-M3-005）。
 *
 * 复用 makeSimulatedApp 夹具：renderer 端调用 models.list 断言返回数据。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MessageChannel } from "node:worker_threads";
import { createHostManager } from "../../src/main/host-manager";
import { createAgentHost } from "../../src/agent-host";
import { createRpcClient, type AnyMessagePort } from "../../src/contract/rpc";
import type { ModelProvider } from "../../src/contract/types";

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

describe("models.list RPC（06-API §3.13 + §9.5 物理隔离）", () => {
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

  it("models.list 返回 ModelProvider[]；未声明模型的中转 provider 不伪造模型 ID", async () => {
    const providers = (await client.call("models.list", {})) as ModelProvider[];
    expect(providers.length).toBeGreaterThanOrEqual(2);
    for (const p of providers) {
      expect(p.id).toBeTruthy();
      expect(p.providerType).toBeTruthy();
    }

    for (const id of ["deepseek", "agnes", "sharkgpt", "pixelgpt", "voklygpt", "chickfarmgpt"]) {
      expect(providers.find((provider) => provider.id === id)?.models.length).toBeGreaterThan(0);
    }
  });

  it("models.list 响应不泄漏 apiKey（02-PRD §5.2）", async () => {
    const providers = (await client.call("models.list", {})) as ModelProvider[];
    const raw = JSON.stringify(providers);
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("api_key");
  });
});
