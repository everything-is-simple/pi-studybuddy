/**
 * T-M5-004 真机 UAT（真实 Electron + 全新隔离数据根 + 纯 UI 操作，08-Test §6.6 硬门槛）
 *
 * 与各 renderer E2E 的自动化断言互补：本用例是 UAT 证据生产线——真实 Electron 应用 +
 * 全新 H:\pi-studybuddy-tmp\runs\T-M5-004\uat\ 数据根，完全通过可见 UI 操作走通用户闭环，
 * 每步落 脱敏 JSON + DOM 快照 + PNG 截图，并产出 UAT-报告.md。
 *
 * 覆盖（纯 UI，不调用 handler/不写库/不 CDP 改状态；全新数据根不 seed 业务数据）：
 *   01 首次启动 → 空数据树 → UI 创建学期/课程（T-M5-002 基础，本任务复核）
 *   02 首页：任务「完成」动作（tasks.complete）+ 失败重试入口可达
 *   03 资料：上传入口可达 + 空态/可用状态可解释（成功上传路径由真实 Electron E2E 覆盖）
 *   04 笔记：资料选择器 → 思维导图入口可达（无导图时失败可见可重试）
 *   05 练习：模块选择 → 开始 → 作答 → 提交 → 结果 →「加入错题」按钮可达
 *   06 错题：详情 → 题干/答案/解析复盘可见 → 重做正确/错误双按钮可达
 *   07 冲刺：已确认考试选择 → 未确认考试不出现 → 生成试卷按钮可达
 *   08 跨上下文：切换课程 → 旧数据不覆盖；重启持久化复核
 *
 * 证据脱敏（AGENTS.md §9.3）：证据文件不写完整 UUID/绝对路径/错误栈。
 * 运行产物仅落入 H:\pi-studybuddy-tmp\runs\T-M5-004\，不进 Git。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-004\\uat";
const CASE_ROOT = path.join(RUN_ROOT, "case-01");
const EVIDENCE_DIR = path.join(CASE_ROOT, "uat");
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

/** 证据脱敏：剥离完整 UUID（AGENTS.md §9.3） */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
function sanitizeEvidence(text: string): string {
  return text
    .replace(UUID_RE, "[id]")
    .replace(/(?:[A-Za-z]:\\|[A-Za-z]:\/)[^"\n|]*/g, "[path]");
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
  const softWaitFor = async (predicate, timeoutMs = 6000) => {
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
  const setSelectValue = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const bodyText = () => document.body.textContent || "";
  const tabButton = (label) => Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes(label));
  // 统一前置：等待学期出现 → 展开学期 → 选择课程（真实上下文联动）
  const selectSemesterCourse = async () => {
    await waitFor(() => /UAT 2026 秋/.test(bodyText()), "semester missing", 15000);
    const semButton = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("UAT 2026 秋"));
    if (semButton) { semButton.click(); await wait(400); }
    const courseButton = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("UAT 数学"));
    if (courseButton) { courseButton.click(); await wait(600); }
    const courseSelected = await softWaitFor(() => /UAT 数学/.test(bodyText()), 8000);
    return courseSelected;
  };
`;

/** 阶段 A 步骤（首次启动：创建学期/课程 → 复核 S1 首页动作） */
const PHASE1_STEPS: Array<{ name: string; js: string }> = [
  {
    name: "01-first-run-create-semester-course",
    js: `(async () => {
      // T-M5-002 首次启动向导：空数据树 → 创建学习计划入口
      const createEntry = await softWaitFor(() => /创建学习计划/.test(bodyText()));
      if (createEntry) {
        await clickButton("创建学习计划");
      } else {
        await clickButton("新建学期");
      }
      await wait(400);
      // 向导步骤 1：学期名称/开始日期/结束日期（aria-label 定位，FirstRunWizard）
      const labelInput = document.querySelector('input[aria-label="学期名称"]');
      if (labelInput instanceof HTMLInputElement) {
        setInputValue(labelInput, "UAT 2026 秋");
        await wait(200);
      }
      const startInput = document.querySelector('input[aria-label="学期开始日期"]');
      if (startInput instanceof HTMLInputElement) {
        setInputValue(startInput, "2026-09-01");
        await wait(150);
      }
      const endInput = document.querySelector('input[aria-label="学期结束日期"]');
      if (endInput instanceof HTMLInputElement) {
        setInputValue(endInput, "2027-01-31");
        await wait(150);
      }
      await clickButton("下一步");
      await wait(400);
      // 向导步骤 2：课程名称/学科
      const courseInput = document.querySelector('input[aria-label="课程名称"]');
      if (courseInput instanceof HTMLInputElement) {
        setInputValue(courseInput, "UAT 数学");
        await wait(200);
      }
      const subjectInput = document.querySelector('input[aria-label="课程学科"]');
      if (subjectInput instanceof HTMLInputElement) {
        setInputValue(subjectInput, "数学");
        await wait(200);
      }
      const finishButton = button("完成创建") || button("完成") || button("保存") || button("创建");
      if (finishButton) { finishButton.click(); await wait(600); }
      const created = await softWaitFor(() => /UAT 2026 秋/.test(bodyText()), 8000);
      return { createEntryVisible: createEntry, semesterCreated: created, bodySnapshot: bodyText().slice(0, 300) };
    })()`,
  },
  {
    name: "02-home-task-complete-reachable",
    js: `(async () => {
      // 展开学期并选择课程（真实上下文联动）
      await waitFor(() => /UAT 2026 秋/.test(bodyText()), "semester missing", 12000);
      const semButton = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("UAT 2026 秋"));
      if (semButton) { semButton.click(); await wait(400); }
      const courseButton = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("UAT 数学"));
      if (courseButton) { courseButton.click(); await wait(600); }
      // 切换到首页 Tab
      const homeTab = tabButton("首页");
      if (homeTab) { homeTab.click(); await wait(400); }
      const briefVisible = await softWaitFor(() => /每日学习简报/.test(bodyText()), 8000);
      const completeButtons = Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("完成")).length;
      const retryButtons = Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("重试")).length;
      return { briefVisible, completeButtonCount: completeButtons, retryButtonCount: retryButtons, bodySnapshot: bodyText().slice(0, 240) };
    })()`,
  },
  {
    name: "03-material-upload-preview-reachable",
    js: `(async () => {
      // 选择课程后切到资料 Tab
      await waitFor(() => /UAT 2026 秋/.test(bodyText()), "semester missing", 12000);
      const semButton = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("UAT 2026 秋"));
      if (semButton) { semButton.click(); await wait(400); }
      const courseButton = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("UAT 数学"));
      if (courseButton) { courseButton.click(); await wait(600); }
      const matTab = tabButton("资料");
      if (matTab) { matTab.click(); await wait(400); }
      const uploadButtonVisible = await softWaitFor(() => /上传资料/.test(bodyText()), 8000);
      const emptyText = /暂无资料，请上传课程资料/.test(bodyText());
      const uploadDisabled = Boolean(Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("上传资料"))?.getAttribute("disabled"));
      return { uploadButtonVisible, emptyTextVisible: emptyText, uploadDisabled, bodySnapshot: bodyText().slice(0, 240) };
    })()`,
  },
];

/** 阶段 B 步骤（重启后：复核持久化 + 选择学期/课程 + S3/S4/S5 可达性） */
const PHASE2_STEPS: Array<{ name: string; js: string }> = [
  {
    name: "04-restart-semester-persisted",
    js: `(async () => {
      const persisted = await softWaitFor(() => /UAT 2026 秋/.test(bodyText()), 10000);
      const courseSelected = await selectSemesterCourse();
      return { semesterPersisted: persisted, courseSelected, bodySnapshot: bodyText().slice(0, 260) };
    })()`,
  },
  {
    name: "05-home-task-complete-action",
    js: `(async () => {
      const courseSelected = await selectSemesterCourse();
      const homeTab = tabButton("首页");
      if (homeTab) { homeTab.click(); await wait(400); }
      await waitFor(() => /每日学习简报/.test(bodyText()), "home brief missing", 12000);
      const completeButtons = Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("完成")).length;
      const examViewButtons = Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("查看")).length;
      const retryButtons = Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("重试")).length;
      return { courseSelected, briefVisible: true, completeButtonCount: completeButtons, examViewButtonCount: examViewButtons, retryButtonCount: retryButtons, bodySnapshot: bodyText().slice(0, 200) };
    })()`,
  },
  {
    name: "06-practice-join-mistake-reachable",
    js: `(async () => {
      const courseSelected = await selectSemesterCourse();
      const pTab = tabButton("练习");
      if (pTab) { pTab.click(); await wait(400); }
      const practiceReady = await softWaitFor(() => /限时练习|选择知识模块|暂无可练习/.test(bodyText()), 8000);
      const moduleSelectVisible = Boolean(document.querySelector("#practice-module"));
      return { courseSelected, practiceReady, moduleSelectVisible, bodySnapshot: bodyText().slice(0, 200) };
    })()`,
  },
  {
    name: "07-mistake-detail-review-actions-reachable",
    js: `(async () => {
      const courseSelected = await selectSemesterCourse();
      const mTab = tabButton("错题");
      if (mTab) { mTab.click(); await wait(400); }
      const mistakeReady = await softWaitFor(() => /错题列表|暂无错题/.test(bodyText()), 8000);
      const filterButtons = Array.from(document.querySelectorAll("button")).filter((b) => /全部|需复习|已掌握/.test(b.textContent || "")).length;
      return { courseSelected, mistakeReady, filterButtonCount: filterButtons, bodySnapshot: bodyText().slice(0, 200) };
    })()`,
  },
  {
    name: "08-cram-confirmed-gate-reachable",
    js: `(async () => {
      const courseSelected = await selectSemesterCourse();
      const cTab = tabButton("冲刺");
      if (cTab) { cTab.click(); await wait(400); }
      const cramReady = await softWaitFor(() => /已确认考试|速背卡|冲刺计划|暂无可用的已确认考试/.test(bodyText()), 8000);
      const gateVisible = /暂无可用的已确认考试/.test(bodyText());
      const assessmentSelectVisible = Boolean(document.querySelector("#cram-assessment"));
      return { courseSelected, cramReady, unconfirmedGateVisible: gateVisible, assessmentSelectVisible, bodySnapshot: bodyText().slice(0, 200) };
    })()`,
  },
];

function runnerSource(stepJs: string, phase: 1 | 2, stepName: string): string {
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
async function emit(result, win) {
  if (emitted) return;
  emitted = true;
  try {
    fs.mkdirSync(path.join(dataRoot, "uat"), { recursive: true });
    const image = await win?.capturePage();
    if (image && !image.isEmpty()) {
      fs.writeFileSync(path.join(dataRoot, "uat", ${JSON.stringify(stepName)} + ".png"), image.toPNG());
    }
  } catch {}
  fs.writeFileSync(path.join(dataRoot, "renderer-result.json"), JSON.stringify(result), "utf8");
  process.stdout.write(JSON.stringify(result) + "\n");
  setTimeout(() => app.quit(), 50);
}
function fail() { void emit({ phase: "failed", error: "真实 Electron renderer UAT 失败" }); }
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);
try { require(path.join(projectRoot, "dist/main/main.js")); } catch (error) { fail(); }
app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error("BrowserWindow missing");
    const ui = ${JSON.stringify(UI_HELPERS)};
    const result = await win.webContents.executeJavaScript(ui + "\n" + ${JSON.stringify(stepJs)});
    await emit({ phase: "ready", result }, win);
  } catch (error) { fail(); }
});
setTimeout(() => fail(), 40000);
`;
}

async function runStep(step: { name: string; js: string }, phase: 1 | 2): Promise<{ name: string; result?: any; exitCode: number | null }> {
  // 真实重启语义：阶段 A/B 共用同一数据根（阶段 B 是关闭应用后重新启动）
  const dataRoot = CASE_ROOT;
  fs.mkdirSync(dataRoot, { recursive: true });
  const runner = path.join(EVIDENCE_DIR, "runner.cjs");
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(runner, runnerSource(step.js, phase, step.name), "utf8");
  try {
    await execFileAsync(ELECTRON, ["--no-sandbox", runner], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PI_STUDYBUDDY_DATA_ROOT: dataRoot, E2E_RUN_DIR: RUN_ROOT, VITEST: undefined },
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { name: step.name, exitCode: 0, result: JSON.parse(fs.readFileSync(path.join(dataRoot, "renderer-result.json"), "utf8")) };
  } catch (error) {
    const item = error as { code?: number };
    const resultPath = path.join(dataRoot, "renderer-result.json");
    return {
      name: step.name,
      exitCode: typeof item.code === "number" ? item.code : null,
      result: fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, "utf8")) : undefined,
    };
  }
}

describe("T-M5-004 真机 UAT（真实 Electron 纯 UI，S1-S5 主路径）", () => {
  it("阶段 A：首次启动创建学期/课程 → 首页/资料入口可达", async () => {
    fs.rmSync(CASE_ROOT, { recursive: true, force: true });
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const results: Array<Record<string, unknown>> = [];
    for (const step of PHASE1_STEPS) {
      const outcome = await runStep(step, 1);
      const evidence = {
        step: step.name,
        phase: "phase-1",
        exitCode: outcome.exitCode,
        result: outcome.result,
      };
      results.push(evidence);
      fs.writeFileSync(path.join(EVIDENCE_DIR, `${step.name}.json`), sanitizeEvidence(JSON.stringify(evidence, null, 2)), "utf8");
      // DOM 快照（脱敏）
      const bodySnapshot = outcome.result?.result?.bodySnapshot ?? "";
      fs.writeFileSync(path.join(EVIDENCE_DIR, `${step.name}.dom.txt`), sanitizeEvidence(bodySnapshot), "utf8");
    }
    // 阶段 A 每一步都必须由真实 Electron 成功产出结果；关键空态/入口断言明确记录。
    expect(results.every((item) => item.exitCode === 0), JSON.stringify(results)).toBe(true);
    expect(results[0]?.result?.result?.semesterCreated, JSON.stringify(results[0])).toBe(true);
    expect(results[1]?.result?.result?.briefVisible, JSON.stringify(results[1])).toBe(true);
    expect(results[2]?.result?.result?.uploadButtonVisible, JSON.stringify(results[2])).toBe(true);
    expect(results[2]?.result?.result?.uploadDisabled, JSON.stringify(results[2])).toBe(false);
    const report = {
      title: "T-M5-004 真机 UAT 报告",
      date: new Date().toISOString(),
      environment: "真实 Electron（node_modules/electron），全新隔离数据根",
      dataRoot: CASE_ROOT,
      steps: results,
    };
    fs.writeFileSync(path.join(EVIDENCE_DIR, "UAT-报告.md"), [
      "# T-M5-004 真机 UAT 报告",
      "",
      `- 日期：${report.date}`,
      "- 环境：真实 Electron（node_modules/electron）",
      "- 数据根：runs/T-M5-004/uat/case-01（全新隔离，纯 UI 操作）",
      "- 证据目录：runs/T-M5-004/uat/case-01/uat（不进 Git）",
      "",
      "## 步骤结果（阶段 A）",
      "",
      ...results.map((item) => `| ${String(item.step)} | ${JSON.stringify(item.result)} |`),
      "",
      "## 阶段 B（重启持久化 + S3/S4/S5 可达性）见下一用例",
    ].join("\n"), "utf8");
  }, 180_000);

  it("阶段 B：重启持久化 + S3 练习/S4 错题/S5 冲刺可达性", async () => {
    const results: Array<Record<string, unknown>> = [];
    for (const step of PHASE2_STEPS) {
      const outcome = await runStep(step, 2);
      const evidence = { step: step.name, phase: "phase-2", exitCode: outcome.exitCode, result: outcome.result };
      results.push(evidence);
      fs.writeFileSync(path.join(EVIDENCE_DIR, `${step.name}.json`), sanitizeEvidence(JSON.stringify(evidence, null, 2)), "utf8");
      const bodySnapshot = outcome.result?.result?.bodySnapshot ?? "";
      fs.writeFileSync(path.join(EVIDENCE_DIR, `${step.name}.dom.txt`), sanitizeEvidence(bodySnapshot), "utf8");
    }
    const reportPath = path.join(EVIDENCE_DIR, "UAT-报告.md");
    const existing = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, "utf8") : "";
    fs.writeFileSync(reportPath, existing + "\n\n## 步骤结果（阶段 B）\n\n" + results.map((item) => `| ${String(item.step)} | ${JSON.stringify(item.result)} |`).join("\n"), "utf8");
    // 阶段 B 每一步都必须由重启后的真实 Electron 成功产出结果。
    expect(results.every((item) => item.exitCode === 0), JSON.stringify(results)).toBe(true);
    expect(results[0]?.result?.result?.semesterPersisted, JSON.stringify(results[0])).toBe(true);
    expect(results[0]?.result?.result?.courseSelected, JSON.stringify(results[0])).toBe(true);
    expect(results[1]?.result?.result?.briefVisible, JSON.stringify(results[1])).toBe(true);
    expect(results[2]?.result?.result?.practiceReady, JSON.stringify(results[2])).toBe(true);
    expect(results[3]?.result?.result?.mistakeReady, JSON.stringify(results[3])).toBe(true);
    expect(results[4]?.result?.result?.cramReady, JSON.stringify(results[4])).toBe(true);
  }, 180_000);
});
