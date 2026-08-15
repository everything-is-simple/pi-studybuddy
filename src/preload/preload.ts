/**
 * pi-studybuddy preload（03-Arch §6.2 + §6.4 安全骨架）
 *
 * 安全不变量之三：仅通过 contextBridge.exposeInMainWorld("piBridge", ...) 暴露最小桥，
 * 不做任何其他 API 暴露。connectHost 通过 IPC 请求 main 建立 renderer↔agent-host 通道。
 */
import { contextBridge, ipcRenderer } from "electron";
/**
 * Sandboxed preload 只能加载 Electron 白名单内置模块，不能 require 主仓相对模块。
 * 通道名在此保持与 src/shared/constants.ts 同步；启动验收会从真实 BrowserWindow 校验桥面。
 */
const IPC_CHANNELS = {
  CONNECT_HOST: "desktop:connect-host",
  SELECT_DIRECTORY: "desktop:select-directory",
  MIGRATE_DATA_ROOT: "desktop:migrate-data-root",
  SHOW_DIALOG: "desktop:show-dialog",
  QUERY_TOOLCHAINS: "desktop:query-toolchains",
  GET_WINDOW_STATE: "desktop:get-window-state",
  MINIMIZE_WINDOW: "desktop:minimize-window",
  MAXIMIZE_WINDOW: "desktop:maximize-window",
  CLOSE_WINDOW: "desktop:close-window",
} as const;
import type { PiBridge } from "../contract/desktop";
import type { AnyMessagePort } from "../contract/rpc";
import type { DialogOptions, DialogResult, ToolchainStatus } from "../contract/types";

let hostPortPromise: Promise<AnyMessagePort> | null = null;

/**
 * PiBridge 白名单桥（06-API §1.3 preload 受控桥接）。
 * 本会话仅实现桥面转发；对应 ipcMain.handle 的 MAIN 侧实现依依赖在
 * T-M0-004/T-M0-008 等任务补全（当前无 UI 调用，不触发运行时缺失）。
 */
const bridge: PiBridge = {
  connectHost() {
    if (hostPortPromise) return hostPortPromise;
    hostPortPromise = new Promise<AnyMessagePort>((resolve, reject) => {
      const onPort = (event: Electron.IpcRendererEvent) => {
        ipcRenderer.removeListener(IPC_CHANNELS.CONNECT_HOST, onPort);
        const port = event.ports?.[0];
        if (!port) {
          reject(new Error("agent-host 通道未建立"));
          return;
        }
        // MessagePort 这类宿主对象不能直接穿过 contextBridge 返回；
        // 用最小 plain-object Adapter 暴露 RPC 所需方法，事件 payload 保持可克隆。
        resolve({
          postMessage(message: unknown) {
            port.postMessage(message);
          },
          start() {
            port.start();
          },
          close() {
            port.close();
          },
          addEventListener(_type: "message", listener: (event: { data: unknown }) => void) {
            port.addEventListener("message", (event: MessageEvent) => listener({ data: event.data }));
          },
        } as AnyMessagePort);
      };
      ipcRenderer.on(IPC_CHANNELS.CONNECT_HOST, onPort);
      ipcRenderer.send(IPC_CHANNELS.CONNECT_HOST);
    }).catch((error) => {
      hostPortPromise = null;
      throw error;
    });
    return hostPortPromise;
  },
  selectDirectory() {
    return ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY) as Promise<string | null>;
  },
  scheduleDataRootMigration(targetRoot: string) {
    return ipcRenderer.invoke(IPC_CHANNELS.MIGRATE_DATA_ROOT, targetRoot) as Promise<void>;
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