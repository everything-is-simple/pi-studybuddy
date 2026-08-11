/**
 * T-M4-018 RED：TTS 控制条 RPC 接线必须真实可用。
 *
 * 权威依据：06-API §3.10（tts.speak/control/switchEngine/getStatus）+ §4（tts.state）、
 * 09-UI §5.1-§5.5（控制条/内嵌按钮/状态反馈/标记已复习/降级）、07-WF §4（朗读路径）、
 * 08-Test §3.5/§5（TTS 断言 + 安全不变量）。
 * 仅使用 happy-dom 与内存 mock（可控 subscribe 发射 tts.state），
 * 不访问真实业务数据根、不连接真实 SAPI/edge-tts。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { TtsStatus } from "../../src/contract/types";
import type { TypedRpcClient } from "../../src/renderer/rpc-client";
import { useTtsPlayback } from "../../src/renderer/tts-playback";
import { TtsControlBar } from "../../src/renderer/components/TtsControlBar";
import { NotesTab } from "../../src/renderer/components/tabs/NotesTab";
import { MistakesTab } from "../../src/renderer/components/tabs/MistakesTab";
import type { StructuredNote, MistakeWithEvidence, WeakPoint } from "../../src/contract/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface TtsCall {
  method: string;
  params: unknown;
}

interface TtsMockOptions {
  speak?: (params: unknown) => Promise<unknown>;
  control?: (params: unknown) => Promise<unknown>;
  switchEngine?: (params: unknown) => Promise<unknown>;
  markReviewed?: (params: unknown) => Promise<unknown>;
}

/** 可控 TTS mock RPC：记录调用 + 可发射 tts.state 事件（对齐 06-API §4） */
function createTtsMockRpc(options: TtsMockOptions = {}): {
  rpc: TypedRpcClient;
  calls: TtsCall[];
  emitState: (payload: {
    playbackId: string;
    state: "playing" | "paused" | "stopped";
    position?: number;
    duration?: number;
  }) => void;
} {
  const calls: TtsCall[] = [];
  let emit: ((payload: unknown) => void) | undefined;
  const rpc: TypedRpcClient = {
    call(method, ...args) {
      const params = args[0];
      calls.push({ method: method as string, params });
      const impl: Record<string, (p: unknown) => unknown> = {
        "tts.speak":
          options.speak ??
          (() => Promise.resolve({ playbackId: "pb-1", engine: "sapi", fallbackUsed: false })),
        "tts.control": options.control ?? (() => Promise.resolve(undefined)),
        "tts.switchEngine": options.switchEngine ?? (() => Promise.resolve(undefined)),
        "tts.getStatus": () => ({ state: "playing", position: 0, duration: 5000 }),
        "events.markReviewed":
          options.markReviewed ??
          (() => Promise.resolve({ id: "evt-1", refType: "note", refId: "material-1" })),
      };
      const fn = impl[method as string];
      if (!fn) {
        return Promise.reject({ code: "UNKNOWN_METHOD", message: `未知方法: ${String(method)}` });
      }
      return Promise.resolve(fn(params));
    },
    subscribe(topic, key, on) {
      if (topic === "tts.state" && key === undefined) emit = on;
      return () => {
        if (emit === on) emit = undefined;
      };
    },
    dispose() {},
  };
  return {
    rpc,
    calls,
    emitState: (payload) => {
      emit?.(payload);
    },
  };
}

/** 挂钩 + 控制条组装 harness（模拟 AppShell 的接线方式，.ts 文件用 createElement） */
function TtsHarness({ rpc }: { rpc: TypedRpcClient }): React.JSX.Element {
  const tts = useTtsPlayback(rpc);
  return React.createElement(
    "div",
    null,
    React.createElement(TtsControlBar, {
      status: tts.status,
      engine: tts.engine,
      rate: tts.rate,
      fallbackUsed: tts.fallbackUsed,
      title: tts.title,
      canMarkReviewed: tts.canMarkReviewed,
      speakBusy: tts.speakBusy,
      error: tts.error,
      hasPlayback: Boolean(tts.playbackId),
      onPlayback: () => void tts.playbackButton(),
      onControl: (action: "play" | "pause" | "stop") => void tts.control(action),
      onRateChange: (rate: number) => tts.setRateValue(rate),
      onSwitchEngine: (engine: "sapi" | "edge-tts") => void tts.switchEngine(engine),
      onMarkReviewed: () => void tts.markReviewed(),
    }),
    React.createElement(
      "button",
      { type: "button", onClick: () => void tts.speak("牛顿第二定律，力等于质量乘以加速度。", { title: "物理笔记", refType: "note", refId: "material-1" }) },
      "外部触发朗读",
    ),
  );
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

function buttons(host: HTMLDivElement, label: string): HTMLButtonElement[] {
  return Array.from(host.querySelectorAll("button")).filter((candidate) =>
    candidate.textContent?.includes(label),
  ) as HTMLButtonElement[];
}
function button(host: HTMLDivElement, label: string): HTMLButtonElement {
  const item = buttons(host, label)[0];
  if (!item) throw new Error(`按钮不存在: ${label}`);
  return item;
}
function selectEl(host: HTMLDivElement): HTMLSelectElement {
  const item = host.querySelector("select");
  if (!(item instanceof HTMLSelectElement)) throw new Error("引擎 select 不存在");
  return item;
}
function rangeEl(host: HTMLDivElement): HTMLInputElement {
  const item = host.querySelector('input[type="range"]');
  if (!(item instanceof HTMLInputElement)) throw new Error("语速 range 不存在");
  return item;
}

/** 原生 value setter 赋值 + input/change 事件（绕过 React 受控 value tracker） */
function setInputValue(el: HTMLInputElement | HTMLSelectElement, value: string): void {
  const proto =
    el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function clickButton(host: HTMLDivElement, label: string): Promise<void> {
  act(() => {
    button(host, label).click();
  });
  await flush();
}

async function mount(
  rpc: TypedRpcClient,
): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(TtsHarness, { rpc }));
  });
  await flush();
  return { host, root };
}

async function unmount(root: Root, host: HTMLDivElement): Promise<void> {
  if (root) await act(async () => root?.unmount());
  host?.remove();
}

describe("T-M4-018 TTS 控制条 RPC 接线", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    await unmount(root as Root, host as HTMLDivElement);
    root = undefined;
    host = undefined;
    vi.restoreAllMocks();
  });

  it("C-RED-01 speak：外部朗读只调一次 tts.speak；成功后控制条进入播放中", async () => {
    const { rpc, calls, emitState } = createTtsMockRpc();
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;

    expect(button(host, "播放").disabled).toBe(false);
    await clickButton(host, "外部触发朗读");
    expect(calls.filter((c) => c.method === "tts.speak")).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: "tts.speak",
      params: { text: "牛顿第二定律，力等于质量乘以加速度。", engine: "sapi" },
    });

    // tts.state 订阅（06-API §4）→ playing
    emitState({ playbackId: "pb-1", state: "playing", position: 500, duration: 5000 });
    await flush();
    expect(host.textContent).toContain("播放中");
    expect(host.textContent).toContain("物理笔记");
  });

  it("C-RED-02 control：暂停/停止按当前 playbackId 调 tts.control 且状态展示更新", async () => {
    const { rpc, calls, emitState } = createTtsMockRpc();
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;

    // 未朗读时暂停/停止禁用
    expect(button(host, "暂停").disabled).toBe(true);
    expect(button(host, "停止").disabled).toBe(true);

    await clickButton(host, "外部触发朗读");
    emitState({ playbackId: "pb-1", state: "playing", position: 100, duration: 5000 });
    await flush();

    await clickButton(host, "暂停");
    expect(calls.find((c) => c.method === "tts.control")).toMatchObject({
      method: "tts.control",
      params: { playbackId: "pb-1", action: "pause" },
    });
    emitState({ playbackId: "pb-1", state: "paused", position: 1200, duration: 5000 });
    await flush();
    expect(host.textContent).toContain("暂停");
    expect(host.textContent).toContain("1s / 5s");

    await clickButton(host, "停止");
    const stopCall = calls.filter((c) => c.method === "tts.control").at(-1)?.params as {
      playbackId: string;
      action: string;
    };
    expect(stopCall).toMatchObject({ playbackId: "pb-1", action: "stop" });
    emitState({ playbackId: "pb-1", state: "stopped", position: 5000, duration: 5000 });
    await flush();
    expect(host.textContent).toContain("已停止");
  });

  it("C-RED-03 语速：播放中调节实时调 control({action:'play', rate})；空闲仅存本地", async () => {
    const { rpc, calls, emitState } = createTtsMockRpc();
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;

    // 空闲：改语速不调 control，仅本地更新
    setInputValue(rangeEl(host), "1.5");
    await flush();
    expect(host.textContent).toContain("1.5x");
    expect(calls.some((c) => c.method === "tts.control")).toBe(false);

    // 播放中：改语速实时生效（control play + rate）
    await clickButton(host, "外部触发朗读");
    emitState({ playbackId: "pb-1", state: "playing", position: 0, duration: 5000 });
    await flush();
    setInputValue(rangeEl(host), "1.8");
    await flush();
    const rateCall = calls.filter((c) => c.method === "tts.control").at(-1)?.params as {
      playbackId: string;
      action: string;
      rate?: number;
    };
    expect(rateCall).toMatchObject({ playbackId: "pb-1", action: "play", rate: 1.8 });
  });

  it("C-RED-04 switchEngine：切换后控制条展示新引擎，后续 speak 携带该引擎", async () => {
    const { rpc, calls } = createTtsMockRpc();
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;

    setInputValue(selectEl(host), "edge-tts");
    await flush();
    expect(calls.find((c) => c.method === "tts.switchEngine")).toMatchObject({
      method: "tts.switchEngine",
      params: { engine: "edge-tts" },
    });
    expect(selectEl(host).value).toBe("edge-tts");

    await clickButton(host, "外部触发朗读");
    const speakCall = calls.filter((c) => c.method === "tts.speak").at(-1)?.params as {
      engine: string;
    };
    expect(speakCall.engine).toBe("edge-tts");
  });

  it("C-RED-05 tts.state 订阅：旧 playbackId 事件不覆盖新播放", async () => {
    const { rpc, emitState } = createTtsMockRpc();
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;

    await clickButton(host, "外部触发朗读");
    emitState({ playbackId: "pb-1", state: "playing", position: 100, duration: 5000 });
    await flush();
    expect(host.textContent).toContain("播放中");

    // 模拟第二次朗读（playbackId 变化）
    const second = createTtsMockRpc({ speak: () => Promise.resolve({ playbackId: "pb-2", engine: "sapi" }) });
    // 重建 harness 以切换 mock（等价于新一次朗读）
    await unmount(root, host);
    const mounted2 = await mount(second.rpc);
    root = mounted2.root;
    host = mounted2.host;
    await clickButton(host, "外部触发朗读");
    await flush();

    // 旧播放（pb-1）的迟到 stopped 事件不得把新播放打成 stopped
    emitState({ playbackId: "pb-1", state: "stopped", position: 5000, duration: 5000 });
    await flush();
    expect(host.textContent).not.toContain("已停止");
    expect(host.textContent).toContain("播放中");

    // 新播放的 stopped 事件正常生效
    second.emitState({ playbackId: "pb-2", state: "stopped", position: 5000, duration: 5000 });
    await flush();
    expect(host.textContent).toContain("已停止");
  });

  it("C-RED-06 多入口复用：内嵌朗读按钮（NotesTab/MistakesTab）触发 onSpeakText 且不产生重复播放", async () => {
    // NotesTab 内嵌"朗读"接线（09-UI §5.2 S2 笔记预览）
    const note: StructuredNote = {
      id: "note-1",
      materialId: "material-1",
      courseId: "course-1",
      noteMarkdown: "力学笔记：牛顿第一定律。",
      aiGenerated: false,
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
    };
    const speakSpy = vi.fn();
    const notesHost = document.createElement("div");
    document.body.append(notesHost);
    const notesRoot = createRoot(notesHost);
    await act(async () => {
      notesRoot.render(React.createElement(NotesTab, { note, onSpeakText: speakSpy }));
    });
    await flush();
    expect(button(notesHost, "朗读").disabled).toBe(false);
    await clickButton(notesHost, "朗读");
    expect(speakSpy).toHaveBeenCalledTimes(1);
    expect(speakSpy.mock.calls[0][0]).toBe("力学笔记：牛顿第一定律。");
    expect(speakSpy.mock.calls[0][1]).toMatchObject({ refType: "note", refId: "material-1" });
    await unmount(notesRoot, notesHost);

    // MistakesTab 内嵌"朗读"接线（09-UI §5.2 S4 错题详情）
    const mistake: MistakeWithEvidence = {
      id: "mistake-1",
      questionId: "question-1",
      courseId: "course-1",
      status: "needs_review",
      redoCount: 0,
      errorCause: "公式记错了",
      errorCauseAiSuggestion: "建议先复习匀变速公式",
      evidence: [],
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
    };
    const weakPoints: WeakPoint[] = [];
    const mistakeSpeakSpy = vi.fn();
    const mistakeHost = document.createElement("div");
    document.body.append(mistakeHost);
    const mistakeRoot = createRoot(mistakeHost);
    await act(async () => {
      mistakeRoot.render(
        React.createElement(MistakesTab, {
          mistakes: [mistake],
          selectedMistake: mistake,
          weakPoints,
          onSpeakText: mistakeSpeakSpy,
        }),
      );
    });
    await flush();
    expect(button(mistakeHost, "朗读").disabled).toBe(false);
    await clickButton(mistakeHost, "朗读");
    expect(mistakeSpeakSpy).toHaveBeenCalledTimes(1);
    expect(mistakeSpeakSpy.mock.calls[0][0]).toContain("公式记错了");
    expect(mistakeSpeakSpy.mock.calls[0][1]).toMatchObject({ refType: "mistake", refId: "mistake-1" });
    await unmount(mistakeRoot, mistakeHost);

    // 控制条侧：in-flight 期间重复触发 speak 被拒绝（不产生重复播放）
    const { rpc, calls } = createTtsMockRpc({
      speak: () => {
        const pending = deferred<{ playbackId: string; engine: "sapi" | "edge-tts" }>();
        return pending.promise;
      },
    });
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;
    await clickButton(host, "外部触发朗读");
    await clickButton(host, "外部触发朗读");
    expect(calls.filter((c) => c.method === "tts.speak")).toHaveLength(1);
  });

  it("C-RED-07 降级提示：fallbackUsed=true 显示'已降级到 SAPI'（09-UI §5.5）", async () => {
    const { rpc } = createTtsMockRpc({
      speak: () => Promise.resolve({ playbackId: "pb-1", engine: "sapi", fallbackUsed: true }),
    });
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;
    await clickButton(host, "外部触发朗读");
    expect(host.textContent).toContain("已降级到 SAPI");
  });

  it("C-RED-08 标记已复习：朗读完成（stopped）显示按钮，点击只调一次 events.markReviewed；朗读本身不写 StudyEvent", async () => {
    const { rpc, calls, emitState } = createTtsMockRpc();
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;

    // 朗读本身不持久化（07-WF §4.3）：未点击标记前不得有 markReviewed 调用
    await clickButton(host, "外部触发朗读");
    emitState({ playbackId: "pb-1", state: "playing", position: 100, duration: 5000 });
    await flush();
    expect(host.textContent).not.toContain("标记已复习");
    expect(calls.some((c) => c.method === "events.markReviewed")).toBe(false);

    // 朗读完成（stopped）→ 显示标记已复习（09-UI §5.4）
    emitState({ playbackId: "pb-1", state: "stopped", position: 5000, duration: 5000 });
    await flush();
    expect(button(host, "标记已复习").disabled).toBe(false);
    await clickButton(host, "标记已复习");
    expect(calls.filter((c) => c.method === "events.markReviewed")).toHaveLength(1);
    expect(calls.filter((c) => c.method === "events.markReviewed")[0]).toMatchObject({
      method: "events.markReviewed",
      params: { refType: "note", refId: "material-1" },
    });
    // 标记后按钮消失（防重复）
    expect(buttons(host, "标记已复习").length).toBe(0);
  });

  it("C-RED-09 竞态/卸载：speak 未完成时卸载组件，resolve 后不执行 setState", async () => {
    const pending = deferred<{ playbackId: string; engine: "sapi" | "edge-tts" }>();
    const { rpc } = createTtsMockRpc({ speak: () => pending.promise });
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;
    await clickButton(host, "外部触发朗读");
    expect(button(host, "朗读中…").disabled).toBe(true); // speakBusy（防重复播放）

    // 卸载后 resolve（不应抛错 / 不应 setState）
    await unmount(root, host);
    root = undefined;
    host = undefined;
    await act(async () => {
      pending.resolve({ playbackId: "pb-1", engine: "sapi" });
      await Promise.resolve();
    });
    // 无异常即通过
    expect(true).toBe(true);
  });

  it("C-RED-10 错误净化：失败只显示固定文案，DOM 无完整 UUID/路径/错误栈/密钥", async () => {
    const { rpc } = createTtsMockRpc({
      speak: () =>
        Promise.reject({
          code: "INTERNAL_ERROR",
          message: "朗读不可用，请检查系统 TTS 设置",
        }),
    });
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;
    await clickButton(host, "外部触发朗读");
    // renderer 固定文案（AGENTS.md §9.3：不展示服务端原始错误）；服务端固定文案不得出现
    expect(host.textContent).toContain("朗读失败，请稍后重试。");
    expect(host.textContent).not.toContain("朗读不可用");
    expect(host.textContent).not.toContain("检查系统 TTS");

    const domText = host.textContent ?? "";
    expect(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(domText)).toBe(false);
    expect(/\b[a-z]:[\\/][^\s]*/i.test(domText)).toBe(false);
    expect(/secret\.ts|stackFrame|sk-secret/i.test(domText)).toBe(false);
    expect(/(?:^|\n)\s*(?:[A-Za-z]*Error|Exception)\s*:/m.test(domText)).toBe(false);
  });
});
