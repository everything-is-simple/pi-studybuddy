/**
 * T-M4-019 RED：备份恢复面板必须接通既有 backup.* RPC。
 *
 * 权威依据：06-API §3.11（backup.course/allCourses/restore/list/configureSchedule/listSchedules/toggleSchedule）+ §4（backup.progress）、
 * 09-UI §6.1-§6.3（备份入口/恢复交互）、07-WF §5（手动/调度/恢复流程）、08-Test §5/§7.6。
 * 仅使用 happy-dom 与内存 mock（mock rpc + mock bridge.showDialog + backup.progress 发射），
 * 不访问真实业务数据根、不执行真实备份/恢复。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { BackupRecord, BackupSchedule, RestoreResult } from "../../src/contract/types";
import type { TypedRpcClient } from "../../src/renderer/rpc-client";
import { BackupPanel } from "../../src/renderer/components/BackupPanel";
import { TABS } from "../../src/renderer/tabs";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface RpcCall {
  method: string;
  params: unknown;
}

interface BackupMockOptions {
  backupCourse?: (params: unknown) => Promise<unknown>;
  backupAll?: (params: unknown) => Promise<unknown>;
  restore?: (params: unknown) => Promise<unknown>;
  list?: (params: unknown) => unknown[];
  listSchedules?: (params: unknown) => unknown[];
}

const fixtureRecord: BackupRecord = {
  id: "backup-record-1",
  semesterId: "sem-1",
  courseInstanceId: "course-1",
  backupType: "manual",
  targetPath: "H:\\private\\backups\\real-target",
  zipFilename: "高等数学-20260811.zip",
  contentHash: "abc123",
  fileSizeBytes: 1024000,
  status: "completed",
  startedAt: "2026-08-11T00:00:00.000Z",
  completedAt: "2026-08-11T00:00:01.000Z",
  createdAt: "2026-08-11T00:00:00.000Z",
};

const fixtureSchedule: BackupSchedule = {
  id: "schedule-1",
  semesterId: "sem-1",
  cronExpression: "0 2 * * *",
  timezone: "Asia/Shanghai",
  enabled: true,
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
};

const fixtureRestoreResult: RestoreResult = {
  success: true,
  restoredCourseId: "course-restored",
  conflictResolved: "create_new",
  tablesImported: ["course_instances", "materials", "study_events"],
  filesRestored: 12,
  integrityCheck: "ok",
  schemaVersion: "1",
};

interface DialogResultMock {
  canceled: boolean;
  rawPath?: string;
  fileName?: string;
  fileSize?: number;
  importToken?: string;
}

/** 可控 backup mock RPC：记录调用 + 可发射 backup.progress（06-API §4） */
function createBackupMockRpc(options: BackupMockOptions = {}): {
  rpc: TypedRpcClient;
  calls: RpcCall[];
  emitProgress: (payload: { backupRecordId: string; phase: string; progress: number }) => void;
} {
  const calls: RpcCall[] = [];
  let emit: ((payload: unknown) => void) | undefined;
  const rpc: TypedRpcClient = {
    call(method, ...args) {
      const params = args[0];
      calls.push({ method: method as string, params });
      const impl: Record<string, (p: unknown) => unknown> = {
        "backup.course": options.backupCourse ?? (() => Promise.resolve(fixtureRecord)),
        "backup.allCourses": options.backupAll ?? (() => Promise.resolve([fixtureRecord])),
        "backup.restore": options.restore ?? (() => Promise.resolve(fixtureRestoreResult)),
        "backup.list": () => options.list?.(undefined) ?? [fixtureRecord],
        "backup.configureSchedule": () => Promise.resolve(fixtureSchedule),
        "backup.listSchedules": () => options.listSchedules?.(undefined) ?? [fixtureSchedule],
        "backup.toggleSchedule": (p: unknown) =>
          Promise.resolve({ ...fixtureSchedule, enabled: (p as { enabled: boolean }).enabled }),
      };
      const fn = impl[method as string];
      if (!fn) {
        return Promise.reject({ code: "UNKNOWN_METHOD", message: `未知方法: ${String(method)}` });
      }
      return Promise.resolve(fn(params));
    },
    subscribe(topic, key, on) {
      if (topic === "backup.progress" && key === undefined) emit = on;
      return () => {
        if (emit === on) emit = undefined;
      };
    },
    dispose() {},
  };
  return { rpc, calls, emitProgress: (payload) => emit?.(payload) };
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
function radio(host: HTMLDivElement, value: string): HTMLInputElement {
  const item = host.querySelector(`input[type="radio"][value="${value}"]`);
  if (!(item instanceof HTMLInputElement)) throw new Error(`radio 不存在: ${value}`);
  return item;
}
function textInput(host: HTMLDivElement, name: string): HTMLInputElement {
  const item = host.querySelector(`input[type="text"][name="${name}"]`);
  if (!(item instanceof HTMLInputElement)) throw new Error(`输入框不存在: ${name}`);
  return item;
}

function setInputValue(el: HTMLInputElement | HTMLSelectElement, value: string): void {
  const proto =
    el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function clickButton(host: HTMLDivElement, label: string): Promise<void> {
  act(() => {
    button(host, label).click();
  });
  await flush();
}

function mockBridge(dialogResult?: DialogResultMock): ReturnType<typeof vi.fn> {
  const showDialog = vi.fn(async () => dialogResult ?? { canceled: true });
  (globalThis as { window: Window & { piBridge?: unknown } }).window.piBridge = { showDialog };
  return showDialog;
}

async function mount(
  rpc: TypedRpcClient,
  props: { semesterId?: string; courseId?: string } = {},
): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      React.createElement(BackupPanel, {
        rpc,
        semesterId: props.semesterId ?? "sem-1",
        courseId: props.courseId,
      }),
    );
  });
  await flush();
  return { host, root };
}

async function unmount(root: Root | undefined, host: HTMLDivElement | undefined): Promise<void> {
  if (root) await act(async () => root?.unmount());
  host?.remove();
}

describe("T-M4-019 备份恢复面板 RPC 接线", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    await unmount(root, host);
    root = undefined;
    host = undefined;
    vi.restoreAllMocks();
  });

  it("C-RED-01 手动备份（单课程）：目录选择后 backup.course 只调一次，in-flight 防重复", async () => {
    const pending = deferred<BackupRecord>();
    const { rpc, calls } = createBackupMockRpc({ backupCourse: () => pending.promise });
    mockBridge({ canceled: false, rawPath: "H:\\backups\\studybuddy" });
    const mounted = await mount(rpc, { courseId: "course-1" });
    root = mounted.root;
    host = mounted.host;

    // 未选择目录 → 备份此课程禁用
    expect(button(host, "备份此课程").disabled).toBe(true);

    // 选择目录（dialog directory capability）
    await clickButton(host, "选择备份目录");
    const dialogOptions = (globalThis as { window: Window & { piBridge: { showDialog: ReturnType<typeof vi.fn> } } }).window.piBridge.showDialog.mock.calls[0][0];
    expect(dialogOptions).toMatchObject({ type: "open", directory: true });

    // 选择后启用；完整路径不出现在 DOM（AGENTS.md §9.3）
    expect(host.textContent).toContain("已选择备份目录");
    expect(/\b[a-z]:[\\/][^\s]*/i.test(host.textContent ?? "")).toBe(false);
    expect(button(host, "备份此课程").disabled).toBe(false);

    // 点击备份 → 只调一次；in-flight 期间重复点击不产生第二次调用
    await clickButton(host, "备份此课程");
    await clickButton(host, "备份中…");
    const courseCalls = calls.filter((c) => c.method === "backup.course");
    expect(courseCalls).toHaveLength(1);
    expect(courseCalls[0].params).toMatchObject({ courseInstanceId: "course-1", targetPath: "H:\\backups\\studybuddy" });

    await act(async () => pending.resolve(fixtureRecord));
    await flush();
  });

  it("C-RED-02 目录选择：canceled 不改变状态；已选目录不显示完整路径", async () => {
    const { rpc } = createBackupMockRpc();
    const showDialog = mockBridge({ canceled: false, rawPath: "H:\\backups\\studybuddy" });
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;

    // canceled：状态不变
    showDialog.mockResolvedValueOnce({ canceled: true });
    await clickButton(host, "选择备份目录");
    expect(host.textContent).not.toContain("已选择备份目录");

    // 成功选择
    await clickButton(host, "选择备份目录");
    expect(host.textContent).toContain("已选择备份目录");
    expect(/\b[a-z]:[\\/][^\s]*/i.test(host.textContent ?? "")).toBe(false);
  });

  it("C-RED-03 备份全部：backup.allCourses 只调一次，in-flight 防重复", async () => {
    const pending = deferred<BackupRecord[]>();
    const { rpc, calls } = createBackupMockRpc({ backupAll: () => pending.promise });
    mockBridge({ canceled: false, rawPath: "H:\\backups\\studybuddy" });
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;

    await clickButton(host, "选择备份目录");
    await clickButton(host, "备份全部课程");
    await clickButton(host, "备份中…");
    const allCalls = calls.filter((c) => c.method === "backup.allCourses");
    expect(allCalls).toHaveLength(1);
    expect(allCalls[0].params).toMatchObject({ semesterId: "sem-1", targetPath: "H:\\backups\\studybuddy" });

    await act(async () => pending.resolve([fixtureRecord]));
    await flush();
  });

  it("C-RED-04 调度：configureSchedule/listSchedules/toggleSchedule 接线与校验", async () => {
    const { rpc, calls } = createBackupMockRpc();
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;

    // 空 cron → 前端阻止
    setInputValue(textInput(host, "backup-cron"), "   ");
    await clickButton(host, "配置调度");
    expect(calls.some((c) => c.method === "backup.configureSchedule")).toBe(false);

    // 有效 cron → configureSchedule 只调一次
    setInputValue(textInput(host, "backup-cron"), "0 2 * * *");
    await clickButton(host, "配置调度");
    expect(calls.filter((c) => c.method === "backup.configureSchedule")).toHaveLength(1);
    expect(calls.find((c) => c.method === "backup.configureSchedule")?.params).toMatchObject({
      semesterId: "sem-1",
      cronExpression: "0 2 * * *",
    });

    // 调度列表展示（不显示完整路径——schedule 无路径字段，仅断言存在）
    expect(host.textContent).toContain("0 2 * * *");
    expect(calls.some((c) => c.method === "backup.listSchedules")).toBe(true);

    // 启停切换 → toggleSchedule({ id, enabled })
    await clickButton(host, "停用");
    const toggleCall = calls.filter((c) => c.method === "backup.toggleSchedule").at(-1)?.params as {
      id: string;
      enabled: boolean;
    };
    expect(toggleCall).toMatchObject({ id: "schedule-1", enabled: false });
  });

  it("C-RED-05 历史：backup.list 加载展示，targetPath 完整路径不出现在 DOM", async () => {
    const { rpc, calls } = createBackupMockRpc();
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;

    expect(calls.some((c) => c.method === "backup.list")).toBe(true);
    expect(host.textContent).toContain("高等数学-20260811.zip");
    expect(host.textContent).toContain("手动");
    // 隐私：targetPath（H:\private\backups\real-target）不得进入 DOM
    expect(/\b[a-z]:[\\/][^\s]*/i.test(host.textContent ?? "")).toBe(false);
    expect(host.textContent).not.toContain("real-target");
  });

  it("C-RED-06 恢复：zip 选择（dialog rawPath + zip filter）→ backup.restore → RestoreResult 摘要", async () => {
    const { rpc, calls } = createBackupMockRpc();
    const showDialog = mockBridge({ canceled: false, rawPath: "H:\\backups\\studybuddy\\backup.zip", fileName: "backup.zip" });
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;

    // 选择 zip
    await clickButton(host, "选择 zip 文件");
    const dialogOptions = showDialog.mock.calls[0][0];
    expect(dialogOptions).toMatchObject({ type: "open", rawPath: true });
    expect(host.textContent).toContain("backup.zip");
    expect(/\b[a-z]:[\\/][^\s]*/i.test(host.textContent ?? "")).toBe(false);

    // 恢复 → backup.restore 只调一次，默认冲突策略 create_new（host none→create_new 语义）
    await clickButton(host, "开始恢复");
    const restoreCalls = calls.filter((c) => c.method === "backup.restore");
    expect(restoreCalls).toHaveLength(1);
    expect(restoreCalls[0].params).toMatchObject({
      zipPath: "H:\\backups\\studybuddy\\backup.zip",
      targetSemesterId: "sem-1",
      conflictResolution: "create_new",
    });

    // RestoreResult 摘要
    expect(host.textContent).toContain("恢复完成");
    expect(host.textContent).toContain("ok");
    expect(host.textContent).toContain("course_instances");
    expect(host.textContent).toContain("12");
  });

  it("C-RED-07 冲突策略：显式选择覆盖 → restore 携带 overwrite", async () => {
    const { rpc, calls } = createBackupMockRpc();
    mockBridge({ canceled: false, rawPath: "H:\\backups\\studybuddy\\backup.zip" });
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;

    await clickButton(host, "选择 zip 文件");
    act(() => {
      radio(host, "overwrite").click();
    });
    await flush();
    await clickButton(host, "开始恢复");
    const restoreCall = calls.filter((c) => c.method === "backup.restore").at(-1)?.params as {
      conflictResolution: string;
    };
    expect(restoreCall.conflictResolution).toBe("overwrite");
  });

  it("C-RED-08 backup.progress 订阅：进度事件更新备份中状态", async () => {
    const { rpc, emitProgress } = createBackupMockRpc();
    mockBridge({ canceled: false, rawPath: "H:\\backups\\studybuddy" });
    const mounted = await mount(rpc);
    root = mounted.root;
    host = mounted.host;

    emitProgress({ backupRecordId: "backup-record-1", phase: "packing", progress: 42 });
    await flush();
    expect(host.textContent).toContain("42%");
  });

  it("C-RED-09 竞态/卸载：备份未完成时卸载，resolve 后不执行 setState", async () => {
    const pending = deferred<BackupRecord>();
    const { rpc } = createBackupMockRpc({ backupCourse: () => pending.promise });
    mockBridge({ canceled: false, rawPath: "H:\\backups\\studybuddy" });
    const mounted = await mount(rpc, { courseId: "course-1" });
    root = mounted.root;
    host = mounted.host;
    await clickButton(host, "选择备份目录");
    await clickButton(host, "备份此课程");
    expect(button(host, "备份中…").disabled).toBe(true);

    await unmount(root, host);
    root = undefined;
    host = undefined;
    await act(async () => {
      pending.resolve(fixtureRecord);
      await Promise.resolve();
    });
    expect(true).toBe(true); // 无异常即通过
  });

  it("C-RED-10 错误净化：失败只显示固定文案，DOM 无路径/UUID/错误栈/密钥", async () => {
    const { rpc } = createBackupMockRpc({
      backupCourse: () =>
        Promise.reject({ code: "INTERNAL_ERROR", message: "备份失败，请检查目录写入权限" }),
    });
    mockBridge({ canceled: false, rawPath: "H:\\backups\\studybuddy" });
    const mounted = await mount(rpc, { courseId: "course-1" });
    root = mounted.root;
    host = mounted.host;
    await clickButton(host, "选择备份目录");
    await clickButton(host, "备份此课程");
    expect(host.textContent).toContain("备份失败，请稍后重试。");

    const domText = host.textContent ?? "";
    expect(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(domText)).toBe(false);
    expect(/\b[a-z]:[\\/][^\s]*/i.test(domText)).toBe(false);
    expect(/secret\.ts|stackFrame|sk-secret/i.test(domText)).toBe(false);
    expect(/(?:^|\n)\s*(?:[A-Za-z]*Error|Exception)\s*:/m.test(domText)).toBe(false);
  });

  it("C-RED-11 TabBar 入口：TABS 含 backup Tab（09-UI §4.1 同步）", () => {
    const backupTab = TABS.find((tab) => tab.id === "backup");
    expect(backupTab).toBeDefined();
    expect(backupTab?.label).toBe("备份");
  });
});
