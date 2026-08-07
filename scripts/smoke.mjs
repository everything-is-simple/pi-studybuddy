#!/usr/bin/env node
/**
 * pi-studybuddy M0 系统冒烟（03-Arch §6.2 + 08-Test §5.7）
 *
 * 验证"四进程骨架可启动 + RPC 通道建立"：
 *  1. 检查 build 产物齐全（main/preload/agent-host/renderer）
 *  2. 通过编译后的 agent-host 模块建立 RPC 通道并往返 system.ping
 *
 * 真实 GUI 启动（pnpm dev 打开窗口）由人工在带显示环境执行；本脚本在
 * 无显示环境（CI/agent）下验证可启动前置条件与 RPC 链路。
 *
 * 用法：node scripts/smoke.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function fail(msg) {
  console.error(`[smoke] FAILED: ${msg}`);
  process.exit(1);
}

console.log("[smoke] pi-studybuddy M0 骨架冒烟");

// 1. build 产物齐全
const required = [
  "dist/main/main.js",
  "dist/main/window.js",
  "dist/main/protocol.js",
  "dist/main/ipc.js",
  "dist/preload/preload.js",
  "dist/agent-host/index.js",
  "dist/renderer/index.html",
  "dist/contract/rpc.js",
];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) fail(`缺少构建产物：${rel}（请先 pnpm build）`);
}
console.log(`  构建产物 ${required.length} 项齐全 ✅`);

// 2. RPC 通道往返（编译后的 agent-host + MessageChannel）
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
const result = client.call("system.ping", { message: "smoke" });
result
  .then((res) => {
    if (res?.pong !== "smoke" || typeof res.timestamp !== "number") {
      fail(`system.ping 返回异常：${JSON.stringify(res)}`);
    }
    client.dispose();
    agentHost.dispose();
    port1.close();
    port2.close();
    console.log(`  RPC 往返 system.ping → { pong:${res.pong}, timestamp:${res.timestamp} } ✅`);
    console.log("[smoke] 全部通过 ✅");
    process.exit(0);
  })
  .catch((e) => {
    fail(`system.ping 调用失败：${e.message ?? e}`);
  });