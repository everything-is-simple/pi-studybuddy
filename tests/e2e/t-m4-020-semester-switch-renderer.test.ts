/**
 * T-M4-020：真实 Electron renderer 学期/课程切换主路径回归（决策 3A）。
 * 覆盖：左侧栏学期树切换（T-M4-007）→ 笔记 Tab 数据随学期/课程刷新（AppShell 唯一上下文）→
 * 归档学期只读提示 + 隐私断言。
 * 运行产物仅落入 H:\pi-studybuddy-tmp\runs\T-M4-020\。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-020\\e2e-semester-switch";
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
    const selectMaterial = async () => {
      const select = await waitFor(() => document.querySelector('select[aria-label="选择资料"]'), "NotesTab material selector missing");
      await waitFor(() => select.options.length >= 2, "material option missing");
      select.value = select.options[1].value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(200);
    };

    // 学期 1 → 课程甲 → 笔记 Tab
    await clickButton("T-M4-020 第一学期");
    await clickButton("T-M4-020 数学甲");
    const notesTab = await waitFor(() => Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("📝")), "notes tab missing");
    notesTab.click();
    await selectMaterial();
    await waitFor(() => document.body.textContent?.includes("第一学期笔记内容"), "sem1 note missing");

    // 切换到学期 2 → 课程乙 → 笔记 Tab 数据刷新
    await clickButton("T-M4-020 第一学期");
    await clickButton("T-M4-020 第二学期");
    await clickButton("T-M4-020 数学乙");
    await selectMaterial();
    await waitFor(() => document.body.textContent?.includes("第二学期笔记内容"), "sem2 note missing");

    const switched = document.body.textContent || "";
    const switchOk = switched.includes("第二学期笔记内容") && !switched.includes("第一学期笔记内容");

    // 归档学期（T_M4_020_ARCHIVED=1）：只读提示 + 编辑禁用
    if (switched.includes("当前学期已归档")) {
      const archivedText = document.body.textContent || "";
      const editDisabled = Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("编辑")).every((b) => b.disabled);
      return {
        switchOk,
        readOnlyVisible: true,
        editDisabled,
        fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(archivedText),
        windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(archivedText),
        posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(archivedText),
        fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(archivedText),
        stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(archivedText) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(archivedText),
      };
    }

    return {
      switchOk,
      fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(switched),
      windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(switched),
      posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(switched),
      fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(switched),
      stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(switched) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(switched),
      rawSensitiveTextInDom: /secret\\.ts|stackFrame|sk-secret/i.test(switched),
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
function seedSemester(s1, s2, semesterLabel, courseName, materialId, noteId, noteMarkdown) {
  const semester = s1.handlers["semesters.create"]({ label: semesterLabel, startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" });
  const course = s1.handlers["courses.create"]({ semesterId: semester.id, courseName, subject: "数学" });
  const db = s2.semesterDb(semester.id);
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at) VALUES (@id, @cid, @name, 'pdf', 1024, 'application/pdf', @key, 'upload', 'completed', 1, @ts, @ts, @ts)"
  ).run({ id: materialId, cid: course.id, name: courseName + "-笔记.pdf", key: materialId + ".pdf", ts: now });
  db.prepare(
    "INSERT INTO structured_notes (id, material_id, course_instance_id, note_markdown, highlights_json, prompt_version, model, ai_generated, created_at, updated_at) VALUES (@id, @mid, @cid, @md, '[]', 'manual', 'student', 0, @ts, @ts)"
  ).run({ id: noteId, mid: materialId, cid: course.id, md: noteMarkdown, ts: now });
  return { semester, course };
}
function seedFixture() {
  initializeDataRoot(dataRoot);
  const s1 = { ctx: new S1Context(dataRoot), handlers: createS1Handlers(new S1Context(dataRoot)) };
  const s2 = new S2Context(dataRoot);
  seedSemester(s1, s2, "T-M4-020 第一学期", "T-M4-020 数学甲", "t-m4-020-sem1-material", "t-m4-020-sem1-note", "第一学期笔记内容：导数与极限。");
  const sem2 = seedSemester(s1, s2, "T-M4-020 第二学期", "T-M4-020 数学乙", "t-m4-020-sem2-material", "t-m4-020-sem2-note", "第二学期笔记内容：积分与微分方程。");
  s2.dispose();
  if (process.env.T_M4_020_ARCHIVED === "1") {
    const arch = new S1Context(dataRoot);
    createS1Handlers(arch)["semesters.archive"]({ id: sem2.semester.id });
    arch.dispose();
  }
  s1.ctx.dispose();
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

async function runProbe(archived = false): Promise<{ exitCode: number | null; stdout: string; stderr: string; result?: unknown }> {
  const dataRoot = path.join(RUN_ROOT, archived ? "case-archived" : "case-01");
  fs.rmSync(dataRoot, { recursive: true, force: true });
  fs.mkdirSync(dataRoot, { recursive: true });
  const runner = path.join(RUN_ROOT, "runner.cjs");
  fs.writeFileSync(runner, runnerSource(), "utf8");
  try {
    const { stdout, stderr } = await execFileAsync(ELECTRON, ["--no-sandbox", runner], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PI_STUDYBUDDY_DATA_ROOT: dataRoot, E2E_RUN_DIR: RUN_ROOT, T_M4_020_ARCHIVED: archived ? "1" : undefined, VITEST: undefined },
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

describe("T-M4-020 真实 Electron renderer 学期/课程切换回归", () => {
  it("切换学期 → 笔记 Tab 数据刷新，DOM 无敏感内部值", async () => {
    const probe = await runProbe();
    const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0);
    expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result, evidence).toMatchObject({
      switchOk: true,
      fullUuidInDom: false,
      windowsPathInDom: false,
      posixPathInDom: false,
      fileUriInDom: false,
      stackInDom: false,
      rawSensitiveTextInDom: false,
    });
  }, 90_000);

  it("归档学期在真实 Electron renderer 中保持只读（编辑禁用）", async () => {
    const probe = await runProbe(true);
    const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0);
    expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result, evidence).toMatchObject({
      readOnlyVisible: true,
      editDisabled: true,
      fullUuidInDom: false,
      windowsPathInDom: false,
      posixPathInDom: false,
      fileUriInDom: false,
      stackInDom: false,
    });
  }, 90_000);
});
