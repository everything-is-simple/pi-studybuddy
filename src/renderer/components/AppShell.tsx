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
import React, { useReducer, useState } from "react";
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
import { SettingsPage, isSettingsShortcut } from "./SettingsPage";
import { TabContainer } from "./common/TabContainer";
import { EmptyState } from "./common/EmptyState";
import type { CourseInstance, Semester } from "../../contract/types";
import type { TypedRpcClient } from "../rpc-client";
import { SemesterCourseTree } from "./SemesterCourseTree";
import {
  SemesterCourseRequestGate,
  applyCourseLoadResult,
  createInitialSemesterCourseState,
  deriveAcademicContext,
  formatAcademicTitle,
  loadCoursesForSemester,
  loadSemesters,
  semesterCourseReducer,
  type CourseLoadState,
  type SemesterCourseContext,
  type SemesterLoadState,
} from "../semester-course-state";

export interface AppShellViewState {
  activeTabId: string;
  settingsOpen: boolean;
}

export type AppShellViewAction =
  | { type: "selectTab"; tabId: string }
  | { type: "openSettings" }
  | { type: "closeSettings" };

/** 设置是独立页面；仅切换页面状态，不得覆盖当前工作台 Tab。 */
export function initialAppShellViewState(): AppShellViewState {
  return { activeTabId: DEFAULT_TAB_ID, settingsOpen: false };
}

export function appShellViewReducer(state: AppShellViewState, action: AppShellViewAction): AppShellViewState {
  switch (action.type) {
    case "selectTab":
      return { ...state, activeTabId: action.tabId };
    case "openSettings":
      return { ...state, settingsOpen: true };
    case "closeSettings":
      return { ...state, settingsOpen: false };
  }
}

/**
 * T-M4-007 只负责把归档学期明确呈现为只读浏览。
 * 现有工作台尚未接线学期业务写 RPC；对应写入口将在后续业务接线任务中按所在组件的真实写操作逐一禁用，
 * 避免在本任务对无关的会话、设置或占位控件实行错误拦截。
 */
function AcademicReadOnlyNotice({ context }: { context: SemesterCourseContext }): React.JSX.Element | null {
  if (!context.isReadOnly) return null;
  return (
    <div role="status" style={{ padding: "8px 16px 0", color: "var(--text-muted, #667085)", fontSize: 12 }}>
      当前学期已归档，工作台仅支持浏览。
    </div>
  );
}

interface Props {
  /** RPC 通道状态文本（由 App.tsx 传入，骨架阶段用于显示连通性） */
  rpcStatus?: string;
  /** RPC ping 结果文本 */
  rpcResult?: string | null;
  /** 手动触发 RPC ping 验证 */
  onVerifyRpc?: () => void;
  /** 类型化 RPC 客户端（注入各 Tab 组件） */
  rpc?: TypedRpcClient;
}

/** 根据 activeTabId 渲染对应 Tab 组件 */
function renderTab(
  activeTabId: string,
  rpc: TypedRpcClient | undefined,
  semesterId: string | undefined,
  courseId: string | undefined,
  academicContext: SemesterCourseContext,
  onNavigateTab: (tabId: string) => void,
  activeSessionId: string | undefined,
): React.JSX.Element {
  switch (activeTabId) {
    case "home":
      return <HomeTab rpc={rpc} semesterId={semesterId} academicContext={academicContext} />;
    case "materials":
      return <MaterialsTab rpc={rpc} courseId={courseId} academicContext={academicContext} />;
    case "notes":
      return <NotesTab rpc={rpc} courseId={courseId} academicContext={academicContext} />;
    case "practice":
      return <PracticeTab rpc={rpc} courseId={courseId} academicContext={academicContext} />;
    case "mistakes":
      return <MistakesTab rpc={rpc} courseId={courseId} academicContext={academicContext} />;
    case "cram":
      return <CramTab rpc={rpc} courseId={courseId} academicContext={academicContext} />;
    case "report":
      return <ReportTab rpc={rpc} semesterId={semesterId} academicContext={academicContext} />;
    case "capture":
      return <CaptureTab rpc={rpc} courseId={courseId} academicContext={academicContext} />;
    case "backup":
      return <BackupPanel rpc={rpc} />;
    case "chat":
      // T-M3-004：工具卡片跳转接线（09-UI §4.2 + 07-WF §2.8 步骤 3 + E2E-11）
      // AppShell 是 tab 状态持有者，setActiveTabId 注入 ChatTab onNavigateTab
      // T-M3-006：受控 activeSessionId 注入（裁决 5：会话即对话 Tab 内容）
      return <ChatTab rpc={rpc} academicContext={academicContext} onNavigateTab={onNavigateTab} activeSessionId={activeSessionId} />;
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
}: Props): React.JSX.Element {
  const [viewState, dispatchView] = useReducer(appShellViewReducer, undefined, initialAppShellViewState);
  const { activeTabId, settingsOpen } = viewState;
  // T-M3-006：选中会话状态 AppShell 提升（裁决 5：会话即对话 Tab 内容，09-UI §7）
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [sidebarSessions, setSidebarSessions] = useState<SessionSidebarItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const sessionRequestIdRef = React.useRef(0);
  // T-M4-007：AppShell 持有唯一学期/课程上下文；不向各 Tab 分散复制选择状态。
  const [semesterCourseState, dispatchSemesterCourse] = useReducer(
    semesterCourseReducer,
    undefined,
    createInitialSemesterCourseState,
  );
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterLoadState, setSemesterLoadState] = useState<SemesterLoadState>("idle");
  const [courseStates, setCourseStates] = useState<Record<string, CourseLoadState>>({});
  // 归档只读状态始终从当前学期列表派生，保持学期/课程选择只有一个状态源。
  const academicContext = deriveAcademicContext(semesterCourseState.context, semesters);
  // 请求门闩与 mounted 标记共同阻止快速切换或卸载后的异步结果污染最新 UI。
  const courseRequestGateRef = React.useRef(new SemesterCourseRequestGate());
  const mountedRef = React.useRef(true);
  // 09-UI §13.3：Ctrl+, 从任意学习工作台打开设置；activeTabId 保持不变，返回时自然恢复。
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isSettingsShortcut(event)) return;
      event.preventDefault();
      dispatchView({ type: "openSettings" });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // T-M3-006：左侧栏会话列表数据源（sessions.list；搜索时走 sessions.search，
  // L3 未建库降级为内存过滤——search handler 返回空数组时不覆盖当前列表）
  React.useEffect(() => {
    const requestId = ++sessionRequestIdRef.current;
    let cancelled = false;
    if (!rpc) return () => {
      cancelled = true;
    };
    const method = searchQuery.trim() ? "sessions.search" : "sessions.list";
    void rpc
      .call(method, searchQuery.trim() ? { query: searchQuery.trim() } : {})
      .then((list) => {
        if (cancelled || requestId !== sessionRequestIdRef.current) return;
        const items = list as SessionSidebarItem[];
        if (method === "sessions.search" && items.length === 0 && searchQuery.trim()) {
          // L3 未建库：降级为内存过滤（sessions.list 全量）
          void rpc
            .call("sessions.list", {})
            .then((all) => {
              if (cancelled || requestId !== sessionRequestIdRef.current) return;
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
    return () => {
      cancelled = true;
    };
  }, [rpc, searchQuery]);

  // T-M4-007：卸载后统一使课程请求令牌过期，异步回调不会写入已销毁组件。
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      courseRequestGateRef.current.invalidate();
    };
  }, []);

  // T-M4-007：仅使用既有 semesters.list；错误消息在树组件中固定中文展示，不传递原始异常。
  React.useEffect(() => {
    let cancelled = false;
    if (!rpc) {
      setSemesters([]);
      setSemesterLoadState("idle");
      return () => {
        cancelled = true;
      };
    }

    setSemesterLoadState("loading");
    void loadSemesters(rpc)
      .then((items) => {
        if (cancelled || !mountedRef.current) return;
        setSemesters(items);
        setSemesterLoadState("ready");
      })
      .catch(() => {
        if (cancelled || !mountedRef.current) return;
        setSemesters([]);
        setSemesterLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [rpc]);

  /** 展开学期时绑定 semesterId 调用既有 courses.list，并拒绝过期响应。 */
  function handleToggleSemester(semesterId: string): void {
    const wasExpanded = semesterCourseState.expandedSemesterIds.includes(semesterId);
    dispatchSemesterCourse({ type: "toggleSemester", semesterId });
    if (wasExpanded || courseStates[semesterId]?.status === "ready") return;

    if (!rpc) {
      setCourseStates((current) => ({ ...current, [semesterId]: { status: "error", courses: [] } }));
      return;
    }

    const request = courseRequestGateRef.current.begin(semesterId);
    setCourseStates((current) => ({ ...current, [semesterId]: { status: "loading", courses: [] } }));
    void loadCoursesForSemester(rpc, semesterId)
      .then((courses) => {
        if (!mountedRef.current || !courseRequestGateRef.current.isCurrent(request)) return;
        setCourseStates((current) =>
          applyCourseLoadResult(current, courseRequestGateRef.current, request, { status: "ready", courses }),
        );
      })
      .catch(() => {
        if (!mountedRef.current || !courseRequestGateRef.current.isCurrent(request)) return;
        setCourseStates((current) =>
          applyCourseLoadResult(current, courseRequestGateRef.current, request, { status: "error", courses: [] }),
        );
      });
  }

  /** 课程选择只更新 AppShell 唯一上下文，既有工作台 Tab 通过 renderTab 接收该值。 */
  function handleSelectCourse(semesterId: string, courseId: string): void {
    dispatchSemesterCourse({ type: "selectCourse", semesterId, courseId });
  }

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
        {/* T-M4-007：标题从 AppShell 唯一选择上下文解析，绝不显示内部 ID 或路径。 */}
        <span style={{ color: "var(--text-muted, #888)", fontWeight: 400 }}>
          {formatAcademicTitle(
            semesterCourseState.context,
            semesters,
            Object.fromEntries(Object.entries(courseStates).map(([id, state]) => [id, state.courses])) as Record<string, CourseInstance[]>,
          )}
        </span>
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
          {/* T-M4-007：学期树位于会话之前，组成“学期 / 会话 / 设置”三级左侧导航。 */}
          <SemesterCourseTree
            semesters={semesters}
            semesterLoadState={semesterLoadState}
            expandedSemesterIds={semesterCourseState.expandedSemesterIds}
            courseStates={courseStates}
            context={academicContext}
            onToggleSemester={handleToggleSemester}
            onSelectCourse={handleSelectCourse}
          />
          <div style={{ fontWeight: 600, margin: "14px 0 8px", color: "var(--text, #222)" }}>会话</div>
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
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border, #e0e0e0)" }}>
            <button
              type="button"
              aria-label="打开设置"
              onClick={() => dispatchView({ type: "openSettings" })}
              style={{
                width: "100%",
                padding: "7px 8px",
                border: "1px solid var(--border, #e0e0e0)",
                borderRadius: 6,
                background: settingsOpen ? "var(--accent, #e8f0fe)" : "transparent",
                color: "var(--text, #222)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              ⚙ 设置
            </button>
          </div>
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
          {settingsOpen ? (
            <SettingsPage rpc={rpc} onClose={() => dispatchView({ type: "closeSettings" })} />
          ) : (
            <>
              {/* TabBar：固定 9 个学习工作台 Tab（设置不在其中）。 */}
              <TabBar tabs={TABS} activeTabId={activeTabId} onSelectTab={(tabId) => dispatchView({ type: "selectTab", tabId })} />

              {/* TTS 全局控制条（T-M2-008，09-UI §5.1-§5.5） */}
              <TtsControlBar rpc={rpc} />

              {/* T-M4-007：归档上下文只读提示；具体业务写入口尚属后续 S1-S7 接线任务。 */}
              <AcademicReadOnlyNotice context={academicContext} />
              {renderTab(
                activeTabId,
                rpc,
                academicContext.semesterId,
                academicContext.courseId,
                academicContext,
                (tabId) => dispatchView({ type: "selectTab", tabId }),
                activeSessionId,
              )}

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
            </>
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
