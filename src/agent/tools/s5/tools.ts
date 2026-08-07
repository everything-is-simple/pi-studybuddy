/**
 * T-M2-001 S5 registerTool 工具定义（03-Arch §3.1 行246-247 + §2.2 ToolDefinition 契约）
 *
 * 2 个 studybuddy_* 工具，execute 薄封装调用同一 handler 函数（06-API §3.7）。
 * 工具名匹配 ^studybuddy_[a-z_]+$；ToolDefinition 必填 name/label/description/parameters/execute。
 *
 * 工具清单：
 *   1. studybuddy_generate_mock_exam  → mockExams.generatePaper
 *   2. studybuddy_submit_mock_exam    → mockExams.submitAttempt
 */
import { Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { S5Context } from "../../../agent-host/handlers/s5/context";
import { createS5Handlers } from "../../../agent-host/handlers/s5";

function textContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

function jsonContent(obj: unknown): { type: "text"; text: string } {
  return textContent(JSON.stringify(obj, null, 2));
}

/**
 * 创建 S5 全部 2 个 studybuddy_* 工具。
 * @param ctx S5 上下文（数据层句柄 + MockExamGenerator，由 studybuddy-extension 注入）
 */
export function createS5Tools(ctx: S5Context): ToolDefinition[] {
  const handlers = createS5Handlers(ctx);

  return [
    // 1. studybuddy_generate_mock_exam → mockExams.generatePaper
    {
      name: "studybuddy_generate_mock_exam",
      label: "生成模拟卷",
      description:
        "AI 生成限时模拟卷（独立于 S3）。触发器校验 assessment_attempt 必须 confirmed；source_hash 防重复生成。AI 失败不创建空卷。返回模拟卷含题目列表（防泄露不含正确答案）。",
      promptSnippet: "生成模拟卷：触发器校验 confirmed + source_hash 防重复 + AI 失败降级",
      parameters: Type.Object({
        assessmentAttemptId: Type.String({ description: "已确认的考试 ID（assessment_attempt_id）" }),
        questionCount: Type.Number({ description: "题目数量（5-20）" }),
        timeLimit: Type.Optional(Type.Number({ description: "限时（分钟，可选）" })),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["mockExams.generatePaper"](params);
        return {
          content: [
            textContent(`模拟卷已生成：${result.paperTitle}，共 ${result.questionCount} 题，总分 ${result.totalScore}`),
            jsonContent(result),
          ],
          details: {
            paperId: result.id,
            questionCount: result.questionCount,
            totalScore: result.totalScore,
            sourceHash: result.sourceHash,
          },
        };
      },
    },

    // 2. studybuddy_submit_mock_exam → mockExams.submitAttempt
    {
      name: "studybuddy_submit_mock_exam",
      label: "提交模拟考",
      description:
        "学生限时作答 + 规则批改客观题。展示总分/正确率/耗时/逐题结果/模块覆盖。状态机 in_progress→graded；重复提交拒绝。写 mock_exam_completed 事件。",
      promptSnippet: "提交模拟考：规则批改 + 状态机 + 模块分析 + study_events",
      parameters: Type.Object({
        attemptId: Type.String({ description: "模拟考作答 ID（mock_exam_attempt_id）" }),
        answers: Type.Array(
          Type.Object({
            questionId: Type.String({ description: "题目 ID" }),
            value: Type.Any({ description: "学生答案（单选/填空为 string，多选为 string[]）" }),
          }),
          { description: "学生答案列表" },
        ),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["mockExams.submitAttempt"](params);
        return {
          content: [
            textContent(
              `模拟考已批改：总分 ${result.totalScore}/${result.maxScore}，正确 ${result.correctCount} 题，正确率 ${Math.round(result.correctRate * 100)}%，耗时 ${Math.round(result.elapsedMs / 1000)} 秒`,
            ),
            jsonContent(result),
          ],
          details: {
            attemptId: result.attemptId,
            totalScore: result.totalScore,
            maxScore: result.maxScore,
            correctCount: result.correctCount,
            correctRate: result.correctRate,
            elapsedMs: result.elapsedMs,
            moduleAnalyses: result.moduleAnalyses,
          },
        };
      },
    },
  ];
}

/** S5 工具名清单（用于断言） */
export const S5_TOOL_NAMES = [
  "studybuddy_generate_mock_exam",
  "studybuddy_submit_mock_exam",
] as const;

/** S5 工具数量 */
export const S5_TOOL_COUNT = S5_TOOL_NAMES.length;
