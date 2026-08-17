/**
 * T-M4-017：真实 Electron renderer → preload → TCP/RPC → agent-host → S7 handler → renderer E2E。
 * 覆盖：采集 Tab 入口、合规确认门控、文件选择（renderer 测试 seam，原生对话框不可自动化）、
 * 转写（受控 E2E 显式 mock whisper，validatePcmWav 服务端重验证真实文件头）、
 * 可编辑转写、保存为 S2 笔记输入、归档只读、隐私断言。
 * 运行产物仅落入 H:\pi-studybuddy-tmp\runs\T-M4-017\。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-017\\e2e-renderer";
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

const UI_JS = `(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, message) => { const deadline = Date.now() + 15000; while (Date.now() < deadline) { const value = predicate(); if (value) return value; await wait(100); } throw new Error(message); };
  const button = (text) => Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes(text));
  const click = async (text) => { const item = await waitFor(() => button(text), "button missing: " + text); item.click(); await wait(250); };
  const setNativeValue = (el, value) => { const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set; if (setter) setter.call(el, value); else el.value = value; el.dispatchEvent(new Event("input", { bubbles: true })); };

  await click("T-M4-017 Renderer E2E");
  await wait(300);
  await click("T-M4-017 物理");
  await wait(300);
  await click("采集");
  await waitFor(() => document.body.textContent?.includes("课堂采集"), "capture tab missing");
  const entryText = document.body.textContent || "";
  const readOnly = entryText.includes("当前学期已归档");
  if (readOnly) {
    const result = document.body.textContent || "";
    return {
      readOnlyVisible: true,
      selectDisabled: Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("选择文件")).every((b) => b.disabled),
      transcribeDisabled: Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("开始转写")).every((b) => b.disabled),
      rawSensitiveTextInDom: /secret\\.ts|stackFrame|sk-secret/i.test(result),
    };
  }

  // renderer 测试 seam：受控夹具注入（原生对话框不可自动化；仅本 E2E 的 executeJavaScript 设置）
  window.__PI_CAPTURE_FIXTURE__ = {
    name: "课堂录音.wav",
    size: window.__PI_CAPTURE_WAV_SIZE__,
    mime: "audio/wav",
    path: window.__PI_CAPTURE_WAV_PATH__,
  };

  // 合规确认门控：未勾选时转写禁用
  const beforeCheckbox = document.body.textContent || "";
  const transcribeDisabledBefore = Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("开始转写")).every((b) => b.disabled);

  // 勾选合规确认
  const checkbox = await waitFor(() => document.querySelector('input[type="checkbox"]'), "permission checkbox missing");
  checkbox.click();
  await wait(250);

  // 选择文件（seam）
  await click("选择文件");
  await waitFor(() => document.body.textContent?.includes("课堂录音.wav"), "selected file missing");

  // 开始转写（真实 RPC → 显式测试 mock whisper → 服务端重验证 WAV 文件头）
  await click("开始转写");
  await waitFor(() => document.body.textContent?.includes("mock 转写文本"), "transcribe result missing");
  const transcribed = document.body.textContent || "";

  // 可编辑：修改转写文本
  const editor = await waitFor(() => document.querySelector("textarea"), "transcription textarea missing");
  setNativeValue(editor, "今天讲解了导数的定义与几何意义（学生编辑后）。");
  await wait(250);

  // 保存为 S2 笔记输入（真实 RPC → 生产 S7 handler → S2 handoff）
  await click("保存为笔记");
  await waitFor(() => document.body.textContent?.includes("已保存"), "save confirmation missing");
  const saved = document.body.textContent || "";

  return {
    captureTabVisible: entryText.includes("课堂采集") && entryText.includes("合规确认"),
    permissionGate: transcribeDisabledBefore,
    fileSelected: transcribed.includes("课堂录音.wav"),
    transcribeVisible: transcribed.includes("mock 转写文本"),
    editableApplied: saved.includes("今天讲解了导数的定义与几何意义（学生编辑后）。"),
    saveConfirmed: saved.includes("已保存") && saved.includes("S2 笔记输入"),
    fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(saved),
    windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(saved),
    posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(saved),
    fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(saved),
    stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(saved) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(saved),
    rawSensitiveTextInDom: /secret\\.ts|stackFrame|sk-secret/i.test(saved),
  };
})()`;

function runnerSource(): string {
  return String.raw`
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs"); const path = require("node:path");
const projectRoot = ${JSON.stringify(PROJECT_ROOT)}; const dataRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
app.setPath("userData", path.join(dataRoot, ".electron-user-data"));
const { initializeDataRoot } = require(path.join(projectRoot, "dist/main/data-root-init.js"));
const { S1Context, createS1Handlers } = require(path.join(projectRoot, "dist/agent-host/handlers/s1/index.js"));

function createPcmWavBuffer(sampleCount) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii"); header.writeUInt32LE(36 + sampleCount * 2, 4); header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii"); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24); header.writeUInt32LE(16000 * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii"); header.writeUInt32LE(sampleCount * 2, 40);
  const data = Buffer.alloc(sampleCount * 2, 0);
  return Buffer.concat([header, data]);
}

function seedFixture() {
  initializeDataRoot(dataRoot);
  const s1 = new S1Context(dataRoot);
  const handlers = createS1Handlers(s1);
  const semester = handlers["semesters.create"]({ label: "T-M4-017 Renderer E2E", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" });
  const course = handlers["courses.create"]({ semesterId: semester.id, courseName: "T-M4-017 物理", subject: "物理" });
  // 受控 PCM WAV 夹具（服务端重验证文件头：RIFF/WAVE/PCM/单声道/16kHz/16-bit）
  const wavPath = path.join(dataRoot, "class-capture-fixture.wav");
  fs.writeFileSync(wavPath, createPcmWavBuffer(1600));
  const stat = fs.statSync(wavPath);
  s1.dispose();
  return { semesterId: semester.id, courseId: course.id, wavPath, wavSize: stat.size };
}

const seeded = seedFixture();
if (process.env.T_M4_017_ARCHIVED === "1") {
  const s1 = new S1Context(dataRoot);
  createS1Handlers(s1)["semesters.archive"]({ id: seeded.semesterId });
  s1.dispose();
}
let emitted = false;
function emit(result) {
  if (emitted) return; emitted = true;
  fs.writeFileSync(path.join(dataRoot, "renderer-result.json"), JSON.stringify(result), "utf8");
  process.stdout.write(JSON.stringify(result) + "\\n");
  setTimeout(() => app.quit(), 50);
}
function fail() { emit({ phase: "failed", error: "真实 Electron renderer E2E 失败" }); }
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);
try { require(path.join(projectRoot, "dist/main/main.js")); } catch (error) { fail(); }
app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error("BrowserWindow missing");
    await win.webContents.executeJavaScript("window.__PI_CAPTURE_WAV_PATH__ = " + JSON.stringify(seeded.wavPath) + "; window.__PI_CAPTURE_WAV_SIZE__ = " + seeded.wavSize + ";");
    emit({ phase: "ready", result: await win.webContents.executeJavaScript(${JSON.stringify(UI_JS)}) });
  } catch (error) { fail(); }
});
setTimeout(() => fail(), 30000);
`;
}

async function runProbe(archived = false): Promise<{ exitCode: number | null; result?: any }> {
  const dataRoot = path.join(RUN_ROOT, archived ? "case-archived" : "case-01");
  fs.rmSync(dataRoot, { recursive: true, force: true });
  fs.mkdirSync(dataRoot, { recursive: true });
  fs.mkdirSync(RUN_ROOT, { recursive: true });
  const runner = path.join(RUN_ROOT, "runner.cjs");
  fs.writeFileSync(runner, runnerSource(), "utf8");
  try {
    await execFileAsync(ELECTRON, ["--no-sandbox", runner], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PI_STUDYBUDDY_DATA_ROOT: dataRoot, E2E_RUN_DIR: RUN_ROOT, T_M4_017_ARCHIVED: archived ? "1" : undefined, VITEST: "1" },
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { exitCode: 0, result: JSON.parse(fs.readFileSync(path.join(dataRoot, "renderer-result.json"), "utf8")) };
  } catch (error) {
    const item = error as { code?: number };
    const resultPath = path.join(dataRoot, "renderer-result.json");
    return {
      exitCode: typeof item.code === "number" ? item.code : null,
      result: fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, "utf8")) : undefined,
    };
  }
}

describe("T-M4-017 真实 Electron renderer CaptureTab", () => {
  it("采集 Tab：合规门控 → 文件选择 → 转写 → 可编辑 → 保存，且 DOM 无敏感内部值", async () => {
    const probe = await runProbe();
    const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0);
    expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result, evidence).toMatchObject({
      captureTabVisible: true,
      permissionGate: true,
      fileSelected: true,
      transcribeVisible: true,
      editableApplied: true,
      saveConfirmed: true,
      fullUuidInDom: false,
      windowsPathInDom: false,
      posixPathInDom: false,
      fileUriInDom: false,
      stackInDom: false,
      rawSensitiveTextInDom: false,
    });
  }, 90_000);

  it("归档学期在真实 Electron renderer 中保持只读（采集操作禁用）", async () => {
    const probe = await runProbe(true);
    const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0);
    expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result, evidence).toMatchObject({
      readOnlyVisible: true,
      selectDisabled: true,
      transcribeDisabled: true,
      rawSensitiveTextInDom: false,
    });
  }, 90_000);
});
