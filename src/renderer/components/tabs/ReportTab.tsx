/**
 * ReportTab 报告 Tab（T-M2-008 静态壳 + T-M4-016 S6 RPC 接线；09-UI §4.9）
 *
 * S6 家长报告学生侧：生成入口（类型/周期选择）+ 历史列表 + 详情展示（脱敏）+ 冻结 +
 * 投递状态可视化（sent ✅ / failed ✗ 重试 / retained_locally / 未配置 ─）+ 投递/重试。
 *
 * T-M4-016 仅复用既有 S6 RPC（reports.list/generate/freeze/get、deliveries.list/deliver/retry、
 * reportTargets.list）与 AppShell 唯一学期上下文；不新增 API、handler、schema 或跨 Tab 状态。
 *
 * §7.2 隐私边界：报告内容 contentJson 是冻结脱敏快照（6 section + data_quality），
 *   UI 不展示完整 UUID、真实渠道地址、channelConfigJson 原文或 credentialKey。
 * §7.4 规则生成：ruleGenerated=1 表示规则生成，非 AI，UI 不展示 AI 标记。
 * §7.5 单机零云：投递渠道仅 local_export（其他渠道 mock，状态可视化不连真实服务）。
 * §11.1 隐私边界：所有 ID 走 ShortId 组件（不展示完整 UUID）。
 */
import React from "react";
import type { TypedRpcClient } from "../../rpc-client";
import type { SemesterCourseContext } from "../../semester-course-state";
import { useTabData } from "./useTabData";
import type {
  ParentReport,
  ParentReportTarget,
  ParentReportType,
  ReportChannel,
  ReportDelivery,
} from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";
import { ShortId } from "../common/ShortId";

interface Props {
  /** 报告列表（静态渲染兼容） */
  reports?: ParentReport[];
  /** 选中的报告详情（静态渲染兼容） */
  selectedReport?: ParentReport;
  /** RPC 客户端（运行时交互用） */
  rpc?: TypedRpcClient;
  /** 学期 ID */
  semesterId?: string;
  /** AppShell 唯一学术上下文（兼容旧的扁平 props） */
  academicContext?: SemesterCourseContext;
  /** 复用 AppShell 已有 TTS 播放态，不另建跨 Tab 状态。 */
  onSpeakText?: (text: string, target?: { title?: string }) => void;
}

/** 报告类型中文标签 */
function reportTypeLabel(type: ParentReportType): string {
  switch (type) {
    case "daily":
      return "日报";
    case "weekly":
      return "周报";
    case "monthly":
      return "月报";
    case "exam_reminder":
      return "考试提醒";
    default:
      return type;
  }
}

/** 投递渠道中文标签 */
function channelLabel(channel: ReportChannel): string {
  switch (channel) {
    case "local_export":
      return "本地导出";
    case "smtp":
      return "邮件";
    case "feishu_webhook":
      return "飞书";
    case "print":
      return "打印";
    default:
      return channel;
  }
}

/** 报告内容结构（contentJson 解析：sections 或 RuleReport 6 section） */
interface ReportSection {
  title: string;
  content: string;
}

/** RuleReport 聚合节 → 文本（只展示脱敏聚合，绝不包含原文/题干/答案/错因/UUID） */
function ruleReportSections(json: Record<string, unknown>): ReportSection[] {
  const sections: ReportSection[] = [];
  const rhythm = json.study_rhythm as Record<string, unknown> | undefined;
  if (rhythm) {
    sections.push({
      title: "学习节奏",
      content: `任务完成 ${rhythm.task_completed_count ?? 0} 项`,
    });
  }
  const materials = json.materials as Record<string, unknown> | undefined;
  if (materials) {
    sections.push({
      title: "资料整理",
      content: `资料 ${materials.material_count ?? 0} 份，已生成笔记 ${materials.converted_count ?? 0} 份`,
    });
  }
  const practice = json.practice as Record<string, unknown> | undefined;
  if (practice) {
    const rate = typeof practice.avg_correct_rate === "number" ? Math.round(practice.avg_correct_rate * 100) : 0;
    sections.push({
      title: "练习表现",
      content: `完成练习 ${practice.session_count ?? 0} 次，平均正确率 ${rate}%`,
    });
  }
  const mistakes = json.mistakes as Record<string, unknown> | undefined;
  if (mistakes) {
    sections.push({
      title: "错题情况",
      content: `错题 ${mistakes.mistake_count ?? 0} 道（已掌握 ${mistakes.mastered_count ?? 0} / 待复习 ${mistakes.needs_review_count ?? 0}）`,
    });
  }
  const exam = json.exam_reminder as Record<string, unknown> | undefined;
  if (exam) {
    sections.push({
      title: "考试提醒",
      content: `已确认考试 ${exam.confirmed_exam_count ?? 0} 场，最近考试还有 ${exam.nearest_exam_days ?? "-"} 天`,
    });
  }
  const quality = json.data_quality as Record<string, unknown> | undefined;
  if (quality) {
    sections.push({
      title: "数据质量",
      content: quality.complete ? "数据完整，无遗漏" : "部分数据不完整",
    });
  }
  return sections;
}

/** 解析 contentJson 为 { summary, sections }（兼容旧 sections 结构与 RuleReport 6 section） */
function parseContent(contentJson: unknown): { summary?: string; sections: ReportSection[] } {
  if (typeof contentJson !== "object" || contentJson === null) return { sections: [] };
  const json = contentJson as Record<string, unknown>;
  const summary = typeof json.summary === "string" ? json.summary : undefined;
  const rawSections = json.sections;
  if (Array.isArray(rawSections)) {
    const sections = rawSections
      .filter((item): item is { title: string; content: string } =>
        typeof item === "object" && item !== null && typeof (item as { title?: unknown }).title === "string" && typeof (item as { content?: unknown }).content === "string")
      .map((item) => ({ title: item.title, content: item.content }));
    if (sections.length > 0) return { summary, sections };
  }
  const ruleSections = ruleReportSections(json);
  return { summary, sections: ruleSections };
}

function safeReportText(value: string | undefined, fallback: string, maxLength = 300): string {
  const text = value?.trim() ?? "";
  const hasUuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(text);
  const hasPath =
    /[a-z]:[\\/]/i.test(text) ||
    /\\\\/.test(text) ||
    /\bfile:\s*\/{1,3}/i.test(text) ||
    /\/(?:[^\s/]+\/)+[^\s/]+/.test(text) ||
    /\bhttps?:\/\//i.test(text);
  const hasStackOrSecret =
    /\bbearer\b/i.test(text) ||
    /\b(?:[A-Za-z]*Error|Exception)\s*:/i.test(text) ||
    /\bat\s+\S+/i.test(text) ||
    /\b(?:api[_ -]?key|token|secret)\s*[:=]/i.test(text);
  if (!text || hasUuid || hasPath || hasStackOrSecret) return fallback;
  return text.slice(0, maxLength);
}

/** 只朗读详情页已经过相同净化规则处理的脱敏聚合内容。 */
function reportSpeechText(content: { summary?: string; sections: ReportSection[] }): string {
  return [
    content.summary ? safeReportText(content.summary, "内容已隐藏。") : "",
    ...content.sections.map((section) => `${safeReportText(section.title, "报告章节")}：${safeReportText(section.content, "内容已隐藏。")}`),
  ].filter(Boolean).join("。 ");
}

/** 不显示 RPC 原始异常，避免 UUID、绝对路径和堆栈进入 renderer。 */
function reportErrorText(action: "list" | "generate" | "get" | "freeze" | "deliver" | "retry" | "targets"): string {
  switch (action) {
    case "list": return "暂时无法加载报告，请稍后重试。";
    case "generate": return "暂时无法生成报告，请稍后重试。";
    case "get": return "暂时无法读取报告详情，请稍后重试。";
    case "freeze": return "暂时无法冻结报告，请稍后重试。";
    case "deliver": return "暂时无法投递报告，请稍后重试。";
    case "retry": return "暂时无法重试投递，请稍后重试。";
    case "targets": return "暂时无法加载投递渠道，请稍后重试。";
  }
}

function todayIsoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

const PANEL_STYLE: React.CSSProperties = {
  padding: 12,
  border: "1px solid var(--border, #e0e0e0)",
  borderRadius: 4,
  marginBottom: 8,
};

/** 渠道状态可视化：sent ✅ / failed ✗（重试）/ retained_locally / 未配置 ─ */
function channelStatusLabel(status: ReportDelivery["status"]): string {
  switch (status) {
    case "sent": return "已投递 ✅";
    case "failed": return "失败 ✗（可重试）";
    case "retained_locally": return "本地保留（已达重试上限）";
    case "pending": return "投递中…";
  }
}

function RuntimeReportTab({ rpc, semesterId, academicContext, onSpeakText }: {
  rpc: TypedRpcClient;
  semesterId?: string;
  academicContext?: SemesterCourseContext;
  onSpeakText?: (text: string, target?: { title?: string }) => void;
}): React.JSX.Element {
  const effectiveSemesterId = academicContext?.semesterId ?? semesterId;
  const isReadOnly = academicContext?.isReadOnly === true;
  const [reportType, setReportType] = React.useState<ParentReportType>("weekly");
  const [periodStart, setPeriodStart] = React.useState(todayIsoDate(-6));
  const [periodEnd, setPeriodEnd] = React.useState(todayIsoDate(0));
  const [selectedReportKey, setSelectedReportKey] = React.useState<string | undefined>();
  const [listToken, setListToken] = React.useState(0);
  const [deliveryToken, setDeliveryToken] = React.useState(0);
  const [actionError, setActionError] = React.useState<string | undefined>();
  const [frozen, setFrozen] = React.useState(false);
  const mountedRef = React.useRef(true);
  const contextVersionRef = React.useRef(0);
  const generateInFlightRef = React.useRef(false);
  const freezeInFlightRef = React.useRef(false);
  const deliverInFlightRef = React.useRef(false);
  const retryInFlightRef = React.useRef(false);

  const reportsResource = useTabData<ParentReport[]>({
    rpc,
    key: `reports:${effectiveSemesterId ?? ""}:${listToken}`,
    enabled: Boolean(effectiveSemesterId),
    initialData: [],
    load: (client) => client.call("reports.list", { semesterId: effectiveSemesterId! }),
  });
  const detailResource = useTabData<ParentReport | undefined>({
    rpc,
    key: `report-detail:${effectiveSemesterId ?? ""}:${selectedReportKey ?? ""}`,
    enabled: Boolean(effectiveSemesterId && selectedReportKey),
    initialData: undefined,
    load: (client) => client.call("reports.get", { reportKey: selectedReportKey! }),
    isEmpty: (value) => value == null,
  });
  const deliveriesResource = useTabData<ReportDelivery[]>({
    rpc,
    key: `report-deliveries:${effectiveSemesterId ?? ""}:${selectedReportKey ?? ""}:${deliveryToken}`,
    enabled: Boolean(effectiveSemesterId && selectedReportKey),
    initialData: [],
    load: (client) => client.call("deliveries.list", { reportKey: selectedReportKey! }),
  });
  const targetsResource = useTabData<ParentReportTarget[]>({
    rpc,
    key: `report-targets:${effectiveSemesterId ?? ""}`,
    enabled: Boolean(effectiveSemesterId),
    initialData: [],
    load: (client) => client.call("reportTargets.list", { semesterId: effectiveSemesterId! }),
  });

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      contextVersionRef.current += 1;
    };
  }, []);

  React.useEffect(() => {
    contextVersionRef.current += 1;
    setSelectedReportKey(undefined);
    setActionError(undefined);
    setFrozen(false);
    generateInFlightRef.current = false;
    freezeInFlightRef.current = false;
    deliverInFlightRef.current = false;
    retryInFlightRef.current = false;
  }, [effectiveSemesterId]);

  function openDetail(report: ParentReport): void {
    contextVersionRef.current += 1;
    setSelectedReportKey(report.reportKey);
    setActionError(undefined);
    setFrozen(false);
  }

  function backToList(): void {
    setSelectedReportKey(undefined);
    setActionError(undefined);
  }

  function generateReport(): void {
    if (!effectiveSemesterId || isReadOnly || generateInFlightRef.current) return;
    generateInFlightRef.current = true;
    const contextVersion = contextVersionRef.current;
    setActionError(undefined);
    void rpc.call("reports.generate", {
      semesterId: effectiveSemesterId,
      reportType,
      periodStart,
      periodEnd,
    })
      .then((report) => {
        generateInFlightRef.current = false;
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setListToken((token) => token + 1);
        setActionError(undefined);
        openDetail(report);
      })
      .catch(() => {
        generateInFlightRef.current = false;
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setActionError(reportErrorText("generate"));
      });
  }

  function freezeReport(): void {
    if (!selectedReportKey || isReadOnly || freezeInFlightRef.current) return;
    freezeInFlightRef.current = true;
    const contextVersion = contextVersionRef.current;
    setActionError(undefined);
    void rpc.call("reports.freeze", { reportKey: selectedReportKey })
      .then((report) => {
        freezeInFlightRef.current = false;
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setFrozen(true);
        setActionError(undefined);
        // 刷新详情以展示冻结后状态（privacyCheckPassed）
        setListToken((token) => token + 1);
        setSelectedReportKey(report.reportKey);
      })
      .catch(() => {
        freezeInFlightRef.current = false;
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setActionError(reportErrorText("freeze"));
      });
  }

  function deliverReport(channel: ReportChannel): void {
    if (!selectedReportKey || isReadOnly || deliverInFlightRef.current) return;
    deliverInFlightRef.current = true;
    const contextVersion = contextVersionRef.current;
    setActionError(undefined);
    void rpc.call("deliveries.deliver", { reportKey: selectedReportKey, channel })
      .then(() => {
        deliverInFlightRef.current = false;
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setDeliveryToken((token) => token + 1);
        setActionError(undefined);
      })
      .catch(() => {
        deliverInFlightRef.current = false;
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setActionError(reportErrorText("deliver"));
      });
  }

  function retryDelivery(channel: ReportChannel): void {
    if (!selectedReportKey || isReadOnly || retryInFlightRef.current) return;
    retryInFlightRef.current = true;
    const contextVersion = contextVersionRef.current;
    setActionError(undefined);
    void rpc.call("deliveries.retry", { reportKey: selectedReportKey, channel })
      .then(() => {
        retryInFlightRef.current = false;
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setDeliveryToken((token) => token + 1);
        setActionError(undefined);
      })
      .catch(() => {
        retryInFlightRef.current = false;
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setActionError(reportErrorText("retry"));
      });
  }

  if (!effectiveSemesterId) {
    return <TabContainer><div role="status">请先在左侧选择学期，再使用家长报告。</div></TabContainer>;
  }

  // ---- 详情视图 ----
  if (selectedReportKey) {
    const detail = detailResource.data;
    if (detailResource.status === "loading" || detailResource.status === "idle") {
      return <TabContainer><div role="status">正在加载报告详情…</div></TabContainer>;
    }
    if (detailResource.status === "error" || !detail) {
      return (
        <TabContainer>
          <div role="alert">{reportErrorText("get")}</div>
          <button type="button" style={{ marginTop: 12, padding: "6px 16px", fontSize: 13, cursor: "pointer" }} onClick={backToList}>返回报告列表</button>
        </TabContainer>
      );
    }

    const content = parseContent(detail.contentJson);
    const deliveries = deliveriesResource.data;
    const targets = targetsResource.data;

    // 渠道展示集合：已配置渠道 ∪ 有投递记录的渠道（保持 09-UI §4.9 渠道行语义）
    const channels = new Set<ReportChannel>();
    for (const target of targets) channels.add(target.channelType);
    for (const delivery of deliveries) channels.add(delivery.channel);
    // 固定四渠道顺序展示（未配置渠道显示 ─）
    const orderedChannels: ReportChannel[] = ["local_export", "smtp", "feishu_webhook", "print"];
    const displayChannels = orderedChannels.filter((channel) => channels.has(channel) || orderedChannels.includes(channel));

    return (
      <TabContainer>
        {/* 返回 + 生成入口 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>
            {reportTypeLabel(detail.reportType)} · {detail.periodStart} ~ {detail.periodEnd}
          </h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={{ padding: "4px 12px", fontSize: 12, cursor: "pointer", border: "1px solid var(--border, #e0e0e0)", background: "var(--bg-panel, #f5f5f5)", borderRadius: 4 }} onClick={backToList}>返回列表</button>
          </div>
        </div>

        {/* 元信息 */}
        <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 12, color: "var(--text-muted, #888)" }}>
          <span>ID: <ShortId id={detail.reportKey} /></span>
          <span>生成时间：{detail.generatedAt.slice(0, 16).replace("T", " ")}</span>
          {detail.privacyCheckPassed === 1 && <span style={{ color: "#2e7d32" }}>隐私检查通过</span>}
        </div>

        {/* 摘要 */}
        {content.summary && (
          <div style={PANEL_STYLE}>
            <strong>摘要：</strong>
            <span>{safeReportText(content.summary, "内容已隐藏。")}</span>
          </div>
        )}

        {/* 报告章节（脱敏聚合） */}
        {content.sections.length > 0 && (
          <div>
            {content.sections.map((section, idx) => (
              <div key={idx} style={PANEL_STYLE}>
                <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>{section.title}</h3>
                <div style={{ fontSize: 13 }}>{safeReportText(section.content, "内容已隐藏。")}</div>
              </div>
            ))}
          </div>
        )}
        <button type="button" disabled={!onSpeakText || !reportSpeechText(content)} onClick={() => onSpeakText?.(reportSpeechText(content), { title: "家长报告" })} style={{ padding: "4px 12px", fontSize: 12 }}>朗读报告</button>

        {/* 冻结入口 */}
        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <button
            type="button"
            disabled={isReadOnly || frozen}
            style={{
              padding: "6px 16px", fontSize: 13, cursor: isReadOnly || frozen ? "not-allowed" : "pointer",
              border: "1px solid var(--border, #e0e0e0)", background: isReadOnly || frozen ? "#9e9e9e" : "#1976d2",
              color: "#fff", borderRadius: 4, opacity: isReadOnly || frozen ? 0.7 : 1,
            }}
            onClick={freezeReport}
          >
            {frozen ? "已冻结" : "冻结报告"}
          </button>
          {isReadOnly && <span role="status" style={{ marginLeft: 8, fontSize: 12, color: "#c62828" }}>当前学期已归档，只读查看。</span>}
        </div>

        {/* 投递状态可视化 */}
        <h3 style={{ fontSize: 14, margin: "16px 0 8px 0" }}>投递渠道</h3>
        {targetsResource.status === "error" && <div role="alert" style={{ fontSize: 13, color: "#c62828" }}>{reportErrorText("targets")}</div>}
        <div>
          {displayChannels.map((channel) => {
            const delivery = deliveries.find((item) => item.channel === channel);
            const target = targets.find((item) => item.channelType === channel && item.enabled === 1);
            const isConfigured = Boolean(target) || Boolean(delivery);
            const status = delivery?.status;
            return (
              <div key={channel} style={PANEL_STYLE}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{channelLabel(channel)}</span>
                  {!isConfigured && <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>未配置 ─</span>}
                  {isConfigured && status && (
                    <span style={{ fontSize: 12, color: status === "sent" ? "#2e7d32" : status === "failed" ? "#c62828" : "#f9a825" }}>
                      {channelStatusLabel(status)}
                      {delivery?.retryCount ? `（重试 ${delivery.retryCount}/${delivery.maxRetries}）` : ""}
                    </span>
                  )}
                  {isConfigured && !status && <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>未投递</span>}
                  {isConfigured && !status && (
                    <button type="button" disabled={isReadOnly} style={{ padding: "4px 12px", fontSize: 12, cursor: isReadOnly ? "not-allowed" : "pointer", border: "1px solid var(--border, #e0e0e0)", background: "var(--bg-panel, #f5f5f5)", borderRadius: 4 }} onClick={() => deliverReport(channel)}>投递</button>
                  )}
                  {status === "failed" && (
                    <button type="button" disabled={isReadOnly} style={{ padding: "4px 12px", fontSize: 12, cursor: isReadOnly ? "not-allowed" : "pointer", border: "1px solid var(--border, #e0e0e0)", background: "var(--bg-panel, #f5f5f5)", borderRadius: 4 }} onClick={() => retryDelivery(channel)}>重试</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {actionError && <p role="alert" style={{ color: "#c62828", fontSize: 13 }}>{actionError}</p>}
      </TabContainer>
    );
  }

  // ---- 列表视图 ----
  if (reportsResource.status === "loading") {
    return <TabContainer><div role="status">正在加载报告…</div></TabContainer>;
  }
  if (reportsResource.status === "error") {
    return <TabContainer><div role="alert">{reportErrorText("list")}</div></TabContainer>;
  }

  return (
    <TabContainer>
      {/* 生成入口 */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>生成家长报告</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label htmlFor="report-type" style={{ fontSize: 13 }}>报告类型</label>
          <select id="report-type" name="report-type" aria-label="报告类型" style={{ fontSize: 13, padding: "4px 8px" }} value={reportType} disabled={isReadOnly} onChange={(event) => setReportType(event.currentTarget.value as ParentReportType)}>
            <option value="daily">日报</option>
            <option value="weekly">周报</option>
            <option value="monthly">月报</option>
            <option value="exam_reminder">考试提醒</option>
          </select>
          <label htmlFor="report-period-start" style={{ fontSize: 13 }}>起</label>
          <input id="report-period-start" name="report-period-start" type="date" aria-label="报告开始日期" value={periodStart} disabled={isReadOnly} onChange={(event) => setPeriodStart(event.currentTarget.value)} />
          <label htmlFor="report-period-end" style={{ fontSize: 13 }}>止</label>
          <input id="report-period-end" name="report-period-end" type="date" aria-label="报告结束日期" value={periodEnd} disabled={isReadOnly} onChange={(event) => setPeriodEnd(event.currentTarget.value)} />
          <button
            type="button"
            disabled={isReadOnly}
            style={{
              padding: "6px 16px", fontSize: 13, cursor: isReadOnly ? "not-allowed" : "pointer",
              border: "1px solid var(--border, #e0e0e0)", background: isReadOnly ? "#9e9e9e" : "#1976d2",
              color: "#fff", borderRadius: 4, opacity: isReadOnly ? 0.7 : 1,
            }}
            onClick={generateReport}
          >
            生成报告
          </button>
        </div>
        {isReadOnly && <p role="status" style={{ fontSize: 12, color: "#c62828" }}>当前学期已归档，只读查看，不能生成报告。</p>}
        {actionError && <p role="alert" style={{ color: "#c62828", fontSize: 13 }}>{actionError}</p>}
      </div>

      {/* 报告列表 */}
      <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>报告历史</h3>
      {reportsResource.status === "empty" && <EmptyState message="暂无报告，请生成家长报告" />}
      {reportsResource.data.length === 0 && <EmptyState message="暂无报告，请生成家长报告" />}
      {reportsResource.data.map((report) => (
        <div key={report.reportKey} style={PANEL_STYLE}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <strong>{reportTypeLabel(report.reportType)}</strong>
              <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted, #888)" }}>
                {report.periodStart} ~ {report.periodEnd}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>
                <ShortId id={report.reportKey} />
              </span>
              <button type="button" style={{ padding: "4px 12px", fontSize: 12, cursor: "pointer", border: "1px solid var(--border, #e0e0e0)", background: "var(--bg-panel, #f5f5f5)", borderRadius: 4 }} onClick={() => openDetail(report)}>查看详情</button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted, #888)", marginTop: 4, display: "flex", gap: 12 }}>
            <span>生成：{report.generatedAt.slice(0, 10)}</span>
            {report.privacyCheckPassed === 1 && <span style={{ color: "#2e7d32" }}>隐私检查通过</span>}
          </div>
        </div>
      ))}
    </TabContainer>
  );
}

export function ReportTab({ reports, selectedReport, rpc, semesterId, academicContext, onSpeakText }: Props): React.JSX.Element {
  if (rpc) return <RuntimeReportTab rpc={rpc} semesterId={semesterId} academicContext={academicContext} onSpeakText={onSpeakText} />;

  // ---- 静态渲染（无 rpc，兼容旧 props）----
  if (selectedReport) {
    const content = parseContent(selectedReport.contentJson);
    return (
      <TabContainer>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>
            {reportTypeLabel(selectedReport.reportType)} · {selectedReport.periodStart} ~ {selectedReport.periodEnd}
          </h2>
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 12, color: "var(--text-muted, #888)" }}>
          <span>ID: <ShortId id={selectedReport.reportKey} /></span>
          <span>生成时间：{selectedReport.generatedAt.slice(0, 16).replace("T", " ")}</span>
          {selectedReport.privacyCheckPassed === 1 && <span style={{ color: "#2e7d32" }}>隐私检查通过</span>}
        </div>
        {content.summary && (
          <div style={PANEL_STYLE}>
            <strong>摘要：</strong>
            <span>{safeReportText(content.summary, "内容已隐藏。")}</span>
          </div>
        )}
        {content.sections.length > 0 && (
          <div>
            {content.sections.map((section, idx) => (
              <div key={idx} style={PANEL_STYLE}>
                <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>{section.title}</h3>
                <div style={{ fontSize: 13 }}>{safeReportText(section.content, "内容已隐藏。")}</div>
              </div>
            ))}
          </div>
        )}
        <button type="button" disabled={!onSpeakText || !reportSpeechText(content)} onClick={() => onSpeakText?.(reportSpeechText(content), { title: "家长报告" })} style={{ padding: "4px 12px", fontSize: 12 }}>朗读报告</button>
      </TabContainer>
    );
  }

  return (
    <TabContainer>
      <div style={{ marginBottom: 16 }}>
        <button type="button" style={{ padding: "6px 16px", fontSize: 13, cursor: "pointer", border: "1px solid var(--border, #e0e0e0)", background: "var(--bg-panel, #f5f5f5)", borderRadius: 4 }}>生成报告</button>
      </div>
      <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>报告历史</h3>
      {(!reports || reports.length === 0) && <EmptyState message="暂无报告，请生成家长报告" />}
      {reports?.map((report) => (
        <div key={report.reportKey} style={PANEL_STYLE}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <strong>{reportTypeLabel(report.reportType)}</strong>
              <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted, #888)" }}>
                {report.periodStart} ~ {report.periodEnd}
              </span>
            </div>
            <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>
              <ShortId id={report.reportKey} />
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted, #888)", marginTop: 4, display: "flex", gap: 12 }}>
            <span>生成：{report.generatedAt.slice(0, 10)}</span>
            {report.privacyCheckPassed === 1 && <span style={{ color: "#2e7d32" }}>隐私检查通过</span>}
          </div>
        </div>
      ))}
    </TabContainer>
  );
}
