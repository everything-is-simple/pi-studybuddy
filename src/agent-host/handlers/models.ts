/**
 * T-M3-002 models.* RPC handlers（06-API §3.13 + AGENTS.md §9.5 物理隔离）
 *
 * models.list：返回受控 fixture 模型列表（08-Test §5.4 全 mock）。
 *
 * 边界裁决（用户 2026-08-08 批准）：
 *   - 06-API §3.13 spec 原文为"从 ~/.pi/agent/models.json 读取"，与 AGENTS.md §9.5
 *     物理隔离（pi-studybuddy 不侵入 ~/.pi）冲突
 *   - T-M3-002 用受控 fixture 数据源，**不读真实 ~/.pi/agent/models.json**；
 *     真实模型配置读取 + model_select 钩子业务逻辑属 T-M3-005
 *   - 契约语义不变（06-API §3.13 已在 spec，无需改版本号）
 *
 * 安全（02-PRD §5.2 密钥边界）：fixture 不含 apiKey/baseUrl（密钥只存 credential-vault，
 * 模型列表只存别名/配置）。
 */
import type { ModelProvider } from "../../contract/types";

/** 受控 fixture：本地 + 云端两类 provider（无 apiKey/baseUrl） */
const MODEL_FIXTURE: ModelProvider[] = [
  {
    id: "local",
    name: "本地模型",
    providerType: "local",
    models: [
      { id: "deepseek-r1", name: "DeepSeek R1", contextWindow: 65536 },
      { id: "qwen2.5", name: "Qwen 2.5", contextWindow: 32768 },
    ],
  },
  {
    id: "cloud",
    name: "云端模型",
    providerType: "openai-compatible",
    models: [
      { id: "gpt-5", name: "GPT-5", contextWindow: 262144 },
      { id: "claude-sonnet-4", name: "Claude Sonnet 4", contextWindow: 200000 },
    ],
  },
];

/**
 * 构造 models.* handlers。
 * 当前实现 models.list（受控 fixture）；models.addProvider/probe/modelsConfig.*
 * 属 T-M3-005（真实模型配置读取），此处不注册，契约校验对无 handler 方法仅 WARN。
 */
export function createModelHandlers() {
  return {
    "models.list": (_params: unknown): ModelProvider[] => MODEL_FIXTURE,
  };
}
