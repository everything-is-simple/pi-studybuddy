/**
 * T-M4-005 真实 pi 内核路径集成测试（断裂 3 修复验证）
 *
 * 权威依据：03-Arch §2.1/§6.2（extension 接入 pi 内核）+ 06-API §4（AgentEvent 结构化）+
 * AGENTS.md §9.3（永不记录完整 UUID）+ 08-Test §5.4（不连真实 LLM）。
 *
 * 测试策略：mock AgentSession 模拟 pi 内核事件发射（agent_start → text_delta →
 * tool_execution_start/end → compaction_end），验证 agent.send 的事件映射：
 *   1. agent_start → message_start
 *   2. message_update(text_delta) → token
 *   3. tool_execution_start → tool_call（脱敏 inputSummary + 本地 call-<n> id）
 *   4. tool_execution_end → tool_result（脱敏 resultSummary + isError）
 *   5. compaction_end → context_compressed
 *   6. sessionMeta 前置注入 prompt 文本
 *   7. toolCallId 不含 provider 原始 id（AGENTS.md §9.3）
 *   8. payload 不含完整 UUID（AGENTS.md §9.3）
 *
 * 数据隔离：纯内存，无文件系统写入。
 */
import { describe, it, expect } from "vitest";
import { createRpcServer, type RpcServer, type AnyMessagePort } from "../../src/contract/rpc";
import { createAgentHandlers, type StudyBuddySessionRef } from "../../src/agent-host/handlers/agent";
import type { AgentEvent } from "../../src/contract/types";

/** mock AgentSession：模拟 pi 内核事件发射（不连真实 LLM，08-Test §5.4） */
interface MockPiEvent {
  type: string;
  [key: string]: unknown;
}

function createMockPiSession(events: MockPiEvent[], promptError?: unknown) {
  let listener: ((event: MockPiEvent) => void) | null = null;
  let promptText = "";
  return {
    model: { id: "mock-model" }, // truthy → 触发真实路径
    subscribe(cb: (event: MockPiEvent) => void) {
      listener = cb;
      return () => {
        listener = null;
      };
    },
    async prompt(text: string) {
      promptText = text;
      if (!listener) return;
      for (const event of events) {
        listener(event);
      }
      if (promptError) throw promptError;
    },
    getPromptText() {
      return promptText;
    },
  };
}

/** 创建内存 mock port 用于 RpcServer（不挂载真实端口，仅测 pushEvent） */
function createMockServer(): { server: RpcServer; events: AgentEvent[] } {
  const events: AgentEvent[] = [];
  const server: RpcServer = {
    handle: () => {},
    attachPort: () => {},
    pushEvent: (topic, payload) => {
      if (topic === "agent.events") events.push(payload as AgentEvent);
    },
    dispose: () => {},
  };
  return { server, events };
}

describe("T-M4-005 agent.send 真实 pi 内核路径（事件映射 + 脱敏）", () => {
  it("agent_start → message_start, text_delta → token, compaction_end → context_compressed", async () => {
    const { server, events } = createMockServer();
    const mockSession = createMockPiSession([
      { type: "agent_start" },
      { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "你好" } },
      { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "世界" } },
      { type: "compaction_end", reason: "manual", result: undefined, aborted: false, willRetry: false },
    ]);
    const ref: StudyBuddySessionRef = {
      current: { session: mockSession as never, extensionsResult: {} as never, dispose: async () => {} },
    };
    const handlers = createAgentHandlers(server, undefined, ref);

    const result = (await handlers["agent.send"]({
      sessionId: "test-001",
      text: "hello",
    })) as { eventCount: number };

    expect(result.eventCount).toBe(4);
    expect(events[0]).toEqual({ kind: "message_start", sessionId: "test-001", payload: {} });
    expect(events[1]).toEqual({ kind: "token", sessionId: "test-001", payload: { text: "你好" } });
    expect(events[2]).toEqual({ kind: "token", sessionId: "test-001", payload: { text: "世界" } });
    expect(events[3]).toEqual({ kind: "context_compressed", sessionId: "test-001", payload: { compressed: true } });
  });

  it("tool_execution_start/end → tool_call/tool_result（本地 call-<n> id + 脱敏摘要）", async () => {
    const { server, events } = createMockServer();
    const mockSession = createMockPiSession([
      { type: "agent_start" },
      { type: "tool_execution_start", toolCallId: "provider-uuid-abc-123", toolName: "studybuddy_generate_questions", args: { courseId: "c1", count: 5 } },
      { type: "tool_execution_end", toolCallId: "provider-uuid-abc-123", toolName: "studybuddy_generate_questions", result: { success: true, data: { questions: [] } }, isError: false },
      { type: "compaction_end" },
    ]);
    const ref: StudyBuddySessionRef = {
      current: { session: mockSession as never, extensionsResult: {} as never, dispose: async () => {} },
    };
    const handlers = createAgentHandlers(server, undefined, ref);

    const result = (await handlers["agent.send"]({
      sessionId: "test-002",
      text: "出题",
    })) as { eventCount: number };

    expect(result.eventCount).toBe(4);
    // tool_call
    const toolCall = events.find((e) => e.kind === "tool_call")!;
    expect(toolCall.payload).toEqual({
      toolCallId: "call-1",
      toolName: "studybuddy_generate_questions",
      inputSummary: expect.stringContaining("courseId"),
    });
    // toolCallId 是本地 call-1，不含 provider 原始 id
    expect((toolCall.payload as { toolCallId: string }).toolCallId).toBe("call-1");
    // tool_result
    const toolResult = events.find((e) => e.kind === "tool_result")!;
    expect(toolResult.payload).toEqual({
      toolCallId: "call-1",
      toolName: "studybuddy_generate_questions",
      isError: false,
      resultSummary: expect.stringContaining("success"),
    });
  });

  it("tool_result isError=true 时正确传递", async () => {
    const { server, events } = createMockServer();
    const mockSession = createMockPiSession([
      { type: "agent_start" },
      { type: "tool_execution_start", toolCallId: "tc-1", toolName: "studybuddy_tts_speak", args: { text: "test" } },
      { type: "tool_execution_end", toolCallId: "tc-1", toolName: "studybuddy_tts_speak", result: "SAPI 不可用", isError: true },
      { type: "compaction_end" },
    ]);
    const ref: StudyBuddySessionRef = {
      current: { session: mockSession as never, extensionsResult: {} as never, dispose: async () => {} },
    };
    const handlers = createAgentHandlers(server, undefined, ref);

    await handlers["agent.send"]({ sessionId: "test-003", text: "朗读" });

    const toolResult = events.find((e) => e.kind === "tool_result")!;
    expect((toolResult.payload as { isError: boolean }).isError).toBe(true);
    expect((toolResult.payload as { resultSummary: string }).resultSummary).toContain("SAPI");
  });

  it("sessionMeta 前置注入 prompt 文本（[学习上下文] 段）", async () => {
    const { server } = createMockServer();
    const mockSession = createMockPiSession([{ type: "agent_start" }]);
    const ref: StudyBuddySessionRef = {
      current: { session: mockSession as never, extensionsResult: {} as never, dispose: async () => {} },
    };
    const handlers = createAgentHandlers(server, undefined, ref);

    await handlers["agent.send"]({
      sessionId: "test-004",
      text: "帮我复习",
      sessionMeta: { subject: "数学", goal: "期末考试", mistakeIds: ["m1", "m2"] },
    });

    const promptText = mockSession.getPromptText();
    expect(promptText).toContain("[学习上下文]");
    expect(promptText).toContain("【当前学科】数学");
    expect(promptText).toContain("【学习目标】期末考试");
    expect(promptText).toContain("【关联错题】#m1、#m2");
    expect(promptText).toContain("帮我复习");
  });

  it("payload 不含完整 UUID（AGENTS.md §9.3）", async () => {
    const { server, events } = createMockServer();
    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const mockSession = createMockPiSession([
      { type: "agent_start" },
      { type: "tool_execution_start", toolCallId: uuid, toolName: "studybuddy_upload_material", args: { path: `/data/${uuid}/file.pdf` } },
      { type: "tool_execution_end", toolCallId: uuid, toolName: "studybuddy_upload_material", result: { id: uuid, path: `/data/${uuid}` }, isError: false },
      { type: "compaction_end" },
    ]);
    const ref: StudyBuddySessionRef = {
      current: { session: mockSession as never, extensionsResult: {} as never, dispose: async () => {} },
    };
    const handlers = createAgentHandlers(server, undefined, ref);

    await handlers["agent.send"]({ sessionId: "test-005", text: "上传资料" });

    for (const ev of events) {
      const raw = JSON.stringify(ev.payload);
      // 拒绝完整 UUID（8-4-4-4-12 形态）
      expect(raw).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
    }
  });

  it("inputSummary 截断到 ≤120 字符", async () => {
    const { server, events } = createMockServer();
    const longText = "x".repeat(300);
    const mockSession = createMockPiSession([
      { type: "agent_start" },
      { type: "tool_execution_start", toolCallId: "tc-1", toolName: "studybuddy_generate_note", args: { text: longText } },
      { type: "tool_execution_end", toolCallId: "tc-1", toolName: "studybuddy_generate_note", result: longText, isError: false },
      { type: "compaction_end" },
    ]);
    const ref: StudyBuddySessionRef = {
      current: { session: mockSession as never, extensionsResult: {} as never, dispose: async () => {} },
    };
    const handlers = createAgentHandlers(server, undefined, ref);

    await handlers["agent.send"]({ sessionId: "test-006", text: "笔记" });

    const toolCall = events.find((e) => e.kind === "tool_call")!;
    expect((toolCall.payload as { inputSummary: string }).inputSummary.length).toBeLessThanOrEqual(120);
    const toolResult = events.find((e) => e.kind === "tool_result")!;
    expect((toolResult.payload as { resultSummary: string }).resultSummary.length).toBeLessThanOrEqual(160);
  });

  it("thinking_delta 不发射（内部推理不展示）", async () => {
    const { server, events } = createMockServer();
    const mockSession = createMockPiSession([
      { type: "agent_start" },
      { type: "message_update", assistantMessageEvent: { type: "thinking_delta", delta: "内部思考" } },
      { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "回复" } },
      { type: "compaction_end" },
    ]);
    const ref: StudyBuddySessionRef = {
      current: { session: mockSession as never, extensionsResult: {} as never, dispose: async () => {} },
    };
    const handlers = createAgentHandlers(server, undefined, ref);

    const result = (await handlers["agent.send"]({ sessionId: "test-007", text: "hello" })) as { eventCount: number };

    // 只应有 message_start + 1 token（text_delta）+ context_compressed = 3
    expect(result.eventCount).toBe(3);
    const tokens = events.filter((e) => e.kind === "token");
    expect(tokens.length).toBe(1);
    expect((tokens[0].payload as { text: string }).text).toBe("回复");
  });

  it("早期瞬时失败切换到备用 session 并重放一次", async () => {
    const { server, events } = createMockServer();
    const primary = createMockPiSession([], { status: 503 });
    const backup = createMockPiSession([
      { type: "agent_start" },
      { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "备用成功" } },
    ]);
    const ref: StudyBuddySessionRef = {
      current: { session: primary as never, extensionsResult: {} as never, dispose: async () => {} },
      activateNextFallback: async () => {
        ref.current = { session: backup as never, extensionsResult: {} as never, dispose: async () => {} };
        return true;
      },
    };
    const handlers = createAgentHandlers(server, undefined, ref);

    await expect(handlers["agent.send"]({ sessionId: "fallback-001", text: "hello" })).resolves.toEqual({ eventCount: 2, fallbackUsed: true, attempts: 2 });
    expect(events.filter((event) => event.kind === "token")).toHaveLength(1);
  });

  it("pi agent_end 中的 503 错误会切换到备用 provider", async () => {
    const { server } = createMockServer();
    let switches = 0;
    const primary = createMockPiSession([
      { type: "agent_start" },
      { type: "agent_end", willRetry: false, messages: [{ role: "assistant", stopReason: "error", errorMessage: "upstream HTTP 503" }] },
    ]);
    const backup = createMockPiSession([{ type: "agent_start" }]);
    const ref: StudyBuddySessionRef = {
      current: { session: primary as never, extensionsResult: {} as never, dispose: async () => {} },
      activateNextFallback: async () => {
        switches += 1;
        ref.current = { session: backup as never, extensionsResult: {} as never, dispose: async () => {} };
        return true;
      },
    };
    const handlers = createAgentHandlers(server, undefined, ref);
    await handlers["agent.send"]({ sessionId: "fallback-agent-end", text: "hello" });
    expect(switches).toBe(1);
  });

  it("pi agent_end 中的认证错误不会扩散到备用 provider", async () => {
    const { server } = createMockServer();
    let switches = 0;
    const primary = createMockPiSession([
      { type: "agent_end", willRetry: false, messages: [{ role: "assistant", stopReason: "error", errorMessage: "HTTP 401 unauthorized api key" }] },
    ]);
    const ref: StudyBuddySessionRef = {
      current: { session: primary as never, extensionsResult: {} as never, dispose: async () => {} },
      activateNextFallback: async () => { switches += 1; return false; },
    };
    const handlers = createAgentHandlers(server, undefined, ref);
    await expect(handlers["agent.send"]({ sessionId: "fallback-auth", text: "hello" })).rejects.toMatchObject({ code: "AUTH_FAILED" });
    expect(switches).toBe(0);
  });

  it("已有可见 token 后失败时不重放到备用 provider", async () => {
    const { server } = createMockServer();
    let switches = 0;
    const primary = createMockPiSession([
      { type: "agent_start" },
      { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "部分回复" } },
    ], { status: 503 });
    const ref: StudyBuddySessionRef = {
      current: { session: primary as never, extensionsResult: {} as never, dispose: async () => {} },
      activateNextFallback: async () => { switches += 1; return true; },
    };
    const handlers = createAgentHandlers(server, undefined, ref);

    await expect(handlers["agent.send"]({ sessionId: "fallback-002", text: "hello" })).rejects.toMatchObject({ status: 503 });
    expect(switches).toBe(0);
  });

  it("生产路径无 session 或无 model 时返回固定安全配置错误，绝不静默走夹具", async () => {
    const { server, events } = createMockServer();
    const ref: StudyBuddySessionRef = { current: null };
    const handlers = createAgentHandlers(server, undefined, ref);

    await expect(handlers["agent.send"]({ sessionId: "test-008", text: "hello" })).rejects.toMatchObject({
      code: "MODEL_NOT_CONFIGURED",
      message: "尚未配置可用 AI 模型，请先在设置中完成模型配置",
    });
    expect(events).toEqual([]);
  });
});
