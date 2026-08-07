/**
 * pi-studybuddy 共享类型（03-Arch §6.3 自研 RPC 层，五种 wire 消息）
 *
 * 本文件仅含类型与常量，无运行逻辑，可被 renderer（Vite/ESM）与
 * main/agent-host（tsc/CommonJS）双向引用，保持环境无关。
 */

/** 自研 MessagePort RPC 的五种 wire 消息（03-Arch §6.3） */
export type WireMessage =
  | { kind: "request"; id: string; method: string; args: unknown[] }
  | { kind: "response"; id: string; result?: unknown; error?: RpcError }
  | { kind: "subscribe"; id: string; topic: string; key?: string }
  | { kind: "unsubscribe"; id: string }
  | { kind: "event"; topic: string; key?: string; payload: unknown };

/** RPC 传输层错误（与 06-API §2.2 业务错误码对齐；UNKNOWN_METHOD 为传输层新增码） */
export interface RpcError {
  code: string;
  message: string;
}