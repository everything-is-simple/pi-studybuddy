/**
 * T-M4-007 RED：学期/课程树纯状态和安全展示测试。
 *
 * 权威依据：09-UI §3.1/§3.2、06-API §3.3、用户 T-M4-007 验收清单。
 * 本文件在 GREEN 前故意引用尚未实现的模块，用于固定先测后写的证据。
 */
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CourseInstance, Semester } from "../../src/contract/types";
import {
  applyCourseLoadResult,
  createInitialSemesterCourseState,
  deriveAcademicContext,
  formatAcademicTitle,
  safeAcademicDisplayText,
  isAcademicWriteBlocked,
  semesterCourseReducer,
  SemesterCourseRequestGate,
} from "../../src/renderer/semester-course-state";
import { SemesterCourseTree } from "../../src/renderer/components/SemesterCourseTree";

const semesters: Semester[] = [
  {
    id: "semester-uuid-should-not-render",
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
  },
  {
    id: "semester-archived-id",
    studentName: "测试学生",
    label: "2026 春",
    startDate: "2026-02-20",
    endDate: "2026-07-05",
    timezone: "Asia/Shanghai",
    status: "archived",
    dbRelativePath: "semesters/2026-spring.db",
    ready: 1,
    archivedAt: "2026-07-06T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
  },
];

const courses: CourseInstance[] = [
  {
    id: "course-uuid-should-not-render",
    semesterId: semesters[0]!.id,
    courseName: "高等数学",
    subject: "数学",
    status: "active",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
  },
];

describe("学期/课程导航状态（T-M4-007）", () => {
  it("选择学期会展开树、清空旧课程上下文；选择课程后标题动态绑定", () => {
    let state = createInitialSemesterCourseState();
    state = semesterCourseReducer(state, { type: "toggleSemester", semesterId: semesters[0]!.id });
    expect(state.expandedSemesterIds).toEqual([semesters[0]!.id]);
    expect(state.context).toEqual({ semesterId: semesters[0]!.id, courseId: undefined });

    state = semesterCourseReducer(state, {
      type: "selectCourse",
      semesterId: semesters[0]!.id,
      courseId: courses[0]!.id,
    });
    expect(state.context).toEqual({ semesterId: semesters[0]!.id, courseId: courses[0]!.id });
    expect(formatAcademicTitle(state.context, semesters, { [semesters[0]!.id]: courses })).toBe("2026 秋 / 高等数学");
  });

  it("从唯一选择上下文派生归档只读标识，供工作台统一拦截写操作", () => {
    const archivedContext = deriveAcademicContext(
      { semesterId: semesters[1]!.id, courseId: "course-archived" },
      semesters,
    );
    const activeContext = deriveAcademicContext(
      { semesterId: semesters[0]!.id, courseId: courses[0]!.id },
      semesters,
    );

    expect(archivedContext).toEqual({
      semesterId: semesters[1]!.id,
      courseId: "course-archived",
      isReadOnly: true,
    });
    expect(isAcademicWriteBlocked(archivedContext)).toBe(true);
    expect(activeContext.isReadOnly).toBe(false);
    expect(isAcademicWriteBlocked(activeContext)).toBe(false);
  });

  it("再次点击学期只收起，不会清空当前课程上下文", () => {
    let state = createInitialSemesterCourseState();
    state = semesterCourseReducer(state, { type: "toggleSemester", semesterId: semesters[0]!.id });
    state = semesterCourseReducer(state, {
      type: "selectCourse",
      semesterId: semesters[0]!.id,
      courseId: courses[0]!.id,
    });
    state = semesterCourseReducer(state, { type: "toggleSemester", semesterId: semesters[0]!.id });

    expect(state.expandedSemesterIds).toEqual([]);
    expect(state.context).toEqual({ semesterId: semesters[0]!.id, courseId: courses[0]!.id });
  });

  it("请求门闩按学期隔离：不同展开分支都可完成，同一学期旧响应会被丢弃", () => {
    const gate = new SemesterCourseRequestGate();
    const firstForFall = gate.begin(semesters[0]!.id);
    const onlyForSpring = gate.begin(semesters[1]!.id);
    const latestForFall = gate.begin(semesters[0]!.id);

    expect(gate.isCurrent(firstForFall)).toBe(false);
    expect(gate.isCurrent(onlyForSpring)).toBe(true);
    expect(gate.isCurrent(latestForFall)).toBe(true);

    // 春季请求先完成：它不能因秋季的后续请求而被错误丢弃。
    const afterSpring = applyCourseLoadResult({}, gate, onlyForSpring, { status: "ready", courses: [] });
    // 秋季旧响应后完成：它不应覆盖秋季的最新 loading/ready 状态。
    const afterStaleFall = applyCourseLoadResult(afterSpring, gate, firstForFall, { status: "error", courses: [] });
    const afterLatestFall = applyCourseLoadResult(afterStaleFall, gate, latestForFall, { status: "ready", courses });
    expect(afterStaleFall).toBe(afterSpring);
    expect(afterLatestFall).toEqual({
      [semesters[1]!.id]: { status: "ready", courses: [] },
      [semesters[0]!.id]: { status: "ready", courses },
    });

    gate.invalidate();
    expect(gate.isCurrent(onlyForSpring)).toBe(false);
    expect(gate.isCurrent(latestForFall)).toBe(false);
    // 模拟组件卸载：失效令牌的晚到结果不可改变已有课程状态。
    expect(applyCourseLoadResult(afterLatestFall, gate, latestForFall, { status: "error", courses: [] })).toBe(afterLatestFall);
  });

  it("异常名称会回退为固定中文，避免 UUID、路径、Bearer 和调用栈痕迹进入 UI", () => {
    expect(safeAcademicDisplayText("018f0f8a-6218-7c8f-b9d6-3ed2f2b7f901", "未命名学期")).toBe("未命名学期");
    expect(safeAcademicDisplayText("Bearer: TOKEN_SHOULD_NOT_RENDER", "未命名学期")).toBe("未命名学期");
    expect(safeAcademicDisplayText("错误：C:\\private\\semester.db", "未命名学期")).toBe("未命名学期");
    expect(safeAcademicDisplayText("file:///C:/private/semester.db", "未命名学期")).toBe("未命名学期");
    expect(safeAcademicDisplayText("TypeError: bad\n    at loadCourse (AppShell.tsx:1:1)", "未命名学期")).toBe("未命名学期");
    expect(safeAcademicDisplayText(String.raw`读取失败：\\SERVER\private\semester.db`, "未命名学期")).toBe("未命名学期");
    expect(safeAcademicDisplayText("读取失败：/private/semester.db", "未命名学期")).toBe("未命名学期");
  });
});

describe("SemesterCourseTree（T-M4-007）", () => {
  it("渲染状态标识、课程、归档只读、空和安全错误信息，且不泄漏内部 ID 或路径", () => {
    const html = renderToStaticMarkup(
      React.createElement(SemesterCourseTree, {
        semesters,
        semesterLoadState: "ready",
        expandedSemesterIds: [semesters[0]!.id, semesters[1]!.id],
        courseStates: {
          [semesters[0]!.id]: { status: "ready", courses },
          [semesters[1]!.id]: {
            status: "ready",
            courses: [
              { ...courses[0]!, id: "course-archived", semesterId: semesters[1]!.id, courseName: "线性代数" },
            ],
          },
        },
        context: { semesterId: semesters[0]!.id, courseId: courses[0]!.id },
        onToggleSemester: () => {},
        onSelectCourse: () => {},
      }),
    );

    expect(html).toContain("2026 秋");
    expect(html).toContain("高等数学");
    expect(html).toContain("进行中");
    expect(html).toContain("已归档（只读）");
    expect(html).toContain("归档学期，只读浏览");
    expect(html).toContain('aria-label="2026 春的课程（已归档，只读浏览）"');
    expect(html).toContain("background:#98a2b3");
    expect(html).not.toContain("semester-uuid-should-not-render");
    expect(html).not.toContain("course-uuid-should-not-render");
    expect(html).not.toContain("semesters/2026-fall.db");
  });
});
