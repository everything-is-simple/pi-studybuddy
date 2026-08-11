/**
 * pi-studybuddy agent-host 入口（03-Arch §6.2 + §6.3）
 *
 * agent-host 是 Electron utilityProcess 进程，承载业务内核 RPC 服务。
 * 通过 process.parentPort 与 main 进程通信，监听 { type: "connect" } 控制消息，
 * 收到 main 转发的 MessagePort 后 attach RpcServer 开始服务 renderer 的调用。
 *
 * 本文件导出 createAgentHost() 供集成测试复用；真实 Electron 环境下
 * 顶层代码检测到 process.parentPort 时自动启动。
 *
 * T-M4-002 断裂1修复：装配 S1-S7/TTS/Backup 全部业务 handler 到 Host RPC 通道。
 * 原 M1-M2 仅在 AI Tool 通道（studybuddy-extension.ts registerTool）暴露业务能力，
 * 前端 RPC 调用路径断裂（E2E 用 test-main.js 独立装配，生产入口缺失）。
 */
import { createRpcServer, type AnyMessagePort } from "../contract/rpc";
import type { Api } from "../contract/api";
import { ping } from "./handlers/ping";
import { toolchainHandlers } from "./handlers/toolchains";
import { createFileWatchService } from "./file-watch";
import { createFileHandlers } from "./handlers/files";
import { createModelHandlers } from "./handlers/models";
import { resolveDataRoot } from "./allowed-roots";
import { createSessionStore, defaultSessionFixture } from "./session-store";
import { createSessionHandlers } from "./handlers/sessions";
import { createAgentHandlers, runMockFixture, type StudyBuddySessionRef } from "./handlers/agent";
import { createStudyBuddySession } from "./studybuddy-extension-loader";
import { readModelConfig } from "../agent/model-config";
import path from "node:path";

// T-M4-002 S1-S7/TTS/Backup 业务 handler 装配（断裂1修复，03-Arch §6.2）
import { S1Context, createS1Handlers } from "./handlers/s1";
import { S2Context, createS2Handlers } from "./handlers/s2";
import { S3Context, createS3Handlers } from "./handlers/s3";
import { S4Context, createS4Handlers } from "./handlers/s4";
import { S5Context, createS5Handlers } from "./handlers/s5";
import { S6Context, createS6Handlers } from "./handlers/s6";
import { S7Context, createS7Handlers } from "./handlers/s7";
import { createRealWhisperAdapter } from "./handlers/s7/whisper-adapter";
import { TtsContext, createTtsHandlers } from "./handlers/tts";
import { BackupContext, createBackupHandlers } from "./handlers/backup";
// T-M4-003 credentials.*/settings.* handler 装配（断裂5修复，06-API §3.14/§3.15）
// 2026-08-11：agent-host 运行于 utilityProcess（无 electron safeStorage），
// 生产凭证经 parentPort 委托 main 主进程 DPAPI vault（credential-client）。
import { createCredentialHandlers } from "./handlers/credentials";
import { createSettingsHandlers } from "./handlers/settings";
import { createSkillHandlers } from "./handlers/skills";
import { createParentPortCredentialClient, type CredentialService } from "./credential-client";

export interface AgentHost {
  dispose(): void;
}

/**
 * 只从 DPAPI vault 获取运行时 key。任一读取/键名/加密不可用错误都不向 UI 泄漏，
 * 由 agent.send 的 MODEL_NOT_CONFIGURED 固定错误统一呈现。
 */
async function safeReadModelCredential(service: CredentialService, provider: string): Promise<string | null> {
  try {
    const key = await service.get(`modelProvider:${provider}`);
    return key?.trim() ? key : null;
  } catch {
    return null;
  }
}

/**
 * 创建 S1-S7/TTS/Backup 业务上下文 + handler 映射（T-M4-002 断裂1修复）。
 *
 * 复用 studybuddy-extension.ts 的上下文创建模式：
 *   - S1-S6: new S*Context(dataRoot)
 *   - S7: new S7Context(dataRoot, { whisper 配置 }) — 有 CLI+模型路径才走真实，否则 mock
 *   - TTS: new TtsContext() — 默认 mock 双引擎（08-Test §5.4）
 *   - Backup: new BackupContext(dataRoot)
 */
function createBusinessHandlers(dataRoot: string): Record<string, (...args: unknown[]) => unknown> {
  const s1Ctx = new S1Context(dataRoot);
  const s2Ctx = new S2Context(dataRoot);
  const s3Ctx = new S3Context(dataRoot);
  const s4Ctx = new S4Context(dataRoot);
  const s5Ctx = new S5Context(dataRoot);
  const s6Ctx = new S6Context(dataRoot);

  // S7 whisper.cpp 配置（03-Arch §3.3：CLI/模型路径只来自配置，不猜路径不回退云端）
  const whisperCliPath = process.env.PI_STUDYBUDDY_WHISPER_CLI ?? "";
  const whisperModelPath = process.env.PI_STUDYBUDDY_WHISPER_MODEL ?? "";
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

  return {
    ...createS1Handlers(s1Ctx),
    ...createS2Handlers(s2Ctx),
    ...createS3Handlers(s3Ctx),
    ...createS4Handlers(s4Ctx),
    ...createS5Handlers(s5Ctx),
    ...createS6Handlers(s6Ctx),
    ...createS7Handlers(s7Ctx),
    ...createTtsHandlers(ttsCtx),
    ...createBackupHandlers(backupCtx),
  };
}

/** 启动 agent-host RPC 服务：监听 parentPort 的 connect 消息并 attach 业务端口 */
export function createAgentHost(parentPort: AnyMessagePort): AgentHost {
  const server = createRpcServer();
  const fileWatch = createFileWatchService(server);
  // T-M3-002：files.read 白名单门禁需业务数据根（AGENTS.md §9.4）
  const dataRoot = resolveDataRoot();
  // T-M3-001：会话内存仓库 + sessions.*/agent.* handlers（对话 Tab 承载层）
  const sessionStore = createSessionStore(defaultSessionFixture());

  // T-M4-023：生产模型只来自业务数据根 models.json + DPAPI credential-vault。
  // 2026-08-11：agent-host（utilityProcess）无 electron safeStorage，凭证经
  // process.parentPort 委托 main 主进程 DPAPI vault（credential-client）。
  // 不读取 ~/.pi 认证信息；没有可用配置或初始化失败时，agent.send 返回固定安全错误，
  // 不得静默产生 fixture 回复。测试夹具仅在 VITEST 显式注入。
  const credentialService: CredentialService = createParentPortCredentialClient() ?? {
    // 无 parentPort（非 utilityProcess）时凭证服务不可用：生产由 main 委托，测试由调用方注入 mock。
    get: async () => null,
    set: async () => undefined,
    delete: async () => undefined,
    listKeys: async () => [],
  };
  const studyBuddySessionRef: StudyBuddySessionRef = { current: null };
  if (process.env.VITEST === undefined) {
    const modelConfig = readModelConfig(dataRoot);
    if (modelConfig) {
      studyBuddySessionRef.ready = (async () => {
        const apiKey = await safeReadModelCredential(credentialService, modelConfig.provider);
        if (!apiKey) return;
        try {
          studyBuddySessionRef.current = await createStudyBuddySession({
            dataRoot,
            modelConfig: { provider: modelConfig.provider, model: modelConfig.model, apiKey },
          });
        } catch {
          // 错误细节可能包含 provider/运行时信息，不记录；agent.send 统一返回安全配置错误。
        }
      })();
    }
  }

  server.handle({
    "system.ping": (...args: unknown[]) => ping(args[0] as Api["system.ping"]["params"]),
    ...toolchainHandlers,
    ...createFileHandlers(fileWatch, { dataRoot }),
    ...createModelHandlers(dataRoot),
    ...createSkillHandlers(),
    ...createSessionHandlers({ store: sessionStore, dataRoot, exportDir: path.join(dataRoot, "exports") }),
    ...createAgentHandlers(server, sessionStore, studyBuddySessionRef, {
      ...(process.env.VITEST !== undefined ? { fixture: runMockFixture } : {}),
    }),
    // T-M4-002 S1-S7/TTS/Backup 业务 handler（断裂1修复，03-Arch §6.2）
    ...createBusinessHandlers(dataRoot),
    // T-M4-003 credentials.*/settings.* handler（断裂5修复，06-API §3.14/§3.15）
    ...createCredentialHandlers(credentialService),
    ...createSettingsHandlers(dataRoot),
  });

  let attached = false;
  const onMessage = (eventOrMessage: unknown, transferredPorts?: AnyMessagePort[]): void => {
    const event =
      typeof eventOrMessage === "object" && eventOrMessage !== null
        ? (eventOrMessage as { data?: unknown; ports?: AnyMessagePort[] })
        : undefined;
    const data = event && "data" in event ? event.data : eventOrMessage;
    const ports = event?.ports ?? transferredPorts;
    const msg = data as { type?: string };
    if (!attached && msg?.type === "connect") {
      const port = ports?.[0];
      if (port) {
        server.attachPort(port);
        attached = true;
      }
    }
  };

  if (typeof parentPort.addEventListener === "function") {
    parentPort.addEventListener("message", onMessage);
  } else if (typeof parentPort.on === "function") {
    (parentPort as unknown as {
      on(event: "message", listener: (message: unknown, ports?: AnyMessagePort[]) => void): void;
    }).on("message", onMessage);
  } else {
    parentPort.onmessage = onMessage;
  }
  parentPort.start?.();

  return {
    dispose() {
      server.dispose();
      fileWatch.dispose();
      // T-M4-005：异步释放 pi 内核会话（非阻塞）
      studyBuddySessionRef.current?.dispose().catch(() => {});
      attached = false;
    },
  };
}

// 真实 Electron utilityProcess 入口：仅当运行于 utilityProcess 时自动启动
const parentPort = (globalThis as unknown as { process?: { parentPort?: AnyMessagePort } }).process
  ?.parentPort;
if (parentPort) {
  createAgentHost(parentPort);
  // main 只有在收到 ready 后才转交 MessagePort，避免 spawn 与 listener 注册竞态。
  parentPort.postMessage({ type: "ready" });
}
