import { describe, it, expect } from "vitest";
import { TtsContext, type TtsStateEvent } from "../../src/agent-host/handlers/tts/context";
import { createTtsHandlers } from "../../src/agent-host/handlers/tts";
import {
  createMockTtsAdapter,
  createFailingEdgeTtsAdapter,
} from "../../src/agent-host/handlers/tts/tts-adapter";

/**
 * T-M2-004 TTS handler 集成测试（08-Test §4.1 + streams.ts §tts.state）
 *
 * 断言：
 *   - TtsContext + createTtsHandlers 装配，4 方法可调用
 *   - speak → Streams["tts.state"] 推送 { state: "playing", ... }
 *   - control(stop) → Streams["tts.state"] 推送 state: "stopped"
 *   - edge-tts 失败降级 SAPI：fallbackUsed=true + Streams 推送 engine=sapi
 *
 * 数据隔离（AGENTS.md §5.3）：TTS 无 db 句柄，无需隔离目录。
 */

describe("T-M2-004 TTS handler 集成测试", () => {
  it("INT-01 TtsContext + createTtsHandlers 装配，4 方法可调用", () => {
    const ctx = new TtsContext();
    const handlers = createTtsHandlers(ctx);
    expect(typeof handlers["tts.speak"]).toBe("function");
    expect(typeof handlers["tts.control"]).toBe("function");
    expect(typeof handlers["tts.switchEngine"]).toBe("function");
    expect(typeof handlers["tts.getStatus"]).toBe("function");
  });

  it("INT-02 speak → Streams['tts.state'] 推送 { state: 'playing', ... }", async () => {
    const events: TtsStateEvent[] = [];
    const ctx = new TtsContext({
      emit: (event) => events.push(event),
    });
    const handlers = createTtsHandlers(ctx);
    const result = await handlers["tts.speak"]({ text: "集成测试朗读" });
    expect(events.length).toBe(1);
    expect(events[0].playbackId).toBe(result.playbackId);
    expect(events[0].state).toBe("playing");
    expect(events[0].engine).toBe("sapi");
    expect(events[0].duration).toBeGreaterThan(0);
  });

  it("INT-03 control(stop) → Streams['tts.state'] 推送 state: 'stopped'", async () => {
    const events: TtsStateEvent[] = [];
    const ctx = new TtsContext({
      emit: (event) => events.push(event),
    });
    const handlers = createTtsHandlers(ctx);
    const result = await handlers["tts.speak"]({ text: "停止测试" });
    events.length = 0; // 清空 speak 的事件
    await handlers["tts.control"]({ playbackId: result.playbackId, action: "stop" });
    expect(events.length).toBe(1);
    expect(events[0].state).toBe("stopped");
    expect(events[0].playbackId).toBe(result.playbackId);
  });

  it("INT-04 edge-tts 失败降级 SAPI → Streams 推送 engine=sapi + fallbackUsed=true", async () => {
    const events: TtsStateEvent[] = [];
    const ctx = new TtsContext({
      sapiAdapter: createMockTtsAdapter(),
      edgeTtsAdapter: createFailingEdgeTtsAdapter(),
      currentEngine: "edge-tts",
      emit: (event) => events.push(event),
    });
    const handlers = createTtsHandlers(ctx);
    const result = await handlers["tts.speak"]({ text: "降级测试", engine: "edge-tts" });
    expect(result.engine).toBe("sapi");
    expect(result.fallbackUsed).toBe(true);
    expect(events.length).toBe(1);
    expect(events[0].engine).toBe("sapi");
    expect(events[0].fallbackUsed).toBe(true);
    expect(events[0].state).toBe("playing");
  });

  it("INT-05 speak 无 emit 回调时不抛错", async () => {
    const ctx = new TtsContext(); // 无 emit
    const handlers = createTtsHandlers(ctx);
    const result = await handlers["tts.speak"]({ text: "无回调测试" });
    expect(result.playbackId).toBeTruthy();
  });

  it("INT-06 control(pause) → Streams 推送 state: 'paused'", async () => {
    const events: TtsStateEvent[] = [];
    const ctx = new TtsContext({
      emit: (event) => events.push(event),
    });
    const handlers = createTtsHandlers(ctx);
    const result = await handlers["tts.speak"]({ text: "暂停测试" });
    events.length = 0;
    await handlers["tts.control"]({ playbackId: result.playbackId, action: "pause" });
    expect(events.length).toBe(1);
    expect(events[0].state).toBe("paused");
  });

  it("INT-07 完整流程：speak → pause → play → stop → getStatus", async () => {
    const ctx = new TtsContext();
    const handlers = createTtsHandlers(ctx);
    const result = await handlers["tts.speak"]({ text: "完整流程测试文本" });
    expect(handlers["tts.getStatus"]({ playbackId: result.playbackId }).state).toBe("playing");

    await handlers["tts.control"]({ playbackId: result.playbackId, action: "pause" });
    expect(handlers["tts.getStatus"]({ playbackId: result.playbackId }).state).toBe("paused");

    await handlers["tts.control"]({ playbackId: result.playbackId, action: "play" });
    expect(handlers["tts.getStatus"]({ playbackId: result.playbackId }).state).toBe("playing");

    await handlers["tts.control"]({ playbackId: result.playbackId, action: "stop" });
    expect(handlers["tts.getStatus"]({ playbackId: result.playbackId }).state).toBe("stopped");
  });
});
