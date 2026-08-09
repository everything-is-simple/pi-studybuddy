/**
 * MistakesTab 错题 Tab（T-M1-009，09-UI §4.7）
 *
 * S4 错题改错与薄弱点：错题列表 + 详情 + 六分类确认 + AI 建议（不确定标记）+ 重做 + 薄弱点列表。
 *
 * §7.3 错因六分类：concept_unclear/misread/formula_error/step_missing/time_pressure/other
 * §7.3 AI 不确定标记：AI 建议带"仅供参考"字样，学生必须手动确认。
 * §11.1 隐私边界：所有 ID 走 ShortId 组件（不展示完整 UUID）。
 * §5.2 TTS 朗读按钮位置：错题详情区域预留朗读按钮。
 *
 * 状态机（07-WF §8.6/§8.7）：
 *   - mistake.status: needs_review ↔ mastered
 *   - weakPoint.status: active → resolved → regressed
 */
import React from "react";
import type { TypedRpcClient } from "../../rpc-client";
import type { SemesterCourseContext } from "../../semester-course-state";
import { useTabData } from "./useTabData";
import type {
  Mistake,
  MistakeWithEvidence,
  WeakPoint,
  ErrorCategory,
} from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";
import { ShortId } from "../common/ShortId";

interface Props {
  /** 错题列表 */
  mistakes?: Mistake[];
  /** 选中的错题详情（含证据） */
  selectedMistake?: MistakeWithEvidence;
  /** 薄弱点列表 */
  weakPoints?: WeakPoint[];
  /** RPC 客户端（运行时交互用） */
  rpc?: TypedRpcClient;
  /** 课程 ID */
  courseId?: string;
  /** AppShell 唯一学术上下文（兼容旧的扁平 props） */
  academicContext?: SemesterCourseContext;
}

/** 错因六分类中文标签 */
const ERROR_CATEGORIES: Array<{ value: ErrorCategory; label: string }> = [
  { value: "concept_unclear", label: "概念不清" },
  { value: "misread", label: "看错题" },
  { value: "formula_error", label: "公式错" },
  { value: "step_missing", label: "步骤缺" },
  { value: "time_pressure", label: "时间紧" },
  { value: "other", label: "其他" },
];

/** 错题状态中文标签 */
function mistakeStatusLabel(status: Mistake["status"]): string {
  switch (status) {
    case "needs_review":
      return "待复习";
    case "mastered":
      return "已掌握";
    default:
      return status;
  }
}

/** 薄弱点状态中文标签 */
function weakPointStatusLabel(status: WeakPoint["status"]): string {
  switch (status) {
    case "active":
      return "活跃";
    case "resolved":
      return "已解决";
    case "regressed":
      return "已回退";
    default:
      return status;
  }
}

export function MistakesTab({ mistakes, selectedMistake, weakPoints, rpc, courseId, academicContext }: Props): React.JSX.Element {
  const effectiveCourseId = academicContext?.courseId ?? courseId;
  const resource = useTabData<{ mistakes: Mistake[]; weakPoints: WeakPoint[] }>({
    rpc,
    key: `mistakes:${effectiveCourseId ?? ""}`,
    enabled: Boolean(rpc && effectiveCourseId),
    initialData: { mistakes: [], weakPoints: [] },
    load: async (client) => {
      const [loadedMistakes, loadedWeakPoints] = await Promise.all([
        client.call("mistakes.list", { courseId: effectiveCourseId }),
        client.call("weakPoints.list", { courseId: effectiveCourseId }),
      ]);
      return { mistakes: loadedMistakes, weakPoints: loadedWeakPoints };
    },
    isEmpty: (value) => value.mistakes.length === 0,
  });
  const visibleMistakes = rpc ? resource.data.mistakes : mistakes;
  const visibleWeakPoints = rpc ? resource.data.weakPoints : weakPoints;

  if (rpc && resource.status === "loading") {
    return <TabContainer><div role="status">正在加载错题…</div></TabContainer>;
  }
  if (rpc && resource.status === "error") {
    return <TabContainer><div role="alert">暂时无法加载错题，请稍后重试。</div></TabContainer>;
  }

  // 空状态
  if (!visibleMistakes || visibleMistakes.length === 0) {
    return (
      <TabContainer>
        <EmptyState message="暂无错题，继续加油" />
      </TabContainer>
    );
  }

  return (
    <TabContainer>
      {/* 错题列表 */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>错题列表</h2>
        {visibleMistakes.map((m) => (
          <div
            key={m.id}
            style={{
              padding: "8px 12px",
              border: "1px solid var(--border, #e0e0e0)",
              borderRadius: 4,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12 }}>
                #<ShortId id={m.id} />
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: m.status === "mastered" ? "#2e7d32" : "#f57c00",
                  fontWeight: 600,
                }}
              >
                {mistakeStatusLabel(m.status)}
              </span>
            </div>
            {m.errorCause && (
              <div style={{ fontSize: 12, color: "var(--text-muted, #888)", marginTop: 4 }}>
                错因：{m.errorCause}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 选中错题详情：六分类 + AI 建议 + 重做 */}
      {selectedMistake && (
        <div
          style={{
            padding: 12,
            border: "1px solid var(--border, #e0e0e0)",
            borderRadius: 4,
            marginBottom: 16,
            background: "var(--bg-panel, #f5f5f5)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <h3 style={{ fontSize: 14, margin: 0 }}>错题详情</h3>
            <button
              type="button"
              style={{
                padding: "4px 12px",
                fontSize: 12,
                cursor: "pointer",
                border: "1px solid var(--border, #e0e0e0)",
                background: "#fff",
                borderRadius: 4,
              }}
            >
              朗读
            </button>
          </div>

          {/* 错因六分类选项（§7.3） */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, marginBottom: 6 }}>错因分类：</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ERROR_CATEGORIES.map((cat) => (
                <label
                  key={cat.value}
                  style={{
                    padding: "4px 10px",
                    border:
                      selectedMistake.errorCategory === cat.value
                        ? "1px solid #1976d2"
                        : "1px solid var(--border, #e0e0e0)",
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: "pointer",
                    background:
                      selectedMistake.errorCategory === cat.value ? "#e3f2fd" : "#fff",
                  }}
                >
                  <input
                    type="radio"
                    name="error-category"
                    defaultChecked={selectedMistake.errorCategory === cat.value}
                    style={{ marginRight: 4 }}
                  />
                  {cat.label}
                </label>
              ))}
            </div>
          </div>

          {/* 学生已确认的错因 */}
          {selectedMistake.errorCause && (
            <div style={{ marginBottom: 8, fontSize: 13 }}>
              <strong>已确认错因：</strong>
              {selectedMistake.errorCause}
            </div>
          )}

          {/* AI 建议（§7.3 不确定标记） */}
          {selectedMistake.errorCauseAiSuggestion && (
            <div
              style={{
                padding: 8,
                background: "#fffde7",
                border: "1px solid #fff9c4",
                borderRadius: 4,
                marginBottom: 8,
                fontSize: 12,
              }}
            >
              <strong>AI 建议（仅供参考）：</strong>
              {selectedMistake.errorCauseAiSuggestion}
            </div>
          )}

          {/* 重做按钮 */}
          <button
            type="button"
            style={{
              padding: "6px 16px",
              fontSize: 13,
              cursor: "pointer",
              border: "1px solid var(--border, #e0e0e0)",
              background: "#1976d2",
              color: "#fff",
              borderRadius: 4,
            }}
          >
            重做
          </button>
        </div>
      )}

      {/* 薄弱点列表 */}
      {visibleWeakPoints && visibleWeakPoints.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>薄弱点</h3>
          {visibleWeakPoints.map((wp) => (
            <div
              key={wp.id}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--border, #e0e0e0)",
                borderRadius: 4,
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 12 }}>
                  #<ShortId id={wp.id} />
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: wp.status === "active" ? "#c62828" : "#2e7d32",
                    fontWeight: 600,
                  }}
                >
                  {weakPointStatusLabel(wp.status)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted, #888)", marginTop: 4 }}>
                证据数：{wp.evidenceCount}
              </div>
            </div>
          ))}
        </div>
      )}
    </TabContainer>
  );
}
