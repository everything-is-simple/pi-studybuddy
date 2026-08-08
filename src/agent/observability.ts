/**
 * T-M1-008 observability（03-Arch §3.5 + AGENTS.md §9.3 日志脱敏）
 *
 * 在 pi.on("tool_result") 钩子中集中记录所有工具失败事件（tool_execution_end）。
 * 仅记录事件名 / 工具名 / toolCallId / errorCode / 时间戳，**不记录**输入全文、
 * 绝对路径、完整 UUID（§9.3）。
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** 已知业务/通用错误码（06-API §2.2） */
const KNOWN_ERROR_CODES = [
  "NOT_FOUND",
  "INVALID_JSON",
  "FILE_TOO_LARGE",
  "BAD_REQUEST",
  "INTERNAL_ERROR",
  "PARENT_REPORT_PRIVACY_VIOLATION",
] as const;

export interface ToolErrorRecord {
  event: "tool_execution_end";
  toolName: string;
  toolCallId: string;
  errorCode: string;
  occurredAt: string;
}

export interface Observability {
  records: ToolErrorRecord[];
  recordToolError(rec: Omit<ToolErrorRecord, "occurredAt">): void;
}

export function createObservability(): Observability {
  const records: ToolErrorRecord[] = [];
  return {
    records,
    recordToolError(rec) {
      records.push({ ...rec, occurredAt: new Date().toISOString() });
    },
  };
}

/** 从工具输出文本提取已知错误码，无则回退 UNKNOWN_TOOL_ERROR */
function extractErrorCode(text: string): string {
  for (const code of KNOWN_ERROR_CODES) {
    if (text.includes(code)) return code;
  }
  return "UNKNOWN_TOOL_ERROR";
}

/** 注册 tool_result 钩子：isError=true 时统一记录（含 errorCode，不泄漏路径/堆栈） */
export function registerToolResultLogging(pi: ExtensionAPI, obs: Observability): void {
  pi.on("tool_result", (event) => {
    if (!event.isError) return;
    const text = event.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("\n");
    obs.recordToolError({
      event: "tool_execution_end",
      toolName: event.toolName,
      toolCallId: event.toolCallId,
      errorCode: extractErrorCode(text),
    });
  });
}