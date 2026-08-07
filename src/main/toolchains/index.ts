/**
 * pi-studybuddy toolchain 发现-探测-安装-绝对路径（03-Arch §6.5）
 *
 * 统一出口：导出 TOOL_CAPABILITY_IDS 常量 + createToolchainManager 工厂。
 */
export { createToolchainManager } from "./manager";
export type { ToolchainManager } from "./manager";

/** 14 种 capability 清单（03-Arch §6.5，prep §四第 12 行） */
export const TOOL_CAPABILITY_IDS = [
  "shell.bash",
  "shell.powershell",
  "vcs.git",
  "js.node",
  "js.npm",
  "js.npx",
  "js.bun",
  "python.interpreter",
  "python.uv",
  "python.uvx",
  "search.rg",
  "search.fd",
  "data.jq",
  "network.curl",
] as const;

export type ToolCapabilityId = (typeof TOOL_CAPABILITY_IDS)[number];