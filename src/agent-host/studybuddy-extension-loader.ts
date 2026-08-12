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
import fs from "node:fs";
import path from "node:path";

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
    "DeepSeek V4 Flash": "deepseek-chat",
    "DeepSeek V4 Pro": "deepseek-reasoner",
  },
};

/**
 * 自定义 OpenAI 兼容 provider 的运行时定义（pi-ai ModelConfig 文件）。
 *
 * 落点：<dataRoot>/config/pi-models.json（业务数据根，AGENTS.md §9.5 物理隔离，不侵入 ~/.pi）。
 * 本文件只含 provider 别名 / baseUrl / api 形态（非敏感，与 03-Arch §2.3 的 models.json
 * 契约一致）；API key 仍走 credential-vault（DPAPI，modelProvider:<provider>）。
 *
 * pi ModelRuntime 内置 provider catalog 不含 agnes；通过该文件以 ModelConfig 方式
 * 注册自定义 provider（composeModelProvider 用 baseUrl + api + models 组合，请求时
 * auth 从 RuntimeCredentials override——即 setRuntimeApiKey 注入的内存 key——解析）。
 */
const RUNTIME_PROVIDERS_FILE_NAME = "pi-models.json";

const DEFAULT_RUNTIME_PROVIDERS: Readonly<{
  providers: Record<string, {
    name: string;
    baseUrl: string;
    api: string;
    compat?: { supportsDeveloperRole?: boolean; supportsReasoningEffort?: boolean };
    models: Array<{ id: string; name: string; input?: Array<"text" | "image">; modality?: "chat" | "image" | "video"; reasoning?: boolean; contextWindow?: number; maxTokens?: number }>;
  }>;
}> = {
  providers: {
    deepseek: {
      name: "DeepSeek 直连（文本）",
      baseUrl: "https://api.deepseek.com/v1",
      api: "openai-completions",
      models: [
        { id: "deepseek-chat", name: "DeepSeek Chat", input: ["text"], contextWindow: 131072, maxTokens: 8192 },
        { id: "deepseek-reasoner", name: "DeepSeek Reasoner", input: ["text"], reasoning: true, contextWindow: 131072, maxTokens: 8192 },
      ],
    },
    volcengine: {
      name: "火山方舟（文本/多模态）",
      baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
      api: "openai-completions",
      models: [
        { id: "deepseek-v4-flash-ga-260731", name: "DeepSeek V4 Flash", input: ["text"] },
        { id: "deepseek-v4-pro-260425", name: "DeepSeek V4 Pro", input: ["text"], reasoning: true },
        { id: "glm-5-2-260617", name: "GLM 5.2", input: ["text"], reasoning: true },
        { id: "doubao-seedance-2-5-260628", name: "Doubao Seedance 2.5（视频生成）", input: ["text"], modality: "video" },
        { id: "doubao-seed-2-0-lite-260428", name: "Doubao Seed 2.0 Lite", input: ["text", "image"] },
        { id: "doubao-seed-2-0-mini-260428", name: "Doubao Seed 2.0 Mini", input: ["text", "image"] },
        { id: "doubao-seed-2-1-turbo-260628", name: "Doubao Seed 2.1 Turbo", input: ["text", "image"] },
      ],
    },
    yunwu: {
      name: "云雾 API（文本）",
      baseUrl: "https://yunwu.ai/v1",
      api: "openai-completions",
      models: [
        { id: "gpt-5.6-terra", name: "GPT 5.6 Terra", input: ["text"], reasoning: true },
        { id: "gpt-5.6-sol", name: "GPT 5.6 Sol", input: ["text"], reasoning: true },
        { id: "gpt-5.6-luna", name: "GPT 5.6 Luna", input: ["text"], reasoning: true },
        { id: "gpt-5.5", name: "GPT 5.5", input: ["text"], reasoning: true },
        { id: "gpt-5.4", name: "GPT 5.4", input: ["text"], reasoning: true },
        { id: "gpt-5.4-mini", name: "GPT 5.4 Mini", input: ["text"], reasoning: true },
      ],
    },
    agnes: {
      name: "Agnes（多媒体）",
      baseUrl: "https://apihub.agnes-ai.com/v1",
      api: "openai-completions",
      models: [
        { id: "agnes-2.5-flash", name: "Agnes 2.5 Flash", input: ["text", "image"] },
        { id: "agnes-2.5-pro", name: "Agnes 2.5 Pro", input: ["text", "image"], reasoning: true },
        { id: "agnes-image-2.1-flash", name: "Agnes Image 2.1 Flash（图像生成）", input: ["text", "image"], modality: "image" },
        { id: "agnes-video-v2.0", name: "Agnes Video 2.0（视频生成）", input: ["text", "image"], modality: "video" },
      ],
    },
    xiaojigpt: { name: "小鸡 GPT 中转（待模型探测）", baseUrl: "https://api.ckff.tech/v1", api: "openai-completions", models: [] },
    shayulajiao: { name: "鲨鱼辣椒中转（待模型探测）", baseUrl: "https://shayulajiao.xyz/v1", api: "openai-completions", models: [] },
    xiaojikiro: { name: "小鸡 Kiro 中转（待模型探测）", baseUrl: "https://ckff.dev/v1", api: "openai-completions", models: [] },
  },
};

/**
 * 确保业务数据根的 provider catalog 包含项目默认项。
 *
 * 已存在文件按 provider id 合并：用户已配置 provider 的 baseUrl/api/模型定义保持不变，
 * 缺失 provider 才补入默认定义。这样升级新增 provider 时可见，同时不会改写用户的中转地址。
 */
export function ensureRuntimeProviderConfig(dataRoot: string): string {
  const dir = path.join(dataRoot, "config");
  const file = path.join(dir, RUNTIME_PROVIDERS_FILE_NAME);
  let existing: { providers?: Record<string, unknown> } = {};
  if (fs.existsSync(file)) {
    try {
      existing = JSON.parse(fs.readFileSync(file, "utf8")) as { providers?: Record<string, unknown> };
    } catch {
      // 损坏的非敏感 catalog 不作为运行时配置使用，安全地以默认值重建。
      existing = {};
    }
  }
  const currentProviders = existing.providers && typeof existing.providers === "object" ? existing.providers : {};
  const mergedProviders = { ...DEFAULT_RUNTIME_PROVIDERS.providers, ...currentProviders };
  const hasAllDefaults = Object.keys(DEFAULT_RUNTIME_PROVIDERS.providers).every((id) => Object.prototype.hasOwnProperty.call(currentProviders, id));
  if (!fs.existsSync(file) || !hasAllDefaults) {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ ...existing, providers: mergedProviders }, null, 2), "utf8");
    fs.renameSync(tmp, file);
  }
  return file;
}

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
  //    自定义 OpenAI 兼容 provider（agnes 等）通过业务数据根 config/pi-models.json 注册。
  const runtimeModelsPath = ensureRuntimeProviderConfig(dataRoot);
  const modelRuntime = await ModelRuntime.create({ modelsPath: runtimeModelsPath, allowModelNetwork: false });
  const provider = modelConfig.provider.trim();
  const runtimeModelId = resolveRuntimeModelId(provider, modelConfig.model);
  await modelRuntime.setRuntimeApiKey(provider, modelConfig.apiKey);
  const model = modelRuntime.getModel(provider, runtimeModelId);
  if (!model) {
    throw modelNotConfiguredError();
  }

  // 3. 创建 cwd-bound 运行时服务（inno-agent pi-runner.ts:176-187 范式）
  //    extensionFactories 注入 studybuddy-extension，resourceLoader.reload() 时调用工厂
  //    必须传入同一个 modelRuntime（含已注入的 runtime key 与自定义 provider），
  //    AgentSession._modelRuntime 请求时 auth 才能从 RuntimeCredentials override 解析 key。
  const services = await createAgentSessionServices({
    cwd,
    ...(agentDir !== undefined ? { agentDir } : {}),
    modelRuntime,
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
