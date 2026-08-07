/**
 * pi-studybuddy main 进程窗口配置（03-Arch §6.4 安全骨架）
 *
 * 安全不变量之一：webPreferences.sandbox === true（08-Test §5.7）。
 * preload 仅暴露最小 piBridge（contextBridge.exposeInMainWorld）。
 */
import { BrowserWindow } from "electron";
import path from "node:path";

/** 创建主窗口，加载 app://renderer 下的 index.html */
export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "pi-studybuddy",
    webPreferences: {
      sandbox: true,
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 生产通过 app:// 协议加载打包产物；开发兜底加载 dev server（当前 M0 无 dev server，走 app://）
  void win.loadURL("app://renderer/index.html");
  return win;
}