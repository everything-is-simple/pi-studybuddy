/**
 * T-M5-003 RED：真实 Electron 对话/会话闭环（DOM 级）
 *
 * 权威依据：09-UI §3.3/§4.2/§7（默认主入口 + 真实会话 + 失败可见）、
 * 08-Test §6.6（真机 UAT 铁律：真实 Electron + 隔离空数据根 + 纯 UI）、
 * AGENTS.md §9.3（DOM 无敏感信息）。
 *
 * 验收目标：
 *   C-RED-01 空数据首屏无 fixture 会话文案（极限学习/导数练习）。
 *   C-RED-09a 新建会话 → 输入 → 发送 → 固定中文失败错误可见（模型未配置，不静默）。
 *   C-RED-09b 会话物化进列表（ChatTab 标题「💬 新会话」）。
 *   C-RED-09c 重启（同数据根二次启动）后新会话持久化可见。
 *
 * 运行产物仅落入 H:\pi-studybuddy-tmp\runs\T-M5-003\。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-003\\e2e-chat-session";
const CASE_ROOT = path.join(RUN_ROOT, "case-01");
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

const PHASE1_UI = `(
  async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = async (predicate, message, timeoutMs = 20000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const value = predicate();
        if (value) return value;
        await wait(100);
      }
      throw new Error(message);
    };
    const softWaitFor = async (predicate, timeoutMs) => {
      try { await waitFor(predicate, "timeout", timeoutMs); return true; }
      catch { return false; }
    };
    const button = (text) => Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes(text));
    const clickButton = async (text) => {
      const item = await waitFor(() => button(text), "button missing: " + text);
      item.click();
      await wait(250);
    };

    await waitFor(() => document.body.textContent?.includes("你好，今天想学点什么？"), "chat tab not ready");

    const body1 = document.body.textContent || "";
    const noFixtureText = !body1.includes("极限学习") && !body1.includes("导数练习");

    await clickButton("新建会话");

    const input = document.querySelector('input[placeholder^="输入消息"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("消息输入框不存在");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "帮我理解极限的 ε-δ 定义");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(200);
    const inputValueAfterSet = input.value;
    await clickButton("发送");

    const sendErrorVisible = await softWaitFor(
      () => /模型未配置|无法使用|发送失败/.test(document.body.textContent || ""), 6000);
    const createdSessionVisible = await softWaitFor(
      () => (document.body.textContent || "").includes("💬 新会话"), 8000);

    const body = document.body.textContent || "";
    return {
      noFixtureText,
      inputValueAfterSet,
      sendErrorVisible,
      createdSessionVisible,
      bodyTail: body.slice(-400),
      fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(body),
      windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(body),
      stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(body),
    };
  }
)()`;

const PHASE2_UI = `(
  async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = async (predicate, message, timeoutMs = 20000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const value = predicate();
        if (value) return value;
        await wait(100);
      }
      throw new Error(message);
    };
    const softWaitFor = async (predicate, timeoutMs) => {
      try { await waitFor(predicate, "timeout", timeoutMs); return true; }
      catch { return false; }
    };
    await waitFor(() => document.body.textContent?.includes("你好，今天想学点什么？"), "chat tab not ready");
    // 轮询等待侧栏会话加载（RPC 连接/列表加载异步；持久化会话最多 20s 内出现）
    const sessionAppeared = await softWaitFor(
      () => Array.from(document.querySelectorAll("div, span")).some(
        (el) => el.children.length === 0 && el.textContent?.trim() === "新会话"), 20000);
    const leafSessions = Array.from(document.querySelectorAll("div, span"))
      .filter((el) => el.children.length === 0 && el.textContent?.trim() === "新会话");
    // 内联重命名（T-M5-003：Electron 不支持 window.prompt，改用内联输入框）
    let renameOk = false;
    const renameBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.getAttribute("aria-label")?.startsWith("重命名"));
    if (renameBtn) {
      renameBtn.click();
      await wait(200);
      const nameInput = document.querySelector('input[aria-label="会话名称"]');
      if (nameInput instanceof HTMLInputElement) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        setter?.call(nameInput, "极限复习");
        nameInput.dispatchEvent(new Event("input", { bubbles: true }));
        await wait(150);
        const saveBtn = Array.from(document.querySelectorAll("button")).find(
          (b) => b.textContent?.trim() === "保存");
        if (saveBtn) saveBtn.click();
      }
      renameOk = await softWaitFor(() => (document.body.textContent || "").includes("极限复习"), 6000);
    }
    const body = document.body.textContent || "";
    return {
      sessionPersisted: sessionAppeared,
      renameOk,
      leafCount: leafSessions.length,
      bodyTail: body.slice(-300),
      noFixtureText: !body.includes("极限学习") && !body.includes("导数练习"),
      fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(body),
      windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(body),
      stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(body),
    };
  }
)()`;

function runnerSource(uiJs: string): string {
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
    const result = await win.webContents.executeJavaScript(${JSON.stringify(uiJs)});
    emit({ phase: "ready", result, electron: process.versions.electron, node: process.versions.node });
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

async function runProbe(uiJs: string, clean = true): Promise<{ exitCode: number | null; result?: unknown }> {
  if (clean) {
    fs.rmSync(CASE_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(CASE_ROOT, { recursive: true });
  const runner = path.join(RUN_ROOT, `runner-${Date.now()}.cjs`);
  fs.writeFileSync(runner, runnerSource(uiJs), "utf8");
  try {
    await execFileAsync(ELECTRON, ["--no-sandbox", runner], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PI_STUDYBUDDY_DATA_ROOT: CASE_ROOT, E2E_RUN_DIR: RUN_ROOT, VITEST: undefined },
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { exitCode: 0, result: readProbeResult(CASE_ROOT) };
  } catch (error) {
    const item = error as { code?: number };
    return { exitCode: typeof item.code === "number" ? item.code : null, result: readProbeResult(CASE_ROOT) };
  } finally {
    try { fs.rmSync(runner, { force: true }); } catch { /* 忽略清理失败 */ }
  }
}

describe("T-M5-003 真实 Electron 对话/会话闭环", () => {
  it("C-RED-01/09 首屏无 fixture + 新建会话发送失败可见 + 重启持久化（两阶段）", async () => {
    // 阶段 A：首次启动
    const phase1 = await runProbe(PHASE1_UI);
    const evidence1 = JSON.stringify(phase1, null, 2);
    expect(phase1.exitCode, evidence1).toBe(0);
    expect(phase1.result?.phase, evidence1).toBe("ready");
    expect(phase1.result?.result, evidence1).toMatchObject({
      noFixtureText: true,         // C-RED-01
      inputValueAfterSet: "帮我理解极限的 ε-δ 定义",
      sendErrorVisible: true,      // C-RED-09a
      createdSessionVisible: true, // C-RED-09b
      fullUuidInDom: false,
      windowsPathInDom: false,
      stackInDom: false,
    });

    // 阶段 B：重启（同数据根，保留阶段 A 持久化数据）→ 会话持久化
    const phase2 = await runProbe(PHASE2_UI, false);
    const evidence2 = JSON.stringify(phase2, null, 2);
    expect(phase2.exitCode, evidence2).toBe(0);
    expect(phase2.result?.phase, evidence2).toBe("ready");
    expect(phase2.result?.result, evidence2).toMatchObject({
      sessionPersisted: true,      // C-RED-09c
      renameOk: true,             // 重命名（内联编辑）UI 可用
      noFixtureText: true,
      fullUuidInDom: false,
      windowsPathInDom: false,
      stackInDom: false,
    });
  }, 180_000);
});
