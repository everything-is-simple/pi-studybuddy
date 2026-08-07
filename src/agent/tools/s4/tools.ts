/**
 * T-M1-004 S4 registerTool 工具定义（03-Arch §3.1 + §2.2 ToolDefinition 契约）
 *
 * 4 个 studybuddy_* 工具，execute 薄封装调用同一 handler 函数（06-API §3.6）。
 * 工具名匹配 ^studybuddy_[a-z_]+$；ToolDefinition 必填 name/label/description/parameters/execute。
 *
 * 工具清单：
 *   1. studybuddy_archive_mistake         → mistakes.archive
 *   2. studybuddy_confirm_error_cause     → mistakes.confirmErrorCause
 *   3. studybuddy_redo_mistake            → mistakes.redo
 *   4. studybuddy_aggregate_weak_point    → weakPoints.list
 */
import { Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { S4Context } from "../../../agent-host/handlers/s4/context";
import { createS4Handlers } from "../../../agent-host/handlers/s4";

function textContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

function jsonContent(obj: unknown): { type: "text"; text: string } {
  return textContent(JSON.stringify(obj, null, 2));
}

/**
 * 创建 S4 全部 4 个 studybuddy_* 工具。
 * @param ctx S4 上下文（数据层句柄 + ErrorCauseAdvisor，由 studybuddy-extension 注入）
 */
export function createS4Tools(ctx: S4Context): ToolDefinition[] {
  const handlers = createS4Handlers(ctx);

  return [
    // 1. studybuddy_archive_mistake → mistakes.archive
    {
      name: "studybuddy_archive_mistake",
      label: "归档错题",
      description:
        "将错误答题幂等归档为错题。系统会检查 UNIQUE(question_id)：已有错题则追加证据（UNIQUE(source_practice_answer_id) 防重复），没有则新建错题（status=needs_review）。仅归档 is_correct=0 的答题。返回错题信息。",
      promptSnippet: "归档错题：幂等 UNIQUE(question_id) + 追加 evidence",
      parameters: Type.Object({
        practiceAnswerId: Type.String({ description: "练习答题 ID（必须 is_correct=0）" }),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["mistakes.archive"](params);
        return {
          content: [
            textContent(`错题已归档：状态 ${result.status}，重做次数 ${result.redoCount}`),
            jsonContent(result),
          ],
          details: {
            mistakeId: result.id,
            status: result.status,
            redoCount: result.redoCount,
          },
        };
      },
    },

    // 2. studybuddy_confirm_error_cause → mistakes.confirmErrorCause
    {
      name: "studybuddy_confirm_error_cause",
      label: "确认错因",
      description:
        "学生确认或修改错因（六分类：concept_unclear/misread/formula_error/step_missing/time_pressure/other）。AI 只提建议带「不确定」标记，学生必须确认。返回更新后的错题。",
      promptSnippet: "确认错因：六分类 + confirmed_by=student",
      parameters: Type.Object({
        id: Type.String({ description: "错题 ID" }),
        category: Type.String({
          description:
            "错因六分类：concept_unclear/misread/formula_error/step_missing/time_pressure/other",
        }),
        causeNote: Type.Optional(Type.String({ description: "错因正文备注（可选）" })),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["mistakes.confirmErrorCause"](params);
        return {
          content: [
            textContent(`错因已确认：分类 ${result.errorCategory}，确认人 ${result.errorCauseConfirmedBy}`),
            jsonContent(result),
          ],
          details: {
            mistakeId: result.id,
            errorCategory: result.errorCategory,
            errorCauseConfirmedBy: result.errorCauseConfirmedBy,
          },
        };
      },
    },

    // 3. studybuddy_redo_mistake → mistakes.redo
    {
      name: "studybuddy_redo_mistake",
      label: "重做错题",
      description:
        "重做错题（MVP 原题重做）。重做正确→增加掌握证据+evidence_count≥2 归纳薄弱点+status=mastered；重做错误→追加 redo_wrong 证据+保持 needs_review（mastered 回退）。返回重做结果。",
      promptSnippet: "重做错题：正确→mastered+归纳weak_point，错误→needs_review",
      parameters: Type.Object({
        id: Type.String({ description: "错题 ID" }),
        correct: Type.Optional(
          Type.Boolean({ description: "重做是否正确（MVP 注入，实际由 UI 传入学生答案+批改）" }),
        ),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["mistakes.redo"](params);
        return {
          content: [
            textContent(
              `重做结果：${result.correct ? "正确" : "错误"}，证据数 ${result.evidenceCount}，薄弱点归纳 ${result.weakPointFormed ? "是" : "否"}`,
            ),
            jsonContent(result),
          ],
          details: {
            mistakeId: result.mistakeId,
            correct: result.correct,
            evidenceCount: result.evidenceCount,
            weakPointFormed: result.weakPointFormed,
          },
        };
      },
    },

    // 4. studybuddy_aggregate_weak_point → weakPoints.list
    {
      name: "studybuddy_aggregate_weak_point",
      label: "查看薄弱点",
      description:
        "查看薄弱点列表（evidence_count≥2 才形成）。支持按课程和状态过滤。薄弱点状态机：active→resolved→regressed。返回薄弱点列表。",
      promptSnippet: "查看薄弱点：evidence_count≥2 + 状态机",
      parameters: Type.Object({
        courseId: Type.Optional(Type.String({ description: "课程 ID（可选过滤）" })),
        status: Type.Optional(
          Type.String({ description: "状态过滤（active/resolved/regressed，可选）" }),
        ),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["weakPoints.list"](params);
        return {
          content: [
            textContent(`薄弱点列表：共 ${result.length} 个`),
            jsonContent(result),
          ],
          details: {
            count: result.length,
            weakPoints: result,
          },
        };
      },
    },
  ];
}

/** S4 工具名清单（用于断言） */
export const S4_TOOL_NAMES = [
  "studybuddy_archive_mistake",
  "studybuddy_confirm_error_cause",
  "studybuddy_redo_mistake",
  "studybuddy_aggregate_weak_point",
] as const;

/** S4 工具数量 */
export const S4_TOOL_COUNT = S4_TOOL_NAMES.length;
