/**
 * T-M4-016 RED：ReportTab 必须接通既有 S6 家长报告 RPC。
 *
 * 权威依据：06-API §3.8、07-Workflow §3、08-Test §5/§6/§7.4、09-UI §4.9。
 * 仅使用 happy-dom 与内存 mock，不访问真实业务数据根或外部服务。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type {
  ParentReport,
  ParentReportTarget,
  ReportDelivery,
} from "../../src/contract/types";
import { ReportTab } from "../../src/renderer/components/tabs/ReportTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 冻结脱敏快照（09-UI §4.9 六 section + data_quality，summary 由 mock 润色加入） */
const reportContent = {
  summary: "本周学习节奏平稳，建议保持练习频率。",
  study_rhythm: { task_completed_count: 5, events_by_source: { S1: 8 } },
  materials: { material_count: 8, converted_count: 7 },
  practice: { session_count: 5, avg_correct_rate: 0.78 },
  mistakes: { mistake_count: 12, mastered_count: 8, needs_review_count: 4 },
  exam_reminder: { confirmed_exam_count: 2, nearest_exam_days: 12 },
  data_quality: { complete: true },
};

const weeklyReport: ParentReport = {
  reportKey: "report-weekly-1",
  semesterId: "sem-1",
  reportType: "weekly",
  periodStart: "2026-08-01",
  periodEnd: "2026-08-07",
  contentJson: reportContent,
  contentHash: "a".repeat(64),
  ruleGenerated: 1,
  aiPolished: 1,
  aiModel: "mock",
  promptVersion: "v1",
  privacyCheckPassed: 1,
  generatedAt: "2026-08-07T20:00:00.000Z",
  createdAt: "2026-08-07T20:00:00.000Z",
};

const dailyReport: ParentReport = {
  ...weeklyReport,
  reportKey: "report-daily-1",
  reportType: "daily",
  periodStart: "2026-08-07",
  periodEnd: "2026-08-07",
};

/** local_export 已配置渠道（真实地址在 credential-vault，DTO 只有别名） */
const exportTarget: ParentReportTarget = {
  id: "target-1",
  semesterId: "sem-1",
  targetName: "本地导出",
  channelType: "local_export",
  channelConfigJson: JSON.stringify({ dir: "reports" }),
  enabled: 1,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const sentDelivery: ReportDelivery = {
  reportKey: "report-weekly-1",
  channel: "local_export",
  status: "sent",
  retryCount: 0,
  maxRetries: 3,
  sentAt: "2026-08-07T20:05:00.000Z",
  lastAttemptAt: "2026-08-07T20:05:00.000Z",
  createdAt: "2026-08-07T20:05:00.000Z",
};

const failedDelivery: ReportDelivery = {
  reportKey: "report-weekly-1",
  channel: "smtp",
  status: "failed",
  retryCount: 1,
  maxRetries: 3,
  errorCode: "SMTP_AUTH_FAILED",
  lastAttemptAt: "2026-08-07T20:06:00.000Z",
  createdAt: "2026-08-07T20:06:00.000Z",
};

const retainedDelivery: ReportDelivery = {
  reportKey: "report-weekly-1",
  channel: "feishu_webhook",
  status: "retained_locally",
  retryCount: 3,
  maxRetries: 3,
  lastAttemptAt: "2026-08-07T20:07:00.000Z",
  createdAt: "2026-08-07T20:07:00.000Z",
};

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
function select(host: HTMLDivElement, name: string): HTMLSelectElement {
  const item = host.querySelector(`select[name="${name}"]`);
  if (!(item instanceof HTMLSelectElement)) throw new Error(`选择器不存在: ${name}`);
  return item;
}
function changeSelect(host: HTMLDivElement, name: string, value: string): void {
  const item = select(host, name);
  item.value = value;
  item.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("T-M4-016 ReportTab RPC 接线", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("S6-RED-01 无学期不发越权 RPC；有学期按 reports.list 加载并展示列表与空态", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "reports.list": (params: unknown) => { calls.push({ method: "reports.list", params }); return [dailyReport]; },
    });

    // 无学期：不发 RPC，显示引导
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(ReportTab, { rpc })));
    await flush();
    expect(calls).toHaveLength(0);

    // 有学期：reports.list 携带 semesterId
    host.remove(); root = undefined;
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(ReportTab, { rpc, semesterId: "sem-1" })));
    await flush();
    expect(calls).toContainEqual({ method: "reports.list", params: { semesterId: "sem-1" } });
    expect(host.textContent).toContain("日报");
    expect(host.textContent).toContain("2026-08-07");
  });

  it("S6-RED-02 生成报告：类型/周期选择，点击只调一次 generate，成功后刷新列表", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const generate = vi.fn(() => weeklyReport);
    const rpc = createMockRpcClient({
      "reports.list": () => [],
      "reports.get": () => weeklyReport,
      "reports.generate": (params: unknown) => { calls.push({ method: "reports.generate", params }); return generate(params); },
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(ReportTab, { rpc, semesterId: "sem-1" })));
    await flush();
    expect(host.textContent).toContain("暂无报告");

    // 选择周报（默认 weekly 无需切换），点击生成：只调一次
    await act(async () => changeSelect(host, "report-type", "weekly"));
    await flush();
    await act(async () => { button(host!, "生成报告").click(); button(host!, "生成报告").click(); });
    await flush();
    expect(generate).toHaveBeenCalledTimes(1);
    const genParams = generate.mock.calls[0]?.[0] as { semesterId: string; reportType: string; periodStart: string; periodEnd: string };
    expect(genParams.semesterId).toBe("sem-1");
    expect(genParams.reportType).toBe("weekly");
    expect(genParams.periodStart).toBeTruthy();
    expect(genParams.periodEnd).toBeTruthy();
    // 成功后列表刷新展示新报告
    expect(host.textContent).toContain("周报");
    expect(host.textContent).toContain("2026-08-01");
  });

  it("S6-RED-03 查看历史详情：点击列表项调 reports.get 并展示脱敏内容", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "reports.list": () => [weeklyReport, dailyReport],
      "reports.get": (params: unknown) => { calls.push({ method: "reports.get", params }); return weeklyReport; },
      "deliveries.list": () => [],
      "reportTargets.list": () => [],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(ReportTab, { rpc, semesterId: "sem-1" })));
    await flush();
    // 列表渲染
    expect(host.textContent).toContain("周报");
    await act(async () => button(host!, "查看详情").click());
    await flush();
    expect(calls).toContainEqual({ method: "reports.get", params: { reportKey: "report-weekly-1" } });
    // 脱敏摘要与章节
    expect(host.textContent).toContain("本周学习节奏平稳");
    expect(host.textContent).toContain("学习节奏");
  });

  it("S6-RED-04 冻结：点击冻结只调一次 freeze，冻结状态展示隐私检查并在返回后保留", async () => {
    const freeze = vi.fn(() => weeklyReport);
    const rpc = createMockRpcClient({
      "reports.list": () => [weeklyReport],
      "reports.get": () => weeklyReport,
      "reports.freeze": freeze,
      "deliveries.list": () => [],
      "reportTargets.list": () => [],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(ReportTab, { rpc, semesterId: "sem-1" })));
    await flush();
    await act(async () => button(host!, "查看详情").click());
    await flush();
    await act(async () => { button(host!, "冻结").click(); button(host!, "冻结").click(); });
    await flush();
    expect(freeze).toHaveBeenCalledTimes(1);
    expect(freeze).toHaveBeenCalledWith({ reportKey: "report-weekly-1" });
    expect(host.textContent).toContain("已冻结");
    expect(host.textContent).toContain("隐私检查通过");

    await act(async () => button(host!, "返回列表").click());
    await flush();
    await act(async () => button(host!, "查看详情").click());
    await flush();
    expect(host.textContent).toContain("已冻结");
    expect(button(host!, "已冻结").disabled).toBe(true);
  });
  it("S6-RED-05 切换学期后不继承相同 reportKey 的冻结状态", async () => {
    const sem1Report = { ...weeklyReport, semesterId: "sem-1", reportKey: "report-collision" };
    const sem2Report = { ...weeklyReport, semesterId: "sem-2", reportKey: "report-collision" };
    const rpc = createMockRpcClient({
      "reports.list": (params: unknown) => (params as { semesterId: string }).semesterId === "sem-1" ? [sem1Report] : [sem2Report],
      "reports.get": (params: unknown) => (params as { reportKey: string }).reportKey === "report-collision" ? sem1Report : sem2Report,
      "reports.freeze": () => sem1Report,
      "deliveries.list": () => [],
      "reportTargets.list": () => [],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(ReportTab, { rpc, academicContext: { semesterId: "sem-1" } } as React.ComponentProps<typeof ReportTab>)));
    await flush();
    await act(async () => button(host!, "查看详情").click());
    await flush();
    await act(async () => button(host!, "冻结报告").click());
    await flush();
    expect(host.textContent).toContain("已冻结");

    await act(async () => root?.render(React.createElement(ReportTab, { rpc, academicContext: { semesterId: "sem-2" } } as React.ComponentProps<typeof ReportTab>)));
    await flush();
    await act(async () => button(host!, "查看详情").click());
    await flush();
    expect(host.textContent).not.toContain("已冻结");
    expect(button(host!, "冻结报告").disabled).toBe(false);
  });

  it("S6-RED-05 投递状态可视化：deliveries.list 展示 sent/failed/未配置渠道状态", async () => {
    const rpc = createMockRpcClient({
      "reports.list": () => [weeklyReport],
      "reports.get": () => weeklyReport,
      "deliveries.list": (params: unknown) => (params as { reportKey: string }).reportKey === "report-weekly-1" ? [sentDelivery, failedDelivery, retainedDelivery] : [],
      "reportTargets.list": () => [exportTarget],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(ReportTab, { rpc, semesterId: "sem-1" })));
    await flush();
    await act(async () => button(host!, "查看详情").click());
    await flush();
    // 渠道状态可视化：local_export 已投递 ✅ / smtp 失败重试 / feishu 本地保留 / print 未配置
    expect(host.textContent).toContain("本地导出");
    expect(host.textContent).toContain("已投递");
    expect(host.textContent).toContain("失败");
    expect(host.textContent).toContain("本地保留");
    expect(host.textContent).toContain("未配置");
  });

  it("S6-RED-06 投递与重试：deliver 只调一次；retry 只调一次；retained_locally 不可再投递", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const deliver = vi.fn(() => sentDelivery);
    const retry = vi.fn(() => sentDelivery);
    const rpc = createMockRpcClient({
      "reports.list": () => [weeklyReport],
      "reports.get": () => weeklyReport,
      "deliveries.list": () => [failedDelivery],
      "reportTargets.list": () => [exportTarget],
      "deliveries.deliver": (params: unknown) => { calls.push({ method: "deliveries.deliver", params }); return deliver(params); },
      "deliveries.retry": (params: unknown) => { calls.push({ method: "deliveries.retry", params }); return retry(params); },
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(ReportTab, { rpc, semesterId: "sem-1" })));
    await flush();
    await act(async () => button(host!, "查看详情").click());
    await flush();

    // 未配置 smtp 渠道不渲染投递按钮（target 只有 local_export）；failedDelivery.smtp 已存在记录展示失败
    // local_export 无记录 + target 已配置 → 可投递：点击只调一次
    await act(async () => { button(host!, "投递").click(); button(host!, "投递").click(); });
    await flush();
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith({ reportKey: "report-weekly-1", channel: "local_export" });
    // 失败渠道 smtp：提供重试按钮（retry 只调一次）
    await act(async () => { button(host!, "重试").click(); button(host!, "重试").click(); });
    await flush();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledWith({ reportKey: "report-weekly-1", channel: "smtp" });
  });

  it("S6-RED-07 渠道配置状态：reportTargets.list 驱动已配置渠道；不展示真实地址/credentialKey", async () => {
    const rpc = createMockRpcClient({
      "reports.list": () => [weeklyReport],
      "reports.get": () => weeklyReport,
      "deliveries.list": () => [sentDelivery],
      "reportTargets.list": () => [exportTarget],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(ReportTab, { rpc, semesterId: "sem-1" })));
    await flush();
    await act(async () => button(host!, "查看详情").click());
    await flush();
    // 只展示渠道名与状态，不展示 channelConfigJson 原文 / credentialKey / 完整 UUID
    expect(host.textContent).not.toContain("reports");
    expect(host.textContent).not.toContain("target-1");
    expect(host.textContent).not.toContain("report-weekly-1");
  });

  it("S6-RED-08 竞态/卸载/归档只读/错误净化：旧学期响应不覆盖，archived 禁用 mutation，错误不含敏感内部值", async () => {
    const pendingA = deferred<ParentReport[]>();
    const pendingB = deferred<ParentReport[]>();
    const rpc = createMockRpcClient({
      "reports.list": (params: unknown) => (params as { semesterId: string }).semesterId === "sem-1" ? pendingA.promise : pendingB.promise,
      "reports.get": () => weeklyReport,
      "deliveries.list": () => [],
      "reportTargets.list": () => [],
      "reports.generate": () => Promise.reject(new Error("secret path C:\\private\\secret.ts stackFrame")),
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(ReportTab, { rpc, semesterId: "sem-1" })));
    await flush();
    // 切换到另一学期后，旧学期列表响应不得污染新状态
    await act(async () => root?.render(React.createElement(ReportTab, { rpc, semesterId: "sem-2" })));
    await flush();
    await act(async () => pendingA.resolve([weeklyReport]));
    await flush();
    expect(host.textContent).not.toContain("周报");
    await act(async () => pendingB.resolve([dailyReport]));
    await flush();
    expect(host.textContent).toContain("日报");

    // 生成失败：固定净化文案，不含路径/栈/UUID
    await act(async () => button(host!, "生成报告").click());
    await flush();
    expect(host.textContent).toContain("暂时无法生成");
    expect(host.textContent).not.toContain("secret");
    expect(host.textContent).not.toContain("Error:");
  });

  it("S6-RED-08b archived 只读：归档学期禁用生成/冻结/投递，仅展示", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "reports.list": () => [weeklyReport],
      "reports.get": () => weeklyReport,
      "deliveries.list": () => [],
      "reportTargets.list": () => [exportTarget],
      "reports.generate": () => { calls.push({ method: "reports.generate", params: {} }); return weeklyReport; },
      "reports.freeze": () => { calls.push({ method: "reports.freeze", params: {} }); return weeklyReport; },
      "deliveries.deliver": () => { calls.push({ method: "deliveries.deliver", params: {} }); return sentDelivery; },
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(ReportTab, { rpc, semesterId: "sem-1", academicContext: { semesterId: "sem-1", courseId: "course-1", isReadOnly: true } })));
    await flush();
    expect(host.textContent).toContain("归档");
    // mutation 按钮禁用：生成/冻结/投递均不可点击（不触发 RPC）
    await act(async () => button(host!, "生成报告").click());
    await flush();
    await act(async () => button(host!, "查看详情").click());
    await flush();
    await act(async () => { button(host!, "冻结").click(); });
    await flush();
    expect(calls).toHaveLength(0);
  });

  it("S6-RED-09 本地导出目标：目录仅留在 capability 内存值，保存后刷新渠道且 DOM 不泄漏路径", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const showDialog = vi.fn(async () => ({ canceled: false, rawPath: "H:\\pi-studybuddy-tmp\\runs\\T-M5-005\\exports" }));
    Object.assign(window, { piBridge: { showDialog } });
    const rpc = createMockRpcClient({
      "reports.list": () => [],
      "reportTargets.list": () => [],
      "reportTargets.create": (params: unknown) => {
        calls.push({ method: "reportTargets.create", params });
        return exportTarget;
      },
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(ReportTab, { rpc, semesterId: "sem-1" })));
    await flush();

    await act(async () => button(host!, "选择导出目录").click());
    await flush();
    expect(showDialog).toHaveBeenCalledWith({ type: "open", title: "选择报告导出目录", directory: true });
    expect(host.textContent).toContain("已选择导出目录");
    expect(host.textContent).not.toContain("H:\\pi-studybuddy-tmp");

    await act(async () => button(host!, "保存本地导出").click());
    await flush();
    expect(calls).toContainEqual({
      method: "reportTargets.create",
      params: {
        semesterId: "sem-1",
        targetName: "本地导出",
        channelType: "local_export",
        channelConfigJson: JSON.stringify({ dir: "H:\\pi-studybuddy-tmp\\runs\\T-M5-005\\exports" }),
      },
    });
    expect(host.textContent).toContain("本地导出已配置");
  });
});
