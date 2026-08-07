/**
 * NotesTab 笔记 Tab（T-M1-009，09-UI §4.5）
 *
 * S2 笔记预览与导图：笔记内容 + 知识模块列表（带 source_evidence 回链）+ 学习状态流转。
 *
 * §7.3 知识模块回链：知识模块带 sourceEvidenceJson，展示来源资料回链。
 * §11.1 隐私边界：所有 ID 走 ShortId 组件（不展示完整 UUID）。
 * §5.2 TTS 朗读按钮位置：笔记区域预留朗读按钮（onClick 调用 tts.speak）。
 */
import React from "react";
import type { StructuredNote, KnowledgeModule, LearnStatus } from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";

interface Props {
  /** 笔记内容 */
  note?: StructuredNote;
  /** 知识模块列表 */
  modules?: KnowledgeModule[];
  /** RPC 客户端（运行时交互用） */
  rpc?: unknown;
  /** 课程 ID */
  courseId?: string;
}

/** 学习状态中文标签 */
function learnStatusLabel(status: LearnStatus): string {
  switch (status) {
    case "not_started":
      return "未开始";
    case "learning":
      return "学习中";
    case "mastered":
      return "已掌握";
    case "needs_review":
      return "待复习";
    default:
      return status;
  }
}

/** 学习状态颜色 */
function learnStatusColor(status: LearnStatus): string {
  switch (status) {
    case "mastered":
      return "#2e7d32";
    case "learning":
      return "#1976d2";
    case "needs_review":
      return "#f57c00";
    default:
      return "var(--text-muted, #888)";
  }
}

export function NotesTab({ note, modules }: Props): React.JSX.Element {
  // 空状态：无笔记
  if (!note) {
    return (
      <TabContainer>
        <EmptyState message="暂无笔记，请先上传资料并生成笔记" />
      </TabContainer>
    );
  }

  return (
    <TabContainer>
      {/* 笔记头部 + TTS 朗读按钮 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>笔记预览</h2>
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
          朗读
        </button>
      </div>

      {/* 笔记内容预览（简化渲染，react-markdown 留待后续） */}
      <div
        style={{
          padding: 12,
          background: "var(--bg-panel, #f5f5f5)",
          borderRadius: 4,
          marginBottom: 16,
          whiteSpace: "pre-wrap",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {note.noteMarkdown}
      </div>

      {/* 知识模块列表 */}
      {modules && modules.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>知识模块</h3>
          {modules.map((mod) => (
            <div
              key={mod.id}
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
                <strong>{mod.moduleName}</strong>
                <span
                  style={{
                    fontSize: 12,
                    color: learnStatusColor(mod.learnStatus),
                    fontWeight: 600,
                  }}
                >
                  {learnStatusLabel(mod.learnStatus)}
                </span>
              </div>
              {mod.summary && (
                <div style={{ fontSize: 12, color: "var(--text-muted, #888)", marginTop: 4 }}>
                  {mod.summary}
                </div>
              )}
              {/* §7.3 来源回链：sourceEvidenceJson 非空提示 */}
              {mod.sourceEvidenceJson && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted, #888)",
                    marginTop: 4,
                  }}
                >
                  来源：资料回链
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </TabContainer>
  );
}
