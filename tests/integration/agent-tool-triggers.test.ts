/**
 * T-M3-004 RED: agent.send 触发词扩展集成测试
 *
 * 权威依据：07-WF §2.8 步骤 3（AI 自主调用工具按需）+ 08-Test §5.4（受控夹具全 mock）
 * + T-M3-004 裁决 2（触发词按域分组覆盖：每域 1-2 触发词 + 既有 3 触发词无回归）。
 *
 * 测试策略：复用 makeSimulatedApp 夹具（同 agent-events-toolcalls.test.ts），
 * 断言新触发词 → tool_call/tool_result 事件对 + toolName 正确 + 摘要脱敏保持。
 * 既有 3 触发词（出题/笔记/朗读）回归由原测试文件覆盖。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MessageChannel } from "node:worker_threads";
import { createHostManager } from "../../src/main/host-manager";
import { createAgentHost } from "../../src/agent-host";
import { createRpcClient, type AnyMessagePort } from "../../src/contract/rpc";
import type { AgentEvent } from "../../src/contract/types";

function makeMemoryParentPort(): {
  parentPort: AnyMessagePort;
  deliverConnect(hostEnd: AnyMessagePort): void;
} {
  const listeners: Array<(ev: { data: unknown; ports?: AnyMessagePort[] }) => void> = [];
  const parentPort: AnyMessagePort = {
    addEventListener(_type: string, cb: (ev: { data: unknown; ports?: AnyMessagePort[] }) => void) {
      listeners.push(cb);
    },
    start() {},
  };
  return {
    parentPort,
    deliverConnect(hostEnd: AnyMessagePort) {
      for (const cb of listeners) cb({ data: { type: "connect" }, ports: [hostEnd] });
    },
  };
}

describe("agent.send 触发词扩展（T-M3-004 裁决 2：按域分组覆盖 35 工具）", () => {
  let agentHost: ReturnType<typeof createAgentHost>;
  let hostManager: ReturnType<typeof createHostManager>;
  let client: ReturnType<typeof createRpcClient>;

  beforeAll(async () => {
    const control = makeMemoryParentPort();
    agentHost = createAgentHost(control.parentPort);
    const handle = {
      sendConnectPort(port: AnyMessagePort) {
        control.deliverConnect(port);
      },
      onExit() {},
      kill() {},
    };
    hostManager = createHostManager({
      forkAgent: () => handle,
      createChannelPair: () => {
        const { port1, port2 } = new MessageChannel();
        return { rendererEnd: port1 as unknown as AnyMessagePort, hostEnd: port2 as unknown as AnyMessagePort };
      },
    });
    const rendererEnd = await hostManager.connectHost();
    client = createRpcClient(rendererEnd);
  });

  afterAll(() => {
    client.dispose();
    hostManager.dispose();
    agentHost.dispose();
  });

  /** 发送文本并收集 agent.events 事件序列 */
  async function collectEvents(text: string, sessionId = "sess-100"): Promise<AgentEvent[]> {
    const received: AgentEvent[] = [];
    const unsubscribe = client.subscribe("agent.events", undefined, (payload) => {
      received.push(payload as AgentEvent);
    });
    await client.call("agent.send", { sessionId, text });
    unsubscribe();
    return received;
  }

  /** 断言某文本触发某工具：事件序列 + toolName + 脱敏 */
  async function expectToolTrigger(text: string, toolName: string): Promise<void> {
    const received = await collectEvents(text);
    const kinds = received.map((e) => e.kind);
    expect(kinds).toContain("tool_call");
    expect(kinds).toContain("tool_result");
    expect(kinds.indexOf("tool_result")).toBeGreaterThan(kinds.indexOf("tool_call"));
    const toolCall = received.find((e) => e.kind === "tool_call");
    const tc = toolCall!.payload as { toolName: string; toolCallId: string; inputSummary: string };
    expect(tc.toolName).toBe(toolName);
    expect(tc.toolCallId).toMatch(/^call-\d+$/);
    expect(tc.inputSummary.length).toBeLessThanOrEqual(120);
    expect(JSON.stringify(tc)).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
  }

  it("S5 冲刺域触发词「速背卡」→ studybuddy_generate_mock_exam", async () => {
    await expectToolTrigger("帮我生成速背卡", "studybuddy_generate_mock_exam");
  });

  it("S5 冲刺域触发词「模拟卷」→ studybuddy_generate_mock_exam", async () => {
    await expectToolTrigger("来一套模拟卷", "studybuddy_generate_mock_exam");
  });

  it("S7 采集域触发词「转写课堂」→ studybuddy_transcribe_class", async () => {
    await expectToolTrigger("转写这节课内容", "studybuddy_transcribe_class");
  });

  it("S7 采集域触发词「课堂录音」→ studybuddy_transcribe_class", async () => {
    await expectToolTrigger("帮我课堂录音转文字", "studybuddy_transcribe_class");
  });

  it("备份域触发词「备份」→ studybuddy_backup_course", async () => {
    await expectToolTrigger("帮我备份课程", "studybuddy_backup_course");
  });

  it("S4 错题域触发词「薄弱点」→ studybuddy_aggregate_weak_point", async () => {
    await expectToolTrigger("帮我分析薄弱点", "studybuddy_aggregate_weak_point");
  });

  it("S6 报告域触发词「家长报告」→ studybuddy_generate_parent_report", async () => {
    await expectToolTrigger("生成家长报告", "studybuddy_generate_parent_report");
  });

  it("S2 资料域触发词「上传资料」→ studybuddy_upload_material", async () => {
    await expectToolTrigger("帮我上传资料", "studybuddy_upload_material");
  });

  it("S1 首页域触发词「初始化学期」→ studybuddy_init_semester", async () => {
    await expectToolTrigger("初始化学期", "studybuddy_init_semester");
  });

  it("既有触发词「笔记」保持兼容（无回归，裁决 2）→ studybuddy_generate_note", async () => {
    await expectToolTrigger("帮我写个笔记", "studybuddy_generate_note");
  });

  it("无触发词文本保持基线序列（无 tool 事件）", async () => {
    const received = await collectEvents("讲讲导数和积分的关系", "sess-200");
    const kinds = received.map((e) => e.kind);
    expect(kinds).not.toContain("tool_call");
    expect(kinds).not.toContain("tool_result");
    expect(kinds[0]).toBe("message_start");
    expect(kinds[kinds.length - 1]).toBe("context_compressed");
  });
});
