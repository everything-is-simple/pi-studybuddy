/**
 * pi-studybuddy toolchain 托管目录路径管理（03-Arch §6.5 第 3 点）
 *
 * 安装到 app.getPath("userData")/toolchains/<capabilityId>/，不修改系统 PATH/注册表。
 * 测试中可注入 baseDir 覆盖。
 */
import path from "node:path";

/** 默认 userData 基目录（运行时由 main 进程 app.getPath("userData") 设置） */
let _baseDir = "";

export function setBaseDir(dir: string): void {
  _baseDir = dir;
}

export function getBaseDir(): string {
  if (!_baseDir) {
    throw new Error("toolchain baseDir not set — call setBaseDir(app.getPath('userData')) first");
  }
  return _baseDir;
}

/** 获取某个 capability 的安装目录 */
export function installDir(capabilityId: string): string {
  return path.join(getBaseDir(), "toolchains", capabilityId);
}

/** 获取 toolchain 根目录 */
export function toolchainDir(): string {
  return path.join(getBaseDir(), "toolchains");
}