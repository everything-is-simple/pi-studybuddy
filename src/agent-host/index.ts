/**
 * pi-studybuddy agent-host 入口（03-Arch §6.2 + §6.3）
 *
 * agent-host 是 Electron utilityProcess 进程，承载业务内核 RPC 服务。
 * 通过 process.parentPort 与 main 进程通信，监听 { type: "connect" } 控制消息，
 * 收到 main 转发的 MessagePort 后 attach RpcServer 开始服务 renderer 的调用。
 *
 * 本文件导出 createAgentHost() 供集成测试复用；真实 Electron 环境下
 * 顶层代码检测到 process.parentPort 时自动启动。
 */
import { createRpcServer, type AnyMessagePort } from "../contract/rpc";
import type { Api } from "../contract/api";
import { ping } from "./handlers/ping";
import { toolchainHandlers } from "./handlers/toolchains";
import { createFileWatchService } from "./file-watch";
import { createFileHandlers } from "./handlers/files";
import { createModelHandlers } from "./handlers/models";
import { resolveDataRoot } from "./allowed-roots";
import { createSessionStore, defaultSessionFixture } from "./session-store";
import { createSessionHandlers } from "./handlers/sessions";
import { createAgentHandlers } from "./handlers/agent";

export interface AgentHost {
  dispose(): void;
}

/** 启动 agent-host RPC 服务：监听 parentPort 的 connect 消息并 attach 业务端口 */
export function createAgentHost(parentPort: AnyMessagePort): AgentHost {
  const server = createRpcServer();
  const fileWatch = createFileWatchService(server);
  // T-M3-002：files.read 白名单门禁需业务数据根（AGENTS.md §9.4）
  const dataRoot = resolveDataRoot();
  // T-M3-001：会话内存仓库 + sessions.*/agent.* handlers（对话 Tab 承载层）
  const sessionStore = createSessionStore(defaultSessionFixture());
  server.handle({
    "system.ping": (...args: unknown[]) => ping(args[0] as Api["system.ping"]["params"]),
    ...toolchainHandlers,
    ...createFileHandlers(fileWatch, { dataRoot }),
    ...createModelHandlers(dataRoot),
    ...createSessionHandlers({ store: sessionStore, dataRoot }),
    ...createAgentHandlers(server, sessionStore),
  });

  let attached = false;
  const onMessage = (ev: { data: unknown; ports?: AnyMessagePort[] }): void => {
    const msg = ev.data as { type?: string };
    if (!attached && msg?.type === "connect") {
      const port = ev.ports?.[0];
      if (port) {
        server.attachPort(port);
        attached = true;
      }
    }
  };

  if (typeof parentPort.addEventListener === "function") {
    parentPort.addEventListener("message", onMessage);
  } else if (typeof parentPort.on === "function") {
    parentPort.on("message", onMessage);
  } else {
    parentPort.onmessage = onMessage;
  }
  parentPort.start?.();

  return {
    dispose() {
      server.dispose();
      fileWatch.dispose();
      attached = false;
    },
  };
}

// 真实 Electron utilityProcess 入口：仅当运行于 utilityProcess 时自动启动
const parentPort = (globalThis as unknown as { process?: { parentPort?: AnyMessagePort } }).process
  ?.parentPort;
if (parentPort) {
  createAgentHost(parentPort);
}