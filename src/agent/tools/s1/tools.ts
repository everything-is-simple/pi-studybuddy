/**
 * T-M1-001 S1 registerTool 工具定义（03-Arch §3.1 + §2.2 ToolDefinition 契约）
 *
 * 6 个 studybuddy_* 工具，execute 薄封装调用同一 handler 函数（06-API §3.3）。
 * 工具名匹配 ^studybuddy_[a-z_]+$；ToolDefinition 必填 name/label/description/parameters/execute。
 *
 * 工具清单：
 *   1. studybuddy_init_semester        → semesters.create
 *   2. studybuddy_add_exam             → exams.add
 *   3. studybuddy_confirm_exam         → exams.confirm
 *   4. studybuddy_daily_brief          → tasks.dailyBrief
 *   5. studybuddy_complete_task        → tasks.complete
 *   6. studybuddy_transition_semester  → semesters.transition
 */
import { Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { S1Context } from "../../../agent-host/handlers/s1/context";
import { createS1Handlers } from "../../../agent-host/handlers/s1";

/** 工具 execute 返回的 content 文本块 */
function textContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

/** 把业务对象序列化为 LLM 可读的 JSON 文本块 */
function jsonContent(obj: unknown): { type: "text"; text: string } {
  return textContent(JSON.stringify(obj, null, 2));
}

/**
 * 创建 S1 全部 6 个 studybuddy_* 工具。
 * @param ctx S1 上下文（数据层句柄，由 studybuddy-extension 注入）
 */
export function createS1Tools(ctx: S1Context): ToolDefinition[] {
  const handlers = createS1Handlers(ctx);

  return [
    // 1. studybuddy_init_semester → semesters.create
    {
      name: "studybuddy_init_semester",
      label: "初始化学期",
      description:
        "创建一个新学期并初始化学期库。学生提供学期名称、起止日期和时区，系统会创建全局学期记录和学期数据库，并写入 semester_initialized 事件。",
      promptSnippet: "初始化学期：创建学期记录 + 学期库",
      parameters: Type.Object({
        label: Type.String({ description: "学期名称，如 '2026秋季'" }),
        startDate: Type.String({ description: "学期开始日期，ISO 8601 格式，如 '2026-09-01'" }),
        endDate: Type.String({ description: "学期结束日期，ISO 8601 格式，如 '2027-01-31'" }),
        timezone: Type.Optional(
          Type.String({ description: "时区，默认 'Asia/Shanghai'", default: "Asia/Shanghai" }),
        ),
      }),
      async execute(_toolCallId, params) {
        const { label, startDate, endDate, timezone } = params as {
          label: string; startDate: string; endDate: string; timezone?: string;
        };
        const result = handlers["semesters.create"]({
          label,
          startDate,
          endDate,
          timezone: timezone ?? "Asia/Shanghai",
        });
        return {
          content: [
            textContent(`学期已创建：${result.label}（${result.startDate} ~ ${result.endDate}）`),
            jsonContent(result),
          ],
          details: { semesterId: result.id, status: result.status },
        };
      },
    },

    // 2. studybuddy_add_exam → exams.add
    {
      name: "studybuddy_add_exam",
      label: "添加考试",
      description:
        "为指定课程添加一条考试记录（pending 状态）。学生需提供课程 ID、考试名称、类型、计划日期和来源。系统会写入 assessment_attempts 表和 exam_added 事件。",
      promptSnippet: "添加考试：写入 pending 考试记录",
      parameters: Type.Object({
        courseId: Type.String({ description: "课程实例 ID" }),
        examName: Type.String({ description: "考试名称，如 '期中考试'" }),
        examType: Type.Union(
          [
            Type.Literal("midterm"),
            Type.Literal("final"),
            Type.Literal("makeup"),
            Type.Literal("retake"),
            Type.Literal("quiz"),
          ],
          { description: "考试类型：midterm/final/makeup/retake/quiz" },
        ),
        scheduledDate: Type.String({ description: "计划日期，ISO 8601 格式，如 '2026-11-15'" }),
        source: Type.Union(
          [Type.Literal("student_input"), Type.Literal("ocr_schedule"), Type.Literal("ai_extracted")],
          { description: "来源：student_input/ocr_schedule/ai_extracted" },
        ),
        confidence: Type.Optional(Type.Number({ description: "置信度 0-1（OCR/AI 来源时可选）" })),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["exams.add"](params);
        return {
          content: [
            textContent(
              `考试已添加：${result.examName}（${result.examType}），计划日期 ${result.scheduledDate}，状态 ${result.confirmationStatus}`,
            ),
            jsonContent(result),
          ],
          details: { examId: result.id, confirmationStatus: result.confirmationStatus },
        };
      },
    },

    // 3. studybuddy_confirm_exam → exams.confirm
    {
      name: "studybuddy_confirm_exam",
      label: "确认考试",
      description:
        "确认或拒绝一条考试记录。确认后写入 exam_confirmed 事件并标记学期就绪（ready=1）；拒绝则写入 rejected 状态。",
      promptSnippet: "确认考试：学生确认/拒绝考试记录",
      parameters: Type.Object({
        id: Type.String({ description: "考试记录 ID" }),
        confirmed: Type.Boolean({
          description: "true=确认考试（写 confirmed），false=拒绝（写 rejected）",
        }),
      }),
      async execute(_toolCallId, params) {
        const { id, confirmed } = params as { id: string; confirmed: boolean };
        const result = handlers["exams.confirm"]({ id, confirmed });
        return {
          content: [
            textContent(
              `考试已${confirmed ? "确认" : "拒绝"}：${result.examName}，状态 ${result.confirmationStatus}`,
            ),
            jsonContent(result),
          ],
          details: { examId: result.id, confirmationStatus: result.confirmationStatus },
        };
      },
    },

    // 4. studybuddy_daily_brief → tasks.dailyBrief
    {
      name: "studybuddy_daily_brief",
      label: "每日简报",
      description:
        "生成今日学习简报，聚合该学期下所有未完成且到期的任务。纯规则聚合（非 AI），按到期日期排序。",
      promptSnippet: "每日简报：聚合今日到期未完成任务",
      parameters: Type.Object({
        semesterId: Type.String({ description: "学期 ID" }),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["tasks.dailyBrief"](params);
        const taskLines = result.tasks.map(
          (t) => `  - [${t.priority}] ${t.title}（${t.taskType}，到期 ${t.dueDate ?? "无"}）`,
        );
        return {
          content: [
            textContent(
              `📅 ${result.date} 简报\n待办 ${result.pendingItems} 项：\n${taskLines.join("\n") || "  （无到期任务）"}`,
            ),
            jsonContent(result),
          ],
          details: { date: result.date, pendingItems: result.pendingItems },
        };
      },
    },

    // 5. studybuddy_complete_task → tasks.complete
    {
      name: "studybuddy_complete_task",
      label: "完成任务",
      description: "标记一条学习任务为已完成。写入 completed 状态、completed_at 时间戳和 task_completed 事件。",
      promptSnippet: "完成任务：标记任务已完成",
      parameters: Type.Object({
        id: Type.String({ description: "任务 ID" }),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["tasks.complete"](params);
        return {
          content: [
            textContent(`任务已完成：${result.title}（${result.taskType}）`),
            jsonContent(result),
          ],
          details: { taskId: result.id, status: result.status },
        };
      },
    },

    // 6. studybuddy_transition_semester → semesters.transition
    {
      name: "studybuddy_transition_semester",
      label: "学期状态迁移",
      description:
        "迁移学期状态。合法迁移路径：active→teaching_ended→follow_up→archived。非法迁移会抛 BAD_REQUEST。",
      promptSnippet: "学期状态迁移：active→teaching_ended→follow_up→archived",
      parameters: Type.Object({
        id: Type.String({ description: "学期 ID" }),
        status: Type.Union(
          [
            Type.Literal("teaching_ended"),
            Type.Literal("follow_up"),
            Type.Literal("archived"),
          ],
          {
            description: "目标状态：teaching_ended/follow_up/archived（active 不可作为目标）",
          },
        ),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["semesters.transition"](params);
        return {
          content: [
            textContent(`学期状态已迁移：${result.label} → ${result.status}`),
            jsonContent(result),
          ],
          details: { semesterId: result.id, status: result.status },
        };
      },
    },
  ];
}

/** S1 工具名清单（用于断言） */
export const S1_TOOL_NAMES = [
  "studybuddy_init_semester",
  "studybuddy_add_exam",
  "studybuddy_confirm_exam",
  "studybuddy_daily_brief",
  "studybuddy_complete_task",
  "studybuddy_transition_semester",
] as const;

/** S1 工具数量 */
export const S1_TOOL_COUNT = S1_TOOL_NAMES.length;
