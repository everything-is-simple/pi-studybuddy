/**
 * T-M4-020：真实 Electron renderer S1 首页主路径回归。
 * 覆盖：首页 Tab 每日学习简报（tasks.dailyBrief 规则聚合）+ 任务列表（tasks.list）+
 * 考试倒计时（exams.list）+ 隐私断言（无完整 UUID/路径/错误栈）。
 * 运行产物仅落入 H:\pi-studybuddy-tmp\runs\T-M4-020\。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-020\\e2e-home";
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
    await clickButton("T-M4-020 Renderer E2E");
    await clickButton("T-M4-020 Renderer 数学");
    // 首页 Tab（09-UI §4.3）
    const homeTab = await waitFor(() => Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("📊")), "home tab missing");
    homeTab.click();
    await waitFor(() => document.body.textContent?.includes("每日学习简报"), "daily brief missing");
    await waitFor(() => document.body.textContent?.includes("T-M4-020 今日任务"), "task missing");
    await waitFor(() => document.body.textContent?.includes("T-M4-020 期末考试"), "exam missing");
    const visible = document.body.textContent || "";
    return {
      briefVisible: visible.includes("每日学习简报"),
      taskVisible: visible.includes("T-M4-020 今日任务") && visible.includes("待办"),
      examVisible: visible.includes("T-M4-020 期末考试") && visible.includes("还有"),
      pendingItemsVisible: visible.includes("今日待办"),
      fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(visible),
      windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(visible),
      posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(visible),
      fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(visible),
      stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(visible) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(visible),
      rawSensitiveTextInDom: /secret\\.ts|stackFrame|sk-secret/i.test(visible),
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
const { S1Context, createS1Handlers } = require(path.join(projectRoot, "dist/agent-host/handlers/s1/index.js"));
function seedFixture() {
  initializeDataRoot(dataRoot);
  const s1 = new S1Context(dataRoot);
  const handlers = createS1Handlers(s1);
  const semester = handlers["semesters.create"]({ label: "T-M4-020 Renderer E2E", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" });
  const course = handlers["courses.create"]({ semesterId: semester.id, courseName: "T-M4-020 Renderer 数学", subject: "数学" });
  // 今日到期任务（dailyBrief 规则聚合，07-WF §2.2）
  handlers["tasks.create"]({ courseId: course.id, title: "T-M4-020 今日任务", taskType: "practice", dueDate: new Date().toISOString().slice(0, 10), priority: 1 });
  // 未来考试（倒计时展示）
  const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  handlers["exams.add"]({ courseId: course.id, examName: "T-M4-020 期末考试", examType: "final", scheduledDate: in30, source: "student_input" });
  s1.dispose();
}
seedFixture();
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

describe("T-M4-020 真实 Electron renderer S1 首页回归", () => {
  it("首页：每日学习简报 + 任务列表 + 考试倒计时，DOM 无敏感内部值", async () => {
    const probe = await runProbe();
    const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0);
    expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result, evidence).toMatchObject({
      briefVisible: true,
      taskVisible: true,
      examVisible: true,
      pendingItemsVisible: true,
      fullUuidInDom: false,
      windowsPathInDom: false,
      posixPathInDom: false,
      fileUriInDom: false,
      stackInDom: false,
      rawSensitiveTextInDom: false,
    });
  }, 90_000);
});
