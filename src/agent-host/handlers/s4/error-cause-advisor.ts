/**
 * T-M1-004 S4 错因建议顾问接口（03-Arch §3.1 + 07-WF §2.5）
 *
 * 可注入接口（与 S3 QuestionGenerator 模式一致）。
 * 默认 mock：返回确定性建议 + 带"不确定"标记 + confidence。
 * AI 接入点预留：未来真实 LLM 实现此接口。
 *
 * 关键约束（07-WF §2.5）：
 *   - AI 只提建议，学生必须确认（error_cause_confirmed_by='student'）
 *   - AI 失败降级：suggestErrorCause 捕获异常返回 INTERNAL_ERROR，不阻塞学生手动确认
 *   - 建议必须带"不确定"标记（confidence 反映把握度）
 */
import type { ErrorCategory } from "../../../contract/types";

/** 错因建议结果 */
export interface ErrorCauseSuggestion {
  /** 建议正文（含"不确定"标记） */
  suggestion: string;
  /** AI 把握度（low=不确定，high=较确定） */
  confidence: "low" | "medium" | "high";
  /** 建议的错因分类（可选，供学生参考） */
  suggestedCategory?: ErrorCategory;
}

/** 错因建议顾问接口（可注入） */
export interface ErrorCauseAdvisor {
  /**
   * 根据错题上下文给出错因建议。
   * 失败时 throw Error，由调用方捕获降级为 INTERNAL_ERROR。
   * @param ctx 错题上下文（题目、学生答案、正确答案等）
   */
  suggest(ctx: ErrorCauseContext): ErrorCauseSuggestion;
}

/** 错题上下文（供 Advisor 分析） */
export interface ErrorCauseContext {
  mistakeId: string;
  questionStem: string;
  questionType: string;
  studentAnswer: unknown;
  correctAnswer: unknown;
  acceptableAnswers?: string[];
  explanation?: string;
}

/**
 * 默认 mock 错因建议顾问。
 *
 * 返回确定性建议（不调 LLM），带"不确定"标记 + confidence='low'。
 * 用于 TDD 单件/集成测试，以及 AI 未接入时的降级默认。
 */
export function createMockErrorCauseAdvisor(): ErrorCauseAdvisor {
  return {
    suggest(ctx: ErrorCauseContext): ErrorCauseSuggestion {
      // 简单启发式：基于题型给确定性建议（mock 不调 LLM）
      let suggestedCategory: ErrorCategory;
      let hint: string;
      if (ctx.questionType === "fill_blank") {
        suggestedCategory = "formula_error";
        hint = "填空题常见错因为公式记错或计算失误";
      } else if (ctx.questionType === "multiple_choice") {
        suggestedCategory = "concept_unclear";
        hint = "多选题漏选/错选常因概念边界不清";
      } else {
        suggestedCategory = "misread";
        hint = "单选题常因看错题干或选项";
      }
      return {
        suggestion: `[不确定] ${hint}，请结合题目确认错因`,
        confidence: "low",
        suggestedCategory,
      };
    },
  };
}

/**
 * 失败 mock：用于测试 AI 失败降级路径。
 * suggest 总是 throw Error，模拟 LLM 不可用。
 */
export function createFailingErrorCauseAdvisor(): ErrorCauseAdvisor {
  return {
    suggest(): ErrorCauseSuggestion {
      throw new Error("mock LLM unavailable");
    },
  };
}
