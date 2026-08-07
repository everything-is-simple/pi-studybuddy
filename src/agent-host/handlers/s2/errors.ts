/**
 * T-M1-002 S2 handler 共享错误工具（06-API §2.2 + §2.3）
 *
 * handler 业务错误 throw RpcError（有 code+message），rpc.ts toError 保留业务码。
 * 永不暴露 SQL/路径/完整 UUID/栈（§2.3）。
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
