/**
 * T-M1-002 S2 handler 装配出口（06-API §3.4 全部 17 方法）
 *
 * createS2Handlers(ctx) 返回 method→handler 映射。
 * 当前通过 studybuddy-extension 的 registerTool 暴露给 AI（与 S1 一致）；
 * Host RPC 接入留待壳层 UI 任务统一补全（T-M1-001 §8 未解决事项 3）。
 */
import type { S2Context } from "./context";
import { createMaterialHandlers } from "./materials";
import { createNoteHandlers } from "./notes";
import { createModuleHandlers } from "./modules";
import { createJobHandlers } from "./jobs";

export { S2Context } from "./context";
export { createRuntimeS2Context } from "./runtime-context";

export function createS2Handlers(ctx: S2Context) {
  return {
    ...createMaterialHandlers(ctx),
    ...createNoteHandlers(ctx),
    ...createModuleHandlers(ctx),
    ...createJobHandlers(ctx),
  };
}
