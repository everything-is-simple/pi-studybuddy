/**
 * T-M3-002 allowed-roots 白名单校验（AGENTS.md §9.4 符号链接逃逸防护）
 *
 * @文件引用注入对话上下文前，文件路径必须经本模块校验：仅允许业务数据根
 * （PI_STUDYBUDDY_DATA_ROOT / %LOCALAPPDATA%\PiStudyBuddy）内的真实路径。
 *
 * 语义（07-WF §2.8 步骤 4）：选中的文件经 allowed-roots 校验后才读取内容。
 * 与 workspace-path-guard（T-M1-008，write/edit 拦截）互补——本模块管只读白名单。
 *
 * 安全：
 *   - realpath 归一化后再比对，防符号链接逃逸（目录内 symlink → 目录外真实路径）
 *   - Windows 大小写不敏感：统一转小写比较
 *   - 拒绝路径穿越（..）与空路径
 *   - 不落日志：summarizePathForDisplay 越权时只返回占位符
 */
import path from "node:path";
import fs from "node:fs";

/**
 * 解析业务数据根目录（与 studybuddy-extension.ts resolveDataRoot 语义一致，独立实现）：
 *   1. PI_STUDYBUDDY_DATA_ROOT 环境变量（测试注入隔离目录）
 *   2. %LOCALAPPDATA%\PiStudyBuddy（Windows 默认业务数据根）
 */
export function resolveDataRoot(): string {
  const envRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
  if (envRoot) return envRoot;
  const localAppData = process.env.LOCALAPPDATA ?? path.join(process.cwd(), ".data");
  return path.join(localAppData, "PiStudyBuddy");
}

/** Windows 大小写不敏感归一化（非 Windows 保持原样，小写兜底） */
function normalizeComparable(p: string): string {
  return p.toLowerCase();
}

/**
 * 判断绝对路径是否在业务数据根白名单内（AGENTS.md §9.4）。
 *
 * 逻辑：
 *   1. 空路径 / 非绝对路径 → false
 *   2. path.resolve 展开（消解 .. 穿越）
 *   3. 尽量 realpath（存在时解析符号链接；不存在则退回落 resolve 结果）
 *   4. 白名单判定：realResolved === dataRoot 或位于其前缀内（分隔符边界）
 */
export function isPathWithinAllowedRoot(absPath: string, dataRoot: string): boolean {
  if (!absPath || !dataRoot) return false;
  const resolved = path.resolve(absPath);
  const rootResolved = path.resolve(dataRoot);

  let real = resolved;
  let realRoot = rootResolved;
  try {
    real = fs.realpathSync(resolved);
  } catch {
    /* 路径不存在时退回落 resolve 结果（存在性由调用方处理） */
  }
  try {
    realRoot = fs.realpathSync(rootResolved);
  } catch {
    /* 数据根不存在时用 resolve 结果 */
  }

  const nReal = normalizeComparable(real);
  const nRoot = normalizeComparable(realRoot);
  if (nReal === nRoot) return true;
  // 分隔符边界：防止 prefix 相似误判（PiStudyBuddy2 不是白名单内）
  const sep = path.sep;
  return nReal.startsWith(`${nRoot}${sep}`);
}

/**
 * 展示用路径摘要（不落日志，仅 UI 展示）：
 *   白名单内 → 相对数据根的相对路径；越权 → "[外部路径]" 占位符（不泄漏路径）。
 */
export function summarizePathForDisplay(absPath: string, dataRoot: string): string {
  if (!isPathWithinAllowedRoot(absPath, dataRoot)) return "[外部路径]";
  const resolved = path.resolve(absPath);
  return path.relative(path.resolve(dataRoot), resolved);
}
