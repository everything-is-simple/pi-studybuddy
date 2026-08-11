/**
 * pi-studybuddy main 进程 IPC（03-Arch §6.2 desktop:connect-host）
 *
 * renderer 通过 ipcRenderer.send(CONNECT_HOST) 请求建立到 agent-host 的 RPC 通道。
 * main 创建 MessageChannelMain，host 端经 parentPort 转交 agent-host，
 * renderer 端经 sender.postMessage + transferList 接收 renderer 端口。
 */
import { BrowserWindow, dialog, ipcMain, MessageChannelMain, utilityProcess, type MessagePortMain } from "electron";
import path from "node:path";
import { resolveDataRoot } from "../agent-host/allowed-roots";
import { stageMaterialImport } from "../shared/material-import";
import { IPC_CHANNELS } from "../shared/constants";
import { createHostManager, type AgentHostHandle } from "./host-manager";
import { CredentialVault } from "./credential-vault";
import type { AnyMessagePort } from "../contract/rpc";
import type { DialogOptions, DialogResult, ToolchainStatus } from "../contract/types";
import { createToolchainManager } from "./toolchains";

function forkAgent(): AgentHostHandle {
  const child = utilityProcess.fork(path.join(__dirname, "../agent-host/index.js"));
  let ready = false;
  const pendingPorts: MessagePortMain[] = [];
  const send = (port: MessagePortMain) => {
    child.postMessage({ type: "connect" }, [port]);
  };
  // 2026-08-11：agent-host（utilityProcess）无 electron safeStorage，DPAPI vault 只在
  // main 主进程持有；agent-host 经 parentPort 发 credential-request，此处执行加解密并回传。
  // forkAgent 在 renderer 首次 connectHost 时惰性调用（main 已 whenReady，safeStorage 可用）。
  const vault = new CredentialVault(path.join(resolveDataRoot(), "config", "credentials.json"));
  // utilityProcess 的 message 事件可能携带 { data } 包装；两种格式都兼容。
  child.on("message", (message: unknown) => {
    const data = ((message as { data?: unknown } | null)?.data ?? message) as
      | { type?: string; [key: string]: unknown }
      | null;
    if (!data || typeof data !== "object") return;
    if (data.type === "ready") {
      ready = true;
      for (const port of pendingPorts.splice(0)) send(port);
      return;
    }
    if (data.type === "credential-request") {
      const { id, op, key, value, prefix } = data as {
        id?: string; op?: string; key?: string; value?: string; prefix?: string;
      };
      try {
        let result: unknown;
        switch (op) {
          case "get":
            result = vault.get(key ?? "");
            break;
          case "set":
            vault.set(key ?? "", value ?? "");
            result = undefined;
            break;
          case "delete":
            vault.delete(key ?? "");
            result = undefined;
            break;
          case "listKeys":
            result = vault.listKeys(prefix);
            break;
          default:
            throw new Error("未知凭证操作");
        }
        child.postMessage({ type: "credential-result", id, ok: true, result });
      } catch (error) {
        // 不回传底层错误详情（可能含路径/密钥信息）；agent-host 统一按固定错误处理。
        child.postMessage({ type: "credential-result", id, ok: false, error: "凭证库操作失败" });
      }
      return;
    }
  });
  return {
    sendConnectPort(port: AnyMessagePort) {
      const messagePort = port as unknown as MessagePortMain;
      if (ready) send(messagePort);
      else pendingPorts.push(messagePort);
    },
    onExit(cb: () => void) {
      child.on("exit", cb);
    },
    kill() {
      child.kill();
    },
  };
}

let hostManager: ReturnType<typeof createHostManager> | null = null;

function getHostManager() {
  if (!hostManager) {
    hostManager = createHostManager({
      forkAgent,
      createChannelPair: () => {
        const { port1, port2 } = new MessageChannelMain();
        return { rendererEnd: port1, hostEnd: port2 };
      },
    });
  }
  return hostManager;
}

/** 统一 DialogOptions 到 preload 契约的最小安全结果，不返回底层错误详情。 */
async function showDesktopDialog(options: DialogOptions): Promise<DialogResult> {
  if (options.type === "open") {
    const result = await dialog.showOpenDialog({
      title: options.title,
      defaultPath: options.defaultPath,
      filters: options.filters,
      properties: ["openFile"],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    try {
      const staged = stageMaterialImport(resolveDataRoot(), result.filePaths[0]);
      return {
        canceled: false,
        importToken: staged.token,
        fileName: staged.fileName,
        fileSize: staged.fileSize,
      };
    } catch {
      // 不向 renderer 暴露源路径或底层文件系统错误。
      return { canceled: true };
    }
  }
  if (options.type === "save") {
    const result = await dialog.showSaveDialog({
      title: options.title,
      defaultPath: options.defaultPath,
      filters: options.filters,
    });
    return { canceled: result.canceled, filePath: result.filePath };
  }
  const result = await dialog.showMessageBox({ title: options.title, message: options.message ?? "", buttons: ["确定"] });
  return { canceled: false };
}

/** 注册 preload 白名单中的全部 desktop IPC。 */
export function registerConnectHostIpc(): void {
  // MessagePortMain 不能作为 ipcRenderer.invoke 的结构化克隆返回值；
  // 必须通过 sender.postMessage 的 transferList 交给 renderer（Electron IPC 契约）。
  ipcMain.on(IPC_CHANNELS.CONNECT_HOST, (event) => {
    void getHostManager()
      .connectHost()
      .then((rendererPort) => {
        event.sender.postMessage(IPC_CHANNELS.CONNECT_HOST, null, [rendererPort as MessagePortMain]);
      })
      .catch(() => {
        // 连接失败时不泄漏内部错误；renderer 端由超时/关闭处理。
      });
  });

  ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  ipcMain.handle(IPC_CHANNELS.SHOW_DIALOG, async (_event, options: DialogOptions): Promise<DialogResult> =>
    showDesktopDialog(options),
  );
  ipcMain.handle(IPC_CHANNELS.QUERY_TOOLCHAINS, async (): Promise<ToolchainStatus[]> =>
    createToolchainManager().list(),
  );
  ipcMain.handle(IPC_CHANNELS.GET_WINDOW_STATE, (event): { maximized: boolean } => ({
    maximized: BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false,
  }));
  ipcMain.on(IPC_CHANNELS.MINIMIZE_WINDOW, (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.on(IPC_CHANNELS.MAXIMIZE_WINDOW, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.on(IPC_CHANNELS.CLOSE_WINDOW, (event) => BrowserWindow.fromWebContents(event.sender)?.close());
}
