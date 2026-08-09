/**
 * T-M4-007 RED：使用记录型 TypedRpcClient 约束既有读取契约与竞态门闩。
 * 不新增 API；全部测试数据仅保存在进程内。
 */
import { describe, expect, it } from "vitest";
import type { CourseInstance, Semester } from "../../src/contract/types";
import { createMockRpcClient } from "../../src/renderer/rpc-client";
import { loadCoursesForSemester, loadSemesters } from "../../src/renderer/semester-course-state";

const semester: Semester = {
  id: "sem-1",
  studentName: "测试学生",
  label: "2026 秋",
  startDate: "2026-09-01",
  endDate: "2027-01-20",
  timezone: "Asia/Shanghai",
  status: "active",
  dbRelativePath: "semesters/2026-fall.db",
  ready: 1,
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:00:00.000Z",
};

const course: CourseInstance = {
  id: "course-1",
  semesterId: semester.id,
  courseName: "大学英语",
  subject: "英语",
  status: "active",
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:00:00.000Z",
};

describe("学期/课程读取契约（T-M4-007）", () => {
  it("只调用既有 semesters.list 与 courses.list，并向课程读取精确传入 semesterId", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "semesters.list": (params: unknown) => {
        calls.push({ method: "semesters.list", params });
        return [semester];
      },
      "courses.list": (params: unknown) => {
        calls.push({ method: "courses.list", params });
        return [course];
      },
    });

    await expect(loadSemesters(rpc)).resolves.toEqual([semester]);
    await expect(loadCoursesForSemester(rpc, semester.id)).resolves.toEqual([course]);
    expect(calls).toEqual([
      { method: "semesters.list", params: {} },
      { method: "courses.list", params: { semesterId: semester.id } },
    ]);
  });
});
