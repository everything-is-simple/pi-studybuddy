/**
 * pi-studybuddy toolchain installer（03-Arch §6.5）。
 *
 * 当前版本只负责发现/验证本机工具，不携带可校验的下载源或安装包。
 * 因此禁止用创建空目录冒充安装成功；真实安装由受控依赖任务实现。
 */

export interface InstallResult {
  success: false;
  capabilityId: string;
  error: "INSTALLER_UNAVAILABLE";
}

export function install(capabilityId: string): InstallResult {
  return { success: false, capabilityId, error: "INSTALLER_UNAVAILABLE" };
}