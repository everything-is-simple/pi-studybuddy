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
import { createVersionedConfigStore, type ConfigReadResult } from "./config-store";

/** 模型配置（对齐 06-API §3.13 ModelConfig 契约 + 裁决 1 managed 标记） */
export interface ModelConfig {
  provider: string;
  model: string;
  /** 契约字段（可空，读取时由 __studybuddy_managed 映射） */
  managed?: boolean;
}

interface StoredModelConfig {
  provider: string;
  model: string;
  managed: boolean;
}

function parseModelConfig(value: unknown): StoredModelConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (typeof source.provider !== "string" || typeof source.model !== "string") return null;
  if (!/^[a-z0-9._-]{0,160}$/i.test(source.provider) || source.model.length > 160) return null;
  return { provider: source.provider, model: source.model, managed: source.managed === true || source.__studybuddy_managed === true };
}

const modelConfigStore = createVersionedConfigStore<StoredModelConfig>({
  asset: "models",
  fileName: "models.json",
  schemaVersion: 1,
  defaultData: () => ({ provider: "", model: "", managed: true }),
  parse: parseModelConfig,
});

export function readModelConfigWithStatus(dataRoot: string): ConfigReadResult<StoredModelConfig> {
  return modelConfigStore.read(dataRoot);
}

/**
 * 读取默认模型配置。空 provider/model 仍表示尚未选择模型，保持既有调用语义。
 */
export function readModelConfig(dataRoot: string): ModelConfig | null {
  const config = readModelConfigWithStatus(dataRoot).data;
  if (!config.provider || !config.model) return null;
  return { provider: config.provider, model: config.model, managed: config.managed };
}

/** 原子写版本化默认模型配置；不落 key/baseUrl。 */
export function writeModelConfig(dataRoot: string, config: ModelConfig): void {
  modelConfigStore.write(dataRoot, { provider: config.provider, model: config.model, managed: true });
}