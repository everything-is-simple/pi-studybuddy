/**
 * T-M4-018：真实 Electron renderer → preload → TCP/RPC → agent-host → TTS handler → renderer E2E。
 * 覆盖：笔记 Tab 内嵌"朗读"（09-UI §5.2）→ 控制条播放中（§5.3）→ 暂停 → 停止 →
 * 标记已复习（§5.4 events.markReviewed）→ 引擎切换（§5.1 tts.switchEngine），
 * 并断言 DOM 无完整 playbackId UUID / 路径 / 错误栈（AGENTS.md §9.3 + 09-UI §11.1）。
 * 生产 agent-host 默认 mock TtsAdapter（08-Test §5.4），不连接真实 SAPI/edge-tts。
 * 运行产物仅落入 H:\pi-studybuddy-tmp\runs\T-M4-018\。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-018\\e2e-renderer";
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
    await clickButton("T-M4-018 Renderer E2E");
    await clickButton("T-M4-018 Renderer 物理");
    await clickButton("笔记");
    const select = await waitFor(() => document.querySelector('select[aria-label="选择资料"]'), "NotesTab material selector missing");
    await waitFor(() => select.options.length >= 2, "material option missing");
    select.value = select.options[1].value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => document.body.textContent?.includes("牛顿第一定律"), "note preview missing");

    // 内嵌"朗读"→ 控制条播放中（09-UI §5.2/§5.3；真实 RPC → 生产 mock adapter）
    await clickButton("朗读");
    await waitFor(() => document.body.textContent?.includes("笔记 · 播放中"), "playing state missing");
    const afterPlay = document.body.textContent || "";

    // 暂停（§5.3）
    await clickButton("暂停");
    await waitFor(() => document.body.textContent?.includes("笔记 · 暂停"), "paused state missing");
    const afterPause = document.body.textContent || "";

    // 停止（§5.3）→ 朗读完成显示"标记已复习"（§5.4）
    await clickButton("停止");
    await waitFor(() => document.body.textContent?.includes("笔记 · 已停止"), "stopped state missing");
    await waitFor(() => button("标记已复习"), "mark reviewed button missing");
    const afterStop = document.body.textContent || "";

    // 标记已复习（§5.4 events.markReviewed → study_events）
    await clickButton("标记已复习");
    await wait(300);

    // 引擎切换（§5.1 tts.switchEngine）
    const engineSelect = await waitFor(() => document.querySelector('select[aria-label="TTS 引擎"]'), "engine select missing");
    engineSelect.value = "edge-tts";
    engineSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(300);

    const visible = document.body.textContent || "";
    return {
      playingVisible: afterPlay.includes("笔记 · 播放中"),
      pausedVisible: afterPause.includes("笔记 · 暂停"),
      stoppedVisible: afterStop.includes("笔记 · 已停止"),
      markReviewedVisible: afterStop.includes("标记已复习"),
      engineSwitched: engineSelect.value === "edge-tts",
      titleInBar: afterPlay.includes("笔记 · "),
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
const { S2Context } = require(path.join(projectRoot, "dist/agent-host/handlers/s2/context.js"));
function seedFixture() {
  initializeDataRoot(dataRoot);
  const s1 = new S1Context(dataRoot);
  const s1Handlers = createS1Handlers(s1);
  const semester = s1Handlers["semesters.create"]({ label: "T-M4-018 Renderer E2E", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" });
  const course = s1Handlers["courses.create"]({ semesterId: semester.id, courseName: "T-M4-018 Renderer 物理", subject: "物理" });
  const s2 = new S2Context(dataRoot);
  const db = s2.semesterDb(semester.id);
  const now = new Date().toISOString();
  const materialId = "t-m4-018-renderer-material";
  db.prepare(
    "INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at) VALUES (@id, @cid, @fileName, 'pdf', 1024, 'application/pdf', @storageKey, 'upload', 'completed', 1, @ts, @ts, @ts)"
  ).run({ id: materialId, cid: course.id, fileName: "力学笔记.pdf", storageKey: "t-m4-018-renderer.pdf", ts: now });
  db.prepare(
    "INSERT INTO structured_notes (id, material_id, course_instance_id, note_markdown, highlights_json, prompt_version, model, ai_generated, created_at, updated_at) VALUES ('t-m4-018-renderer-note', @mid, @cid, @md, '[]', 'manual', 'student', 0, @ts, @ts)"
  ).run({ mid: materialId, cid: course.id, md: "力学笔记：牛顿第一定律，物体在不受外力时保持静止或匀速直线运动。", ts: now });
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

describe("T-M4-018 真实 Electron renderer TTS 控制条", () => {
  it("笔记朗读 → 控制条播放/暂停/停止 → 标记已复习 → 引擎切换，DOM 无敏感内部值", async () => {
    const probe = await runProbe();
    const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0);
    expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result, evidence).toMatchObject({
      playingVisible: true,
      pausedVisible: true,
      stoppedVisible: true,
      markReviewedVisible: true,
      engineSwitched: true,
      titleInBar: true,
      fullUuidInDom: false,
      windowsPathInDom: false,
      posixPathInDom: false,
      fileUriInDom: false,
      stackInDom: false,
      rawSensitiveTextInDom: false,
    });
  }, 90_000);
});
