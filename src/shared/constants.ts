/**
 * pi-studybuddy 跨进程共享常量（03-Arch §6.4 安全骨架 + §6.3 IPC 通道）
 *
 * 被 main/preload/renderer/agent-host 四方引用，保持环境无关（无运行依赖）。
 */

/** renderer ↔ main 的 IPC 通道名 */
export const IPC_CHANNELS = {
  /** renderer 请求建立到 agent-host 的 MessagePort 通道 */
  CONNECT_HOST: "desktop:connect-host",
  /** 目录选择（dialog.showOpenDialog） */
  SELECT_DIRECTORY: "desktop:select-directory",
  /** 通用对话框（open/save/message） */
  SHOW_DIALOG: "desktop:show-dialog",
  /** 查询工具链发现结果 */
  QUERY_TOOLCHAINS: "desktop:query-toolchains",
  /** 窗口最大化状态 */
  GET_WINDOW_STATE: "desktop:get-window-state",
  /** 最小化窗口 */
  MINIMIZE_WINDOW: "desktop:minimize-window",
  /** 最大化/还原窗口 */
  MAXIMIZE_WINDOW: "desktop:maximize-window",
  /** 关闭窗口 */
  CLOSE_WINDOW: "desktop:close-window",
} as const;

/**
 * 严格 CSP（03-Arch §6.4，08-Test §5.7 断言 `default-src 'self'`）。
 * 仅允许自身与 app:// 协议资源，禁止 object/base/frame 等外联。
 */
export const RENDERER_CSP = [
  "default-src 'self' app:",
  "script-src 'self' app:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ");