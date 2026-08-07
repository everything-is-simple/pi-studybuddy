/**
 * pi-studybuddy toolchain installer（03-Arch §6.5 第 3 点）
 *
 * 安装到 app.getPath("userData") 托管目录，不修改系统 PATH/注册表。
 * 本任务仅框架——install() 返回 health=unverified，不实现实际下载。
 * 托管组件下载器（portable-git/node-lts/ripgrep bundled 等）在后续任务实现。
 */
import fs from "node:fs";
import { installDir, setBaseDir } from "./paths";

export interface InstallResult {
  success: boolean;
  capabilityId: string;
  installPath: string;
}

/**
 * 安装指定 capability（框架实现：仅确保目录存在，不实际下载）。
 * 实际下载由后续任务补充。
 */
export function install(capabilityId: string): InstallResult {
  const dir = installDir(capabilityId);
  fs.mkdirSync(dir, { recursive: true });
  return { success: true, capabilityId, installPath: dir };
}