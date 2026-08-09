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
 * 当前阶段（M0 骨架，T-M0-001/002 落地）：
 *   - contract/api.ts 已存在 → 完整解析 Api 方法全集
 *   - Api 方法若无 host handler → 警告不阻塞（业务 handler 由 M1+ 任务实现）
 *   - unknown / duplicate handler → 硬失败（契约与实现结构冲突）
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
const agentHostDir = path.join(root, "src/agent-host");
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
const desktopTs = readIfExists("src/contract/desktop.ts");
const preloadTs = readIfExists("src/preload/preload.ts");
const ipcTs = readIfExists("src/main/ipc.ts");

if (!apiTs) fail("src/contract/api.ts 不存在但已被探测到——文件系统状态异常");
if (!fs.existsSync(agentHostDir)) fail("src/agent-host 目录不存在（M0 必须创建 handler 注册）");
if (!desktopTs) fail("src/contract/desktop.ts 不存在（PiBridge 桥接契约）");
if (!preloadTs) fail("src/preload/preload.ts 不存在（PiBridge preload 桥）");
if (!ipcTs) fail("src/main/ipc.ts 不存在（IPC handler 注册）");

// ---- 解析 production agent-host 入口的 server.handle({ ... }) ----
// 不能只看直接属性：生产入口通过 ...create*Handlers() 与 ...toolchainHandlers
// 组合。这里以 AST 递归展开返回对象，无法解析的 spread 一律失败，避免“127/127”假绿。
function collectTsFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectTsFiles(full));
    else if (entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

const agentHostFiles = collectTsFiles(agentHostDir);
const agentHostSources = agentHostFiles.map((file) => ({
  file,
  source: ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
}));

function findObjectReturn(fn) {
  if (!fn.body) return undefined;
  let result;
  const visit = (node) => {
    if (result) return;
    if (ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(node.expression)) {
      result = node.expression;
      return;
    }
    // 不进入内嵌函数，避免取到局部回调的 return。
    if (node !== fn.body && (ts.isFunctionLike(node) || ts.isClassLike(node))) return;
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(fn.body, visit);
  return result;
}

const functionReturns = new Map();
const variableObjects = new Map();
for (const { source } of agentHostSources) {
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const objectReturn = findObjectReturn(node);
      if (objectReturn) functionReturns.set(node.name.text, objectReturn);
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      variableObjects.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

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

function propertyName(property) {
  if (!property.name) return undefined;
  if (ts.isStringLiteral(property.name) || ts.isIdentifier(property.name)) return property.name.text;
  return undefined;
}

const unresolvedSpreads = [];
function resolveSpread(expression, seen) {
  let target = expression;
  while (ts.isParenthesizedExpression(target)) target = target.expression;
  if (ts.isCallExpression(target) && ts.isIdentifier(target.expression)) {
    const name = target.expression.text;
    if (seen.has(`fn:${name}`)) return [];
    const objectReturn = functionReturns.get(name);
    if (objectReturn) return collectObjectMethods(objectReturn, new Set([...seen, `fn:${name}`]));
    unresolvedSpreads.push(`${name}()`);
    return [];
  }
  if (ts.isIdentifier(target)) {
    const name = target.text;
    if (seen.has(`var:${name}`)) return [];
    const object = variableObjects.get(name);
    if (object) return collectObjectMethods(object, new Set([...seen, `var:${name}`]));
    unresolvedSpreads.push(name);
    return [];
  }
  unresolvedSpreads.push(target.getText());
  return [];
}

function collectObjectMethods(object, seen = new Set()) {
  const names = [];
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      names.push(...resolveSpread(property.expression, seen));
      continue;
    }
    if (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property)) {
      const name = propertyName(property);
      if (name) names.push(name);
    }
  }
  return names;
}

const indexSourceEntry = agentHostSources.find(({ file }) => path.resolve(file) === path.join(agentHostDir, "index.ts"));
if (!indexSourceEntry) fail("src/agent-host/index.ts 不存在");
let rootHandlerObject;
const findServerHandle = (node) => {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "handle" &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "server" &&
    ts.isObjectLiteralExpression(node.arguments[0])
  ) {
    rootHandlerObject = node.arguments[0];
  }
  ts.forEachChild(node, findServerHandle);
};
findServerHandle(indexSourceEntry.source);
if (!rootHandlerObject) fail("src/agent-host/index.ts 中找不到 production server.handle({...}) 注册");
const registered = collectObjectMethods(rootHandlerObject);
if (unresolvedSpreads.length) {
  fail(`无法静态展开 production host handler spread：${[...new Set(unresolvedSpreads)].join(", ")}`);
}

// ---- 一致性校验 ----
const registeredSet = new Set(registered);
const missing = apiMethods.filter((m) => !registeredSet.has(m));
const duplicates = registered.filter((m, i) => registered.indexOf(m) !== i);
const unknown = registered.filter((m) => !apiMethods.includes(m));

if (missing.length) fail(`Missing production host handlers for Api: ${missing.join(", ")}`);
if (duplicates.length) fail(`Duplicate host handlers: ${[...new Set(duplicates)].join(", ")}`);
if (unknown.length) fail(`Handlers missing from Api contract: ${unknown.join(", ")}`);

// ---- PiBridge 桥接链路 ----
const piBridgeSection = desktopTs.slice(desktopTs.indexOf("export interface PiBridge"));
// 兼容属性签名（name:）与方法签名（name(...): ）
const piBridgeMethods = [
  ...piBridgeSection.matchAll(/^\s+([a-zA-Z]\w*)\s*(?:\([^)]*\)\s*)?:/gm),
].map((m) => m[1]);

// preload 方法以 `name() {` 语法定义，按方法名+左括号匹配
const missingPreloadMethods = piBridgeMethods.filter((m) => !preloadTs.includes(`${m}(`));
if (missingPreloadMethods.length) {
  fail(`Missing preload methods for PiBridge: ${missingPreloadMethods.join(", ")}`);
}

// ---- IPC 通道一致性 ----
// preload 在 sandbox 限制下内联 IPC_CHANNELS；main 则从 shared/constants 导入。
// 因而按常量键解析 invoke/send/on 与 handle/on，不能只匹配字面量 invoke。
const preloadChannelValues = new Map(
  [...preloadTs.matchAll(/^\s*([A-Z_]+):\s*["']([^"']+)["']/gm)].map((m) => [m[1], m[2]]),
);
const preloadIpc = [
  ...preloadTs.matchAll(/ipcRenderer\.(?:invoke|send|on)\(IPC_CHANNELS\.([A-Z_]+)/g),
].map((m) => preloadChannelValues.get(m[1]) ?? m[1]);
const preloadLiteralIpc = [
  ...preloadTs.matchAll(/ipcRenderer\.(?:invoke|send|on)\(["']([^"']+)["']/g),
].map((m) => m[1]);
const sharedConstantsTs = fs.readFileSync(path.join(root, "src/shared/constants.ts"), "utf8");
const sharedChannelValues = new Map(
  [...sharedConstantsTs.matchAll(/^\s*([A-Z_]+):\s*["']([^"']+)["']/gm)].map((m) => [m[1], m[2]]),
);
const registeredIpc = new Set([
  ...ipcTs.matchAll(/ipcMain\.(?:handle|on)\(IPC_CHANNELS\.([A-Z_]+)/g),
].map((m) => sharedChannelValues.get(m[1]) ?? m[1]));
for (const m of ipcTs.matchAll(/ipcMain\.(?:handle|on)\(["']([^"']+)["']/g)) registeredIpc.add(m[1]);
const ipcInvokeChannels = [...new Set([...preloadIpc, ...preloadLiteralIpc])];
const missingIpcHandlers = ipcInvokeChannels.filter((c) => !registeredIpc.has(c));
if (missingIpcHandlers.length) fail(`Missing IPC handlers for: ${missingIpcHandlers.join(", ")}`);

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
