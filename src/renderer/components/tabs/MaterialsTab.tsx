/**
 * MaterialsTab 资料 Tab（T-M1-009，09-UI §4.4）
 *
 * S2 资料上传与管理：资料列表 + 状态标识 + 上传入口 + 转换/生成笔记操作。
 * Material 状态机（05-ERD §8.3）：pending→converting→converted→note_generating→completed
 *   转换失败：conversion_failed
 *
 * §11.1 隐私边界：所有 ID 走 ShortId 组件（不展示完整 UUID）。
 */
import React from "react";
import type { Material, MaterialStatus } from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";

interface Props {
  /** 资料列表 */
  materials?: Material[];
  /** RPC 客户端（运行时交互用） */
  rpc?: unknown;
  /** 课程 ID */
  courseId?: string;
}

/** Material 状态中文标签 */
function materialStatusLabel(status: MaterialStatus): string {
  switch (status) {
    case "pending":
      return "待处理";
    case "converting":
      return "转换中";
    case "converted":
      return "已转换";
    case "note_generating":
      return "笔记生成中";
    case "completed":
      return "已完成";
    case "conversion_failed":
      return "转换失败";
    case "pending_quality_check":
      return "待质检";
    default:
      return status;
  }
}

/** 状态颜色 */
function materialStatusColor(status: MaterialStatus): string {
  switch (status) {
    case "completed":
      return "#2e7d32";
    case "converting":
    case "note_generating":
      return "#f57c00";
    case "conversion_failed":
      return "#c62828";
    default:
      return "var(--text-muted, #888)";
  }
}

/** 文件大小格式化 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MaterialsTab({ materials }: Props): React.JSX.Element {
  // 空状态
  if (!materials || materials.length === 0) {
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
            上传资料
          </button>
        </div>
        <EmptyState message="暂无资料，请上传课程资料" />
      </TabContainer>
    );
  }

  return (
    <TabContainer>
      {/* 上传入口 */}
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
          上传资料
        </button>
      </div>

      {/* 资料列表 */}
      <div>
        <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>资料列表</h3>
        {materials.map((mat) => (
          <div
            key={mat.id}
            style={{
              padding: "10px 12px",
              border: "1px solid var(--border, #e0e0e0)",
              borderRadius: 4,
              marginBottom: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{mat.fileName}</strong>
              <span
                style={{
                  fontSize: 12,
                  color: materialStatusColor(mat.status),
                  fontWeight: 600,
                }}
              >
                {materialStatusLabel(mat.status)}
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted, #888)",
                marginTop: 4,
                display: "flex",
                gap: 12,
              }}
            >
              <span>类型：{mat.fileType}</span>
              <span>大小：{formatFileSize(mat.fileSizeBytes)}</span>
              <span>上传：{mat.uploadedAt.slice(0, 10)}</span>
            </div>
          </div>
        ))}
      </div>
    </TabContainer>
  );
}
