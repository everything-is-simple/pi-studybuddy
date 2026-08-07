/**
 * T-M2-001 S5 handler 装配出口（06-API §3.7 全部 8 方法）
 *
 * createS5Handlers(ctx) 返回 method→handler 映射。
 * 当前通过 studybuddy-extension 的 registerTool 暴露给 AI（与 S1/S2/S3/S4 一致）；
 * Host RPC 接入留待壳层 UI 任务统一补全。
 */
import type { S5Context } from "./context";
import { createMockExamHandlers } from "./mock-exams";
import { createCramCardHandlers } from "./cram-cards";
import { createCramPlanHandlers } from "./cram-plan";

export { S5Context } from "./context";
export type { S5ContextOptions } from "./context";
export {
  createMockMockExamGenerator,
  createFailingMockExamGenerator,
} from "./mock-exam-generator";
export type {
  MockExamGenerator,
  MockExamQuestion,
} from "./mock-exam-generator";

export function createS5Handlers(ctx: S5Context) {
  return {
    ...createMockExamHandlers(ctx),
    ...createCramCardHandlers(ctx),
    ...createCramPlanHandlers(ctx),
  };
}
