/**
 * E2E-11 对话中 AI 自主调用工具 + 跳转结构化 Tab（08-Test §6.5 + 07-WF §2.8）
 *
 * 流程：学生发送"帮我出 5 道导数定义题" → 触发词命中 → tool_call/tool_result 事件对
 *   → 工具名断言 → toolJumpTarget 映射断言（出题→练习 Tab）→ sessionMeta 写回
 *
 * 断言（08-Test §6.5 关键断言）：
 *   - 触发词 → tool_call/tool_result 事件对 + 工具名（studybuddy_generate_questions）
 *   - toolJumpTarget("studybuddy_generate_questions").tabId = "practice"（07-WF §2.8 映射表）
 *   - tool_call payload 含 toolCallId（短 id，非 UUID）+ inputSummary 脱敏
 *   - tool_result payload 含 resultSummary 脱敏 + isError=false
 *   - sessionMeta 写回 → sessions.get 可见 subject/goal（09-UI §4.2）
 *   - 事件 payload 无完整 UUID（防泄露，AGENTS.md §9.3）
 *
 * 数据隔离（AGENTS.md §5.3）：写 H:\pi-studybuddy-tmp\runs\T-M4-022\e2e\e2e-11\
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { launchElectron, type LaunchedApp } from "./helpers/electron-launcher";
import { RpcDriver } from "./helpers/rpc-driver";
import { toolJumpTarget } from "../../src/renderer/tool-tab-map";
import type { SessionSummary, Session, AgentEvent } from "../../src/contract/types";

/** 完整 UUID 正则（防泄露断言，AGENTS.md §9.3） */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

/** 从事件流中筛选指定 kind 的事件（原始 channel 监听收集） */
function collectKinds(
  app: LaunchedApp,
  action: () => Promise<unknown>,
): Promise<{ events: AgentEvent[]; toolCalls: AgentEvent[]; toolResults: AgentEvent[] }> {
  return new Promise(async (resolve) => {
    const events: AgentEvent[] = [];
    const listener = (msg: unknown) => {
      const m = msg as { type?: string; topic?: string; payload?: unknown };
      if (m?.type === "event" && m.topic === "agent.events") {
        events.push(m.payload as AgentEvent);
      }
    };
    app.channel.on("message", listener);
    try {
      await action();
      // agent.send 同步发射，call 返回后事件已全部到达
      resolve({
        events,
        toolCalls: events.filter((e) => e.kind === "tool_call"),
        toolResults: events.filter((e) => e.kind === "tool_result"),
      });
    } finally {
      app.channel.removeListener("message", listener);
    }
  });
}

describe("E2E-11 对话中 AI 自主调用工具 + 跳转结构 Tab", () => {
  let app: LaunchedApp;
  let rpc: RpcDriver;

  beforeAll(async () => {
    app = await launchElectron("e2e-11");
    rpc = new RpcDriver(app.channel);
    await rpc.init();
  }, 60_000);

  afterAll(async () => {
    await app?.dispose();
  });

  it("E11-01 触发词出题 → tool_call/tool_result 事件对 + 工具名断言（08-Test §6.5）", async () => {
    const { toolCalls, toolResults } = await collectKinds(app, () =>
      rpc.call("agent.send", {
        sessionId: "sess-001",
        text: "帮我出 5 道导数定义题",
      }),
    );
    expect(toolCalls.length).toBe(1);
    expect(toolResults.length).toBe(1);
    const call = toolCalls[0].payload as { toolName: string; toolCallId: string; inputSummary: string };
    expect(call.toolName).toBe("studybuddy_generate_questions");
    expect(call.toolCallId).toBeTruthy();
    expect(call.inputSummary).toBeTruthy();
    const result = toolResults[0].payload as { toolName: string; isError: boolean; resultSummary: string };
    expect(result.toolName).toBe("studybuddy_generate_questions");
    expect(result.isError).toBe(false);
    expect(result.resultSummary).toBeTruthy();
  });

  it("E11-02 toolJumpTarget 映射断言：出题→练习 Tab（07-WF §2.8 映射表）", async () => {
    const target = toolJumpTarget("studybuddy_generate_questions");
    expect(target).toBeDefined();
    expect(target?.tabId).toBe("practice");
    expect(target?.label).toBe("练习");
    // 无目标 Tab 工具（TTS）返回 undefined → 不渲染跳转按钮（裁决 1a）
    expect(toolJumpTarget("studybuddy_tts_speak")).toBeUndefined();
  });

  it("E11-03 事件 payload toolCallId 为短 id（非 UUID）+ 无完整 UUID（AGENTS.md §9.3）", async () => {
    const { events } = await collectKinds(app, () =>
      rpc.call("agent.send", {
        sessionId: "sess-001",
        text: "帮我出 5 道导数定义题",
      }),
    );
    for (const ev of events) {
      expect(JSON.stringify(ev)).not.toMatch(UUID_RE);
    }
    const call = events.find((e) => e.kind === "tool_call")?.payload as
      | { toolCallId: string }
      | undefined;
    if (call) {
      // 短 id（call-<n>），非完整 UUID 形态
      expect(call.toolCallId).toMatch(/^call-\d+$/);
    }
  });

  it("E11-04 sessionMeta 写回 → sessions.get 可见 subject/goal（09-UI §4.2）", async () => {
    await rpc.call("agent.send", {
      sessionId: "sess-001",
      text: "帮我出 5 道导数定义题",
      sessionMeta: { subject: "数学", goal: "掌握导数定义", mistakeIds: ["mistake-001"] },
    });
    const session = await rpc.call<Session>("sessions.get", { id: "sess-001" });
    expect(session.subject).toBe("数学");
    expect(session.goal).toBe("掌握导数定义");
    expect(session.mistakeIds).toContain("mistake-001");
  });

  it("E11-05 会话列表含学习场景元数据（sessions.list 可见 subject/goal）", async () => {
    const list = await rpc.call<SessionSummary[]>("sessions.list", {});
    const sess = list.find((s) => s.id === "sess-001");
    expect(sess?.subject).toBe("数学");
    expect(sess?.goal).toBe("掌握导数定义");
  });
});