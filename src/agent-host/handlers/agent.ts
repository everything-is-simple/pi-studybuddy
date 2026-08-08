/**
 * T-M3-001 agent.send RPC handler（07-WF §2.8 对话路径步骤 2 + 06-API §4）
 *
 * 语义：renderer 发送用户消息 → agent-host 触发 Streams["agent.events"]
 * 受控序列（message_start → N 个 token → context_compressed），返回发射事件数。
 *
 * 范围（T-M3-001）：**受控夹具发射，不连真实 LLM**（08-Test §5.4 全 mock）。
 * 完整流式增量渲染/工具调用视图/上下文压缩承载属 T-M3-002。
 *
 * 安全（AGENTS.md §9.3）：事件 payload 不携带完整 UUID/密钥/学生资料原文。
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

/**
 * 构造 agent.* handlers：注入 RpcServer 以发射 agent.events。
 * 受控序列：message_start → token×N → context_compressed。
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
      for (const fragment of TOKEN_FRAGMENTS) {
        emit({ kind: "token", sessionId, payload: { text: fragment } });
      }
      emit({ kind: "context_compressed", sessionId, payload: { compressed: true } });
      return { eventCount: count };
    },
  };
}
