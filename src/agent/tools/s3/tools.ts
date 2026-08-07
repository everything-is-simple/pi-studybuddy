/**
 * T-M1-003 S3 registerTool 工具定义（03-Arch §3.1 + §2.2 ToolDefinition 契约）
 *
 * 3 个 studybuddy_* 工具，execute 薄封装调用同一 handler 函数（06-API §3.5）。
 * 工具名匹配 ^studybuddy_[a-z_]+$；ToolDefinition 必填 name/label/description/parameters/execute。
 *
 * 工具清单：
 *   1. studybuddy_generate_questions     → practice.createSession
 *   2. studybuddy_submit_practice        → practice.submit
 *   3. studybuddy_get_practice_result    → practice.getResult
 */
import { Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { S3Context } from "../../../agent-host/handlers/s3/context";
import { createS3Handlers } from "../../../agent-host/handlers/s3";

function textContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

function jsonContent(obj: unknown): { type: "text"; text: string } {
  return textContent(JSON.stringify(obj, null, 2));
}

/**
 * 创建 S3 全部 3 个 studybuddy_* 工具。
 * @param ctx S3 上下文（数据层句柄 + QuestionGenerator，由 studybuddy-extension 注入）
 */
export function createS3Tools(ctx: S3Context): ToolDefinition[] {
  const handlers = createS3Handlers(ctx);

  return [
    // 1. studybuddy_generate_questions → practice.createSession
    {
      name: "studybuddy_generate_questions",
      label: "生成练习题目",
      description:
        "为指定课程和知识模块创建限时练习会话。系统会校验题目数量（5-20）和模块数量（1-10），通过题目生成器生成客观题（单选 60%/多选 20%/填空 20%）。题目生成失败不会创建空会话。返回练习会话信息。",
      promptSnippet: "生成练习：创建 session + 生成题目（单60%/多20%/填20%）",
      parameters: Type.Object({
        courseId: Type.String({ description: "课程实例 ID" }),
        moduleIds: Type.Array(Type.String(), { description: "知识模块 ID 列表（1-10 个）" }),
        questionCount: Type.Number({ description: "题目数量（5-20）" }),
        timeLimit: Type.Optional(Type.Number({ description: "限时（分钟，可选）" })),
        difficulty: Type.Optional(Type.Number({ description: "难度（1-5，可选）" })),
        questionTypes: Type.Optional(
          Type.Array(Type.String(), { description: "题型列表（可选，默认全部）" }),
        ),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["practice.createSession"](params);
        return {
          content: [
            textContent(`练习会话已创建：${result.questionCount} 题，状态 ${result.status}`),
            jsonContent(result),
          ],
          details: { sessionId: result.id, questionCount: result.questionCount, status: result.status },
        };
      },
    },

    // 2. studybuddy_submit_practice → practice.submit
    {
      name: "studybuddy_submit_practice",
      label: "提交练习答案",
      description:
        "提交练习答案并自动批改。批改使用确定性规则（单选精确匹配、多选排序 deepEquals、填空 normalize+多等价答案）。会话状态从 in_progress→graded。已批改的练习无法重复提交。返回批改结果（含逐题正误、正确答案、解析）。",
      promptSnippet: "提交练习：规则批改三策略 + session→graded",
      parameters: Type.Object({
        sessionId: Type.String({ description: "练习会话 ID" }),
        answers: Type.Array(
          Type.Object({
            questionId: Type.String({ description: "题目 ID" }),
            value: Type.Unknown({ description: "答案值（单选/填空为 string，多选为 string[]）" }),
          }),
          { description: "答案列表" },
        ),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["practice.submit"](params);
        return {
          content: [
            textContent(`练习已批改：${result.correctCount}/${result.items.length} 正确，得分 ${result.totalScore}/${result.maxScore}`),
            jsonContent(result),
          ],
          details: {
            sessionId: result.sessionId,
            totalScore: result.totalScore,
            maxScore: result.maxScore,
            correctCount: result.correctCount,
          },
        };
      },
    },

    // 3. studybuddy_get_practice_result → practice.getResult
    {
      name: "studybuddy_get_practice_result",
      label: "查看练习结果",
      description:
        "查看已批改练习的详细结果，含每题的正确答案和解析。仅已批改（graded）的练习可查看。返回逐题正误、正确答案、解析。",
      promptSnippet: "查看结果：逐题正确答案+解析",
      parameters: Type.Object({
        sessionId: Type.String({ description: "练习会话 ID（必须已批改）" }),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["practice.getResult"](params);
        return {
          content: [
            textContent(`练习结果：${result.correctCount}/${result.items.length} 正确，得分 ${result.totalScore}/${result.maxScore}`),
            jsonContent(result),
          ],
          details: {
            sessionId: result.sessionId,
            totalScore: result.totalScore,
            maxScore: result.maxScore,
            correctCount: result.correctCount,
          },
        };
      },
    },
  ];
}

/** S3 工具名清单（用于断言） */
export const S3_TOOL_NAMES = [
  "studybuddy_generate_questions",
  "studybuddy_submit_practice",
  "studybuddy_get_practice_result",
] as const;

/** S3 工具数量 */
export const S3_TOOL_COUNT = S3_TOOL_NAMES.length;
