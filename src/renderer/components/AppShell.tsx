/**
 * pi-studybuddy AppShell 三栏布局壳（09-UI §2.1）
 *
 * 布局结构：
 * ┌─────────────────────────────────────────────────────┐
 * │ 标题栏（学期名 / 课程名 / 窗口控制）                  │
 * ├──────────┬──────────────────────────────┬───────────┤
 * │ 左侧栏    │  主内容区（TabBar + 内容）     │ 右侧面板   │
 * │ (导航)    │  ┌──────────────────────┐    │ (上下文)  │
 * │          │  │ 朗读控制条占位         │    │           │
 * │          │  └──────────────────────┘    │           │
 * ├──────────┴──────────────────────────────┴───────────┤
 * │ 状态栏（模型 / 备份 / 调度 / TTS）                    │
 * └─────────────────────────────────────────────────────┘
 *
 * M0 骨架阶段：纯布局占位，不接业务 RPC。
 * 借鉴 pi-desktop AppShell.tsx（仅参考布局结构，不复制实现）。
 */
import React, { useState } from "react";
import { TABS, DEFAULT_TAB_ID } from "../tabs";
import { TabBar } from "./TabBar";

interface Props {
  /** RPC 通道状态文本（由 App.tsx 传入，骨架阶段用于显示连通性） */
  rpcStatus?: string;
  /** RPC ping 结果文本 */
  rpcResult?: string | null;
  /** 手动触发 RPC ping 验证 */
  onVerifyRpc?: () => void;
}

export function AppShell({ rpcStatus, rpcResult, onVerifyRpc }: Props): React.JSX.Element {
  const [activeTabId, setActiveTabId] = useState(DEFAULT_TAB_ID);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg, #ffffff)",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      {/* 标题栏 */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 40,
          padding: "0 16px",
          flexShrink: 0,
          background: "var(--bg-panel, #f5f5f5)",
          borderBottom: "1px solid var(--border, #e0e0e0)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text, #222)",
        }}
      >
        <span>📚 pi-studybuddy</span>
        <span style={{ color: "var(--text-muted, #888)", fontWeight: 400 }}>|</span>
        <span style={{ color: "var(--text-muted, #888)", fontWeight: 400 }}>学期名 / 课程名</span>
      </header>

      {/* 主布局：三栏 */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* 左侧栏 — 导航区占位 */}
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            padding: 12,
            background: "var(--bg-panel, #f5f5f5)",
            borderRight: "1px solid var(--border, #e0e0e0)",
            fontSize: 12,
            color: "var(--text-muted, #888)",
            overflowY: "auto",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--text, #222)" }}>导航</div>
          <div style={{ lineHeight: 2 }}>学期 / 课程 / 会话</div>
        </aside>

        {/* 主内容区 */}
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          {/* TabBar */}
          <TabBar tabs={TABS} activeTabId={activeTabId} onSelectTab={setActiveTabId} />

          {/* 朗读控制条占位 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 32,
              padding: "0 12px",
              flexShrink: 0,
              background: "var(--bg-panel, #f5f5f5)",
              borderBottom: "1px solid var(--border, #e0e0e0)",
              fontSize: 12,
              color: "var(--text-muted, #888)",
            }}
          >
            <span>TTS</span>
            <span>|</span>
            <span>朗读控制条占位</span>
          </div>

          {/* Tab 内容占位 */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: 16,
              fontSize: 13,
              color: "var(--text-muted, #888)",
            }}
          >
            <p>当前标签：{TABS.find((t) => t.id === activeTabId)?.label}</p>
            <p style={{ marginTop: 8 }}>（M0 骨架阶段，业务内容待后续里程碑填充）</p>

            {/* RPC 通道验证（保留 T-M0-001 连通性检查） */}
            {rpcStatus && (
              <div style={{ marginTop: 24, fontSize: 12 }}>
                <p>RPC 状态：{rpcStatus}</p>
                {onVerifyRpc && (
                  <button
                    type="button"
                    onClick={onVerifyRpc}
                    style={{
                      padding: "4px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                      border: "1px solid var(--border, #e0e0e0)",
                      background: "var(--bg-panel, #f5f5f5)",
                      borderRadius: 4,
                    }}
                  >
                    验证 RPC 通道
                  </button>
                )}
                {rpcResult && (
                  <p style={{ marginTop: 4 }}>ping 结果：{rpcResult}</p>
                )}
              </div>
            )}
          </div>
        </main>

        {/* 右侧面板 — 上下文区占位 */}
        <aside
          style={{
            width: 260,
            flexShrink: 0,
            padding: 12,
            background: "var(--bg-panel, #f5f5f5)",
            borderLeft: "1px solid var(--border, #e0e0e0)",
            fontSize: 12,
            color: "var(--text-muted, #888)",
            overflowY: "auto",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--text, #222)" }}>上下文</div>
          <div style={{ lineHeight: 2 }}>当前课程 / 目标 / 薄弱点</div>
        </aside>
      </div>

      {/* 状态栏 */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          height: 28,
          padding: "0 16px",
          flexShrink: 0,
          background: "var(--bg-panel, #f5f5f5)",
          borderTop: "1px solid var(--border, #e0e0e0)",
          fontSize: 11,
          color: "var(--text-muted, #888)",
        }}
      >
        <span>模型：未配置</span>
        <span>|</span>
        <span>备份：就绪</span>
        <span>|</span>
        <span>调度：空闲</span>
        <span>|</span>
        <span>TTS：SAPI</span>
      </footer>
    </div>
  );
}
