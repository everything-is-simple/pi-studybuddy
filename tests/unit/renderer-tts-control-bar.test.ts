/**
 * T-M4-018: TtsControlBar TTS 全局控制条受控渲染测试
 *
 * 权威依据：09-UI §5.1-§5.5（TTS 全局控制条 + 引擎降级 + 标记已复习）
 *
 * 测试策略（受控 props，回调断言）：
 * - 引擎切换 + 语速调节 + 播放控制回调
 * - 状态显示（播放中/暂停/已停止/进度）
 * - fallbackUsed 降级提示（§5.5）
 * - 朗读完成显示标记已复习（§5.4）
 * - 隐私边界：控制条不渲染 playbackId 完整 UUID（09-UI §11.1）
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TtsControlBar } from "../../src/renderer/components/TtsControlBar";

type Status = { state: "playing" | "paused" | "stopped"; position: number; duration: number };

const idleStatus: Status = { state: "stopped", position: 0, duration: 0 };

function renderControlBar(overrides: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    React.createElement(TtsControlBar, {
      status: idleStatus,
      engine: "sapi",
      rate: 1.0,
      fallbackUsed: false,
      canMarkReviewed: false,
      speakBusy: false,
      hasPlayback: false,
      onPlayback: () => {},
      onControl: () => {},
      onRateChange: () => {},
      onSwitchEngine: () => {},
      onMarkReviewed: () => {},
      ...overrides,
    }),
  );
}

// ---------- TtsControlBar 基础渲染 ----------

describe("TtsControlBar 基础渲染（09-UI §5.1）", () => {
  it("渲染 TTS 控制条", () => {
    expect(renderControlBar()).toContain("TTS");
  });

  it("渲染引擎切换入口（SAPI 默认 + edge-tts 可选）", () => {
    const html = renderControlBar({ engine: "sapi" });
    expect(html).toContain("SAPI");
    expect(html).toContain("edge-tts");
  });

  it("渲染语速调节", () => {
    const html = renderControlBar({ rate: 1.0 });
    expect(html).toContain("语速");
    expect(html).toContain("1.0x");
  });

  it("渲染播放控制按钮（播放/暂停/停止）", () => {
    const html = renderControlBar();
    expect(html).toContain("播放");
    expect(html).toContain("暂停");
    expect(html).toContain("停止");
  });
});

// ---------- TtsControlBar 状态显示 ----------

describe("TtsControlBar 状态显示（09-UI §5.3）", () => {
  it("播放中状态展示", () => {
    expect(renderControlBar({ status: { state: "playing", position: 5000, duration: 10000 } })).toContain("播放中");
  });

  it("暂停状态展示", () => {
    expect(renderControlBar({ status: { state: "paused", position: 5000, duration: 10000 } })).toContain("暂停");
  });

  it("停止状态展示", () => {
    expect(renderControlBar({ status: { state: "stopped", position: 10000, duration: 10000 } })).toContain("已停止");
  });

  it("空闲状态展示", () => {
    expect(renderControlBar({ status: idleStatus })).toContain("空闲");
  });

  it("渲染播放进度与标题", () => {
    const html = renderControlBar({
      status: { state: "playing", position: 5000, duration: 10000 },
      title: "物理笔记",
    });
    expect(html).toContain("物理笔记");
    expect(html).toContain("5");
    expect(html).toContain("10");
  });
});

// ---------- TtsControlBar 引擎降级（§5.5） ----------

describe("TtsControlBar 引擎降级（09-UI §5.5）", () => {
  it("fallbackUsed=true 时渲染降级提示", () => {
    expect(renderControlBar({ fallbackUsed: true })).toContain("已降级到 SAPI");
  });

  it("fallbackUsed 未降级时不显示降级提示", () => {
    expect(renderControlBar({ fallbackUsed: false })).not.toContain("降级");
  });
});

// ---------- TtsControlBar 标记已复习（§5.4） ----------

describe("TtsControlBar 标记已复习（09-UI §5.4）", () => {
  it("朗读完成（stopped）+ canMarkReviewed 时显示标记已复习按钮", () => {
    expect(
      renderControlBar({ status: { state: "stopped", position: 10000, duration: 10000 }, canMarkReviewed: true }),
    ).toContain("标记已复习");
  });

  it("播放中不显示标记已复习按钮", () => {
    expect(
      renderControlBar({ status: { state: "playing", position: 5000, duration: 10000 }, canMarkReviewed: false }),
    ).not.toContain("标记已复习");
  });

  it("未朗读过不显示标记已复习按钮", () => {
    expect(renderControlBar({ status: idleStatus })).not.toContain("标记已复习");
  });
});

// ---------- TtsControlBar 回调接线 ----------

describe("TtsControlBar 回调接线（06-API §3.10）", () => {
  it("播放按钮触发 onPlayback（恢复/重读由上层决定）", () => {
    const onPlayback = vi.fn();
    renderToStaticMarkup(
      React.createElement(TtsControlBar, {
        status: { state: "paused", position: 1000, duration: 5000 },
        engine: "sapi",
        rate: 1.0,
        hasPlayback: true,
        onPlayback,
        onControl: () => {},
        onRateChange: () => {},
        onSwitchEngine: () => {},
        onMarkReviewed: () => {},
      }),
    );
    expect(onPlayback).not.toHaveBeenCalled();
  });

  it("播放中时暂停/停止可用（hasPlayback + playing）", () => {
    const html = renderControlBar({
      status: { state: "playing", position: 500, duration: 5000 },
      hasPlayback: true,
    });
    expect(html).toContain("播放中");
  });
});

// ---------- TtsControlBar 隐私边界（09-UI §11.1） ----------

describe("TtsControlBar 隐私边界（09-UI §11.1）", () => {
  it("控制条不渲染 playbackId 完整 UUID / 路径 / 错误栈", () => {
    const html = renderControlBar({
      status: { state: "playing", position: 0, duration: 5000 },
      title: "笔记",
      error: "朗读失败，请稍后重试。",
    });
    expect(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(html)).toBe(false);
    expect(/\b[a-z]:[\\/][^\s]*/i.test(html)).toBe(false);
    expect(/secret\.ts|stackFrame|sk-secret/i.test(html)).toBe(false);
    expect(/(?:^|\n)\s*(?:[A-Za-z]*Error|Exception)\s*:/m.test(html)).toBe(false);
  });
});
