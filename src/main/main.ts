/**
 * pi-studybuddy main 进程入口（03-Arch §6.2）
 *
 * app.whenReady → 初始化业务数据根 + 注册 app:// 协议 + 建立窗口 + fork agent-host。
 * 严格遵循 v0.1 边界：单窗口、单用户、仅监听本机。
 */
import { app, BrowserWindow } from "electron";
import { registerAppProtocol } from "./protocol";
import { createWindow } from "./window";
import { registerConnectHostIpc } from "./ipc";
import { resolveDataRoot } from "../agent-host/allowed-roots";
import { initializeDataRoot, resolveStartupDataRoot } from "./data-root-init";
import { seedTestProfile } from "./test-profile";
import path from "node:path";

/** Electron 单实例锁：防止多实例并发写同一数据根（AGENTS.md §1.1 单写进程） */
void app.requestSingleInstanceLock?.();

app.whenReady().then(() => {
  // Environment override remains test-only and takes precedence over every persisted migration.
  const defaultRoot = resolveDataRoot();
  const rootResolution = resolveStartupDataRoot({
    defaultRoot,
    registryPath: path.join(app.getPath("userData"), "data-root.json"),
    environmentRoot: process.env.PI_STUDYBUDDY_DATA_ROOT,
  });
  process.env.PI_STUDYBUDDY_DATA_ROOT = rootResolution.dataRoot;
  initializeDataRoot(rootResolution.dataRoot);
  seedTestProfile(rootResolution.dataRoot);

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