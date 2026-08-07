import { describe, it, expect } from "vitest";
import { TtsContext } from "../../src/agent-host/handlers/tts/context";
import { createTtsHandlers } from "../../src/agent-host/handlers/tts";
import {
  createMockTtsAdapter,
  createFailingTtsAdapter,
  createFailingEdgeTtsAdapter,
} from "../../src/agent-host/handlers/tts/tts-adapter";

/**
 * T-M2-004 TTS handler 单件测试（08-Test §3.5 TTS skill 单测 3 断言）
 *
 * 08-Test §3.5 三条断言：
 *   1. SAPI 默认返回 playbackId（handleSpeak engine=sapi 返回 playbackId）
 *   2. edge-tts 失败降级 SAPI（fallbackUsed=true，engine=sapi）
 *   3. 朗读不写 StudyEvent（TTS handler 不调用任何 db 写入，无 db 句柄）
 *
 * 安全不变量（08-Test §5.4）：不连真实 SAPI/edge-tts（全 mock）。
 */

describe("T-M2-004 TTS handler 单件测试", () => {
  describe("handleSpeak（08-Test §3.5 断言 1：SAPI 默认返回 playbackId）", () => {
    it("SPK-01 SAPI 默认返回 playbackId + engine=sapi + fallbackUsed=undefined", async () => {
      const ctx = new TtsContext();
      const handlers = createTtsHandlers(ctx);
      const result = await handlers["tts.speak"]({ text: "测试朗读文本" });
      expect(result.playbackId).toBeTruthy();
      expect(result.engine).toBe("sapi");
      expect(result.fallbackUsed).toBeUndefined();
    });

    it("SPK-02 text 为空 → BAD_REQUEST", async () => {
      const ctx = new TtsContext();
      const handlers = createTtsHandlers(ctx);
      try {
        await handlers["tts.speak"]({ text: "" });
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("BAD_REQUEST");
      }
    });

    it("SPK-03 text 为空白 → BAD_REQUEST", async () => {
      const ctx = new TtsContext();
      const handlers = createTtsHandlers(ctx);
      try {
        await handlers["tts.speak"]({ text: "   " });
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("BAD_REQUEST");
      }
    });

    it("SPK-04 engine=edge-tts + 失败 → 降级 SAPI + fallbackUsed=true（08-Test §3.5 断言 2）", async () => {
      // edgeTtsAdapter 用 failingEdgeTts（engine=edge-tts 抛错）
      // sapiAdapter 用 mock（降级后正常）
      const ctx = new TtsContext({
        sapiAdapter: createMockTtsAdapter(),
        edgeTtsAdapter: createFailingEdgeTtsAdapter(),
        currentEngine: "edge-tts",
      });
      const handlers = createTtsHandlers(ctx);
      const result = await handlers["tts.speak"]({ text: "测试降级", engine: "edge-tts" });
      expect(result.engine).toBe("sapi");
      expect(result.fallbackUsed).toBe(true);
      expect(result.playbackId).toBeTruthy();
    });

    it("SPK-05 SAPI 也失败 → INTERNAL_ERROR + 固定文案", async () => {
      const ctx = new TtsContext({
        sapiAdapter: createFailingTtsAdapter(),
        edgeTtsAdapter: createFailingEdgeTtsAdapter(),
      });
      const handlers = createTtsHandlers(ctx);
      try {
        await handlers["tts.speak"]({ text: "测试全失败", engine: "sapi" });
        expect.fail("应抛错");
      } catch (e) {
        const err = e as { code: string; message: string };
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("朗读不可用");
        // 不泄漏路径/stdout/stderr
        expect(err.message).not.toMatch(/[A-Z]:\\|stdout|stderr|key|secret/i);
      }
    });

    it("SPK-06 edge-tts 失败 + SAPI 也失败 → INTERNAL_ERROR", async () => {
      const ctx = new TtsContext({
        sapiAdapter: createFailingTtsAdapter(),
        edgeTtsAdapter: createFailingEdgeTtsAdapter(),
        currentEngine: "edge-tts",
      });
      const handlers = createTtsHandlers(ctx);
      try {
        await handlers["tts.speak"]({ text: "测试", engine: "edge-tts" });
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("INTERNAL_ERROR");
      }
    });

    it("SPK-07 朗读不写 StudyEvent（08-Test §3.5 断言 3：TtsContext 无 db 句柄）", async () => {
      // TtsContext 不持有 db，无法写 study_events
      const ctx = new TtsContext();
      expect((ctx as unknown as { _globalDb?: unknown })._globalDb).toBeUndefined();
      expect((ctx as unknown as { _semesterDbs?: unknown })._semesterDbs).toBeUndefined();
      const handlers = createTtsHandlers(ctx);
      const result = await handlers["tts.speak"]({ text: "测试不写事件" });
      expect(result.playbackId).toBeTruthy();
      // 无 db 句柄，无法写 study_events（结构性保证）
    });
  });

  describe("handleControl", () => {
    it("CTL-01 stop 后状态 stopped", async () => {
      const ctx = new TtsContext();
      const handlers = createTtsHandlers(ctx);
      const speakResult = await handlers["tts.speak"]({ text: "测试控制" });
      await handlers["tts.control"]({ playbackId: speakResult.playbackId, action: "stop" });
      const status = handlers["tts.getStatus"]({ playbackId: speakResult.playbackId });
      expect(status.state).toBe("stopped");
    });

    it("CTL-02 pause/play 状态机", async () => {
      const ctx = new TtsContext();
      const handlers = createTtsHandlers(ctx);
      const speakResult = await handlers["tts.speak"]({ text: "测试暂停恢复" });
      await handlers["tts.control"]({ playbackId: speakResult.playbackId, action: "pause" });
      expect(handlers["tts.getStatus"]({ playbackId: speakResult.playbackId }).state).toBe("paused");
      await handlers["tts.control"]({ playbackId: speakResult.playbackId, action: "play" });
      expect(handlers["tts.getStatus"]({ playbackId: speakResult.playbackId }).state).toBe("playing");
    });

    it("CTL-03 缺少 playbackId → BAD_REQUEST", async () => {
      const ctx = new TtsContext();
      const handlers = createTtsHandlers(ctx);
      try {
        await handlers["tts.control"]({ action: "stop" });
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("BAD_REQUEST");
      }
    });

    it("CTL-04 非法 action → BAD_REQUEST", async () => {
      const ctx = new TtsContext();
      const handlers = createTtsHandlers(ctx);
      try {
        await handlers["tts.control"]({ playbackId: "any", action: "invalid" as "play" });
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("BAD_REQUEST");
      }
    });

    it("CTL-05 未知 playbackId → BAD_REQUEST", async () => {
      const ctx = new TtsContext();
      const handlers = createTtsHandlers(ctx);
      try {
        await handlers["tts.control"]({ playbackId: "nonexistent", action: "stop" });
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("handleSwitchEngine", () => {
    it("SW-01 切换到 edge-tts，currentEngine 更新", () => {
      const ctx = new TtsContext();
      const handlers = createTtsHandlers(ctx);
      expect(ctx.currentEngine).toBe("sapi");
      handlers["tts.switchEngine"]({ engine: "edge-tts" });
      expect(ctx.currentEngine).toBe("edge-tts");
    });

    it("SW-02 切换到 sapi，currentEngine 更新", () => {
      const ctx = new TtsContext({ currentEngine: "edge-tts" });
      const handlers = createTtsHandlers(ctx);
      expect(ctx.currentEngine).toBe("edge-tts");
      handlers["tts.switchEngine"]({ engine: "sapi" });
      expect(ctx.currentEngine).toBe("sapi");
    });

    it("SW-03 非法引擎 → BAD_REQUEST", () => {
      const ctx = new TtsContext();
      const handlers = createTtsHandlers(ctx);
      try {
        handlers["tts.switchEngine"]({ engine: "invalid" as "sapi" });
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("BAD_REQUEST");
      }
    });

    it("SW-04 切换引擎不影响进行中的播放（下次 speak 生效）", async () => {
      const ctx = new TtsContext();
      const handlers = createTtsHandlers(ctx);
      const r1 = await handlers["tts.speak"]({ text: "第一段" });
      handlers["tts.switchEngine"]({ engine: "edge-tts" });
      // 切换后第一段播放不受影响
      const status = handlers["tts.getStatus"]({ playbackId: r1.playbackId });
      expect(status.state).toBe("playing");
    });
  });

  describe("handleGetStatus", () => {
    it("GST-01 speak 后查询返回 state=playing + duration>0", async () => {
      const ctx = new TtsContext();
      const handlers = createTtsHandlers(ctx);
      const result = await handlers["tts.speak"]({ text: "测试状态查询" });
      const status = handlers["tts.getStatus"]({ playbackId: result.playbackId });
      expect(status.state).toBe("playing");
      expect(status.duration).toBeGreaterThan(0);
      expect(status.position).toBeGreaterThanOrEqual(0);
    });

    it("GST-02 缺少 playbackId → BAD_REQUEST", () => {
      const ctx = new TtsContext();
      const handlers = createTtsHandlers(ctx);
      try {
        handlers["tts.getStatus"]({});
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("BAD_REQUEST");
      }
    });

    it("GST-03 未知 playbackId → BAD_REQUEST", () => {
      const ctx = new TtsContext();
      const handlers = createTtsHandlers(ctx);
      try {
        handlers["tts.getStatus"]({ playbackId: "nonexistent" });
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("BAD_REQUEST");
      }
    });
  });
});
