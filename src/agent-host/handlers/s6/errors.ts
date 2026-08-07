/**
 * T-M2-002 S6 handler 共享错误工具（06-API §2.2 + §2.3 + §3.8）
 *
 * 复用 S1-S5 模式 + privacyViolation（08-Test §5.4 UUID 泄漏）。
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

/** PARENT_REPORT_PRIVACY_VIOLATION（08-Test §5.4 assertNoSensitiveLeak 检测到 UUID） */
export function privacyViolation(message: string): RpcError {
  return { code: "PARENT_REPORT_PRIVACY_VIOLATION", message };
}
