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
import type { DialogOptions, DialogResult, ToolchainStatus } from "../contract/types";

/**
 * PiBridge 白名单桥（06-API §1.3 preload 受控桥接）。
 * 本会话仅实现桥面转发；对应 ipcMain.handle 的 MAIN 侧实现依依赖在
 * T-M0-004/T-M0-008 等任务补全（当前无 UI 调用，不触发运行时缺失）。
 */
const bridge: PiBridge = {
  connectHost() {
    return ipcRenderer.invoke(IPC_CHANNELS.CONNECT_HOST) as Promise<AnyMessagePort>;
  },
  selectDirectory() {
    return ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY) as Promise<string | null>;
  },
  showDialog(options: DialogOptions) {
    return ipcRenderer.invoke(IPC_CHANNELS.SHOW_DIALOG, options) as Promise<DialogResult>;
  },
  queryToolchains() {
    return ipcRenderer.invoke(IPC_CHANNELS.QUERY_TOOLCHAINS) as Promise<ToolchainStatus[]>;
  },
  getWindowState() {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_WINDOW_STATE) as Promise<{ maximized: boolean }>;
  },
  minimizeWindow() {
    ipcRenderer.send(IPC_CHANNELS.MINIMIZE_WINDOW);
  },
  maximizeWindow() {
    ipcRenderer.send(IPC_CHANNELS.MAXIMIZE_WINDOW);
  },
  closeWindow() {
    ipcRenderer.send(IPC_CHANNELS.CLOSE_WINDOW);
  },
};

contextBridge.exposeInMainWorld("piBridge", bridge);