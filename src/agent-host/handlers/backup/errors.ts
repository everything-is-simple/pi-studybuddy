/**
 * T-M2-005 备份恢复 handler 共享错误工具（06-API §3.11 + 07-WF §5）
 *
 * handler 业务错误 throw RpcError（有 code+message），rpc.ts toError 保留业务码。
 * 永不暴露 SQL/路径/完整 UUID/栈/stdout/stderr/密钥（AGENTS.md §9.4 安全边界）。
 *
 * 错误码固定文案（07-WF §5.5 错误处理 3 条 + AGENTS.md §9.4 安全）：
 *   - CONTENT_HASH_MISMATCH：备份文件已损坏，content_hash 不匹配
 *   - SCHEMA_VERSION_INCOMPATIBLE：备份版本不兼容，当前系统不支持该版本
 *   - INTEGRITY_CHECK_FAILED：恢复后数据完整性检查失败，请联系技术支持
 *   - ZIP_BOMB_DETECTED：备份文件异常，可能已损坏
 *   - PATH_TRAVERSAL_DETECTED：备份文件包含不安全的路径
 *   - BACKUP_FAILED：备份失败，请重试
 *   - SCHEDULE_NOT_FOUND：调度配置不存在
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

/** 错误消息固定文案（不泄漏路径/stdout/stderr/密钥） */
export const MSG = {
  CONTENT_HASH_MISMATCH: "备份文件已损坏，content_hash 不匹配",
  SCHEMA_VERSION_INCOMPATIBLE: "备份版本不兼容，当前系统不支持该版本",
  INTEGRITY_CHECK_FAILED: "恢复后数据完整性检查失败，请联系技术支持",
  ZIP_BOMB_DETECTED: "备份文件异常，可能已损坏",
  PATH_TRAVERSAL_DETECTED: "备份文件包含不安全的路径",
  BACKUP_FAILED: "备份失败，请重试",
  RESTORE_FAILED: "恢复失败，请重试",
  SCHEDULE_NOT_FOUND: "调度配置不存在",
  CRON_EXPRESSION_INVALID: "cron 表达式格式不正确",
  COURSE_NOT_FOUND: "课程不存在",
  SEMESTER_NOT_FOUND: "学期不存在",
} as const;
