/**
 * models.* RPC handlers（06-API §3.13 + AGENTS.md §9.5）。
 *
 * models.list 必须读取与生产 AgentSession 相同的业务数据根 pi-models.json。
 * 这保证设置页展示的 provider/model ID 就是运行时可解析的 ID；密钥仍只在 vault。
 */
import type { ModelConfig, ModelInfo, ModelProvider, ModelRouteConfig } from "../../contract/types";
import type { CredentialService } from "../credential-client";
import { readModelConfig, writeModelConfig } from "../../agent/model-config";
import {
  readRuntimeModelProviders,
  readRuntimeProviderConnection,
  writeRuntimeProviderModels,
} from "../studybuddy-extension-loader";

export interface ModelHandlersOptions {
  /** 在持久化新默认项前建立并切换生产 pi session。 */
  onModelConfigChange?: (config: ModelConfig) => Promise<void>;
  /** 仅用于请求认证；永不读取或返回 key 内容。 */
  credentialService?: Pick<CredentialService, "get">;
  /** 受控注入仅供离线测试；生产使用全局 fetch。 */
  fetchImpl?: typeof fetch;
}

function findModel(providers: ModelProvider[], providerId: string, modelId: string): boolean {
  return providers.some((provider) => provider.id === providerId && provider.models.some((model) => model.id === modelId));
}

function isProviderId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9._-]{1,160}$/i.test(value);
}

function modelsEndpoint(baseUrl: string): string {
  return new URL("models", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

function chatEndpoint(baseUrl: string): string {
  return new URL("chat/completions", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

function modelProbeError(status: number): { code: string; message: string } {
  if (status === 401 || status === 403) return { code: "BAD_REQUEST", message: "API Key 验证失败，请检查后重试" };
  if (status >= 500) return { code: "BAD_REQUEST", message: "模型服务暂时不可用，请稍后重试" };
  return { code: "BAD_REQUEST", message: "模型服务连接失败，请检查配置后重试" };
}

async function fetchProvider(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetchImpl(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw { code: "BAD_REQUEST", message: "模型服务连接失败，请检查网络和配置后重试" };
  }
}

function modelsFromProbePayload(value: unknown): ModelInfo[] {
  const data = value && typeof value === "object" ? (value as { data?: unknown }).data : undefined;
  if (!Array.isArray(data)) return [];
  const ids = new Set<string>();
  for (const candidate of data) {
    const id = candidate && typeof candidate === "object" ? (candidate as { id?: unknown }).id : undefined;
    if (typeof id === "string" && /^[a-z0-9._:-]{1,160}$/i.test(id)) ids.add(id);
  }
  return [...ids].slice(0, 100).map((id) => ({ id, name: id, input: ["text"] }));
}

export function createModelHandlers(dataRoot?: string, options: ModelHandlersOptions = {}) {
  return {
    "models.list": (): ModelProvider[] => dataRoot ? readRuntimeModelProviders(dataRoot) : [],
    "models.addProvider": (params: unknown): ModelProvider => {
      const { providerConfig } = params as { providerConfig?: Omit<ModelProvider, "models"> };
      if (!providerConfig?.id || !providerConfig.name || !providerConfig.providerType) {
        throw { code: "BAD_REQUEST", message: "模型提供方配置无效" };
      }
      return { ...providerConfig, models: [] };
    },
    "models.probe": async (params: unknown): Promise<ModelInfo[]> => {
      const { provider } = (params ?? {}) as { provider?: unknown };
      if (!dataRoot || !isProviderId(provider)) {
        throw { code: "BAD_REQUEST", message: "请选择可用的模型供应商" };
      }
      const connection = readRuntimeProviderConnection(dataRoot, provider);
      if (!connection || connection.api !== "openai-completions") {
        throw { code: "BAD_REQUEST", message: "当前供应商不支持模型发现" };
      }
      const apiKey = await options.credentialService?.get(`modelProvider:${provider}`);
      if (!apiKey) throw { code: "BAD_REQUEST", message: "请先保存该供应商的 API Key" };
      const response = await fetchProvider(options.fetchImpl ?? fetch, modelsEndpoint(connection.baseUrl), {
        headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) throw modelProbeError(response.status);
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw { code: "BAD_REQUEST", message: "模型服务返回无效目录，请检查供应商配置" };
      }
      const models = modelsFromProbePayload(payload);
      if (models.length === 0) throw { code: "BAD_REQUEST", message: "未发现可用聊天模型，请检查供应商权限" };
      writeRuntimeProviderModels(dataRoot, provider, models);
      return models;
    },
    "modelsConfig.get": (): ModelConfig => {
      const cfg = dataRoot ? readModelConfig(dataRoot) : null;
      return cfg ? { provider: cfg.provider, model: cfg.model, ...(cfg.fallbacks?.length ? { fallbacks: cfg.fallbacks } : {}), managed: cfg.managed } : { provider: "", model: "" };
    },
    "modelsConfig.test": async (params: unknown): Promise<{ ok: boolean; latencyMs: number; error?: string }> => {
      const startedAt = Date.now();
      const { provider, model, apiKey: temporaryApiKey } = params as { provider?: string; model?: string; apiKey?: string };
      const providerId = provider?.trim() ?? "";
      const modelId = model?.trim() ?? "";
      const providers = dataRoot ? readRuntimeModelProviders(dataRoot) : [];
      if (!providerId || !modelId) return { ok: false, latencyMs: Date.now() - startedAt, error: "请先选择供应商和模型" };
      if (!findModel(providers, providerId, modelId)) {
        return { ok: false, latencyMs: Date.now() - startedAt, error: "请先获取该供应商的模型目录" };
      }
      const connection = dataRoot ? readRuntimeProviderConnection(dataRoot, providerId) : null;
      if (!connection || connection.api !== "openai-completions") {
        return { ok: false, latencyMs: Date.now() - startedAt, error: "当前供应商不支持连接测试" };
      }
      const apiKey = temporaryApiKey?.trim() || await options.credentialService?.get(`modelProvider:${providerId}`);
      if (!apiKey) return { ok: false, latencyMs: Date.now() - startedAt, error: "请先保存该供应商的 API Key" };
      try {
        const response = await fetchProvider(options.fetchImpl ?? fetch, chatEndpoint(connection.baseUrl), {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: modelId, messages: [{ role: "user", content: "连接测试" }], max_tokens: 1, stream: false }),
        });
        if (!response.ok) {
          const error = modelProbeError(response.status);
          return { ok: false, latencyMs: Date.now() - startedAt, error: error.message };
        }
        return { ok: true, latencyMs: Date.now() - startedAt };
      } catch (error) {
        const message = error && typeof error === "object" && "message" in error ? (error as { message?: unknown }).message : undefined;
        return { ok: false, latencyMs: Date.now() - startedAt, error: typeof message === "string" ? message : "模型服务连接失败，请检查网络和配置后重试" };
      }
    },
    "modelsConfig.set": (params: unknown): ModelConfig | Promise<ModelConfig> => {
      const { provider, model, fallbacks } = params as { provider: string; model: string; fallbacks?: ModelRouteConfig[] };
      if (!provider?.trim() || !model?.trim()) throw { code: "BAD_REQUEST", message: "请选择可用 AI 模型" };
      const normalizedFallbacks = Array.isArray(fallbacks)
        ? fallbacks.filter((route) => route && typeof route.provider === "string" && typeof route.model === "string" && route.provider.trim() && route.model.trim()).slice(0, 5).map((route) => ({ provider: route.provider.trim(), model: route.model.trim(), ...(route.label?.trim() ? { label: route.label.trim() } : {}) }))
        : undefined;
      const next: ModelConfig = { provider: provider.trim(), model: model.trim(), ...(normalizedFallbacks?.length ? { fallbacks: normalizedFallbacks } : {}) };
      if (!options.onModelConfigChange) {
        if (dataRoot) writeModelConfig(dataRoot, next);
        return { ...next, managed: Boolean(dataRoot) };
      }
      return options.onModelConfigChange(next).then(() => {
        if (dataRoot) writeModelConfig(dataRoot, next);
        return { ...next, managed: Boolean(dataRoot) };
      });
    },
  };
}
