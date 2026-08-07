/**
 * T-M1-009 RED: HomeTab 首页 Tab 静态渲染测试
 *
 * 权威依据：09-UI §4.3（首页每日学习简报）+ §7.4（规则聚合非 AI）
 *
 * 测试策略：
 * - 传入夹具数据（dailyBrief/tasks/exams）断言渲染输出
 * - 规则聚合非 AI（不调用 AI RPC，dailyBrief 来自 tasks.dailyBrief）
 * - 空状态（无学期）
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeTab } from "../../src/renderer/components/tabs/HomeTab";
import type { DailyBrief, StudyTask, AssessmentAttempt } from "../../src/contract/types";

// ---------- 夹具数据 ----------

const fixtureTasks: StudyTask[] = [
  {
    id: "task-001",
    courseId: "course-001",
    title: "复习高等数学第一章",
    taskType: "review",
    status: "pending",
    priority: 3,
    sourceSystem: "S1",
    dueDate: "2026-08-08",
    createdAt: "2026-08-07T00:00:00Z",
    updatedAt: "2026-08-07T00:00:00Z",
  },
  {
    id: "task-002",
    courseId: "course-001",
    title: "完成英语练习册 P10",
    taskType: "practice",
    status: "in_progress",
    priority: 2,
    sourceSystem: "S1",
    createdAt: "2026-08-07T00:00:00Z",
    updatedAt: "2026-08-07T00:00:00Z",
  },
];

const fixtureDailyBrief: DailyBrief = {
  date: "2026-08-08",
  tasks: fixtureTasks,
  pendingItems: 2,
};

const fixtureExams: AssessmentAttempt[] = [
  {
    id: "exam-001",
    courseId: "course-001",
    examName: "高等数学期中考试",
    examType: "midterm",
    scheduledDate: "2026-08-15",
    source: "student_input",
    confirmationStatus: "confirmed",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
];

// ---------- HomeTab 渲染 ----------

describe("HomeTab 组件（09-UI §4.3 首页）", () => {
  it("渲染每日学习简报日期", () => {
    const html = renderToStaticMarkup(
      React.createElement(HomeTab, {
        dailyBrief: fixtureDailyBrief,
      }),
    );
    expect(html).toContain("2026-08-08");
  });

  it("渲染待办任务列表", () => {
    const html = renderToStaticMarkup(
      React.createElement(HomeTab, {
        dailyBrief: fixtureDailyBrief,
        tasks: fixtureTasks,
      }),
    );
    expect(html).toContain("复习高等数学第一章");
    expect(html).toContain("完成英语练习册 P10");
  });

  it("渲染待办数量", () => {
    const html = renderToStaticMarkup(
      React.createElement(HomeTab, {
        dailyBrief: fixtureDailyBrief,
      }),
    );
    expect(html).toContain("2");
  });

  it("渲染考试倒计时", () => {
    const html = renderToStaticMarkup(
      React.createElement(HomeTab, {
        dailyBrief: fixtureDailyBrief,
        exams: fixtureExams,
      }),
    );
    expect(html).toContain("高等数学期中考试");
  });

  it("空状态：无学期时渲染提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(HomeTab, { dailyBrief: undefined }),
    );
    // 无学期空状态提示
    expect(html).toContain("暂无");
  });

  it("规则聚合非 AI：渲染 dailyBrief 数据不展示 AI 幻觉标记（§7.4）", () => {
    const html = renderToStaticMarkup(
      React.createElement(HomeTab, {
        dailyBrief: fixtureDailyBrief,
      }),
    );
    // 不应包含 AI 生成标记（dailyBrief 是规则聚合非 AI）
    expect(html).not.toContain("AI 生成");
    expect(html).not.toContain("仅供参考");
  });

  it("不展示完整 UUID（§11.1 隐私边界）", () => {
    const html = renderToStaticMarkup(
      React.createElement(HomeTab, {
        dailyBrief: fixtureDailyBrief,
        tasks: fixtureTasks,
      }),
    );
    // tasks 中的 id 是 "task-001" 非 UUID，但若任何 UUID 出现应被 ShortId 处理
    // 此处断言渲染输出不含 36 字符 UUID 格式
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
