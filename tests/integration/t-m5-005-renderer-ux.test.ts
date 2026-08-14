/**
 * T-M5-005 RED：可见文字的朗读入口及危险恢复确认。
 *
 * 权威依据：07-Workflow §4.1/§4.2（任何 Markdown/纯文本可触发，明确包括
 * S5 速背卡）与 09-UI §6.2（覆盖恢复必须有确认/取消边界）。
 * 只使用 happy-dom 和内存 RPC；不访问生产数据或外部服务。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { PiBridge } from "../../src/contract/desktop";
import type { CramCard, FileMeta, ParentReport } from "../../src/contract/types";
import type { TypedRpcClient } from "../../src/renderer/rpc-client";
import { BackupPanel } from "../../src/renderer/components/BackupPanel";
import { CaptureTab } from "../../src/renderer/components/tabs/CaptureTab";
import { CramTab } from "../../src/renderer/components/tabs/CramTab";
import { ReportTab } from "../../src/renderer/components/tabs/ReportTab";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type BridgeWindow = Window & { piBridge?: Pick<PiBridge, "showDialog"> };

const card: CramCard = {
  moduleId: "module-1",
  moduleName: "极限与连续",
  coreConcept: "ε-δ 定义",
  keyPoints: ["任意性", "存在性"],
  mnemonic: "任意小存在大",
  importance: 5,
};

const audio: FileMeta = {
  name: "课堂录音.wav",
  size: 1024,
  mime: "audio/wav",
  path: "H:\\private\\课堂录音.wav",
};

const report: ParentReport = {
  reportKey: "report-1",
  semesterId: "semester-1",
  reportType: "weekly",
  periodStart: "2026-08-01",
  periodEnd: "2026-08-07",
  contentJson: {
    summary: "本周学习节奏平稳。",
    sections: [{ title: "学习节奏", content: "任务完成 5 项" }],
  },
  contentHash: "a".repeat(64),
  ruleGenerated: 1,
  aiPolished: 0,
  privacyCheckPassed: 1,
  generatedAt: "2026-08-07T20:00:00.000Z",
  createdAt: "2026-08-07T20:00:00.000Z",
};

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function button(host: HTMLDivElement, label: string): HTMLButtonElement {
  const item = Array.from(host.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(label));
  if (!(item instanceof HTMLButtonElement)) throw new Error(`按钮不存在：${label}`);
  return item;
}

async function mount(element: React.ReactElement): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  await flush();
  return { host, root };
}

async function click(host: HTMLDivElement, label: string): Promise<void> {
  act(() => button(host, label).click());
  await flush();
}

describe("T-M5-005 文字内容朗读入口", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
    vi.restoreAllMocks();
  });

  it("S5 速背卡将当前卡片的净化文字交给既有 TTS 回调", async () => {
    const onSpeakText = vi.fn();
    ({ root, host } = await mount(React.createElement(CramTab, { subTab: "speedCards", cards: [card], onSpeakText })));

    await click(host!, "朗读速背卡");

    expect(onSpeakText).toHaveBeenCalledTimes(1);
    expect(onSpeakText.mock.calls[0][0]).toContain("极限与连续");
    expect(onSpeakText.mock.calls[0][0]).toContain("ε-δ 定义");
    expect(onSpeakText.mock.calls[0][0]).toContain("任意性、存在性");
    expect(onSpeakText.mock.calls[0][1]).toMatchObject({ title: "速背卡" });
  });

  it("S7 已有转写文本提供朗读，且不把录音绝对路径交给回调", async () => {
    const onSpeakText = vi.fn();
    ({ root, host } = await mount(React.createElement(CaptureTab, {
      permissionConfirmed: true,
      selectedFile: audio,
      transcription: "今天复习极限的 ε-δ 定义。",
      onSpeakText,
    })));

    await click(host!, "朗读转写结果");

    expect(onSpeakText).toHaveBeenCalledWith("今天复习极限的 ε-δ 定义。", { title: "课堂转写" });
    expect(onSpeakText.mock.calls[0][0]).not.toContain("H:\\private");
  });

  it("S6 脱敏报告详情提供朗读，且只提交已展示的聚合文字", async () => {
    const onSpeakText = vi.fn();
    ({ root, host } = await mount(React.createElement(ReportTab, { selectedReport: report, onSpeakText })));

    await click(host!, "朗读报告");

    expect(onSpeakText).toHaveBeenCalledTimes(1);
    expect(onSpeakText.mock.calls[0][0]).toContain("本周学习节奏平稳。");
    expect(onSpeakText.mock.calls[0][0]).toContain("任务完成 5 项");
    expect(onSpeakText.mock.calls[0][1]).toMatchObject({ title: "家长报告" });
  });
});

describe("T-M5-005 覆盖恢复确认", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
    delete (window as BridgeWindow).piBridge;
    vi.restoreAllMocks();
  });

  it("覆盖已有数据先显示后果、允许取消，且只在明确确认后调用既有 backup.restore", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc: TypedRpcClient = {
      call(method, ...args) {
        calls.push({ method: method as string, params: args[0] });
        if (method === "backup.list" || method === "backup.listSchedules") return Promise.resolve([]) as never;
        if (method === "backup.restore") return Promise.resolve({ success: true, restoredCourseId: "course-1", conflictResolved: "overwrite", tablesImported: [], filesRestored: 0, integrityCheck: "ok" }) as never;
        return Promise.resolve(undefined) as never;
      },
      subscribe: () => () => {},
      dispose: () => {},
    };
    (window as BridgeWindow).piBridge = {
      showDialog: vi.fn(async () => ({ canceled: false, rawPath: "H:\\private\\backup.zip", fileName: "backup.zip" })),
    };
    ({ root, host } = await mount(React.createElement(BackupPanel, { rpc, semesterId: "semester-1" })));

    await click(host!, "选择 zip 文件");
    const overwrite = host!.querySelector('input[type="radio"][value="overwrite"]');
    if (!(overwrite instanceof HTMLInputElement)) throw new Error("缺少覆盖策略");
    act(() => overwrite.click());
    await flush();

    await click(host!, "开始恢复");
    expect(calls.filter((call) => call.method === "backup.restore")).toHaveLength(0);
    expect(host!.textContent).toContain("覆盖会替换现有课程数据");
    expect(host!.textContent).toContain("确认覆盖");
    expect(host!.textContent).toContain("取消");

    await click(host!, "取消");
    expect(calls.filter((call) => call.method === "backup.restore")).toHaveLength(0);

    await click(host!, "开始恢复");
    await click(host!, "确认覆盖");
    expect(calls.filter((call) => call.method === "backup.restore")).toHaveLength(1);
    expect(calls.find((call) => call.method === "backup.restore")?.params).toMatchObject({ conflictResolution: "overwrite" });
  });
});
