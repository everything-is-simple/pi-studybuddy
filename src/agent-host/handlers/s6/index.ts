/**
 * T-M2-002 S6 handler 装配出口（03-Arch §6.2）
 *
 * 聚合 reports/deliveries/report-targets 三个 handler 模块，导出 createS6Handlers。
 * 复用 S1-S5 模式：handler 工厂接收 S6Context，返回 method→fn 映射。
 */
import type { S6Context } from "./context";
import {
  handleReportsGenerate,
  handleReportsFreeze,
  handleReportsGet,
  handleReportsList,
} from "./reports";
import {
  handleDeliveriesDeliver,
  handleDeliveriesRetry,
  handleDeliveriesList,
} from "./deliveries";
import {
  handleReportTargetsList,
  handleReportTargetsCreate,
  handleReportTargetsUpdate,
  handleReportTargetsDelete,
  handleReportTargetsSendTestMessage,
} from "./report-targets";

export type S6Handlers = {
  "reports.generate": (params: unknown) => unknown;
  "reports.freeze": (params: unknown) => unknown;
  "reports.get": (params: unknown) => unknown;
  "reports.list": (params: unknown) => unknown;
  "deliveries.deliver": (params: unknown) => unknown;
  "deliveries.retry": (params: unknown) => unknown;
  "deliveries.list": (params: unknown) => unknown;
  "reportTargets.list": (params: unknown) => unknown;
  "reportTargets.create": (params: unknown) => unknown;
  "reportTargets.update": (params: unknown) => unknown;
  "reportTargets.delete": (params: unknown) => void;
  "reportTargets.sendTestMessage": (params: unknown) => unknown;
};

export function createS6Handlers(ctx: S6Context): S6Handlers {
  return {
    "reports.generate": handleReportsGenerate(ctx),
    "reports.freeze": handleReportsFreeze(ctx),
    "reports.get": handleReportsGet(ctx),
    "reports.list": handleReportsList(ctx),
    "deliveries.deliver": handleDeliveriesDeliver(ctx),
    "deliveries.retry": handleDeliveriesRetry(ctx),
    "deliveries.list": handleDeliveriesList(ctx),
    "reportTargets.list": handleReportTargetsList(ctx),
    "reportTargets.create": handleReportTargetsCreate(ctx),
    "reportTargets.update": handleReportTargetsUpdate(ctx),
    "reportTargets.delete": handleReportTargetsDelete(ctx),
    "reportTargets.sendTestMessage": handleReportTargetsSendTestMessage(ctx),
  };
}

export { S6Context } from "./context";
export type { S6ContextOptions } from "./context";
