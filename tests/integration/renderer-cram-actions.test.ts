/**
 * T-M5-004 RED：S5 冲刺（CTRL-CRAM-01~03）静态按钮可达性、未确认考试拦截、失败重试。
 *
 * 权威依据：09-UI §4.8（冲刺）+ T-M5-004 prompt §4.6（未确认考试不得生成模拟考、
 * 不得通过 renderer 字面量绕过考试确认、生成失败/结果读取重试、空态/失败态/禁用态）
 * + T-M5-001 Review A P1（静态兼容分支的命令按钮必须检查可达性或移除）。
 *
 * 现状缺口：静态 MockExamPhase 渲染无 onClick 的「生成试卷」按钮；
 * 未确认考试拦截依赖后端触发器（renderer 不绕过），需验证失败可见。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { AssessmentAttempt } from "../../src/contract/types";
import { CramTab } from "../../src/renderer/components/tabs/CramTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function confirmedExam(id: string, courseId: string, examName: string): AssessmentAttempt {
  return {
    id, courseId, examName, examType: "final", scheduledDate: "2026-08-20", source: "student_input",
    confirmationStatus: "confirmed", confirmedAt: "2026-08-09T00:00:00.000Z", confirmedBy: "student",
    createdAt: "2026-08-09T00:00:00.000Z", updatedAt: "2026-08-09T00:00:00.000Z",
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

describe("T-M5-004 CTRL-CRAM 静态按钮/未确认拦截/失败重试", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("RED 1: 静态空态分支「生成试卷」按钮为禁用态（无 rpc 不冒充可点击）", () => {
    // 无 rpc 的静态 MockExamPhase：按钮必须 disabled，避免无 action 可点击（Review A P1）
    const html = renderToStaticMarkup(React.createElement(CramTab, { subTab: "mockExam" }));
    expect(html).toContain("模拟考");
    expect(html).toContain("生成试卷");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("RED 2: 未确认考试不会出现在已确认选择器中（门控由 exams.list confirmed 过滤）", async () => {
    const listParams: Array<{ courseId: string; confirmationStatus?: string }> = [];
    const rpc = createMockRpcClient({
      "exams.list": (params: unknown) => {
        listParams.push(params as { courseId: string; confirmationStatus?: string });
        return [confirmedExam("exam-a", "course-b", "期末冲刺考")];
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(CramTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b" },
    })));
    await flush();

    // 必须带 confirmationStatus: "confirmed" 过滤（renderer 不自行推导确认事实）
    expect(listParams[0].confirmationStatus).toBe("confirmed");
    const select = host.querySelector<HTMLSelectElement>("#cram-assessment");
    expect(select, "应有已确认考试选择器").toBeTruthy();
    const options = Array.from(select?.options ?? []);
    expect(options.some((option) => option.textContent?.includes("期末冲刺考")), "已确认考试应出现在选择器中").toBe(true);
  });

  it("RED 3: 后端拒绝生成（未确认考试）时显示固定中文错误，不泄漏后端细节", async () => {
    const rpc = createMockRpcClient({
      "exams.list": () => [confirmedExam("exam-a", "course-b", "期末冲刺考")],
      "mockExams.generatePaper": () => Promise.reject({ code: "BAD_REQUEST", message: "该考试尚未确认，无法生成模拟卷" }),
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(CramTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b" },
    })));
    await flush();

    const select = host.querySelector<HTMLSelectElement>("#cram-assessment");
    await act(async () => {
      select!.value = "exam-a";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    // 切换到模拟考子 Tab
    const mockTabButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.trim() === "模拟考");
    await act(async () => mockTabButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();

    const generateButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("生成试卷"));
    expect(generateButton, "应渲染生成试卷按钮").toBeTruthy();
    await act(async () => generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();

    // 固定中文错误，不显示后端原始 message
    expect(host.textContent).toContain("暂时无法生成模拟卷");
    expect(host.textContent).not.toContain("尚未确认");
  });

  it("RED 4: 生成失败后可重新生成（从 idle 恢复，不残留 busy 状态）", async () => {
    let generateCalls = 0;
    const rpc = createMockRpcClient({
      "exams.list": () => [confirmedExam("exam-a", "course-b", "期末冲刺考")],
      "mockExams.generatePaper": () => {
        generateCalls += 1;
        if (generateCalls === 1) return Promise.reject(new Error("gen boom"));
        return {
          id: "paper-1", courseInstanceId: "course-b", assessmentAttemptId: "exam-a",
          paperTitle: "模拟卷", questionCount: 1, totalScore: 5, timeLimitMinutes: 15,
          questions: [{ id: "q-1", questionType: "single_choice" as const, questionStem: "题目", options: ["A", "B"], score: 5 }],
          createdAt: "2026-08-09T00:00:00.000Z",
        };
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(CramTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b" },
    })));
    await flush();

    const select = host.querySelector<HTMLSelectElement>("#cram-assessment");
    await act(async () => {
      select!.value = "exam-a";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    // 切换到模拟考子 Tab
    const mockTabButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.trim() === "模拟考");
    await act(async () => mockTabButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();

    let generateButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("生成试卷"));
    await act(async () => generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();
    expect(host.textContent).toContain("暂时无法生成模拟卷");

    // 失败后回到 idle：重新出现生成试卷按钮
    generateButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("生成试卷"));
    expect(generateButton, "失败后应回到可重新生成的 idle 态").toBeTruthy();
    await act(async () => generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();
    expect(generateCalls).toBe(2);
    expect(host.textContent).toContain("模拟卷");
  });
});
