/**
 * T-M4-003 settings 持久化模块（06-API §3.14 + 03-Arch §4.5）
 *
 * 落点：<dataRoot>/config/settings.json（业务数据根，非 ~/.pi，AGENTS.md §9.5 物理隔离）。
 * 复用 model-config.ts 原子写模式（tmp + rename，单写进程无并发）。
 *
 * 仅存 simpleMode/backupSchedule 等非敏感设置（02-PRD §5.2 密钥边界）：
 * API key 在 credential-vault，本文件不含任何密钥明文。
 */
import type { AppSettings } from "../contract/types";
import { createVersionedConfigStore, type ConfigReadResult } from "./config-store";

/** 默认设置（首次启动）；不含路径、密钥或瞬时运行 health。 */
const DEFAULT_SETTINGS: AppSettings = { simpleMode: false };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseSettings(value: unknown): AppSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.simpleMode !== undefined && typeof source.simpleMode !== "boolean") return null;
  if (source.dailyGoalMinutes !== undefined && !isFiniteNumber(source.dailyGoalMinutes)) return null;
  if (source.availableTime !== undefined && typeof source.availableTime !== "string") return null;
  if (source.ttsEngine !== undefined && source.ttsEngine !== "sapi" && source.ttsEngine !== "edge-tts") return null;
  if (source.ttsRate !== undefined && !isFiniteNumber(source.ttsRate)) return null;
  if (source.ttsVoice !== undefined && !["默认音色", "女声", "男声"].includes(String(source.ttsVoice))) return null;
  if (source.backupFrequency !== undefined && !["manual", "daily", "weekly"].includes(String(source.backupFrequency))) return null;
  if (source.experimentalFeatures !== undefined && typeof source.experimentalFeatures !== "boolean") return null;
  if (source.debugLogging !== undefined && typeof source.debugLogging !== "boolean") return null;
  return { ...DEFAULT_SETTINGS, ...source };
}

const settingsStore = createVersionedConfigStore<AppSettings>({
  asset: "settings",
  fileName: "settings.json",
  schemaVersion: 1,
  defaultData: () => ({ ...DEFAULT_SETTINGS }),
  parse: parseSettings,
});

/** 返回数据与本次读到的脱敏生命周期状态，供设置控制台显示。 */
export function readSettingsWithStatus(dataRoot: string): ConfigReadResult<AppSettings> {
  return settingsStore.read(dataRoot);
}

/** 保持既有调用面。 */
export function readSettings(dataRoot: string): AppSettings {
  return readSettingsWithStatus(dataRoot).data;
}

/** 原子写版本化普通设置。 */
export function writeSettings(dataRoot: string, settings: AppSettings): void {
  settingsStore.write(dataRoot, settings);
}
