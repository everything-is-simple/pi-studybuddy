/**
 * T-M2-001 S5 临考速背 handler（06-API §3.7 cramCards.* + 07-WF §2.6）
 *
 * 1 方法：get
 *
 * 关键约束：
 *   - 确定性只读 DTO（不建表、不持久化、不依赖 AI）
 *   - 不暴露题干/答案/作答（仅 coreConcept/keyPoints/mnemonic/commonExamPattern/easyMistake/importance）
 *   - S5 只读复用 S2/S3/S4 摘要，不反写历史事实
 *   - 未确认考试 → BAD_REQUEST
 */
import type { CramCard } from "../../../contract/types";
import type { S5Context } from "./context";
import { badRequest } from "./errors";
import { findSemesterByAssessmentAttemptId } from "./lookup";
import { aggregateCramCards } from "./aggregator";

export function createCramCardHandlers(ctx: S5Context) {
  return {
    "cramCards.get": (params: unknown): CramCard[] => {
      const { assessmentAttemptId } = params as { assessmentAttemptId: string };
      const { db } = findSemesterByAssessmentAttemptId(ctx, assessmentAttemptId);

      // 查 assessment_attempt（必须 confirmed）
      const attemptRow = db
        .prepare("SELECT * FROM assessment_attempts WHERE id = @id")
        .get({ id: assessmentAttemptId }) as Record<string, unknown> | undefined;
      if (!attemptRow) throw badRequest("未找到该考试记录");

      if ((attemptRow.confirmation_status as string) !== "confirmed") {
        throw badRequest("该考试未确认，无法生成速背卡");
      }

      const courseId = attemptRow.course_instance_id as string;

      // 确定性聚合（只读，不写库）
      return aggregateCramCards(db, courseId);
    },
  };
}
