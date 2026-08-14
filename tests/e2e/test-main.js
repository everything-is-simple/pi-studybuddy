#!/usr/bin/env node
/**
 * T-M4-022 真实 Electron 业务 E2E 主进程入口
 *
 * 与生产 agent-host 的区别：
 *   - 运行在真实 Electron 主进程中（Electron 36.9.5 / 内嵌 Node 22.19.0）
 *   - 注册 system.ping + 全部 S1-S7 + TTS + Backup 业务 handler fixture
 *   - 数据根由 PI_STUDYBUDDY_DATA_ROOT 环境变量注入（运行数据隔离，AGENTS.md §5.3）
 *   - 通过仅监听 127.0.0.1 的回环 TCP JSON-lines 与 Vitest 驱动器通信
 *
 * 依据：
 *   - 08-Test §6：全链回归（数据层 S1-S7 + TTS + 备份恢复完整链路）
 *   - AGENTS.md §5.3：运行数据隔离
 *   - 各 S*Context 默认注入 mock Adapter（QuestionGenerator/ErrorCauseAdvisor/MockExamGenerator/
 *     ReportPolisher/WhisperCppAdapter/TtsAdapter），不连真实 AI/WPS/whisper.cpp/SAPI（08-Test §1.3 第 6 条）
 *   - S6 SMTP 渠道注入失败 mock，验证渠道隔离（07-WF §3.2：smtp 失败不影响 local_export）
 *
 * 该文件不再由系统 Node.js fork() 启动；由
 * tests/e2e/helpers/electron-launcher.ts 直接启动 Electron 可执行文件。
 */
const path = require("node:path");

// 从 dist/ 加载编译产物（E2E 前置：pnpm build）
const { initializeDataRoot } = require("../../dist/main/data-root-init");
const { ping } = require("../../dist/agent-host/handlers/ping");
const { S1Context, createS1Handlers } = require("../../dist/agent-host/handlers/s1");
const { S2Context, createS2Handlers } = require("../../dist/agent-host/handlers/s2");
const { S3Context, createS3Handlers } = require("../../dist/agent-host/handlers/s3");
const { S4Context, createS4Handlers } = require("../../dist/agent-host/handlers/s4");
const { S5Context, createS5Handlers } = require("../../dist/agent-host/handlers/s5");
const { S6Context, createS6Handlers } = require("../../dist/agent-host/handlers/s6");
const { S7Context, createS7Handlers } = require("../../dist/agent-host/handlers/s7");
const { TtsContext, createTtsHandlers } = require("../../dist/agent-host/handlers/tts");
const { BackupContext, createBackupHandlers } = require("../../dist/agent-host/handlers/backup");
const {
  createMockDeliveryChannels,
  createFailingDeliveryChannel,
} = require("../../dist/agent-host/handlers/s6/delivery-channels");
// ── T-M3-007：对话承载层 handler（agent/sessions/modelsConfig）────────────────
const {
  createSessionStore,
} = require("../../dist/agent-host/session-store");
const { createSessionHandlers } = require("../../dist/agent-host/handlers/sessions");
const { createAgentHandlers, runMockFixture } = require("../../dist/agent-host/handlers/agent");
const { createModelHandlers } = require("../../dist/agent-host/handlers/models");
const { createFileHandlers } = require("../../dist/agent-host/handlers/files");
const { indexTurnEndChunks } = require("../../dist/agent/turn-end");

/** 真实 Electron 运行时标记与 TCP TCP 协议前缀。 */
const isElectronRuntime = typeof process.versions.electron === "string";
const PROTOCOL_PREFIX = "__PI_STUDYBUDDY_E2E__";
const net = require("node:net");
let transportSocket = null;
let pendingOutbound = [];

/** 向 Vitest 驱动器发送一条协议消息。 */
function send(obj) {
  const line = `${PROTOCOL_PREFIX}${JSON.stringify(obj)}\n`;
  if (transportSocket && !transportSocket.destroyed && transportSocket.writable) {
    transportSocket.write(line);
  } else {
    pendingOutbound.push(line);
  }
}

/** 业务数据根（运行数据隔离） */
const dataRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
if (!dataRoot) {
  send({ type: "error", error: "PI_STUDYBUDDY_DATA_ROOT 未设置" });
  process.exit(1);
}

// 初始化真实业务数据根；initializeDataRoot 会关闭建库连接，避免 Windows WAL 锁。
initializeDataRoot(dataRoot);

// 创建业务上下文（默认 mock Adapter）
const s1Ctx = new S1Context(dataRoot);
const s2Ctx = new S2Context(dataRoot);
const s3Ctx = new S3Context(dataRoot);
const s4Ctx = new S4Context(dataRoot);
const s5Ctx = new S5Context(dataRoot);
// S6 SMTP 渠道注入失败 mock（E2E-06 渠道隔离：smtp 失败不影响 local_export）
const deliveryChannels = createMockDeliveryChannels();
deliveryChannels.smtp = createFailingDeliveryChannel();
const s6Ctx = new S6Context(dataRoot, { deliveryChannels });
const s7Ctx = new S7Context(dataRoot);
const ttsCtx = new TtsContext();
const backupCtx = new BackupContext(dataRoot);

// ── T-M3-007：对话承载层（会话仓库 + 事件推送 shim）────────────────────────
// files.watch/unwatch 最小 mock（E2E 不监听真实 fs 变更；files.read 不依赖 service）
const noopFileWatch = {
  start: async () => {},
  stop: () => {},
};
// 会话内存仓库（复用生产 factory，06-API §3.1 会话骨架；T-M5-003：生产空初始化，
// 真实会话由 agent.send 首条消息物化，不注入 fixture）
const sessionStore = createSessionStore();
// agent.send 经 server.pushEvent 发射 agent.events；子进程无 RpcServer，
// 用 shim server 将事件转发父进程 {"type":"event","topic","payload"} 供 RpcDriver 订阅。
const eventForwardServer = {
  pushEvent: (topic, payload, key) => {
    send({ type: "event", topic, key, payload });
  },
};

// 装配全部 handler（与生产 RpcServer.handle 相同的调用约定）
const allHandlers = {
  "system.ping": (...args) => ping(args[0]),
  ...createS1Handlers(s1Ctx),
  ...createS2Handlers(s2Ctx),
  ...createS3Handlers(s3Ctx),
  ...createS4Handlers(s4Ctx),
  ...createS5Handlers(s5Ctx),
  ...createS6Handlers(s6Ctx),
  ...createS7Handlers(s7Ctx),
  ...createTtsHandlers(ttsCtx),
  ...createBackupHandlers(backupCtx),
  // ── T-M3-007：对话承载层 handler 装配（复用生产 create*Handlers factory）──
  ...createSessionHandlers({
    store: sessionStore,
    dataRoot,
    exportDir: path.join(dataRoot, "exports"),
  }),
  ...createAgentHandlers(eventForwardServer, sessionStore, null, { fixture: runMockFixture }),
  ...createModelHandlers(dataRoot),
  // T-M3-002：files.read @引用白名单门禁（E2E-12 前置，AGENTS.md §9.4）
  ...createFileHandlers(noopFileWatch, { dataRoot }),
};

/**
 * 测试专用 turn_end 增量索引（E2E-13 前置，模拟 pi 扩展 turn_end 钩子）。
 *
 * 生产在 pi 扩展层 pi.on("turn_end") 调用 indexTurnEndChunks（studybuddy-extension.ts）。
 * E2E 子进程不跑 pi 内核，故仅在隔离 loopback 测试进程用 test.turnEndIndex 转接
 * 生产 indexTurnEndChunks 纯函数；它不在 production contract/agent-host 注册，不能 seed S1-S7
 * 业务实体。详见 08-Test §9.1 的已登记唯一例外。
 * 验证 L3 增量索引 + 跨进程持久化（二次 launch 后 sessions.search 命中）。
 */
allHandlers["test.turnEndIndex"] = (params) => {
  const { sessionId, turnIndex, message, toolResults } = params;
  return indexTurnEndChunks({
    dataRoot,
    sessionId,
    turnIndex,
    message,
    toolResults,
  });
};

/** 处理 RPC 请求 */
function handleRpcRequest(msg) {
  const handler = allHandlers[msg.method];
  if (!handler) {
    send({
      id: msg.id,
      error: { code: "UNKNOWN_METHOD", message: `未知方法: ${msg.method}` },
    });
    return;
  }
  try {
    const result = handler(...(msg.args ?? []));
    // 支持 Promise 返回值
    if (result && typeof result.then === "function") {
      result
        .then((r) => send({ id: msg.id, result: r }))
        .catch((e) => send({ id: msg.id, error: serializeError(e) }));
    } else {
      send({ id: msg.id, result });
    }
  } catch (e) {
    send({ id: msg.id, error: serializeError(e) });
  }
}

/** 序列化错误（handler 抛出的 RpcError 是普通对象 {code, message}） */
function serializeError(e) {
  if (e && typeof e === "object" && "code" in e && "message" in e) {
    return { code: String(e.code), message: String(e.message) };
  }
  return { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : String(e) };
}

/** 释放测试 fixture 打开的数据库连接。 */
function disposeContexts() {
  s1Ctx.dispose();
  s2Ctx.dispose();
  s3Ctx.dispose();
  s4Ctx.dispose();
  s5Ctx.dispose();
  s6Ctx.dispose();
  s7Ctx.dispose();
  backupCtx.dispose();
}

/** 分发驱动器传入的 RPC 消息。 */
function dispatchMessage(msg) {
  if (msg && msg.type === "rpc" && msg.method) {
    handleRpcRequest(msg);
  }
}

// 真实 Electron 启动器使用仅监听 127.0.0.1 的 TCP socket；不保留
// 不保留旧的 Node 子进程兼容通道，避免非 Electron 进程冒充 E2E。
if (!isElectronRuntime) {
  process.stderr.write("[e2e electron] 必须由 Electron 主进程启动\n");
  process.exit(1);
}
const port = Number(process.env.PI_STUDYBUDDY_E2E_PORT);
if (!Number.isInteger(port) || port <= 0) {
  send({ type: "error", error: "PI_STUDYBUDDY_E2E_PORT 未设置或无效" });
  process.exit(1);
}
let transportBuffer = "";
transportSocket = net.createConnection({ host: "127.0.0.1", port });
transportSocket.setEncoding("utf8");
transportSocket.on("connect", () => {
  for (const line of pendingOutbound) transportSocket.write(line);
  pendingOutbound = [];
});
transportSocket.on("data", (chunk) => {
  transportBuffer += chunk.toString();
  let newlineIndex = transportBuffer.indexOf("\n");
  while (newlineIndex >= 0) {
    const line = transportBuffer.slice(0, newlineIndex).replace(/\r$/, "");
    transportBuffer = transportBuffer.slice(newlineIndex + 1);
    if (line.startsWith(PROTOCOL_PREFIX)) {
      try {
        dispatchMessage(JSON.parse(line.slice(PROTOCOL_PREFIX.length)));
      } catch (error) {
        send({ type: "error", error: `RPC 协议解析失败: ${String(error)}` });
      }
    }
    newlineIndex = transportBuffer.indexOf("\n");
  }
});
transportSocket.on("error", (error) => {
  process.stderr.write(`[e2e electron tcp] ${error.message}\n`);
  process.exit(1);
});

// 通知父进程就绪，同时返回实际运行时事实，防止测试误用系统 Node。
send({
  type: "ready",
  runtime: {
    electron: isElectronRuntime ? process.versions.electron : null,
    node: process.versions.node,
  },
});

// 优雅退出
function shutdown() {
  disposeContexts();
  process.exit(0);
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
