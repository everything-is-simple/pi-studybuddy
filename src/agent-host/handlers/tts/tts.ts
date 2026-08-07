/**
 * T-M2-004 TTS handler（06-API §3.10 + 07-WF §4 + 03-Arch §3.1/§3.3）
 *
 * 4 方法：
 *   - speak：合成并播放（engine 路由 + edge-tts 失败降级 SAPI + Streams 推送）
 *   - control：播放控制（play/pause/stop + Streams 推送）
 *   - switchEngine：切换当前引擎
 *   - getStatus：查询播放状态与位置
 *
 * 安全（07-WF §4.3 关键约束 + 08-Test §3.5/§5.4）：
 *   - 朗读不写 study_events（08-Test §3.5 断言 3：朗读是即时行为不持久化）
 *   - edge-tts 失败自动降级 SAPI（fallbackUsed=true，08-Test §3.5 断言 2）
 *   - SAPI 默认返回 playbackId + engine=sapi（08-Test §3.5 断言 1）
 *   - 错误消息固定文案，不含路径/stdout/stderr/密钥
 *   - 不连真实 SAPI/edge-tts（全 mock）
 *
 * Streams["tts.state"] 推送（streams.ts 已就绪）：
 *   - speak 成功后推送 { state: "playing", ... }
 *   - control(stop) 后推送 { state: "stopped", ... }
 */
import type { TtsSpeakResult, TtsStatus } from "../../../contract/types";
import type { TtsContext, TtsStateEvent } from "./context";
import type { TtsAdapter } from "./tts-adapter";

/** INTERNAL_ERROR 固定文案（07-WF §4.3，不泄漏路径/stdout/stderr） */
const MSG_TTS_UNAVAILABLE = "朗读不可用，请检查系统 TTS 设置";
const MSG_PLAYBACK_NOT_FOUND = "未找到朗读会话";

function badRequest(message: string) {
  return { code: "BAD_REQUEST" as const, message };
}

function internalError(message: string) {
  return { code: "INTERNAL_ERROR" as const, message };
}

/**
 * tts.speak handler 工厂。
 *
 * 流程（07-WF §4.1 朗读路径 4 步）：
 *   1. 参数校验（text 非空）
 *   2. 确定引擎（params.engine ?? ctx.currentEngine）
 *   3. 调对应 adapter.speak
 *   4. edge-tts 失败 → 降级 SAPI（fallbackUsed=true）；SAPI 失败 → INTERNAL_ERROR
 *   5. 推送 Streams["tts.state"] { state: "playing", ... }
 *   6. 返回 { playbackId, engine, fallbackUsed? }
 *
 * 安全：朗读不写 study_events（08-Test §3.5 断言 3）。
 */
export function handleSpeak(
  ctx: TtsContext,
): (params: unknown) => Promise<TtsSpeakResult> {
  return async (params: unknown): Promise<TtsSpeakResult> => {
    const p = params as { text: string; engine?: "sapi" | "edge-tts" };

    // 1. 参数校验
    if (!p.text || p.text.trim() === "") {
      throw badRequest("朗读文本不能为空");
    }

    // 2. 确定引擎（params.engine 优先，否则用 ctx.currentEngine）
    const engine = p.engine ?? ctx.currentEngine;
    const adapter = ctx.getAdapter(engine);

    // 3. 调 adapter.speak
    let result: TtsSpeakResult;
    try {
      result = await adapter.speak(p.text, { engine });
    } catch (e) {
      // edge-tts 失败 → 降级 SAPI（08-Test §3.5 断言 2）
      if (engine === "edge-tts") {
        try {
          const fallbackResult = await ctx.sapiAdapter.speak(p.text, { engine: "sapi" });
          result = { ...fallbackResult, engine: "sapi", fallbackUsed: true };
        } catch {
          // SAPI 也失败 → INTERNAL_ERROR 固定文案
          throw internalError(MSG_TTS_UNAVAILABLE);
        }
      } else {
        // SAPI 失败 → INTERNAL_ERROR 固定文案
        throw internalError(MSG_TTS_UNAVAILABLE);
      }
    }

    // 4. 推送 Streams["tts.state"] { state: "playing", ... }
    if (ctx.emit) {
      const status = ctx.getAdapter(result.engine).getStatus(result.playbackId);
      ctx.emit({
        playbackId: result.playbackId,
        state: "playing",
        engine: result.engine,
        fallbackUsed: result.fallbackUsed,
        position: status.position,
        duration: status.duration,
      });
    }

    return result;
  };
}

/**
 * tts.control handler 工厂。
 *
 * 流程（07-WF §4.2 播放控制）：
 *   1. 参数校验（playbackId 非空 + action 合法）
 *   2. 调 adapter.control（play/pause/stop）
 *   3. 推送 Streams["tts.state"]（state 随 action 变化）
 *
 * 注意：control 不区分引擎，尝试两个 adapter 找到 playbackId 所属的。
 * 简化实现：先尝试当前引擎 adapter，找不到再尝试另一个。
 */
export function handleControl(
  ctx: TtsContext,
): (params: unknown) => Promise<void> {
  return async (params: unknown): Promise<void> => {
    const p = params as { playbackId: string; action: "play" | "pause" | "stop"; rate?: number };

    // 1. 参数校验
    if (!p.playbackId) {
      throw badRequest("缺少 playbackId");
    }
    if (!["play", "pause", "stop"].includes(p.action)) {
      throw badRequest("非法 action");
    }

    // 2. 调 adapter.control（先当前引擎，找不到再另一个）
    const adapters = [ctx.getAdapter(ctx.currentEngine), ctx.getAdapter(ctx.currentEngine === "sapi" ? "edge-tts" : "sapi")];
    let controlled = false;
    let lastError: unknown;
    for (const adapter of adapters) {
      try {
        await adapter.control(p.playbackId, p.action, p.rate);
        controlled = true;
        break;
      } catch (e) {
        lastError = e;
        // BAD_REQUEST 表示此 adapter 无此 playbackId，继续尝试下一个
        if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "BAD_REQUEST") {
          continue;
        }
        // 其他错误直接抛出
        throw e;
      }
    }
    if (!controlled) {
      throw badRequest(MSG_PLAYBACK_NOT_FOUND);
    }

    // 3. 推送 Streams["tts.state"]（state 随 action 变化）
    if (ctx.emit) {
      // 找到 playbackId 所属 adapter 查询状态
      let status: { state: "playing" | "paused" | "stopped"; position: number; duration: number } | null = null;
      for (const adapter of adapters) {
        try {
          status = adapter.getStatus(p.playbackId);
          break;
        } catch {
          // 继续尝试
        }
      }
      if (status) {
        const state = p.action === "play" ? "playing" : p.action === "pause" ? "paused" : "stopped";
        ctx.emit({
          playbackId: p.playbackId,
          state,
          engine: ctx.currentEngine,
          position: status.position,
          duration: status.duration,
        });
      }
    }
  };
}

/**
 * tts.switchEngine handler 工厂。
 *
 * 切换当前默认引擎（不影响进行中的播放，下次 speak 生效）。
 */
export function handleSwitchEngine(
  ctx: TtsContext,
): (params: unknown) => void {
  return (params: unknown): void => {
    const p = params as { engine: "sapi" | "edge-tts" };

    if (!["sapi", "edge-tts"].includes(p.engine)) {
      throw badRequest("非法引擎");
    }

    ctx.switchEngine(p.engine);
  };
}

/**
 * tts.getStatus handler 工厂。
 *
 * 查询播放状态与位置（尝试两个 adapter 找到 playbackId 所属的）。
 */
export function handleGetStatus(
  ctx: TtsContext,
): (params: unknown) => TtsStatus {
  return (params: unknown): TtsStatus => {
    const p = params as { playbackId: string };

    if (!p.playbackId) {
      throw badRequest("缺少 playbackId");
    }

    // 尝试两个 adapter 找到 playbackId 所属的
    const adapters: TtsAdapter[] = [ctx.sapiAdapter, ctx.edgeTtsAdapter];
    for (const adapter of adapters) {
      try {
        return adapter.getStatus(p.playbackId);
      } catch (e) {
        // BAD_REQUEST 表示此 adapter 无此 playbackId，继续尝试下一个
        if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "BAD_REQUEST") {
          continue;
        }
        throw e;
      }
    }
    throw badRequest(MSG_PLAYBACK_NOT_FOUND);
  };
}
