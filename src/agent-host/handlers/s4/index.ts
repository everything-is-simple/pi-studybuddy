/**
 * T-M1-004 S4 handler 装配出口（06-API §3.6 全部 10 方法）
 *
 * createS4Handlers(ctx) 返回 method→handler 映射。
 * 当前通过 studybuddy-extension 的 registerTool 暴露给 AI（与 S1/S2/S3 一致）；
 * Host RPC 接入留待壳层 UI 任务统一补全。
 */
import type { S4Context } from "./context";
import { createMistakeHandlers } from "./mistakes";
import { createWeakPointHandlers } from "./weakpoints";

export { S4Context } from "./context";
export { createMockErrorCauseAdvisor, createFailingErrorCauseAdvisor } from "./error-cause-advisor";
export type {
  ErrorCauseAdvisor,
  ErrorCauseContext,
  ErrorCauseSuggestion,
} from "./error-cause-advisor";

export function createS4Handlers(ctx: S4Context) {
  return {
    ...createMistakeHandlers(ctx),
    ...createWeakPointHandlers(ctx),
  };
}
