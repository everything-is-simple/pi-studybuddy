/** T-M5-002：空数据 AppShell 首次启动向导集成测试。 */
/** @vitest-environment happy-dom */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { AppShell } from "../../src/renderer/components/AppShell";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
  });
}

function click(container: HTMLElement, text: string): void {
  const found = [...container.querySelectorAll("button")].find((item) => item.textContent?.includes(text));
  if (!found) throw new Error(`button missing: ${text}`);
  found.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function input(container: HTMLElement, label: string, value: string): void {
  const field = container.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement | null;
  if (!field) throw new Error(`input missing: ${label}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("T-M5-002 AppShell 首次启动", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("空数据根仅通过可见 UI 创建学期和课程，并立即选中后进入首页", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const semester = {
      id: "semester-created", studentName: "学生", label: "2026 秋季学期", startDate: "2026-09-01", endDate: "2027-01-20",
      timezone: "Asia/Shanghai", status: "active" as const, dbRelativePath: "semester/semester-created/sem.db", ready: 0,
      createdAt: "2026-08-12", updatedAt: "2026-08-12",
    };
    const course = { id: "course-created", semesterId: semester.id, courseName: "高等数学", subject: "数学", status: "active", createdAt: "2026-08-12", updatedAt: "2026-08-12" };
    const rpc = createMockRpcClient({
      "sessions.list": () => [],
      "semesters.list": () => [],
      "courses.list": () => [],
      "semesters.create": (params: unknown) => { calls.push({ method: "semesters.create", params }); return semester; },
      "courses.create": (params: unknown) => { calls.push({ method: "courses.create", params }); return course; },
      "tasks.dailyBrief": () => ({ date: "2026-09-01", tasks: [], pendingItems: 0 }),
      "tasks.list": () => [],
      "exams.list": () => [],
    });

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(AppShell, { rpc })));
    await flush();

    expect(host.textContent).toContain("创建学习计划");
    await act(async () => click(host!, "创建学习计划"));
    await flush();
    input(host, "学期名称", "2026 秋季学期");
    input(host, "学期开始日期", "2026-09-01");
    input(host, "学期结束日期", "2027-01-20");
    await act(async () => click(host!, "下一步"));
    await flush();
    input(host, "课程名称", "高等数学");
    input(host, "课程学科", "数学");
    await act(async () => click(host!, "完成创建"));
    await flush();

    expect(calls).toContainEqual({ method: "semesters.create", params: { label: "2026 秋季学期", startDate: "2026-09-01", endDate: "2027-01-20", timezone: "Asia/Shanghai" } });
    expect(calls).toContainEqual({ method: "courses.create", params: { semesterId: "semester-created", courseName: "高等数学", subject: "数学" } });
    expect(host.textContent).toContain("2026 秋季学期 / 高等数学");
    expect(host.textContent).toContain("每日学习简报");
  });
});
