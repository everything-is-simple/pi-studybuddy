/**
 * T-M2-004 TTS handler 装配出口（03-Arch §6.2）
 *
 * 聚合 TTS 4 个 handler，导出 createTtsHandlers。
 * 复用 S1-S7 模式：handler 工厂接收 TtsContext，返回 method→fn 映射。
 */
import type { TtsSpeakResult, TtsStatus } from "../../../contract/types";
import type { TtsContext } from "./context";
import { handleSpeak, handleControl, handleSwitchEngine, handleGetStatus } from "./tts";

export type TtsHandlers = {
  "tts.speak": (params: unknown) => Promise<TtsSpeakResult>;
  "tts.control": (params: unknown) => Promise<void>;
  "tts.switchEngine": (params: unknown) => void;
  "tts.getStatus": (params: unknown) => TtsStatus;
};

export function createTtsHandlers(ctx: TtsContext): TtsHandlers {
  return {
    "tts.speak": handleSpeak(ctx),
    "tts.control": handleControl(ctx),
    "tts.switchEngine": handleSwitchEngine(ctx),
    "tts.getStatus": handleGetStatus(ctx),
  };
}

export { TtsContext } from "./context";
export { createRuntimeTtsContext } from "./runtime-context";
export type { TtsContextOptions, TtsStateEvent } from "./context";
export type { TtsAdapter, TtsAdapterStatus, TtsControlAction } from "./tts-adapter";
export {
  createMockTtsAdapter,
  createFailingTtsAdapter,
  createFailingEdgeTtsAdapter,
  createRealSapiAdapter,
  createRealEdgeTtsAdapter,
} from "./tts-adapter";
