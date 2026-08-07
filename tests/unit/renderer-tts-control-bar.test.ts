/**
 * T-M2-008 RED: TtsControlBar TTS 全局控制条静态渲染测试
 *
 * 权威依据：09-UI §5.1-§5.5（TTS 全局控制条 + 引擎降级 + 标记已复习）
 *
 * 测试策略：
 * - 引擎切换 + 语速调节 + 播放控制
 * - 状态显示
 * - fallbackUsed 降级提示（§5.5）
 * - 朗读完成显示标记已复习（§5.4）
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TtsControlBar } from "../../src/renderer/components/TtsControlBar";

// ---------- TtsControlBar 基础渲染 ----------

describe("TtsControlBar 基础渲染（09-UI §5.1）", () => {
  it("渲染 TTS 控制条", () => {
    const html = renderToStaticMarkup(
      React.createElement(TtsControlBar, { state: { state: "idle", position: 0, duration: 0 } }),
    );
    expect(html).toContain("TTS");
  });

  it("渲染引擎切换入口", () => {
    const html = renderToStaticMarkup(
      React.createElement(TtsControlBar, {
        state: { state: "idle", position: 0, duration: 0 },
        currentEngine: "sapi",
      }),
    );
    expect(html).toContain("SAPI");
    expect(html).toContain("edge-tts");
  });

  it("渲染语速调节", () => {
    const html = renderToStaticMarkup(
      React.createElement(TtsControlBar, {
        state: { state: "idle", position: 0, duration: 0 },
        rate: 1.0,
      }),
    );
    expect(html).toContain("语速");
  });

  it("渲染播放控制按钮（播放/暂停/停止）", () => {
    const html = renderToStaticMarkup(
      React.createElement(TtsControlBar, { state: { state: "idle", position: 0, duration: 0 } }),
    );
    expect(html).toContain("播放");
    expect(html).toContain("暂停");
    expect(html).toContain("停止");
  });
});

// ---------- TtsControlBar 状态显示 ----------

describe("TtsControlBar 状态显示（09-UI §5.3）", () => {
  it("播放中状态展示", () => {
    const html = renderToStaticMarkup(
      React.createElement(TtsControlBar, {
        state: { state: "playing", position: 5000, duration: 10000 },
      }),
    );
    expect(html).toContain("播放中");
  });

  it("暂停状态展示", () => {
    const html = renderToStaticMarkup(
      React.createElement(TtsControlBar, {
        state: { state: "paused", position: 5000, duration: 10000 },
      }),
    );
    expect(html).toContain("暂停");
  });

  it("停止状态展示", () => {
    const html = renderToStaticMarkup(
      React.createElement(TtsControlBar, {
        state: { state: "stopped", position: 0, duration: 10000 },
      }),
    );
    expect(html).toContain("已停止");
  });

  it("渲染播放进度", () => {
    const html = renderToStaticMarkup(
      React.createElement(TtsControlBar, {
        state: { state: "playing", position: 5000, duration: 10000 },
      }),
    );
    // 进度展示（秒或百分比）
    expect(html).toContain("5");
    expect(html).toContain("10");
  });
});

// ---------- TtsControlBar 引擎降级（§5.5） ----------

describe("TtsControlBar 引擎降级（09-UI §5.5）", () => {
  it("fallbackUsed=true 时渲染降级提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(TtsControlBar, {
        state: { state: "playing", position: 0, duration: 10000 },
        currentEngine: "sapi",
        fallbackUsed: true,
      }),
    );
    // edge-tts 失败降级 SAPI，应显示降级提示
    expect(html).toContain("降级");
  });

  it("fallbackUsed 未降级时不显示降级提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(TtsControlBar, {
        state: { state: "playing", position: 0, duration: 10000 },
        currentEngine: "edge-tts",
        fallbackUsed: false,
      }),
    );
    expect(html).not.toContain("降级");
  });
});

// ---------- TtsControlBar 标记已复习（§5.4） ----------

describe("TtsControlBar 标记已复习（09-UI §5.4）", () => {
  it("朗读完成（stopped）时显示标记已复习按钮", () => {
    const html = renderToStaticMarkup(
      React.createElement(TtsControlBar, {
        state: { state: "stopped", position: 10000, duration: 10000 },
        canMarkReviewed: true,
      }),
    );
    expect(html).toContain("标记已复习");
  });

  it("播放中不显示标记已复习按钮", () => {
    const html = renderToStaticMarkup(
      React.createElement(TtsControlBar, {
        state: { state: "playing", position: 5000, duration: 10000 },
        canMarkReviewed: false,
      }),
    );
    expect(html).not.toContain("标记已复习");
  });

  it("未朗读过不显示标记已复习按钮", () => {
    const html = renderToStaticMarkup(
      React.createElement(TtsControlBar, {
        state: { state: "idle", position: 0, duration: 0 },
      }),
    );
    expect(html).not.toContain("标记已复习");
  });
});
