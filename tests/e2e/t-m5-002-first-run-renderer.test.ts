/**
 * T-M5-002：真实 Electron 空数据首次启动。
 * 不种子学期/课程，不调用 handler 绕过 UI；仅通过实际 renderer 可见控件创建并重启验证。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-002\\e2e-first-run";
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

const CREATE_UI = `(
  async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = async (predicate, message) => {
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) { const value = predicate(); if (value) return value; await wait(100); }
      throw new Error(message);
    };
    const click = async (text) => { const item = await waitFor(() => Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes(text)), "button missing: " + text); item.click(); await wait(150); };
    const set = async (label, value) => {
      const input = await waitFor(() => document.querySelector('input[aria-label="' + label + '"]'), "input missing: " + label);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    await click("创建学习计划");
    await set("学期名称", "T-M5-002 空数据学期");
    await set("学期开始日期", "2026-09-01");
    await set("学期结束日期", "2027-01-20");
    await click("下一步");
    await set("课程名称", "T-M5-002 空数据课程");
    await set("课程学科", "数学");
    await click("完成创建");
    await waitFor(() => document.body.textContent?.includes("每日学习简报"), "home missing after creation");
    await click("管理学习计划");
    await click("新增考试");
    await set("考试名称", "T-M5-002 期末考试");
    await set("考试日期", "2027-01-10");
    await click("保存考试");
    await waitFor(() => document.body.textContent?.includes("T-M5-002 期末考试"), "exam missing after create");
    await click("确认");
    await waitFor(() => document.body.textContent?.includes("已确认"), "exam confirmation missing");
    await click("新增课表");
    await click("保存课表");
    await click("新增任务");
    await set("任务名称", "T-M5-002 首次复习任务");
    await click("保存任务");
    await waitFor(() => document.body.textContent?.includes("T-M5-002 首次复习任务"), "task missing after create");
    await click("完成");
    await waitFor(() => document.body.textContent?.includes("已完成"), "task completion missing");
    const text = document.body.textContent || "";
    return {
      created: text.includes("T-M5-002 空数据学期 / T-M5-002 空数据课程"),
      examCreated: text.includes("T-M5-002 期末考试") && text.includes("已确认"),
      scheduleCreated: text.includes("周1 08:00-09:30"),
      taskCompleted: text.includes("T-M5-002 首次复习任务") && text.includes("已完成"),
      fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(text),
    };
  }
)()`;

const REOPEN_UI = `(
  async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = async (predicate, message) => {
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) { const value = predicate(); if (value) return value; await wait(100); }
      throw new Error(message);
    };
    const semester = await waitFor(() => Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("T-M5-002 空数据学期")), "created semester missing after restart");
    semester.click();
    const course = await waitFor(() => Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("T-M5-002 空数据课程")), "created course missing after restart");
    course.click();
    await wait(200);
    const text = document.body.textContent || "";
    return { persisted: text.includes("T-M5-002 空数据学期 / T-M5-002 空数据课程"), fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(text) };
  }
)()`;

function runnerSource(uiSource: string, resultPath: string): string {
  return String.raw`
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const projectRoot = ${JSON.stringify(PROJECT_ROOT)};
const dataRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
app.setPath("userData", path.join(dataRoot, ".electron-user-data"));
let emitted = false;
function emit(result) { if (emitted) return; emitted = true; fs.writeFileSync(${JSON.stringify(resultPath)}, JSON.stringify(result), "utf8"); setTimeout(() => app.quit(), 50); }
function fail() { emit({ phase: "failed", error: "真实 Electron renderer E2E 失败" }); }
process.on("uncaughtException", fail); process.on("unhandledRejection", fail);
try { require(path.join(projectRoot, "dist/main/main.js")); } catch (_) { fail(); }
app.whenReady().then(async () => {
  try { const win = BrowserWindow.getAllWindows()[0]; if (!win) throw new Error("window missing"); const result = await win.webContents.executeJavaScript(${JSON.stringify(uiSource)}); emit({ phase: "ready", result }); } catch (_) { fail(); }
});
setTimeout(fail, 30000);
`;
}

async function runCase(name: string, uiSource: string, dataRoot: string): Promise<unknown> {
  const resultPath = path.join(RUN_ROOT, `${name}.json`);
  const runnerPath = path.join(RUN_ROOT, `${name}.cjs`);
  fs.writeFileSync(runnerPath, runnerSource(uiSource, resultPath), "utf8");
  try {
    await execFileAsync(ELECTRON, ["--no-sandbox", runnerPath], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PI_STUDYBUDDY_DATA_ROOT: dataRoot, E2E_RUN_DIR: RUN_ROOT, VITEST: undefined },
      windowsHide: true,
      timeout: 45_000,
      maxBuffer: 2 * 1024 * 1024,
    });
  } catch {
    // The result file contains the deliberately redacted outcome.
  }
  return fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, "utf8")) : undefined;
}

describe("T-M5-002 真实 Electron 空数据首次启动", () => {
  it("通过 UI 创建学期和课程，并在第二次启动后保持", async () => {
    const dataRoot = path.join(RUN_ROOT, "case-01");
    fs.rmSync(dataRoot, { recursive: true, force: true });
    fs.mkdirSync(dataRoot, { recursive: true });
    const first = await runCase("first-launch", CREATE_UI, dataRoot) as { phase?: string; result?: unknown } | undefined;
    const second = await runCase("second-launch", REOPEN_UI, dataRoot) as { phase?: string; result?: unknown } | undefined;
    expect(first).toMatchObject({ phase: "ready", result: { created: true, examCreated: true, scheduleCreated: true, taskCompleted: true, fullUuidInDom: false } });
    expect(second).toMatchObject({ phase: "ready", result: { persisted: true, fullUuidInDom: false } });
  }, 120_000);
});
