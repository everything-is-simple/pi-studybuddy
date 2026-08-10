/**
 * T-M4-012：真实 Electron renderer NotesTab 代表性路径。
 *
 * 覆盖：真实 BrowserWindow → preload piBridge → host RPC → NotesTab DOM：
 * 选择课程 → 显式选择资料 → NOT_FOUND → 新建/保存笔记 → 更新模块状态。
 * 数据根只使用 H:\\pi-studybuddy-tmp\\runs\\T-M4-012\\e2e-renderer。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-012\\e2e-renderer";
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
    await clickButton("T-M4-012 Renderer E2E");
    await clickButton("T-M4-012 Renderer 数学");
    await clickButton("笔记");
    const select = await waitFor(() => document.querySelector('select[aria-label="选择资料"]'), "NotesTab material selector missing");
    await waitFor(() => select.options.length >= 2, "material option missing");
    select.value = select.options[1].value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => document.body.textContent?.includes("该资料暂无笔记"), "NOT_FOUND empty state missing");
    await clickButton("新建笔记");
    const editor = await waitFor(() => document.querySelector('textarea[aria-label="笔记内容"]'), "note editor missing");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(editor, "# 真实 Electron 笔记");
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    await clickButton("保存笔记");
    await waitFor(() => document.body.textContent?.includes("真实 Electron 笔记"), "saved note missing");
    await clickButton("标记学习中");
    await waitFor(() => document.body.textContent?.includes("学习中"), "module learning status missing");
    const visibleText = document.body.textContent || "";
    return {
      selectorPresent: true,
      selectedToken: select.value,
      noteVisible: visibleText.includes("真实 Electron 笔记"),
      learningVisible: visibleText.includes("学习中"),
      fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(visibleText),
      windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(visibleText),
      posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(visibleText),
      fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(visibleText),
      stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(visibleText) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(visibleText),
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
  const semester = s1Handlers["semesters.create"]({ label: "T-M4-012 Renderer E2E", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" });
  const course = s1Handlers["courses.create"]({ semesterId: semester.id, courseName: "T-M4-012 Renderer 数学", subject: "数学" });
  const s2 = new S2Context(dataRoot);
  const db = s2.semesterDb(semester.id);
  const now = new Date().toISOString();
  const materialId = "t-m4-012-renderer-material";
  db.prepare(
    "INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at) VALUES (@id, @cid, @fileName, 'pdf', 100, 'application/pdf', @storageKey, 'upload', 'completed', 1, @ts, @ts, @ts)"
  ).run({ id: materialId, cid: course.id, fileName: "C:\\student\\private\\source.pdf", storageKey: "t-m4-012-renderer.pdf", ts: now });
  db.prepare(
    "INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name, importance, learn_status, source_evidence_json, ai_generated, created_at, updated_at) VALUES ('t-m4-012-renderer-module', @cid, @mid, 'file:///home/student/private/module\\nError: hidden\\n    at leaked (C:\\student\\private\\module.ts:1:1)', 3, 'not_started', '[]', 0, @ts, @ts)"
  ).run({ cid: course.id, mid: materialId, ts: now });
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

describe("T-M4-012 真实 Electron renderer NotesTab", () => {
  it("显式选资料 → 新建保存笔记 → 更新模块状态", async () => {
    const probe = await runProbe();
    const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0);
    expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result).toMatchObject({
      selectorPresent: true,
      noteVisible: true,
      learningVisible: true,
      fullUuidInDom: false,
      windowsPathInDom: false,
      posixPathInDom: false,
      fileUriInDom: false,
      stackInDom: false,
    });
    expect(probe.result?.result?.selectedToken).toMatch(/^material-/);
  }, 60_000);
});
