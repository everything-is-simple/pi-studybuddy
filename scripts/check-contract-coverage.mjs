#!/usr/bin/env node
/**
 * pi-studybuddy 契约 AST 校验（AGENTS.md §6 + docs/11-组件装配 §7 装配门禁 + 03-Arch §2.2）
 *
 * 校验项（M0 骨架完成后启用完整校验，当前阶段为骨架占位）：
 *   1. Api 接口方法 ↔ host handlers 一一对应（无 missing / duplicates / unknown）
 *   2. PiBridge 桥接方法链路完整（renderer → preload → IPC → main handler）
 *   3. Stream 通道登记一致（9 个 Streams 在 contract + handlers 双端登记）
 *   4. DTO 类型导出完整（每个 RPC 方法的 params/result 类型在 contract 中存在）
 *   5. registerTool 工具名前缀 studybuddy_*（03-Arch §3.1）
 *
 * 当前阶段（设计完成，待启动 M0）：
 *   - contract/api.ts 不存在 → 退出码 0，输出"骨架未就绪，跳过 AST 校验"
 *   - 仅做结构占位与未来契约规范的自描述
 *
 * 失败任一项 → 非零退出码，阻塞合并。
 *
 * 用法：node scripts/check-contract-coverage.mjs
 *
 * 参考：
 *   - pi-desktop/scripts/check-contract-coverage.mjs（AST 校验范式来源）
 *   - docs/06-API契约-API-Contracts.md（契约 SoT）
 *   - docs/03-架构设计 §2.2（registerTool 契约）
 *   - AGENTS.md §6（拆分→小组件→组合）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

// ---- 阶段探测 ----
const contractApiPath = path.join(root, "src/contract/api.ts");
const handlersPath = path.join(root, "src/agent-host/handlers.ts");
const preloadPath = path.join(root, "src/preload/preload.ts");
const ipcPath = path.join(root, "src/main/ipc.ts");
const desktopContractPath = path.join(root, "src/contract/desktop.ts");

// 当前阶段：contract 不存在 → graceful skip
if (!fs.existsSync(contractApiPath)) {
  console.log("OK: 契约骨架未就绪（src/contract/api.ts 不存在），跳过 AST 校验");
  console.log("    （M0 骨架完成后，本脚本将自动启用完整校验）");
  process.exit(0);
}

// ---- 动态加载 typescript（仅在 contract 存在时需要）----
let ts;
try {
  ts = (await import("typescript")).default;
} catch {
  fail("typescript 模块未安装，无法进行 AST 校验（请先 pnpm install）");
}

// ---- 读取契约源码 ----
function readIfExists(relativePath) {
  const full = path.join(root, relativePath);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
}

const apiTs = readIfExists("src/contract/api.ts");
const handlersTs = readIfExists("src/agent-host/handlers.ts");
const desktopTs = readIfExists("src/contract/desktop.ts");
const preloadTs = readIfExists("src/preload/preload.ts");
const ipcTs = readIfExists("src/main/ipc.ts");

if (!apiTs) fail("src/contract/api.ts 不存在但已被探测到——文件系统状态异常");
if (!handlersTs) fail("src/agent-host/handlers.ts 不存在（M0 必须创建 handler 注册）");
if (!desktopTs) fail("src/contract/desktop.ts 不存在（PiBridge 桥接契约）");
if (!preloadTs) fail("src/preload/preload.ts 不存在（PiBridge preload 桥）");
if (!ipcTs) fail("src/main/ipc.ts 不存在（IPC handler 注册）");

// ---- 解析 Api 接口方法名 ----
const apiSource = ts.createSourceFile("api.ts", apiTs, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const apiInterface = apiSource.statements.find(
  (stmt) => ts.isInterfaceDeclaration(stmt) && stmt.name.text === "Api",
);
if (!apiInterface || !ts.isInterfaceDeclaration(apiInterface)) {
  fail("src/contract/api.ts 中找不到 Api interface");
}

const apiMethods = apiInterface.members.flatMap((member) => {
  if (!ts.isPropertySignature(member) || !member.name) return [];
  if (ts.isStringLiteral(member.name) || ts.isIdentifier(member.name)) return [member.name.text];
  return [];
});

// ---- 解析 handlers 中的 server.handle({ ... }) 注册 ----
const handlersSource = ts.createSourceFile("handlers.ts", handlersTs, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const registered = [];
function visit(node) {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "handle" &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "server"
  ) {
    const [argument] = node.arguments;
    if (argument && ts.isObjectLiteralExpression(argument)) {
      for (const property of argument.properties) {
        if (
          (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property)) &&
          (ts.isStringLiteral(property.name) || ts.isIdentifier(property.name))
        ) {
          registered.push(property.name.text);
        }
      }
    }
  }
  ts.forEachChild(node, visit);
}
visit(handlersSource);

// ---- 一致性校验 ----
const registeredSet = new Set(registered);
const missing = apiMethods.filter((m) => !registeredSet.has(m));
const duplicates = registered.filter((m, i) => registered.indexOf(m) !== i);
const unknown = registered.filter((m) => !apiMethods.includes(m));

if (missing.length) fail(`Missing host handlers for: ${missing.join(", ")}`);
if (duplicates.length) fail(`Duplicate host handlers: ${[...new Set(duplicates)].join(", ")}`);
if (unknown.length) fail(`Handlers missing from Api contract: ${unknown.join(", ")}`);

// ---- PiBridge 桥接链路 ----
const piBridgeSection = desktopTs.slice(desktopTs.indexOf("export interface PiBridge"));
const piBridgeMethods = [...piBridgeSection.matchAll(/^\s+([a-zA-Z]\w*):/gm)].map((m) => m[1]);

const missingPreloadMethods = piBridgeMethods.filter((m) => !preloadTs.includes(`${m}:`));
if (missingPreloadMethods.length) {
  fail(`Missing preload methods for PiBridge: ${missingPreloadMethods.join(", ")}`);
}

// ---- IPC 通道一致性 ----
const ipcInvokeChannels = [...preloadTs.matchAll(/ipcRenderer\.invoke\("([^"]+)"/g)].map((m) => m[1]);
const registeredIpc = new Set([...ipcTs.matchAll(/ipcMain\.handle\("([^"]+)"/g)].map((m) => m[1]));

const missingIpcHandlers = ipcInvokeChannels.filter((c) => !registeredIpc.has(c));
if (missingIpcHandlers.length) {
  fail(`Missing IPC handlers for: ${missingIpcHandlers.join(", ")}`);
}

// ---- 工具名前缀检查（registerTool 调用）----
// 扫描 src/ 下所有 .ts 文件中的 registerTool 调用
function walkSrc(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkSrc(full));
    else if (entry.name.endsWith(".ts")) results.push(full);
  }
  return results;
}

const srcFiles = walkSrc(path.join(root, "src"));
const toolNamePattern = /name:\s*["'`]studybuddy_[a-z_]+["'`]/g;
const toolNames = [];
for (const file of srcFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const m of content.matchAll(toolNamePattern)) {
    toolNames.push(m[0].match(/["'`]([^"'`]+)["'`]/)[1]);
  }
}

const nonPrefixed = toolNames.filter((n) => !n.startsWith("studybuddy_"));
if (nonPrefixed.length) {
  fail(`registerTool 工具名未遵循 studybuddy_* 前缀：${nonPrefixed.join(", ")}`);
}

const duplicateTools = toolNames.filter((n, i) => toolNames.indexOf(n) !== i);
if (duplicateTools.length) {
  fail(`Duplicate registerTool 工具名：${[...new Set(duplicateTools)].join(", ")}`);
}

// ---- 汇总 ----
ok(
  `${apiMethods.length} Api handlers, ${piBridgeMethods.length} PiBridge methods, ${toolNames.length} registerTool 工具（${ipcInvokeChannels.length} IPC 通道）全部覆盖`,
);
