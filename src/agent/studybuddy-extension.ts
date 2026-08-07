/**
 * pi-studybuddy 扩展层入口（03-Arch §2.1）
 *
 * 单一扩展工厂 createStudyBuddyExtension() 接入 pi 内核，对应 inno-agent 的
 * createInnoExtension() 范式。pi 底座 ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>
 * （pi types.ts:1518），本工厂返回该签名的空实现。
 *
 * 空壳范围（T-M0-007）：setup 可调用但**无任何业务工具/钩子/provider**。
 * 业务能力由 M1+ 任务逐步接入：
 *   - S1-S7 + TTS + 备份恢复 工具注册（03-Arch §2.2 registerTool，工具名前缀 studybuddy_*）
 *   - before_agent_start / tool_call / tool_result / model_select / turn_end 钩子（03-Arch §2.3）
 *   - pi-ai provider 注入（03-Arch §2.4 registerProvider）
 *   - Simple Mode 总开关（03-Arch §2.5）
 *
 * 类型命名说明：03-Arch §2.1 伪代码写 createStudyBuddyExtension(): PiExtension，
 * 但 pi 底座无 PiExtension 类型——实际类型为 ExtensionFactory。本实现采用 ExtensionFactory，
 * 不偏离 03-Arch §2.1 "单一扩展工厂" 的权威意图。
 */

import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";

/** 扩展标识（03-Arch §2.1 name 字段，pi 启动 Extensions 列表显示名） */
export const STUDYBUDDY_EXTENSION_NAME = "pi-studybuddy";

/**
 * 创建 pi-studybuddy 扩展工厂。
 *
 * 返回 pi ExtensionFactory：setup(pi) 空实现，不注册任何工具/钩子/provider。
 * M1+ 任务在此 setup 内逐步接入业务能力。
 */
export function createStudyBuddyExtension(): ExtensionFactory {
  return async (_pi: ExtensionAPI): Promise<void> => {
    // 空壳：不注册工具、不订阅钩子、不注入 provider。
    // _pi 前缀表示当前未使用，M1+ 业务任务接入时移除前缀并调用 pi.registerTool / pi.on 等。
  };
}
