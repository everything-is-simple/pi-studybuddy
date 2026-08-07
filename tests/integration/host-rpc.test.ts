import { describe, it, expect, vi } from "vitest";
import { MessageChannel } from "node:worker_threads";
import { createHostManager, type AgentHostHandle } from "../../src/main/host-manager";
import { createAgentHost } from "../../src/agent-host";
import { createRpcClient, type AnyMessagePort } from "../../src/contract/rpc";

/**
 * T-M0-001 集成测试：main↔agent-host RPC（03-Arch §6.2 + §6.3）
 *
 * 在 vitest（Node）环境模拟 Electron 的进程编排：
 *  - MessageChannel 模拟 MessageChannelMain（renderer 端 / host 端一对端口）
 *  - 内存控制通道模拟 utilityProcess 的 parentPort 端口转发
 *  - createAgentHost 真实装配 RPC server（承载 system.ping handler）
 *
 * 验证链路：connectHost() → main 转发 host 端端口 → agent-host attach → RPC ping 往返。
 */

/** 模拟 Electron utilityProcess 的 parentPort：main→agent 的 { type:"connect" } 控制通道 */
function makeMemoryParentPort(): { parentPort: AnyMessagePort; deliverConnect(hostEnd: AnyMessagePort): void } {
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

/** 构造一个真实装配 agent-host + 模拟 main 编排的测试夹具 */
function makeSimulatedApp() {
  const control = makeMemoryParentPort();
  const agentHost = createAgentHost(control.parentPort);

  const handle: AgentHostHandle = {
    sendConnectPort(port) {
      control.deliverConnect(port);
    },
    onExit() {},
    kill() {},
  };

  const hostManager = createHostManager({
    forkAgent: () => handle,
    createChannelPair: () => {
      const { port1, port2 } = new MessageChannel();
      return { rendererEnd: port1 as unknown as AnyMessagePort, hostEnd: port2 as unknown as AnyMessagePort };
    },
  });

  return { hostManager, agentHost };
}

describe("host-rpc 集成测试（main↔agent-host）", () => {
  it("connectHost 后 renderer 通过 RPC 往返 system.ping（agent-host handler 返回 pong + timestamp）", async () => {
    const { hostManager } = makeSimulatedApp();

    const rendererEnd = await hostManager.connectHost();
    const client = createRpcClient(rendererEnd);

    const result = (await client.call("system.ping", { message: "hello" })) as {
      pong: string;
      timestamp: number;
    };
    expect(result.pong).toBe("hello");
    expect(typeof result.timestamp).toBe("number");

    client.dispose();
    hostManager.dispose();
  });

  it("agent-host 异常退出 → main 收到 exit 事件（可重启）", async () => {
    const control = makeMemoryParentPort();
    const agentHost = createAgentHost(control.parentPort);

    let exitCb: (() => void) | undefined;
    const handle: AgentHostHandle = {
      sendConnectPort() {},
      onExit(cb) {
        exitCb = cb;
      },
      kill() {},
    };

    const hostManager = createHostManager({
      forkAgent: () => handle,
      createChannelPair: () => {
        const { port1, port2 } = new MessageChannel();
        return { rendererEnd: port1 as unknown as AnyMessagePort, hostEnd: port2 as unknown as AnyMessagePort };
      },
    });

    const onExit = vi.fn();
    hostManager.onExit(onExit);

    // 模拟 agent-host 崩溃退出
    exitCb?.();
    expect(onExit).toHaveBeenCalledTimes(1);

    agentHost.dispose();
    hostManager.dispose();
  });
});