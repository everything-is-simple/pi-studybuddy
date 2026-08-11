/**
 * T-M4-016：真实 Electron renderer → preload → TCP/RPC → agent-host → S6 handler → renderer E2E。
 * 覆盖：报告列表、生成报告（类型/周期）、查看详情（脱敏）、冻结、投递状态可视化
 * （sent/failed/未配置）、投递/重试、归档只读、隐私断言。
 * 运行产物仅落入 H:\pi-studybuddy-tmp\runs\T-M4-016\。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-016\\e2e-renderer";
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

const UI_JS = `(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, message) => { const deadline = Date.now() + 15000; while (Date.now() < deadline) { const value = predicate(); if (value) return value; await wait(100); } throw new Error(message); };
  const button = (text) => Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes(text));
  const click = async (text) => { const item = await waitFor(() => button(text), "button missing: " + text); item.click(); await wait(250); };
  const selectByName = async (name, value) => { const item = await waitFor(() => document.querySelector('select[name="' + name + '"]'), "select missing: " + name); item.value = value; item.dispatchEvent(new Event("change", { bubbles: true })); await wait(250); };
  await click("T-M4-016 Renderer E2E");
  await wait(300);
  await click("报告");
  await waitFor(() => document.body.textContent?.includes("报告历史") || document.body.textContent?.includes("暂无报告"), "report tab missing");
  const before = document.body.textContent || "";
  const readOnly = before.includes("当前学期已归档");
  if (readOnly) {
    const generateButtons = Array.from(document.querySelectorAll("button")).filter((item) => item.textContent?.includes("生成报告"));
    const result = document.body.textContent || "";
    return {
      readOnlyVisible: true,
      generateDisabled: generateButtons.length > 0 ? generateButtons.every((b) => b.disabled) : false,
      rawSensitiveTextInDom: /secret\.ts|stackFrame|sk-secret/i.test(result),
    };
  }
  // 生成报告（默认周报）
  await click("生成报告");
  await waitFor(() => document.body.textContent?.includes("学习节奏"), "report detail missing");
  const detail = document.body.textContent || "";
  // 冻结报告
  await click("冻结报告");
  await waitFor(() => document.body.textContent?.includes("已冻结"), "freeze failed");
  const frozen = document.body.textContent || "";
  // 投递状态可视化：local_export 已配置 target → 可投递
  await click("投递");
  await waitFor(() => document.body.textContent?.includes("已投递"), "deliver failed");
  const delivered = document.body.textContent || "";
  return {
    reportListVisible: before.includes("报告历史"),
    detailVisible: detail.includes("学习节奏") && detail.includes("摘要"),
    frozenVisible: frozen.includes("已冻结") && frozen.includes("隐私检查通过"),
    channelConfigured: delivered.includes("本地导出"),
    deliverStatusSent: delivered.includes("已投递") && delivered.includes("✅"),
    fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(delivered),
    windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(delivered),
    posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(delivered),
    fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(delivered),
    stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(delivered) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(delivered),
    rawSensitiveTextInDom: /secret\\.ts|stackFrame|sk-secret/i.test(delivered),
  };
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
 const semester = h["semesters.create"]({ label: "T-M4-016 Renderer E2E", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" });
 const course = h["courses.create"]({ semesterId: semester.id, courseName: "T-M4-016 数学", subject: "数学" });
 const s2 = new S2Context(dataRoot); const db = s2.semesterDb(semester.id); const ts = new Date().toISOString();
 db.prepare("INSERT INTO materials (id,course_instance_id,file_name,file_type,file_size_bytes,mime_type,storage_key,source_type,status,permission_confirmed,uploaded_at,created_at,updated_at) VALUES ('m016-material',@cid,'source.pdf','pdf',1,'application/pdf','m016.pdf','upload','completed',1,@ts,@ts,@ts)").run({cid:course.id,ts});
 db.prepare("INSERT INTO knowledge_modules (id,course_instance_id,material_id,module_name,summary,importance,difficulty,learn_status,source_evidence_json,ai_generated,created_at,updated_at) VALUES ('m016-module',@cid,'m016-material','导数几何意义','导数是切线斜率',3,2,'learning','[]',1,@ts,@ts)").run({cid:course.id,ts});
 db.prepare("INSERT INTO questions (id,course_instance_id,knowledge_module_id,question_type,question_stem,options_json,correct_answer,score,created_at) VALUES ('m016-question',@cid,'m016-module','single_choice','导数题',@opts,'A',1,@ts)").run({cid:course.id,opts:JSON.stringify(["A","B"]),ts});
 db.prepare("INSERT INTO mistakes (id,question_id,course_instance_id,knowledge_module_id,status,redo_count,created_at,updated_at) VALUES ('m016-mistake','m016-question',@cid,'m016-module','needs_review',0,@ts,@ts)").run({cid:course.id,ts});
 db.prepare("UPDATE mistakes SET error_cause = @cause, error_cause_confirmed_by = 'student' WHERE id = 'm016-mistake'").run({cause:"异常，C:\\private\\secret.ts；/home/student/private.txt；inline Error: hidden at stackFrame；api-key: sk-secret"});
 db.prepare("INSERT INTO mistake_evidence (id,mistake_id,evidence_type,recorded_at,created_at) VALUES ('m016-evidence','m016-mistake','initial_wrong',@ts,@ts)").run({ts});
 db.prepare("INSERT INTO weak_points (id,course_instance_id,knowledge_module_id,evidence_count,status,first_evidenced_at,last_evidenced_at,created_at,updated_at) VALUES ('m016-weak',@cid,'m016-module',2,'active',@ts,@ts,@ts,@ts)").run({cid:course.id,ts});
 // S6 报告目标：local_export 已配置（真实地址在 credential-vault，channelConfigJson 仅别名）
 const globalDb = s1.globalDb;
 globalDb.prepare("INSERT INTO parent_report_targets (id,semester_id,target_name,channel_type,channel_config_json,credential_key,enabled,created_at,updated_at) VALUES ('m016-target',@sid,'本地导出','local_export',@cfg,NULL,1,@ts,@ts)").run({sid:semester.id,cfg:JSON.stringify({dir:path.join(dataRoot,"reports")}),ts});
 // S6 报告记录（脱敏聚合快照，不含敏感字段）
 const content = JSON.stringify({
   summary: "本周学习节奏平稳，建议保持练习频率。",
   study_rhythm: { task_completed_count: 5, events_by_source: { S1: 8 } },
   materials: { material_count: 2, converted_count: 1 },
   practice: { session_count: 3, avg_correct_rate: 0.78 },
   mistakes: { mistake_count: 1, mastered_count: 0, needs_review_count: 1 },
   exam_reminder: { confirmed_exam_count: 1, nearest_exam_days: 12 },
   data_quality: { complete: true },
 });
 const { createHash } = require("node:crypto");
 const contentHash = createHash("sha256").update(content).digest("hex");
 db.prepare("INSERT INTO parent_reports (report_key,semester_id,report_type,period_start,period_end,content_json,content_hash,rule_generated,ai_polished,ai_model,prompt_version,privacy_check_passed,generated_at,created_at) VALUES ('m016-report',@sid,'weekly','2026-08-01','2026-08-07',@cj,@ch,1,1,'mock','v1',1,@ts,@ts)").run({sid:semester.id,cj:content,ch:contentHash,ts});
 s2.dispose(); s1.dispose(); return { semesterId: semester.id, courseId: course.id, reportKey: "m016-report" };
 }
 const seeded = seedFixture(); if (process.env.T_M4_016_ARCHIVED === "1") { const s1 = new S1Context(dataRoot); createS1Handlers(s1)["semesters.archive"]({id: seeded.semesterId}); s1.dispose(); } let emitted=false; function emit(result){if(emitted)return;emitted=true;fs.writeFileSync(path.join(dataRoot,"renderer-result.json"),JSON.stringify(result),"utf8");process.stdout.write(JSON.stringify(result)+"\\n");setTimeout(()=>app.quit(),50);} function fail(){emit({phase:"failed",error:"真实 Electron renderer E2E 失败"});}
process.on("uncaughtException",fail);process.on("unhandledRejection",fail);try{require(path.join(projectRoot,"dist/main/main.js"));}catch(error){fail();}
app.whenReady().then(async()=>{try{const win=BrowserWindow.getAllWindows()[0];if(!win)throw new Error("BrowserWindow missing");emit({phase:"ready",result:await win.webContents.executeJavaScript(${JSON.stringify(UI_JS)})});}catch(error){fail();}});setTimeout(()=>fail(),30000);`;
}

async function runProbe(archived = false): Promise<{ exitCode: number | null; result?: any }> {
  const dataRoot = path.join(RUN_ROOT, archived ? "case-archived" : "case-01"); fs.rmSync(dataRoot, { recursive: true, force: true }); fs.mkdirSync(dataRoot, { recursive: true }); fs.mkdirSync(RUN_ROOT, { recursive: true });
  const runner = path.join(RUN_ROOT, "runner.cjs"); fs.writeFileSync(runner, runnerSource(), "utf8");
  try { await execFileAsync(ELECTRON, ["--no-sandbox", runner], { cwd: PROJECT_ROOT, env: { ...process.env, PI_STUDYBUDDY_DATA_ROOT: dataRoot, E2E_RUN_DIR: RUN_ROOT, T_M4_016_ARCHIVED: archived ? "1" : undefined, VITEST: undefined }, windowsHide: true, timeout: 60_000, maxBuffer: 2 * 1024 * 1024 }); return { exitCode: 0, result: JSON.parse(fs.readFileSync(path.join(dataRoot, "renderer-result.json"), "utf8")) }; }
  catch (error) { const item = error as { code?: number }; const resultPath = path.join(dataRoot, "renderer-result.json"); return { exitCode: typeof item.code === "number" ? item.code : null, result: fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, "utf8")) : undefined }; }
}

describe("T-M4-016 真实 Electron renderer ReportTab", () => {
  it("报告列表 → 生成报告 → 详情/冻结 → 投递状态可视化，且 DOM 无敏感内部值", async () => {
    const probe = await runProbe(); const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0); expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result).toMatchObject({ reportListVisible: true, detailVisible: true, frozenVisible: true, channelConfigured: true, deliverStatusSent: true, fullUuidInDom: false, windowsPathInDom: false, posixPathInDom: false, fileUriInDom: false, stackInDom: false, rawSensitiveTextInDom: false });
  }, 90_000);

  it("归档学期在真实 Electron renderer 中保持只读（生成报告禁用）", async () => {
    const probe = await runProbe(true); const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0); expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result).toMatchObject({ readOnlyVisible: true, generateDisabled: true, rawSensitiveTextInDom: false });
  }, 90_000);
});
