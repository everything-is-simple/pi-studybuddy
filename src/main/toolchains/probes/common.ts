/**
 * pi-studybuddy toolchain probe 共享工具（03-Arch §6.5 第 2 点）
 *
 * 参考 pi-desktop probes/common.ts，独立重实现。
 */

/** 语义化版本比较：a < b → 负数，a === b → 0，a > b → 正数 */
export function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aNum = aParts[i] ?? 0;
    const bNum = bParts[i] ?? 0;
    if (aNum !== bNum) return aNum - bNum;
  }
  return 0;
}

/** 构建探测环境变量（PATH 隔离） */
export function buildProbeEnvironment(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return { ...env };
}

/** 从种子构建候选 */
export function candidateFromSeed(
  seed: { path: string },
  name: string,
  version?: string,
): { path: string; name: string; version?: string } {
  return { path: seed.path, name, version };
}

/** 构建失败候选 */
export function failedCandidate(
  seed: { path: string },
  name: string,
): { path: string; name: string } {
  return { path: seed.path, name };
}