/**
 * T-M4-015：真实 Electron renderer → preload → TCP/RPC → agent-host → S5 handler → renderer E2E。
 * 覆盖：已确认考试门控、模拟卷生成/作答/提交/结果、速背卡只读翻页、冲刺计划展示、归档只读、隐私断言。
 * 运行产物仅落入 H:\pi-studybuddy-tmp\runs\T-M4-015\。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-015\\e2e-renderer";
const ELECTRON = path.join(PROJECT_ROOT, "node_modules/electron/dist/electron.exe");

const UI_JS = `(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, message) => { const deadline = Date.now() + 15000; while (Date.now() < deadline) { const value = predicate(); if (value) return value; await wait(100); } throw new Error(message); };
  const button = (text) => Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes(text));
  const click = async (text) => { const item = await waitFor(() => button(text), "button missing: " + text); item.click(); await wait(250); };
  const selectByName = async (name, value) => { const item = await waitFor(() => document.querySelector('select[name="' + name + '"]'), "select missing: " + name); item.value = value; item.dispatchEvent(new Event("change", { bubbles: true })); await wait(250); };
  const selectByText = async (name, text) => { const item = await waitFor(() => document.querySelector('select[name="' + name + '"]'), "select missing: " + name); const option = Array.from(item.options).find((o) => o.textContent === text); if (!option) throw new Error("option missing: " + text); item.value = option.value; item.dispatchEvent(new Event("change", { bubbles: true })); await wait(250); };
  await click("T-M4-015 Renderer E2E");
  await click("T-M4-015 数学");
  await click("冲刺");
  await waitFor(() => document.querySelector('select[name="cram-assessment"]'), "cram assessment select missing");
  const before = document.body.textContent || "";
  const readOnly = before.includes("当前学期已归档");
  if (readOnly) {
    await selectByText("cram-assessment", "期中考试");
    await click("模拟考");
    await wait(300);
    const result = document.body.textContent || "";
    const generateButton = Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes("生成试卷"));
    return {
      readOnlyVisible: true,
      generateDisabled: Boolean(generateButton?.disabled),
      rawSensitiveTextInDom: /secret\.ts|stackFrame|sk-secret/i.test(result),
    };
  }
  await selectByText("cram-assessment", "期中考试");
  await waitFor(() => document.body.textContent?.includes("速背卡"), "speed cards missing");
  const cardsBefore = document.body.textContent || "";
  await click("下一张");
  await wait(300);
  const cardsAfter = document.body.textContent || "";
  await click("模拟考");
  await wait(300);
  await click("生成试卷");
  await waitFor(() => document.body.textContent?.includes("开始考试"), "generate paper failed");
  await click("开始考试");
  await waitFor(() => document.querySelector('input[name="mock-question-0"]'), "mock question radio missing");
  const radio = document.querySelector('input[name="mock-question-0"]');
  radio.click();
  await click("提交");
  await waitFor(() => document.body.textContent?.includes("模拟考结果"), "mock exam result missing");
  const mockResult = document.body.textContent || "";
  await click("冲刺计划");
  await waitFor(() => document.body.textContent?.includes("复习模块"), "cram plan missing");
  const planVisible = document.body.textContent || "";
  return {
    examSelected: cardsBefore.includes("已确认 ✅"),
    cardsVisible: cardsBefore.includes("卡片 1/"),
    importanceVisible: cardsBefore.includes("★"),
    cardFlipped: cardsAfter.includes("卡片 2/") || !cardsAfter.includes("卡片 1/"),
    mockResultVisible: mockResult.includes("模拟考结果") && mockResult.includes("正确率"),
    moduleAnalysisVisible: mockResult.includes("模块分析") && mockResult.includes("%") && (mockResult.includes("强（") || mockResult.includes("中（") || mockResult.includes("弱（")),
    planVisible: planVisible.includes("复习模块") && planVisible.includes("练习数量"),
    fullUuidInDom: /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/i.test(planVisible),
    windowsPathInDom: /\\b[a-z]:[\\\\/][^\\s]*/i.test(planVisible),
    posixPathInDom: /\\/(?:[^\\s/]+\\/)+[^\\s/]+/.test(planVisible),
    fileUriInDom: /\\bfile:(?:\\/{1,3})?/i.test(planVisible),
    stackInDom: /(?:^|\\n)\\s*(?:[A-Za-z]*Error|Exception)\\s*:/m.test(planVisible) || /(?:^|\\n)\\s*at\\s+\\S+/m.test(planVisible),
    rawSensitiveTextInDom: /secret\\.ts|stackFrame|sk-secret/i.test(planVisible),
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
 const semester = h["semesters.create"]({ label: "T-M4-015 Renderer E2E", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" });
 const course = h["courses.create"]({ semesterId: semester.id, courseName: "T-M4-015 数学", subject: "数学" });
 const exam = h["exams.add"]({ courseId: course.id, examName: "期中考试", examType: "midterm", scheduledDate: "2026-08-19", source: "student_input", confidence: 0.9 });
 h["exams.confirm"]({ id: exam.id, confirmed: true });
 h["exams.add"]({ courseId: course.id, examName: "待确认考试", examType: "final", scheduledDate: "2026-09-10", source: "student_input" });
 const s2 = new S2Context(dataRoot); const db = s2.semesterDb(semester.id); const ts = new Date().toISOString();
 db.prepare("INSERT INTO materials (id,course_instance_id,file_name,file_type,file_size_bytes,mime_type,storage_key,source_type,status,permission_confirmed,uploaded_at,created_at,updated_at) VALUES ('m015-material',@cid,'source.pdf','pdf',1,'application/pdf','m015.pdf','upload','completed',1,@ts,@ts,@ts)").run({cid:course.id,ts});
 db.prepare("INSERT INTO knowledge_modules (id,course_instance_id,material_id,module_name,summary,importance,difficulty,learn_status,source_evidence_json,ai_generated,created_at,updated_at) VALUES ('m015-module',@cid,'m015-material','导数几何意义','导数是切线斜率',3,2,'learning','[]',1,@ts,@ts)").run({cid:course.id,ts});
 db.prepare("INSERT INTO knowledge_modules (id,course_instance_id,material_id,module_name,summary,importance,difficulty,learn_status,source_evidence_json,ai_generated,created_at,updated_at) VALUES ('m015-module-2',@cid,'m015-material','极限定义','epsilon-delta',5,3,'needs_review','[]',1,@ts,@ts)").run({cid:course.id,ts});
 db.prepare("INSERT INTO questions (id,course_instance_id,knowledge_module_id,question_type,question_stem,options_json,correct_answer,score,created_at) VALUES ('m015-question',@cid,'m015-module','single_choice','导数题',@opts,'A',1,@ts)").run({cid:course.id,opts:JSON.stringify(["A","B"]),ts});
 db.prepare("INSERT INTO mistakes (id,question_id,course_instance_id,knowledge_module_id,status,redo_count,created_at,updated_at) VALUES ('m015-mistake','m015-question',@cid,'m015-module','needs_review',0,@ts,@ts)").run({cid:course.id,ts});
 db.prepare("UPDATE mistakes SET error_cause = @cause, error_cause_confirmed_by = 'student' WHERE id = 'm015-mistake'").run({cause:"异常，C:\\private\\secret.ts；/home/student/private.txt；inline Error: hidden at stackFrame；api-key: sk-secret"});
 db.prepare("INSERT INTO mistake_evidence (id,mistake_id,evidence_type,recorded_at,created_at) VALUES ('m015-evidence','m015-mistake','initial_wrong',@ts,@ts)").run({ts});
 db.prepare("INSERT INTO weak_points (id,course_instance_id,knowledge_module_id,evidence_count,status,first_evidenced_at,last_evidenced_at,created_at,updated_at) VALUES ('m015-weak',@cid,'m015-module',2,'active',@ts,@ts,@ts,@ts)").run({cid:course.id,ts});
 db.prepare("INSERT INTO study_tasks (id,course_instance_id,title,description,task_type,due_date,priority,status,source_system,created_at,updated_at) VALUES ('m015-task',@cid,'导数专项复习','复习导数几何意义','review','2026-08-13',3,'pending','student_input',@ts,@ts)").run({cid:course.id,ts});
 s2.dispose(); s1.dispose(); return { semesterId: semester.id, courseId: course.id, assessmentAttemptId: exam.id };
 }
 const seeded = seedFixture(); if (process.env.T_M4_015_ARCHIVED === "1") { const s1 = new S1Context(dataRoot); createS1Handlers(s1)["semesters.archive"]({id: seeded.semesterId}); s1.dispose(); } let emitted=false; function emit(result){if(emitted)return;emitted=true;fs.writeFileSync(path.join(dataRoot,"renderer-result.json"),JSON.stringify(result),"utf8");process.stdout.write(JSON.stringify(result)+"\\n");setTimeout(()=>app.quit(),50);} function fail(){emit({phase:"failed",error:"真实 Electron renderer E2E 失败"});}
process.on("uncaughtException",fail);process.on("unhandledRejection",fail);try{require(path.join(projectRoot,"dist/main/main.js"));}catch(error){fail();}
app.whenReady().then(async()=>{try{const win=BrowserWindow.getAllWindows()[0];if(!win)throw new Error("BrowserWindow missing");emit({phase:"ready",result:await win.webContents.executeJavaScript(${JSON.stringify(UI_JS)})});}catch(error){fail();}});setTimeout(()=>fail(),30000);`;
}

async function runProbe(archived = false): Promise<{ exitCode: number | null; result?: any }> {
  const dataRoot = path.join(RUN_ROOT, archived ? "case-archived" : "case-01"); fs.rmSync(dataRoot, { recursive: true, force: true }); fs.mkdirSync(dataRoot, { recursive: true }); fs.mkdirSync(RUN_ROOT, { recursive: true });
  const runner = path.join(RUN_ROOT, "runner.cjs"); fs.writeFileSync(runner, runnerSource(), "utf8");
  try { await execFileAsync(ELECTRON, ["--no-sandbox", runner], { cwd: PROJECT_ROOT, env: { ...process.env, PI_STUDYBUDDY_DATA_ROOT: dataRoot, E2E_RUN_DIR: RUN_ROOT, T_M4_015_ARCHIVED: archived ? "1" : undefined, VITEST: undefined }, windowsHide: true, timeout: 60_000, maxBuffer: 2 * 1024 * 1024 }); return { exitCode: 0, result: JSON.parse(fs.readFileSync(path.join(dataRoot, "renderer-result.json"), "utf8")) }; }
  catch (error) { const item = error as { code?: number }; const resultPath = path.join(dataRoot, "renderer-result.json"); return { exitCode: typeof item.code === "number" ? item.code : null, result: fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, "utf8")) : undefined }; }
}

describe("T-M4-015 真实 Electron renderer CramTab", () => {
  it("已确认考试选择 → 速背卡翻页 → 模拟卷作答/结果 → 冲刺计划，且 DOM 无敏感内部值", async () => {
    const probe = await runProbe(); const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0); expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result).toMatchObject({ examSelected: true, cardsVisible: true, importanceVisible: true, cardFlipped: true, mockResultVisible: true, moduleAnalysisVisible: true, planVisible: true, fullUuidInDom: false, windowsPathInDom: false, posixPathInDom: false, fileUriInDom: false, stackInDom: false, rawSensitiveTextInDom: false });
  }, 90_000);

  it("归档学期在真实 Electron renderer 中保持只读（生成试卷禁用）", async () => {
    const probe = await runProbe(true); const evidence = JSON.stringify(probe, null, 2);
    expect(probe.exitCode, evidence).toBe(0); expect(probe.result?.phase, evidence).toBe("ready");
    expect(probe.result?.result).toMatchObject({ readOnlyVisible: true, generateDisabled: true, rawSensitiveTextInDom: false });
  }, 90_000);
});
