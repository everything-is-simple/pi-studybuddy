/**
 * ChatTab 对话 Tab（T-M3-001 默认主入口 + T-M3-002 pi 原生能力承载）
 *
 * pi 原生 AI 对话承载层：
 *   - 欢迎语「🤖 你好，今天想学点什么？」（02-PRD §3.11 默认主入口）
 *   - 消息输入 + 发送 → rpc.call("agent.send")（agent-host 受控夹具发射）
 *   - 订阅 Streams["agent.events"] 消息分发（message_start/token/tool_call/tool_result/context_compressed）
 *   - 工具调用视图（T-M3-002）：tool_call/tool_result → 工具卡片（工具名 + 脱敏摘要）
 *   - 上下文压缩提示条（T-M3-002）：context_compressed → 长对话压缩可见
 *   - 模型选择器（T-M3-002）：models.list 受控 fixture → 列表 + 切换选中态
 *   - @文件引用选择器（T-M3-002）：输入 @ 触发 → materials.list 当前课程资料 → 注入 [引用: <名>]\n<内容>
 *   - 会话列表（sessions.list，内存仓库）
 *
 * 安全（AGENTS.md §9.3）：消息文本不落日志、不展示完整 UUID；工具卡片摘要
 * 只含脱敏截断文本（inputSummary ≤120 / resultSummary ≤160 字符）。
 * 静态渲染测试不注入 rpc 时回退空会话列表。
 */
import React, { useEffect, useRef, useState } from "react";
import type { AgentEvent, ModelProvider } from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";
import type { TypedRpcClient } from "../../rpc-client";
import { jumpButtonLabel, toolJumpTarget } from "../../tool-tab-map";

/** 工具调用视图条目（T-M3-002：tool_call → running / tool_result → done|error） */
export interface ToolCallView {
  toolCallId: string;
  toolName: string;
  inputSummary: string;
  status: "running" | "done" | "error";
  resultSummary?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  /** AI 消息可携带工具调用卡片（T-M3-002 工具调用透明，09-UI §4.2） */
  toolCalls?: ToolCallView[];
}

/** @文件引用选择器条目（数据源：materials.list，06-API §3.4） */
export interface MaterialRef {
  id: string;
  name: string;
  courseId: string;
  /** 相对数据根的存储路径（materials.list 的 storageKey，经 allowed-roots 解析为绝对路径） */
  storageKey?: string;
}

export interface ChatSessionSummary {
  id: string;
  name: string;
  updatedAt: string;
  preview?: string;
}

/** 学科选项（09-UI §4.2 学科标签，颜色标识） */
const SUBJECT_OPTIONS = ["高数", "物理", "化学", "英语", "语文", "其他"];

interface Props {
  /** RPC 客户端（运行时交互用） */
  rpc?: TypedRpcClient;
  /** 初始消息列表（静态渲染测试用） */
  initialMessages?: ChatMessage[];
  /** 初始会话列表（静态渲染测试用） */
  initialSessions?: ChatSessionSummary[];
  /** 初始压缩状态（T-M3-002 上下文压缩提示条测试用） */
  initialCompressed?: boolean;
  /** 初始模型列表（T-M3-002 模型选择器测试用） */
  initialModels?: ModelProvider[];
  /** 初始选中模型 id（provider:model，T-M3-002） */
  initialModelId?: string;
  /** 初始 @选择器展开（T-M3-002 @文件引用测试用） */
  initialPickerOpen?: boolean;
  /** 初始资料列表（T-M3-002 @选择器测试用，数据源 materials.list） */
  initialMaterials?: MaterialRef[];
  /** 初始学科标签（T-M3-003 学习场景业务化，09-UI §4.2） */
  initialSubject?: string;
  /** 初始学习目标（T-M3-003） */
  initialGoal?: string;
  /** 初始关联错题 ID 列表（T-M3-003） */
  initialMistakeIds?: string[];
  /** T-M3-004：工具卡片跳转回调（09-UI §4.2 + 07-WF §2.8 步骤 3，AppShell 注入 setActiveTabId） */
  onNavigateTab?: (tabId: string, context?: { sessionId?: string; courseId?: string }) => void;
}

/** 流式接收状态：idle/streaming/done */
type StreamStatus = "idle" | "streaming" | "done";

/** 事件 payload 类型守卫（T-M3-002 结构化 payload，06-API §4 增补） */
function asToolCall(payload: AgentEvent["payload"]): {
  toolCallId: string;
  toolName: string;
  inputSummary: string;
} | null {
  const p = payload as Record<string, unknown>;
  if (
    typeof p.toolCallId === "string" &&
    typeof p.toolName === "string" &&
    typeof p.inputSummary === "string"
  ) {
    return { toolCallId: p.toolCallId, toolName: p.toolName, inputSummary: p.inputSummary };
  }
  return null;
}

function asToolResult(payload: AgentEvent["payload"]): {
  toolCallId: string;
  toolName: string;
  isError: boolean;
  resultSummary: string;
} | null {
  const p = payload as Record<string, unknown>;
  if (
    typeof p.toolCallId === "string" &&
    typeof p.toolName === "string" &&
    typeof p.isError === "boolean" &&
    typeof p.resultSummary === "string"
  ) {
    return { toolCallId: p.toolCallId, toolName: p.toolName, isError: p.isError, resultSummary: p.resultSummary };
  }
  return null;
}

/**
 * 展示摘要二次脱敏（AGENTS.md §9.3）：
 * 即使事件源摘要含完整 UUID，渲染前也过滤，并截断超长文本。
 */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
function sanitizeSummary(text: string, maxLen: number): string {
  const stripped = text.replace(UUID_RE, "[id]");
  return stripped.length > maxLen ? `${stripped.slice(0, maxLen)}…` : stripped;
}

export function ChatTab({
  rpc,
  initialMessages,
  initialSessions,
  initialCompressed,
  initialModels,
  initialModelId,
  initialPickerOpen,
  initialMaterials,
  initialSubject,
  initialGoal,
  initialMistakeIds,
  onNavigateTab,
}: Props): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<ChatSessionSummary[]>(initialSessions ?? []);
  const [status, setStatus] = useState<StreamStatus>("idle");
  /** T-M3-002：长对话压缩状态（context_compressed → 提示条） */
  const [compressed, setCompressed] = useState<boolean>(initialCompressed ?? false);
  /** T-M3-002：模型列表 + 选中模型（provider:model 组合 id） */
  const [models, setModels] = useState<ModelProvider[]>(initialModels ?? []);
  const [selectedModel, setSelectedModel] = useState<string>(initialModelId ?? "");
  /** T-M3-002：@文件引用选择器（展开状态 + 资料列表） */
  const [pickerOpen, setPickerOpen] = useState<boolean>(initialPickerOpen ?? false);
  const [materials, setMaterials] = useState<MaterialRef[]>(initialMaterials ?? []);
  /** T-M3-003：学习场景元数据（09-UI §4.2 学科标签/学习目标/错题关联） */
  const [subject, setSubject] = useState<string>(initialSubject ?? "");
  const [goal, setGoal] = useState<string>(initialGoal ?? "");
  const [mistakeIds, setMistakeIds] = useState<string[]>(initialMistakeIds ?? []);
  const subscriptionRef = useRef<(() => void) | null>(null);

  // 订阅 agent.events（07-WF §2.8 步骤 2：renderer 看到流式回复 + 工具调用视图）
  useEffect(() => {
    if (!rpc) return;
    subscriptionRef.current = rpc.subscribe("agent.events", undefined, (payload) => {
      const event = payload as AgentEvent;
      if (event.kind === "message_start") {
        setStatus("streaming");
        setMessages((prev) => [...prev, { role: "assistant", text: "" }]);
      } else if (event.kind === "token") {
        const fragment = (event.payload as { text?: string }).text ?? "";
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { role: "assistant", text: last.text + fragment, toolCalls: last.toolCalls };
          } else {
            next.push({ role: "assistant", text: fragment });
          }
          return next;
        });
      } else if (event.kind === "tool_call") {
        // T-M3-002：工具调用透明（09-UI §4.2）——追加 running 卡片到当前 AI 消息
        const tc = asToolCall(event.payload);
        if (!tc) return;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              toolCalls: [...(last.toolCalls ?? []), { ...tc, status: "running" as const }],
            };
          }
          return next;
        });
      } else if (event.kind === "tool_result") {
        // T-M3-002：tool_result → 对应卡片置 done/error + 结果摘要
        const tr = asToolResult(event.payload);
        if (!tr) return;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant" && last.toolCalls) {
            next[next.length - 1] = {
              ...last,
              toolCalls: last.toolCalls.map((c) =>
                c.toolCallId === tr.toolCallId
                  ? {
                      ...c,
                      status: (tr.isError ? "error" : "done") as "done" | "error",
                      resultSummary: tr.resultSummary,
                    }
                  : c,
              ),
            };
          }
          return next;
        });
      } else if (event.kind === "context_compressed") {
        setStatus("done");
        setCompressed(true);
      }
    });
    return () => {
      subscriptionRef.current?.();
      subscriptionRef.current = null;
    };
  }, [rpc]);

  // 加载会话列表（sessions.list）
  useEffect(() => {
    if (!rpc) return;
    void rpc
      .call("sessions.list", {})
      .then((list) => setSessions(list as unknown as ChatSessionSummary[]))
      .catch(() => {
        /* 静默失败：骨架阶段会话列表可空 */
      });
  }, [rpc]);

  // T-M3-002：加载模型列表（models.list，受控 fixture）
  useEffect(() => {
    if (!rpc || initialModels) return;
    void rpc
      .call("models.list", {})
      .then((list) => setModels(list as unknown as ModelProvider[]))
      .catch(() => {
        /* 静默失败：模型选择器可空 */
      });
  }, [rpc, initialModels]);

  // T-M3-002：@选择器展开时加载当前课程资料（materials.list）
  useEffect(() => {
    if (!rpc || !pickerOpen || initialMaterials) return;
    void rpc
      .call("materials.list", {})
      .then((list) =>
        setMaterials(
          (list as unknown as Array<{ id: string; fileName: string; courseId: string; storageKey?: string }>).map(
            (m) => ({
              id: m.id,
              name: m.fileName,
              courseId: m.courseId,
              storageKey: m.storageKey,
            }),
          ),
        ),
      )
      .catch(() => {
        /* 静默失败：资料列表可空 */
      });
  }, [rpc, pickerOpen, initialMaterials]);

  function handleSend(): void {
    const text = input.trim();
    if (!text || !rpc) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setPickerOpen(false);
    void rpc
      .call("agent.send", {
        sessionId: "sess-001",
        text,
        // T-M3-003：学习场景元数据随发送携带（09-UI §4.2，影响 AI 上下文）
        sessionMeta: {
          ...(subject ? { subject } : {}),
          ...(goal ? { goal } : {}),
          ...(mistakeIds.length ? { mistakeIds } : {}),
        },
      })
      .catch(() => setStatus("done"));
  }

  // T-M3-002：@ 触发选择器（输入末尾 @ 或点击 [@文件] 按钮）
  function handleInputChange(value: string): void {
    setInput(value);
    if (value.endsWith("@")) {
      setPickerOpen(true);
    }
  }

  // T-M3-002：选中资料 → 文件内容注入对话上下文（文本前置引用标记，仅本次发送携带）
  // 路径经 allowed-roots 白名单校验（07-WF §2.8 步骤 4 + AGENTS.md §9.4）
  function handlePickMaterial(material: MaterialRef): void {
    if (!rpc) return;
    void rpc
      .call("files.read", { path: material.storageKey ?? material.name })
      .then((result) => {
        const content = (result as { content: string }).content;
        const reference = `[引用: ${material.name}]\n${content}\n\n`;
        setInput((prev) => {
          const stripped = prev.replace(/@$/, "");
          return stripped ? reference + stripped : reference;
        });
        setPickerOpen(false);
      })
      .catch(() => {
        setInput((prev) => {
          const stripped = prev.replace(/@$/, "");
          return stripped ? `[引用: ${material.name}]（无法读取，路径未授权）\n\n` + stripped : `[引用: ${material.name}]（无法读取，路径未授权）\n\n`;
        });
        setPickerOpen(false);
      });
  }

  /** 模型选择器：provider:model 组合 id → 展示名 */
  function modelLabel(provider: ModelProvider, modelId: string): string {
    const m = provider.models.find((x) => x.id === modelId);
    return m ? `${provider.name} · ${m.name}` : `${provider.name} · ${modelId}`;
  }

  return (
    <TabContainer>
      {/* 会话列表 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--text, #222)" }}>会话</div>
        {sessions.length === 0 ? (
          <EmptyState message="暂无会话" />
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              style={{
                padding: "6px 8px",
                marginBottom: 4,
                background: "var(--bg-panel, #f5f5f5)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--text, #222)",
              }}
            >
              {s.name}
              {s.preview ? <span style={{ color: "var(--text-muted, #888)" }}> — {s.preview}</span> : null}
            </div>
          ))
        )}
      </div>

      {/* 欢迎语（09-UI §4.2 默认主入口） */}
      <div
        style={{
          padding: "12px 14px",
          marginBottom: 10,
          background: "var(--bg-panel, #f5f5f5)",
          borderRadius: 8,
          fontSize: 13,
          color: "var(--text, #222)",
        }}
      >
        🤖 你好，今天想学点什么？（上下文已注入：L1 画像 + 当前学期/课程）
      </div>

      {/* T-M3-002 模型选择器（09-UI §4.2 多模型切换） */}
      {models.length > 0 && (
        <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ color: "var(--text-muted, #888)" }}>模型</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{
              padding: "4px 6px",
              fontSize: 12,
              border: "1px solid var(--border, #e0e0e0)",
              borderRadius: 6,
              background: "var(--bg, #ffffff)",
              color: "var(--text, #222)",
            }}
          >
            {models.map((provider) =>
              provider.models.map((m) => (
                <option key={`${provider.id}:${m.id}`} value={`${provider.id}:${m.id}`}>
                  {modelLabel(provider, m.id)}
                </option>
              )),
            )}
          </select>
        </div>
      )}

      {/* T-M3-002 上下文压缩提示条（09-UI §4.2 onContextUsageChange 语义） */}
      {compressed && (
        <div
          style={{
            marginBottom: 10,
            padding: "6px 10px",
            fontSize: 12,
            borderRadius: 6,
            background: "#fff7e6",
            border: "1px solid #ffd591",
            color: "#ad6800",
          }}
        >
          📄 长对话已自动压缩，AI 保留了关键上下文
        </div>
      )}

      {/* T-M3-003 学习场景元数据条（09-UI §4.2：📐 学科 | 目标：… | 关联错题：#…） */}
      <div
        style={{
          marginBottom: 10,
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid var(--border, #e0e0e0)",
          background: "var(--bg-panel, #f5f5f5)",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          fontSize: 12,
          color: "var(--text, #222)",
        }}
      >
        {/* 学科标签（颜色标识） */}
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          📐
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{
              padding: "3px 6px",
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid var(--border, #e0e0e0)",
              background: subject ? "var(--accent, #e8f0fe)" : "var(--bg, #ffffff)",
              color: "var(--text, #222)",
            }}
            aria-label="学科"
          >
            <option value="">选择学科</option>
            {SUBJECT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {/* 学习目标 */}
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "var(--text-muted, #888)" }}>目标：</span>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="如：极限练习"
            style={{
              padding: "3px 6px",
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid var(--border, #e0e0e0)",
              background: "var(--bg, #ffffff)",
              color: "var(--text, #222)",
              width: 130,
            }}
          />
        </label>
        {/* 关联错题（#id chip，可移除） */}
        {mistakeIds.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {mistakeIds.map((id) => (
              <span
                key={id}
                style={{
                  padding: "2px 6px",
                  borderRadius: 10,
                  background: "#fde8e8",
                  border: "1px solid #f5baba",
                  color: "#8c2f2f",
                  fontSize: 11,
                }}
              >
                #
                {id}
                <button
                  type="button"
                  aria-label={`移除错题 ${id}`}
                  onClick={() => setMistakeIds((prev) => prev.filter((x) => x !== id))}
                  style={{
                    marginLeft: 3,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "#8c2f2f",
                    fontSize: 11,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </span>
        )}
        {/* 关联错题添加（S4 跳转语义：mistakes.list 数据源） */}
        <button
          type="button"
          onClick={() => setMistakeIds((prev) => (prev.includes("mist-001") ? prev : [...prev, "mist-001"]))}
          style={{
            padding: "2px 8px",
            fontSize: 11,
            cursor: "pointer",
            border: "1px dashed var(--border, #e0e0e0)",
            background: "transparent",
            borderRadius: 10,
            color: "var(--text-muted, #888)",
          }}
        >
          + 关联错题
        </button>
      </div>

      {/* 消息列表 */}
      <div style={{ marginBottom: 10 }}>
        {messages.length === 0 ? (
          <EmptyState message="发送消息开始学习对话" />
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  background: m.role === "user" ? "var(--bg-panel, #f5f5f5)" : "transparent",
                  border: m.role === "assistant" ? "1px solid var(--border, #e0e0e0)" : "none",
                  color: "var(--text, #222)",
                }}
              >
                {m.role === "assistant" ? "🤖 " : "👤 "}
                {m.text}
              </div>
              {/* T-M3-002 工具调用卡片（09-UI §4.2 工具调用透明） */}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {m.toolCalls.map((tc) => (
                    <div
                      key={tc.toolCallId}
                      style={{
                        marginBottom: 4,
                        padding: "6px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        background: "var(--bg-panel, #f5f5f5)",
                        border: "1px solid var(--border, #e0e0e0)",
                        color: "var(--text, #222)",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>🔧 {tc.toolName}</span>
                      {tc.status === "running" && <span style={{ color: "var(--text-muted, #888)" }}> ⏳ 调用中…</span>}
                      {tc.status === "done" && <span> ✅</span>}
                      {tc.status === "error" && <span> ⚠️</span>}
                      <div style={{ color: "var(--text-muted, #888)", marginTop: 2 }}>
                        输入：{sanitizeSummary(tc.inputSummary, 120)}
                        {tc.resultSummary ? ` ｜ 结果：${sanitizeSummary(tc.resultSummary, 160)}` : ""}
                      </div>
                      {/* T-M3-004 工具调用可跳转（09-UI §4.2 + 07-WF §2.8 步骤 3 + E2E-11）：
                          仅 done 状态且有目标 Tab 的工具渲染 [去目标 Tab 名] 按钮（裁决 3）
                          tts/backup 域无目标 Tab 不渲染（裁决 1/1a） */}
                      {tc.status === "done" && (() => {
                        const target = toolJumpTarget(tc.toolName);
                        const label = jumpButtonLabel(tc.toolName);
                        if (!target || !label) return null;
                        return (
                          <button
                            type="button"
                            data-tab={target.tabId}
                            onClick={() => onNavigateTab?.(target.tabId, { sessionId: "sess-001" })}
                            style={{
                              marginTop: 4,
                              padding: "2px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                              border: "1px solid var(--border, #e0e0e0)",
                              background: "var(--bg, #ffffff)",
                              borderRadius: 6,
                              color: "var(--accent-strong, #1a5fb4)",
                            }}
                          >
                            {label}
                          </button>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        {status === "streaming" && (
          <div style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>⏳ AI 回复中…</div>
        )}
      </div>

      {/* T-M3-002 @文件引用选择器（07-WF §2.8 步骤 4） */}
      {pickerOpen && (
        <div
          style={{
            marginBottom: 8,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border, #e0e0e0)",
            background: "var(--bg-panel, #f5f5f5)",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: "var(--text, #222)" }}>
            📎 引用资料（当前课程）
          </div>
          {materials.length === 0 ? (
            <EmptyState message="当前课程暂无资料" />
          ) : (
            materials.map((mat) => (
              <button
                key={mat.id}
                type="button"
                onClick={() => handlePickMaterial(mat)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "4px 6px",
                  marginBottom: 2,
                  fontSize: 12,
                  cursor: "pointer",
                  border: "none",
                  background: "transparent",
                  color: "var(--text, #222)",
                }}
              >
                {mat.name}
              </button>
            ))
          )}
        </div>
      )}

      {/* 输入区（09-UI §4.2 底部输入条） */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          title="@ 引用文件"
          style={{
            padding: "8px 10px",
            fontSize: 13,
            cursor: "pointer",
            border: "1px solid var(--border, #e0e0e0)",
            background: "var(--bg-panel, #f5f5f5)",
            borderRadius: 6,
            color: "var(--text, #222)",
          }}
        >
          📎
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="输入消息…（@ 引用当前课程资料）"
          style={{
            flex: 1,
            padding: "8px 10px",
            fontSize: 13,
            border: "1px solid var(--border, #e0e0e0)",
            borderRadius: 6,
            background: "var(--bg, #ffffff)",
            color: "var(--text, #222)",
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            cursor: "pointer",
            border: "1px solid var(--border, #e0e0e0)",
            background: "var(--bg-panel, #f5f5f5)",
            borderRadius: 6,
            color: "var(--text, #222)",
          }}
        >
          发送
        </button>
      </div>
    </TabContainer>
  );
}
