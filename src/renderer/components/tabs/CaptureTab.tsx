/**
 * CaptureTab 采集 Tab（T-M2-008，09-UI §4.10）
 *
 * S7 课堂采集：合规确认 + 文件选择 + 转写结果 + 保存为 S2 笔记。
 *
 * §7.2 合规确认强制：permissionConfirmed=false 时转写按钮禁用。
 * §4.10 PCM WAV 单一输入：只接受 WAV 格式。
 * §11.1 隐私边界：所有 ID 走 ShortId 组件（不展示完整 UUID）。
 */
import React from "react";
import type { FileMeta } from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";

interface Props {
  /** 合规确认状态（false 时转写禁用） */
  permissionConfirmed?: boolean;
  /** 选中文件 */
  selectedFile?: FileMeta;
  /** 转写结果 */
  transcription?: string;
  /** RPC 客户端（运行时交互用） */
  rpc?: unknown;
  /** 课程 ID */
  courseId?: string;
}

/** 文件大小格式化 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CaptureTab({
  permissionConfirmed = false,
  selectedFile,
  transcription,
}: Props): React.JSX.Element {
  return (
    <TabContainer>
      <h2 style={{ fontSize: 16, margin: "0 0 16px 0" }}>课堂采集</h2>

      {/* §7.2 合规确认（强制） */}
      <div
        style={{
          padding: 12,
          background: "#fffde7",
          border: "1px solid #fff9c4",
          borderRadius: 4,
          marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>合规确认</div>
        <label style={{ display: "flex", alignItems: "center", fontSize: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            defaultChecked={permissionConfirmed}
            style={{ marginRight: 8 }}
          />
          <span>
            我确认此录音已获得授课教师授权，或为本人自主录音，可用于学习转写。
            <strong>未授权录音禁止转写。</strong>
          </span>
        </label>
      </div>

      {/* §4.10 文件选择（PCM WAV 单一输入） */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, marginBottom: 8 }}>选择录音文件（仅支持 WAV 格式）</div>
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
          选择文件
        </button>
        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted, #888)" }}>
          PCM WAV 单一输入
        </span>
      </div>

      {/* 选中文件展示 */}
      {selectedFile && (
        <div
          style={{
            padding: 12,
            border: "1px solid var(--border, #e0e0e0)",
            borderRadius: 4,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{selectedFile.name}</strong>
              <div style={{ fontSize: 11, color: "var(--text-muted, #888)", marginTop: 4 }}>
                {selectedFile.mime} · {formatFileSize(selectedFile.size)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 转写按钮（合规确认未通过时禁用） */}
      <div style={{ marginBottom: 16, textAlign: "center" }}>
        <button
          type="button"
          disabled={!permissionConfirmed || !selectedFile}
          style={{
            padding: "8px 24px",
            fontSize: 13,
            cursor: permissionConfirmed && selectedFile ? "pointer" : "not-allowed",
            border: "1px solid var(--border, #e0e0e0)",
            background:
              permissionConfirmed && selectedFile ? "#1976d2" : "var(--bg-panel, #f5f5f5)",
            color: permissionConfirmed && selectedFile ? "#fff" : "var(--text-muted, #888)",
            borderRadius: 4,
            opacity: permissionConfirmed && selectedFile ? 1 : 0.6,
          }}
        >
          开始转写
        </button>
        {!permissionConfirmed && (
          <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>
            请先勾选合规确认
          </div>
        )}
      </div>

      {/* 转写结果展示 */}
      {transcription ? (
        <div>
          <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>转写结果</h3>
          <div
            style={{
              padding: 12,
              background: "var(--bg-panel, #f5f5f5)",
              borderRadius: 4,
              marginBottom: 16,
              whiteSpace: "pre-wrap",
              fontSize: 13,
              lineHeight: 1.6,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            {transcription}
          </div>
          {/* 保存为 S2 笔记按钮 */}
          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              style={{
                padding: "6px 16px",
                fontSize: 13,
                cursor: "pointer",
                border: "1px solid var(--border, #e0e0e0)",
                background: "#2e7d32",
                color: "#fff",
                borderRadius: 4,
              }}
            >
              保存为笔记
            </button>
          </div>
        </div>
      ) : (
        !selectedFile && <EmptyState message="请选择录音文件开始转写" />
      )}
    </TabContainer>
  );
}
