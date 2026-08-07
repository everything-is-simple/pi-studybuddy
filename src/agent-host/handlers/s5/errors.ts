/**
 * T-M2-001 S5 handler 共享错误工具（06-API §2.2 + §2.3）
 *
 * 复用 S1/S2/S3/S4 模式。handler 业务错误 throw RpcError（有 code+message）。
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
