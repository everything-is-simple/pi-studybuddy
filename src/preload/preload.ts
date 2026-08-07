/**
 * pi-studybuddy preload（03-Arch §6.2 + §6.4 安全骨架）
 *
 * 安全不变量之三：仅通过 contextBridge.exposeInMainWorld("piBridge", ...) 暴露最小桥，
 * 不做任何其他 API 暴露。connectHost 通过 IPC 请求 main 建立 renderer↔agent-host 通道。
 */
import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/constants";
import type { PiBridge } from "../contract/desktop";
import type { AnyMessagePort } from "../contract/rpc";

const bridge: PiBridge = {
  connectHost() {
    return ipcRenderer.invoke(IPC_CHANNELS.CONNECT_HOST) as Promise<AnyMessagePort>;
  },
};

contextBridge.exposeInMainWorld("piBridge", bridge);