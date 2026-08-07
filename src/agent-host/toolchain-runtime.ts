/**
 * pi-studybuddy toolchain-runtime（03-Arch §6.5 第 4 点）
 *
 * prependPath：把托管工具目录前缀到 PATH，确保 Windows 下路径分隔符正确。
 * 参考 pi-desktop agent-host/toolchain-runtime.ts，独立重实现。
 */

/**
 * 把托管工具目录前缀到 PATH 环境变量。
 * 返回新对象，不修改原 env。
 */
export function prependPath(
  env: Record<string, string | undefined>,
  directories: string[],
  platform: string,
): Record<string, string | undefined> {
  const result = { ...env };
  const currentPath = result.PATH ?? "";
  const pathSeparator = platform === "win32" ? ";" : ":";
  const newPath = [...directories, ...(currentPath ? currentPath.split(pathSeparator) : [])]
    .join(pathSeparator);
  result.PATH = newPath;
  return result;
}