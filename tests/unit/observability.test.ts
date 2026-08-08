import { describe, it, expect } from "vitest";
import { createObservability, registerToolResultLogging } from "../../src/agent/observability";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * T-M1-008 observability 单件测试（03-Arch §3.5 + AGENTS.md §9.3 日志脱敏）
 *
 * 断言：
 *   - recordToolError → records 含 tool_execution_end + errorCode + occurredAt
 *   - 工具失败（isError=true）→ 记录；成功（isError=false）→ 不记录
 *   - content 含固定错误码 → errorCode 精确提取；无 → UNKNOWN_TOOL_ERROR
 *   - 日志脱敏：不记录输入全文 / 绝对路径 / 完整 UUID
 */

function createStubPi(): { handlers: Record<string, (e: unknown) => unknown>; pi: ExtensionAPI } {
  const handlers: Record<string, (e: unknown) => unknown> = {};
  const pi = {
    on: (event: string, handler: (e: unknown) => unknown) => {
      handlers[event] = handler;
    },
    registerTool: () => {},
    registerProvider: () => {},
  } as unknown as ExtensionAPI;
  return { handlers, pi };
}

function textContent(text: string) {
  return { type: "text", text };
}

describe("Observability", () => {
  it("recordToolError → records 含 tool_execution_end + errorCode + occurredAt", () => {
    const obs = createObservability();
    obs.recordToolError({
      event: "tool_execution_end",
      toolName: "studybuddy_convert_material",
      toolCallId: "call-1",
      errorCode: "BAD_REQUEST",
    });
    expect(obs.records).toHaveLength(1);
    const rec = obs.records[0];
    expect(rec.event).toBe("tool_execution_end");
    expect(rec.toolName).toBe("studybuddy_convert_material");
    expect(rec.toolCallId).toBe("call-1");
    expect(rec.errorCode).toBe("BAD_REQUEST");
    expect(typeof rec.occurredAt).toBe("string");
    expect(new Date(rec.occurredAt).getTime()).not.toBeNaN();
  });

  it("工具失败（isError=true）→ 记录", () => {
    const obs = createObservability();
    const { handlers, pi } = createStubPi();
    registerToolResultLogging(pi, obs);
    const handler = handlers["tool_result"] as (e: {
      isError: boolean;
      toolName: string;
      toolCallId: string;
      content: { type: string; text: string }[];
    }) => void;
    handler({
      isError: true,
      toolName: "studybuddy_generate_questions",
      toolCallId: "call-2",
      content: [textContent("操作失败：BAD_REQUEST")],
    });
    expect(obs.records).toHaveLength(1);
    expect(obs.records[0].errorCode).toBe("BAD_REQUEST");
  });

  it("工具成功（isError=false）→ 不记录", () => {
    const obs = createObservability();
    const { handlers, pi } = createStubPi();
    registerToolResultLogging(pi, obs);
    const handler = handlers["tool_result"] as (e: {
      isError: boolean;
      toolName: string;
      toolCallId: string;
      content: { type: string; text: string }[];
    }) => void;
    handler({
      isError: false,
      toolName: "studybuddy_upload_material",
      toolCallId: "call-3",
      content: [textContent("成功")],
    });
    expect(obs.records).toHaveLength(0);
  });

  it("content 含固定错误码 → errorCode 精确提取", () => {
    const obs = createObservability();
    const { handlers, pi } = createStubPi();
    registerToolResultLogging(pi, obs);
    const handler = handlers["tool_result"] as (e: {
      isError: boolean;
      toolName: string;
      toolCallId: string;
      content: { type: string; text: string }[];
    }) => void;
    handler({
      isError: true,
      toolName: "studybuddy_confirm_exam",
      toolCallId: "call-4",
      content: [textContent("学期不存在：NOT_FOUND")],
    });
    expect(obs.records[0].errorCode).toBe("NOT_FOUND");
  });

  it("content 无固定错误码 → UNKNOWN_TOOL_ERROR", () => {
    const obs = createObservability();
    const { handlers, pi } = createStubPi();
    registerToolResultLogging(pi, obs);
    const handler = handlers["tool_result"] as (e: {
      isError: boolean;
      toolName: string;
      toolCallId: string;
      content: { type: string; text: string }[];
    }) => void;
    handler({
      isError: true,
      toolName: "studybuddy_backup_all_courses",
      toolCallId: "call-5",
      content: [textContent("磁盘写入失败")],
    });
    expect(obs.records[0].errorCode).toBe("UNKNOWN_TOOL_ERROR");
  });

  it("日志脱敏：不把所有内容/路径写入 records（AGENTS.md §9.3）", () => {
    const obs = createObservability();
    const { handlers, pi } = createStubPi();
    registerToolResultLogging(pi, obs);
    const handler = handlers["tool_result"] as (e: {
      isError: boolean;
      toolName: string;
      toolCallId: string;
      content: { type: string; text: string }[];
    }) => void;
    const secretUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const secretPath = "C:\\Users\\secret\\AppData\\Local\\PiStudyBuddy\\semester\\abc\\sem.db";
    handler({
      isError: true,
      toolName: "studybuddy_ocr_schedule",
      toolCallId: "call-6",
      content: [textContent(`失败 ${secretPath} ${secretUuid}`)],
    });
    const json = JSON.stringify(obs.records);
    expect(json).not.toContain(secretUuid);
    expect(json).not.toContain(secretPath);
  });
});