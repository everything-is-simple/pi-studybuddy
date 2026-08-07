/**
 * pi-studybuddy toolchain 通用 probe 框架（03-Arch §6.5 第 2 点）
 *
 * 对非 Node 的 13 种 capability 通过 `--version` 探测版本 + health 判定。
 * 仅区分 healthy（有 stdout 输出）和 unsupported（执行失败）。
 */
import { execFileSync } from "node:child_process";

export interface CapabilityProbeResult {
  health: "unsupported" | "healthy";
  version?: string;
}

/**
 * 通用 probe：执行 <execPath> --version，解析 stdout 判定 health。
 * @param execPath 可执行文件路径
 * @param timeout 超时（毫秒，默认 5000）
 */
export function probeCapability(execPath: string, timeout = 5000): CapabilityProbeResult {
  try {
    const stdout = execFileSync(execPath, ["--version"], {
      encoding: "utf-8",
      timeout,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const version = parseVersion(stdout);
    return { health: "healthy", version };
  } catch {
    return { health: "unsupported" };
  }
}

/** 从 `<tool> --version` 输出中提取首个数字版本号 */
function parseVersion(stdout: string): string | undefined {
  const match = stdout.trim().match(/(\d+\.\d+(?:\.\d+)?)/);
  return match?.[1];
}