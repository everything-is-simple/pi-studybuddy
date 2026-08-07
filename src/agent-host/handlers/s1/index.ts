/**
 * T-M1-001 S1 handler 装配出口（06-API §3.3 全部 25 方法）
 *
 * createS1Handlers(ctx) 返回 method→handler 映射，供 agent-host/index.ts 装配。
 */
import type { S1Context } from "./context";
import { createSemesterHandlers } from "./semesters";
import { createCourseHandlers } from "./courses";
import { createExamHandlers } from "./exams";
import { createScheduleHandlers } from "./schedule";
import { createTaskHandlers } from "./tasks";
import { createEventHandlers } from "./events";

export { S1Context } from "./context";

export function createS1Handlers(ctx: S1Context) {
  return {
    ...createSemesterHandlers(ctx),
    ...createCourseHandlers(ctx),
    ...createExamHandlers(ctx),
    ...createScheduleHandlers(ctx),
    ...createTaskHandlers(ctx),
    ...createEventHandlers(ctx),
  };
}
