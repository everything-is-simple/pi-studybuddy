/**
 * T-M3-002 + T-M3-005 models.* RPC handlers（06-API §3.13 + AGENTS.md §9.5 物理隔离）
 *
 * models.list：返回受控 fixture 模型列表（08-Test §5.4 全 mock）。
 * modelsConfig.get/set：读写业务数据根 config/models.json（T-M3-005 裁决 1/3，
 * 共用 model-config 模块，01-TRD 裁决 3 落点=业务数据根）。
 *
 * 边界裁决（用户 2026-08-08 批准）：
 *   - 06-API §3.13 spec 原文为"从 ~/.pi/agent/models.json 读取"，与 AGENTS.md §9.5
 *     物理隔离（pi-studybuddy 不侵入 ~/.pi）冲突
 *   - T-M3-002 用受控 fixture 数据源，**不读真实 ~/.pi/agent/models.json**；
 *     T-M3-005 裁决 1 改业务数据根 config/models.json（落点修订见 06-API §3.13 supersedes）
 *   - 契约语义不变（06-API §3.13 已在 spec）
 *
 * 安全（02-PRD §5.2 密钥边界）：fixture 不含 apiKey/baseUrl（密钥只存 credential-vault，
 * 模型列表只存别名/配置）。modelsConfig 读写 config 仅含 provider/model 别名。
 */
import type { ModelProvider, ModelConfig } from "../../contract/types";
import { readModelConfig, writeModelConfig } from "../../agent/model-config";

/**
 * 受控 fixture（T-M3-005 裁决 5：纳入用户提供的真实 provider 别名，无 apiKey/baseUrl）：
 *   - deepseek 文字模型（DeepSeek V4 Flash / Pro）
 *   - agnes 多媒体模型（agnes-2.5-* / agnes-image-* / agnes-video-*）
 */
const MODEL_FIXTURE: ModelProvider[] = [
  {
    id: "deepseek",
    name: "DeepSeek 文字模型",
    providerType: "openai-compatible",
    models: [
      { id: "DeepSeek V4 Flash", name: "DeepSeek V4 Flash" },
      { id: "DeepSeek V4 Pro", name: "DeepSeek V4 Pro" },
    ],
  },
  {
    id: "agnes",
    name: "Agnes 多媒体模型",
    providerType: "openai-compatible",
    models: [
      { id: "agnes-2.5-flash", name: "Agnes 2.5 Flash" },
      { id: "agnes-2.5-pro", name: "Agnes 2.5 Pro" },
      { id: "agnes-image-2.1-flash", name: "Agnes Image 2.1 Flash" },
      { id: "agnes-video-v2.0", name: "Agnes Video 2.0" },
    ],
  },
];

/**
 * 构造 models.* handlers。
 * models.list：受控 fixture（不读真实 ~/.pi/agent）。
 * modelsConfig.get/set：读写业务数据根 config/models.json（T-M3-005 裁决 1/3）。
 * models.addProvider/probe/modelsConfig.test：保留完整 RPC 面；v0.1 不在 host 中探测外网，
 * 以明确的受控结果/错误取代“契约存在但生产未注册”。
 */
export function createModelHandlers(dataRoot?: string) {
  return {
    "models.list": (_params: unknown): ModelProvider[] => MODEL_FIXTURE,
    "models.addProvider": (params: unknown): ModelProvider => {
      const { providerConfig } = params as { providerConfig?: Omit<ModelProvider, "models"> };
      if (!providerConfig?.id || !providerConfig.name || !providerConfig.providerType) {
        throw { code: "BAD_REQUEST", message: "模型提供方配置无效" };
      }
      // 仅返回受控描述；不持久化 baseUrl，不触发网络访问。
      return { ...providerConfig, models: [] };
    },
    "models.probe": (_params: unknown): import("../../contract/types").ModelInfo[] => {
      throw { code: "BAD_REQUEST", message: "模型探测需要受控的提供方接入，当前版本未启用" };
    },
    "modelsConfig.get": (_params: unknown): ModelConfig => {
      const cfg = dataRoot ? readModelConfig(dataRoot) : null;
      return cfg ? { provider: cfg.provider, model: cfg.model, managed: cfg.managed } : { provider: "", model: "" };
    },
    "modelsConfig.test": (_params: unknown): { ok: boolean; latencyMs: number; error?: string } => ({
      ok: false,
      latencyMs: 0,
      error: "模型连通性测试需要受控的提供方接入，当前版本未启用",
    }),
    "modelsConfig.set": (params: unknown): ModelConfig => {
      const { provider, model } = params as { provider: string; model: string };
      if (!dataRoot) return { provider, model };
      writeModelConfig(dataRoot, { provider, model });
      return { provider, model, managed: true };
    },
  };
}