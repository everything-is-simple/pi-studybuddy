/**
 * T-M1-009 RED: PracticeTab 练习 Tab 静态渲染测试
 *
 * 权威依据：09-UI §4.6（限时作答）+ §7.2（防泄露 UI 断言）
 *
 * 测试策略：
 * - 作答前阶段：渲染题目，HTML 不含 correct_answer/acceptable_answers/explanation（防泄露铁律）
 * - 结果阶段：渲染正确答案和解析（submit 后）
 * - 计时器展示
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PracticeTab } from "../../src/renderer/components/tabs/PracticeTab";
import type { PracticeSession, QuestionDTO, PracticeResult } from "../../src/contract/types";

// ---------- 夹具数据 ----------

const fixtureSession: PracticeSession = {
  id: "sess-001",
  courseId: "course-001",
  moduleIds: ["mod-001"],
  questionCount: 2,
  timeLimit: 600,
  status: "in_progress",
  startedAt: "2026-08-08T10:00:00Z",
  createdAt: "2026-08-08T10:00:00Z",
};

const fixtureQuestions: QuestionDTO[] = [
  {
    id: "q-001",
    questionType: "single_choice",
    questionStem: "下列哪个是极限的定义？",
    options: ["ε-δ 定义", "牛顿定义", "莱布尼茨定义", "柯西定义"],
    score: 5,
  },
  {
    id: "q-002",
    questionType: "fill_blank",
    questionStem: "lim(x→0) sin(x)/x = ___",
    score: 5,
  },
];

const fixtureResult: PracticeResult = {
  sessionId: "sess-001",
  totalScore: 8,
  maxScore: 10,
  correctCount: 1,
  elapsedMs: 320000,
  submittedAt: "2026-08-08T10:05:20Z",
  gradedAt: "2026-08-08T10:05:21Z",
  items: [
    {
      question: fixtureQuestions[0],
      isCorrect: true,
      correctAnswer: "ε-δ 定义",
      explanation: "ε-δ 定义是极限的严格数学定义",
    },
    {
      question: fixtureQuestions[1],
      isCorrect: false,
      correctAnswer: "1",
      explanation: "这是重要极限，结果为 1",
    },
  ],
};

// ---------- PracticeTab 作答前阶段（防泄露） ----------

describe("PracticeTab 作答前阶段（§7.2 防泄露铁律）", () => {
  it("渲染题目题干", () => {
    const html = renderToStaticMarkup(
      React.createElement(PracticeTab, {
        session: fixtureSession,
        questions: fixtureQuestions,
        phase: "answering",
      }),
    );
    expect(html).toContain("下列哪个是极限的定义？");
    expect(html).toContain("lim(x→0) sin(x)/x");
  });

  it("渲染选择题选项", () => {
    const html = renderToStaticMarkup(
      React.createElement(PracticeTab, {
        session: fixtureSession,
        questions: fixtureQuestions,
        phase: "answering",
      }),
    );
    expect(html).toContain("ε-δ 定义");
    expect(html).toContain("牛顿定义");
  });

  it("防泄露：作答前 HTML 不含 correct_answer（§7.2 铁律）", () => {
    const html = renderToStaticMarkup(
      React.createElement(PracticeTab, {
        session: fixtureSession,
        questions: fixtureQuestions,
        phase: "answering",
      }),
    );
    // 不含正确答案字段名
    expect(html).not.toContain("correct_answer");
    expect(html).not.toContain("correctAnswer");
  });

  it("防泄露：作答前 HTML 不含 acceptable_answers（§7.2 铁律）", () => {
    const html = renderToStaticMarkup(
      React.createElement(PracticeTab, {
        session: fixtureSession,
        questions: fixtureQuestions,
        phase: "answering",
      }),
    );
    expect(html).not.toContain("acceptable_answers");
    expect(html).not.toContain("acceptableAnswers");
  });

  it("防泄露：作答前 HTML 不含 explanation（§7.2 铁律）", () => {
    const html = renderToStaticMarkup(
      React.createElement(PracticeTab, {
        session: fixtureSession,
        questions: fixtureQuestions,
        phase: "answering",
      }),
    );
    expect(html).not.toContain("explanation");
    expect(html).not.toContain("解析");
  });

  it("防泄露：作答前不展示正确答案内容", () => {
    // 正确答案 "ε-δ 定义" 作为选项之一会出现在选项列表中（这是允许的）
    // 但 "1"（填空题正确答案）不应出现在作答前渲染中
    const html = renderToStaticMarkup(
      React.createElement(PracticeTab, {
        session: fixtureSession,
        questions: fixtureQuestions,
        phase: "answering",
      }),
    );
    // 填空题正确答案 "1" 不应作为独立答案展示（题干中的 lim(x→0) 含 0，但不应有独立的答案区）
    // 关键断言：不含有"正确答案"字样的答案展示区
    expect(html).not.toContain("正确答案");
  });

  it("渲染计时器（§4.6 限时作答）", () => {
    const html = renderToStaticMarkup(
      React.createElement(PracticeTab, {
        session: fixtureSession,
        questions: fixtureQuestions,
        phase: "answering",
      }),
    );
    // 计时器或时间限制提示
    expect(html).toContain("10:00");
  });

  it("渲染提交按钮", () => {
    const html = renderToStaticMarkup(
      React.createElement(PracticeTab, {
        session: fixtureSession,
        questions: fixtureQuestions,
        phase: "answering",
      }),
    );
    expect(html).toContain("提交");
  });
});

// ---------- PracticeTab 结果阶段（提交后展示正确答案） ----------

describe("PracticeTab 结果阶段（提交后展示正确答案）", () => {
  it("渲染总分和正确数", () => {
    const html = renderToStaticMarkup(
      React.createElement(PracticeTab, {
        session: fixtureSession,
        questions: fixtureQuestions,
        result: fixtureResult,
        phase: "result",
      }),
    );
    expect(html).toContain("8");
    expect(html).toContain("10");
  });

  it("结果阶段展示正确答案和解析（防泄露结束）", () => {
    const html = renderToStaticMarkup(
      React.createElement(PracticeTab, {
        session: fixtureSession,
        questions: fixtureQuestions,
        result: fixtureResult,
        phase: "result",
      }),
    );
    // 结果阶段可以展示正确答案和解析
    expect(html).toContain("ε-δ 定义是极限的严格数学定义");
    expect(html).toContain("正确答案");
  });
});

// ---------- PracticeTab 空状态 ----------

describe("PracticeTab 空状态", () => {
  it("无会话时渲染开始练习入口", () => {
    const html = renderToStaticMarkup(
      React.createElement(PracticeTab, { phase: "idle" }),
    );
    expect(html).toContain("练习");
  });
});
