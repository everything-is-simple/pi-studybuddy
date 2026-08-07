/**
 * T-M1-003 S3 handler 装配出口（06-API §3.5 全部 5 方法）
 *
 * createS3Handlers(ctx) 返回 method→handler 映射。
 * 当前通过 studybuddy-extension 的 registerTool 暴露给 AI（与 S1/S2 一致）；
 * Host RPC 接入留待壳层 UI 任务统一补全。
 */
import type { S3Context } from "./context";
import { createPracticeHandlers } from "./practice";

export { S3Context } from "./context";
export { createMockQuestionGenerator } from "./question-generator";
export type { QuestionGenerator, GeneratedQuestion } from "./question-generator";
export { gradeAnswer, normalizeText } from "./grader";

export function createS3Handlers(ctx: S3Context) {
  return {
    ...createPracticeHandlers(ctx),
  };
}
