/**
 * TtsControlBar TTS 全局控制条（T-M2-008，09-UI §5.1-§5.5）
 *
 * 常驻主内容区顶部：引擎切换 + 语速调节 + 播放控制 + 状态显示 + 标记已复习。
 *
 * §5.4 标记已复习：朗读完成（state=stopped）且 canMarkReviewed=true 时显示按钮。
 * §5.5 引擎降级：fallbackUsed=true 时显示"已降级到 SAPI"提示。
 * §11.1 隐私边界：所有 ID 走 ShortId 组件（不展示完整 UUID）。
 */
import React from "react";
import type { TtsStatus } from "../../contract/types";

interface Props {
  /** TTS 状态 */
  state?: TtsStatus;
  /** 当前引擎 */
  currentEngine?: "sapi" | "edge-tts";
  /** 是否发生降级（edge-tts 失败降级 SAPI） */
  fallbackUsed?: boolean;
  /** 语速（1.0 = 正常） */
  rate?: number;
  /** 是否可标记已复习（朗读完成时为 true） */
  canMarkReviewed?: boolean;
  /** RPC 客户端（运行时交互用） */
  rpc?: unknown;
}

/** 状态中文标签 */
function stateLabel(state: TtsStatus["state"]): string {
  switch (state) {
    case "playing":
      return "播放中";
    case "paused":
      return "暂停";
    case "stopped":
      return "已停止";
    default:
      return state;
  }
}

/** 时间格式化（毫秒→秒） */
function formatTime(ms: number): number {
  return Math.floor(ms / 1000);
}

export function TtsControlBar({
  state = { state: "stopped", position: 0, duration: 0 },
  currentEngine = "sapi",
  fallbackUsed = false,
  rate = 1.0,
  canMarkReviewed = false,
}: Props): React.JSX.Element {
  const isIdle = state.state === "stopped" && state.position === 0 && state.duration === 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: 36,
        padding: "0 12px",
        flexShrink: 0,
        background: "var(--bg-panel, #f5f5f5)",
        borderBottom: "1px solid var(--border, #e0e0e0)",
        fontSize: 12,
        color: "var(--text, #222)",
      }}
    >
      {/* TTS 标识 */}
      <span style={{ fontWeight: 600 }}>TTS</span>
      <span style={{ color: "var(--text-muted, #888)" }}>|</span>

      {/* §5.1 引擎切换 */}
      <span>引擎：</span>
      <select
        defaultValue={currentEngine}
        style={{
          fontSize: 11,
          padding: "2px 4px",
          border: "1px solid var(--border, #e0e0e0)",
          borderRadius: 2,
          background: "#fff",
        }}
      >
        <option value="sapi">SAPI</option>
        <option value="edge-tts">edge-tts</option>
      </select>

      {/* §5.5 引擎降级提示 */}
      {fallbackUsed && (
        <span style={{ color: "#f57c00", fontSize: 11 }}>已降级到 SAPI</span>
      )}

      <span style={{ color: "var(--text-muted, #888)" }}>|</span>

      {/* §5.1 语速调节 */}
      <span>语速：</span>
      <input
        type="range"
        min="0.5"
        max="2.0"
        step="0.1"
        defaultValue={rate}
        style={{ width: 60 }}
      />
      <span style={{ fontSize: 11, color: "var(--text-muted, #888)" }}>{rate.toFixed(1)}x</span>

      <span style={{ color: "var(--text-muted, #888)" }}>|</span>

      {/* §5.1 播放控制 */}
      <button
        type="button"
        style={{
          padding: "2px 8px",
          fontSize: 11,
          cursor: "pointer",
          border: "1px solid var(--border, #e0e0e0)",
          background: "#fff",
          borderRadius: 2,
        }}
      >
        播放
      </button>
      <button
        type="button"
        style={{
          padding: "2px 8px",
          fontSize: 11,
          cursor: "pointer",
          border: "1px solid var(--border, #e0e0e0)",
          background: "#fff",
          borderRadius: 2,
        }}
      >
        暂停
      </button>
      <button
        type="button"
        style={{
          padding: "2px 8px",
          fontSize: 11,
          cursor: "pointer",
          border: "1px solid var(--border, #e0e0e0)",
          background: "#fff",
          borderRadius: 2,
        }}
      >
        停止
      </button>

      <span style={{ color: "var(--text-muted, #888)" }}>|</span>

      {/* §5.3 状态显示 + 进度 */}
      {!isIdle && (
        <span style={{ fontSize: 11 }}>
          {stateLabel(state.state)} · {formatTime(state.position)}s / {formatTime(state.duration)}s
        </span>
      )}
      {isIdle && (
        <span style={{ fontSize: 11, color: "var(--text-muted, #888)" }}>空闲</span>
      )}

      {/* §5.4 标记已复习（朗读完成时显示） */}
      {canMarkReviewed && state.state === "stopped" && (
        <>
          <span style={{ color: "var(--text-muted, #888)" }}>|</span>
          <button
            type="button"
            style={{
              padding: "2px 8px",
              fontSize: 11,
              cursor: "pointer",
              border: "1px solid #2e7d32",
              background: "#e3f2fd",
              color: "#2e7d32",
              borderRadius: 2,
              fontWeight: 600,
            }}
          >
            标记已复习
          </button>
        </>
      )}
    </div>
  );
}
