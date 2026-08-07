#!/usr/bin/env node
/**
 * pi-studybuddy M0 系统冒烟（03-Arch §6.2 + 08-Test §5 + 04-Todo §6.2 退出门槛）
 *
 * 验证 M0 退出门槛六项：
 *  1. build 产物齐全（main/preload/agent-host/renderer）
 *  2. contract RPC 往返 system.ping（renderer→main→agent-host 链路）
 *  3. global.db + semester.db 可建库（initGlobalDb/initSemesterDb + assertIntegrity）
 *  4. credential-vault 加密/解密往返（注入 fake SafeStorageAdapter，set→get 一致性）
 *  5. 安全不变量六条全过（调用 check-desktop-security.mjs 子进程）
 *  6. 汇总六项，任一失败退出非零
 *
 * 真实 GUI 启动（pnpm dev 打开窗口）由人工在带显示环境执行；本脚本在
 * 无显示环境（CI/agent）下验证可启动前置条件与全链路。
 *
 * 运行数据隔离（AGENTS.md §5.3）：建库/vault 写 H:\pi-studybuddy-tmp\runs\T-M0-009\smoke\
 *
 * 用法：node scripts/smoke.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const RUN_DIR = path.join("H:\\pi-studybuddy-tmp\\runs\\T-M0-009\\smoke");

function fail(msg) {
  console.error(`[smoke] FAILED: ${msg}`);
  process.exit(1);
}

const steps = [];
function record(name, ok, detail = "") {
  steps.push({ name, ok });
  const mark = ok ? "✅" : "❌";
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

console.log("[smoke] pi-studybuddy M0 系统冒烟（04-Todo §6.2 退出门槛六项）\n");

// ---- 1. build 产物齐全 ----
console.log("[1/5] build 产物齐全");
const required = [
  "dist/main/main.js",
  "dist/main/window.js",
  "dist/main/protocol.js",
  "dist/main/ipc.js",
  "dist/main/credential-vault.js",
  "dist/preload/preload.js",
  "dist/agent-host/index.js",
  "dist/data/index.js",
  "dist/renderer/index.html",
  "dist/contract/rpc.js",
];
let buildOk = true;
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) {
    buildOk = false;
    console.error(`  缺少构建产物：${rel}（请先 pnpm build）`);
  }
}
record("build 产物齐全", buildOk, `${required.length} 项`);

// ---- 2. RPC 往返 system.ping ----
console.log("\n[2/5] contract RPC 往返 system.ping");
const { MessageChannel } = require("node:worker_threads");
const { createAgentHost } = require(path.join(root, "dist/agent-host/index.js"));
const { createRpcClient } = require(path.join(root, "dist/contract/rpc.js"));

const listeners = [];
const parentPort = {
  addEventListener(_t, cb) {
    listeners.push(cb);
  },
  start() {},
};
const agentHost = createAgentHost(parentPort);

const { port1, port2 } = new MessageChannel();
for (const cb of listeners) cb({ data: { type: "connect" }, ports: [port1] });

const client = createRpcClient(port2);

// ---- 3. 建库冒烟（global.db + semester.db） ----
console.log("\n[3/5] global.db + semester.db 建库");
fs.mkdirSync(RUN_DIR, { recursive: true });
// 清理旧库
for (const f of ["global.db", "global.db-shm", "global.db-wal"]) {
  try { fs.rmSync(path.join(RUN_DIR, f), { force: true }); } catch {}
}
const semDir = path.join(RUN_DIR, "semester", "smoke-test");
try { fs.rmSync(semDir, { recursive: true, force: true }); } catch {}

const { createGlobalDb, createSemesterDb, GLOBAL_TABLES, SEMESTER_TABLES } =
  require(path.join(root, "dist/data/index.js"));

let globalDbResult, semDbResult;
try {
  const gdb = createGlobalDb(RUN_DIR);
  const gTables = gdb.db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all();
  globalDbResult = { ok: true, tables: gTables.length, expected: GLOBAL_TABLES.length };
  gdb.db.close();

  const sdb = createSemesterDb(RUN_DIR, "smoke-test");
  const sTables = sdb.db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all();
  semDbResult = { ok: true, tables: sTables.length, expected: SEMESTER_TABLES.length };
  sdb.db.close();
} catch (e) {
  fail(`建库失败：${e.message ?? e}`);
}
record(
  "global.db 建库 + integrity",
  globalDbResult.ok && globalDbResult.tables >= globalDbResult.expected,
  `${globalDbResult.tables} 表（预期 ${globalDbResult.expected}）`,
);
record(
  "semester.db 建库 + integrity",
  semDbResult.ok && semDbResult.tables >= semDbResult.expected,
  `${semDbResult.tables} 表（预期 ${semDbResult.expected}）`,
);

// ---- 4. credential-vault 加密/解密往返 ----
console.log("\n[4/5] credential-vault 加密/解密往返");
const { CredentialVault } = require(path.join(root, "dist/main/credential-vault.js"));

// fake SafeStorageAdapter（Node 环境无 Electron safeStorage，构造注入）
const fakeAdapter = {
  isEncryptionAvailable: () => true,
  encryptString: (v) => Buffer.from(`pseudocrypt:${v}`, "utf8"),
  decryptString: (b) => {
    const t = b.toString("utf8");
    if (!t.startsWith("pseudocrypt:")) throw new Error("bad ciphertext");
    return t.slice("pseudocrypt:".length);
  },
};

const vaultPath = path.join(RUN_DIR, "smoke-vault.json");
try { fs.rmSync(vaultPath, { force: true }); } catch {}
const vault = new CredentialVault(vaultPath, fakeAdapter);

const TEST_KEY = "modelProvider:smoke-test";
const TEST_VAL = "sk-secret- SmokeTest-凭证往返-2026";
let vaultOk = false;
let vaultDetail = "";
try {
  vault.set(TEST_KEY, TEST_VAL);
  const got = vault.get(TEST_KEY);
  // 私密性：磁盘文件不含明文 value
  const onDisk = fs.readFileSync(vaultPath, "utf8");
  const leaksPlaintext = onDisk.includes(TEST_VAL);
  // 键名校验：非法键拒绝
  let badKeyRejected = false;
  try { vault.set("invalidKey:bad", "x"); } catch { badKeyRejected = true; }
  vaultOk = got === TEST_VAL && !leaksPlaintext && badKeyRejected;
  vaultDetail = `set→get 一致=${got === TEST_VAL}, 磁盘无明文=${!leaksPlaintext}, 非法键拒绝=${badKeyRejected}`;
} catch (e) {
  vaultDetail = `异常：${e.message ?? e}`;
}
record("credential-vault set→get 往返", vaultOk, vaultDetail);

// ---- 5. 安全不变量六条 ----
console.log("\n[5/5] 安全不变量六条（check-desktop-security.mjs）");
const sec = spawnSync(process.execPath, [path.join(root, "scripts/check-desktop-security.mjs")], {
  stdio: "inherit",
});
record("安全不变量六条全过", sec.status === 0, `退出码 ${sec.status}`);

// ---- RPC 往返结果（等待 Promise） ----
console.log("\n[2/5] contract RPC 往返 system.ping（续）");
try {
  const res = await client.call("system.ping", { message: "smoke" });
  const rpcOk = res?.pong === "smoke" && typeof res.timestamp === "number";
  record("RPC 往返 system.ping", rpcOk, `{ pong:${res?.pong}, timestamp:${res?.timestamp} }`);
  client.dispose();
  agentHost.dispose();
  port1.close();
  port2.close();
} catch (e) {
  record("RPC 往返 system.ping", false, e.message ?? String(e));
  try { client.dispose(); agentHost.dispose(); port1.close(); port2.close(); } catch {}
}

// ---- 汇总 ----
const failed = steps.filter((s) => !s.ok);
console.log(`\n[smoke] 汇总：${steps.length} 项，通过 ${steps.length - failed.length}，失败 ${failed.length}`);
if (failed.length > 0) {
  for (const s of failed) console.error(`  ❌ ${s.name}`);
  fail("存在未通过项");
}
console.log("[smoke] 全部通过 ✅");
process.exit(0);
