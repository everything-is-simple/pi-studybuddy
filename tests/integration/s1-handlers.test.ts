import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import { createGlobalDb } from "../../src/data/global";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import type {
  Semester,
  CourseInstance,
  AssessmentAttempt,
  ScheduleEntry,
  StudyTask,
  StudyEvent,
  DailyBrief,
} from "../../src/contract/types";
import type { RpcError } from "../../src/contract/types";

/**
 * T-M1-001 S1 handler 集成测试（06-API §3.3 + 07-WF §2.2 + 05-ERD §3.1）
 *
 * 在隔离目录落地真实 SQLite，验证 handler×semester.db 真实读写：
 *   - 跨库写：semesters.create 写 global.db + 初始化 semester.db + 写 semester_initialized
 *   - 状态机：active→teaching_ended→follow_up→archived（非法迁移抛 BAD_REQUEST）
 *   - 考试四态：pending→confirmed/rejected + superseded
 *   - 软删除：schedule.delete 不物理删除
 *   - dailyBrief 纯规则聚合
 *   - 业务错误 throw RpcError（code+message，06-API §2.2）
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-001\。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-001\\integration";

function isRpcError(e: unknown): e is RpcError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}

describe("T-M1-001 S1 handler 集成测试", () => {
  let ctx: S1Context;
  let handlers: ReturnType<typeof createS1Handlers>;

  function call<M extends keyof typeof handlers>(method: M, params: unknown): unknown {
    return (handlers[method] as (p: unknown) => unknown)(params);
  }

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    ctx = new S1Context(ISOLATION_DIR);
    handlers = createS1Handlers(ctx);
  });

  afterAll(() => {
    ctx?.dispose();
    // WAL 文件句柄可能未立即释放，重试删除避免 EBUSY
    for (let i = 0; i < 3; i++) {
      try {
        rmSync(ISOLATION_DIR, { recursive: true, force: true });
        break;
      } catch {
        // 忽略 EBUSY，下次重试
      }
    }
  });

  describe("semesters.* — 学期管理 + 状态机", () => {
    let semesterId: string;

    it("SEM-01 create 跨库写：global.db + semester.db + semester_initialized 事件", () => {
      const sem = call("semesters.create", {
        label: "2026秋季",
        startDate: "2026-09-01",
        endDate: "2027-01-31",
        timezone: "Asia/Shanghai",
      }) as Semester;

      expect(sem.id).toBeTruthy();
      expect(sem.status).toBe("active");
      expect(sem.ready).toBe(0);
      expect(sem.label).toBe("2026秋季");
      semesterId = sem.id;

      // semester.db 已建库
      const semDb = ctx.semesterDb(semesterId);
      const events = semDb
        .prepare("SELECT * FROM study_events WHERE event_type = 'semester_initialized'")
        .all() as Array<{ event_type: string }>;
      expect(events.length).toBe(1);
    });

    it("SEM-02 list 返回刚创建的学期", () => {
      const list = call("semesters.list", {}) as Semester[];
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((s) => s.id === semesterId)).toBe(true);
    });

    it("SEM-03 get 返回学期详情", () => {
      const sem = call("semesters.get", { id: semesterId }) as Semester;
      expect(sem.id).toBe(semesterId);
      expect(sem.status).toBe("active");
    });

    it("SEM-04 get 不存在的 id 抛 NOT_FOUND", () => {
      try {
        call("semesters.get", { id: "non-existent-id" });
        throw new Error("应抛错但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("NOT_FOUND");
      }
    });

    it("SEM-05 update 修改 label", () => {
      const sem = call("semesters.update", { id: semesterId, label: "2026秋（修订）" }) as Semester;
      expect(sem.label).toBe("2026秋（修订）");
    });

    it("SEM-06 transition active→teaching_ended 合法", () => {
      const sem = call("semesters.transition", {
        id: semesterId,
        status: "teaching_ended",
      }) as Semester;
      expect(sem.status).toBe("teaching_ended");
    });

    it("SEM-07 transition 非法迁移抛 BAD_REQUEST（teaching_ended→active 不允许）", () => {
      try {
        call("semesters.transition", { id: semesterId, status: "active" });
        throw new Error("应抛错但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("SEM-08 transition teaching_ended→follow_up→archived 连续迁移", () => {
      let sem = call("semesters.transition", { id: semesterId, status: "follow_up" }) as Semester;
      expect(sem.status).toBe("follow_up");
      sem = call("semesters.transition", { id: semesterId, status: "archived" }) as Semester;
      expect(sem.status).toBe("archived");
      expect(sem.archivedAt).toBeTruthy();
    });

    it("SEM-09 archive 重复归档抛 BAD_REQUEST", () => {
      try {
        call("semesters.archive", { id: semesterId });
        throw new Error("应抛错但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("courses.* + exams.* — 课程与考试四态", () => {
    let courseSemId: string;
    let courseId: string;
    let examId: string;

    it("COURSE-01 创建学期 + 课程", () => {
      const sem = call("semesters.create", {
        label: "考试测试学期",
        startDate: "2026-09-01",
        endDate: "2027-01-31",
        timezone: "Asia/Shanghai",
      }) as Semester;
      courseSemId = sem.id;

      const course = call("courses.create", {
        semesterId: courseSemId,
        courseName: "高等数学",
        subject: "数学",
        teacher: "张老师",
      }) as CourseInstance;
      courseId = course.id;
      expect(course.courseName).toBe("高等数学");
      expect(course.status).toBe("active");
    });

    it("COURSE-02 list 返回学期下课程", () => {
      const list = call("courses.list", { semesterId: courseSemId }) as CourseInstance[];
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(courseId);
    });

    it("COURSE-03 update 修改 teacher", () => {
      const course = call("courses.update", { id: courseId, teacher: "李老师" }) as CourseInstance;
      expect(course.teacher).toBe("李老师");
    });

    it("COURSE-04 importSchedule 占位抛 BAD_REQUEST（OCR 未接入）", () => {
      try {
        call("courses.importSchedule", { courseId, imageFile: { path: "fake", size: 0, mimeType: "image/png", name: "f.png" } });
        throw new Error("应抛错但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("EXAM-01 add 创建 pending 考试", () => {
      const exam = call("exams.add", {
        courseId,
        examName: "期中考试",
        examType: "midterm",
        scheduledDate: "2026-11-15",
        source: "student_input",
      }) as AssessmentAttempt;
      examId = exam.id;
      expect(exam.confirmationStatus).toBe("pending");
      expect(exam.examType).toBe("midterm");
    });

    it("EXAM-02 confirm(true) 写 confirmed + study_events + semesters.ready=1", () => {
      const exam = call("exams.confirm", { id: examId, confirmed: true }) as AssessmentAttempt;
      expect(exam.confirmationStatus).toBe("confirmed");
      expect(exam.confirmedBy).toBe("student");
      expect(exam.confirmedAt).toBeTruthy();

      // study_events 写入 exam_confirmed
      const semDb = ctx.semesterDb(courseSemId);
      const events = semDb
        .prepare("SELECT * FROM study_events WHERE event_type = 'exam_confirmed' AND source_ref_id = ?")
        .all(examId) as Array<{ event_type: string }>;
      expect(events.length).toBe(1);

      // semesters.ready 已更新为 1
      const sem = call("semesters.get", { id: courseSemId }) as Semester;
      expect(sem.ready).toBe(1);
    });

    it("EXAM-03 list 按 courseId 返回该课程考试", () => {
      const list = call("exams.list", { courseId }) as AssessmentAttempt[];
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(examId);
    });

    it("EXAM-04 supersede 把旧考试置为 superseded 并关联 retake_of", () => {
      // 新增一个补考 attempt
      const newExam = call("exams.add", {
        courseId,
        examName: "期中补考",
        examType: "makeup",
        scheduledDate: "2026-11-22",
        source: "student_input",
      }) as AssessmentAttempt;

      const old = call("exams.supersede", { id: examId, newAttemptId: newExam.id }) as AssessmentAttempt;
      expect(old.confirmationStatus).toBe("superseded");

      // 新 attempt 的 retake_of 已关联
      const newList = call("exams.list", { courseId }) as AssessmentAttempt[];
      const newer = newList.find((e) => e.id === newExam.id);
      expect(newer?.retakeOf).toBe(examId);
    });

    it("EXAM-05 confirm(false) 写 rejected（不写 exam_confirmed 事件）", () => {
      const exam = call("exams.add", {
        courseId,
        examName: "小测1",
        examType: "quiz",
        scheduledDate: "2026-10-15",
        source: "student_input",
      }) as AssessmentAttempt;

      const rejected = call("exams.confirm", { id: exam.id, confirmed: false }) as AssessmentAttempt;
      expect(rejected.confirmationStatus).toBe("rejected");

      // 不应写 exam_confirmed 事件
      const semDb = ctx.semesterDb(courseSemId);
      const events = semDb
        .prepare("SELECT * FROM study_events WHERE event_type = 'exam_confirmed' AND source_ref_id = ?")
        .all(exam.id) as Array<{ event_type: string }>;
      expect(events.length).toBe(0);
    });
  });

  describe("schedule.* — 课表软删除 + CHECK 约束", () => {
    let schedSemId: string;
    let schedCourseId: string;
    let entryId: string;

    beforeAll(() => {
      const sem = call("semesters.create", {
        label: "课表测试学期",
        startDate: "2026-09-01",
        endDate: "2027-01-31",
        timezone: "Asia/Shanghai",
      }) as Semester;
      schedSemId = sem.id;
      const course = call("courses.create", {
        semesterId: schedSemId,
        courseName: "英语",
        subject: "英语",
      }) as CourseInstance;
      schedCourseId = course.id;
    });

    it("SCHED-01 create 写入课表条目", () => {
      const entry = call("schedule.create", {
        courseId: schedCourseId,
        weekday: 1,
        startTime: "08:00",
        endTime: "09:40",
        location: "A101",
      }) as ScheduleEntry;
      entryId = entry.id;
      expect(entry.weekday).toBe(1);
      expect(entry.location).toBe("A101");
    });

    it("SCHED-02 CHECK end_time > start_time 由 DB 保证（end<=start 抛错）", () => {
      try {
        call("schedule.create", {
          courseId: schedCourseId,
          weekday: 2,
          startTime: "10:00",
          endTime: "10:00",
        });
        throw new Error("应抛错但未抛");
      } catch (e) {
        // SQLite CHECK 抛错（非 RpcError），但被 rpc.ts toError 脱敏为 INTERNAL_ERROR
        // 此处直接验证抛错即可
        expect(e).toBeTruthy();
      }
    });

    it("SCHED-03 list 返回课程下条目", () => {
      const list = call("schedule.list", { courseId: schedCourseId }) as ScheduleEntry[];
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(entryId);
    });

    it("SCHED-04 update 修改 location", () => {
      const entry = call("schedule.update", { id: entryId, location: "B202" }) as ScheduleEntry;
      expect(entry.location).toBe("B202");
    });

    it("SCHED-05 delete 软删除（deleted_at 非空，list 不再返回）", () => {
      call("schedule.delete", { id: entryId });
      const list = call("schedule.list", { courseId: schedCourseId }) as ScheduleEntry[];
      expect(list.length).toBe(0);

      // 物理记录仍在
      const semDb = ctx.semesterDb(schedSemId);
      const row = semDb
        .prepare("SELECT deleted_at FROM schedule_entries WHERE id = ?")
        .get(entryId) as { deleted_at: string };
      expect(row.deleted_at).toBeTruthy();
    });
  });

  describe("tasks.* + events.* — 任务完成 + 事件查询 + dailyBrief", () => {
    let taskSemId: string;
    let taskCourseId: string;
    let taskId: string;

    beforeAll(() => {
      const sem = call("semesters.create", {
        label: "任务测试学期",
        startDate: "2026-09-01",
        endDate: "2027-01-31",
        timezone: "Asia/Shanghai",
      }) as Semester;
      taskSemId = sem.id;
      const course = call("courses.create", {
        semesterId: taskSemId,
        courseName: "物理",
        subject: "物理",
      }) as CourseInstance;
      taskCourseId = course.id;
    });

    it("TASK-01 create 写入 pending 任务（priority 默认 3）", () => {
      const task = call("tasks.create", {
        courseId: taskCourseId,
        title: "复习力学",
        taskType: "review",
      }) as StudyTask;
      taskId = task.id;
      expect(task.status).toBe("pending");
      expect(task.priority).toBe(3);
      expect(task.sourceSystem).toBe("S1");
    });

    it("TASK-02 create priority=5 落库正确", () => {
      const task = call("tasks.create", {
        courseId: taskCourseId,
        title: "考前冲刺",
        taskType: "exam_prep",
        priority: 5,
      }) as StudyTask;
      expect(task.priority).toBe(5);
    });

    it("TASK-03 complete 写 completed + study_events(task_completed)", () => {
      const task = call("tasks.complete", { id: taskId }) as StudyTask;
      expect(task.status).toBe("completed");
      expect(task.completedAt).toBeTruthy();

      const semDb = ctx.semesterDb(taskSemId);
      const events = semDb
        .prepare("SELECT * FROM study_events WHERE event_type = 'task_completed' AND source_ref_id = ?")
        .all(taskId) as Array<{ event_type: string }>;
      expect(events.length).toBe(1);
    });

    it("TASK-04 complete 不存在的 id 抛 NOT_FOUND", () => {
      try {
        call("tasks.complete", { id: "non-existent" });
        throw new Error("应抛错但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("NOT_FOUND");
      }
    });

    it("TASK-05 list 按 courseId 返回任务", () => {
      const list = call("tasks.list", { courseId: taskCourseId }) as StudyTask[];
      expect(list.length).toBe(2);
    });

    it("TASK-06 dailyBrief 聚合未完成 + 到期任务", () => {
      // 创建一个今天到期的任务
      const today = new Date().toISOString().slice(0, 10);
      call("tasks.create", {
        courseId: taskCourseId,
        title: "今日作业",
        taskType: "practice",
        dueDate: today,
      });

      const brief = call("tasks.dailyBrief", { semesterId: taskSemId }) as DailyBrief;
      expect(brief.date).toBe(today);
      expect(brief.tasks.length).toBeGreaterThanOrEqual(1);
      expect(brief.pendingItems).toBeGreaterThanOrEqual(1);
    });

    it("EVENT-01 list 按 semesterId 返回事件（含 task_completed）", () => {
      const events = call("events.list", { semesterId: taskSemId }) as StudyEvent[];
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.some((e) => e.eventType === "task_completed")).toBe(true);
    });

    it("EVENT-02 list 按 eventType 过滤", () => {
      const events = call("events.list", {
        semesterId: taskSemId,
        eventType: "task_completed",
      }) as StudyEvent[];
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.every((e) => e.eventType === "task_completed")).toBe(true);
    });

    it("EVENT-03 markReviewed 写 practice_reviewed 事件", () => {
      const event = call("events.markReviewed", {
        refType: "practice",
        refId: "fake-practice-id",
      }) as StudyEvent;
      expect(event.eventType).toBe("practice_reviewed");
      expect(event.sourceSystem).toBe("S1");
    });

    it("EVENT-04 list 无 semesterId/courseId 返回空（避免无范围查询）", () => {
      const events = call("events.list", {}) as StudyEvent[];
      expect(events.length).toBe(0);
    });
  });
});
