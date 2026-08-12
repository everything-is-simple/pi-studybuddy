/**
 * T-M5-004 RED：首页（CTRL-HOME-01）任务完成动作、失败重试、考试查看语义。
 *
 * 权威依据：09-UI §4.3（首页每日学习简报）+ T-M5-004 prompt §4.1（首页残余动作：
 * 任务/考试条目真实进入/查看/完成或明确不可操作语义 + 加载失败重试）。
 *
 * 现状缺口（T-M5-001 G-P1-02/S1-02）：任务行仅展示 title/status，无完成动作；
 * 加载失败无重试按钮。
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

function task(id: string, courseId: string, title: string, status: StudyTask["status"] = "pending"): StudyTask {
  return {
    id, courseId, title, taskType: "review", status, priority: 3, sourceSystem: "S1",
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

describe("T-M5-004 CTRL-HOME-01 首页动作与失败重试", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("RED 1: pending 任务行渲染「完成」按钮，点击调用 tasks.complete({id})", async () => {
    const completeCalls: Array<{ id: string }> = [];
    let taskListCalls = 0;
    const rpc = createMockRpcClient({
      "tasks.dailyBrief": () => brief(),
      "tasks.list": () => {
        taskListCalls += 1;
        return [task("task-a", "course-b", "待完成任务")];
      },
      "exams.list": () => [],
      "tasks.complete": (params: unknown) => {
        completeCalls.push(params as { id: string });
        return task("task-a", "course-b", "待完成任务", "completed");
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(HomeTab, {
      rpc, academicContext: { semesterId: "semester-b", courseId: "course-b" },
    })));
    await flush();

    expect(host.textContent).toContain("待完成任务");
    const completeButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("完成"));
    expect(completeButton, "pending 任务应有「完成」按钮").toBeTruthy();

    const listCallsBefore = taskListCalls;
    await act(async () => completeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();
    expect(completeCalls).toEqual([{ id: "task-a" }]);
    // 成功后刷新列表（重新调用 tasks.list）
    expect(taskListCalls).toBeGreaterThan(listCallsBefore);
  });

  it("RED 2: 完成任务显示「已完成」，不再渲染「完成」按钮", async () => {
    const rpc = createMockRpcClient({
      "tasks.dailyBrief": () => brief(),
      "tasks.list": () => [task("task-done", "course-b", "已完成任务", "completed")],
      "exams.list": () => [],
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(HomeTab, {
      rpc, academicContext: { semesterId: "semester-b", courseId: "course-b" },
    })));
    await flush();

    expect(host.textContent).toContain("已完成");
    const completeButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("完成"));
    expect(completeButton, "已完成任务不应有「完成」按钮").toBeUndefined();
  });

  it("RED 3: tasks.complete 失败时显示固定中文错误且不泄漏异常内容", async () => {
    const rpc = createMockRpcClient({
      "tasks.dailyBrief": () => brief(),
      "tasks.list": () => [task("task-a", "course-b", "待完成任务")],
      "exams.list": () => [],
      "tasks.complete": () => Promise.reject(new Error("internal leak /tmp/x stack")),
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(HomeTab, {
      rpc, academicContext: { semesterId: "semester-b", courseId: "course-b" },
    })));
    await flush();

    const completeButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("完成"));
    await act(async () => completeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();

    expect(host.textContent).toContain("任务完成失败");
    expect(host.textContent).not.toContain("internal leak");
    expect(host.textContent).not.toContain("/tmp/x");
  });

  it("RED 4: 任务列表加载失败时显示「重试」按钮，点击后重新调用 tasks.list", async () => {
    let taskCalls = 0;
    const rpc = createMockRpcClient({
      "tasks.dailyBrief": () => brief(),
      "tasks.list": () => {
        taskCalls += 1;
        if (taskCalls === 1) return Promise.reject(new Error("first load boom"));
        return [task("task-a", "course-b", "重试后的任务")];
      },
      "exams.list": () => [],
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(HomeTab, {
      rpc, academicContext: { semesterId: "semester-b", courseId: "course-b" },
    })));
    await flush();

    expect(host.textContent).toContain("暂时无法加载任务");
    const retryButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("重试"));
    expect(retryButton, "任务加载失败应有「重试」按钮").toBeTruthy();

    const callsBefore = taskCalls;
    await act(async () => retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();
    expect(taskCalls).toBeGreaterThan(callsBefore);
    expect(host.textContent).toContain("重试后的任务");
    expect(host.textContent).not.toContain("first load boom");
  });

  it("RED 5: dailyBrief 加载失败显示固定中文错误并可重试", async () => {
    let briefCalls = 0;
    const rpc = createMockRpcClient({
      "tasks.dailyBrief": () => {
        briefCalls += 1;
        if (briefCalls === 1) return Promise.reject(new Error("brief boom"));
        return brief();
      },
      "tasks.list": () => [],
      "exams.list": () => [],
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(HomeTab, {
      rpc, academicContext: { semesterId: "semester-b", courseId: "course-b" },
    })));
    await flush();

    expect(host.textContent).toContain("暂时无法加载学习简报");
    expect(host.textContent).not.toContain("brief boom");
  });

  it("RED 6: 考试行渲染「查看」按钮并明确提示跳转语义", async () => {
    const rpc = createMockRpcClient({
      "tasks.dailyBrief": () => brief(),
      "tasks.list": () => [],
      "exams.list": () => [exam("exam-b", "course-b", "课程 B 考试")],
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(HomeTab, {
      rpc, academicContext: { semesterId: "semester-b", courseId: "course-b" },
    })));
    await flush();

    expect(host.textContent).toContain("课程 B 考试");
    const viewButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("查看"));
    expect(viewButton, "考试行应有「查看」入口").toBeTruthy();
  });
});
