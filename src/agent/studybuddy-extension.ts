/**
 * pi-studybuddy 扩展层入口（03-Arch §2.1）
 *
 * 单一扩展工厂 createStudyBuddyExtension() 接入 pi 内核，对应 inno-agent 的
 * createInnoExtension() 范式。pi 底座 ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>
 * （pi types.ts:1518），本工厂返回该签名的实现。
 *
 * 当前范围（T-M2-001）：
 *   - S1 学习节奏 6 个 studybuddy_* 工具注册（03-Arch §3.1 + §2.2 registerTool）
 *   - S2 资料笔记 6 个 studybuddy_* 工具注册
 *   - S3 限时练习 3 个 studybuddy_* 工具注册
 *   - S4 错题/薄弱点 4 个 studybuddy_* 工具注册
 *   - S5 期末冲刺 2 个 studybuddy_* 工具注册
 *   - 通过各 S*Context 注入数据层句柄（业务数据根由环境变量或默认路径决定）
 *
 * 后续任务接入：
 *   - S6-S7 + TTS + 备份恢复 工具注册
 *   - before_agent_start / tool_call / tool_result / model_select / turn_end 钩子（03-Arch §2.3）
 *   - pi-ai provider 注入（03-Arch §2.4 registerProvider）
 *   - Simple Mode 总开关（03-Arch §2.5）
 *
 * 类型命名说明：03-Arch §2.1 伪代码写 createStudyBuddyExtension(): PiExtension，
 * 但 pi 底座无 PiExtension 类型——实际类型为 ExtensionFactory。本实现采用 ExtensionFactory，
 * 不偏离 03-Arch §2.1 "单一扩展工厂" 的权威意图。
 */

import path from "node:path";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { S1Context } from "../agent-host/handlers/s1/context";
import { S2Context } from "../agent-host/handlers/s2/context";
import { S3Context } from "../agent-host/handlers/s3/context";
import { S4Context } from "../agent-host/handlers/s4/context";
import { S5Context } from "../agent-host/handlers/s5/context";
import { createS1Tools } from "./tools/s1/tools";
import { createS2Tools } from "./tools/s2/tools";
import { createS3Tools } from "./tools/s3/tools";
import { createS4Tools } from "./tools/s4/tools";
import { createS5Tools } from "./tools/s5/tools";

/** 扩展标识（03-Arch §2.1 name 字段，pi 启动 Extensions 列表显示名） */
export const STUDYBUDDY_EXTENSION_NAME = "pi-studybuddy";

/**
 * 解析业务数据根目录（01-TRD §7 决策 3 数据隔离）。
 *
 * 优先级：
 *   1. PI_STUDYBUDDY_DATA_ROOT 环境变量（测试注入隔离目录）
 *   2. %LOCALAPPDATA%\PiStudyBuddy（Windows 默认业务数据根）
 */
function resolveDataRoot(): string {
  const envRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
  if (envRoot) return envRoot;
  const localAppData = process.env.LOCALAPPDATA ?? path.join(process.cwd(), ".data");
  return path.join(localAppData, "PiStudyBuddy");
}

/**
 * 创建 pi-studybuddy 扩展工厂。
 *
 * setup(pi) 在 pi 启动时被调用：
 *   1. 解析业务数据根目录
 *   2. 创建 S1Context + S2Context（管理 global.db / semester.db 句柄）
 *   3. 注册 S1 学习节奏 6 个 studybuddy_* 工具
 *   4. 注册 S2 资料笔记 6 个 studybuddy_* 工具
 *
 * 后续 M1+ 任务在 setup 内逐步接入 S3-S7 + TTS + 备份恢复工具。
 */
export function createStudyBuddyExtension(): ExtensionFactory {
  return async (pi: ExtensionAPI): Promise<void> => {
    const dataRoot = resolveDataRoot();
    const s1Ctx = new S1Context(dataRoot);
    const s2Ctx = new S2Context(dataRoot);
    const s3Ctx = new S3Context(dataRoot);
    const s4Ctx = new S4Context(dataRoot);
    const s5Ctx = new S5Context(dataRoot);

    // 注册 S1 学习节奏 6 个工具（03-Arch §3.1）
    const s1Tools = createS1Tools(s1Ctx);
    for (const tool of s1Tools) {
      pi.registerTool(tool);
    }

    // 注册 S2 资料笔记 6 个工具（03-Arch §3.1）
    const s2Tools = createS2Tools(s2Ctx);
    for (const tool of s2Tools) {
      pi.registerTool(tool);
    }

    // 注册 S3 限时练习 3 个工具（03-Arch §3.1）
    const s3Tools = createS3Tools(s3Ctx);
    for (const tool of s3Tools) {
      pi.registerTool(tool);
    }

    // 注册 S4 错题/薄弱点 4 个工具（03-Arch §3.1）
    const s4Tools = createS4Tools(s4Ctx);
    for (const tool of s4Tools) {
      pi.registerTool(tool);
    }

    // 注册 S5 期末冲刺 2 个工具（03-Arch §3.1）
    const s5Tools = createS5Tools(s5Ctx);
    for (const tool of s5Tools) {
      pi.registerTool(tool);
    }
  };
}
