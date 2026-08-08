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
import type { SessionStore } from "../session-store";

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

/**
 * 构造 agent.* handlers：注入 RpcServer 以发射 agent.events。
 * 受控序列：message_start → token×2 → [tool_call → tool_result] → token×N → context_compressed。
 * T-M3-003 扩展：agent.send 携带 sessionMeta（学科/目标/错题关联，09-UI §4.2）→
 * 经 context-pack 注入上下文段（message_start 前置）→ 会话元数据写回内存仓库。
 */
export function createAgentHandlers(server: RpcServer, sessionStore?: SessionStore) {
  return {
    "agent.send": (params: unknown): { eventCount: number } => {
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
      let count = 0;
      const emit = (event: AgentEvent): void => {
        server.pushEvent("agent.events", event, undefined);
        count += 1;
      };

      emit({ kind: "message_start", sessionId, payload: {} });
      // 学习场景上下文段（sessionMeta → 同步注入，保持受控序列确定性）
      if (sessionMeta) {
        const parts: string[] = [];
        if (sessionMeta.subject) parts.push(`【当前学科】${sessionMeta.subject}`);
        if (sessionMeta.goal) parts.push(`【学习目标】${sessionMeta.goal}`);
        if (sessionMeta.mistakeIds?.length) parts.push(`【关联错题】${sessionMeta.mistakeIds.map((id) => `#${id}`).join("、")}`);
        if (parts.length) {
          emit({ kind: "token", sessionId, payload: { text: `[学习上下文] ${parts.join(" ")}` } });
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
    },
  };
}
