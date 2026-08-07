/**
 * T-M2-003 S7 handler 共享错误工具（06-API §3.9 + 07-WF §2.7）
 *
 * handler 业务错误 throw RpcError（有 code+message），rpc.ts toError 保留业务码。
 * 永不暴露 SQL/路径/完整 UUID/栈/stdout/stderr/密钥（07-WF §2.7 关键约束）。
 */
import type { RpcError } from "../../../contract/types";

export function notFound(message: string): RpcError {
  return { code: "NOT_FOUND", message };
}

export function badRequest(message: string): RpcError {
  return { code: "BAD_REQUEST", message };
}

export function internalError(message: string): RpcError {
  return { code: "INTERNAL_ERROR", message };
}
