/**
 * pi-studybuddy toolchain 环境工具（03-Arch §6.5）
 *
 * windowsNativePathToMsys：将 Windows 原生路径（C:\foo）转换为 MSYS2 风格（/c/foo）。
 * 参考 pi-desktop environment.ts。
 */

/**
 * 将 Windows 原生路径转换为 MSYS2 风格路径。
 * 例：C:\Users\foo → /c/Users/foo
 * 非 Windows 或非绝对路径返回原样。
 */
export function windowsNativePathToMsys(filePath: string): string {
  if (process.platform !== "win32") return filePath;
  const match = /^([a-zA-Z]):\\(.*)$/.exec(filePath);
  if (!match) return filePath;
  const drive = match[1].toLowerCase();
  const rest = match[2].replace(/\\/g, "/");
  return `/${drive}/${rest}`;
}