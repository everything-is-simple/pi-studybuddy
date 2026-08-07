/**
 * pi-studybuddy toolchain public-state（03-Arch §6.5）
 *
 * 构建公开 ToolchainStatus[] 状态。
 * 参考 pi-desktop public-state.ts，独立重实现。
 */
import type { ToolchainStatus } from "../../contract/types";
import { nameForCapability } from "./manager";

/** 从候选 + probe 结果构建 ToolchainStatus */
export function buildPublicToolchainState(
  capabilityId: string,
  health: ToolchainStatus["health"],
  version?: string,
  path?: string,
): ToolchainStatus {
  return {
    capabilityId,
    name: nameForCapability(capabilityId),
    health,
    ...(version !== undefined ? { version } : {}),
    ...(path !== undefined ? { path } : {}),
  };
}