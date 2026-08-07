/**
 * PracticeTab 练习 Tab（T-M1-009，09-UI §4.6）
 *
 * S3 限时练习：创建会话 + 作答（防泄露）+ 提交 + 结果展示 + 计时器。
 *
 * §7.2 防泄露铁律：作答前阶段（phase="answering"）渲染绝不访问 question 对象的
 *   correct_answer/acceptable_answers/explanation 字段，渲染输出 HTML 不含这些字段名。
 *   结果阶段（phase="result"）才展示正确答案和解析（来自 PracticeResult）。
 * §11.1 隐私边界：所有 ID 走 ShortId 组件（不展示完整 UUID）。
 * §5.2 TTS 朗读按钮位置：结果区域预留朗读按钮。
 */
import React from "react";
import type { PracticeSession, QuestionDTO, PracticeResult } from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";

interface Props {
  /** 练习会话 */
  session?: PracticeSession;
  /** 题目列表（作答前 DTO，防泄露） */
  questions?: QuestionDTO[];
  /** 结果（提交后） */
  result?: PracticeResult;
  /** 当前阶段：idle=未开始 / answering=作答中 / result=结果展示 */
  phase?: "idle" | "answering" | "result";
  /** RPC 客户端（运行时交互用） */
  rpc?: unknown;
  /** 课程 ID */
  courseId?: string;
}

/** 题型中文标签 */
function questionTypeLabel(type: QuestionDTO["questionType"]): string {
  switch (type) {
    case "single_choice":
      return "单选题";
    case "multiple_choice":
      return "多选题";
    case "fill_blank":
      return "填空题";
    default:
      return type;
  }
}

/** 时间格式化（秒→MM:SS） */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** idle 阶段：未开始练习 */
function IdlePhase(): React.JSX.Element {
  return (
    <TabContainer>
      <div style={{ textAlign: "center", padding: "32px 16px" }}>
        <h2 style={{ fontSize: 16, margin: "0 0 16px 0" }}>练习</h2>
        <p style={{ color: "var(--text-muted, #888)", marginBottom: 16 }}>
          选择课程和知识模块开始练习
        </p>
        <button
          type="button"
          style={{
            padding: "8px 24px",
            fontSize: 13,
            cursor: "pointer",
            border: "1px solid var(--border, #e0e0e0)",
            background: "var(--bg-panel, #f5f5f5)",
            borderRadius: 4,
          }}
        >
          开始练习
        </button>
      </div>
    </TabContainer>
  );
}

/** answering 阶段：作答中（防泄露铁律） */
function AnsweringPhase({
  session,
  questions,
}: {
  session: PracticeSession;
  questions: QuestionDTO[];
}): React.JSX.Element {
  // §7.2 防泄露：此阶段只渲染 questionStem/options/score，
  // 绝不访问 correct_answer/acceptable_answers/explanation 字段。
  const timeLimitSec = session.timeLimit ? session.timeLimit : 0;

  return (
    <TabContainer>
      {/* 计时器 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          padding: "8px 12px",
          background: "var(--bg-panel, #f5f5f5)",
          borderRadius: 4,
        }}
      >
        <span style={{ fontSize: 13 }}>题目数：{questions.length}</span>
        <span style={{ fontSize: 13, color: "#d32f2f", fontWeight: 600 }}>
          剩余：{formatTime(timeLimitSec)}
        </span>
      </div>

      {/* 题目列表（防泄露：不含正确答案/解析） */}
      {questions.map((q, idx) => (
        <div
          key={q.id}
          style={{
            padding: 12,
            border: "1px solid var(--border, #e0e0e0)",
            borderRadius: 4,
            marginBottom: 12,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <strong>
              {idx + 1}. [{questionTypeLabel(q.questionType)}]
            </strong>{" "}
            <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>
              （{q.score} 分）
            </span>
          </div>
          <div style={{ marginBottom: 8, fontSize: 13 }}>{q.questionStem}</div>
          {/* 选项（仅选择题展示） */}
          {q.options && q.options.length > 0 && (
            <div style={{ paddingLeft: 16 }}>
              {q.options.map((opt, oi) => (
                <div key={oi} style={{ fontSize: 13, lineHeight: 1.8 }}>
                  <label>
                    <input type="radio" name={`q-${q.id}`} style={{ marginRight: 8 }} />
                    {String.fromCharCode(65 + oi)}. {opt}
                  </label>
                </div>
              ))}
            </div>
          )}
          {/* 填空题：文本输入 */}
          {q.questionType === "fill_blank" && (
            <div style={{ paddingLeft: 16 }}>
              <input
                type="text"
                style={{
                  width: "80%",
                  padding: "4px 8px",
                  border: "1px solid var(--border, #e0e0e0)",
                  borderRadius: 4,
                  fontSize: 13,
                }}
              />
            </div>
          )}
        </div>
      ))}

      {/* 提交按钮 */}
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <button
          type="button"
          style={{
            padding: "8px 32px",
            fontSize: 14,
            cursor: "pointer",
            border: "1px solid var(--border, #e0e0e0)",
            background: "#1976d2",
            color: "#fff",
            borderRadius: 4,
          }}
        >
          提交
        </button>
      </div>
    </TabContainer>
  );
}

/** result 阶段：结果展示（防泄露结束，可展示正确答案） */
function ResultPhase({
  session,
  questions,
  result,
}: {
  session: PracticeSession;
  questions: QuestionDTO[];
  result: PracticeResult;
}): React.JSX.Element {
  return (
    <TabContainer>
      {/* 结果摘要 */}
      <div
        style={{
          padding: 16,
          background: "var(--bg-panel, #f5f5f5)",
          borderRadius: 4,
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>练习结果</h2>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#1976d2" }}>
          {result.totalScore} / {result.maxScore}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted, #888)", marginTop: 4 }}>
          正确：{result.correctCount} / {questions.length} 题
        </div>
        <button
          type="button"
          style={{
            marginTop: 12,
            padding: "4px 12px",
            fontSize: 12,
            cursor: "pointer",
            border: "1px solid var(--border, #e0e0e0)",
            background: "var(--bg-panel, #f5f5f5)",
            borderRadius: 4,
          }}
        >
          朗读
        </button>
      </div>

      {/* 逐题回顾（含正确答案和解析） */}
      {result.items.map((item, idx) => (
        <div
          key={item.question.id}
          style={{
            padding: 12,
            border: "1px solid var(--border, #e0e0e0)",
            borderRadius: 4,
            marginBottom: 12,
            borderLeft: `4px solid ${item.isCorrect ? "#2e7d32" : "#c62828"}`,
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <strong>
              {idx + 1}. [{questionTypeLabel(item.question.questionType)}]
            </strong>
            <span
              style={{
                marginLeft: 8,
                fontSize: 12,
                color: item.isCorrect ? "#2e7d32" : "#c62828",
                fontWeight: 600,
              }}
            >
              {item.isCorrect ? "正确" : "错误"}
            </span>
          </div>
          <div style={{ marginBottom: 8, fontSize: 13 }}>{item.question.questionStem}</div>
          {/* 正确答案（防泄露结束） */}
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            <strong>正确答案：</strong>
            {String(item.correctAnswer)}
          </div>
          {/* 解析（防泄露结束） */}
          {item.explanation && (
            <div style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>
              <strong>解析：</strong>
              {item.explanation}
            </div>
          )}
        </div>
      ))}
    </TabContainer>
  );
}

export function PracticeTab({
  session,
  questions,
  result,
  phase = "idle",
}: Props): React.JSX.Element {
  // idle 阶段
  if (phase === "idle" || !session || !questions) {
    return <IdlePhase />;
  }

  // result 阶段（防泄露结束）
  if (phase === "result" && result) {
    return <ResultPhase session={session} questions={questions} result={result} />;
  }

  // answering 阶段（防泄露铁律）
  return <AnsweringPhase session={session} questions={questions} />;
}
