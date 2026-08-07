import { describe, it, expect } from "vitest";
import {
  createMockTtsAdapter,
  createFailingTtsAdapter,
  createFailingEdgeTtsAdapter,
  createRealSapiAdapter,
  createRealEdgeTtsAdapter,
} from "../../src/agent-host/handlers/tts/tts-adapter";

/**
 * T-M2-004 TTS Adapter 单件测试（08-Test §3.5 + §5.4 不连真实外部服务）
 *
 * 断言：
 *   - mock：speak 返回 playbackId + engine=sapi + fallbackUsed=undefined
 *   - mock：control(stop) 后 getStatus.state=stopped
 *   - mock：getStatus 返回确定性 position/duration
 *   - failing：speak 抛 INTERNAL_ERROR + 固定文案（不泄漏路径/stdout/stderr）
 *   - failingEdge：engine=edge-tts 抛 INTERNAL_ERROR；engine=sapi 返回 fallbackUsed=true
 *   - realSapi：框架实现，路径校验（不连真实子进程）
 *   - realEdgeTts：路径未配置 → INTERNAL_ERROR + 固定文案
 *
 * 安全不变量（08-Test §5.4）：错误消息固定文案，不含 cliPath/stdout/stderr/密钥。
 */

describe("T-M2-004 TTS Adapter 单件测试", () => {
  describe("createMockTtsAdapter", () => {
    it("MOCK-01 speak 返回 playbackId + engine=sapi + fallbackUsed=undefined", async () => {
      const adapter = createMockTtsAdapter();
      const result = await adapter.speak("测试文本");
      expect(result.playbackId).toBeTruthy();
      expect(result.playbackId).toMatch(/^mock_/);
      expect(result.engine).toBe("sapi");
      expect(result.fallbackUsed).toBeUndefined();
    });

    it("MOCK-02 speak 生成唯一 playbackId（两次不重复）", async () => {
      const adapter = createMockTtsAdapter();
      const r1 = await adapter.speak("文本1");
      const r2 = await adapter.speak("文本2");
      expect(r1.playbackId).not.toBe(r2.playbackId);
    });

    it("MOCK-03 speak 后 getStatus 返回 state=playing", async () => {
      const adapter = createMockTtsAdapter();
      const result = await adapter.speak("测试文本");
      const status = adapter.getStatus(result.playbackId);
      expect(status.state).toBe("playing");
      expect(status.duration).toBeGreaterThan(0);
      expect(status.position).toBeGreaterThanOrEqual(0);
    });

    it("MOCK-04 control(stop) 后 getStatus.state=stopped + position=duration", async () => {
      const adapter = createMockTtsAdapter();
      const result = await adapter.speak("测试文本");
      await adapter.control(result.playbackId, "stop");
      const status = adapter.getStatus(result.playbackId);
      expect(status.state).toBe("stopped");
      expect(status.position).toBe(status.duration);
    });

    it("MOCK-05 control(pause) 后 state=paused；control(play) 后 state=playing", async () => {
      const adapter = createMockTtsAdapter();
      const result = await adapter.speak("测试文本");
      await adapter.control(result.playbackId, "pause");
      expect(adapter.getStatus(result.playbackId).state).toBe("paused");
      await adapter.control(result.playbackId, "play");
      expect(adapter.getStatus(result.playbackId).state).toBe("playing");
    });

    it("MOCK-06 control 未知 playbackId → BAD_REQUEST", async () => {
      const adapter = createMockTtsAdapter();
      try {
        await adapter.control("nonexistent", "stop");
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("BAD_REQUEST");
      }
    });

    it("MOCK-07 getStatus 未知 playbackId → BAD_REQUEST", () => {
      const adapter = createMockTtsAdapter();
      try {
        adapter.getStatus("nonexistent");
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("BAD_REQUEST");
      }
    });

    it("MOCK-08 duration 确定性：每字 50ms（最少 1000ms）", async () => {
      const adapter = createMockTtsAdapter();
      const r1 = await adapter.speak("a");
      const r2 = await adapter.speak("aaaaaaaaaa");
      const d1 = adapter.getStatus(r1.playbackId).duration;
      const d2 = adapter.getStatus(r2.playbackId).duration;
      // 1 字 * 50ms = 50ms，但最少 1000ms → 1000ms
      // 10 字 * 50ms = 500ms，但最少 1000ms → 1000ms
      expect(d1).toBe(1000);
      expect(d2).toBe(1000);
      expect(d1).toBe(d2); // 都是 1000ms（最少值）
    });
  });

  describe("createFailingTtsAdapter", () => {
    it("FAIL-01 speak 抛 INTERNAL_ERROR + 固定文案（不泄漏路径/stdout/stderr）", async () => {
      const adapter = createFailingTtsAdapter();
      try {
        await adapter.speak("测试");
        expect.fail("应抛错");
      } catch (e) {
        const err = e as { code: string; message: string };
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("系统 TTS 不可用");
        // 不泄漏路径/stdout/stderr/密钥
        expect(err.message).not.toMatch(/[A-Z]:\\|\/usr\/|\/bin\/|stdout|stderr|key|secret/i);
      }
    });

    it("FAIL-02 control 抛 BAD_REQUEST", async () => {
      const adapter = createFailingTtsAdapter();
      try {
        await adapter.control("any", "stop");
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("BAD_REQUEST");
      }
    });

    it("FAIL-03 getStatus 抛 BAD_REQUEST", () => {
      const adapter = createFailingTtsAdapter();
      try {
        adapter.getStatus("any");
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("createFailingEdgeTtsAdapter", () => {
    it("FEDGE-01 speak(engine=edge-tts) 抛 INTERNAL_ERROR", async () => {
      const adapter = createFailingEdgeTtsAdapter();
      try {
        await adapter.speak("测试", { engine: "edge-tts" });
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("INTERNAL_ERROR");
      }
    });

    it("FEDGE-02 speak(engine=sapi) 返回 fallbackUsed=true（降级行为）", async () => {
      const adapter = createFailingEdgeTtsAdapter();
      const result = await adapter.speak("测试", { engine: "sapi" });
      expect(result.engine).toBe("sapi");
      expect(result.fallbackUsed).toBe(true);
    });

    it("FEDGE-03 speak(无 engine) 默认走 sapi 降级", async () => {
      const adapter = createFailingEdgeTtsAdapter();
      const result = await adapter.speak("测试");
      expect(result.engine).toBe("sapi");
      expect(result.fallbackUsed).toBe(true);
    });
  });

  describe("createRealSapiAdapter（框架实现，不连真实子进程）", () => {
    it("RSAPI-01 sapiCliPath 为空时走系统 PATH（不抛错，路径校验通过）", () => {
      const adapter = createRealSapiAdapter({ sapiCliPath: "" });
      expect(adapter).toBeDefined();
      expect(typeof adapter.speak).toBe("function");
    });

    it("RSAPI-02 sapiCliPath 非空时正常构造", () => {
      const adapter = createRealSapiAdapter({ sapiCliPath: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" });
      expect(adapter).toBeDefined();
    });
  });

  describe("createRealEdgeTtsAdapter（框架实现，不连真实子进程）", () => {
    it("REDGE-01 edgeTtsCliPath 为空 → speak 抛 INTERNAL_ERROR + 固定文案", async () => {
      const adapter = createRealEdgeTtsAdapter({ edgeTtsCliPath: "" });
      try {
        await adapter.speak("测试");
        expect.fail("应抛错");
      } catch (e) {
        const err = e as { code: string; message: string };
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("edge-tts 未配置");
        // 不泄漏路径
        expect(err.message).not.toMatch(/[A-Z]:\\|\/usr\/|\/bin\//i);
      }
    });

    it("REDGE-02 edgeTtsCliPath 为空字符串 → speak 抛 INTERNAL_ERROR", async () => {
      const adapter = createRealEdgeTtsAdapter({ edgeTtsCliPath: "   " });
      try {
        await adapter.speak("测试");
        expect.fail("应抛错");
      } catch (e) {
        expect((e as { code: string }).code).toBe("INTERNAL_ERROR");
      }
    });
  });
});
