/**
 * T-M4-020：真实 Electron renderer S2 资料 Tab 主路径回归。
 * 覆盖：资料列表（materials.list）+ 状态标识（已完成/待处理）+ 转换入口（materials.convert 接线）+
 * 归档只读（决策 2A：SQL 预置资料，不驱动原生上传对话框）+ 隐私断言。
 * 运行产物仅落入 H:\pi-studybuddy-tmp\runs\T-M4-020\。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-020\\e2e-materials";
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
    await clickButton("T-M4-020 Materials E2E");
    await clickButton("T-M4-020 Materials 物理");
    const materialsTab = await waitFor(() => Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("📁")), "materials tab missing");
    materialsTab.click();
    await waitFor(() => document.body.textContent?.includes("力学公式手册.pdf"), "material list missing");

    const entryText = document.body.textContent || "";
    if (entryText.includes("当前学期已归档")) {
      const archivedText = document.body.textContent || "";
      return {
        readOnlyVisible: true,
        convertDisabled: Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("开始转换")).every((b) => b.disabled),
        fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(archivedText),
        windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(archivedText),
        posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(archivedText),
        fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(archivedText),
        stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(archivedText) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(archivedText),
      };
    }

    // 资料列表 + 状态标识（决策 2A：SQL 预置，不驱动原生上传对话框）
    const listVisible =
      entryText.includes("力学公式手册.pdf") && entryText.includes("已完成") &&
      entryText.includes("课堂练习.docx") && entryText.includes("待处理");

    // 转换接线（materials.convert）：pending 资料 → 开始转换 → 任务已提交提示
    await clickButton("开始转换");
    await waitFor(() => document.body.textContent?.includes("转换任务已提交"), "convert submitted missing");
    const afterConvert = document.body.textContent || "";

    return {
      listVisible,
      convertSubmitted: afterConvert.includes("转换任务已提交"),
      uploadEntryVisible: afterConvert.includes("上传资料"),
      fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(afterConvert),
      windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(afterConvert),
      posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(afterConvert),
      fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(afterConvert),
      stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(afterConvert) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(afterConvert),
      rawSensitiveTextInDom: /secret\\.ts|stackFrame|sk-secret/i.test(afterConvert),
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
  const semester = s1Handlers["semesters.create"]({ label: "T-M4-020 Materials E2E", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" });
  const course = s1Handlers["courses.create"]({ semesterId: semester.id, courseName: "T-M4-020 Materials 物理", subject: "物理" });
  const s2 = new S2Context(dataRoot);
  const db = s2.semesterDb(semester.id);
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at) VALUES (@id, @cid, @name, 'pdf', 204800, 'application/pdf', @key, 'upload', 'completed', 1, @ts, @ts, @ts)"
  ).run({ id: "t-m4-020-mat-completed", cid: course.id, name: "力学公式手册.pdf", key: "t-m4-020-completed.pdf", ts: now });
  db.prepare(
    "INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at) VALUES (@id, @cid, @name, 'docx', 102400, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', @key, 'upload', 'pending', 0, @ts, @ts, @ts)"
  ).run({ id: "t-m4-020-mat-pending", cid: course.id, name: "课堂练习.docx", key: "t-m4-020-pending.docx", ts: now });
  s2.dispose();
  if (process.env.T_M4_020_MATERIALS_ARCHIVED === "1") {
    const arch = new S1Context(dataRoot);
    createS1Handlers(arch)["semesters.archive"]({ id: semester.id });
    arch.dispose();
  }
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

async function runProbe(archived = false): Promise<{ exitCode: number | null; stdout: string; stderr: string; result?: unknown }> {
  const dataRoot = path.join(RUN_ROOT, archived ? "case-archived" : "case-01");
  fs.rmSync(dataRoot, { recursive: true, force: true });
  fs.mkdirSync(dataRoot, { recursive: true });
  const runner = path.join(RUN_ROOT, "runner.cjs");
  fs.writeFileSync(runner, runnerSource(), "utf8");
  try {
    const { stdout, stderr } = await execFileAsync(ELECTRON, ["--no-sandbox", runner], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PI_STUDYBUDDY_DATA_ROOT: dataRoot, E2E_RUN_DIR: RUN_ROOT, T_M4_020_MATERIALS_ARCHIVED: archived ? "1" : undefined, VITEST: undefined },
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

describe("T-M4-020 真实 Electron renderer S2 资料回归", () => {
  it("资料：列表 + 状态标识 + 转换接线，DOM 无敏感内部值", async () => {
    const probe = await runProbe();
    const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0);
    expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result, evidence).toMatchObject({
      listVisible: true,
      convertSubmitted: true,
      uploadEntryVisible: true,
      fullUuidInDom: false,
      windowsPathInDom: false,
      posixPathInDom: false,
      fileUriInDom: false,
      stackInDom: false,
      rawSensitiveTextInDom: false,
    });
  }, 90_000);

  it("归档学期在真实 Electron renderer 中保持只读（资料转换禁用）", async () => {
    const probe = await runProbe(true);
    const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0);
    expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result, evidence).toMatchObject({
      readOnlyVisible: true,
      convertDisabled: true,
      fullUuidInDom: false,
      windowsPathInDom: false,
      posixPathInDom: false,
      fileUriInDom: false,
      stackInDom: false,
    });
  }, 90_000);
});
