/**
 * T-M2-004 TTS handler 共享上下文（03-Arch §6.2 + §3.3 外部桥 Adapter）
 *
 * TTS 无独立数据表（03-Arch §3.1 + 07-WF §4.3：朗读是即时行为不持久化），
 * 故 TtsContext 不持有 db 句柄，只注入双引擎 Adapter + 当前引擎 + Streams 推送回调。
 *
 * 双引擎设计（07-WF §4.3 SAPI 默认 + edge-tts 降级）：
 *   - sapiAdapter：SAPI 引擎（默认 mock，08-Test §5.4 不连真实 SAPI）
 *   - edgeTtsAdapter：edge-tts 引擎（默认 mock）
 *   - currentEngine：当前默认引擎（默认 sapi）
 *   - handler 层根据 engine 选择 adapter，edge-tts 失败自动降级 SAPI（fallbackUsed=true）
 *   - emit：Streams["tts.state"] 推送回调（可选，集成测试注入）
 */
import type { TtsAdapter } from "./tts-adapter";
import { createMockTtsAdapter } from "./tts-adapter";

/** Streams["tts.state"] 推送载荷（streams.ts §tts.state） */
export interface TtsStateEvent {
  playbackId: string;
  state: "playing" | "paused" | "stopped";
  engine: "sapi" | "edge-tts";
  fallbackUsed?: boolean;
  position: number;
  duration: number;
}

export interface TtsContextOptions {
  /** SAPI 引擎 Adapter（默认 mock，08-Test §5.4） */
  sapiAdapter?: TtsAdapter;
  /** edge-tts 引擎 Adapter（默认 mock，08-Test §5.4） */
  edgeTtsAdapter?: TtsAdapter;
  /** 当前默认引擎（默认 sapi，07-WF §4.3 SAPI 默认离线） */
  currentEngine?: "sapi" | "edge-tts";
  /** Streams["tts.state"] 推送回调（可选，集成测试注入） */
  emit?: (event: TtsStateEvent) => void;
}

export class TtsContext {
  readonly sapiAdapter: TtsAdapter;
  readonly edgeTtsAdapter: TtsAdapter;
  currentEngine: "sapi" | "edge-tts";
  readonly emit?: (event: TtsStateEvent) => void;

  constructor(options?: TtsContextOptions) {
    this.sapiAdapter = options?.sapiAdapter ?? createMockTtsAdapter();
    this.edgeTtsAdapter = options?.edgeTtsAdapter ?? createMockTtsAdapter();
    this.currentEngine = options?.currentEngine ?? "sapi";
    this.emit = options?.emit;
  }

  /** 切换当前引擎（switchEngine handler 调用） */
  switchEngine(engine: "sapi" | "edge-tts"): void {
    this.currentEngine = engine;
  }

  /** 根据引擎名获取对应 adapter */
  getAdapter(engine: "sapi" | "edge-tts"): TtsAdapter {
    return engine === "sapi" ? this.sapiAdapter : this.edgeTtsAdapter;
  }
}
