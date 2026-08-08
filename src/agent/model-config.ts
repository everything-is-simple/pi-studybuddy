/**
 * T-M3-005 model-config 模块（多模型持久化承载层，03-Arch §2.3 + 裁决 1）
 *
 * 落点：<dataRoot>/config/models.json（业务数据根，非 ~/.pi，AGENTS.md §9.5 物理隔离）。
 *
 * 仅存 provider/model 别名（02-PRD §5.2 密钥边界）：API key 在 credential-vault
 * （modelProvider:<provider>），baseUrl 归 provider 配置；本文件不含 key/baseUrl 明文。
 *
 * 原子写：tmp 文件写入 + rename 覆盖（单写进程无并发，AGENTS.md §1.1）。
 * managed 标记：__studybuddy_managed = true 表明该文件由 pi-studybuddy 管理。
 */
import path from "node:path";
import fs from "node:fs";

/** 模型配置（对齐 06-API §3.13 ModelConfig 契约 + 裁决 1 managed 标记） */
export interface ModelConfig {
  provider: string;
  model: string;
  /** 契约字段（可空，读取时由 __studybuddy_managed 映射） */
  managed?: boolean;
}

/** 磁盘文件结构（含 managed 标记 + 更新时间戳） */
interface ModelConfigFile {
  provider: string;
  model: string;
  __studybuddy_managed: boolean;
  updatedAt: string;
}

/** 配置文件相对业务数据根的路径 */
function configPath(dataRoot: string): string {
  return path.join(dataRoot, "config", "models.json");
}

/**
 * 读取默认模型配置。文件不存在或解析失败 → null（区别于"已配置"）。
 */
export function readModelConfig(dataRoot: string): ModelConfig | null {
  const file = configPath(dataRoot);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<ModelConfigFile>;
    if (typeof raw.provider !== "string" || typeof raw.model !== "string") return null;
    return {
      provider: raw.provider,
      model: raw.model,
      managed: raw.__studybuddy_managed === true,
    };
  } catch {
    // 解析失败视为未配置（不抛错，调用方按 null 处理）
    return null;
  }
}

/**
 * 原子写默认模型配置：tmp 文件 + rename 覆盖 + __studybuddy_managed 标记 + updatedAt。
 * 不落日志、不含 key/baseUrl（密钥边界由调用方保证）。
 */
export function writeModelConfig(dataRoot: string, config: ModelConfig): void {
  const dir = path.join(dataRoot, "config");
  fs.mkdirSync(dir, { recursive: true });
  const file = configPath(dataRoot);
  const tmp = `${file}.tmp`;
  const payload: ModelConfigFile = {
    provider: config.provider,
    model: config.model,
    __studybuddy_managed: true,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tmp, file);
}