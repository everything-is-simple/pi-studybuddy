/**
 * pi-studybuddy 扩展层入口（03-Arch §2.1）
 *
 * 单一扩展工厂 createStudyBuddyExtension() 接入 pi 内核，对应 inno-agent 的
 * createInnoExtension() 范式。pi 底座 ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>
 * （pi types.ts:1518），本工厂返回该签名的实现。
 *
 * 当前范围（T-M2-005）：
 *   - S1 学习节奏 6 个 studybuddy_* 工具注册（03-Arch §3.1 + §2.2 registerTool）
 *   - S2 资料笔记 6 个 studybuddy_* 工具注册
 *   - S3 限时练习 3 个 studybuddy_* 工具注册
 *   - S4 错题/薄弱点 4 个 studybuddy_* 工具注册
 *   - S5 期末冲刺 2 个 studybuddy_* 工具注册
 *   - S6 家长报告 3 个 studybuddy_* 工具注册
 *   - S7 课堂采集 2 个 studybuddy_* 工具注册
 *   - TTS 朗读 3 个 studybuddy_* 工具注册（SAPI 默认 + edge-tts 降级）
 *   - 备份恢复 5 个 studybuddy_* 工具注册（zip 打包/解包 + content_hash + integrity_check + 调度配置）
 *   - 通过各 S*Context 注入数据层句柄（业务数据根由环境变量或默认路径决定）
 *
 * 后续任务接入：
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
import { S6Context } from "../agent-host/handlers/s6/context";
import { S7Context } from "../agent-host/handlers/s7/context";
import { createRealWhisperAdapter } from "../agent-host/handlers/s7/whisper-adapter";
import { TtsContext } from "../agent-host/handlers/tts/context";
import { BackupContext } from "../agent-host/handlers/backup/context";
import { createS1Tools } from "./tools/s1/tools";
import { createOcrTools } from "./tools/s1/ocr-tools";
import { createS2Tools } from "./tools/s2/tools";
import { createS3Tools } from "./tools/s3/tools";
import { createS4Tools } from "./tools/s4/tools";
import { createS5Tools } from "./tools/s5/tools";
import { createS6Tools } from "./tools/s6/tools";
import { createS7Tools } from "./tools/s7/tools";
import { createTtsTools } from "./tools/tts/tools";
import { createBackupTools } from "./tools/backup/tools";
import { checkWorkspaceMutationPath } from "./workspace-path-guard";
import { buildStudyContextSections } from "./context-pack";
import { createObservability, registerToolResultLogging } from "./observability";
import { initMemoryL1 } from "../data/memory";

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
 * 创建 pi-studybuddy 扩展工厂的可选配置（T-M2-007 whisper.cpp 真实 Adapter 接入）。
 *
 * whisper 配置优先级（03-Arch §3.3 CLI/模型路径只来自配置，不猜路径不回退云端）：
 *   调用参数 options.whisperCliPath > 环境变量 PI_STUDYBUDDY_WHISPER_CLI > 空（默认 mock）
 *   调用参数 options.whisperModelPath > 环境变量 PI_STUDYBUDDY_WHISPER_MODEL > 空（默认 mock）
 *
 * 无路径配置 → 默认 mock（08-Test §5.4 测试环境不连真实 whisper.cpp）。
 */
export interface StudyBuddyExtensionOptions {
  whisperCliPath?: string;
  whisperModelPath?: string;
}

/**
 * 创建 pi-studybuddy 扩展工厂。
 *
 * setup(pi) 在 pi 启动时被调用：
 *   1. 解析业务数据根目录
 *   2. 创建 S1Context + S2Context（管理 global.db / semester.db 句柄）
 *   3. 注册 S1 学习节奏 6 个 studybuddy_* 工具
 *   4. 注册 S2 资料笔记 6 个 studybuddy_* 工具
 *   5. 注册 S3-S7 + TTS + 备份恢复 工具
 *
 * 工具总数：S1 6 + OCR 1 + S2 6 + S3 3 + S4 4 + S5 2 + S6 3 + S7 2 + TTS 3 + 备份恢复 5 = 35。
 */
export function createStudyBuddyExtension(
  options?: StudyBuddyExtensionOptions,
): ExtensionFactory {
  return async (pi: ExtensionAPI): Promise<void> => {
    const dataRoot = resolveDataRoot();
    const s1Ctx = new S1Context(dataRoot);
    const s2Ctx = new S2Context(dataRoot);
    const s3Ctx = new S3Context(dataRoot);
    const s4Ctx = new S4Context(dataRoot);
    const s5Ctx = new S5Context(dataRoot);
    const s6Ctx = new S6Context(dataRoot);

    // T-M2-007 whisper.cpp 真实 Adapter 装配（03-Arch §3.3 + 08-Test §5.4）
    // 调用参数 > 环境变量 > 空；有 cliPath+modelPath 才走真实，否则默认 mock
    const whisperCliPath =
      options?.whisperCliPath ?? process.env.PI_STUDYBUDDY_WHISPER_CLI ?? "";
    const whisperModelPath =
      options?.whisperModelPath ?? process.env.PI_STUDYBUDDY_WHISPER_MODEL ?? "";
    const s7Ctx = new S7Context(dataRoot, {
      whisperCliPath,
      whisperModelPath,
      whisperAdapter:
        whisperCliPath && whisperModelPath
          ? createRealWhisperAdapter({ cliPath: whisperCliPath, modelPath: whisperModelPath })
          : undefined, // 默认 mock（08-Test §5.4）
    });
    const ttsCtx = new TtsContext();
    const backupCtx = new BackupContext(dataRoot);

    // 注册 S1 学习节奏 6 个工具（03-Arch §3.1）
    const s1Tools = createS1Tools(s1Ctx);
    for (const tool of s1Tools) {
      pi.registerTool(tool);
    }

    // 注册 S1 OCR 课程表识别 1 个工具（03-Arch §3.1 + §5.3 studybuddy-ocr-schedule）
    const ocrTools = createOcrTools();
    for (const tool of ocrTools) {
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

    // 注册 S6 家长报告 3 个工具（03-Arch §3.1）
    const s6Tools = createS6Tools(s6Ctx);
    for (const tool of s6Tools) {
      pi.registerTool(tool);
    }

    // 注册 S7 课堂采集 2 个工具（03-Arch §3.1）
    const s7Tools = createS7Tools(s7Ctx);
    for (const tool of s7Tools) {
      pi.registerTool(tool);
    }

    // 注册 TTS 朗读 3 个工具（03-Arch §3.1 + §3.3 外部桥 Adapter）
    const ttsTools = createTtsTools(ttsCtx);
    for (const tool of ttsTools) {
      pi.registerTool(tool);
    }

    // 注册备份恢复 5 个工具（03-Arch §3.1 + 07-WF §5 + 05-ERD §8）
    const backupTools = createBackupTools(backupCtx);
    for (const tool of backupTools) {
      pi.registerTool(tool);
    }

    // ── T-M1-008 跨切钩子注册（03-Arch §2.3）────────────────────────────
    // before_agent_start：多源上下文注入（L1 画像 + 激活学期/课程 + 最近事件）
    pi.on("before_agent_start", async (event) => {
      const { sections } = await buildStudyContextSections({ dataRoot });
      if (sections.length === 0) return undefined;
      return { systemPrompt: [event.systemPrompt, ...sections].join("\n\n") };
    });

    // session_start：确保 L1 画像目录存在（初始化学期库连接由 S*Context 惰性打开）
    pi.on("session_start", async () => {
      initMemoryL1(dataRoot);
    });

    // tool_call：workspace-path-guard 拦截 write/edit 逃逸业务数据根的路径
    pi.on("tool_call", async (event) => {
      if (event.toolName !== "write" && event.toolName !== "edit") return undefined;
      const requestedPath = (event.input as { path?: unknown }).path;
      if (typeof requestedPath !== "string") {
        return { block: true, reason: "文件路径无效，请使用业务数据根内的相对路径。" };
      }
      const decision = checkWorkspaceMutationPath(dataRoot, requestedPath);
      if (decision.block) return { block: true, reason: decision.reason };
      return undefined;
    });

    // tool_result：集中错误日志（observability，AGENTS.md §9.3 脱敏）
    const observability = createObservability();
    registerToolResultLogging(pi, observability);
  };
}
