/**
 * ReportTab 报告 Tab（T-M2-008，09-UI §4.9）
 *
 * S6 家长报告学生侧：生成入口 + 历史列表 + 报告内容展示（脱敏）。
 *
 * §7.2 隐私边界：报告内容 contentJson 是冻结脱敏快照，UI 不展示完整 UUID。
 * §7.4 规则生成：ruleGenerated=1 表示规则生成，非 AI，UI 不展示 AI 标记。
 * §7.5 单机零云：投递渠道仅 local_export（其他渠道 mock）。
 * §11.1 隐私边界：所有 ID 走 ShortId 组件（不展示完整 UUID）。
 */
import React from "react";
import type { TypedRpcClient } from "../../rpc-client";
import type { SemesterCourseContext } from "../../semester-course-state";
import { useTabData } from "./useTabData";
import type { ParentReport, ParentReportType } from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";
import { ShortId } from "../common/ShortId";

interface Props {
  /** 报告列表 */
  reports?: ParentReport[];
  /** 选中的报告详情（展示内容） */
  selectedReport?: ParentReport;
  /** RPC 客户端（运行时交互用） */
  rpc?: TypedRpcClient;
  /** 学期 ID */
  semesterId?: string;
  /** AppShell 唯一学术上下文（兼容旧的扁平 props） */
  academicContext?: SemesterCourseContext;
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

/** 报告内容结构（contentJson 解析） */
interface ReportContent {
  summary?: string;
  sections?: Array<{ title: string; content: string }>;
}

/** 解析 contentJson 为 ReportContent */
function parseContent(contentJson: unknown): ReportContent {
  if (typeof contentJson === "object" && contentJson !== null) {
    return contentJson as ReportContent;
  }
  return {};
}

export function ReportTab({ reports, selectedReport, rpc, semesterId, academicContext }: Props): React.JSX.Element {
  const effectiveSemesterId = academicContext?.semesterId ?? semesterId;
  const resource = useTabData<ParentReport[]>({
    rpc,
    key: `reports:${effectiveSemesterId ?? ""}`,
    enabled: Boolean(rpc && effectiveSemesterId),
    initialData: [],
    load: (client) => client.call("reports.list", { semesterId: effectiveSemesterId }),
  });
  const visibleReports = rpc ? resource.data : reports;

  if (rpc && resource.status === "loading") {
    return <TabContainer><div role="status">正在加载报告…</div></TabContainer>;
  }
  if (rpc && resource.status === "error") {
    return <TabContainer><div role="alert">暂时无法加载报告，请稍后重试。</div></TabContainer>;
  }

  // 空状态
  if (!visibleReports || visibleReports.length === 0) {
    return (
      <TabContainer>
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            style={{
              padding: "6px 16px",
              fontSize: 13,
              cursor: "pointer",
              border: "1px solid var(--border, #e0e0e0)",
              background: "var(--bg-panel, #f5f5f5)",
              borderRadius: 4,
            }}
          >
            生成报告
          </button>
        </div>
        <EmptyState message="暂无报告，请生成家长报告" />
      </TabContainer>
    );
  }

  // 选中报告时展示内容
  if (selectedReport) {
    const content = parseContent(selectedReport.contentJson);
    return (
      <TabContainer>
        {/* 返回列表 + 生成入口 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>
            {reportTypeLabel(selectedReport.reportType)} ·{" "}
            {selectedReport.periodStart} ~ {selectedReport.periodEnd}
          </h2>
          <button
            type="button"
            style={{
              padding: "4px 12px",
              fontSize: 12,
              cursor: "pointer",
              border: "1px solid var(--border, #e0e0e0)",
              background: "var(--bg-panel, #f5f5f5)",
              borderRadius: 4,
            }}
          >
            生成新报告
          </button>
        </div>

        {/* 报告元信息 */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 16,
            fontSize: 12,
            color: "var(--text-muted, #888)",
          }}
        >
          <span>
            ID: <ShortId id={selectedReport.reportKey} />
          </span>
          <span>生成时间：{selectedReport.generatedAt.slice(0, 16).replace("T", " ")}</span>
          {selectedReport.privacyCheckPassed === 1 && (
            <span style={{ color: "#2e7d32" }}>隐私检查通过</span>
          )}
        </div>

        {/* 报告摘要 */}
        {content.summary && (
          <div
            style={{
              padding: 12,
              background: "var(--bg-panel, #f5f5f5)",
              borderRadius: 4,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            <strong>摘要：</strong>
            {content.summary}
          </div>
        )}

        {/* 报告章节 */}
        {content.sections && content.sections.length > 0 && (
          <div>
            {content.sections.map((section, idx) => (
              <div
                key={idx}
                style={{
                  padding: 12,
                  border: "1px solid var(--border, #e0e0e0)",
                  borderRadius: 4,
                  marginBottom: 8,
                }}
              >
                <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>{section.title}</h3>
                <div style={{ fontSize: 13 }}>{section.content}</div>
              </div>
            ))}
          </div>
        )}
      </TabContainer>
    );
  }

  // 报告列表
  return (
    <TabContainer>
      {/* 生成入口 */}
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          style={{
            padding: "6px 16px",
            fontSize: 13,
            cursor: "pointer",
            border: "1px solid var(--border, #e0e0e0)",
            background: "var(--bg-panel, #f5f5f5)",
            borderRadius: 4,
          }}
        >
          生成报告
        </button>
      </div>

      {/* 报告列表 */}
      <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>报告历史</h3>
      {visibleReports.map((report) => (
        <div
          key={report.reportKey}
          style={{
            padding: "10px 12px",
            border: "1px solid var(--border, #e0e0e0)",
            borderRadius: 4,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
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
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted, #888)",
              marginTop: 4,
              display: "flex",
              gap: 12,
            }}
          >
            <span>生成：{report.generatedAt.slice(0, 10)}</span>
            {report.privacyCheckPassed === 1 && (
              <span style={{ color: "#2e7d32" }}>隐私检查通过</span>
            )}
          </div>
        </div>
      ))}
    </TabContainer>
  );
}
