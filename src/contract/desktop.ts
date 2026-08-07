/**
 * pi-studybuddy PiBridge 接口（03-Arch §6.2 + §6.3）
 *
 * renderer 通过 preload 暴露到 window 的全局桥（contextBridge.exposeInMainWorld("piBridge", ...)）。
 * 本文件为 M0 最小子集：仅 connectHost() 建立 renderer↔agent-host 的 MessagePort 通道。
 * 完整 PiBridge（file picker / dialog / toolchain query 等）在 T-M0-002+ 填充。
 */
import type { AnyMessagePort } from "./rpc";

export interface PiBridge {
  /** 请求 main 创建 renderer↔agent-host 的 MessagePort 通道并返回之一端 */
  connectHost(): Promise<AnyMessagePort>;
}