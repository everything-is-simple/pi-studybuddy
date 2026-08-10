/**
 * T-M4-013：真实 Electron renderer PracticeTab 代表性路径。
 *
 * 覆盖：真实 BrowserWindow → preload piBridge → host RPC → PracticeTab DOM：
 * 选择课程 → 显式模块选择 → createSession/getQuestions → 作答前防泄露 → submit/getResult。
 * 数据根只使用 H:\pi-studybuddy-tmp\runs\T-M4-013\e2e-renderer。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-013\\e2e-renderer";
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

const UI_JS = `(
  async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = async (predicate, message) => {
      const deadline = Date.now() + 15000;
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

    await clickButton("T-M4-013 Renderer E2E");
    await clickButton("T-M4-013 Renderer 数学");
    await clickButton("练习");
    const select = await waitFor(() => document.querySelector('select[aria-label="选择知识模块"]'), "PracticeTab module selector missing");
    await waitFor(() => select.options.length >= 2, "two real module options missing");
    if (select.value !== "") throw new Error("module selected by default");
    select.value = select.options[1].value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await clickButton("开始练习");
    await waitFor(() => document.body.textContent?.includes("单选题 1"), "practice question missing");

    const beforeSubmitText = document.body.textContent || "";
    const firstAnswer = await waitFor(() => document.querySelector('input[aria-label="题目 1 选项 A"]'), "first answer missing");
    firstAnswer.click();
    for (let index = 0; index < 4; index += 1) await clickButton("下一题");
    await clickButton("提交");
    await waitFor(() => document.body.textContent?.includes("练习结果"), "practice result missing");

    const resultText = document.body.textContent || "";
    return {
      selectorPresent: true,
      selectedToken: select.value,
      questionVisible: beforeSubmitText.includes("单选题 1"),
      noCorrectAnswerBeforeSubmit: !beforeSubmitText.includes("正确答案"),
      noExplanationBeforeSubmit: !beforeSubmitText.includes("解析："),
      resultVisible: resultText.includes("练习结果"),
      correctAnswerVisibleAfterSubmit: resultText.includes("正确答案"),
      explanationVisibleAfterSubmit: resultText.includes("解析："),
      fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(resultText),
      windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(resultText),
      posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(resultText),
      fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(resultText),
      stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(resultText) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(resultText),
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
const { S2Context } = require(path.join(projectRoot, "dist/agent-host/handlers/s2/context.js"));
function seedFixture() {
  initializeDataRoot(dataRoot);
  const s1 = new S1Context(dataRoot);
  const s1Handlers = createS1Handlers(s1);
  const semester = s1Handlers["semesters.create"]({ label: "T-M4-013 Renderer E2E", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" });
  const course = s1Handlers["courses.create"]({ semesterId: semester.id, courseName: "T-M4-013 Renderer 数学", subject: "数学" });
  const s2 = new S2Context(dataRoot);
  const db = s2.semesterDb(semester.id);
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at) VALUES ('t-m4-013-renderer-material', @cid, 'practice-source.pdf', 'pdf', 100, 'application/pdf', 't-m4-013-renderer.pdf', 'upload', 'completed', 1, @ts, @ts, @ts)"
  ).run({ cid: course.id, ts: now });
  db.prepare(
    "INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name, importance, learn_status, source_evidence_json, ai_generated, created_at, updated_at) VALUES ('t-m4-013-renderer-module-1', @cid, 't-m4-013-renderer-material', '极限定义', 3, 'not_started', '[]', 0, @ts, @ts)"
  ).run({ cid: course.id, ts: now });
  db.prepare(
    "INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at) VALUES ('t-m4-013-renderer-material-2', @cid, 'practice-source-2.pdf', 'pdf', 100, 'application/pdf', 't-m4-013-renderer-2.pdf', 'upload', 'completed', 1, @ts, @ts, @ts)"
  ).run({ cid: course.id, ts: now });
  db.prepare(
    "INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name, importance, learn_status, source_evidence_json, ai_generated, created_at, updated_at) VALUES ('t-m4-013-renderer-module-2', @cid, 't-m4-013-renderer-material-2', '导数定义', 3, 'not_started', '[]', 0, @ts, @ts)"
  ).run({ cid: course.id, ts: now });
  s2.dispose();
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
    emit({ phase: "ready", fixtureSeeded: true, result, electron: process.versions.electron, node: process.versions.node });
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

async function runProbe(): Promise<{ exitCode: number | null; stdout: string; stderr: string; result?: any }> {
  const dataRoot = path.join(RUN_ROOT, "case-01");
  fs.rmSync(dataRoot, { recursive: true, force: true });
  fs.mkdirSync(dataRoot, { recursive: true });
  const runner = path.join(RUN_ROOT, "runner.cjs");
  fs.mkdirSync(RUN_ROOT, { recursive: true });
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

describe("T-M4-013 真实 Electron renderer PracticeTab", () => {
  it("显式选模块 → 创建会话/作答 → 提交并查看结果，作答前不泄露答案", async () => {
    const probe = await runProbe();
    const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0);
    expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result).toMatchObject({
      selectorPresent: true,
      questionVisible: true,
      noCorrectAnswerBeforeSubmit: true,
      noExplanationBeforeSubmit: true,
      resultVisible: true,
      correctAnswerVisibleAfterSubmit: true,
      explanationVisibleAfterSubmit: true,
      fullUuidInDom: false,
      windowsPathInDom: false,
      posixPathInDom: false,
      fileUriInDom: false,
      stackInDom: false,
    });
    expect(probe.result?.result?.selectedToken).toBe("t-m4-013-renderer-module-2");
  }, 60_000);
});
