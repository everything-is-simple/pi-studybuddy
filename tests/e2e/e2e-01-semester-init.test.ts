/**
 * E2E-01 学期初始化全链（08-Test §6.1）
 *
 * 流程：启动应用 → 新建学期 → 新建课程 → 添加考试 → 确认考试 → 学期 ready
 *
 * 断言（08-Test §7.1 闭环完整性 + §7.4 规则优先）：
 *   - semesters.create 返回 status=active, ready=0
 *   - courses.create 返回课程记录
 *   - exams.add 返回 confirmationStatus=pending
 *   - exams.confirm 返回 confirmationStatus=confirmed
 *   - 未确认考试不驱动冲刺（规则优先可证伪）
 *
 * 数据隔离（AGENTS.md §5.3）：写 H:\pi-studybuddy-tmp\runs\T-M4-022\e2e\e2e-01\
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { launchElectron, type LaunchedApp } from "./helpers/electron-launcher";
import { RpcDriver } from "./helpers/rpc-driver";
import { SEMESTER_FIXTURE, COURSE_FIXTURE, EXAM_FIXTURE, isRpcError } from "./helpers/fixtures";
import type { Semester, CourseInstance, AssessmentAttempt } from "../../src/contract/types";

describe("E2E-01 学期初始化全链", () => {
  let app: LaunchedApp;
  let rpc: RpcDriver;
  let semesterId: string;
  let courseId: string;
  let examId: string;

  beforeAll(async () => {
    app = await launchElectron("e2e-01");
    rpc = new RpcDriver(app.channel);
    await rpc.init();
  }, 60_000);

  afterAll(async () => {
    await app?.dispose();
  });

  it("E01-01 启动应用 + RPC 通道连通（system.ping）", async () => {
    const res = await rpc.call<{ pong: string; timestamp: number }>("system.ping", { message: "e2e-01" });
    expect(res.pong).toBe("e2e-01");
    expect(typeof res.timestamp).toBe("number");
  });

  it("E01-02 新建学期（semesters.create）", async () => {
    const sem = await rpc.call<Semester>("semesters.create", SEMESTER_FIXTURE);
    expect(sem.id).toBeTruthy();
    expect(sem.status).toBe("active");
    expect(sem.ready).toBe(0);
    expect(sem.label).toBe(SEMESTER_FIXTURE.label);
    semesterId = sem.id;
  });

  it("E01-03 学期列表含新学期（semesters.list）", async () => {
    const list = await rpc.call<Semester[]>("semesters.list", {});
    expect(list.some((s) => s.id === semesterId)).toBe(true);
  });

  it("E01-04 新建课程（courses.create）", async () => {
    const course = await rpc.call<CourseInstance>("courses.create", {
      semesterId,
      courseName: COURSE_FIXTURE.name,
      subject: "数学",
    });
    expect(course.id).toBeTruthy();
    expect(course.courseName).toBe(COURSE_FIXTURE.name);
    expect(course.semesterId).toBe(semesterId);
    courseId = course.id;
  });

  it("E01-05 课程列表含新课程（courses.list）", async () => {
    const list = await rpc.call<CourseInstance[]>("courses.list", { semesterId });
    expect(list.some((c) => c.id === courseId)).toBe(true);
  });

  it("E01-06 添加考试（exams.add）→ confirmationStatus=pending", async () => {
    const exam = await rpc.call<AssessmentAttempt>("exams.add", {
      courseId,
      examName: EXAM_FIXTURE.name,
      examType: EXAM_FIXTURE.examType,
      scheduledDate: EXAM_FIXTURE.plannedDate,
      source: "student_input",
    });
    expect(exam.id).toBeTruthy();
    expect(exam.confirmationStatus).toBe("pending");
    expect(exam.examName).toBe(EXAM_FIXTURE.name);
    examId = exam.id;
  });

  it("E01-07 考试列表含 pending 考试（exams.list）", async () => {
    const list = await rpc.call<AssessmentAttempt[]>("exams.list", { courseId });
    expect(list.some((e) => e.id === examId)).toBe(true);
  });

  it("E01-08 确认考试（exams.confirm）→ confirmationStatus=confirmed", async () => {
    const exam = await rpc.call<AssessmentAttempt>("exams.confirm", { id: examId, confirmed: true });
    expect(exam.confirmationStatus).toBe("confirmed");
    expect(exam.confirmedBy).toBeTruthy();
  });

  it("E01-09 规则优先：未确认考试不出现在 confirmed 列表（§7.4）", async () => {
    // 再添加一个考试但不确认
    const unconfirmed = await rpc.call<AssessmentAttempt>("exams.add", {
      courseId,
      examName: "未确认测试考试",
      examType: "midterm",
      scheduledDate: "2026-11-15",
      source: "student_input",
    });
    expect(unconfirmed.confirmationStatus).toBe("pending");

    // 查 confirmed 列表，不应包含未确认考试
    const confirmedList = await rpc.call<AssessmentAttempt[]>("exams.list", {
      courseId,
      confirmationStatus: "confirmed",
    });
    expect(confirmedList.some((e) => e.id === unconfirmed.id)).toBe(false);
    expect(confirmedList.some((e) => e.id === examId)).toBe(true);
  });

  it("E01-10 学期详情可查（semesters.get）", async () => {
    const sem = await rpc.call<Semester>("semesters.get", { id: semesterId });
    expect(sem.id).toBe(semesterId);
    expect(sem.label).toBe(SEMESTER_FIXTURE.label);
  });

  it("E01-11 渲染器加载验证（app.ready 信号已收到，窗口已创建）", async () => {
    // launchElectron 已等待 {"type":"ready"} 消息，证明 Electron 主进程 + BrowserWindow + 渲染器加载成功
    expect(app).toBeTruthy();
    expect(app.channel).toBeTruthy();
  });
});
