/**
 * T-M4-019：真实 Electron renderer → preload → TCP/RPC → agent-host → backup handler → renderer E2E。
 * 覆盖：备份 Tab 入口（TabBar）→ 受控目录 seam → 备份此课程（真实 backup.course 打包 zip）→
 * 备份历史展示 → 受控 zip seam → 恢复（真实 backup.restore + 冲突 create_new）→ RestoreResult 摘要，
 * 并断言 DOM 无完整 UUID / 路径 / 错误栈（AGENTS.md §9.3 + 09-UI §11.1）。
 * 运行产物（含备份 zip）仅落入 H:\pi-studybuddy-tmp\runs\T-M4-019\。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-019\\e2e-renderer";
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

/** 阶段 1：进入备份 Tab → 选择目录（seam）→ 备份此课程 → 等待历史完成 */
const UI_PHASE1 = `(
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
    await clickButton("T-M4-019 Renderer E2E");
    await clickButton("T-M4-019 Renderer 数学");
    // TabBar 备份入口（决策 1A）
    const backupTab = await waitFor(() => Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("💾")), "backup tab missing");
    backupTab.click();
    await waitFor(() => document.body.textContent?.includes("备份恢复"), "backup panel missing");

    // 受控目录 seam（原生对话框不可自动化）
    window.__PI_BACKUP_DIR_FIXTURE__ = window.__PI_BACKUP_DIR__;
    await clickButton("选择备份目录");
    await waitFor(() => document.body.textContent?.includes("已选择备份目录"), "backup dir chosen missing");

    // 备份此课程（真实 RPC → 生产 backup.course 打包 zip）
    await clickButton("备份此课程");
    await waitFor(() => document.body.textContent?.includes("完成"), "backup completed missing");
    const visible = document.body.textContent || "";
    return {
      backupTabReachable: visible.includes("备份恢复"),
      dirChosen: visible.includes("已选择备份目录"),
      historyVisible: visible.includes("备份历史") && visible.includes(".zip"),
      completedVisible: visible.includes("完成"),
      fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(visible),
      windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(visible),
      posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(visible),
      fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(visible),
      stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(visible) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(visible),
    };
  }
)()`;

/** 阶段 2：受控 zip seam → 选择 zip → 冲突 create_new → 恢复 → RestoreResult 摘要 */
const UI_PHASE2 = `(
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
    // 受控 zip seam
    window.__PI_BACKUP_ZIP_FIXTURE__ = { path: window.__PI_BACKUP_ZIP__, name: "backup-restore.zip" };
    await clickButton("选择 zip 文件");
    await waitFor(() => document.body.textContent?.includes("backup-restore.zip"), "zip picked missing");

    // 冲突策略显式选择（决策 2A）：覆盖现有数据
    const overwriteRadio = await waitFor(() => document.querySelector('input[type="radio"][value="overwrite"]'), "conflict radio missing");
    overwriteRadio.click();
    await wait(100);

    // 开始恢复先进入覆盖确认，再执行真实 RPC → 生产 backup.restore → integrity_check
    await clickButton("开始恢复");
    await waitFor(() => document.body.textContent?.includes("覆盖会替换现有课程数据"), "overwrite confirmation missing");
    await clickButton("确认覆盖");
    await waitFor(() => document.body.textContent?.includes("恢复完成"), "restore completed missing");
    const visible = document.body.textContent || "";
    return {
      zipPicked: visible.includes("backup-restore.zip"),
      conflictChosen: visible.includes("覆盖现有数据"),
      restoreCompleted: visible.includes("恢复完成"),
      integrityOk: visible.includes("integrity_check") && visible.includes("ok"),
      conflictResolved: visible.includes("overwrite") || visible.includes("无冲突") || visible.includes("create_new"),
      fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(visible),
      windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(visible),
      posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(visible),
      fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(visible),
      stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(visible) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(visible),
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
  const s1Handlers = createS1Handlers(s1);
  const semester = s1Handlers["semesters.create"]({ label: "T-M4-019 Renderer E2E", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" });
  s1Handlers["courses.create"]({ semesterId: semester.id, courseName: "T-M4-019 Renderer 数学", subject: "数学" });
  s1.dispose();
  return semester.id;
}
const backupDir = path.join(dataRoot, "backup-target");
fs.mkdirSync(backupDir, { recursive: true });
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
async function waitForZip(dir, deadlineMs) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const entries = fs.readdirSync(dir).filter((name) => name.endsWith(".zip"));
    if (entries.length > 0) return path.join(dir, entries[0]);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return null;
}
app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error("BrowserWindow missing");
    // 阶段 1：备份
    await win.webContents.executeJavaScript("window.__PI_BACKUP_DIR__ = " + JSON.stringify(backupDir) + ";");
    const phase1 = await win.webContents.executeJavaScript(${JSON.stringify(UI_PHASE1)});
    // 轮询备份 zip（真实 backup.course 写入 backupDir）
    const zipPath = await waitForZip(backupDir, 20000);
    if (!zipPath) throw new Error("backup zip not produced");
    // 阶段 2：恢复
    await win.webContents.executeJavaScript("window.__PI_BACKUP_ZIP__ = " + JSON.stringify(zipPath) + ";");
    const phase2 = await win.webContents.executeJavaScript(${JSON.stringify(UI_PHASE2)});
    emit({ phase: "ready", phase1, phase2, zipProduced: true, electron: process.versions.electron, node: process.versions.node });
  } catch (error) { fail(error); }
});
setTimeout(() => fail(new Error("renderer E2E timeout")), 40000);
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
      timeout: 60_000,
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

describe("T-M4-019 真实 Electron renderer BackupPanel", () => {
  it("备份 Tab → 备份此课程（真实 zip 产出）→ 恢复（integrity_check）且 DOM 无敏感内部值", async () => {
    const probe = await runProbe();
    const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0);
    expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.zipProduced, evidence).toBe(true);
    expect(probe.result?.phase1, evidence).toMatchObject({
      backupTabReachable: true,
      dirChosen: true,
      historyVisible: true,
      completedVisible: true,
      fullUuidInDom: false,
      windowsPathInDom: false,
      posixPathInDom: false,
      fileUriInDom: false,
      stackInDom: false,
    });
    expect(probe.result?.phase2, evidence).toMatchObject({
      zipPicked: true,
      conflictChosen: true,
      restoreCompleted: true,
      integrityOk: true,
      conflictResolved: true,
      fullUuidInDom: false,
      windowsPathInDom: false,
      posixPathInDom: false,
      fileUriInDom: false,
      stackInDom: false,
    });
  }, 120_000);
});
