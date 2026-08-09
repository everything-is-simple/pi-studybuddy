/**
 * T-M4-004 studybuddy-extension 接入 pi 内核 + extension-loader（断裂 2 修复）
 *
 * 03-Arch §2.1/§6.2：agent-host/studybuddy-extension-loader.ts 加载 studybuddy-extension。
 *
 * 本模块封装"studybuddy-extension 工厂注入 pi 内核"的逻辑，对应 inno-agent 的
 * pi-runner.ts initSession() 范式（prep §三第 1 行）：
 *   1. createStudyBuddyExtension() 获取 ExtensionFactory
 *   2. createAgentSessionServices({ resourceLoaderOptions: { extensionFactories } }) 创建服务
 *   3. createAgentSessionFromServices({ services, sessionManager }) 创建 AgentSession
 *
 * 物理隔离（AGENTS.md §9.5）：
 *   - 业务数据根 dataRoot 由调用方传入（%LOCALAPPDATA%\PiStudyBuddy 或测试隔离目录）
 *   - pi agent 目录 agentDir 由调用方传入（默认 getAgentDir() = ~/.pi/agent）
 *   - 两者物理隔离，pi-studybuddy 不侵入 ~/.pi（业务数据不写 ~/.pi）
 *
 * 范围（T-M4-004）：
 *   - extension 注入 pi 内核 + 工具注册（35 studybuddy_* 工具）+ 钩子激活（6 个）
 *   - 不涉及 agent.send 流式回复（T-M4-005 范围）
 *   - 不连真实 LLM（08-Test §5.4：session 无 model 也可创建，工具注册不依赖 LLM）
 */
// 类型仅用于编译期（TypeScript 擦除），不产生运行时 require。
// 运行时值（createAgentSessionFromServices 等）通过动态 import() 加载——
// pi-coding-agent 是 ESM-only 包（package.json exports 仅 import 无 require），
// CJS 编译产物若静态 require 会触发 ERR_PACKAGE_PATH_NOT_EXPORTED。
// 动态 import() 在 CJS 中由 Node 原生支持，且延迟到 createStudyBuddySession() 调用时才加载。
import type {
  AgentSession,
  ExtensionFactory,
  LoadExtensionsResult,
  ToolInfo,
} from "@earendil-works/pi-coding-agent";
import { createStudyBuddyExtension } from "../agent/studybuddy-extension";
import { modelNotConfiguredError } from "./model-errors";

/** createStudyBuddySession 可选配置 */
export interface StudyBuddySessionOptions {
  /** 业务数据根（%LOCALAPPDATA%\PiStudyBuddy 或测试隔离目录，03-Arch §4.3） */
  dataRoot: string;
  /** pi agent 配置目录（默认 getAgentDir() = ~/.pi/agent；测试可传隔离目录） */
  agentDir?: string;
  /** 工作目录（默认 dataRoot） */
  cwd?: string;
  /** 业务数据根 models.json + credential-vault 解析得到的运行时模型；绝不读取 ~/.pi 凭证。 */
  modelConfig?: { provider: string; model: string; apiKey: string };
  /** whisper.cpp CLI 路径（03-Arch §3.3，有 cli+model 才走真实，否则 mock） */
  whisperCliPath?: string;
  /** whisper.cpp 模型路径 */
  whisperModelPath?: string;
}

/** createStudyBuddySession 返回值——封装 pi AgentSession + 扩展加载结果 + 清理接口 */
/**
 * 设置页展示名与 pi runtime 模型 ID 的受控映射。
 *
 * models.json 是业务 UI 的持久化契约，当前已登记的 DeepSeek 模型以展示名存储；
 * pi ModelRuntime 则要求供应商注册的实际模型 ID。映射只在进程内解析，绝不改写
 * models.json，也不从 ~/.pi 读取配置补全。
 */
const RUNTIME_MODEL_ID_ALIASES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  deepseek: {
    "DeepSeek V4 Flash": "deepseek-v4-flash",
    "DeepSeek V4 Pro": "deepseek-v4-pro",
  },
};

function resolveRuntimeModelId(provider: string, configuredModel: string): string {
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedModel = configuredModel.trim();
  return RUNTIME_MODEL_ID_ALIASES[normalizedProvider]?.[normalizedModel] ?? normalizedModel;
}

export interface StudyBuddySession {
  /** pi AgentSession（工具注册 + 钩子激活后的内核会话） */
  session: AgentSession;
  /** 扩展加载结果（含诊断信息） */
  extensionsResult: LoadExtensionsResult;
  /** 释放会话资源（unsubscribe + dispose） */
  dispose(): Promise<void>;
}

/**
 * 创建 pi AgentSession 并加载 studybuddy-extension。
 *
 * 步骤（inno-agent pi-runner.ts initSession 范式）：
 *   1. createStudyBuddyExtension({ whisperCliPath, whisperModelPath }) 获取 ExtensionFactory
 *   2. 用业务数据根的配置创建无磁盘模型运行时，并仅注入 DPAPI 解密后的运行时 key
 *   3. createAgentSessionServices({ modelRuntime, resourceLoaderOptions: { extensionFactories } })
 *      创建 cwd-bound 运行时服务
 *   4. createAgentSessionFromServices({ services, sessionManager, model }) 创建 AgentSession
 *   4. 扩展工厂在 resourceLoader.reload() 时被调用，registerTool 35 工具 + pi.on 6 钩子
 *
 * 模型边界（T-M4-023）：
 *   - 调用方必须传入来自 <dataRoot>/config/models.json 与 credential-vault 的 modelConfig。
 *   - runtime 不读取 ~/.pi 的 models/auth，且只在内存中持有 key。
 *   - 没有可用配置时返回 MODEL_NOT_CONFIGURED，不能构建无 model 会话供生产 fallback。
 */
export async function createStudyBuddySession(
  options: StudyBuddySessionOptions,
): Promise<StudyBuddySession> {
  const { dataRoot, agentDir, cwd = dataRoot, modelConfig, whisperCliPath, whisperModelPath } = options;
  if (!modelConfig?.provider.trim() || !modelConfig.model.trim() || !modelConfig.apiKey.trim()) {
    throw modelNotConfiguredError();
  }

  // 0. 动态加载 pi 内核运行时（ESM-only 包，CJS 产物用 import() 加载，见文件头注释）
  //
  // 双路径原因：
  //   - vitest：vite 转换器保留 import() 原生语义 → 直接 await import(...)
  //   - 生产 CJS（tsc 编译）：module:CommonJS 将 import() 降级为 require()，
  //     而 pi-coding-agent 是 ESM-only 包（exports 仅 import 无 require）→ 触发
  //     ERR_PACKAGE_PATH_NOT_EXPORTED。new Function("return import(s)") 阻止 tsc
  //     降级，运行时调用 Node 原生 import()。
  const {
    createAgentSessionFromServices,
    createAgentSessionServices,
    ModelRuntime,
    SessionManager,
  } = process.env.VITEST
    ? await import("@earendil-works/pi-coding-agent")
    : await (
        new Function(
          "s",
          "return import(s)",
        ) as (s: string) => Promise<typeof import("@earendil-works/pi-coding-agent")>
      )("@earendil-works/pi-coding-agent");

  // 1. 获取 studybuddy-extension 工厂（03-Arch §2.1 单一扩展工厂）
  const studyBuddyExtension: ExtensionFactory = createStudyBuddyExtension({
    whisperCliPath,
    whisperModelPath,
  });

  // 2. 模型运行时不使用 ~/.pi 的磁盘 models/auth；凭证只以内存 runtime key 注入。
  const modelRuntime = await ModelRuntime.create({ modelsPath: null, allowModelNetwork: false });
  const provider = modelConfig.provider.trim();
  const runtimeModelId = resolveRuntimeModelId(provider, modelConfig.model);
  await modelRuntime.setRuntimeApiKey(provider, modelConfig.apiKey);
  const model = modelRuntime.getModel(provider, runtimeModelId);
  if (!model) {
    throw modelNotConfiguredError();
  }

  // 3. 创建 cwd-bound 运行时服务（inno-agent pi-runner.ts:176-187 范式）
  //    extensionFactories 注入 studybuddy-extension，resourceLoader.reload() 时调用工厂
  const services = await createAgentSessionServices({
    cwd,
    ...(agentDir !== undefined ? { agentDir } : {}),
    resourceLoaderOptions: {
      extensionFactories: [studyBuddyExtension],
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
    },
  });

  // 4. 创建 AgentSession（inno-agent pi-runner.ts:207-212 范式）
  //    SessionManager.inMemory(cwd) → 内存会话，不写磁盘（测试隔离 + 单用户单会话）
  const sessionManager = SessionManager.inMemory(cwd);
  const { session, extensionsResult } = await createAgentSessionFromServices({
    services,
    sessionManager,
    model,
  });

  return {
    session,
    extensionsResult,
    async dispose(): Promise<void> {
      try {
        session.dispose();
      } catch {
        // 忽略清理错误
      }
    },
  };
}

/**
 * 从已加载的 StudyBuddySession 提取 studybuddy_* 工具清单。
 *
 * 用于验证 extension 接入成功（35 工具全部注册）。
 */
export function listStudyBuddyTools(session: AgentSession): ToolInfo[] {
  return session.getAllTools().filter((t) => t.name.startsWith("studybuddy_"));
}
