/**
 * pi-studybuddy main 进程 IPC（03-Arch §6.2 desktop:connect-host）
 *
 * renderer 通过 ipcRenderer.invoke(CONNECT_HOST) 请求建立到 agent-host 的 RPC 通道。
 * main 创建 MessageChannelMain，host 端经 parentPort 转交 agent-host，
 * renderer 端经 ipcMain.handle 返回 renderer。
 */
import { ipcMain, MessageChannelMain, utilityProcess, type MessagePortMain } from "electron";
import path from "node:path";
import { IPC_CHANNELS } from "../shared/constants";
import { createHostManager, type AgentHostHandle } from "./host-manager";
import type { AnyMessagePort } from "../contract/rpc";

function forkAgent(): AgentHostHandle {
  const child = utilityProcess.fork(path.join(__dirname, "../agent-host/index.js"));
  return {
    sendConnectPort(port: AnyMessagePort) {
      child.postMessage({ type: "connect" }, [port as unknown as MessagePortMain]);
    },
    onExit(cb: () => void) {
      child.on("exit", cb);
    },
    kill() {
      child.kill();
    },
  };
}

const hostManager = createHostManager({
  forkAgent,
  createChannelPair: () => {
    const { port1, port2 } = new MessageChannelMain();
    return { rendererEnd: port1, hostEnd: port2 };
  },
});

export function registerConnectHostIpc(): void {
  ipcMain.handle(IPC_CHANNELS.CONNECT_HOST, () => hostManager.connectHost());
}