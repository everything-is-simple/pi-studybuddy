/**
 * T-M4-018 TTS 播放状态 hook（09-UI §5 + 06-API §3.10/§4 + 07-WF §4）
 *
 * AppShell 持有 TTS 播放态（不进入 academicContext / 学习上下文）：
 *   - speak：tts.speak({ text, engine }) → playbackId/engine/fallbackUsed
 *   - control：tts.control({ playbackId, action, rate? }) 播放/暂停/停止/语速
 *   - switchEngine：tts.switchEngine({ engine })
 *   - 状态订阅：subscribe("tts.state") → status（旧 playbackId 的迟到事件不覆盖新播放）
 *   - markReviewed：events.markReviewed({ refType, refId })（09-UI §5.4，朗读完成可标记）
 *   - 错误固定文案；不渲染完整 playbackId / 路径 / 错误栈（AGENTS.md §9.3 + 09-UI §11.1）
 */
import { useEffect, useRef, useState } from "react";
import type { TtsStatus } from "../contract/types";
import type { TypedRpcClient } from "./rpc-client";

/** 朗读来源标注（内嵌朗读入口传入；用于控制条标题 + 标记已复习 ref） */
export interface TtsSpeakTarget {
  /** 控制条展示的短标题（09-UI §5.1"当前朗读内容标题"） */
  title?: string;
  /** 标记已复习 refType（如 note / mistake，events.markReviewed） */
  refType?: string;
  /** 标记已复习 refId（如 materialId / mistakeId） */
  refId?: string;
}

export interface TtsPlayback {
  playbackId?: string;
  status: TtsStatus;
  engine: "sapi" | "edge-tts";
  rate: number;
  fallbackUsed: boolean;
  title?: string;
  canMarkReviewed: boolean;
  speakBusy: boolean;
  error?: string;
  speak(text: string, target?: TtsSpeakTarget): Promise<void>;
  control(action: "play" | "pause" | "stop", rate?: number): Promise<void>;
  switchEngine(engine: "sapi" | "edge-tts"): Promise<void>;
  markReviewed(): Promise<void>;
  /** 控制条"播放"按钮：暂停中恢复，否则重读最近文本 */
  playbackButton(): Promise<void>;
  /** 语速调节：播放中实时生效，空闲仅存本地供下次 speak */
  setRateValue(rate: number): void;
}

const MSG_SPEAK_FAILED = "朗读失败，请稍后重试。";
const MSG_CONTROL_FAILED = "播放控制失败，请稍后重试。";
const MSG_ENGINE_FAILED = "引擎切换失败，请稍后重试。";
const MSG_MARK_FAILED = "标记已复习失败，请稍后重试。";

function isTtsStateEvent(payload: unknown): payload is {
  playbackId: string;
  state: "playing" | "paused" | "stopped";
  position: number;
  duration: number;
} {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.playbackId === "string" &&
    (p.state === "playing" || p.state === "paused" || p.state === "stopped") &&
    typeof p.position === "number" &&
    typeof p.duration === "number"
  );
}

export function useTtsPlayback(rpc?: TypedRpcClient): TtsPlayback {
  const [playbackId, setPlaybackId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<TtsStatus>({ state: "stopped", position: 0, duration: 0 });
  const [engine, setEngine] = useState<"sapi" | "edge-tts">("sapi");
  const [rate, setRate] = useState(1);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [title, setTitle] = useState<string | undefined>(undefined);
  const [canMarkReviewed, setCanMarkReviewed] = useState(false);
  const [speakBusy, setSpeakBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const lastTextRef = useRef("");
  const targetRef = useRef<TtsSpeakTarget | undefined>(undefined);
  const playbackIdRef = useRef<string | undefined>(undefined);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 06-API §4：订阅 Streams["tts.state"]；旧播放的迟到事件不覆盖当前播放（C-RED-05）
  useEffect(() => {
    if (!rpc) return;
    const unsubscribe = rpc.subscribe("tts.state", undefined, (payload) => {
      if (!isTtsStateEvent(payload)) return;
      if (playbackIdRef.current && payload.playbackId !== playbackIdRef.current) return;
      setStatus({ state: payload.state, position: payload.position, duration: payload.duration });
      // 09-UI §5.4：只有能实际写入复习事件的来源，朗读完成后才可标记。
      if (payload.state === "stopped" && targetRef.current?.refType && targetRef.current.refId) {
        setCanMarkReviewed(true);
      }
    });
    return unsubscribe;
  }, [rpc]);

  async function speak(text: string, target?: TtsSpeakTarget): Promise<void> {
    if (!rpc) return;
    const trimmed = text?.trim();
    if (!trimmed || busyRef.current || speakBusy) return; // 防重复播放（同步 ref 守卫，快速双击也安全）
    busyRef.current = true;
    setSpeakBusy(true);
    setError(undefined);
    setCanMarkReviewed(false);
    lastTextRef.current = trimmed;
    targetRef.current = target;
    if (target?.title) setTitle(target.title);
    try {
      const result = await rpc.call("tts.speak", { text: trimmed, engine });
      if (!mountedRef.current) return;
      playbackIdRef.current = result.playbackId;
      setPlaybackId(result.playbackId);
      setEngine(result.engine);
      if (result.fallbackUsed) setFallbackUsed(true);
      // 乐观更新：stream 事件到达前控制条即显示播放中（C-RED-01）
      setStatus((current) =>
        current.state === "stopped"
          ? { state: "playing", position: 0, duration: current.duration }
          : current,
      );
    } catch {
      if (mountedRef.current) setError(MSG_SPEAK_FAILED);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setSpeakBusy(false);
    }
  }

  async function control(action: "play" | "pause" | "stop", rateArg?: number): Promise<void> {
    if (!rpc || !playbackIdRef.current) return;
    if (rateArg !== undefined) setRate(rateArg);
    setError(undefined);
    try {
      await rpc.call("tts.control", {
        playbackId: playbackIdRef.current,
        action,
        ...(rateArg !== undefined ? { rate: rateArg } : {}),
      });
      if (!mountedRef.current) return;
      // 乐观更新：暂停/停止/恢复即时反映（stream 也会推）
      setStatus((current) => ({
        ...current,
        state: action === "play" ? "playing" : action === "pause" ? "paused" : "stopped",
      }));
      if (action === "stop" && targetRef.current?.refType && targetRef.current.refId) setCanMarkReviewed(true);
    } catch {
      if (mountedRef.current) setError(MSG_CONTROL_FAILED);
    }
  }

  async function switchEngine(next: "sapi" | "edge-tts"): Promise<void> {
    if (!rpc) return;
    setError(undefined);
    try {
      await rpc.call("tts.switchEngine", { engine: next });
      if (mountedRef.current) setEngine(next);
    } catch {
      if (mountedRef.current) setError(MSG_ENGINE_FAILED);
    }
  }

  async function markReviewed(): Promise<void> {
    const target = targetRef.current;
    if (!rpc || !target?.refType || !target?.refId) return;
    setError(undefined);
    try {
      await rpc.call("events.markReviewed", { refType: target.refType, refId: target.refId });
      if (mountedRef.current) setCanMarkReviewed(false);
    } catch {
      if (mountedRef.current) setError(MSG_MARK_FAILED);
    }
  }

  async function playbackButton(): Promise<void> {
    if (playbackIdRef.current && status.state === "paused") {
      await control("play");
    } else if (lastTextRef.current) {
      await speak(lastTextRef.current);
    }
  }

  function setRateValue(next: number): void {
    setRate(next);
    if (playbackIdRef.current && status.state === "playing" && rpc) {
      void control("play", next); // 播放中实时生效（06-API §3.10 control rate?）
    }
  }

  return {
    playbackId,
    status,
    engine,
    rate,
    fallbackUsed,
    title,
    canMarkReviewed,
    speakBusy,
    error,
    speak,
    control,
    switchEngine,
    markReviewed,
    playbackButton,
    setRateValue,
  };
}
