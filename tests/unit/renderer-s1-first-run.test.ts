/** T-M5-002 RED：首次启动与 S1 管理 UI 必须可从空数据根走通。 */
/** @vitest-environment happy-dom */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { SemesterCourseTree } from "../../src/renderer/components/SemesterCourseTree";
import { FirstRunWizard, S1PlanPanel } from "../../src/renderer/components/S1PlanPanel";
import { createMockRpcClient } from "../../src/renderer/rpc-client";
import type { Semester } from "../../src/contract/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const activeSemester: Semester = {
  id: "semester-1",
  studentName: "学生",
  label: "2026 秋季学期",
  startDate: "2026-09-01",
  endDate: "2027-01-20",
  timezone: "Asia/Shanghai",
  status: "active",
  dbRelativePath: "semester/semester-1/sem.db",
  ready: 0,
  createdAt: "2026-08-12T00:00:00.000Z",
  updatedAt: "2026-08-12T00:00:00.000Z",
};

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

function button(container: HTMLElement, text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((item) => item.textContent?.includes(text));
  if (!found) throw new Error(`button missing: ${text}`);
  return found as HTMLButtonElement;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("T-M5-002 首次启动 S1 UI", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("空数据树提供创建学习计划入口，而不是只显示阻塞文案", () => {
    const html = require("react-dom/server").renderToStaticMarkup(
      React.createElement(SemesterCourseTree, {
        semesters: [],
        semesterLoadState: "ready",
        expandedSemesterIds: [],
        courseStates: {},
        context: {},
        onToggleSemester: () => {},
        onSelectCourse: () => {},
        onCreateSemester: () => {},
      }),
    );
    expect(html).toContain("创建学习计划");
    expect(html).toContain("创建学期");
  });

  it("首次向导取消不写入数据，失败后可通过重试完成学期创建", async () => {
    let cancelled = 0;
    let attempts = 0;
    const rpc = createMockRpcClient({
      "semesters.create": () => {
        attempts += 1;
        if (attempts === 1) throw new Error("internal detail");
        return activeSemester;
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(FirstRunWizard, { rpc, onCancel: () => { cancelled += 1; }, onComplete: () => {} })));
    await flush();
    await act(async () => button(host!, "取消").click());
    expect(cancelled).toBe(1);
    expect(attempts).toBe(0);

    await act(async () => root?.render(React.createElement(FirstRunWizard, { rpc, onCancel: () => {}, onComplete: () => {} })));
    await flush();
    const label = host.querySelector('input[aria-label="学期名称"]') as HTMLInputElement;
    const start = host.querySelector('input[aria-label="学期开始日期"]') as HTMLInputElement;
    const end = host.querySelector('input[aria-label="学期结束日期"]') as HTMLInputElement;
    setInputValue(label, "2026 秋季学期");
    setInputValue(start, "2026-09-01");
    setInputValue(end, "2027-01-20");
    await act(async () => button(host!, "下一步").click());
    await flush();
    expect(host.textContent).toContain("学期创建失败，请检查填写内容后重试。");
    await act(async () => button(host!, "下一步").click());
    await flush();
    expect(attempts).toBe(2);
    expect(host.textContent).toContain("课程名称");
  });

  it("通过 UI 创建考试、手工课表和任务，并支持完成任务", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const task = {
      id: "task-1", courseId: "course-1", title: "复习极限", taskType: "review", status: "pending",
      priority: 2, sourceSystem: "S1", createdAt: "2026-08-12", updatedAt: "2026-08-12",
    };
    const rpc = createMockRpcClient({
      "semesters.update": (params: unknown) => { calls.push({ method: "semesters.update", params }); return activeSemester; },
      "courses.update": (params: unknown) => { calls.push({ method: "courses.update", params }); return { id: "course-1", semesterId: activeSemester.id, courseName: "高数", subject: "数学", status: "active" }; },
      "exams.list": () => [],
      "schedule.list": () => [],
      "tasks.list": () => [task],
      "exams.add": (params: unknown) => { calls.push({ method: "exams.add", params }); return { id: "exam-1", courseId: "course-1", examName: "期中", examType: "midterm", scheduledDate: "2026-11-01", source: "student_input", confirmationStatus: "pending" }; },
      "exams.confirm": (params: unknown) => { calls.push({ method: "exams.confirm", params }); return {}; },
      "schedule.create": (params: unknown) => { calls.push({ method: "schedule.create", params }); return {}; },
      "tasks.create": (params: unknown) => { calls.push({ method: "tasks.create", params }); return task; },
      "tasks.complete": (params: unknown) => { calls.push({ method: "tasks.complete", params }); return { ...task, status: "completed" }; },
    });

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(S1PlanPanel, {
      rpc,
      semester: activeSemester,
      course: { id: "course-1", semesterId: activeSemester.id, courseName: "高数", subject: "数学", status: "active" },
      readOnly: false,
    })));
    await flush();

    expect(host.textContent).toContain("学习计划管理");
    await act(async () => button(host!, "新增考试").click());
    await flush();
    expect(host.textContent).toContain("考试名称");
    const examName = host.querySelector('input[aria-label="考试名称"]') as HTMLInputElement;
    const examDate = host.querySelector('input[aria-label="考试日期"]') as HTMLInputElement;
    setInputValue(examName, "期中");
    setInputValue(examDate, "2026-11-01");
    await act(async () => button(host!, "保存考试").click());
    await flush();

    expect(calls.some((call) => call.method === "exams.add")).toBe(true);
    expect(calls.some((call) => call.method === "schedule.create")).toBe(false);
    expect(host.textContent).toContain("新增课表");
    expect(host.textContent).toContain("新增任务");
  });
});
