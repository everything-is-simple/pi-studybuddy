#!/usr/bin/env node
/**
 * T-M1-010 E2E 测试专用 Node.js 子进程入口
 *
 * 与生产 agent-host 的区别：
 *   - 不依赖 Electron utilityProcess，直接在 Node.js 22+ 中运行（node:sqlite 可用）
 *   - 注册 system.ping + 全部 S1-S7 + TTS + Backup 业务 handler
 *   - 数据根由 PI_STUDYBUDDY_DATA_ROOT 环境变量注入（运行数据隔离，AGENTS.md §5.3）
 *   - 通过 Node.js IPC 通道（process.on('message') / process.send）与测试驱动器通信
 *
 * 依据：
 *   - 08-Test §6：全链回归（数据层 S1-S7 + TTS + 备份恢复完整链路）
 *   - AGENTS.md §5.3：运行数据隔离
 *   - 各 S*Context 默认注入 mock Adapter（QuestionGenerator/ErrorCauseAdvisor/MockExamGenerator/
 *     ReportPolisher/WhisperCppAdapter/TtsAdapter），不连真实 AI/WPS/whisper.cpp/SAPI（08-Test §1.3 第 6 条）
 *   - S6 SMTP 渠道注入失败 mock，验证渠道隔离（07-WF §3.2：smtp 失败不影响 local_export）
 *
 * 注：Electron 33 使用 Node.js 20，不含 node:sqlite；生产环境通过 utilityProcess.fork
 * 在独立进程运行 agent-host。E2E 测试复用此范式，用 child_process.fork 启动系统 Node.js 22。
 */
const path = require("node:path");

// 从 dist/ 加载编译产物（E2E 前置：pnpm build）
const { createGlobalDb } = require("../../dist/data/global");
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

/** 业务数据根（运行数据隔离） */
const dataRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
if (!dataRoot) {
  process.send({ type: "error", error: "PI_STUDYBUDDY_DATA_ROOT 未设置" });
  process.exit(1);
}

// 初始化 global.db（首次启动建库）
const fs = require("node:fs");
fs.mkdirSync(dataRoot, { recursive: true });
createGlobalDb(dataRoot);

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
};

/**
 * 测试专用 seed：为课程种入一条知识模块（E2E-04 前置）。
 *
 * 生产无"创建知识模块"RPC——模块由 S2 笔记生成 job processor 创建（E2E 不执行该
 * processor，tests/integration 同样直接 SQL 写入）。E2E 用 seed 直写 semester.db，
 * 复用真实 materials.upload 产物满足 knowledge_modules.material_id FK。
 */
allHandlers["test.seedModule"] = (params) => {
  const { courseInstanceId, materialId, moduleName } = params;
  const activeSemesters = s1Ctx.globalDb
    .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL")
    .all();
  for (const s of activeSemesters) {
    const db = s1Ctx.semesterDb(s.id);
    const course = db
      .prepare("SELECT 1 FROM course_instances WHERE id = @id AND deleted_at IS NULL")
      .get({ id: courseInstanceId });
    if (!course) continue;
    const moduleId = "seed-module-" + moduleName;
    const ts = new Date().toISOString();
    db.prepare(
      `INSERT INTO knowledge_modules
        (id, course_instance_id, material_id, module_name, importance, learn_status,
         source_evidence_json, ai_generated, created_at, updated_at)
       VALUES (@id, @cid, @mid, @name, 3, 'not_started', '[]', 1, @ts, @ts)`,
    ).run({
      id: moduleId,
      cid: courseInstanceId,
      mid: materialId,
      name: moduleName,
      ts,
    });
    return { id: moduleId, courseInstanceId, moduleName };
  }
  throw { code: "BAD_REQUEST", message: "未找到该课程，无法种入知识模块" };
};

/** 发送消息到父进程 */
function send(obj) {
  process.send(obj);
}

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

// IPC 消息监听
process.on("message", (msg) => {
  if (msg && msg.type === "rpc" && msg.method) {
    handleRpcRequest(msg);
  }
});

// 通知父进程就绪
send({ type: "ready" });

// 优雅退出
process.on("SIGTERM", () => {
  s1Ctx.dispose();
  s2Ctx.dispose();
  s3Ctx.dispose();
  s4Ctx.dispose();
  s5Ctx.dispose();
  s6Ctx.dispose();
  s7Ctx.dispose();
  backupCtx.dispose();
  process.exit(0);
});
