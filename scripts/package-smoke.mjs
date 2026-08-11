#!/usr/bin/env node
/**
 * T-M4-009 安装包真实启动冒烟。
 *
 * 启动 NSIS 安装后的 Electron 可执行文件，通过仅监听 127.0.0.1 的 Chrome DevTools
 * Protocol 在 renderer 中调用受控 piBridge，验证 system.ping、global.db 和二次启动。
 * 运行期环境变量全部指向任务临时目录，避免写入真实业务数据根或 ~/.pi。
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";

const TASK_ID = process.env.PI_STUDYBUDDY_PACKAGE_TASK_ID ?? "T-M4-009";
const RUN_DIR = process.env.PI_STUDYBUDDY_PACKAGE_RUN_DIR
  ?? `H:\\pi-studybuddy-tmp\\runs\\${TASK_ID}`;
const APP_PATH = process.env.PI_STUDYBUDDY_PACKAGE_APP;
const DATA_ROOT = path.join(RUN_DIR, "package-data-root");
const PROFILE_ROOT = path.join(RUN_DIR, "package-profile");
// Chromium profile 必须显式落在任务临时目录，避免隔离环境的默认 profile 路径启动失败。
const ELECTRON_USER_DATA_ROOT = path.join(PROFILE_ROOT, "electron-user-data");
const PING_MESSAGE = `${TASK_ID}-package-smoke`;

/** 输出固定中文错误，避免把命令行、密钥或调试载荷写入日志。 */
function fail(message) {
  console.error(`[package-smoke] 失败：${message}`);
  process.exitCode = 1;
}

/** 等待指定毫秒，供启动、关闭和重试流程复用。 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 取得一个短生命周期回环端口，调试端口仅对本机暴露。 */
async function reserveLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  if (!address || typeof address === "string") {
    throw new Error("未取得回环调试端口");
  }
  return address.port;
}

/** 请求本机 CDP HTTP 端点，返回已解析 JSON。 */
function requestJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: pathname }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode !== 200) {
          reject(new Error("CDP HTTP 状态异常"));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error("CDP JSON 解析失败"));
        }
      });
    });
    request.once("error", reject);
  });
}

/** 在超时范围内等待 renderer 的 CDP 页面目标出现。 */
async function waitForPageTarget(port) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const targets = await requestJson(port, "/json/list");
      const target = targets.find(
        (entry) => entry.type === "page"
          && entry.url === "app://renderer/index.html"
          && typeof entry.webSocketDebuggerUrl === "string",
      );
      if (target) return target;
    } catch {
      // 应用启动前 CDP 端点会短暂不可用，继续等待即可。
    }
    await delay(250);
  }
  throw new Error("已安装应用未在限定时间内创建 renderer");
}

/** 编码客户端掩码 WebSocket 文本帧，满足 RFC 6455 的 CDP 传输要求。 */
function encodeClientFrame(text) {
  const payload = Buffer.from(text, "utf8");
  const mask = randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, 0x80 | payload.length]);
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  const masked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    masked[index] = payload[index] ^ mask[index % 4];
  }
  return Buffer.concat([header, mask, masked]);
}

/** 解析服务端未掩码 WebSocket 帧，仅接收 CDP 所需的文本和关闭帧。 */
function consumeServerFrames(state, chunk, onText) {
  state.buffer = Buffer.concat([state.buffer, chunk]);
  while (state.buffer.length >= 2) {
    const first = state.buffer[0];
    const second = state.buffer[1];
    let offset = 2;
    let payloadLength = second & 0x7f;
    if (payloadLength === 126) {
      if (state.buffer.length < 4) return;
      payloadLength = state.buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLength === 127) {
      if (state.buffer.length < 10) return;
      const longLength = state.buffer.readBigUInt64BE(2);
      if (longLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("CDP WebSocket 帧过大");
      }
      payloadLength = Number(longLength);
      offset = 10;
    }
    if (second & 0x80) throw new Error("CDP 服务端帧意外掩码");
    if (state.buffer.length < offset + payloadLength) return;
    const opcode = first & 0x0f;
    const payload = state.buffer.subarray(offset, offset + payloadLength);
    state.buffer = state.buffer.subarray(offset + payloadLength);
    if (opcode === 0x1) onText(payload.toString("utf8"));
    if (opcode === 0x8) throw new Error("CDP 连接被应用关闭");
  }
}

/** 连接本机 CDP WebSocket，并提供请求-响应式命令调用。 */
async function connectCdp(webSocketDebuggerUrl) {
  const endpoint = new URL(webSocketDebuggerUrl);
  const socket = net.createConnection({ host: endpoint.hostname, port: Number(endpoint.port) });
  const key = randomBytes(16).toString("base64");
  const request = [
    `GET ${endpoint.pathname}${endpoint.search} HTTP/1.1`,
    `Host: ${endpoint.host}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Key: ${key}`,
    "Sec-WebSocket-Version: 13",
    "",
    "",
  ].join("\r\n");

  const pending = new Map();
  const state = { buffer: Buffer.alloc(0), handshake: "", connected: false };
  let nextId = 1;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP WebSocket 握手超时")), 15_000);
    socket.once("error", reject);
    socket.on("data", (chunk) => {
      if (!state.connected) {
        state.handshake += chunk.toString("latin1");
        const boundary = state.handshake.indexOf("\r\n\r\n");
        if (boundary < 0) return;
        const header = state.handshake.slice(0, boundary);
        const trailing = Buffer.from(state.handshake.slice(boundary + 4), "latin1");
        state.handshake = "";
        if (!header.startsWith("HTTP/1.1 101")) {
          clearTimeout(timer);
          reject(new Error("CDP WebSocket 握手被拒绝"));
          return;
        }
        state.connected = true;
        clearTimeout(timer);
        socket.removeListener("error", reject);
        if (trailing.length) consumeServerFrames(state, trailing, onText);
        resolve();
        return;
      }
      consumeServerFrames(state, chunk, onText);
    });
    socket.write(request);
  });

  function onText(text) {
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }
    if (typeof message.id !== "number") return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(`CDP 命令执行失败：${entry.method}`));
    else entry.resolve(message.result);
  }

  return {
    command(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP 命令超时：${method}`));
        }, 60_000);
        pending.set(id, {
          resolve(result) { clearTimeout(timer); resolve(result); },
          reject(error) { clearTimeout(timer); reject(error); },
          method,
        });
        socket.write(encodeClientFrame(JSON.stringify({ id, method, params })));
      });
    },
    close() {
      socket.destroy();
    },
  };
}

/** 在已安装 renderer 中经受控桥接执行 system.ping + 代表性业务 RPC（semesters.create），不暴露额外生产接口。 */
async function pingInstalledRenderer(cdp) {
  const expression = `
    (async () => {
      const bridge = window.piBridge;
      if (!bridge) return { ok: false, reason: "bridge_missing" };
      const port = await bridge.connectHost();
      const call = (id, method, args) => new Promise((resolve) => {
        const timer = setTimeout(() => resolve({ ok: false, reason: "rpc_timeout:" + method }), 30_000);
        port.addEventListener("message", (event) => {
          const message = event.data;
          if (message?.kind !== "response" || message.id !== id) return;
          clearTimeout(timer);
          if (message.error) resolve({ ok: false, reason: "rpc_error:" + method });
          else resolve({ ok: true, result: message.result });
        });
        port.start?.();
        port.postMessage({ kind: "request", id, method, args });
      });
      const ping = await call("${TASK_ID}-ping", "system.ping", [{ message: "${PING_MESSAGE}" }]);
      if (!ping.ok || ping.result?.pong !== "${PING_MESSAGE}") return { ok: false, reason: "ping_failed" };
      const created = await call("${TASK_ID}-sem", "semesters.create", [{ label: "${TASK_ID} package smoke", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" }]);
      if (!created.ok || !created.result?.id) return { ok: false, reason: "business_rpc_failed" };
      return { ok: true, semesterId: created.result.id };
    })()
  `;
  // 已安装应用首启 renderer 就绪存在竞态（页面可能仍在初始化/导航）；重试至多 5 次
  let evaluation;
  let lastError;
  let lastReason = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      evaluation = await cdp.command("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (evaluation?.result?.value?.ok) break;
      lastReason = String(evaluation?.result?.value?.reason ?? "");
      lastError = new Error(`已安装 renderer 的 system.ping 或业务 RPC 未通过（reason=${lastReason}）`);
    } catch (e) {
      lastError = e;
    }
    await delay(3_000);
  }
  if (!evaluation || !evaluation.result?.value?.ok) {
    throw lastError ?? new Error("CDP Runtime.evaluate 未返回有效结果");
  }
}

/** 启动一次安装后的应用，验证 renderer、RPC 和隔离 global.db。 */
async function verifyOneLaunch(label) {
  const debugPort = await reserveLoopbackPort();
  const child = spawn(APP_PATH, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${ELECTRON_USER_DATA_ROOT}`,
  ], {
    cwd: path.dirname(APP_PATH),
    windowsHide: true,
    env: {
      ...process.env,
      PI_STUDYBUDDY_DATA_ROOT: DATA_ROOT,
      APPDATA: path.join(PROFILE_ROOT, "roaming"),
      LOCALAPPDATA: path.join(PROFILE_ROOT, "local"),
      USERPROFILE: path.join(PROFILE_ROOT, "home"),
      HOME: path.join(PROFILE_ROOT, "home"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stderr = [];
  const stdout = [];
  const earlyExit = new Promise((_, reject) => {
    child.once("exit", (code) => reject(new Error(`已安装应用启动前退出（退出码 ${code ?? "unknown"}）`)));
  });
  child.stdout.on("data", (chunk) => stdout.push(chunk.toString()));
  child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
  try {
    const target = await Promise.race([waitForPageTarget(debugPort), earlyExit]);
    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    try {
      await pingInstalledRenderer(cdp);
      // Browser.close 会先终止调试端点，Chromium 不保证返回该命令的 CDP 响应。
      void cdp.command("Browser.close").catch(() => {});
    } finally {
      cdp.close();
    }
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(10_000),
    ]);
    if (child.exitCode === null) child.kill("SIGTERM");
    if (!fs.existsSync(path.join(DATA_ROOT, "global.db"))) {
      throw new Error("隔离业务数据根未生成 global.db");
    }
    console.log(`[package-smoke] ✅ ${label}：真实 Electron、renderer 与 system.ping 通过`);
  } catch (error) {
    if (child.exitCode === null) child.kill("SIGTERM");
    // stderr 仅作为本机失败诊断，不将原始内容回显到终端。
    fs.writeFileSync(path.join(RUN_DIR, `package-smoke-${label}-stderr.log`), stderr.join(""));
    fs.writeFileSync(path.join(RUN_DIR, `package-smoke-${label}-stdout.log`), stdout.join(""));
    throw error;
  }
}

if (!APP_PATH || !path.isAbsolute(APP_PATH) || !fs.existsSync(APP_PATH)) {
  fail("请通过 PI_STUDYBUDDY_PACKAGE_APP 提供已安装的绝对应用路径");
} else {
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  fs.mkdirSync(PROFILE_ROOT, { recursive: true });
  fs.mkdirSync(ELECTRON_USER_DATA_ROOT, { recursive: true });
  // 已安装应用偶发首次启动 RPC 路径异常（agent-host 未就绪等）：launch 级重试一次
  async function verifyWithRetry(label) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await verifyOneLaunch(label);
        return;
      } catch (error) {
        if (attempt === 0) {
          console.log(`[package-smoke] ⚠ ${label} 首次验证失败，重新启动重试`);
          await delay(2_000);
          continue;
        }
        throw error;
      }
    }
  }
  try {
    await verifyWithRetry("first-launch");
    await verifyWithRetry("second-launch");
    console.log("[package-smoke] ✅ 两次隔离启动、global.db、system.ping 与业务 RPC 全部通过");
  } catch (error) {
    fail(error instanceof Error ? error.message : "安装包启动验证异常");
  }
}
