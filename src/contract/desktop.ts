/**
 * pi-studybuddy PiBridge 接口（03-Arch §6.2 + §6.3）
 *
 * renderer 通过 preload 暴露到 window 的全局桥（contextBridge.exposeInMainWorld("piBridge", ...)）。
 * 06-API §1.3 preload 受控桥接：仅暴露本白名单接口。
 *
 * 桥面方法（selectDirectory/showDialog/queryToolchains/window 控制）的 MAIN 侧实现
 * 依据依赖在 T-M0-004/T-M0-008 等任务补全；本任务仅声明类型。
 */
import type { AnyMessagePort } from "./rpc";
import type { DialogOptions, DialogResult, ToolchainStatus } from "./types";

export interface PiBridge {
  /** 请求 main 创建 renderer↔agent-host 的 MessagePort 通道并返回之一端 */
  connectHost(): Promise<AnyMessagePort>;
  /** 目录选择（dialog.showOpenDialog，记录 recentCwds） */
  selectDirectory(): Promise<string | null>;
  /** 通用对话框（open/save/message） */
  showDialog(options: DialogOptions): Promise<DialogResult>;
  /** 查询工具链发现结果 */
  queryToolchains(): Promise<ToolchainStatus[]>;
  /** 窗口最大化状态 */
  getWindowState(): Promise<{ maximized: boolean }>;
  /** 最小化窗口 */
  minimizeWindow(): void;
  /** 最大化/还原窗口 */
  maximizeWindow(): void;
  /** 关闭窗口 */
  closeWindow(): void;
}