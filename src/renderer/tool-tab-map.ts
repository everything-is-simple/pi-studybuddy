/**
 * T-M3-004: 工具→目标 Tab 映射纯函数（09-UI §4.1 + 07-WF §2.8 衔接语义）
 *
 * 权威依据：09-UI §4.1（标签页总览 + 主要 RPC 列：daily_brief→首页 /
 * materials.*→资料 / notes.*→笔记 / practice.*→练习 / mistakes.*→错题 /
 * mockExams.*→冲刺 / reports.*→报告 / classCapture.*→采集）
 * + 07-WF §2.8 衔接（对话出题→跳练习 Tab / 上传资料→跳资料 Tab / 请求报告→S6）
 * + T-M3-004 裁决 1（35 工具全覆盖映射表）+ 裁决 1a（backup_* 无目标 Tab：
 * TabBar 仅 9 Tab 无 backup，不渲染跳转按钮，留 T-M3-006）。
 *
 * 纯函数：给定 toolName → { tabId, label } | undefined。无副作用，可单测。
 * TTS 域（朗读控制条全局）与备份域（无 TabBar 入口）返回 undefined → 不渲染跳转。
 */

/** 跳转目标：Tab id + 中文标签（按钮文案 [去<label>]，裁决 3） */
export interface ToolJumpTarget {
  tabId: string;
  label: string;
}

/** 35 工具 → 目标 Tab 映射（key: toolName 后缀 → { tabId, label }） */
const TOOL_TAB_MAP: Readonly<Record<string, ToolJumpTarget>> = {
  // S3 练习域（09-UI §4.1 practice.*→练习 + 07-WF §2.8 出题→练习 Tab）
  generate_questions: { tabId: "practice", label: "练习" },
  submit_practice: { tabId: "practice", label: "练习" },
  get_practice_result: { tabId: "practice", label: "练习" },
  // S2 笔记域（notes.*→笔记；09-UI §4.2 "查看"跳笔记 Tab）
  generate_note: { tabId: "notes", label: "笔记" },
  update_note: { tabId: "notes", label: "笔记" },
  // S2 学习状态（T-M3-004 裁决 1 补录：学习状态语义归笔记 Tab）
  update_learn_status: { tabId: "notes", label: "笔记" },
  // S2 资料域（materials.*→资料；07-WF §2.8 上传→资料 Tab）
  upload_material: { tabId: "materials", label: "资料" },
  convert_material: { tabId: "materials", label: "资料" },
  replace_material_text: { tabId: "materials", label: "资料" },
  // S4 错题域（mistakes.*→错题）
  confirm_error_cause: { tabId: "mistakes", label: "错题" },
  redo_mistake: { tabId: "mistakes", label: "错题" },
  archive_mistake: { tabId: "mistakes", label: "错题" },
  aggregate_weak_point: { tabId: "mistakes", label: "错题" },
  // S5 冲刺域（mockExams.*→冲刺）
  generate_mock_exam: { tabId: "cram", label: "冲刺" },
  submit_mock_exam: { tabId: "cram", label: "冲刺" },
  // S6 报告域（reports.*→报告；07-WF §2.8 请求报告→S6）
  generate_parent_report: { tabId: "report", label: "报告" },
  deliver_parent_report: { tabId: "report", label: "报告" },
  manage_report_targets: { tabId: "report", label: "报告" },
  // S7 采集域（classCapture.*→采集）
  transcribe_class: { tabId: "capture", label: "采集" },
  save_transcription: { tabId: "capture", label: "采集" },
  // S1 首页域（daily_brief→首页 + S1 学习节奏语义）
  init_semester: { tabId: "home", label: "首页" },
  transition_semester: { tabId: "home", label: "首页" },
  add_exam: { tabId: "home", label: "首页" },
  confirm_exam: { tabId: "home", label: "首页" },
  complete_task: { tabId: "home", label: "首页" },
  daily_brief: { tabId: "home", label: "首页" },
  // S1-OCR（课表识别 → 首页学习节奏语义）
  ocr_schedule: { tabId: "home", label: "首页" },
};

/** 无目标 Tab 工具后缀白名单（tts 域朗读控制条全局 / backup 域 TabBar 无入口，裁决 1/1a） */
const NO_JUMP_TOOL_SUFFIXES = [
  // TTS 域 3 工具
  "tts_speak",
  "tts_control",
  "tts_switch_engine",
  // 备份域 5 工具（TabBar 仅 9 Tab 无 backup，留 T-M3-006）
  "backup_course",
  "backup_all_courses",
  "restore_course",
  "list_backups",
  "configure_backup_schedule",
];

/**
 * 工具名 → 跳转目标（undefined = 无目标 Tab，不渲染跳转按钮）。
 * 白名单语义：仅 TOOL_TAB_MAP 命中返回目标；未知工具与 tts/backup 域返回 undefined。
 */
export function toolJumpTarget(toolName: string): ToolJumpTarget | undefined {
  if (!toolName.startsWith("studybuddy_")) return undefined;
  const suffix = toolName.slice("studybuddy_".length);
  if (NO_JUMP_TOOL_SUFFIXES.includes(suffix)) return undefined;
  return TOOL_TAB_MAP[suffix];
}

/** 跳转按钮文案辅助：[去<label>]（裁决 3 统一文案，供 ChatTab 渲染） */
export function jumpButtonLabel(toolName: string): string | undefined {
  const target = toolJumpTarget(toolName);
  return target ? `去${target.label}` : undefined;
}
