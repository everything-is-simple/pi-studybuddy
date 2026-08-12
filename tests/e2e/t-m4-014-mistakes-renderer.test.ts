/**
 * T-M4-014：真实 Electron renderer → preload → TCP/RPC → agent-host → S4 handler → renderer E2E。
 * 运行产物仅落入 H:\pi-studybuddy-tmp\runs\T-M4-014\。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-014\\e2e-renderer";
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

const UI_JS = `(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, message) => { const deadline = Date.now() + 15000; while (Date.now() < deadline) { const value = predicate(); if (value) return value; await wait(100); } throw new Error(message); };
  const button = (text) => Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes(text));
  const click = async (text) => { const item = await waitFor(() => button(text), "button missing: " + text); item.click(); await wait(250); };
  await click("T-M4-014 Renderer E2E");
  await click("T-M4-014 数学");
  await click("错题");
  await waitFor(() => button("查看详情"), "mistake detail trigger missing");
  await click("查看详情");
  await waitFor(() => document.body.textContent?.includes("AI 建议（仅供参考）"), "AI suggestion marker missing");
  const before = document.body.textContent || "";
  // T-M5-004 方案 A：S4 完整复盘（题干/我的答案/正确答案/解析）在真实 renderer 展示
  const reviewVisible = before.includes("题干") && before.includes("正确答案") && before.includes("解析");
  const readOnly = before.includes("当前学期已归档");
  if (readOnly) {
    return {
      readOnlyVisible: true,
      confirmDisabled: Boolean(button("确认错因")?.disabled),
      redoDisabled: Boolean(button("重做")?.disabled),
      reviewVisible,
      rawSensitiveTextInDom: /secret\.ts|stackFrame|sk-secret/i.test(before),
    };
  }
  const radio = await waitFor(() => document.querySelector('input[name="error-category"][value="formula_error"]'), "error category missing");
  radio.click();
  await click("确认错因");
  await waitFor(() => document.body.textContent?.includes("已确认错因"), "confirmation missing");
  await click("重做");
  await wait(400);
  const result = document.body.textContent || "";
  return { listVisible: before.includes("错题列表"), weakPointVisible: before.includes("薄弱点"), detailVisible: before.includes("错题详情"), reviewVisible, aiMarkedUncertain: before.includes("AI 建议（仅供参考）") && before.includes("不确定"), sanitizedFallbackVisible: before.includes("错因内容已隐藏。"), confirmed: result.includes("已确认错因"), redoVisible: result.includes("重做"), fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(result), windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(result), posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(result), fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(result), stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(result) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(result), rawSensitiveTextInDom: /secret\\.ts|stackFrame|sk-secret/i.test(result) };
})()`;

function runnerSource(): string {
  return String.raw`
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs"); const path = require("node:path");
const projectRoot = ${JSON.stringify(PROJECT_ROOT)}; const dataRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
app.setPath("userData", path.join(dataRoot, ".electron-user-data"));
const { initializeDataRoot } = require(path.join(projectRoot, "dist/main/data-root-init.js"));
const { S1Context, createS1Handlers } = require(path.join(projectRoot, "dist/agent-host/handlers/s1/index.js"));
const { S2Context } = require(path.join(projectRoot, "dist/agent-host/handlers/s2/context.js"));
function seedFixture() {
 initializeDataRoot(dataRoot); const s1 = new S1Context(dataRoot); const h = createS1Handlers(s1);
 const semester = h["semesters.create"]({ label: "T-M4-014 Renderer E2E", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" });
 const course = h["courses.create"]({ semesterId: semester.id, courseName: "T-M4-014 数学", subject: "数学" });
 const s2 = new S2Context(dataRoot); const db = s2.semesterDb(semester.id); const ts = new Date().toISOString();
 db.prepare("INSERT INTO materials (id,course_instance_id,file_name,file_type,file_size_bytes,mime_type,storage_key,source_type,status,permission_confirmed,uploaded_at,created_at,updated_at) VALUES ('m014-material',@cid,'source.pdf','pdf',1,'application/pdf','m014.pdf','upload','completed',1,@ts,@ts,@ts)").run({cid:course.id,ts});
 db.prepare("INSERT INTO knowledge_modules (id,course_instance_id,material_id,module_name,importance,learn_status,source_evidence_json,ai_generated,created_at,updated_at) VALUES ('m014-module',@cid,'m014-material','极限定义',3,'not_started','[]',0,@ts,@ts)").run({cid:course.id,ts});
 db.prepare("INSERT INTO questions (id,course_instance_id,knowledge_module_id,question_type,question_stem,options_json,correct_answer,explanation,score,created_at) VALUES ('m014-question',@cid,'m014-module','single_choice','极限定义题','[\\\"A\\\",\\\"B\\\"]','A','x趋近于0时极限为0',1,@ts)").run({cid:course.id,ts});
 db.prepare("INSERT INTO mistakes (id,question_id,course_instance_id,knowledge_module_id,status,redo_count,created_at,updated_at) VALUES ('m014-mistake','m014-question',@cid,'m014-module','needs_review',0,@ts,@ts)").run({cid:course.id,ts});
 db.prepare("UPDATE mistakes SET error_cause = @cause, error_cause_confirmed_by = 'student' WHERE id = 'm014-mistake'").run({cause:"异常，C:\\\\private\\\\secret.ts；/home/student/private.txt；inline Error: hidden at stackFrame；api-key: sk-secret"});
 db.prepare("INSERT INTO mistake_evidence (id,mistake_id,evidence_type,recorded_at,created_at) VALUES ('m014-evidence','m014-mistake','initial_wrong',@ts,@ts)").run({ts});
 db.prepare("INSERT INTO weak_points (id,course_instance_id,knowledge_module_id,evidence_count,status,first_evidenced_at,last_evidenced_at,created_at,updated_at) VALUES ('m014-weak',@cid,'m014-module',2,'active',@ts,@ts,@ts,@ts)").run({cid:course.id,ts});
 s2.dispose(); s1.dispose(); return semester.id;
 }
 const seededSemesterId = seedFixture(); if (process.env.T_M4_014_ARCHIVED === "1") { const s1 = new S1Context(dataRoot); createS1Handlers(s1)["semesters.archive"]({id: seededSemesterId}); s1.dispose(); } let emitted=false; function emit(result){if(emitted)return;emitted=true;fs.writeFileSync(path.join(dataRoot,"renderer-result.json"),JSON.stringify(result),"utf8");process.stdout.write(JSON.stringify(result)+"\\n");setTimeout(()=>app.quit(),50);} function fail(){emit({phase:"failed",error:"真实 Electron renderer E2E 失败"});}
process.on("uncaughtException",fail);process.on("unhandledRejection",fail);try{require(path.join(projectRoot,"dist/main/main.js"));}catch(error){fail();}
app.whenReady().then(async()=>{try{const win=BrowserWindow.getAllWindows()[0];if(!win)throw new Error("BrowserWindow missing");emit({phase:"ready",result:await win.webContents.executeJavaScript(${JSON.stringify(UI_JS)})});}catch(error){fail();}});setTimeout(()=>fail(),30000);`;
}

async function runProbe(archived = false): Promise<{ exitCode: number | null; result?: any }> {
  const dataRoot = path.join(RUN_ROOT, "case-01"); fs.rmSync(dataRoot, { recursive: true, force: true }); fs.mkdirSync(dataRoot, { recursive: true }); fs.mkdirSync(RUN_ROOT, { recursive: true });
  const runner = path.join(RUN_ROOT, "runner.cjs"); fs.writeFileSync(runner, runnerSource(), "utf8");
  try { await execFileAsync(ELECTRON, ["--no-sandbox", runner], { cwd: PROJECT_ROOT, env: { ...process.env, PI_STUDYBUDDY_DATA_ROOT: dataRoot, E2E_RUN_DIR: RUN_ROOT, T_M4_014_ARCHIVED: archived ? "1" : undefined, VITEST: undefined }, windowsHide: true, timeout: 45_000, maxBuffer: 2 * 1024 * 1024 }); return { exitCode: 0, result: JSON.parse(fs.readFileSync(path.join(dataRoot, "renderer-result.json"), "utf8")) }; }
  catch (error) { const item = error as { code?: number }; const resultPath = path.join(dataRoot, "renderer-result.json"); return { exitCode: typeof item.code === "number" ? item.code : null, result: fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, "utf8")) : undefined }; }
}

describe("T-M4-014 真实 Electron renderer MistakesTab", () => {
  it("加载列表/薄弱点 → 详情 AI 不确定标记 → 确认错因 → 重做，且 DOM 无敏感内部值", async () => {
    const probe = await runProbe(); const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0); expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result).toMatchObject({ listVisible: true, weakPointVisible: true, detailVisible: true, reviewVisible: true, aiMarkedUncertain: true, sanitizedFallbackVisible: true, confirmed: true, redoVisible: true, fullUuidInDom: false, windowsPathInDom: false, posixPathInDom: false, fileUriInDom: false, stackInDom: false, rawSensitiveTextInDom: false });
  }, 60_000);

  it("归档学期在真实 Electron renderer 中保持只读", async () => {
    const probe = await runProbe(true); const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0); expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result).toMatchObject({ readOnlyVisible: true, confirmDisabled: true, redoDisabled: true, rawSensitiveTextInDom: false });
  }, 60_000);
});
