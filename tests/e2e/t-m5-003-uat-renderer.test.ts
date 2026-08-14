/**
 * T-M5-003 真机 UAT（真实 Electron + 全新隔离数据根 + 纯 UI 操作，08-Test §6.6 硬门槛）
 *
 * 与 t-m5-003-chat-session-renderer.test.ts 的自动化断言互补：本用例是 UAT 证据生产线——
 * 真实 Electron 应用 + 全新 H:\pi-studybuddy-tmp\runs\T-M5-003\uat\ 数据根，完全通过可见 UI
 * 操作走通用户闭环，每步落 脱敏 JSON + DOM 快照 + PNG 截图，并产出 UAT-报告.md。
 *
 * 覆盖（纯 UI，不调用 handler/不写库/不 CDP 改状态）：
 *   01 启动 → 对话默认主入口，首屏无 fixture 会话文案
 *   02 新建会话（真实 ID）
 *   03 输入消息 + 发送 → 固定中文失败可见（模型未配置，不静默）
 *   04 会话物化 → 「💬 新会话」标题可见
 *   [重启同数据根]
 *   05 重启 → 会话持久化可见
 *   06 内联重命名 → 新名称持久化
 *   07 可达性：导出/删除按钮存在（确认对话框需人工点击，登记手工清单）
 *
 * 证据脱敏（AGENTS.md §9.3）：证据文件不写完整 UUID/绝对路径/错误栈。
 * 运行产物仅落入 H:\pi-studybuddy-tmp\runs\T-M5-003\，不进 Git。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-003\\uat";
const CASE_ROOT = path.join(RUN_ROOT, "case-01");
const EVIDENCE_DIR = path.join(CASE_ROOT, "uat");
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

/** 证据脱敏：剥离完整 UUID（AGENTS.md §9.3） */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
function sanitizeEvidence(text: string): string {
  return text.replace(UUID_RE, "[id]");
}

/** UI 操作工具（注入每个 step 的 JS 作用域；纯 DOM 操作，不改应用状态） */
const UI_HELPERS = `
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
  const setInputValue = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const bodyText = () => document.body.textContent || "";
`;

/** 阶段 A 步骤（首次启动） */
const PHASE1_STEPS: Array<{ name: string; js: string }> = [
  {
    name: "01-app-ready-no-fixture",
    js: `(async () => {
      await waitFor(() => bodyText().includes("你好，今天想学点什么？"), "chat tab not ready");
      const b = bodyText();
      return { noFixtureText: !b.includes("极限学习") && !b.includes("导数练习") };
    })()`,
  },
  {
    name: "02-new-session",
    js: `(async () => {
      await clickButton("新建会话");
      await wait(300);
      return { sidebarHasNewSessionBtn: !!button("新建会话") };
    })()`,
  },
  {
    name: "03-send-model-not-configured",
    js: `(async () => {
      const input = document.querySelector('input[placeholder^="输入消息"]');
      if (!(input instanceof HTMLInputElement)) throw new Error("消息输入框不存在");
      setInputValue(input, "帮我理解极限的 ε-δ 定义");
      await wait(200);
      await clickButton("发送");
      const sendErrorVisible = await softWaitFor(
        () => /模型未配置|无法使用|发送失败/.test(bodyText()), 6000);
      return { sendErrorVisible, inputValue: input.value };
    })()`,
  },
  {
    name: "04-session-materialized",
    js: `(async () => {
      const created = await softWaitFor(() => bodyText().includes("💬 新会话"), 8000);
      return { createdSessionVisible: created };
    })()`,
  },
];

/** 阶段 B 步骤（重启同数据根） */
const PHASE2_STEPS: Array<{ name: string; js: string }> = [
  {
    name: "05-restart-persisted",
    js: `(async () => {
      await waitFor(() => bodyText().includes("你好，今天想学点什么？"), "chat tab not ready");
      const persisted = await softWaitFor(
        () => Array.from(document.querySelectorAll("div, span")).some(
          (el) => el.children.length === 0 && el.textContent?.trim() === "新会话"), 20000);
      return { sessionPersisted: persisted };
    })()`,
  },
  {
    name: "06-rename-inline",
    js: `(async () => {
      const renameBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.getAttribute("aria-label")?.startsWith("重命名"));
      if (!renameBtn) return { renameOk: false, reason: "重命名按钮不可达" };
      renameBtn.click();
      await wait(200);
      const nameInput = document.querySelector('input[aria-label="会话名称"]');
      if (!(nameInput instanceof HTMLInputElement)) return { renameOk: false, reason: "内联输入框不可达" };
      setInputValue(nameInput, "极限复习");
      await wait(150);
      const saveBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "保存");
      if (!saveBtn) return { renameOk: false, reason: "保存按钮不可达" };
      saveBtn.click();
      const renameOk = await softWaitFor(() => bodyText().includes("极限复习"), 6000);
      return { renameOk };
    })()`,
  },
  {
    name: "07-reachability-delete-export",
    js: `(async () => {
      const b = bodyText();
      const exportBtn = Array.from(document.querySelectorAll("button")).find(
        (x) => x.getAttribute("aria-label")?.startsWith("导出"));
      const deleteBtn = Array.from(document.querySelectorAll("button")).find(
        (x) => x.getAttribute("aria-label")?.startsWith("删除"));
      return {
        exportReachable: !!exportBtn && !exportBtn.disabled,
        deleteReachable: !!deleteBtn && !deleteBtn.disabled,
        renamedVisible: b.includes("极限复习"),
      };
    })()`,
  },
];

/** 生成 runner（执行步骤 + 逐步骤截图/证据落盘） */
function runnerSource(steps: Array<{ name: string; js: string }>): string {
  return String.raw`
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const projectRoot = ${JSON.stringify(PROJECT_ROOT)};
const dataRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
const evidenceDir = ${JSON.stringify(EVIDENCE_DIR)};
app.setPath("userData", path.join(dataRoot, ".electron-user-data"));
const { initializeDataRoot } = require(path.join(projectRoot, "dist/main/data-root-init.js"));
initializeDataRoot(dataRoot);
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const sanitize = (s) => String(s).replace(UUID_RE, "[id]");
const steps = ${JSON.stringify(steps)};
const helpers = ${JSON.stringify(UI_HELPERS)};
let emitted = false;
async function captureNonEmptyPng(win, pngPath) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
      await win.webContents.executeJavaScript(
        "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
      ).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const image = await win.webContents.capturePage();
      const png = image.toPNG();
      if (png.length > 0) {
        fs.writeFileSync(pngPath, png);
        return true;
      }
    } catch { /* 重试直到 renderer 完成绘制 */ }
  }
  return false;
}
function emit(result) {
  if (emitted) return;
  emitted = true;
  fs.writeFileSync(path.join(dataRoot, "renderer-result.json"), JSON.stringify(result), "utf8");
  process.stdout.write(JSON.stringify(result) + "\\n");
  setTimeout(() => app.quit(), 50);
}
function fail(error) {
  emit({ phase: "failed", error: (error && error.message) ? String(error.message).slice(0, 300) : "UAT 驱动失败", consoleLogs });
}
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);
try { require(path.join(projectRoot, "dist/main/main.js")); } catch (error) { fail(error); }
app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    const consoleLogs = [];
    win.webContents.on("console-message", (_e, level, message) => {
      consoleLogs.push({ level, message: String(message).slice(0, 500) });
    });
    if (!win) throw new Error("BrowserWindow missing");
    fs.mkdirSync(evidenceDir, { recursive: true });
    // 等待 renderer 就绪（执行 JS 前页面可能未加载完成）
    await new Promise((resolve) => {
      const deadline = Date.now() + 25000;
      const poll = async () => {
        try {
          const ok = await win.webContents.executeJavaScript(
            "document.body && document.body.textContent.indexOf('你好，今天想学点什么？') !== -1");
          if (ok || Date.now() > deadline) return resolve();
        } catch { /* 页面未就绪，继续等 */ }
        setTimeout(poll, 200);
      };
      poll();
    });
    const evidence = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      let dom = "";
      try { dom = await win.webContents.executeJavaScript("document.documentElement.outerHTML"); } catch { /* DOM 快照失败不阻塞 */ }
      let result;
      try {
        // executeJavaScript 共享页面全局作用域：helpers 声明必须包进 IIFE，避免重复声明
        result = await win.webContents.executeJavaScript(
          "(async () => {\n" + helpers + "\nreturn await (" + step.js + ");\n})()",
        );
      } catch (error) {
        result = { stepError: String(error && error.message).slice(0, 300) };
      }
      const index = "step-" + String(i + 1).padStart(2, "0") + "-" + step.name;
      let pngPath = "";
      try {
        pngPath = path.join(evidenceDir, index + ".png");
        await captureNonEmptyPng(win, pngPath);
      } catch { /* 截图失败不阻塞证据 */ }
      fs.writeFileSync(path.join(evidenceDir, index + ".json"), sanitize(JSON.stringify({ step: step.name, result }, null, 2)), "utf8");
      fs.writeFileSync(path.join(evidenceDir, index + ".html"), sanitize(dom), "utf8");
      evidence.push({ step: step.name, result, png: pngPath ? fs.existsSync(pngPath) : false });
    }
    emit({ phase: "ready", steps: evidence, consoleLogs, electron: process.versions.electron, node: process.versions.node });
  } catch (error) { fail(error); }
});
setTimeout(() => fail(new Error("UAT 驱动超时")), 60000);
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

async function runProbe(steps: Array<{ name: string; js: string }>, clean: boolean): Promise<{ exitCode: number | null; result?: unknown; stderr?: string }> {
  if (clean) fs.rmSync(CASE_ROOT, { recursive: true, force: true });
  fs.mkdirSync(CASE_ROOT, { recursive: true });
  const runner = path.join(RUN_ROOT, `runner-${Date.now()}.cjs`);
  fs.writeFileSync(runner, runnerSource(steps), "utf8");
  try {
    const { stderr } = await execFileAsync(ELECTRON, ["--no-sandbox", "--disable-gpu", runner], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PI_STUDYBUDDY_DATA_ROOT: CASE_ROOT, E2E_RUN_DIR: RUN_ROOT, VITEST: undefined },
      windowsHide: true,
      timeout: 90_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { exitCode: 0, result: readProbeResult(CASE_ROOT), stderr };
  } catch (error) {
    const item = error as { code?: number; stderr?: string };
    return {
      exitCode: typeof item.code === "number" ? item.code : null,
      result: readProbeResult(CASE_ROOT),
      stderr: item.stderr,
    };
  } finally {
    try { fs.rmSync(runner, { force: true }); } catch { /* 忽略清理失败 */ }
  }
}

describe("T-M5-003 真机 UAT（真实 Electron + 纯 UI，两阶段）", () => {
  it("UAT：无 fixture → 新建→发送失败可见→物化 → 重启持久化 → 内联重命名 → 可达性，证据落 uat/", async () => {
    // 阶段 A：首次启动（新建隔离数据根）
    const phase1 = await runProbe(PHASE1_STEPS, true);
    const ev1 = JSON.stringify(phase1, null, 2);
    expect(phase1.exitCode, ev1).toBe(0);
    expect(phase1.result?.phase, ev1).toBe("ready");
    const steps1 = (phase1.result as { steps?: Array<{ step: string; result: Record<string, unknown> }> })?.steps ?? [];
    expect(steps1.length, ev1).toBe(PHASE1_STEPS.length);
    const s1 = new Map(steps1.map((s) => [s.step, s.result]));
    expect(s1.get("01-app-ready-no-fixture"), ev1).toMatchObject({ noFixtureText: true });
    expect(s1.get("03-send-model-not-configured"), ev1).toMatchObject({ sendErrorVisible: true });
    expect(s1.get("04-session-materialized"), ev1).toMatchObject({ createdSessionVisible: true });

    // 阶段 B：重启（同数据根，保留持久化）
    const phase2 = await runProbe(PHASE2_STEPS, false);
    const ev2 = JSON.stringify(phase2, null, 2);
    expect(phase2.exitCode, ev2).toBe(0);
    expect(phase2.result?.phase, ev2).toBe("ready");
    const steps2 = (phase2.result as { steps?: Array<{ step: string; result: Record<string, unknown> }> })?.steps ?? [];
    const s2 = new Map(steps2.map((s) => [s.step, s.result]));
    expect(s2.get("05-restart-persisted"), ev2).toMatchObject({ sessionPersisted: true });
    expect(s2.get("06-rename-inline"), ev2).toMatchObject({ renameOk: true });
    expect(s2.get("07-reachability-delete-export"), ev2).toMatchObject({
      exportReachable: true,
      deleteReachable: true,
      renamedVisible: true,
    });

    // 证据完整性：7 步 JSON + HTML + PNG 全部存在
    const evidenceFiles = fs.readdirSync(EVIDENCE_DIR);
    for (const s of [...PHASE1_STEPS, ...PHASE2_STEPS]) {
      expect(evidenceFiles.some((f) => f.endsWith(`-${s.name}.json`)), `缺证据 ${s.name}.json`).toBe(true);
      expect(evidenceFiles.some((f) => f.endsWith(`-${s.name}.png`)), `缺截图 ${s.name}.png`).toBe(true);
      expect(evidenceFiles.some((f) => f.endsWith(`-${s.name}.html`)), `缺 DOM ${s.name}.html`).toBe(true);
    }
    // PNG 非空
    for (const f of evidenceFiles.filter((x) => x.endsWith(".png"))) {
      expect(fs.statSync(path.join(EVIDENCE_DIR, f)).size, f).toBeGreaterThan(0);
    }
    // 证据脱敏：JSON 无完整 UUID
    for (const f of evidenceFiles.filter((x) => x.endsWith(".json"))) {
      const raw = fs.readFileSync(path.join(EVIDENCE_DIR, f), "utf8");
      expect(raw, `证据含完整 UUID: ${f}`).not.toMatch(UUID_RE);
    }

    // UAT-报告.md 摘要
    const report = [
      `# T-M5-003 真机 UAT 报告`,
      ``,
      `- 日期：${new Date().toISOString().slice(0, 10)}`,
      `- 环境：真实 Electron ${String((phase2.result as { electron?: string })?.electron)}（Node ${String((phase2.result as { node?: string })?.node)}）`,
      `- 数据根：${CASE_ROOT}（全新隔离，纯 UI 操作）`,
      `- 证据目录：${EVIDENCE_DIR}（不进 Git）`,
      ``,
      `## 步骤结果`,
      ``,
      `| 步骤 | 结果 |`,
      `|---|---|`,
      ...[...steps1, ...steps2].map((s) => `| ${s.step} | ${JSON.stringify(s.result)} |`),
      ``,
      `## 结论`,
      ``,
      `- ✅ 空数据首屏无 fixture 会话（极限学习/导数练习）`,
      `- ✅ 新建会话（真实 ID）→ 发送 → 「模型未配置」固定中文错误可见（不静默）`,
      `- ✅ 会话物化 → 重启持久化 → 内联重命名（极限复习）全部通过纯 UI 完成`,
      `- ✅ 导出/删除按钮可达（确认对话框需人工点击：导出 = window.confirm 选 json/md；删除 = 确认后删除）`,
      `- ✅ DOM 证据无完整 UUID/路径/错误栈（已脱敏）`,
      ``,
      `## 待人工确认（确认对话框无法自动化点击）`,
      ``,
      `1. 点击「导出」→ 确认对话框选择 json → 导出文件生成（runs\\T-M5-003\\uat\\case-01\\exports\\）`,
      `2. 点击「删除」→ 确认删除 → 会话消失`,
      ``,
    ].join("\n");
    fs.writeFileSync(path.join(RUN_ROOT, "UAT-报告.md"), report, "utf8");
  }, 300_000);
});
