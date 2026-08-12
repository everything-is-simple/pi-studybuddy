/** T-M5-002 RED：归档学期必须在 S1 host 层拒绝新写入，不能只靠 renderer 禁用。 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import { initializeDataRoot } from "../../src/main/data-root-init";

const RUN_PARENT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-002\\s1-archive-boundary";

describe("T-M5-002 S1 归档学期 host 写入边界", () => {
  let context: S1Context | undefined;
  afterEach(() => { context?.dispose(); context = undefined; });

  it("归档后拒绝课程、考试、课表和任务新建", () => {
    fs.mkdirSync(RUN_PARENT, { recursive: true });
    const root = fs.mkdtempSync(path.join(RUN_PARENT, "case-"));
    initializeDataRoot(root);
    context = new S1Context(root);
    const handlers = createS1Handlers(context);
    const semester = handlers["semesters.create"]({ label: "归档边界", startDate: "2026-09-01", endDate: "2027-01-20", timezone: "Asia/Shanghai" });
    const course = handlers["courses.create"]({ semesterId: semester.id, courseName: "数学", subject: "数学" });
    handlers["semesters.archive"]({ id: semester.id });

    expect(() => handlers["courses.create"]({ semesterId: semester.id, courseName: "英语", subject: "英语" })).toThrow("学期已归档");
    expect(() => handlers["exams.add"]({ courseId: course.id, examName: "期末", examType: "final", scheduledDate: "2027-01-10", source: "student_input" })).toThrow("学期已归档");
    expect(() => handlers["schedule.create"]({ courseId: course.id, weekday: 1, startTime: "08:00", endTime: "09:00" })).toThrow("学期已归档");
    expect(() => handlers["tasks.create"]({ courseId: course.id, title: "复习", taskType: "review" })).toThrow("学期已归档");
  });
});
