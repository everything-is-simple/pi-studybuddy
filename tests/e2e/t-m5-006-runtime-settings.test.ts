/**
 * T-M5-006: real Electron runtime capability settings evidence.
 *
 * Uses a fresh isolated data root and visible UI controls only. External OCR,
 * whisper, WPS, edge-tts, model, and delivery services are never invoked.
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-006\\e2e-runtime-settings";
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

const UI_JS = `(
  async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = async (predicate, message) => {
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        const value = predicate();
        if (value) return value;
        await wait(100);
      }
      throw new Error(message);
    };
    const settingsButton = await waitFor(
      () => Array.from(document.querySelectorAll("button")).find((button) => button.getAttribute("aria-label") === "打开设置"),
      "settings button missing",
    );
    settingsButton.click();
    await waitFor(() => document.body.textContent?.includes("本机学习偏好、密钥状态与工具链检查"), "settings page missing");
    await waitFor(() => document.body.textContent?.includes("WPS/Office 为外部可选依赖，不随应用安装"), "runtime capability details missing");
    const settingsText = document.body.textContent || "";
    const capabilityChecks = {
      piRuntime: settingsText.includes("pi runtime") && settingsText.includes("StudyBuddy extension"),
      managedSkills: settingsText.includes("学习技能") && settingsText.includes("2 skills"),
      sapiOffline: settingsText.includes("SAPI 离线朗读") && settingsText.includes("Windows 系统语音能力可用于离线朗读"),
      edgeOptional: settingsText.includes("edge-tts 可选朗读") && settingsText.includes("在设置中配置 edge-tts 后手动测试"),
      ocrRecoverable: settingsText.includes("本地 OCR") && settingsText.includes("完成 OCR 运行资产装配后手动测试"),
      whisperRecoverable: settingsText.includes("课堂语音转写") && settingsText.includes("配置 whisper.cpp CLI 与模型后手动测试"),
      wpsExternal: settingsText.includes("WPS/Office 旧格式转换") && settingsText.includes("安装并授权 WPS/Office 后手动测试旧格式转换"),
      optionalDoesNotBlock: settingsText.includes("可选学习能力未配置，不影响其它学习功能"),
    };
    const bridge = window.piBridge;
    const statuses = bridge ? await (async () => {
      const port = await bridge.connectHost();
      port.start?.();
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("toolchains.list timeout")), 8000);
        port.addEventListener("message", (event) => {
          const message = event.data;
          if (message?.kind !== "response" || message.id !== "runtime-statuses") return;
          clearTimeout(timer);
          if (message.error) reject(message.error); else resolve(message.result);
        });
        port.postMessage({ kind: "request", id: "runtime-statuses", method: "toolchains.list", args: [{}] });
      });
    })() : [];
    const byCapabilityId = new Map(Array.isArray(statuses) ? statuses.map((status) => [status?.capabilityId, status]) : []);
    const returnButton = await waitFor(
      () => Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("返回学习工作台")),
      "return button missing",
    );
    returnButton.click();
    await waitFor(() => !document.body.textContent?.includes("本机学习偏好、密钥状态与工具链检查"), "workbench restore missing");
    return {
      capabilityChecks,
      runtimeHealth: {
        pi: byCapabilityId.get("runtime.pi")?.health,
        extension: byCapabilityId.get("runtime.studybuddy-extension")?.health,
        skills: byCapabilityId.get("runtime.native-skills")?.health,
      },
      workbenchRestored: true,
      fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(settingsText),
      windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(settingsText),
      posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(settingsText),
      fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(settingsText),
      stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(settingsText) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(settingsText),
    };
  }
)()`;

function runnerSource(): string {
  return String.raw`
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const projectRoot = ${JSON.stringify(PROJECT_ROOT)};
const runRoot = ${JSON.stringify(RUN_ROOT)};
const dataRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
app.setPath("userData", path.join(dataRoot, ".electron-user-data"));
let emitted = false;
function emit(result) {
  if (emitted) return;
  emitted = true;
  fs.writeFileSync(path.join(runRoot, "renderer-result.json"), JSON.stringify(result, null, 2), "utf8");
  process.stdout.write(JSON.stringify(result) + "\\n");
  setTimeout(() => app.quit(), 50);
}
function fail() { emit({ phase: "failed", error: "真实 Electron 运行能力设置验收失败" }); }
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);
try { require(path.join(projectRoot, "dist/main/main.js")); } catch { fail(); }
app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error("BrowserWindow missing");
    const result = await win.webContents.executeJavaScript(${JSON.stringify(UI_JS)});
    const imagePath = path.join(runRoot, "runtime-settings.png");
    let png = Buffer.alloc(0);
    for (let attempt = 0; attempt < 3 && png.length === 0; attempt += 1) {
      const image = await win.webContents.capturePage();
      png = image.toPNG();
      if (png.length === 0) await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (png.length === 0) throw new Error("runtime settings screenshot was empty");
    const temporaryImagePath = imagePath + ".tmp";
    fs.writeFileSync(temporaryImagePath, png);
    fs.renameSync(temporaryImagePath, imagePath);
    emit({ phase: "ready", result, electron: process.versions.electron, node: process.versions.node });
  } catch { fail(); }
});
setTimeout(fail, 45000);
`;
}

async function runProbe(): Promise<{ exitCode: number | null; result?: any }> {
  const dataRoot = path.join(RUN_ROOT, "data-root");
  fs.rmSync(RUN_ROOT, { recursive: true, force: true });
  fs.mkdirSync(RUN_ROOT, { recursive: true });
  const runner = path.join(RUN_ROOT, "runner.cjs");
  fs.writeFileSync(runner, runnerSource(), "utf8");
  const env = { ...process.env, PI_STUDYBUDDY_DATA_ROOT: dataRoot };
  delete env.VITEST;
  delete env.PI_STUDYBUDDY_OCR_PYTHON;
  delete env.PI_STUDYBUDDY_OCR_BRIDGE;
  delete env.PI_STUDYBUDDY_WHISPER_CLI;
  delete env.PI_STUDYBUDDY_WHISPER_MODEL;
  delete env.PI_STUDYBUDDY_EDGE_TTS_CLI;
  delete env.PI_STUDYBUDDY_WPS_PYTHON;
  delete env.PI_STUDYBUDDY_WPS_BRIDGE;
  try {
    await execFileAsync(ELECTRON, ["--no-sandbox", runner], {
      cwd: PROJECT_ROOT,
      env,
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { exitCode: 0, result: JSON.parse(fs.readFileSync(path.join(RUN_ROOT, "renderer-result.json"), "utf8")) };
  } catch (error) {
    const item = error as { code?: number };
    const resultPath = path.join(RUN_ROOT, "renderer-result.json");
    return {
      exitCode: typeof item.code === "number" ? item.code : null,
      result: fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, "utf8")) : undefined,
    };
  }
}

describe("T-M5-006 real Electron runtime capability settings", () => {
  it("shows managed runtime and recoverable optional capabilities without sensitive DOM values", async () => {
    const probe = await runProbe();
    const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0);
    expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result, evidence).toMatchObject({
      capabilityChecks: {
        piRuntime: true,
        managedSkills: true,
        sapiOffline: true,
        edgeOptional: true,
        ocrRecoverable: true,
        whisperRecoverable: true,
        wpsExternal: true,
        optionalDoesNotBlock: true,
      },
      runtimeHealth: { pi: "healthy", extension: "healthy", skills: "healthy" },
      workbenchRestored: true,
      fullUuidInDom: false,
      windowsPathInDom: false,
      posixPathInDom: false,
      fileUriInDom: false,
      stackInDom: false,
    });
    expect(fs.statSync(path.join(RUN_ROOT, "runtime-settings.png")).size).toBeGreaterThan(0);
  }, 90_000);
});
