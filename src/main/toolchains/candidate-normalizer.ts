/**
 * pi-studybuddy toolchain 候选路径归一化/去重（03-Arch §6.5）
 *
 * 参考 pi-desktop candidate-normalizer.ts，独立重实现。
 */
import path from "node:path";

/** 归一化工具路径：统一分隔符、小写比较 key */
export function normalizeToolPath(filePath: string): string {
  return path.resolve(filePath);
}

/** 生成路径比较 key（Windows 不区分大小写） */
export function toolPathComparisonKey(filePath: string): string {
  const normalized = normalizeToolPath(filePath);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

/** 去重：相同 comparisonKey 的候选只保留第一个 */
export function normalizeAndDedupeCandidates(seeds: { path: string }[]): { path: string }[] {
  const seen = new Set<string>();
  const result: { path: string }[] = [];
  for (const seed of seeds) {
    const key = toolPathComparisonKey(seed.path);
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ path: seed.path });
    }
  }
  return result;
}