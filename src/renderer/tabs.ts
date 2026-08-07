/**
 * pi-studybuddy 标签页定义（09-UI §4.1）
 *
 * 9 个 Tab 对应学习工作台功能分区。💬 对话为默认 Tab（09-UI §4.2 铁律）。
 * M0 骨架阶段仅定义数据，不挂接业务 RPC。
 */

export interface TabDef {
  id: string;
  emoji: string;
  label: string;
}

export const TABS: TabDef[] = [
  { id: "chat", emoji: "💬", label: "对话" },
  { id: "home", emoji: "📊", label: "首页" },
  { id: "materials", emoji: "📁", label: "资料" },
  { id: "notes", emoji: "📝", label: "笔记" },
  { id: "practice", emoji: "✏️", label: "练习" },
  { id: "mistakes", emoji: "❌", label: "错题" },
  { id: "cram", emoji: "🎯", label: "冲刺" },
  { id: "report", emoji: "📋", label: "报告" },
  { id: "capture", emoji: "🎤", label: "采集" },
];

export const DEFAULT_TAB_ID = "chat";
