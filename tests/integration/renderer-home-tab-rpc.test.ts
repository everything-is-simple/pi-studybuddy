/**
 * T-M4-010 RED：S1 首页必须通过现有 RPC 契约读取 dailyBrief、tasks、exams。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { AssessmentAttempt, DailyBrief, StudyTask } from "../../src/contract/types";
import { HomeTab } from "../../src/renderer/components/tabs/HomeTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function task(id: string, courseId: string, title: string): StudyTask {
  return {
    id, courseId, title, taskType: "review", status: "pending", priority: 3, sourceSystem: "S1",
    createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z",
  };
}

function brief(): DailyBrief {
  return { date: "2026-08-09", tasks: [], pendingItems: 1 };
}

function exam(id: string, courseId: string, examName: string): AssessmentAttempt {
  return {
    id, courseId, examName, examType: "midterm", scheduledDate: "2026-08-15", source: "student_input",
    confirmationStatus: "confirmed", createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z",
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

describe("T-M4-010 首页 RPC 数据流", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("按学术上下文分别调用 dailyBrief、tasks.list、exams.list", async () => {
    const calls: Array<[string, unknown]> = [];
    const rpc = createMockRpcClient({
      "tasks.dailyBrief": (params: unknown) => { calls.push(["tasks.dailyBrief", params]); return brief(); },
      "tasks.list": (params: unknown) => {
        calls.push(["tasks.list", params]);
        return [task("task-b", "course-b", "课程 B 任务")];
      },
      "exams.list": (params: unknown) => {
        calls.push(["exams.list", params]);
        return [exam("exam-b", "course-b", "课程 B 考试")];
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(HomeTab, {
      rpc, academicContext: { semesterId: "semester-b", courseId: "course-b" },
    })));
    await flush();

    expect(calls).toEqual([
      ["tasks.dailyBrief", { semesterId: "semester-b" }],
      ["tasks.list", { courseId: "course-b" }],
      ["exams.list", { courseId: "course-b" }],
    ]);
    expect(host.textContent).toContain("课程 B 任务");
    expect(host.textContent).toContain("课程 B 考试");
  });

  it("没有 courseId 时不调用任务和考试 RPC，并显示课程选择提示", async () => {
    let taskCalls = 0;
    let examCalls = 0;
    const rpc = createMockRpcClient({
      "tasks.dailyBrief": () => brief(),
      "tasks.list": () => { taskCalls += 1; return []; },
      "exams.list": () => { examCalls += 1; return []; },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(HomeTab, {
      rpc, academicContext: { semesterId: "semester-b" },
    })));
    await flush();

    expect(taskCalls).toBe(0);
    expect(examCalls).toBe(0);
    expect(host.textContent).toContain("请先选择课程");
  });

  it("课程切换时旧任务和考试响应不能覆盖新课程", async () => {
    const taskA = deferred<StudyTask[]>();
    const taskB = deferred<StudyTask[]>();
    const examA = deferred<AssessmentAttempt[]>();
    const examB = deferred<AssessmentAttempt[]>();
    const rpc = createMockRpcClient({
      "tasks.dailyBrief": () => brief(),
      "tasks.list": (params: unknown) => (params as { courseId: string }).courseId === "course-a" ? taskA.promise : taskB.promise,
      "exams.list": (params: unknown) => (params as { courseId: string }).courseId === "course-a" ? examA.promise : examB.promise,
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(HomeTab, {
      rpc, academicContext: { semesterId: "semester-b", courseId: "course-a" },
    })));
    await flush();
    await act(async () => root?.render(React.createElement(HomeTab, {
      rpc, academicContext: { semesterId: "semester-b", courseId: "course-b" },
    })));
    await flush();

    taskB.resolve([task("task-b", "course-b", "课程 B 任务")]);
    examB.resolve([exam("exam-b", "course-b", "课程 B 考试")]);
    await flush();
    expect(host.textContent).toContain("课程 B 任务");
    expect(host.textContent).toContain("课程 B 考试");

    taskA.resolve([task("task-a", "course-a", "课程 A 任务")]);
    examA.resolve([exam("exam-a", "course-a", "课程 A 考试")]);
    await flush();
    expect(host.textContent).not.toContain("课程 A 任务");
    expect(host.textContent).not.toContain("课程 A 考试");
  });

  it("单个任务 RPC 失败时保留简报和考试内容并显示固定错误", async () => {
    const rpc = createMockRpcClient({
      "tasks.dailyBrief": () => brief(),
      "tasks.list": () => Promise.reject(new Error("internal path leaked")),
      "exams.list": () => [exam("exam-b", "course-b", "课程 B 考试")],
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(HomeTab, {
      rpc, academicContext: { semesterId: "semester-b", courseId: "course-b" },
    })));
    await flush();

    expect(host.textContent).toContain("每日学习简报");
    expect(host.textContent).toContain("课程 B 考试");
    expect(host.textContent).toContain("暂时无法加载任务，请稍后重试。");
    expect(host.textContent).not.toContain("internal path leaked");
  });
});
