/**
 * T-M4-022：真实 Electron 生产启动验收。
 *
 * 这些断言故意不走 tests/e2e/test-main.js；它们启动 node_modules/electron 的真实主进程，
 * require dist/main/main.js，并从隔离数据根观察 SQLite、BrowserWindow、preload 与 RPC。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-022\\red";
const DESKTOP_SMOKE_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-022\\desktop-smoke";
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

interface ElectronProbe {
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  result?: {
    phase: string;
    electron: string;
    node: string;
    nodeSqliteAvailable: boolean;
    sqliteAdapterReady: boolean;
    dataRoot: string;
    globalDb: boolean;
    windowCount: number;
    browserWindowReady: boolean;
    preloadBridgeReady: boolean;
    preloadBridgeMethods: string[];
    systemPing?: { pong?: string; timestamp?: number };
    semestersList?: unknown;
    agentNoConfig?: { code?: string; message?: string; unexpectedSuccess?: boolean };
    error?: string;
  };
}

const RENDERER_PROBE = `(
  async () => {
    const bridge = window.piBridge;
    const methods = bridge ? Object.keys(bridge).sort() : [];
    const rpc = (port, id, method, args) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(method + " timeout")), 5000);
      const onMessage = (event) => {
        const msg = event.data;
        if (msg?.kind === "response" && msg.id === id) {
          clearTimeout(timer);
          if (msg.error) reject(msg.error); else resolve(msg.result);
        }
      };
      if (typeof port.addEventListener === "function") port.addEventListener("message", onMessage);
      else port.onmessage = onMessage;
      port.postMessage({ kind: "request", id, method, args });
    });
    let systemPing;
    let semestersList;
    let agentNoConfig;
    try {
      const port = await bridge.connectHost();
      port.start?.();
      systemPing = await rpc(port, "real-electron-ping", "system.ping", [{ message: "T-M4-022" }]);
      semestersList = await rpc(port, "real-electron-semesters", "semesters.list", [{}]);
      try {
        await rpc(port, "real-electron-agent", "agent.send", [{ sessionId: "e2e-session", text: "hello" }]);
        agentNoConfig = { unexpectedSuccess: true };
      } catch (error) {
        agentNoConfig = { code: error?.code, message: error?.message };
      }
    } catch (error) {
      systemPing = { error: String(error?.message || error) };
    }
    return { bridge: Boolean(bridge), methods, systemPing, semestersList, agentNoConfig };
  }
)()`;

function runnerSource(): string {
  return String.raw`
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const projectRoot = ${JSON.stringify(PROJECT_ROOT)};
const dataRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
app.setPath("userData", path.join(dataRoot, ".electron-user-data"));
let emitted = false;
function emit(result) {
  if (emitted) return;
  emitted = true;
  result.dataRoot = dataRoot;
  result.globalDb = fs.existsSync(path.join(dataRoot, "global.db"));
  process.stdout.write(JSON.stringify(result) + "\n");
  setTimeout(() => app.quit(), 50);
}
function fail(phase, error, extra = {}) {
  emit({ phase, electron: process.versions.electron, node: process.versions.node,
    nodeSqliteAvailable: false, sqliteAdapterReady: false, windowCount: 0,
    browserWindowReady: false, preloadBridgeReady: false, preloadBridgeMethods: [],
    error: error instanceof Error ? error.stack || error.message : String(error), ...extra });
}
process.on("uncaughtException", (error) => fail("uncaughtException", error));
process.on("unhandledRejection", (error) => fail("unhandledRejection", error));
const nodeSqliteAvailable = (() => {
  try { return typeof process.getBuiltinModule?.("node:sqlite")?.DatabaseSync === "function"; }
  catch { return false; }
})();
let sqliteAdapterReady = false;
try {
  const sqlite = require(path.join(projectRoot, "dist/data/sqlite.js"));
  sqliteAdapterReady = typeof sqlite.DatabaseSync === "function";
} catch (error) {
  fail("sqlite-adapter", error, { nodeSqliteAvailable });
}
try {
  require(path.join(projectRoot, "dist/main/main.js"));
} catch (error) {
  fail("main-require", error, { nodeSqliteAvailable, sqliteAdapterReady });
}
app.whenReady().then(async () => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const windows = BrowserWindow.getAllWindows();
  const win = windows[0];
  if (!win) {
    fail("browser-window", new Error("生产 main 未创建 BrowserWindow"), { nodeSqliteAvailable, sqliteAdapterReady, windowCount: 0 });
    return;
  }
  try {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const inspected = await win.webContents.executeJavaScript(${JSON.stringify(RENDERER_PROBE)});
    emit({ phase: "ready", electron: process.versions.electron, node: process.versions.node,
      nodeSqliteAvailable, sqliteAdapterReady, windowCount: windows.length,
      browserWindowReady: true, preloadBridgeReady: Boolean(inspected.bridge),
      preloadBridgeMethods: inspected.methods, systemPing: inspected.systemPing,
      semestersList: inspected.semestersList, agentNoConfig: inspected.agentNoConfig });
  } catch (error) {
    fail("renderer-inspection", error, { nodeSqliteAvailable, sqliteAdapterReady, windowCount: windows.length, browserWindowReady: true });
  }
}).catch((error) => fail("app-when-ready", error, { nodeSqliteAvailable, sqliteAdapterReady }));
setTimeout(() => fail("timeout", new Error("real Electron probe timed out"), { nodeSqliteAvailable, sqliteAdapterReady }), 15000);
`;
}

async function probe(root: string, suffix: string, reuseDataRoot = false): Promise<ElectronProbe> {
  const dataRoot = path.join(root, suffix);
  if (!reuseDataRoot) fs.rmSync(dataRoot, { recursive: true, force: true });
  fs.mkdirSync(dataRoot, { recursive: true });
  const runner = path.join(root, `runner-${suffix}.cjs`);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(runner, runnerSource(), "utf8");
  try {
    // 无头 Windows 验收需要绕过 Chromium sandbox 启动限制；生产 BrowserWindow 仍由安全门禁断言 sandbox:true。
    const { stdout, stderr } = await execFileAsync(ELECTRON, ["--no-sandbox", runner], {
      cwd: PROJECT_ROOT,
      env: (() => {
        const env = { ...process.env, PI_STUDYBUDDY_DATA_ROOT: dataRoot };
        delete env.VITEST; // 子进程必须走 production host，不能继承 vitest fixture 开关。
        return env;
      })(),
      windowsHide: true,
      timeout: 25_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
    return { exitCode: 0, signal: null, stdout, stderr, result: lines.length ? JSON.parse(lines.at(-1)!) : undefined };
  } catch (error) {
    const e = error as { code?: number; signal?: string; stdout?: string; stderr?: string };
    const stdout = e.stdout ?? "";
    const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
    return { exitCode: typeof e.code === "number" ? e.code : null, signal: e.signal ?? null, stdout, stderr: e.stderr ?? String(error), result: lines.length ? JSON.parse(lines.at(-1)!) : undefined };
  }
}

describe("T-M4-022 真实 Electron 生产运行时", () => {
  it("T-M4-022-RED-01：真实 Electron 中 SQLite 适配器可用", async () => {
    const probeResult = await probe(RUN_ROOT, "red-01");
    expect(probeResult.result?.sqliteAdapterReady, JSON.stringify(probeResult, null, 2)).toBe(true);
  });

  it("T-M4-022-RED-02/03：真实 main 启动并在隔离根创建 global.db", async () => {
    const probeResult = await probe(RUN_ROOT, "red-02");
    expect(probeResult.result?.phase, JSON.stringify(probeResult, null, 2)).toBe("ready");
    expect(probeResult.result?.globalDb).toBe(true);
  });

  it("T-M4-022-RED-04：同一隔离根第二次真实启动幂等", async () => {
    const first = await probe(RUN_ROOT, "red-04");
    const second = await probe(RUN_ROOT, "red-04", true);
    expect(first.result?.phase, JSON.stringify(first, null, 2)).toBe("ready");
    expect(second.result?.phase, JSON.stringify(second, null, 2)).toBe("ready");
    expect(second.result?.globalDb).toBe(true);
  });

  it("T-M4-022-RED-05/06：真实 BrowserWindow 与 preload piBridge 就绪", async () => {
    const probeResult = await probe(RUN_ROOT, "red-05");
    expect(probeResult.result?.browserWindowReady, JSON.stringify(probeResult, null, 2)).toBe(true);
    expect(probeResult.result?.preloadBridgeReady).toBe(true);
    expect(probeResult.result?.preloadBridgeMethods).toEqual([
      "closeWindow", "connectHost", "getWindowState", "maximizeWindow", "minimizeWindow",
      "queryToolchains", "selectDirectory", "showDialog",
    ]);
  });

  it("T-M4-023-E2E-01：真实 Electron 走代表性业务 RPC，且未配置模型不产生 fixture 回复", async () => {
    const probeResult = await probe(RUN_ROOT, "t-m4-023-business-agent");
    const evidence = JSON.stringify(probeResult, null, 2);
    expect(probeResult.result?.phase, evidence).toBe("ready");
    expect(probeResult.result?.semestersList, evidence).toEqual([]);
    expect(probeResult.result?.agentNoConfig, evidence).toEqual({
      code: "MODEL_NOT_CONFIGURED",
      message: "尚未配置可用 AI 模型，请先在设置中完成模型配置",
    });
  });

  it("T-M4-022-RED-07：真实 renderer→system.ping 往返", async () => {
    const probeResult = await probe(RUN_ROOT, "red-07");
    expect(probeResult.result?.systemPing, JSON.stringify(probeResult, null, 2)).toMatchObject({
      pong: "T-M4-022",
    });
    expect(typeof probeResult.result?.systemPing?.timestamp).toBe("number");
  });

  it("T-M4-022-DESKTOP-SMOKE：真实桌面隔离根双启动", async () => {
    const first = await probe(DESKTOP_SMOKE_ROOT, "app");
    const second = await probe(DESKTOP_SMOKE_ROOT, "app", true);
    for (const [label, probeResult] of [["first", first], ["second", second]] as const) {
      const evidence = `${label}: ${JSON.stringify(probeResult, null, 2)}`;
      expect(probeResult.exitCode, evidence).toBe(0);
      expect(probeResult.signal, evidence).toBeNull();
      expect(probeResult.result?.dataRoot, evidence).toBe(path.join(DESKTOP_SMOKE_ROOT, "app"));
      expect(probeResult.result?.phase, evidence).toBe("ready");
      expect(probeResult.result?.electron, evidence).toBe("36.9.5");
      expect(probeResult.result?.node, evidence).toBe("22.19.0");
      expect(probeResult.result?.globalDb, evidence).toBe(true);
      expect(probeResult.result?.systemPing, evidence).toMatchObject({ pong: "T-M4-022" });
    }
  });
});
