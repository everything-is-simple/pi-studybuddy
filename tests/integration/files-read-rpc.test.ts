/**
 * T-M3-002 RED: files.read RPC 往返集成（allowed-roots 白名单门禁）
 *
 * 权威依据：06-API §3.2（files.read）+ 07-WF §2.8 步骤 4（@文件引用经
 * allowed-roots 校验）+ AGENTS.md §9.4（符号链接逃逸防护）。
 *
 * 数据隔离：PI_STUDYBUDDY_DATA_ROOT 指向临时目录，不触真实业务数据根。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

describe("files.read RPC（06-API §3.2 + allowed-roots 门禁）", () => {
  let dataRoot: string;
  let agentHost: ReturnType<typeof createAgentHost>;
  let hostManager: ReturnType<typeof createHostManager>;
  let client: ReturnType<typeof createRpcClient>;

  beforeAll(async () => {
    dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pi-studybuddy-files-read-rpc-"));
    const storage = path.join(dataRoot, "semester", "s1", "storage");
    fs.mkdirSync(storage, { recursive: true });
    fs.writeFileSync(path.join(storage, "note.txt"), "极限的 ε-δ 定义", "utf8");
    process.env.PI_STUDYBUDDY_DATA_ROOT = dataRoot;

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
    fs.rmSync(dataRoot, { recursive: true, force: true });
    delete process.env.PI_STUDYBUDDY_DATA_ROOT;
  });

  it("白名单内文件读取成功", async () => {
    const result = (await client.call("files.read", {
      path: path.join(dataRoot, "semester", "s1", "storage", "note.txt"),
    })) as { content: string; encoding: string };
    expect(result.encoding).toBe("utf8");
    expect(result.content).toContain("ε-δ");
  });

  it("越权路径拒绝（BAD_REQUEST）", async () => {
    await expect(
      client.call("files.read", { path: "C:\\Users\\student\\Documents\\secret.txt" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
