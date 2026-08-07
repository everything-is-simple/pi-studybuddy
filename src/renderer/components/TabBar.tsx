/**
 * pi-studybuddy TabBar 组件（09-UI §4.1 标签页栏）
 *
 * 主内容区顶部标签页栏，9 个 Tab 空壳。
 * 💬 对话为默认激活 Tab（09-UI §4.2 铁律）。
 * M0 骨架阶段仅切换激活态，不挂接业务 RPC。
 */
import React from "react";
import type { TabDef } from "../tabs";

interface Props {
  tabs: TabDef[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
}

export function TabBar({ tabs, activeTabId, onSelectTab }: Props): React.JSX.Element {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        alignItems: "flex-end",
        flexShrink: 0,
        height: 36,
        background: "var(--bg-panel, #f5f5f5)",
        overflowX: "auto",
        borderBottom: "1px solid var(--border, #e0e0e0)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 36,
              padding: "0 12px",
              border: "none",
              borderRight: "1px solid var(--border, #e0e0e0)",
              background: isActive ? "var(--bg, #ffffff)" : "var(--bg-panel, #f5f5f5)",
              color: isActive ? "var(--text, #222)" : "var(--text-muted, #888)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: isActive ? 500 : 400,
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "background 0.1s, color 0.1s",
            }}
          >
            <span style={{ fontSize: 14 }}>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
