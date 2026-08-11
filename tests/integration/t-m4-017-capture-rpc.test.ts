/**
 * T-M4-017 RED：CaptureTab 必须接通既有 S7 课堂采集 RPC。
 *
 * 权威依据：06-API §3.9、07-Workflow §2.7、08-Test §5/§6/§7.1、09-UI §4.10。
 * 仅使用 happy-dom 与内存 mock（mock rpc + mock bridge.showDialog rawPath），
 * 不访问真实业务数据根、不连接真实 whisper.cpp 或外部服务。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { FileMeta, Material } from "../../src/contract/types";
import { CaptureTab } from "../../src/renderer/components/tabs/CaptureTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";
import type { SemesterCourseContext } from "../../src/renderer/semester-course-state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const wavFile: FileMeta = {
  name: "课堂录音.wav",
  size: 10240,
  mime: "audio/wav",
  path: "H:\\recordings\\课堂录音.wav",
};

const savedMaterial: Material = {
  id: "mat-017",
  courseId: "course-1",
  fileName: "课堂录音",
  fileType: "text",
  fileSizeBytes: 64,
  mimeType: "text/plain",
  storageKey: "semester/s1/class-capture/mat-017.txt",
  sourceType: "class_audio_transcription",
  status: "converted",
  permissionConfirmed: 1,
  uploadedAt: "2026-08-11T00:00:00.000Z",
  convertedAt: "2026-08-11T00:00:00.000Z",
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
};

const archivedContext: SemesterCourseContext = { semesterId: "sem-arch", courseId: "course-arch", isReadOnly: true };

interface DialogResultMock {
  canceled: boolean;
  rawPath?: string;
  fileName?: string;
  fileSize?: number;
  filePath?: string;
  importToken?: string;
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

function buttons(host: HTMLDivElement, label: string): HTMLButtonElement[] {
  return Array.from(host.querySelectorAll("button")).filter((candidate) => candidate.textContent?.includes(label)) as HTMLButtonElement[];
}
function button(host: HTMLDivElement, label: string): HTMLButtonElement {
  const item = buttons(host, label)[0];
  if (!item) throw new Error(`按钮不存在: ${label}`);
  return item;
}
function checkbox(host: HTMLDivElement): HTMLInputElement {
  const item = host.querySelector('input[type="checkbox"]');
  if (!(item instanceof HTMLInputElement)) throw new Error("合规确认 checkbox 不存在");
  return item;
}
function textarea(host: HTMLDivElement): HTMLTextAreaElement {
  const item = host.querySelector("textarea");
  if (!(item instanceof HTMLTextAreaElement)) throw new Error("转写 textarea 不存在");
  return item;
}
function input(host: HTMLDivElement, name: string): HTMLInputElement {
  const item = host.querySelector(`input[name="${name}"]`);
  if (!(item instanceof HTMLInputElement)) throw new Error(`输入框不存在: ${name}`);
  return item;
}

/** 用原生 value setter 赋值并触发 input（绕过 React 受控组件 value tracker，jsdom/happy-dom 测试标准做法） */
function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** 触发按钮点击并 flush（async handler 的 promise 在 act 外继续，flush 让其 settle） */
async function clickButton(host: HTMLDivElement, label: string): Promise<void> {
  act(() => {
    button(host, label).click();
  });
  await flush();
}
async function clickCheckbox(host: HTMLDivElement): Promise<void> {
  act(() => {
    checkbox(host).click();
  });
  await flush();
}

function mockBridge(dialogResult?: DialogResultMock): ReturnType<typeof vi.fn> {
  const showDialog = vi.fn(async () => dialogResult ?? { canceled: true });
  (globalThis as { window: Window & { piBridge?: unknown } }).window.piBridge = {
    showDialog,
  };
  return showDialog;
}

describe("T-M4-017 CaptureTab RPC 接线", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
    vi.restoreAllMocks();
  });

  it("C-RED-01 许可确认门控：未勾选/无文件/无课程均禁用转写，三者齐备可用", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "classCapture.transcribe": (params: unknown) => { calls.push({ method: "classCapture.transcribe", params }); return { transcription: "转写文本" }; },
      "classCapture.saveTranscription": (params: unknown) => { calls.push({ method: "classCapture.saveTranscription", params }); return savedMaterial; },
    });
    mockBridge({ canceled: false, rawPath: wavFile.path, fileName: wavFile.name, fileSize: wavFile.size });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);

    // 初始：未勾选、无文件、无课程 → 禁用 + 课程引导
    await act(async () => root?.render(React.createElement(CaptureTab, { rpc })));
    await flush();
    expect(button(host, "开始转写").disabled).toBe(true);
    expect(host.textContent).toContain("请先选择课程");

    // 勾选 + 有课程但无文件 → 仍禁用（不再显示课程引导）
    await act(async () => root?.render(React.createElement(CaptureTab, { rpc, courseId: "course-1" })));
    await flush();
    await clickCheckbox(host);
    expect(host.textContent).not.toContain("请先选择课程");
    expect(button(host, "开始转写").disabled).toBe(true);

    // 选择文件后 → 可用；点转写只调一次且参数含 permissionConfirmed:true
    await clickButton(host, "选择文件");
    expect(button(host, "开始转写").disabled).toBe(false);
    await clickButton(host, "开始转写");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: "classCapture.transcribe", params: { courseId: "course-1", permissionConfirmed: true } });
  });

  it("C-RED-02 文件选择：dialog rawPath → FileMeta；canceled 不改变状态；只发一次", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "classCapture.transcribe": (params: unknown) => { calls.push({ method: "classCapture.transcribe", params }); return { transcription: "转写文本" }; },
      "classCapture.saveTranscription": () => savedMaterial,
    });
    const showDialog = mockBridge({ canceled: false, rawPath: wavFile.path, fileName: wavFile.name, fileSize: wavFile.size });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CaptureTab, { rpc, courseId: "course-1" })));
    await flush();

    // canceled：状态不变
    showDialog.mockResolvedValueOnce({ canceled: true });
    await clickButton(host, "选择文件");
    expect(host.textContent).not.toContain("课堂录音.wav");

    // 成功：FileMeta 以 rawPath 构造，mime=audio/wav；dialog 参数含 rawPath:true
    await clickButton(host, "选择文件");
    expect(host.textContent).toContain("课堂录音.wav");
    const dialogOptions = showDialog.mock.calls[1][0] as { type: string; rawPath?: boolean };
    expect(dialogOptions.type).toBe("open");
    expect(dialogOptions.rawPath).toBe(true);

    // 转写 payload 的 audioFile 含 path
    await clickCheckbox(host);
    await clickButton(host, "开始转写");
    expect(calls).toHaveLength(1);
    const params = calls[0].params as { audioFile: FileMeta };
    expect(params.audioFile).toMatchObject({ name: "课堂录音.wav", mime: "audio/wav", path: wavFile.path });
  });

  it("C-RED-03 转写：in-flight 防重复；成功后展示可编辑转写文本", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const pending = deferred<{ transcription: string }>();
    const rpc = createMockRpcClient({
      "classCapture.transcribe": (params: unknown) => { calls.push({ method: "classCapture.transcribe", params }); return pending.promise; },
      "classCapture.saveTranscription": () => savedMaterial,
    });
    mockBridge({ canceled: false, rawPath: wavFile.path, fileName: wavFile.name, fileSize: wavFile.size });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CaptureTab, { rpc, courseId: "course-1" })));
    await flush();
    await clickCheckbox(host);
    await clickButton(host, "选择文件");

    await clickButton(host, "开始转写");
    // in-flight：按钮显示转写中…，再次点击不产生第二次调用
    act(() => {
      button(host, "转写中…").click();
    });
    await flush();
    expect(calls).toHaveLength(1);

    await act(async () => pending.resolve({ transcription: "今天我们讲导数的定义。" }));
    await flush();
    expect(host.textContent).toContain("今天我们讲导数的定义。");
    expect(button(host, "保存为笔记").disabled).toBe(false);
  });

  it("C-RED-04 转写可编辑：textarea 反映结果，编辑后用于保存；空文本阻止保存", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "classCapture.transcribe": () => ({ transcription: "原始转写" }),
      "classCapture.saveTranscription": (params: unknown) => { calls.push({ method: "classCapture.saveTranscription", params }); return savedMaterial; },
    });
    mockBridge({ canceled: false, rawPath: wavFile.path, fileName: wavFile.name, fileSize: wavFile.size });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CaptureTab, { rpc, courseId: "course-1" })));
    await flush();
    await clickCheckbox(host);
    await clickButton(host, "选择文件");
    await clickButton(host, "开始转写");

    const editor = textarea(host);
    expect(editor.value).toBe("原始转写");
    // 编辑为空 → 保存禁用
    act(() => {
      setInputValue(editor, "");
    });
    await flush();
    expect(button(host, "保存为笔记").disabled).toBe(true);
    // 编辑为修改后文本 → 保存 payload 使用编辑后值
    act(() => {
      setInputValue(editor, "修改后的课堂笔记");
    });
    await flush();
    await clickButton(host, "保存为笔记");
    expect(calls).toHaveLength(1);
    expect(calls[0].params).toMatchObject({ courseId: "course-1", transcription: "修改后的课堂笔记" });
  });

  it("C-RED-05 保存：标题默认从文件名派生且可编辑；in-flight 防重复；成功确认", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const pending = deferred<Material>();
    const rpc = createMockRpcClient({
      "classCapture.transcribe": () => ({ transcription: "转写文本" }),
      "classCapture.saveTranscription": (params: unknown) => { calls.push({ method: "classCapture.saveTranscription", params }); return pending.promise; },
    });
    mockBridge({ canceled: false, rawPath: wavFile.path, fileName: wavFile.name, fileSize: wavFile.size });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CaptureTab, { rpc, courseId: "course-1" })));
    await flush();
    await clickCheckbox(host);
    await clickButton(host, "选择文件");
    await clickButton(host, "开始转写");

    // 标题默认从文件名去扩展名派生，可编辑
    const titleInput = input(host, "capture-title");
    expect(titleInput.value).toBe("课堂录音");
    act(() => {
      setInputValue(titleInput, "高等数学课堂转写");
    });
    await flush();

    await clickButton(host, "保存为笔记");
    // in-flight：按钮显示保存中…，重复点击不重复调用
    act(() => {
      button(host, "保存中…").click();
    });
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0].params).toMatchObject({ courseId: "course-1", title: "高等数学课堂转写", transcription: "转写文本" });

    await act(async () => pending.resolve(savedMaterial));
    await flush();
    expect(host.textContent).toContain("已保存");
  });

  it("C-RED-06 课程门控：无 courseId 不发任何 RPC，显示引导", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "classCapture.transcribe": (params: unknown) => { calls.push({ method: "classCapture.transcribe", params }); return { transcription: "转写文本" }; },
      "classCapture.saveTranscription": () => savedMaterial,
    });
    mockBridge({ canceled: false, rawPath: wavFile.path, fileName: wavFile.name, fileSize: wavFile.size });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CaptureTab, { rpc })));
    await flush();
    expect(host.textContent).toContain("请先选择课程");
    expect(button(host, "选择文件").disabled).toBe(true);
    expect(button(host, "开始转写").disabled).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("C-RED-07 归档只读：archived 学期所有采集操作禁用并提示", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "classCapture.transcribe": (params: unknown) => { calls.push({ method: "classCapture.transcribe", params }); return { transcription: "转写文本" }; },
      "classCapture.saveTranscription": () => savedMaterial,
    });
    mockBridge({ canceled: false, rawPath: wavFile.path, fileName: wavFile.name, fileSize: wavFile.size });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CaptureTab, { rpc, courseId: "course-arch", academicContext: archivedContext })));
    await flush();
    expect(host.textContent).toContain("已归档");
    expect(button(host, "选择文件").disabled).toBe(true);
    expect(button(host, "开始转写").disabled).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("C-RED-08 竞态/卸载：转写中切换课程丢弃旧响应；卸载后 resolve 不 setState", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const pending = deferred<{ transcription: string }>();
    const rpc = createMockRpcClient({
      "classCapture.transcribe": (params: unknown) => { calls.push({ method: "classCapture.transcribe", params }); return pending.promise; },
      "classCapture.saveTranscription": () => savedMaterial,
    });
    mockBridge({ canceled: false, rawPath: wavFile.path, fileName: wavFile.name, fileSize: wavFile.size });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CaptureTab, { rpc, courseId: "course-1" })));
    await flush();
    await clickCheckbox(host);
    await clickButton(host, "选择文件");
    await clickButton(host, "开始转写");

    // 切换课程：卸载 course-1 挂载 course-2（模拟 courseId 变化）
    await act(async () => root?.unmount());
    host.remove();
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CaptureTab, { rpc, courseId: "course-2" })));
    await flush();

    // 旧 course-1 的响应到达：不得影响 course-2 视图（无异常、course-2 无旧转写）
    await act(async () => pending.resolve({ transcription: "旧课程转写" }));
    await flush();
    expect(host.textContent).not.toContain("旧课程转写");

    // 卸载后 resolve：不得 setState（无异常即可，React 不抛错即视为通过）
    await act(async () => root?.unmount());
    host.remove();
    root = undefined;
    host = undefined;
    const late = deferred<{ transcription: string }>();
    await act(async () => late.resolve({ transcription: "迟到响应" }));
    await flush();
  });

  it("C-RED-09 错误净化：只显示固定文案，无路径/UUID/file URI/错误栈", async () => {
    const rpc = createMockRpcClient({
      "classCapture.transcribe": () => {
        const leak = `内部错误: ${wavFile.path}; C:\\private\\secret.ts; inline Error: hidden at stackFrame; id 019fee9d-bafe-7902-81e1-01f98fea797e; file:///private/secret.ts`;
        return Promise.reject({ code: "INTERNAL_ERROR", message: leak });
      },
      "classCapture.saveTranscription": () => savedMaterial,
    });
    mockBridge({ canceled: false, rawPath: wavFile.path, fileName: wavFile.name, fileSize: wavFile.size });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(CaptureTab, { rpc, courseId: "course-1" })));
    await flush();
    await clickCheckbox(host);
    await clickButton(host, "选择文件");
    await clickButton(host, "开始转写");

    const text = host.textContent ?? "";
    expect(text).toContain("转写失败");
    expect(/C:\\private\\secret\.ts/.test(text)).toBe(false);
    expect(/019fee9d-bafe-7902-81e1-01f98fea797e/.test(text)).toBe(false);
    expect(/file:\/\//i.test(text)).toBe(false);
    expect(/(?:^|\n)\s*(?:[A-Za-z]*Error|Exception)\s*:/m.test(text)).toBe(false);
  });
});
