/**
 * T-M3-001/002/T-M4-005 agent.send RPC handler（07-WF §2.8 对话路径步骤 2 + 06-API §4）
 *
 * 语义：renderer 发送用户消息 → agent-host 触发 Streams["agent.events"]
 * 返回发射事件数。
 *
 * 路径纪律（T-M4-023 审查修订）：
 *   - 生产路径：有 StudyBuddySession 且 session.model 存在 → 调用 pi 内核 prompt()，
 *     subscribe 事件映射为 AgentEvent 实时推送。
 *   - 无可用模型：返回固定安全的 MODEL_NOT_CONFIGURED；绝不静默降级为模拟回复。
 *   - 受控夹具仅由测试调用方显式注入，隔离于生产 agent-host。
 *
 * 事件映射（pi AgentSessionEvent → 应用 AgentEvent）：
 *   - agent_start            → message_start
 *   - message_update(text_delta) → token
 *   - tool_execution_start   → tool_call（脱敏 inputSummary）
 *   - tool_execution_end     → tool_result（脱敏 resultSummary）
 *   - compaction_end         → context_compressed
 *   - agent_end/agent_settled → 不发射（流结束信号）
 *
 * 安全（AGENTS.md §9.3）：事件 payload 不携带完整 UUID/密钥/学生资料原文。
 * inputSummary/resultSummary 经 sanitizeSummary 脱敏截断（≤120/≤160 字符），
 * toolCallId 用本地计数器 call-<n> 替换 provider 原始 id（非 UUID）。
 */
import type { RpcServer } from "../../contract/rpc";
import type { AgentEvent } from "../../contract/types";
import type { SessionStore } from "../session-store";
import type { StudyBuddySession } from "../studybuddy-extension-loader";
import { modelNotConfiguredError } from "../model-errors";

/** 可变引用：支持 StudyBuddySession 异步初始化后注入（index.ts fire-and-forget） */
export interface StudyBuddySessionRef {
  current: StudyBuddySession | null;
  /** 生产 host 启动时的异步模型会话初始化；agent.send 会先等待它，避免启动竞态误报。 */
  ready?: Promise<void>;
}

/** 仅测试环境显式注入的确定性 fixture；生产调用不得提供。 */
export type AgentFixture = (
  server: RpcServer,
  sessionId: string,
  text: string,
  sessionMeta?: { subject?: string; goal?: string; mistakeIds?: string[] },
) => { eventCount: number };

export interface CreateAgentHandlersOptions {
  /** 受控夹具只服务测试；缺省时生产路径必须返回 MODEL_NOT_CONFIGURED。 */
  fixture?: AgentFixture;
}

/** 固定回复片段（受控夹具，非真实 LLM 输出） */
const TOKEN_FRAGMENTS = [
  "好的，",
  "我们来看",
  "极限的",
  "ε-δ 定义。",
  "对任意 ε>0，",
  "存在 δ>0…",
];

/** 触发词 → 模拟工具（09-UI §4.2 学习工具图标风格 studybuddy_*）
 * T-M3-004 扩展：按域分组覆盖 35 工具全部域（裁决 2，每域 1-2 触发词），
 * 既有 3 触发词（出题/笔记/朗读）保持兼容无回归。
 * 受控夹具语义：不真实执行业务 handler，仅发 tool_call/tool_result 事件对。
 */
const TOOL_TRIGGERS: Array<{
  keywords: string[];
  toolName: string;
  inputSummary: string;
  resultSummary: string;
}> = [
  // S3 练习域（07-WF §2.8 出题→跳练习 Tab）
  {
    keywords: ["出题", "生成题目", "练习题", "出 5 道", "练习题目"],
    toolName: "studybuddy_generate_questions",
    inputSummary: "按当前课程生成练习题",
    resultSummary: "已生成 5 道练习题",
  },
  // S2 笔记域（09-UI §4.2 "查看"跳笔记 Tab）
  {
    keywords: ["笔记"],
    toolName: "studybuddy_generate_note",
    inputSummary: "根据资料生成结构化笔记",
    resultSummary: "已生成结构化笔记",
  },
  // TTS 域（朗读控制条全局，不跳转）
  {
    keywords: ["朗读", "读一读", "TTS"],
    toolName: "studybuddy_tts_speak",
    inputSummary: "朗读当前 AI 回复",
    resultSummary: "已开始朗读",
  },
  // S5 冲刺域（T-M3-004 裁决 2）
  {
    keywords: ["速背卡", "模拟卷", "冲刺", "考前模拟"],
    toolName: "studybuddy_generate_mock_exam",
    inputSummary: "按考试目标生成模拟卷",
    resultSummary: "已生成模拟卷",
  },
  // S7 采集域（T-M3-004 裁决 2）
  {
    keywords: ["转写", "课堂录音", "转录"],
    toolName: "studybuddy_transcribe_class",
    inputSummary: "转写课堂录音",
    resultSummary: "已转写课堂内容",
  },
  // 备份域（T-M3-004 裁决 2 + 裁决 1a：不渲染跳转按钮）
  {
    keywords: ["备份"],
    toolName: "studybuddy_backup_course",
    inputSummary: "备份当前课程数据",
    resultSummary: "已备份课程数据",
  },
  // S4 错题域（T-M3-004 裁决 2）
  {
    keywords: ["错题", "薄弱点", "错因"],
    toolName: "studybuddy_aggregate_weak_point",
    inputSummary: "分析错题薄弱点",
    resultSummary: "已汇总薄弱点",
  },
  // S6 报告域（T-M3-004 裁决 2）
  {
    keywords: ["家长报告", "报告给家长", "生成报告"],
    toolName: "studybuddy_generate_parent_report",
    inputSummary: "生成家长报告",
    resultSummary: "已生成家长报告",
  },
  // S2 资料域（T-M3-004 裁决 2）
  {
    keywords: ["上传资料", "导入资料", "上传文件"],
    toolName: "studybuddy_upload_material",
    inputSummary: "上传课程资料",
    resultSummary: "已上传资料",
  },
  // S1 首页域（T-M3-004 裁决 2）
  {
    keywords: ["初始化学期", "新建学期", "开学"],
    toolName: "studybuddy_init_semester",
    inputSummary: "初始化学习学期",
    resultSummary: "已初始化学期",
  },
];

/** 匹配文本中的触发词，返回命中的模拟工具（无命中返回 undefined） */
function matchToolTrigger(text: string): (typeof TOOL_TRIGGERS)[number] | undefined {
  for (const trigger of TOOL_TRIGGERS) {
    if (trigger.keywords.some((kw) => text.includes(kw))) return trigger;
  }
  return undefined;
}

/** UUID 正则（AGENTS.md §9.3 永不记录完整 UUID） */
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/**
 * 脱敏摘要：移除 UUID + 截断到 maxLen 字符（AGENTS.md §9.3）。
 * 用于 tool_execution_start/end 的 inputSummary/resultSummary。
 */
function sanitizeSummary(raw: string, maxLen: number): string {
  const cleaned = raw.replace(UUID_PATTERN, "[id]");
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 3) + "...";
}

/** 构造学习场景上下文前置文本（T-M3-003 sessionMeta → 上下文段） */
function buildContextPrefix(sessionMeta: {
  subject?: string;
  goal?: string;
  mistakeIds?: string[];
}): string | null {
  const parts: string[] = [];
  if (sessionMeta.subject) parts.push(`【当前学科】${sessionMeta.subject}`);
  if (sessionMeta.goal) parts.push(`【学习目标】${sessionMeta.goal}`);
  if (sessionMeta.mistakeIds?.length) {
    parts.push(`【关联错题】${sessionMeta.mistakeIds.map((id) => `#${id}`).join("、")}`);
  }
  if (parts.length === 0) return null;
  return `[学习上下文] ${parts.join(" ")}`;
}

/**
 * 构造 agent.* handlers：注入 RpcServer 以发射 agent.events。
 *
 * 路径选择：
 *   - studyBuddySession 存在且 session.model 存在 → 真实 pi 内核 prompt()
 *   - 测试调用方显式提供 fixture → 受控夹具（08-Test §5.4 测试隔离）
 *   - 其他情况 → MODEL_NOT_CONFIGURED（不允许生产模拟回答）
 */
export function createAgentHandlers(
  server: RpcServer,
  sessionStore?: SessionStore,
  studyBuddySessionRef?: StudyBuddySessionRef,
  options: CreateAgentHandlersOptions = {},
) {
  return {
    "agent.send": async (params: unknown): Promise<{ eventCount: number }> => {
      const { sessionId, text, sessionMeta } = params as {
        sessionId: string;
        text: string;
        sessionMeta?: { subject?: string; goal?: string; mistakeIds?: string[] };
      };
      if (!sessionId || !text) {
        return { eventCount: 0 };
      }
      // 会话级学习场景元数据写回内存仓库（09-UI §4.2；裁决：不新增契约方法）
      if (sessionMeta && sessionStore) {
        sessionStore.updateMeta(sessionId, sessionMeta);
      }

      // 等待生产 host 完成已配置模型的异步初始化，避免首条消息与启动并发时误报未配置。
      await studyBuddySessionRef?.ready;

      // ── 路径选择 ──
      const piSession = studyBuddySessionRef?.current?.session;
      if (piSession && piSession.model) {
        return await runRealPiKernel(server, piSession, sessionId, text, sessionMeta);
      }
      if (options.fixture) {
        return options.fixture(server, sessionId, text, sessionMeta);
      }
      throw modelNotConfiguredError();
    },
  };
}

/**
 * 真实 pi 内核路径（T-M4-005 断裂 3 修复）。
 *
 * subscribe 事件映射 → pushEvent → renderer 实时收到 agent.events。
 * await prompt() 完成后返回总 eventCount。
 *
 * 安全：toolCallId 用本地计数器 call-<n>（非 provider 原始 id），
 * inputSummary/resultSummary 经 sanitizeSummary 脱敏。
 */
async function runRealPiKernel(
  server: RpcServer,
  piSession: import("@earendil-works/pi-coding-agent").AgentSession,
  sessionId: string,
  text: string,
  sessionMeta?: { subject?: string; goal?: string; mistakeIds?: string[] },
): Promise<{ eventCount: number }> {
  let count = 0;
  let callCounter = 0;
  /** provider toolCallId → 本地短 id（call-<n>）映射，AGENTS.md §9.3 不暴露 provider id */
  const toolCallIdMap = new Map<string, string>();

  const emit = (event: AgentEvent): void => {
    server.pushEvent("agent.events", event, undefined);
    count += 1;
  };

  const unsubscribe = piSession.subscribe((event) => {
    switch (event.type) {
      case "agent_start":
        emit({ kind: "message_start", sessionId, payload: {} });
        break;

      case "message_update": {
        // 只映射 text_delta（流式文本）；thinking_delta 不发射（内部推理不展示）
        const ame = event.assistantMessageEvent as { type: string; delta?: string };
        if (ame.type === "text_delta" && typeof ame.delta === "string") {
          emit({ kind: "token", sessionId, payload: { text: ame.delta } });
        }
        break;
      }

      case "tool_execution_start": {
        callCounter += 1;
        const localId = `call-${callCounter}`;
        toolCallIdMap.set(event.toolCallId, localId);
        const inputSummary = sanitizeSummary(
          typeof event.args === "string" ? event.args : JSON.stringify(event.args ?? {}),
          120,
        );
        emit({
          kind: "tool_call",
          sessionId,
          payload: {
            toolCallId: localId,
            toolName: event.toolName,
            inputSummary,
          },
        });
        break;
      }

      case "tool_execution_end": {
        const localId = toolCallIdMap.get(event.toolCallId) ?? `call-${callCounter}`;
        const resultText =
          typeof event.result === "string"
            ? event.result
            : typeof event.result === "object" && event.result !== null
              ? JSON.stringify(event.result)
              : String(event.result ?? "");
        const resultSummary = sanitizeSummary(resultText, 160);
        emit({
          kind: "tool_result",
          sessionId,
          payload: {
            toolCallId: localId,
            toolName: event.toolName,
            isError: event.isError,
            resultSummary,
          },
        });
        break;
      }

      case "compaction_end":
        emit({ kind: "context_compressed", sessionId, payload: { compressed: true } });
        break;

      // agent_end / agent_settled / turn_start / turn_end / message_start / message_end
      // → 不映射（应用层只需流式 token + 工具透明 + 压缩信号）
      default:
        break;
    }
  });

  try {
    // 学习场景上下文前置注入（T-M3-003：sessionMeta 拼入 prompt 文本）
    const contextPrefix = sessionMeta ? buildContextPrefix(sessionMeta) : null;
    const fullPrompt = contextPrefix ? `${contextPrefix}\n\n${text}` : text;
    await piSession.prompt(fullPrompt);
  } finally {
    unsubscribe();
  }

  return { eventCount: count };
}

/**
 * 受控夹具路径（08-Test §5.4 测试隔离；仅由测试显式注入）。
 *
 * 固定序列：message_start → [上下文 token] → [tool_call → tool_result] → token×6 → context_compressed。
 * T-M3-002 扩展：输入含触发词 → 插入 studybuddy_* 工具事件对。
 * T-M3-003 扩展：sessionMeta → 前置上下文 token。
 * T-M3-004 扩展：按域分组覆盖 35 工具全部域。
 */
export function runMockFixture(
  server: RpcServer,
  sessionId: string,
  text: string,
  sessionMeta?: { subject?: string; goal?: string; mistakeIds?: string[] },
): { eventCount: number } {
  let count = 0;
  const emit = (event: AgentEvent): void => {
    server.pushEvent("agent.events", event, undefined);
    count += 1;
  };

  emit({ kind: "message_start", sessionId, payload: {} });
  // 学习场景上下文段（sessionMeta → 同步注入，保持受控序列确定性）
  if (sessionMeta) {
    const prefix = buildContextPrefix(sessionMeta);
    if (prefix) {
      emit({ kind: "token", sessionId, payload: { text: prefix } });
    }
  }

  const trigger = matchToolTrigger(text);
  if (trigger) {
    const toolCallId = `call-${count + 1}`; // 短 id（非 UUID）
    // 前置 token（简单文本）
    emit({ kind: "token", sessionId, payload: { text: "好的，我来处理。" } });
    // 工具调用透明（09-UI §4.2）：先 tool_call 后 tool_result
    emit({
      kind: "tool_call",
      sessionId,
      payload: {
        toolCallId,
        toolName: trigger.toolName,
        inputSummary: trigger.inputSummary,
      },
    });
    emit({
      kind: "tool_result",
      sessionId,
      payload: {
        toolCallId,
        toolName: trigger.toolName,
        isError: false,
        resultSummary: trigger.resultSummary,
      },
    });
  }

  for (const fragment of TOKEN_FRAGMENTS) {
    emit({ kind: "token", sessionId, payload: { text: fragment } });
  }
  emit({ kind: "context_compressed", sessionId, payload: { compressed: true } });
  return { eventCount: count };
}
