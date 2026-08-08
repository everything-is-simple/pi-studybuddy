/**
 * T-M3-001/002 agent.send RPC handler（07-WF §2.8 对话路径步骤 2 + 06-API §4）
 *
 * 语义：renderer 发送用户消息 → agent-host 触发 Streams["agent.events"]
 * 受控序列（message_start → token → [tool_call → tool_result] → token → context_compressed），
 * 返回发射事件数。
 *
 * 范围：**受控夹具发射，不连真实 LLM**（08-Test §5.4 全 mock）。
 *   - T-M3-001 基线：message_start → token×6 → context_compressed
 *   - T-M3-002 扩展：输入含触发词（出题/笔记/朗读）→ 插入 studybuddy_* 工具
 *     tool_call/tool_result 事件对（工具调用透明，09-UI §4.2）
 *
 * 安全（AGENTS.md §9.3）：事件 payload 不携带完整 UUID/密钥/学生资料原文。
 * tool_call/tool_result 的 inputSummary/resultSummary 为脱敏截断摘要（≤120/≤160 字符），
 * toolCallId 用短 id（call-<n>）非 UUID。
 */
import type { RpcServer } from "../../contract/rpc";
import type { AgentEvent } from "../../contract/types";

/** 固定回复片段（受控夹具，非真实 LLM 输出） */
const TOKEN_FRAGMENTS = [
  "好的，",
  "我们来看",
  "极限的",
  "ε-δ 定义。",
  "对任意 ε>0，",
  "存在 δ>0…",
];

/** 触发词 → 模拟工具（09-UI §4.2 学习工具图标风格 studybuddy_*） */
const TOOL_TRIGGERS: Array<{
  keywords: string[];
  toolName: string;
  inputSummary: string;
  resultSummary: string;
}> = [
  {
    keywords: ["出题", "生成题目", "练习题", "出 5 道", "练习题目"],
    toolName: "studybuddy_generate_questions",
    inputSummary: "按当前课程生成练习题",
    resultSummary: "已生成 5 道练习题",
  },
  {
    keywords: ["笔记"],
    toolName: "studybuddy_generate_note",
    inputSummary: "根据资料生成结构化笔记",
    resultSummary: "已生成结构化笔记",
  },
  {
    keywords: ["朗读", "读一读", "TTS"],
    toolName: "studybuddy_tts_speak",
    inputSummary: "朗读当前 AI 回复",
    resultSummary: "已开始朗读",
  },
];

/** 匹配文本中的触发词，返回命中的模拟工具（无命中返回 undefined） */
function matchToolTrigger(text: string): (typeof TOOL_TRIGGERS)[number] | undefined {
  for (const trigger of TOOL_TRIGGERS) {
    if (trigger.keywords.some((kw) => text.includes(kw))) return trigger;
  }
  return undefined;
}

/**
 * 构造 agent.* handlers：注入 RpcServer 以发射 agent.events。
 * 受控序列：message_start → token×2 → [tool_call → tool_result] → token×N → context_compressed。
 */
export function createAgentHandlers(server: RpcServer) {
  return {
    "agent.send": (params: unknown): { eventCount: number } => {
      const { sessionId, text } = params as { sessionId: string; text: string };
      if (!sessionId || !text) {
        return { eventCount: 0 };
      }
      let count = 0;
      const emit = (event: AgentEvent): void => {
        server.pushEvent("agent.events", event, undefined);
        count += 1;
      };

      emit({ kind: "message_start", sessionId, payload: {} });

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
    },
  };
}
