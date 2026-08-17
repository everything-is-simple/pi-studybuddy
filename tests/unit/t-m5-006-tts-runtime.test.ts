/**
 * T-M5-006 TTS runtime装配 RED/GREEN。
 *
 * 权威：01-TRD §7 决策 4，SAPI 默认离线；edge-tts 可选且缺失时降级。
 * 本测试只断言装配选择，不调用真实 SAPI/edge-tts 子进程。
 */
import { describe, expect, it } from "vitest";
import { createRuntimeTtsContext } from "../../src/agent-host/handlers/tts/runtime-context";
import type { TtsAdapter } from "../../src/agent-host/handlers/tts";

function taggedAdapter(tag: string): TtsAdapter {
  return {
    async speak() {
      return { playbackId: `${tag}-playback`, engine: tag === "edge" ? "edge-tts" : "sapi" };
    },
    async control() {},
    getStatus() {
      return { state: "playing", position: 0, duration: 1 };
    },
  };
}

describe("T-M5-006 production TTS runtime context", () => {
  it("TTS-01: production defaults to real SAPI adapter and does not require edge-tts", async () => {
    const calls: string[] = [];
    const ctx = createRuntimeTtsContext({
      env: {},
      isTest: false,
      adapters: {
        sapi: () => {
          calls.push("sapi");
          return taggedAdapter("sapi");
        },
        edge: (cliPath) => {
          calls.push(`edge:${cliPath}`);
          return taggedAdapter("edge");
        },
        mock: () => {
          calls.push("mock");
          return taggedAdapter("mock");
        },
      },
    });

    expect(calls).toEqual(["sapi", "edge:"]);
    expect(ctx.currentEngine).toBe("sapi");
    await expect(ctx.sapiAdapter.speak("离线朗读装配断言")).resolves.toMatchObject({ engine: "sapi" });
  });

  it("TTS-02: configured edge-tts is optional and path is not exposed by context", () => {
    const received: string[] = [];
    const ctx = createRuntimeTtsContext({
      env: { PI_STUDYBUDDY_EDGE_TTS_CLI: "C:\\private\\edge-tts.exe" },
      isTest: false,
      adapters: {
        sapi: () => taggedAdapter("sapi"),
        edge: (cliPath) => {
          received.push(cliPath);
          return taggedAdapter("edge");
        },
        mock: () => taggedAdapter("mock"),
      },
    });

    expect(received).toEqual(["C:\\private\\edge-tts.exe"]);
    expect(JSON.stringify(ctx)).not.toContain("C:\\private");
    expect(ctx.edgeTtsAdapter.getStatus("edge-playback").state).toBe("playing");
  });

  it("TTS-03: tests keep mock adapters and never instantiate real adapters", () => {
    const calls: string[] = [];
    createRuntimeTtsContext({
      env: { PI_STUDYBUDDY_EDGE_TTS_CLI: "C:\\private\\edge-tts.exe" },
      isTest: true,
      adapters: {
        sapi: () => {
          calls.push("sapi");
          return taggedAdapter("sapi");
        },
        edge: () => {
          calls.push("edge");
          return taggedAdapter("edge");
        },
        mock: () => {
          calls.push("mock");
          return taggedAdapter("mock");
        },
      },
    });

    expect(calls).toEqual(["mock", "mock"]);
  });
});
