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
 * T-M1-009：根据 activeTabId 渲染对应 S1-S4 业务 Tab 组件。
 *   chat/cram/report/capture 留待后续里程碑。
 */
import React, { useState } from "react";
import { TABS, DEFAULT_TAB_ID } from "../tabs";
import { TabBar } from "./TabBar";
import { HomeTab } from "./tabs/HomeTab";
import { MaterialsTab } from "./tabs/MaterialsTab";
import { NotesTab } from "./tabs/NotesTab";
import { PracticeTab } from "./tabs/PracticeTab";
import { MistakesTab } from "./tabs/MistakesTab";
import { CramTab } from "./tabs/CramTab";
import { ReportTab } from "./tabs/ReportTab";
import { CaptureTab } from "./tabs/CaptureTab";
import { ChatTab } from "./tabs/ChatTab";
import { SessionSidebar, type SessionSidebarItem } from "./SessionSidebar";
import { TtsControlBar } from "./TtsControlBar";
import { BackupPanel } from "./BackupPanel";
import { TabContainer } from "./common/TabContainer";
import { EmptyState } from "./common/EmptyState";
import type { TypedRpcClient } from "../rpc-client";

interface Props {
  /** RPC 通道状态文本（由 App.tsx 传入，骨架阶段用于显示连通性） */
  rpcStatus?: string;
  /** RPC ping 结果文本 */
  rpcResult?: string | null;
  /** 手动触发 RPC ping 验证 */
  onVerifyRpc?: () => void;
  /** 类型化 RPC 客户端（注入各 Tab 组件） */
  rpc?: TypedRpcClient;
  /** 当前学期 ID */
  semesterId?: string;
  /** 当前课程 ID */
  courseId?: string;
}

/** 根据 activeTabId 渲染对应 Tab 组件 */
function renderTab(
  activeTabId: string,
  rpc: TypedRpcClient | undefined,
  semesterId: string | undefined,
  courseId: string | undefined,
  onNavigateTab: (tabId: string) => void,
  activeSessionId: string | undefined,
): React.JSX.Element {
  switch (activeTabId) {
    case "home":
      return <HomeTab rpc={rpc} semesterId={semesterId} />;
    case "materials":
      return <MaterialsTab rpc={rpc} courseId={courseId} />;
    case "notes":
      return <NotesTab rpc={rpc} courseId={courseId} />;
    case "practice":
      return <PracticeTab rpc={rpc} courseId={courseId} />;
    case "mistakes":
      return <MistakesTab rpc={rpc} courseId={courseId} />;
    case "cram":
      return <CramTab rpc={rpc} courseId={courseId} />;
    case "report":
      return <ReportTab rpc={rpc} semesterId={semesterId} />;
    case "capture":
      return <CaptureTab rpc={rpc} courseId={courseId} />;
    case "backup":
      return <BackupPanel rpc={rpc} />;
    case "chat":
      // T-M3-004：工具卡片跳转接线（09-UI §4.2 + 07-WF §2.8 步骤 3 + E2E-11）
      // AppShell 是 tab 状态持有者，setActiveTabId 注入 ChatTab onNavigateTab
      // T-M3-006：受控 activeSessionId 注入（裁决 5：会话即对话 Tab 内容）
      return <ChatTab rpc={rpc} onNavigateTab={onNavigateTab} activeSessionId={activeSessionId} />;
    default:
      return (
        <TabContainer>
          <EmptyState message="未知标签页" />
        </TabContainer>
      );
  }
}

export function AppShell({
  rpcStatus,
  rpcResult,
  onVerifyRpc,
  rpc,
  semesterId,
  courseId,
}: Props): React.JSX.Element {
  const [activeTabId, setActiveTabId] = useState(DEFAULT_TAB_ID);
  // T-M3-006：选中会话状态 AppShell 提升（裁决 5：会话即对话 Tab 内容，09-UI §7）
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [sidebarSessions, setSidebarSessions] = useState<SessionSidebarItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // T-M3-006：左侧栏会话列表数据源（sessions.list；搜索时走 sessions.search，
  // L3 未建库降级为内存过滤——search handler 返回空数组时不覆盖当前列表）
  React.useEffect(() => {
    if (!rpc) return;
    const method = searchQuery.trim() ? "sessions.search" : "sessions.list";
    void rpc
      .call(method, searchQuery.trim() ? { query: searchQuery.trim() } : {})
      .then((list) => {
        const items = list as SessionSidebarItem[];
        if (method === "sessions.search" && items.length === 0 && searchQuery.trim()) {
          // L3 未建库：降级为内存过滤（sessions.list 全量）
          void rpc
            .call("sessions.list", {})
            .then((all) => {
              const keyword = searchQuery.trim().toLowerCase();
              const filtered = (all as SessionSidebarItem[]).filter(
                (s) =>
                  s.name.toLowerCase().includes(keyword) ||
                  (s.subject ?? "").toLowerCase().includes(keyword) ||
                  (s.goal ?? "").toLowerCase().includes(keyword) ||
                  (s.preview ?? "").toLowerCase().includes(keyword),
              );
              setSidebarSessions(filtered);
            })
            .catch(() => {
              /* 静默失败：保持原列表 */
            });
          return;
        }
        setSidebarSessions(items);
      })
      .catch(() => {
        /* 静默失败：会话列表可空 */
      });
  }, [rpc, searchQuery]);

  function handleNewSession(): void {
    // 裁决 2：新建会话=内存仓库空白会话 + 立即成为当前会话
    // （当前承载层无 create 契约，先置空选中态，发送首条消息时 agent.send 携带新会话）
    setActiveSessionId("sess-new");
  }

  function handleRename(id: string, name: string): void {
    if (!rpc) return;
    void rpc
      .call("sessions.rename", { id, name })
      .then(() => {
        if (!rpc) return;
        void rpc.call("sessions.list", {}).then((list) => {
          setSidebarSessions(list as SessionSidebarItem[]);
        });
      })
      .catch(() => {
        /* 静默失败 */
      });
  }

  function handleDelete(id: string): void {
    if (!rpc) return;
    void rpc
      .call("sessions.delete", { id })
      .then(() => {
        if (activeSessionId === id) setActiveSessionId(undefined);
        if (!rpc) return;
        void rpc.call("sessions.list", {}).then((list) => {
          setSidebarSessions(list as SessionSidebarItem[]);
        });
      })
      .catch(() => {
        /* 静默失败 */
      });
  }

  function handleExport(id: string, format: "md" | "json"): void {
    if (!rpc) return;
    void rpc.call("sessions.export", { id, format }).catch(() => {
      /* 静默失败：导出失败不阻塞 UI */
    });
  }

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
        {/* 左侧栏 — T-M3-006 会话管理 UI（09-UI §3.3 + §7，替换 M0 占位） */}
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
          <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--text, #222)" }}>会话</div>
          <SessionSidebar
            sessions={sidebarSessions}
            query={searchQuery}
            activeId={activeSessionId}
            onNewSession={handleNewSession}
            onSelect={setActiveSessionId}
            onQueryChange={setSearchQuery}
            onRename={handleRename}
            onDelete={handleDelete}
            onExport={handleExport}
          />
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

          {/* TTS 全局控制条（T-M2-008，09-UI §5.1-§5.5） */}
          <TtsControlBar rpc={rpc} />

          {/* Tab 内容：根据 activeTabId 渲染对应业务组件（T-M1-009） */}
          {renderTab(activeTabId, rpc, semesterId, courseId, setActiveTabId, activeSessionId)}

          {/* RPC 通道验证（保留 T-M0-001 连通性检查） */}
          {rpcStatus && activeTabId === DEFAULT_TAB_ID && (
            <div style={{ padding: 16, fontSize: 12 }}>
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
              {rpcResult && <p style={{ marginTop: 4 }}>ping 结果：{rpcResult}</p>}
            </div>
          )}
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
