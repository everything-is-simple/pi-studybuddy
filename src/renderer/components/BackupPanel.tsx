/**
 * BackupPanel 备份恢复面板（T-M2-008，09-UI §6.1-§6.3）
 *
 * 手动备份 + 调度配置 + 历史列表 + 恢复交互 + 冲突解决。
 *
 * §6.2 恢复流程：content_hash 校验 + schema_version 校验 + 冲突解决 + integrity_check 结果。
 * §7.5 单机零云：备份仅本地目录。
 * §11.1 隐私边界：所有 ID 走 ShortId 组件（不展示完整 UUID）。
 */
import React from "react";
import type { BackupRecord, RestoreResult } from "../../contract/types";
import { EmptyState } from "./common/EmptyState";
import { ShortId } from "./common/ShortId";

/** 恢复流程阶段 */
type RestorePhase = "idle" | "validating" | "conflict" | "restoring" | "completed" | "failed";

interface Props {
  /** 备份历史列表 */
  backups?: BackupRecord[];
  /** 恢复阶段 */
  restorePhase?: RestorePhase;
  /** content_hash 校验结果 */
  hashValid?: boolean;
  /** schema_version 兼容性 */
  schemaCompatible?: boolean;
  /** 恢复结果 */
  restoreResult?: RestoreResult;
  /** 恢复失败错误信息 */
  restoreError?: string;
  /** RPC 客户端（运行时交互用） */
  rpc?: unknown;
}

/** 文件大小格式化 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 备份类型中文标签 */
function backupTypeLabel(type: BackupRecord["backupType"]): string {
  switch (type) {
    case "manual":
      return "手动";
    case "scheduled":
      return "调度";
    default:
      return type;
  }
}

export function BackupPanel({
  backups = [],
  restorePhase = "idle",
  hashValid,
  schemaCompatible,
  restoreResult,
  restoreError,
}: Props): React.JSX.Element {
  return (
    <div style={{ padding: 16, fontSize: 13 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 16px 0" }}>备份恢复</h2>

      {/* §6.1 手动备份 */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>手动备份</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12 }}>备份路径：</span>
          <input
            type="text"
            defaultValue="H:\\backups"
            style={{
              flex: 1,
              padding: "4px 8px",
              fontSize: 12,
              border: "1px solid var(--border, #e0e0e0)",
              borderRadius: 4,
            }}
          />
          <button
            type="button"
            style={{
              padding: "4px 12px",
              fontSize: 12,
              cursor: "pointer",
              border: "1px solid var(--border, #e0e0e0)",
              background: "#1976d2",
              color: "#fff",
              borderRadius: 4,
            }}
          >
            立即备份
          </button>
        </div>
      </div>

      {/* §6.1 调度配置 */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>调度配置</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12 }}>cron 表达式：</span>
          <input
            type="text"
            defaultValue="0 2 * * *"
            style={{
              width: 120,
              padding: "4px 8px",
              fontSize: 12,
              border: "1px solid var(--border, #e0e0e0)",
              borderRadius: 4,
            }}
          />
          <span style={{ fontSize: 11, color: "var(--text-muted, #888)" }}>
            （每天 02:00 自动备份）
          </span>
        </div>
      </div>

      {/* §6.2 恢复流程交互区 */}
      {restorePhase !== "idle" && (
        <div
          style={{
            padding: 12,
            border: "1px solid #1976d2",
            borderRadius: 4,
            marginBottom: 24,
            background: "#e3f2fd",
          }}
        >
          <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>恢复流程</h3>

          {/* validating 阶段：content_hash + schema_version 校验 */}
          {restorePhase === "validating" && (
            <div style={{ fontSize: 12 }}>
              <div>校验中…</div>
              {hashValid !== undefined && (
                <div style={{ marginTop: 4 }}>
                  content_hash 校验：
                  <span style={{ color: hashValid ? "#2e7d32" : "#c62828" }}>
                    {hashValid ? "通过" : "失败"}
                  </span>
                </div>
              )}
              {schemaCompatible !== undefined && (
                <div style={{ marginTop: 4 }}>
                  schema_version 校验：
                  <span style={{ color: schemaCompatible ? "#2e7d32" : "#c62828" }}>
                    {schemaCompatible ? "兼容" : "不兼容"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* conflict 阶段：冲突解决弹窗 */}
          {restorePhase === "conflict" && (
            <div style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>检测到冲突</div>
              <div style={{ marginBottom: 8 }}>目标课程已存在数据，请选择恢复方式：</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  style={{
                    padding: "4px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                    border: "1px solid #c62828",
                    background: "#ffebee",
                    color: "#c62828",
                    borderRadius: 4,
                  }}
                >
                  覆盖现有数据
                </button>
                <button
                  type="button"
                  style={{
                    padding: "4px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                    border: "1px solid #1976d2",
                    background: "#e3f2fd",
                    color: "#1976d2",
                    borderRadius: 4,
                  }}
                >
                  新建课程
                </button>
              </div>
            </div>
          )}

          {/* restoring 阶段 */}
          {restorePhase === "restoring" && (
            <div style={{ fontSize: 12 }}>恢复中…</div>
          )}

          {/* completed 阶段：integrity_check 结果 */}
          {restorePhase === "completed" && restoreResult && (
            <div style={{ fontSize: 12 }}>
              <div style={{ color: "#2e7d32", fontWeight: 600, marginBottom: 8 }}>恢复完成</div>
              <div style={{ marginBottom: 4 }}>
                integrity_check：<strong>{restoreResult.integrityCheck}</strong>
              </div>
              <div style={{ marginBottom: 4 }}>
                导入表：{restoreResult.tablesImported.join("、")}
              </div>
              <div style={{ marginBottom: 4 }}>
                恢复文件数：{restoreResult.filesRestored}
              </div>
              {restoreResult.schemaVersion && (
                <div style={{ marginBottom: 4 }}>schema_version：{restoreResult.schemaVersion}</div>
              )}
              <div>
                冲突解决方式：
                {restoreResult.conflictResolved === "none" ? "无冲突" : restoreResult.conflictResolved}
              </div>
            </div>
          )}

          {/* failed 阶段 */}
          {restorePhase === "failed" && (
            <div style={{ fontSize: 12, color: "#c62828" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>恢复失败</div>
              <div>{restoreError}</div>
            </div>
          )}
        </div>
      )}

      {/* §6.1 历史列表 */}
      <div>
        <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>备份历史</h3>
        {backups.length === 0 ? (
          <EmptyState message="暂无备份历史" />
        ) : (
          backups.map((backup) => (
            <div
              key={backup.id}
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
                  <strong>{backup.zipFilename}</strong>
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      padding: "2px 6px",
                      background: "var(--bg-panel, #f5f5f5)",
                      borderRadius: 2,
                    }}
                  >
                    {backupTypeLabel(backup.backupType)}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted, #888)" }}>
                  <ShortId id={backup.id} />
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
                <span>大小：{formatFileSize(backup.fileSizeBytes)}</span>
                <span>时间：{backup.startedAt.slice(0, 16).replace("T", " ")}</span>
              </div>
              {/* 恢复入口 */}
              <button
                type="button"
                style={{
                  marginTop: 8,
                  padding: "4px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  border: "1px solid var(--border, #e0e0e0)",
                  background: "#fff",
                  borderRadius: 4,
                }}
              >
                恢复
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
