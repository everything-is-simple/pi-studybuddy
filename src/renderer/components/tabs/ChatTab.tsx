/**
 * ChatTab 对话 Tab（T-M3-001，09-UI §4.2 默认主入口 + 07-WF §2.8）
 *
 * pi 原生 AI 对话承载层的默认主入口骨架：
 *   - 欢迎语「🤖 你好，今天想学点什么？」（02-PRD §3.11 默认主入口）
 *   - 消息输入 + 发送 → rpc.call("agent.send")（agent-host 受控夹具发射）
 *   - 订阅 Streams["agent.events"] 消息分发骨架（完整流式渲染属 T-M3-002）
 *   - 会话列表（sessions.list，内存仓库）
 *
 * 安全（AGENTS.md §9.3）：消息文本不落日志、不展示完整 UUID。
 * 静态渲染测试不注入 rpc 时回退空会话列表。
 */
import React, { useEffect, useRef, useState } from "react";
import type { AgentEvent } from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";
import type { TypedRpcClient } from "../../rpc-client";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ChatSessionSummary {
  id: string;
  name: string;
  updatedAt: string;
  preview?: string;
}

interface Props {
  /** RPC 客户端（运行时交互用） */
  rpc?: TypedRpcClient;
  /** 初始消息列表（静态渲染测试用） */
  initialMessages?: ChatMessage[];
  /** 初始会话列表（静态渲染测试用） */
  initialSessions?: ChatSessionSummary[];
}

/** 流式接收状态（骨架：idle/streaming/done，T-M3-002 扩展渲染） */
type StreamStatus = "idle" | "streaming" | "done";

export function ChatTab({ rpc, initialMessages, initialSessions }: Props): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<ChatSessionSummary[]>(initialSessions ?? []);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const subscriptionRef = useRef<(() => void) | null>(null);

  // 订阅 agent.events（07-WF §2.8 步骤 2：renderer 看到流式回复）
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
            next[next.length - 1] = { role: "assistant", text: last.text + fragment };
          } else {
            next.push({ role: "assistant", text: fragment });
          }
          return next;
        });
      } else if (event.kind === "context_compressed") {
        setStatus("done");
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

  function handleSend(): void {
    const text = input.trim();
    if (!text || !rpc) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    void rpc
      .call("agent.send", { sessionId: "sess-001", text })
      .catch(() => setStatus("done"));
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

      {/* 消息列表 */}
      <div style={{ marginBottom: 10 }}>
        {messages.length === 0 ? (
          <EmptyState message="发送消息开始学习对话" />
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 6,
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
          ))
        )}
        {status === "streaming" && (
          <div style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>⏳ AI 回复中…</div>
        )}
      </div>

      {/* 输入区（09-UI §4.2 底部输入条） */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="输入消息…"
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
