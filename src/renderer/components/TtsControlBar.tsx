/**
 * TtsControlBar TTS 全局控制条（T-M2-008 静态壳，T-M4-018 RPC 接线）
 *
 * 常驻主内容区顶部：引擎切换 + 语速调节 + 播放控制 + 状态显示 + 标记已复习。
 *
 * §5.1 控制项：引擎切换 / 语速 0.5x-2.0x / 播放·暂停·停止 / 当前朗读内容标题 + 进度。
 * §5.4 标记已复习：朗读完成（state=stopped）且 canMarkReviewed=true 时显示按钮。
 * §5.5 引擎降级：fallbackUsed=true 时显示"已降级到 SAPI"提示。
 * §11.1 隐私边界：不渲染 playbackId 完整 UUID / 路径 / 错误栈；错误固定文案。
 */
import React from "react";
import type { TtsStatus } from "../../contract/types";

interface Props {
  /** TTS 播放状态（stream 订阅 / 乐观更新） */
  status: TtsStatus;
  /** 当前引擎 */
  engine: "sapi" | "edge-tts";
  /** 语速（1.0 = 正常） */
  rate: number;
  /** 是否发生降级（edge-tts 失败降级 SAPI） */
  fallbackUsed?: boolean;
  /** 当前朗读内容短标题（09-UI §5.1） */
  title?: string;
  /** 是否可标记已复习（朗读完成时 true） */
  canMarkReviewed?: boolean;
  /** 朗读请求进行中（防重复播放） */
  speakBusy?: boolean;
  /** 固定错误文案（不展示原始异常） */
  error?: string;
  /** 是否存在播放会话（控制暂停/停止可用性） */
  hasPlayback?: boolean;
  /** 播放按钮：暂停中恢复，否则重读最近文本（由上层决定） */
  onPlayback(): void;
  /** 暂停 / 停止（播放控制，06-API §3.10 tts.control） */
  onControl(action: "play" | "pause" | "stop"): void;
  /** 语速调节（播放中实时生效） */
  onRateChange(rate: number): void;
  /** 引擎切换（06-API §3.10 tts.switchEngine） */
  onSwitchEngine(engine: "sapi" | "edge-tts"): void;
  /** 标记已复习（09-UI §5.4 events.markReviewed） */
  onMarkReviewed(): void;
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
  status,
  engine,
  rate,
  fallbackUsed = false,
  title,
  canMarkReviewed = false,
  speakBusy = false,
  error,
  hasPlayback = false,
  onPlayback,
  onControl,
  onRateChange,
  onSwitchEngine,
  onMarkReviewed,
}: Props): React.JSX.Element {
  const isIdle = status.state === "stopped" && status.position === 0 && status.duration === 0;
  const playing = status.state === "playing";
  const paused = status.state === "paused";
  const stopped = status.state === "stopped";

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
        aria-label="TTS 引擎"
        value={engine}
        onChange={(event) => onSwitchEngine(event.target.value as "sapi" | "edge-tts")}
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
        aria-label="语速"
        min="0.5"
        max="2.0"
        step="0.1"
        value={rate}
        onChange={(event) => onRateChange(parseFloat(event.target.value))}
        style={{ width: 60 }}
      />
      <span style={{ fontSize: 11, color: "var(--text-muted, #888)" }}>{rate.toFixed(1)}x</span>

      <span style={{ color: "var(--text-muted, #888)" }}>|</span>

      {/* §5.1 播放控制 */}
      <button
        type="button"
        disabled={speakBusy || playing}
        onClick={onPlayback}
        style={{
          padding: "2px 8px",
          fontSize: 11,
          cursor: speakBusy || playing ? "default" : "pointer",
          border: "1px solid var(--border, #e0e0e0)",
          background: "#fff",
          borderRadius: 2,
        }}
      >
        {speakBusy ? "朗读中…" : "播放"}
      </button>
      <button
        type="button"
        disabled={!hasPlayback || !playing}
        onClick={() => onControl("pause")}
        style={{
          padding: "2px 8px",
          fontSize: 11,
          cursor: !hasPlayback || !playing ? "default" : "pointer",
          border: "1px solid var(--border, #e0e0e0)",
          background: "#fff",
          borderRadius: 2,
        }}
      >
        暂停
      </button>
      <button
        type="button"
        disabled={!hasPlayback || stopped}
        onClick={() => onControl("stop")}
        style={{
          padding: "2px 8px",
          fontSize: 11,
          cursor: !hasPlayback || stopped ? "default" : "pointer",
          border: "1px solid var(--border, #e0e0e0)",
          background: "#fff",
          borderRadius: 2,
        }}
      >
        停止
      </button>

      <span style={{ color: "var(--text-muted, #888)" }}>|</span>

      {/* §5.3 状态显示 + 进度（09-UI §5.1"当前朗读内容标题 + 进度"） */}
      {!isIdle ? (
        <span style={{ fontSize: 11 }}>
          {title ? `${title} · ` : ""}
          {stateLabel(status.state)} · {formatTime(status.position)}s / {formatTime(status.duration)}s
        </span>
      ) : (
        <span style={{ fontSize: 11, color: "var(--text-muted, #888)" }}>空闲</span>
      )}

      {/* 固定错误文案（AGENTS.md §9.3：不泄漏路径/stdout/密钥） */}
      {error && <span role="alert" style={{ color: "#c62828", fontSize: 11 }}>{error}</span>}

      {/* §5.4 标记已复习（朗读完成时显示） */}
      {canMarkReviewed && stopped && (
        <>
          <span style={{ color: "var(--text-muted, #888)" }}>|</span>
          <button
            type="button"
            onClick={onMarkReviewed}
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
