/**
 * T-M0-005 file-watch 集成测试（03-Arch §6.6 + 06-API §3.2/§4）
 *
 * 真实 RPC 链路：renderer → main → agent-host → file-watch → Streams["files.changed"]。
 * 数据隔离：写入 H:\pi-studybuddy-tmp\runs\T-M0-005\ 绝不污染业务数据。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MessageChannel } from "node:worker_threads";
import { createAgentHost } from "../../src/agent-host";
import { createHostManager, type AgentHostHandle } from "../../src/main/host-manager";
import { createRpcClient, type AnyMessagePort } from "../../src/contract/rpc";

const ISOLATION_ROOT = path.join(os.tmpdir(), "pi-studybuddy-T-M0-005-rpc");

function makeMemoryParentPort() {
  const listeners: Array<(ev: { data: unknown; ports?: AnyMessagePort[] }) => void> = [];
  return {
    parentPort: {
      addEventListener(_t: string, cb: (ev: { data: unknown; ports?: AnyMessagePort[] }) => void) {
        listeners.push(cb);
      },
      start() {},
    } as AnyMessagePort,
    deliverConnect(hostEnd: AnyMessagePort) {
      for (const cb of listeners) cb({ data: { type: "connect" }, ports: [hostEnd] });
    },
  };
}

function makeSimulatedApp() {
  const control = makeMemoryParentPort();
  const agentHost = createAgentHost(control.parentPort);
  const handle: AgentHostHandle = {
    sendConnectPort(port: AnyMessagePort) {
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

async function waitForDebounce(extraMs = 100): Promise<void> {
  await new Promise((r) => setTimeout(r, 100 + extraMs));
}

describe("file-watch RPC 集成测试（main→agent-host→fs.watch→Streams）", () => {
  beforeAll(() => {
    fs.mkdirSync(ISOLATION_ROOT, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(ISOLATION_ROOT, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("FW-RPC-01: files.watch 启动监听，订阅 files.changed 收到事件", async () => {
    const { hostManager } = makeSimulatedApp();
    const rendererEnd = await hostManager.connectHost();
    const client = createRpcClient(rendererEnd);

    const filePath = path.join(ISOLATION_ROOT, "rpc-01.txt");
    fs.writeFileSync(filePath, "init");

    const received: Array<{ path: string; changeType: string }> = [];
    const unsub = client.subscribe("files.changed", filePath, (payload) => {
      received.push(payload as { path: string; changeType: string });
    });

    // 启动监听
    await client.call("files.watch", { path: filePath });
    await new Promise((r) => setTimeout(r, 50));

    // 修改文件
    fs.writeFileSync(filePath, "modified");
    await waitForDebounce();

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0].path).toBe(filePath);
    expect(received[0].changeType).toBe("change");

    unsub();
    client.dispose();
    hostManager.dispose();
  });

  it("FW-RPC-02: 真实文件修改 → 收到 { path, changeType: 'change' }", async () => {
    const { hostManager } = makeSimulatedApp();
    const rendererEnd = await hostManager.connectHost();
    const client = createRpcClient(rendererEnd);

    const filePath = path.join(ISOLATION_ROOT, "rpc-02.txt");
    fs.writeFileSync(filePath, "init");

    const received: Array<{ path: string; changeType: string }> = [];
    const unsub = client.subscribe("files.changed", filePath, (p) => received.push(p as typeof received[number]));

    await client.call("files.watch", { path: filePath });
    await new Promise((r) => setTimeout(r, 50));

    fs.writeFileSync(filePath, "v2");
    await waitForDebounce();

    expect(received.length).toBe(1);
    expect(received[0].changeType).toBe("change");

    unsub();
    client.dispose();
    hostManager.dispose();
  });

  it("FW-RPC-03: 真实文件删除 → 收到 { path, changeType: 'unlink' }", async () => {
    const { hostManager } = makeSimulatedApp();
    const rendererEnd = await hostManager.connectHost();
    const client = createRpcClient(rendererEnd);

    const filePath = path.join(ISOLATION_ROOT, "rpc-03.txt");
    fs.writeFileSync(filePath, "init");

    const received: Array<{ path: string; changeType: string }> = [];
    const unsub = client.subscribe("files.changed", filePath, (p) => received.push(p as typeof received[number]));

    await client.call("files.watch", { path: filePath });
    await new Promise((r) => setTimeout(r, 50));

    fs.unlinkSync(filePath);
    await waitForDebounce();

    expect(received.length).toBe(1);
    expect(received[0].changeType).toBe("unlink");

    unsub();
    client.dispose();
    hostManager.dispose();
  });

  it("FW-RPC-04: 目录监听 + 文件新增 → 收到 { path, changeType: 'add' }", async () => {
    const { hostManager } = makeSimulatedApp();
    const rendererEnd = await hostManager.connectHost();
    const client = createRpcClient(rendererEnd);

    const watchDir = path.join(ISOLATION_ROOT, "rpc-04-dir");
    fs.mkdirSync(watchDir, { recursive: true });

    const received: Array<{ path: string; changeType: string }> = [];
    const unsub = client.subscribe("files.changed", watchDir, (p) => received.push(p as typeof received[number]));

    await client.call("files.watch", { path: watchDir });
    await new Promise((r) => setTimeout(r, 80));

    fs.writeFileSync(path.join(watchDir, "new.txt"), "new");
    await waitForDebounce(150);

    expect(received.length).toBeGreaterThanOrEqual(1);
    const addEvent = received.find((e) => e.changeType === "add");
    expect(addEvent).toBeDefined();

    unsub();
    client.dispose();
    hostManager.dispose();
  });

  it("FW-RPC-05: files.unwatch 后 → 文件变更不再推送事件", async () => {
    const { hostManager } = makeSimulatedApp();
    const rendererEnd = await hostManager.connectHost();
    const client = createRpcClient(rendererEnd);

    const filePath = path.join(ISOLATION_ROOT, "rpc-05.txt");
    fs.writeFileSync(filePath, "init");

    const received: Array<{ path: string; changeType: string }> = [];
    const unsub = client.subscribe("files.changed", filePath, (p) => received.push(p as typeof received[number]));

    await client.call("files.watch", { path: filePath });
    await new Promise((r) => setTimeout(r, 50));

    await client.call("files.unwatch", { path: filePath });
    await new Promise((r) => setTimeout(r, 50));

    received.length = 0;
    fs.writeFileSync(filePath, "modified");
    await waitForDebounce();

    expect(received.length).toBe(0);

    unsub();
    client.dispose();
    hostManager.dispose();
  });

  it("FW-RPC-06: 100ms 防抖——连续变更 5 次 → 仅收到 1 次", async () => {
    const { hostManager } = makeSimulatedApp();
    const rendererEnd = await hostManager.connectHost();
    const client = createRpcClient(rendererEnd);

    const filePath = path.join(ISOLATION_ROOT, "rpc-06.txt");
    fs.writeFileSync(filePath, "init");

    const received: Array<{ path: string; changeType: string }> = [];
    const unsub = client.subscribe("files.changed", filePath, (p) => received.push(p as typeof received[number]));

    await client.call("files.watch", { path: filePath });
    await new Promise((r) => setTimeout(r, 50));

    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(filePath, `v${i}`);
    }
    await waitForDebounce(50);

    expect(received.length).toBe(1);

    unsub();
    client.dispose();
    hostManager.dispose();
  });

  it("FW-RPC-07: 引用计数——同一 path watch 两次后 unwatch 一次仍收到事件", async () => {
    const { hostManager } = makeSimulatedApp();
    const rendererEnd = await hostManager.connectHost();
    const client = createRpcClient(rendererEnd);

    const filePath = path.join(ISOLATION_ROOT, "rpc-07.txt");
    fs.writeFileSync(filePath, "init");

    const received: Array<{ path: string; changeType: string }> = [];
    const unsub = client.subscribe("files.changed", filePath, (p) => received.push(p as typeof received[number]));

    // watch 两次（refs=2）
    await client.call("files.watch", { path: filePath });
    await client.call("files.watch", { path: filePath });
    await new Promise((r) => setTimeout(r, 50));

    // unwatch 一次（refs=1，仍监听）
    await client.call("files.unwatch", { path: filePath });
    await new Promise((r) => setTimeout(r, 50));

    received.length = 0;
    fs.writeFileSync(filePath, "modified");
    await waitForDebounce();

    expect(received.length).toBe(1);

    unsub();
    client.dispose();
    hostManager.dispose();
  });

  it("FW-RPC-ISOLATION: 测试写入隔离目录，不污染业务数据根", () => {
    expect(fs.existsSync(ISOLATION_ROOT)).toBe(true);
    const userData = process.env.LOCALAPPDATA ?? "";
    if (userData) {
      const possibleLeak = path.join(userData, "PiStudyBuddy", "file-watch-rpc");
      expect(fs.existsSync(possibleLeak)).toBe(false);
    }
  });
});
