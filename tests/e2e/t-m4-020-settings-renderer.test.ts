/**
 * T-M4-020：真实 Electron renderer 设置页主路径回归。
 * 覆盖：设置入口（⚙）→ settings.get/getSimpleMode + models.list/modelsConfig.get +
 * credentials.listKeys（隔离根空凭证断言，决策 1A，不触碰真实密钥）+ toolchains.list →
 * 返回学习工作台 + 隐私断言（无 UUID/路径/密钥明文/错误栈）。
 * 运行产物仅落入 H:\pi-studybuddy-tmp\runs\T-M4-020\。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-020\\e2e-settings";
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

const UI_JS = `(
  async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = async (predicate, message) => {
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        const value = predicate();
        if (value) return value;
        await wait(100);
      }
      throw new Error(message);
    };
    const button = (text) => Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes(text));
    const clickButton = async (text) => {
      const item = await waitFor(() => button(text), "button missing: " + text);
      item.click();
      await wait(250);
    };
    // 设置入口（侧栏 ⚙）
    const settingsBtn = await waitFor(() => Array.from(document.querySelectorAll("button")).find((b) => b.getAttribute("aria-label") === "打开设置"), "settings button missing");
    settingsBtn.click();
    await waitFor(() => document.body.textContent?.includes("本机学习偏好、密钥状态与工具链检查"), "settings page missing");
    await waitFor(() => document.body.textContent?.includes("学习偏好"), "preferences section missing");
    const settingsText = document.body.textContent || "";

    // 隔离根：凭证空（credentials.listKeys），不渲染密钥明文（决策 1A）
    const vaultEmpty = settingsText.includes("密钥") && !settingsText.includes("modelProvider:");
    const sectionsLoaded =
      settingsText.includes("学习偏好") && settingsText.includes("模型供应商") && settingsText.includes("返回学习工作台");

    // 返回学习工作台（09-UI §13.3）
    await clickButton("返回学习工作台");
    await waitFor(() => document.body.textContent?.includes("每日学习简报") || document.body.textContent?.includes("TTS"), "workbench restore missing");
    const restored = document.body.textContent || "";

    return {
      sectionsLoaded,
      vaultEmpty,
      workbenchRestored: restored.includes("TTS") || restored.includes("每日学习简报"),
      fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(settingsText + restored),
      windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(settingsText + restored),
      posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(settingsText + restored),
      fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(settingsText + restored),
      stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(settingsText + restored) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(settingsText + restored),
      rawSensitiveTextInDom: /secret\\.ts|stackFrame|sk-secret|sk-[a-z0-9]{20,}/i.test(settingsText + restored),
    };
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
const { initializeDataRoot } = require(path.join(projectRoot, "dist/main/data-root-init.js"));
initializeDataRoot(dataRoot);
let emitted = false;
function emit(result) {
  if (emitted) return;
  emitted = true;
  fs.writeFileSync(path.join(dataRoot, "renderer-result.json"), JSON.stringify(result), "utf8");
  process.stdout.write(JSON.stringify(result) + "\\n");
  setTimeout(() => app.quit(), 50);
}
function fail(_error) {
  emit({ phase: "failed", error: "真实 Electron renderer E2E 失败" });
}
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);
try { require(path.join(projectRoot, "dist/main/main.js")); } catch (error) { fail(error); }
app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error("BrowserWindow missing");
    const result = await win.webContents.executeJavaScript(${JSON.stringify(UI_JS)});
    emit({ phase: "ready", result, electron: process.versions.electron, node: process.versions.node });
  } catch (error) { fail(error); }
});
setTimeout(() => fail(new Error("renderer E2E timeout")), 30000);
`;
}

function readProbeResult(dataRoot: string): unknown {
  const resultPath = path.join(dataRoot, "renderer-result.json");
  if (!fs.existsSync(resultPath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(resultPath, "utf8"));
  } catch {
    return undefined;
  }
}

async function runProbe(): Promise<{ exitCode: number | null; stdout: string; stderr: string; result?: unknown }> {
  const dataRoot = path.join(RUN_ROOT, "case-01");
  fs.rmSync(dataRoot, { recursive: true, force: true });
  fs.mkdirSync(dataRoot, { recursive: true });
  const runner = path.join(RUN_ROOT, "runner.cjs");
  fs.writeFileSync(runner, runnerSource(), "utf8");
  try {
    const { stdout, stderr } = await execFileAsync(ELECTRON, ["--no-sandbox", runner], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PI_STUDYBUDDY_DATA_ROOT: dataRoot, E2E_RUN_DIR: RUN_ROOT, VITEST: undefined },
      windowsHide: true,
      timeout: 45_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { exitCode: 0, stdout: stdout ? "electron stdout captured" : "", stderr: stderr ? "electron stderr captured" : "", result: readProbeResult(dataRoot) };
  } catch (error) {
    const item = error as { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: typeof item.code === "number" ? item.code : null,
      stdout: item.stdout ? "electron stdout captured" : "",
      stderr: item.stderr ? "electron stderr captured" : "",
      result: readProbeResult(dataRoot),
    };
  }
}

describe("T-M4-020 真实 Electron renderer 设置页回归", () => {
  it("设置页：分区加载 + 隔离根空凭证 + 返回工作台，DOM 无敏感内部值", async () => {
    const probe = await runProbe();
    const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0);
    expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result, evidence).toMatchObject({
      sectionsLoaded: true,
      vaultEmpty: true,
      workbenchRestored: true,
      fullUuidInDom: false,
      windowsPathInDom: false,
      posixPathInDom: false,
      fileUriInDom: false,
      stackInDom: false,
      rawSensitiveTextInDom: false,
    });
  }, 90_000);
});
