/**
 * pi-studybuddy agent-host toolchain handlers（06-API §3.16）
 *
 * toolchains.list/install/rescan 三 handler + toolchains.changed Stream 推送。
 */
import { createToolchainManager, type ToolchainManager } from "../../main/toolchains";
import type { ToolchainStatus } from "../../contract/types";

let _manager: ToolchainManager | null = null;

function getManager(): ToolchainManager {
  if (!_manager) {
    _manager = createToolchainManager();
  }
  return _manager;
}

export const toolchainHandlers = {
  "toolchains.list": async (): Promise<ToolchainStatus[]> => {
    return getManager().list();
  },
  "toolchains.install": async (params: unknown): Promise<ToolchainStatus> => {
    const { capabilityId } = params as { capabilityId: string };
    return getManager().install(capabilityId);
  },
  "toolchains.rescan": async (): Promise<ToolchainStatus[]> => {
    return getManager().rescan();
  },
};

/** 注册 toolchain changed 回调（供 Stream 推送） */
export function onToolchainChanged(cb: (statuses: ToolchainStatus[]) => void): void {
  getManager().onChanged(cb);
}