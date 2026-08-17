/**
 * T-M4-003 settings.* RPC handlers（06-API §3.14 + 03-Arch §2.5）
 *
 * settings.get/update：读写业务数据根 config/settings.json
 * settings.getSimpleMode/setSimpleMode：Simple Mode 总开关（L2 知识库开关）
 *
 * 复用 model-config.ts 原子写模式（tmp + rename）。
 */
import fs from "node:fs";
import path from "node:path";
import type { AppSettings, ConfigAssetStatus, ConfigSectionAsset, ConfigSectionData } from "../../contract/types";
import type { CredentialService } from "../credential-client";
import { createVersionedConfigStore, type ConfigAssetStatus as StorageConfigAssetStatus } from "../../agent/config-store";
import { readModelConfigWithStatus } from "../../agent/model-config";
import { readSettings, readSettingsWithStatus, writeSettings } from "../../agent/settings-config";

function toContractStatus(value: StorageConfigAssetStatus): ConfigAssetStatus {
  return value;
}

function parseSection(asset: ConfigSectionAsset, value: unknown): ConfigSectionData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (asset === "skills") {
    if (source.showUnavailableSkills !== undefined && typeof source.showUnavailableSkills !== "boolean") return null;
    return { showUnavailableSkills: source.showUnavailableSkills !== false };
  }
  if (source.checkUpdatesOnStart !== undefined && typeof source.checkUpdatesOnStart !== "boolean") return null;
  return { checkUpdatesOnStart: source.checkUpdatesOnStart !== false };
}

function sectionStore(asset: ConfigSectionAsset) {
  return createVersionedConfigStore<ConfigSectionData>({
    asset,
    fileName: `${asset}.json`,
    schemaVersion: 1,
    defaultData: () => asset === "skills" ? { showUnavailableSkills: true } : { checkUpdatesOnStart: true },
    parse: (value) => parseSection(asset, value),
  });
}

function readSection(dataRoot: string, asset: ConfigSectionAsset): ConfigSectionData {
  return sectionStore(asset).read(dataRoot).data;
}

function writeSection(dataRoot: string, asset: ConfigSectionAsset, data: unknown): ConfigSectionData {
  const parsed = parseSection(asset, data);
  if (!parsed) throw { code: "BAD_REQUEST", message: "设置内容无效，请检查后重试" };
  sectionStore(asset).write(dataRoot, parsed);
  return parsed;
}

function runtimeCatalogStatus(dataRoot: string): ConfigAssetStatus {
  const file = path.join(dataRoot, "config", "pi-models.json");
  try {
    if (!fs.existsSync(file)) {
      return { asset: "pi-models", state: "created", message: "模型目录将在首次使用时创建。", recoverable: true };
    }
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { schemaVersion?: unknown; data?: { providers?: unknown }; providers?: unknown };
    const providers = parsed.schemaVersion === 1 ? parsed.data?.providers : parsed.providers;
    if (!providers || typeof providers !== "object" || Array.isArray(providers)) {
      return { asset: "pi-models", state: "recovered", message: "模型目录无效，请重新获取模型目录。", recoverable: true };
    }
    return { asset: "pi-models", state: "ready", message: "模型目录可用。", recoverable: true };
  } catch {
    return { asset: "pi-models", state: "recovered", message: "模型目录无效，请重新获取模型目录。", recoverable: true };
  }
}

async function credentialStatus(service?: Pick<CredentialService, "listKeys">): Promise<ConfigAssetStatus> {
  if (!service) return { asset: "credentials", state: "unavailable", message: "系统加密暂不可用，请解锁 Windows 后重试。", recoverable: true };
  try {
    await service.listKeys();
    return { asset: "credentials", state: "ready", message: "凭据仅由 Windows 加密保管库管理。", recoverable: true };
  } catch {
    return { asset: "credentials", state: "unavailable", message: "系统加密暂不可用，请解锁 Windows 后重试。", recoverable: true };
  }
}

export interface SettingsHandlersOptions {
  credentialService?: Pick<CredentialService, "listKeys">;
}

/**
 * 构造 settings.* handlers。
 * @param dataRoot 业务数据根路径
 */
export function createSettingsHandlers(dataRoot: string, options: SettingsHandlersOptions = {}) {
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
    "settings.getConfigStatus": async (): Promise<ConfigAssetStatus[]> => [
      toContractStatus(readSettingsWithStatus(dataRoot).status),
      toContractStatus(readModelConfigWithStatus(dataRoot).status),
      runtimeCatalogStatus(dataRoot),
      toContractStatus(sectionStore("skills").read(dataRoot).status),
      toContractStatus(sectionStore("console").read(dataRoot).status),
      await credentialStatus(options.credentialService),
    ],
    "settings.getSection": (params: unknown): ConfigSectionData => {
      const { asset } = params as { asset?: unknown };
      if (asset !== "skills" && asset !== "console") throw { code: "BAD_REQUEST", message: "不支持的设置分区" };
      return readSection(dataRoot, asset);
    },
    "settings.updateSection": (params: unknown): ConfigSectionData => {
      const { asset, data } = params as { asset?: unknown; data?: unknown };
      if (asset !== "skills" && asset !== "console") throw { code: "BAD_REQUEST", message: "不支持的设置分区" };
      return writeSection(dataRoot, asset, data);
    },
    "settings.setSimpleMode": (params: unknown): void => {
      const { enabled } = params as { enabled: boolean };
      const current = readSettings(dataRoot);
      writeSettings(dataRoot, { ...current, simpleMode: enabled });
    },
  };
}
