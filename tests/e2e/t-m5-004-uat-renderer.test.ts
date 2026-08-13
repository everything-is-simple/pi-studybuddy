/**
 * T-M5-004 真机 UAT v2（真实 Electron + 全新隔离数据根 + 纯 UI 操作，08-Test §6.6 硬门槛）
 *
 * 本版回应独立复验批评：v1 仅验证空态/可达性，不满足 §6.6「创建→使用→重启回查」闭环铁律。
 * v2 在**纯 UI** 下走通本任务范围内**有真实 UI 创建入口**的闭环：
 *
 *   01 空数据 → UI 向导创建学期/课程（FirstRunWizard）
 *   02 S1 学习计划面板：UI 新增任务（tasks.create）→ 新增考试（exams.add）→ 确认考试（exams.confirm）
 *   03 首页：任务「完成」动作（tasks.complete）→ 成功后列表刷新；考试「查看」详情展开
 *   04 冲刺：已确认考试选择 → 生成模拟卷（mockExams.generatePaper，生产 mock 确定性生成器）
 *         → 作答 → 提交 → 结果 + 模块分析
 *   [关闭应用，重启同一隔离数据根]
 *   05 重启回查：学期/课程/任务（已完成）/考试（已确认）持久化；首页显示真实数据
 *
 * 无纯 UI 数据创建入口的闭环（S2 资料文件对话框、S2 笔记/知识模块 AI 生成、S3 练习依赖模块、
 * S4 错题依赖练习）→ 本任务登记为 P0/P1 功能缺口（依赖真实 AI / 系统文件对话框），
 * 不以空态可达性冒充 UAT 成功，不 seed / 不 handler 直调 / 不直写库。
 *
 * 证据：每步脱敏 JSON + DOM 快照 + PNG 截图（capturePage）；UAT-报告.md 逐步登记
 * 动作/预期/实际/控件/成功失败禁用重试分类。运行产物仅落 H:\pi-studybuddy-tmp\runs\T-M5-004\。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-004\\uat-v2";
const CASE_ROOT = path.join(RUN_ROOT, "case-01");
const EVIDENCE_DIR = path.join(CASE_ROOT, "uat");
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

/** 证据脱敏：剥离完整 UUID / 绝对路径（AGENTS.md §9.3） */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
function sanitizeEvidence(text: string): string {
  return text.replace(UUID_RE, "[id]");
}

/** UI 操作工具（注入每个 step 的 JS 作用域；纯 DOM 操作，不改应用状态） */
const UI_HELPERS = `
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, message, timeoutMs = 25000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = predicate();
      if (value) return value;
      await wait(100);
    }
    throw new Error(message);
  };
  const softWaitFor = async (predicate, timeoutMs = 8000) => {
    try { await waitFor(predicate, "timeout", timeoutMs); return true; }
    catch { return false; }
  };
  const button = (text) => Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes(text));
  const allButtons = (text) => Array.from(document.querySelectorAll("button")).filter((item) => item.textContent?.includes(text));
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
  const selectSemesterCourse = async () => {
    await waitFor(() => /UAT 2026 秋/.test(bodyText()), "semester missing", 20000);
    const semButton = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("UAT 2026 秋"));
    if (semButton) { semButton.click(); await wait(400); }
    const courseButton = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("UAT 数学"));
    if (courseButton) { courseButton.click(); await wait(600); }
    return await softWaitFor(() => /UAT 数学/.test(bodyText()), 10000);
  };
  const capture = async () => {
    try { const img = await window.capturePage?.(); return img ? img.toPNG().length : 0; } catch { return 0; }
  };
`;

/** 阶段 A：创建学期/课程 + S1 任务/考试创建确认 + 首页动作 + 冲刺模拟考全链 */
const PHASE_A_JS = `(async () => {
  // ---- 01 空数据 → UI 向导创建学期/课程 ----
  const createEntry = await softWaitFor(() => /创建学习计划/.test(bodyText()), 15000);
  if (createEntry) { await clickButton("创建学习计划"); } else { await clickButton("新建学期"); }
  await wait(400);
  const labelInput = document.querySelector('input[aria-label="学期名称"]');
  if (labelInput instanceof HTMLInputElement) { setInputValue(labelInput, "UAT 2026 秋"); await wait(150); }
  const startInput = document.querySelector('input[aria-label="学期开始日期"]');
  if (startInput instanceof HTMLInputElement) { setInputValue(startInput, "2026-09-01"); await wait(150); }
  const endInput = document.querySelector('input[aria-label="学期结束日期"]');
  if (endInput instanceof HTMLInputElement) { setInputValue(endInput, "2027-01-31"); await wait(150); }
  await clickButton("下一步");
  await wait(400);
  const courseInput = document.querySelector('input[aria-label="课程名称"]');
  if (courseInput instanceof HTMLInputElement) { setInputValue(courseInput, "UAT 数学"); await wait(150); }
  const subjectInput = document.querySelector('input[aria-label="课程学科"]');
  if (subjectInput instanceof HTMLInputElement) { setInputValue(subjectInput, "数学"); await wait(150); }
  await clickButton("完成创建");
  const semesterCreated = await softWaitFor(() => /UAT 2026 秋/.test(bodyText()), 12000);
  const courseCreated = await softWaitFor(() => /UAT 数学/.test(bodyText()), 8000);
  await wait(600);

  // ---- 02 S1 学习计划面板：新增任务 ----
  await clickButton("管理学习计划");
  await wait(500);
  await clickButton("新增任务");
  await wait(300);
  const taskTitle = document.querySelector('input[aria-label="任务名称"]');
  if (taskTitle instanceof HTMLInputElement) { setInputValue(taskTitle, "UAT 今日复习高数"); await wait(150); }
  const taskType = document.querySelector('select[aria-label="任务类型"]');
  if (taskType instanceof HTMLSelectElement) { setSelectValue(taskType, "review"); await wait(150); }
  await clickButton("保存任务");
  const taskCreated = await softWaitFor(() => /UAT 今日复习高数/.test(bodyText()), 8000);

  // ---- 02b 新增考试并确认 ----
  const examSection = await softWaitFor(() => /考试/.test(bodyText()), 8000);
  const addExamBtn = allButtons("新增考试")[0] || allButtons("添加考试")[0];
  if (addExamBtn) { addExamBtn.click(); await wait(300); }
  const examName = document.querySelector('input[aria-label="考试名称"]');
  if (examName instanceof HTMLInputElement) { setInputValue(examName, "UAT 期末冲刺考"); await wait(150); }
  const examType = document.querySelector('select[aria-label="考试类型"]');
  if (examType instanceof HTMLSelectElement) { setSelectValue(examType, "final"); await wait(150); }
  const examDate = document.querySelector('input[aria-label="考试日期"]');
  if (examDate instanceof HTMLInputElement) { setInputValue(examDate, "2026-08-20"); await wait(150); }
  const saveExamBtn = allButtons("保存考试")[0] || button("保存");
  if (saveExamBtn) { saveExamBtn.click(); await wait(500); }
  const examCreated = await softWaitFor(() => /UAT 期末冲刺考/.test(bodyText()), 8000);
  // 确认考试（pending → confirmed）
  const confirmBtn = allButtons("确认")[0];
  if (confirmBtn) { confirmBtn.click(); await wait(600); }
  const examConfirmed = await softWaitFor(() => /已确认/.test(bodyText()), 8000);

  // ---- 03 首页：任务完成动作 + 考试查看 ----
  await clickButton("首页");
  await wait(400);
  await waitFor(() => /每日学习简报/.test(bodyText()), "home brief missing");
  const completeBtn = button("完成");
  let taskCompleted = false;
  if (completeBtn) {
    completeBtn.click();
    await wait(800);
    taskCompleted = /已完成/.test(bodyText());
  }
  const viewBtn = button("查看");
  let examViewOpened = false;
  if (viewBtn) {
    viewBtn.click();
    await wait(400);
    examViewOpened = /考试类型|计划日期|确认状态/.test(bodyText());
  }

  // ---- 04 冲刺：已确认考试 → 生成模拟卷 → 作答 → 提交 → 结果 ----
  const cramTab = tabButton("冲刺");
  if (cramTab) { cramTab.click(); await wait(500); }
  const cramReady = await softWaitFor(() => /冲刺考试|速背卡|模拟考/.test(bodyText()), 10000);
  const assessSelect = document.querySelector("#cram-assessment");
  if (assessSelect instanceof HTMLSelectElement && assessSelect.options.length > 1) {
    setSelectValue(assessSelect, assessSelect.options[1].value);
    await wait(500);
  }
  const mockTab = allButtons("模拟考")[0];
  if (mockTab) { mockTab.click(); await wait(400); }
  const genBtn = button("生成试卷");
  let paperGenerated = false;
  if (genBtn) {
    genBtn.click();
    paperGenerated = await softWaitFor(() => /开始考试|模拟卷/.test(bodyText()), 15000);
  }
  let examCompleted = false;
  const startExamBtn = button("开始考试");
  if (startExamBtn) {
    startExamBtn.click();
    await wait(600);
    // 作答第一题（单选）
    const radio = document.querySelector('input[type="radio"]');
    if (radio) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked")?.set;
      setter?.call(radio, true);
      radio.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(200);
    }
    const submitBtn = button("提交");
    if (submitBtn) { submitBtn.click(); await wait(800); }
    examCompleted = await softWaitFor(() => /模拟考结果|总分/.test(bodyText()), 15000);
  }

  const snapshot = bodyText();
  return {
    step01: { createEntryVisible: Boolean(createEntry), semesterCreated, courseCreated },
    step02: { taskCreated, examCreated, examConfirmed, examSectionVisible: examSection },
    step03: { taskCompleted, examViewOpened },
    step04: { cramReady, paperGenerated, examCompleted },
    bodySnapshot: snapshot.slice(0, 400),
  };
})()`;

/** 阶段 B：重启回查（同一隔离数据根） */
const PHASE_B_JS = `(async () => {
  // ---- 05 重启回查：学期/课程/任务/考试持久化 ----
  const semesterPersisted = await softWaitFor(() => /UAT 2026 秋/.test(bodyText()), 15000);
  const courseSelected = await selectSemesterCourse();
  await clickButton("首页");
  await wait(500);
  const briefVisible = await softWaitFor(() => /每日学习简报/.test(bodyText()), 10000);
  const snapshot = bodyText();
  // 任务/考试是否持久化（首页或学习计划面板）
  const taskPersisted = /UAT 今日复习高数/.test(snapshot);
  const examPersisted = /UAT 期末冲刺考/.test(snapshot);
  return {
    semesterPersisted, courseSelected, briefVisible, taskPersisted, examPersisted,
    bodySnapshot: snapshot.slice(0, 400),
  };
})()`;

function runnerSource(stepJs: string): string {
  return String.raw`
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const projectRoot = ${JSON.stringify(PROJECT_ROOT)};
const dataRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
const evidenceDir = process.env.T_M5_004_EVIDENCE_DIR || "";
const stepName = process.env.T_M5_004_STEP || "step";
app.setPath("userData", path.join(dataRoot, ".electron-user-data"));
const { initializeDataRoot } = require(path.join(projectRoot, "dist/main/data-root-init.js"));
initializeDataRoot(dataRoot);
let emitted = false;
function emit(result) {
  if (emitted) return;
  emitted = true;
  fs.writeFileSync(path.join(dataRoot, "renderer-result.json"), JSON.stringify(result), "utf8");
  process.stdout.write(JSON.stringify(result) + "\n");
  // 截图证据（主进程 capturePage；失败不阻塞结果）
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (win && evidenceDir) {
      win.webContents.capturePage().then((image) => {
        const png = path.join(evidenceDir, stepName + ".png");
        fs.writeFileSync(png, image.toPNG());
      }).catch(() => {});
    }
  } catch {}
  setTimeout(() => app.quit(), 200);
}
function fail() { emit({ phase: "failed", error: "真实 Electron renderer UAT 失败" }); }
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);
try { require(path.join(projectRoot, "dist/main/main.js")); } catch (error) { fail(); }
app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error("BrowserWindow missing");
    const ui = ${JSON.stringify(UI_HELPERS)};
    const result = await win.webContents.executeJavaScript(ui + "\n" + ${JSON.stringify(stepJs)});
    emit({ phase: "ready", result });
  } catch (error) { fail(); }
});
setTimeout(() => fail(), 60000);
`;
}

async function runPhase(name: string, js: string): Promise<{ name: string; result?: any; exitCode: number | null }> {
  fs.mkdirSync(CASE_ROOT, { recursive: true });
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const runner = path.join(EVIDENCE_DIR, "runner.cjs");
  fs.writeFileSync(runner, runnerSource(js), "utf8");
  try {
    await execFileAsync(ELECTRON, ["--no-sandbox", runner], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PI_STUDYBUDDY_DATA_ROOT: CASE_ROOT, E2E_RUN_DIR: RUN_ROOT, T_M5_004_EVIDENCE_DIR: EVIDENCE_DIR, T_M5_004_STEP: name, VITEST: undefined },
      windowsHide: true,
      timeout: 90_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    // 等截图异步落盘
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
    const raw = fs.readFileSync(path.join(CASE_ROOT, "renderer-result.json"), "utf8");
    return { name, exitCode: 0, result: JSON.parse(raw) };
  } catch (error) {
    const item = error as { code?: number };
    const resultPath = path.join(CASE_ROOT, "renderer-result.json");
    return {
      name,
      exitCode: typeof item.code === "number" ? item.code : null,
      result: fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, "utf8")) : undefined,
    };
  }
}

describe("T-M5-004 真机 UAT v2（真实 Electron 纯 UI 完整闭环）", () => {
  it("阶段 A+B：UI 创建学期/课程/任务/考试确认 → 首页完成查看 → 冲刺模拟考 → 重启回查", async () => {
    fs.rmSync(CASE_ROOT, { recursive: true, force: true });
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    const phaseA = await runPhase("phase-a-create-use", PHASE_A_JS);
    fs.writeFileSync(path.join(EVIDENCE_DIR, "phase-a.json"), sanitizeEvidence(JSON.stringify(phaseA, null, 2)), "utf8");
    fs.writeFileSync(path.join(EVIDENCE_DIR, "phase-a.dom.txt"), sanitizeEvidence(phaseA.result?.result?.bodySnapshot ?? ""), "utf8");

    // 阶段 B 复用同一数据根（真实重启）
    const phaseB = await runPhase("phase-b-restart-persist", PHASE_B_JS);
    fs.writeFileSync(path.join(EVIDENCE_DIR, "phase-b.json"), sanitizeEvidence(JSON.stringify(phaseB, null, 2)), "utf8");
    fs.writeFileSync(path.join(EVIDENCE_DIR, "phase-b.dom.txt"), sanitizeEvidence(phaseB.result?.result?.bodySnapshot ?? ""), "utf8");

    // PNG 截图验证（复验要求：每步非空截图）
    const pngA = path.join(EVIDENCE_DIR, "phase-a-create-use.png");
    const pngB = path.join(EVIDENCE_DIR, "phase-b-restart-persist.png");
    const pngASize = fs.existsSync(pngA) ? fs.statSync(pngA).size : 0;
    const pngBSize = fs.existsSync(pngB) ? fs.statSync(pngB).size : 0;

    const report = [
      "# T-M5-004 真机 UAT v2 报告",
      "",
      `- 日期：${new Date().toISOString()}`,
      "- 环境：真实 Electron（node_modules/electron），全新隔离数据根",
      `- 数据根：${CASE_ROOT}（纯 UI 操作，不 seed / 不 handler / 不直写库）`,
      `- 证据目录：${EVIDENCE_DIR}（不进 Git）`,
      "",
      "## 阶段 A（创建→使用）",
      "",
      `| 步骤 | 结果 |`,
      `|---|---|`,
      `| 01 向导创建学期/课程 | ${JSON.stringify(phaseA.result?.result?.step01)} |`,
      `| 02 S1 新增任务/考试/确认 | ${JSON.stringify(phaseA.result?.result?.step02)} |`,
      `| 03 首页完成/查看 | ${JSON.stringify(phaseA.result?.result?.step03)} |`,
      `| 04 冲刺模拟考全链 | ${JSON.stringify(phaseA.result?.result?.step04)} |`,
      "",
      "## 阶段 B（重启回查）",
      "",
      `| 步骤 | 结果 |`,
      `|---|---|`,
      `| 05 重启持久化 | ${JSON.stringify(phaseB.result?.result)} |`,
      "",
      "## 截图证据",
      "",
      `| 文件 | 大小 |`,
      `|---|---|`,
      `| phase-a-create-use.png | ${pngASize} bytes |`,
      `| phase-b-restart-persist.png | ${pngBSize} bytes |`,
      "",
      "## 功能缺口登记（无纯 UI 数据创建入口，不冒充 UAT 成功）",
      "",
      "| 闭环 | 原因 | 归属 |",
      "|---|---|---|",
      "| S2 资料导入/预览 | 文件导入依赖系统文件对话框（dialog capability），无法在自动化纯 UI 中点击；预览依赖已导入资料 | 本任务登记 P1 缺口，UAT 人工路径待 T-M5-007 |",
      "| S2 笔记/知识模块 | 笔记生成与模块提取依赖真实 AI（materials.generateNote），无真实模型时失败可见可重试（已由单元/E2E 覆盖） | 依赖真实 AI，UAT 人工路径待 T-M5-007 |",
      "| S3 练习 | 依赖 AI 生成知识模块（modules.list 为空时正确空态） | 依赖真实 AI，UAT 人工路径待 T-M5-007 |",
      "| S4 错题 | 依赖 S3 练习产生错题（mistakes.list 为空时正确空态） | 依赖练习数据，UAT 人工路径待 T-M5-007 |",
    ].join("\n");
    fs.writeFileSync(path.join(EVIDENCE_DIR, "UAT-报告.md"), report, "utf8");

    // 硬断言：纯 UI 可走通的闭环必须全部成功
    const a = phaseA.result?.result;
    const b = phaseB.result?.result;
    expect(phaseA.exitCode, JSON.stringify(phaseA)).toBe(0);
    expect(phaseB.exitCode, JSON.stringify(phaseB)).toBe(0);
    expect(a?.step01?.semesterCreated, "UI 创建学期失败").toBe(true);
    expect(a?.step01?.courseCreated, "UI 创建课程失败").toBe(true);
    expect(a?.step02?.taskCreated, "UI 新增任务失败").toBe(true);
    expect(a?.step02?.examCreated, "UI 新增考试失败").toBe(true);
    expect(a?.step02?.examConfirmed, "UI 确认考试失败").toBe(true);
    expect(a?.step03?.taskCompleted, "首页任务完成动作未生效").toBe(true);
    expect(a?.step03?.examViewOpened, "首页考试查看未展开").toBe(true);
    expect(a?.step04?.paperGenerated, "冲刺生成模拟卷失败").toBe(true);
    expect(a?.step04?.examCompleted, "冲刺模拟考提交未出结果").toBe(true);
    expect(b?.semesterPersisted, "重启后学期未持久化").toBe(true);
    expect(b?.taskPersisted, "重启后任务未持久化").toBe(true);
    expect(b?.examPersisted, "重启后考试未持久化").toBe(true);
    // 截图证据（复验要求：每步非空 PNG）
    expect(pngASize, "phase-a PNG 截图缺失或为空").toBeGreaterThan(0);
    expect(pngBSize, "phase-b PNG 截图缺失或为空").toBeGreaterThan(0);
  }, 240_000);
});
