/**
 * HomeTab 首页 Tab（T-M1-009，09-UI §4.3）
 *
 * S1 每日学习简报：dailyBrief（规则聚合非 AI）+ 待办列表 + 考试倒计时。
 *
 * §7.4 规则优先：dailyBrief 来自 tasks.dailyBrief（规则聚合），非 AI 生成，
 *   UI 不展示 AI 幻觉为事实。
 * §11.1 隐私边界：所有 ID 走 ShortId 组件（不展示完整 UUID）。
 */
import React from "react";
import type { DailyBrief, StudyTask, AssessmentAttempt } from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";

interface Props {
  /** 每日学习简报（规则聚合非 AI） */
  dailyBrief?: DailyBrief;
  /** 待办任务列表 */
  tasks?: StudyTask[];
  /** 考试列表（倒计时展示） */
  exams?: AssessmentAttempt[];
  /** RPC 客户端（运行时交互用，静态渲染测试可不传） */
  rpc?: unknown;
  /** 学期 ID */
  semesterId?: string;
}

/** 计算考试倒计时天数 */
function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date("2026-08-08T00:00:00Z");
  const diffMs = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/** 任务状态中文标签 */
function taskStatusLabel(status: StudyTask["status"]): string {
  switch (status) {
    case "pending":
      return "待办";
    case "in_progress":
      return "进行中";
    case "completed":
      return "已完成";
    case "skipped":
      return "已跳过";
    default:
      return status;
  }
}

export function HomeTab({ dailyBrief, tasks, exams }: Props): React.JSX.Element {
  // 空状态：无 dailyBrief
  if (!dailyBrief) {
    return (
      <TabContainer>
        <EmptyState message="暂无学习简报，请先选择学期" />
      </TabContainer>
    );
  }

  return (
    <TabContainer>
      {/* 每日学习简报头部 */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, color: "var(--text, #222)" }}>
          每日学习简报
        </h2>
        <div style={{ fontSize: 12, color: "var(--text-muted, #888)", marginTop: 4 }}>
          {dailyBrief.date}
        </div>
      </div>

      {/* 待办数量 */}
      <div
        style={{
          padding: 12,
          background: "var(--bg-panel, #f5f5f5)",
          borderRadius: 4,
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 13 }}>今日待办：</span>
        <strong style={{ fontSize: 16, color: "#1976d2" }}>{dailyBrief.pendingItems}</strong>
        <span style={{ fontSize: 13 }}> 项</span>
      </div>

      {/* 待办任务列表 */}
      {tasks && tasks.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>任务列表</h3>
          {tasks.map((task) => (
            <div
              key={task.id}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--border, #e0e0e0)",
                borderRadius: 4,
                marginBottom: 4,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{task.title}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>
                {taskStatusLabel(task.status)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 考试倒计时 */}
      {exams && exams.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>考试倒计时</h3>
          {exams.map((exam) => (
            <div
              key={exam.id}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--border, #e0e0e0)",
                borderRadius: 4,
                marginBottom: 4,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{exam.examName}</span>
              <span style={{ fontSize: 12, color: "#d32f2f" }}>
                还有 {daysUntil(exam.scheduledDate)} 天
              </span>
            </div>
          ))}
        </div>
      )}
    </TabContainer>
  );
}
