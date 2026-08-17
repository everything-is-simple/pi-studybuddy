/*
 * T-M5-011: real Electron settings persistence and privacy evidence.
 * The test uses only visible renderer controls and an isolated data root.
 * It never seeds business data, reads credentials, or invokes RPC handlers directly.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-011\\e2e-settings-console";
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

const UI_JS = `(async () => {
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
  let step = "start";
  const text = () => document.body.textContent || "";
  const button = (label) => Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes(label));
  const click = async (label) => {
    const item = await waitFor(() => button(label), "button missing: " + label);
    item.click();
    await wait(300);
  };
  const labelControl = (labelText) => Array.from(document.querySelectorAll("label")).find((item) => item.textContent?.includes(labelText))?.querySelector("input, select");
  const setControl = async (labelText, value) => {
    const control = await waitFor(() => labelControl(labelText), "control missing: " + labelText);
    const setter = Object.getOwnPropertyDescriptor(control.__proto__, "value")?.set;
    if (!setter) throw new Error("control setter missing: " + labelText);
    setter.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(150);
  };
  const setCheckbox = async (labelText, checked) => {
    const control = await waitFor(() => labelControl(labelText), "checkbox missing: " + labelText);
    if (control.checked !== checked) control.click();
    await wait(500);
  };
  const openSettings = async () => {
    const settingsButton = await waitFor(() => document.querySelector('button[aria-label="打开设置"]'), "settings button missing");
    settingsButton.click();
    await waitFor(() => text().includes("本机学习偏好、密钥状态与工具链检查"), "settings page missing");
    await waitFor(() => text().includes("配置资产状态"), "config status missing");
    await waitFor(() => {
      const saveButton = button("保存通用设置");
      return Boolean(saveButton && !saveButton.disabled);
    }, "settings controls not ready");
  };
  const sensitive = (value) => ({
    fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(value),
    windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(value),
    posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(value),
    fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(value),
    stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(value) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(value),
    secretInDom: /(?:api[_-]?key|authorization|bearer|sk-[a-z0-9_-]{8,}|test-credential)/i.test(value),
  });

  step = "open-settings";
  await openSettings();
  const initial = text();
  step = "set-daily-goal";
  await setControl("每日目标时长", "95");
  step = "set-available-time";
  await setControl("可用时间", "18:30-20:30");
  step = "set-backup-frequency";
  await setControl("调度频率", "daily");
  step = "save-general";
  await click("保存通用设置");
  await waitFor(() => text().includes("学习偏好已保存"), "general settings save feedback missing");
  const generalSaveFeedbackVisible = true;
  step = "save-skills";
  await setCheckbox("显示暂不可用的学习技能", false);
  await waitFor(() => text().includes("设置分区已保存"), "skills save feedback missing");
  const skillsSaveFeedbackVisible = true;
  step = "save-console";
  await setCheckbox("启动时检查更新", false);
  await waitFor(() => text().includes("设置分区已保存"), "console save feedback missing");
  const consoleSaveFeedbackVisible = true;
  const saved = text();
  const configStatusVisible = initial.includes("配置资产状态");
  const savedSensitive = sensitive(saved);

  await click("返回学习工作台");
  await waitFor(() => !text().includes("本机学习偏好、密钥状态与工具链检查"), "workbench restore missing");
  return { initialConfigStatusVisible: initial.includes("配置资产状态"), generalSaveFeedbackVisible, skillsSaveFeedbackVisible, consoleSaveFeedbackVisible, configStatusVisible, savedSensitive };
})()`;

const REOPEN_JS = `(async () => {
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
  const text = () => document.body.textContent || "";
  const settingsButton = await waitFor(() => document.querySelector('button[aria-label="打开设置"]'), "settings button missing");
  settingsButton.click();
  await waitFor(() => text().includes("本机学习偏好、密钥状态与工具链检查"), "settings page missing after restart");
  await waitFor(() => text().includes("配置资产状态"), "settings data missing after restart");
  await waitFor(() => Array.from(document.querySelectorAll("input[type=number]"))[0]?.value === "95", "saved general setting missing after restart");
  await waitFor(() => Array.from(document.querySelectorAll("label")).find((item) => item.textContent?.includes("显示暂不可用的学习技能"))?.querySelector("input")?.checked === false, "saved skills setting missing after restart");
  await waitFor(() => Array.from(document.querySelectorAll("label")).find((item) => item.textContent?.includes("启动时检查更新"))?.querySelector("input")?.checked === false, "saved console setting missing after restart");
  const body = text();
  const dailyGoal = Array.from(document.querySelectorAll("input[type=number]"))[0]?.value;
  const availableTime = Array.from(document.querySelectorAll("input[type=text]"))[0]?.value;
  const backupFrequency = Array.from(document.querySelectorAll("select")).find((item) => item.value === "daily")?.value;
  const skills = Array.from(document.querySelectorAll("label")).find((item) => item.textContent?.includes("显示暂不可用的学习技能"))?.querySelector("input")?.checked;
  const consoleSetting = Array.from(document.querySelectorAll("label")).find((item) => item.textContent?.includes("启动时检查更新"))?.querySelector("input")?.checked;
  return {
    dailyGoal,
    availableTime,
    backupFrequency,
    skills,
    consoleSetting,
    sensitive: {
      fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(body),
      windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(body),
      posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(body),
      fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(body),
      stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(body) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(body),
      secretInDom: /(?:api[_-]?key|authorization|bearer|sk-[a-z0-9_-]{8,}|test-credential)/i.test(body),
    },
  };
})()`;

function runnerSource(resultFile: string): string {
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
  fs.writeFileSync(${JSON.stringify(resultFile)}, JSON.stringify(result, null, 2), "utf8");
  setTimeout(() => app.quit(), 100);
}
function fail(error) {
  const raw = error instanceof Error ? error.message : String(error ?? "T-M5-011 Electron settings evidence failed");
  const safe = raw.replace(/[A-Za-z]:[\\\\/][^\\s]+/g, "[path]").replace(/\\b[0-9a-f]{8}-[0-9a-f-]{27,}\\b/gi, "[id]").slice(0, 180);
  emit({ phase: "failed", error: safe || "T-M5-011 Electron settings evidence failed" });
}
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);
try { require(path.join(projectRoot, "dist/main/main.js")); } catch (error) { fail(error); }
app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error("BrowserWindow missing");
    const phase = process.env.T_M5_011_PHASE;
    const result = await win.webContents.executeJavaScript(phase === "reopen" ? ${JSON.stringify(REOPEN_JS)} : ${JSON.stringify(UI_JS)});
    emit({ phase: "ready", result, electron: process.versions.electron, node: process.versions.node });
  } catch (error) { fail(error); }
});
setTimeout(fail, 45000);
`;
}

async function runPhase(phase: "save" | "reopen", attempt = 1): Promise<any> {
  const dataRoot = path.join(RUN_ROOT, "data-root");
  fs.mkdirSync(RUN_ROOT, { recursive: true });
  const resultFile = path.join(RUN_ROOT, `${phase}-result-${attempt}.json`);
  const runner = path.join(RUN_ROOT, `${phase}-runner-${attempt}.cjs`);
  fs.rmSync(resultFile, { force: true });
  fs.writeFileSync(runner, runnerSource(resultFile), "utf8");
  const env = { ...process.env, PI_STUDYBUDDY_DATA_ROOT: dataRoot, T_M5_011_PHASE: phase, VITEST: undefined };
  delete env.VITEST;
  try {
    await execFileAsync(ELECTRON, ["--no-sandbox", runner], { cwd: PROJECT_ROOT, env, windowsHide: true, timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
  } catch {
    // The result file carries the sanitized failure marker.
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  return fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, "utf8")) : undefined;
}

describe("T-M5-011 real Electron settings console", () => {
  it("visible settings save and restart readback stay isolated and redacted", async () => {
    fs.rmSync(RUN_ROOT, { recursive: true, force: true });
    fs.mkdirSync(RUN_ROOT, { recursive: true });
    const save = await runPhase("save");
    let reopen = await runPhase("reopen");
    // A prior Electron process can retain the single-instance lock briefly after exit on Windows.
    // Retry only the second visible launch, against the same persisted data root.
    if (reopen?.phase !== "ready") reopen = await runPhase("reopen", 2);
    const evidence = JSON.stringify({ save, reopen }, null, 2);
    expect(save?.phase, evidence).toBe("ready");
    expect(save?.result, evidence).toMatchObject({
      initialConfigStatusVisible: true,
      generalSaveFeedbackVisible: true,
      skillsSaveFeedbackVisible: true,
      consoleSaveFeedbackVisible: true,
      configStatusVisible: true,
      savedSensitive: { fullUuidInDom: false, windowsPathInDom: false, posixPathInDom: false, fileUriInDom: false, stackInDom: false, secretInDom: false },
    });
    expect(reopen?.phase, evidence).toBe("ready");
    expect(reopen?.result, evidence).toMatchObject({
      dailyGoal: "95",
      availableTime: "18:30-20:30",
      backupFrequency: "daily",
      skills: false,
      consoleSetting: false,
      sensitive: { fullUuidInDom: false, windowsPathInDom: false, posixPathInDom: false, fileUriInDom: false, stackInDom: false, secretInDom: false },
    });
    fs.writeFileSync(path.join(RUN_ROOT, "evidence.json"), evidence, "utf8");
  }, 120_000);
});
