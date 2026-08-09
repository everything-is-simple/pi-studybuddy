/**
 * CramTab 冲刺 Tab（T-M2-008，09-UI §4.8）
 *
 * S5 期末冲刺：模拟考入口 + 速背卡浏览 + 冲刺计划展示（三选一子切换）。
 *
 * §7.4 确定性只读：速背卡/冲刺计划是确定性只读 DTO，不调 LLM、不持久化。
 *   UI 不展示 AI 生成标记（与 HomeTab dailyBrief 同样的规则聚合断言）。
 * §11.1 隐私边界：所有 ID 走 ShortId 组件（不展示完整 UUID）。
 */
import React from "react";
import type { TypedRpcClient } from "../../rpc-client";
import type { SemesterCourseContext } from "../../semester-course-state";
import type { CramCard, CramPlanDay } from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";

/** 冲刺子 Tab 类型 */
type CramSubTab = "mockExam" | "speedCards" | "plan";

interface Props {
  /** 当前子 Tab（默认 speedCards） */
  subTab?: CramSubTab;
  /** 速背卡列表（确定性只读 DTO） */
  cards?: CramCard[];
  /** 冲刺计划（确定性只读 DTO） */
  plan?: CramPlanDay[];
  /** RPC 客户端（运行时交互用） */
  rpc?: TypedRpcClient;
  /** 课程 ID */
  courseId?: string;
  /** AppShell 唯一学术上下文 */
  academicContext?: SemesterCourseContext;
}

/** 重要性星级 */
function importanceLabel(importance: number): string {
  return "★".repeat(importance) + "☆".repeat(5 - importance);
}

/** 模拟考入口子组件 */
function MockExamPhase(): React.JSX.Element {
  return (
    <div>
      <h3 style={{ fontSize: 14, margin: "0 0 12px 0" }}>模拟考</h3>
      <div
        style={{
          padding: 16,
          border: "1px solid var(--border, #e0e0e0)",
          borderRadius: 4,
          textAlign: "center",
        }}
      >
        <p style={{ color: "var(--text-muted, #888)", marginBottom: 12, fontSize: 13 }}>
          基于错题和薄弱点生成模拟试卷
        </p>
        <button
          type="button"
          style={{
            padding: "8px 24px",
            fontSize: 13,
            cursor: "pointer",
            border: "1px solid var(--border, #e0e0e0)",
            background: "#1976d2",
            color: "#fff",
            borderRadius: 4,
          }}
        >
          生成试卷
        </button>
      </div>
    </div>
  );
}

/** 速背卡子组件（确定性只读，不调 LLM） */
function SpeedCardsPhase({ cards }: { cards: CramCard[] }): React.JSX.Element {
  if (!cards || cards.length === 0) {
    return <EmptyState message="暂无速背卡，请先完善知识模块" />;
  }

  return (
    <div>
      <h3 style={{ fontSize: 14, margin: "0 0 12px 0" }}>速背卡</h3>
      {cards.map((card) => (
        <div
          key={card.moduleId}
          style={{
            padding: 12,
            border: "1px solid var(--border, #e0e0e0)",
            borderRadius: 4,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <strong>{card.moduleName}</strong>
            <span style={{ fontSize: 12, color: "#f57c00" }}>
              {importanceLabel(card.importance)}
            </span>
          </div>

          <div style={{ marginBottom: 6, fontSize: 13 }}>
            <strong>核心概念：</strong>
            {card.coreConcept}
          </div>

          {card.keyPoints && card.keyPoints.length > 0 && (
            <div style={{ marginBottom: 6, fontSize: 12 }}>
              <strong>关键点：</strong>
              {card.keyPoints.join("、")}
            </div>
          )}

          {card.mnemonic && (
            <div style={{ marginBottom: 4, fontSize: 12, color: "#1976d2" }}>
              <strong>记忆口诀：</strong>
              {card.mnemonic}
            </div>
          )}

          {card.commonExamPattern && (
            <div style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>
              <strong>常考题型：</strong>
              {card.commonExamPattern}
            </div>
          )}

          {card.easyMistake && (
            <div style={{ fontSize: 12, color: "#c62828" }}>
              <strong>易错点：</strong>
              {card.easyMistake}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** 冲刺计划子组件（确定性只读，不调 LLM） */
function PlanPhase({ plan }: { plan: CramPlanDay[] }): React.JSX.Element {
  if (!plan || plan.length === 0) {
    return <EmptyState message="暂无冲刺计划" />;
  }

  return (
    <div>
      <h3 style={{ fontSize: 14, margin: "0 0 12px 0" }}>冲刺计划（7 天）</h3>
      {plan.map((day) => (
        <div
          key={day.date}
          style={{
            padding: 12,
            border: "1px solid var(--border, #e0e0e0)",
            borderRadius: 4,
            marginBottom: 8,
            borderLeft: "3px solid #1976d2",
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <strong>Day {day.dayOffset + 1}</strong>{" "}
            <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>{day.date}</span>
          </div>

          {day.tasks.reviewModules && day.tasks.reviewModules.length > 0 && (
            <div style={{ fontSize: 12, marginBottom: 4 }}>
              <strong>复习模块：</strong>
              {day.tasks.reviewModules.join("、")}
            </div>
          )}

          {day.tasks.redoMistakes && day.tasks.redoMistakes.length > 0 && (
            <div style={{ fontSize: 12, marginBottom: 4 }}>
              <strong>重做错题：</strong>
              {day.tasks.redoMistakes.length} 道
            </div>
          )}

          <div style={{ fontSize: 12, marginBottom: 4 }}>
            <strong>练习数量：</strong>
            {day.tasks.practiceCount} 套
          </div>

          {day.tasks.notes && (
            <div style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>{day.tasks.notes}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export function CramTab({ subTab = "speedCards", cards, plan }: Props): React.JSX.Element {
  return (
    <TabContainer>
      {/* 子 Tab 切换按钮 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          borderBottom: "1px solid var(--border, #e0e0e0)",
          paddingBottom: 8,
        }}
      >
        <span style={{ fontSize: 13, padding: "4px 8px", fontWeight: 600 }}>冲刺</span>
      </div>

      {/* 根据子 Tab 渲染对应内容 */}
      {subTab === "mockExam" && <MockExamPhase />}
      {subTab === "speedCards" && <SpeedCardsPhase cards={cards ?? []} />}
      {subTab === "plan" && <PlanPhase plan={plan ?? []} />}
    </TabContainer>
  );
}
