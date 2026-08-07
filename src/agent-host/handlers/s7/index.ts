/**
 * T-M2-003 S7 handler 装配出口（03-Arch §6.2）
 *
 * 聚合 class-capture 2 个 handler，导出 createS7Handlers。
 * 复用 S1-S6 模式：handler 工厂接收 S7Context，返回 method→fn 映射。
 */
import type { S7Context } from "./context";
import { handleTranscribe, handleSaveTranscription } from "./class-capture";

export type S7Handlers = {
  "classCapture.transcribe": (params: unknown) => Promise<{ transcription: string }>;
  "classCapture.saveTranscription": (params: unknown) => unknown;
};

export function createS7Handlers(ctx: S7Context): S7Handlers {
  return {
    "classCapture.transcribe": handleTranscribe(ctx),
    "classCapture.saveTranscription": handleSaveTranscription(ctx),
  };
}

export { S7Context } from "./context";
export type { S7ContextOptions } from "./context";
