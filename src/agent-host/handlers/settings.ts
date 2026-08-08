/**
 * T-M4-003 settings.* RPC handlers（06-API §3.14 + 03-Arch §2.5）
 *
 * settings.get/update：读写业务数据根 config/settings.json
 * settings.getSimpleMode/setSimpleMode：Simple Mode 总开关（L2 知识库开关）
 *
 * 复用 model-config.ts 原子写模式（tmp + rename）。
 */
import type { AppSettings } from "../../contract/types";
import { readSettings, writeSettings } from "../../agent/settings-config";

/**
 * 构造 settings.* handlers。
 * @param dataRoot 业务数据根路径
 */
export function createSettingsHandlers(dataRoot: string) {
  return {
    "settings.get": (): AppSettings => readSettings(dataRoot),
    "settings.update": (params: unknown): AppSettings => {
      const fields = params as Partial<AppSettings>;
      const current = readSettings(dataRoot);
      const updated: AppSettings = { ...current, ...fields };
      writeSettings(dataRoot, updated);
      return updated;
    },
    "settings.getSimpleMode": (): boolean => readSettings(dataRoot).simpleMode,
    "settings.setSimpleMode": (params: unknown): void => {
      const { enabled } = params as { enabled: boolean };
      const current = readSettings(dataRoot);
      writeSettings(dataRoot, { ...current, simpleMode: enabled });
    },
  };
}
