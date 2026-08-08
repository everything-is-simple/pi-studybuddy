/**
 * T-M3-006 RED: sessions.rename / sessions.export RPC handler 往返集成测试
 *
 * 权威依据：06-API §3.1（sessions.rename/export 契约已定义，handler 归 T-M3-006）
 * + 09-UI §7（会话管理 UI：重命名/导出操作）+ AGENTS.md §9.3（导出脱敏）。
 *
 * 复用 makeSimulatedApp 夹具（sessions-handlers.test.ts 范式）：真实装配
 * createAgentHost，renderer 端调用 sessions.rename/export 断言返回数据。
 * export 落点=runs 隔离目录（裁决 1），不污染业务数据根。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MessageChannel } from "node:worker_threads";
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("sessions.rename/export RPC handlers（T-M3-006，06-API §3.1）", () => {
  let agentHost: ReturnType<typeof createAgentHost>;
  let hostManager: ReturnType<typeof createHostManager>;
  let client: ReturnType<typeof createRpcClient>;
  let exportDir: string;
  let originalDataRoot: string | undefined;

  beforeAll(async () => {
    exportDir = mkdtempSync(join(tmpdir(), "t-m3-006-export-runs-"));
    // 裁决 1：sessions.export 落点=<dataRoot>/exports/，隔离到临时数据根
    // （PI_STUDYBUDDY_DATA_ROOT 注入，不污染 %LOCALAPPDATA%\PiStudyBuddy，AGENTS.md §5.3）
    originalDataRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
    process.env.PI_STUDYBUDDY_DATA_ROOT = exportDir;
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
    if (originalDataRoot === undefined) {
      delete process.env.PI_STUDYBUDDY_DATA_ROOT;
    } else {
      process.env.PI_STUDYBUDDY_DATA_ROOT = originalDataRoot;
    }
    rmSync(exportDir, { recursive: true, force: true });
  });

  it("sessions.rename 更新会话名称并返回 Session", async () => {
    const list = (await client.call("sessions.list", {})) as Array<{ id: string }>;
    const target = list[0].id;
    const renamed = (await client.call("sessions.rename", {
      id: target,
      name: "重命名后的会话",
    })) as { id: string; name: string };
    expect(renamed.id).toBe(target);
    expect(renamed.name).toBe("重命名后的会话");
    // 持久生效：sessions.get 看到新名称
    const after = (await client.call("sessions.get", { id: target })) as { name: string };
    expect(after.name).toBe("重命名后的会话");
  });

  it("sessions.export md → 返回 path 且文件存在、内容脱敏", async () => {
    const list = (await client.call("sessions.list", {})) as Array<{ id: string; name: string }>;
    const target = list[0].id;
    const result = (await client.call("sessions.export", {
      id: target,
      format: "md",
    })) as { path: string };
    expect(typeof result.path).toBe("string");
    expect(existsSync(result.path)).toBe(true);
    const content = readFileSync(result.path, "utf8");
    expect(content).toContain(list[0].name);
    expect(content).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
    expect(content).not.toMatch(/sk-[a-z0-9]{20,}/i);
  });

  it("sessions.export json → 结构化会话内容，同样脱敏", async () => {
    const list = (await client.call("sessions.list", {})) as Array<{ id: string; name: string }>;
    const target = list[0].id;
    const result = (await client.call("sessions.export", {
      id: target,
      format: "json",
    })) as { path: string };
    const parsed = JSON.parse(readFileSync(result.path, "utf8")) as { id: string; name: string };
    expect(parsed.id).toBe(target);
    expect(parsed.name).toBe(list[0].name);
    const raw = readFileSync(result.path, "utf8");
    expect(raw).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
  });

  it("sessions.export 不存在的会话 → 错误（rejects）", async () => {
    await expect(
      client.call("sessions.export", { id: "sess-999", format: "md" }),
    ).rejects.toThrow();
  });

  it("sessions.rename 不存在的会话 → 错误（rejects）", async () => {
    await expect(
      client.call("sessions.rename", { id: "sess-999", name: "x" }),
    ).rejects.toThrow();
  });
});
