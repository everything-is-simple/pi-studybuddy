/**
 * T-M4-003 settings 持久化模块（06-API §3.14 + 03-Arch §4.5）
 *
 * 落点：<dataRoot>/config/settings.json（业务数据根，非 ~/.pi，AGENTS.md §9.5 物理隔离）。
 * 复用 model-config.ts 原子写模式（tmp + rename，单写进程无并发）。
 *
 * 仅存 simpleMode/backupSchedule 等非敏感设置（02-PRD §5.2 密钥边界）：
 * API key 在 credential-vault，本文件不含任何密钥明文。
 */
import path from "node:path";
import fs from "node:fs";
import type { AppSettings } from "../contract/types";

/** 配置文件相对业务数据根的路径 */
function settingsPath(dataRoot: string): string {
  return path.join(dataRoot, "config", "settings.json");
}

/** 默认设置（首次启动） */
const DEFAULT_SETTINGS: AppSettings = {
  simpleMode: false,
};

/**
 * 读取应用设置。文件不存在或解析失败 → 默认设置。
 */
export function readSettings(dataRoot: string): AppSettings {
  const file = settingsPath(dataRoot);
  if (!fs.existsSync(file)) return { ...DEFAULT_SETTINGS };
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...raw };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * 原子写应用设置：tmp 文件 + rename 覆盖。
 */
export function writeSettings(dataRoot: string, settings: AppSettings): void {
  const dir = path.join(dataRoot, "config");
  fs.mkdirSync(dir, { recursive: true });
  const file = settingsPath(dataRoot);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2), "utf8");
  fs.renameSync(tmp, file);
}
