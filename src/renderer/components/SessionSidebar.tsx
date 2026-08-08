/**
 * SessionSidebar 会话管理 UI（T-M3-006，09-UI §3.3 + §7 + §11.2）
 *
 * 借鉴 pi-desktop SessionSidebar.tsx 业务化（03-Arch §6.7）：
 *   - 按日期分组：今天 / 昨天 / 本周（09-UI §3.3）
 *   - 模糊搜索输入框：学科+目标+内容（sessions.search；L3 未建库时由
 *     AppShell/ChatTab 降级为 sessions.list 内存过滤）
 *   - 学科标签颜色标识（subjectColor 纯函数：数学=蓝/英语=红/…）
 *   - unread 计数徽标（SessionSummary.unread?，无后台事件源时仅展示）
 *   - 新建会话入口（Ctrl+N，09-UI §11.2）
 *   - 会话操作：重命名（inline 编辑回调）/ 删除（确认回调）/ 导出（md|json）
 *
 * 安全（AGENTS.md §9.3）：只渲染脱敏元数据，不展示完整 UUID/API key。
 * 静态渲染测试通过 props 注入 sessions/query/now 确定性断言。
 */
import React from "react";
import type { SessionSummary } from "../../contract/types";

/** 会话条目（SessionSidebar 内部展示模型，脱敏后字段） */
export interface SessionSidebarItem {
  id: string;
  name: string;
  updatedAt: string;
  preview?: string;
  subject?: string;
  goal?: string;
  unread?: number;
}

/** 学科标签颜色（09-UI §3.3 学科标签颜色标识；未知学科回退灰） */
export function subjectColor(subject: string): string {
  switch (subject) {
    case "高数":
    case "数学":
      return "#1a5fb4"; // 数学=蓝
    case "物理":
      return "#2e8b57"; // 物理=绿
    case "化学":
      return "#c01c28"; // 化学=红
    case "英语":
      return "#c01c28"; // 英语=红
    case "语文":
      return "#8b4513"; // 语文=棕
    default:
      return "#888888";
  }
}

/** 日期分组：今天 / 昨天 / 本周（基于 now，测试可注入确定性日期） */
export function groupLabel(updatedAt: string, now: Date): "今天" | "昨天" | "本周" | null {
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return null;
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((nowDay - day) / 86_400_000);
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays >= 2 && diffDays < 7) return "本周";
  return null;
}

interface Props {
  /** 会话列表（脱敏元数据；数据源 sessions.list / sessions.search 降级） */
  sessions: SessionSidebarItem[];
  /** 搜索关键词（受控，AppShell 持有） */
  query: string;
  /** 选中会话 id（09-UI §7：左侧栏选中 → 主区对话 Tab 加载该会话） */
  activeId?: string;
  /** 分组基准时间（测试注入确定性；默认当前时间） */
  now?: Date;
  /** 新建会话（09-UI §11.2 Ctrl+N） */
  onNewSession(): void;
  onSelect(id: string): void;
  /** 搜索关键词变更（受控，AppShell 持有 query） */
  onQueryChange(query: string): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
  onExport(id: string, format: "md" | "json"): void;
}

export function SessionSidebar({
  sessions,
  query,
  activeId,
  now,
  onNewSession,
  onSelect,
  onQueryChange,
  onRename,
  onDelete,
  onExport,
}: Props): React.JSX.Element {
  const base = now ?? new Date();
  const groups: Array<{ label: "今天" | "昨天" | "本周" | null; items: SessionSidebarItem[] }> = [
    { label: "今天", items: [] },
    { label: "昨天", items: [] },
    { label: "本周", items: [] },
  ];
  for (const s of sessions) {
    const g = groupLabel(s.updatedAt, base);
    if (g) groups.find((x) => x.label === g)?.items.push(s);
  }
  const hasGroups = groups.some((g) => g.items.length > 0);

  return (
    <div style={{ fontSize: 12 }}>
      {/* 搜索框（09-UI §3.3 模糊搜索：学科+目标+内容） */}
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="搜索会话（学科+目标+内容）"
        aria-label="搜索会话"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "6px 8px",
          marginBottom: 8,
          fontSize: 12,
          border: "1px solid var(--border, #e0e0e0)",
          borderRadius: 6,
          background: "var(--bg, #ffffff)",
          color: "var(--text, #222)",
        }}
      />

      {/* 新建会话（09-UI §11.2 Ctrl+N） */}
      <button
        type="button"
        onClick={onNewSession}
        style={{
          width: "100%",
          padding: "6px 8px",
          marginBottom: 8,
          fontSize: 12,
          cursor: "pointer",
          border: "1px dashed var(--border, #e0e0e0)",
          background: "transparent",
          borderRadius: 6,
          color: "var(--accent-strong, #1a5fb4)",
        }}
      >
        ＋ 新建会话
      </button>

      {!hasGroups ? (
        <div style={{ color: "var(--text-muted, #888)", padding: "12px 0", textAlign: "center" }}>
          暂无会话
        </div>
      ) : (
        groups.map((g) =>
          g.items.length === 0 ? null : (
            <div key={g.label} style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 4,
                  color: "var(--text-muted, #888)",
                }}
              >
                {g.label}
              </div>
              {g.items.map((s) => (
                <div
                  key={s.id}
                  data-active={s.id === activeId ? "true" : undefined}
                  onClick={() => onSelect(s.id)}
                  style={{
                    padding: "6px 8px",
                    marginBottom: 4,
                    borderRadius: 6,
                    cursor: "pointer",
                    background: s.id === activeId ? "var(--accent, #e8f0fe)" : "var(--bg-panel, #f5f5f5)",
                    border: s.id === activeId ? "1px solid var(--accent-strong, #1a5fb4)" : "1px solid transparent",
                    color: "var(--text, #222)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {s.subject ? (
                      <span
                        title={`学科：${s.subject}`}
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          background: subjectColor(s.subject),
                          flexShrink: 0,
                        }}
                      />
                    ) : null}
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.name}
                    </span>
                    {s.unread !== undefined && s.unread > 0 ? (
                      <span
                        title="未读"
                        style={{
                          padding: "0 6px",
                          borderRadius: 8,
                          background: "#c01c28",
                          color: "#ffffff",
                          fontSize: 10,
                        }}
                      >
                        {s.unread}
                      </span>
                    ) : null}
                  </div>
                  {s.preview ? (
                    <div
                      style={{
                        color: "var(--text-muted, #888)",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.preview}
                    </div>
                  ) : null}
                  {/* 会话操作：重命名 / 删除 / 导出（09-UI §7 会话管理） */}
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <button
                      type="button"
                      aria-label={`重命名 ${s.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const name = window.prompt("重命名会话", s.name);
                        if (name && name.trim()) onRename(s.id, name.trim());
                      }}
                      style={actionButtonStyle}
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      aria-label={`导出 ${s.name}`}
                      title="导出（md / json）"
                      onClick={(e) => {
                        e.stopPropagation();
                        const format = window.confirm("导出为 JSON 格式？[确定=json / 取消=md]")
                          ? "json"
                          : "md";
                        onExport(s.id, format);
                      }}
                      style={actionButtonStyle}
                    >
                      导出
                    </button>
                    <button
                      type="button"
                      aria-label={`删除 ${s.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`确认删除会话「${s.name}」？`)) onDelete(s.id);
                      }}
                      style={{ ...actionButtonStyle, color: "#c01c28" }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ),
        )
      )}
    </div>
  );
}

const actionButtonStyle: React.CSSProperties = {
  padding: "1px 6px",
  fontSize: 11,
  cursor: "pointer",
  border: "1px solid var(--border, #e0e0e0)",
  background: "transparent",
  borderRadius: 4,
  color: "var(--text-muted, #666)",
};
