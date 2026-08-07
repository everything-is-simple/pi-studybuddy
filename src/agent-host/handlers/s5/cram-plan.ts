/**
 * T-M2-001 S5 冲刺计划 handler（06-API §3.7 cramPlan.* + 07-WF §2.6）
 *
 * 1 方法：get
 *
 * 关键约束：
 *   - 确定性即时只读 7 天 DTO（不建表、不持久化、不依赖 AI）
 *   - 不替学生改写事实（只读，不写库）
 *   - 按剩余天数 + 未完成任务 + 练习表现 + 错题 + 薄弱点排序
 *   - 未确认考试 → BAD_REQUEST
 */
import type { CramPlanDay } from "../../../contract/types";
import type { S5Context } from "./context";
import { badRequest } from "./errors";
import { findSemesterByAssessmentAttemptId } from "./lookup";
import { aggregateCramPlan } from "./aggregator";

export function createCramPlanHandlers(ctx: S5Context) {
  return {
    "cramPlan.get": (params: unknown): CramPlanDay[] => {
      const { assessmentAttemptId } = params as { assessmentAttemptId: string };
      const { db } = findSemesterByAssessmentAttemptId(ctx, assessmentAttemptId);

      // 查 assessment_attempt（必须 confirmed）
      const attemptRow = db
        .prepare("SELECT * FROM assessment_attempts WHERE id = @id")
        .get({ id: assessmentAttemptId }) as Record<string, unknown> | undefined;
      if (!attemptRow) throw badRequest("未找到该考试记录");

      if ((attemptRow.confirmation_status as string) !== "confirmed") {
        throw badRequest("该考试未确认，无法生成冲刺计划");
      }

      const courseId = attemptRow.course_instance_id as string;

      // 确定性聚合（只读，不写库）
      return aggregateCramPlan(db, courseId, assessmentAttemptId);
    },
  };
}
