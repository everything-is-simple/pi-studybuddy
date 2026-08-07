/**
 * pi-studybuddy main 进程入口（03-Arch §6.2）
 *
 * app.whenReady → 注册 app:// 协议 + 建立窗口 + fork agent-host。
 * 严格遵循 v0.1 边界：单窗口、单用户、仅监听本机。
 */
import { app, BrowserWindow } from "electron";
import { registerAppProtocol } from "./protocol";
import { createWindow } from "./window";
import { registerConnectHostIpc } from "./ipc";

/** Electron 单实例锁：防止多实例并发写同一数据根（AGENTS.md §1.1 单写进程） */
void app.requestSingleInstanceLock?.();

app.whenReady().then(() => {
  registerAppProtocol();
  registerConnectHostIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});