/**
 * T-M4-007：在 happy-dom 中真实挂载 AppShell，验证异步课程加载与页面状态协作。
 * 使用进程内 deferred RPC；不写真实业务数据根，也不连接外部服务。
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CourseInstance, Semester } from "../../src/contract/types";
import { AppShell } from "../../src/renderer/components/AppShell";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 创建可由测试精确决定完成顺序的 Promise，用来模拟课程 RPC 乱序返回。 */
function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const fallSemester: Semester = {
  id: "semester-fall",
  studentName: "测试学生",
  label: "2026 秋",
  startDate: "2026-09-01",
  endDate: "2027-01-20",
  timezone: "Asia/Shanghai",
  status: "active",
  dbRelativePath: "semesters/fall.db",
  ready: 1,
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:00:00.000Z",
};

const springSemester: Semester = {
  ...fallSemester,
  id: "semester-spring",
  label: "2026 春",
  status: "archived",
  dbRelativePath: "semesters/spring.db",
};

function course(id: string, courseName: string): CourseInstance {
  return {
    id,
    semesterId: fallSemester.id,
    courseName,
    subject: "数学",
    status: "active",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
  };
}

/** 等待 React effect 和由 mock RPC 返回的微任务全部完成。 */
async function flushRenderer(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
  });
}

/** 按可见文字寻找按钮，避免测试依赖内部 DOM 结构或 ID。 */
function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.includes(text));
  if (!button) throw new Error(`缺少按钮：${text}`);
  return button as HTMLButtonElement;
}

/** 点击真实 DOM 按钮，并在 act 边界中刷新 React 状态。 */
async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.click();
  });
  await flushRenderer();
}

describe("AppShell 学期/课程真实交互（T-M4-007）", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("乱序课程响应不会覆盖最新请求；选课、切换 Tab 和设置往返保持唯一上下文", async () => {
    const firstFallCourses = createDeferred<CourseInstance[]>();
    const latestFallCourses = createDeferred<CourseInstance[]>();
    let fallRequestCount = 0;
    const rpc = createMockRpcClient({
      "semesters.list": () => [fallSemester, springSemester],
      "courses.list": (params: unknown) => {
        const semesterId = (params as { semesterId: string }).semesterId;
        if (semesterId !== fallSemester.id) return [];
        fallRequestCount += 1;
        return fallRequestCount === 1 ? firstFallCourses.promise : latestFallCourses.promise;
      },
    });

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(AppShell, { rpc })));
    for (let attempt = 0; attempt < 3 && !host.textContent?.includes("2026 秋"); attempt += 1) {
      await flushRenderer();
    }
    expect(host.textContent).toContain("2026 秋");

    // 第一次展开、收起、再次展开：第二次读取是该学期的最新请求。
    await click(findButton(host, "2026 秋"));
    await click(findButton(host, "2026 秋"));
    await click(findButton(host, "2026 秋"));
    expect(fallRequestCount).toBe(2);

    latestFallCourses.resolve([course("course-latest", "最新课程")]);
    await flushRenderer();
    expect(host.textContent).toContain("最新课程");

    // 第一次请求晚到后不得把最新课程替换为旧课程。
    firstFallCourses.resolve([course("course-stale", "旧课程")]);
    await flushRenderer();
    expect(host.textContent).toContain("最新课程");
    expect(host.textContent).not.toContain("旧课程");

    await click(findButton(host, "最新课程"));
    expect(host.textContent).toContain("2026 秋 / 最新课程");

    await click(findButton(host, "笔记"));
    expect(findButton(host, "笔记").getAttribute("aria-selected")).toBe("true");
    expect(host.textContent).toContain("2026 秋 / 最新课程");

    await click(host.querySelector('button[aria-label="打开设置"]') as HTMLButtonElement);
    expect(host.textContent).toContain("⚙ 设置");
    await click(findButton(host, "返回学习工作台"));
    expect(findButton(host, "笔记").getAttribute("aria-selected")).toBe("true");
    expect(host.textContent).toContain("2026 秋 / 最新课程");
  });

  it("选中课程后提供可见备份恢复入口，并切换到备份面板", async () => {
    const rpc = createMockRpcClient({
      "semesters.list": () => [fallSemester],
      "courses.list": () => [course("course-1", "备份课程")],
      "backup.list": () => [],
      "backup.listSchedules": () => [],
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(AppShell, { rpc })));
    await flushRenderer();
    await click(findButton(host, "2026 秋"));
    await click(findButton(host, "备份课程"));
    await click(findButton(host, "备份恢复"));
    expect(host.querySelector('button[role="tab"][aria-selected="true"]')?.textContent).toContain("备份");
    expect(host.textContent).toContain("手动备份");
  });
});
