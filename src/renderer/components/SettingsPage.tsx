/**
 * T-M4-006 设置页（09-UI §3.1 / §10 / §11 / §12 / §13.3）
 *
 * 设置是 AppShell 内的独立页面，而不是第 10 个工作台 Tab。
 * 所有数据经既有 typed RPC 读取或写入；密钥只用 credential-vault 的
 * listKeys / set / delete，不读取或渲染密钥明文。
 */
import React from "react";
import type { AppSettings, ModelConfig, ModelProvider, ToolchainStatus } from "../../contract/types";
import type { TypedRpcClient } from "../rpc-client";

export type CredentialKind = "model" | "email" | "feishu";

interface SafeModelInfo {
  id: string;
  name: string;
}

interface SafeModelProvider {
  id: string;
  name: string;
  models: SafeModelInfo[];
}

export interface SettingsView {
  dailyGoalMinutes: number;
  availableTime: string;
  ttsEngine: "sapi" | "edge-tts";
  ttsRate: number;
  ttsVoice: "默认音色" | "女声" | "男声";
  backupFrequency: "manual" | "daily" | "weekly";
  experimentalFeatures: boolean;
  debugLogging: boolean;
}

export interface SettingsPageData {
  settings: SettingsView;
  simpleMode: boolean;
  providers: SafeModelProvider[];
  modelConfig: ModelConfig;
  configuredCredentialKeys: Set<string>;
  toolchains: ToolchainStatus[];
}

interface Props {
  rpc?: TypedRpcClient;
  onClose?: () => void;
}

const DEFAULT_SETTINGS_VIEW: SettingsView = {
  dailyGoalMinutes: 60,
  availableTime: "",
  ttsEngine: "sapi",
  ttsRate: 1,
  ttsVoice: "默认音色",
  backupFrequency: "weekly",
  experimentalFeatures: false,
  debugLogging: false,
};

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const ABSOLUTE_PATH_PATTERN = /(?:[a-z]:[\\/]|\\\\(?:\?\\)?(?:[a-z]:[\\/]|[^\\/]+[\\/][^\\/]+)|(?:^|\s)\/\S*)/i;
const SECRET_PATTERN = /(?:\b(?:api[_-]?key|authorization|bearer)\b|\bsk-[a-z0-9_-]{8,})/i;
const STACK_PATTERN = /(?:^|\n)\s*at\s+.+\(/m;

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 8px",
  border: "1px solid var(--border, #d0d7de)",
  borderRadius: 6,
  background: "var(--bg, #ffffff)",
  color: "var(--text, #222)",
  fontSize: 13,
};

const buttonStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid var(--border, #d0d7de)",
  borderRadius: 6,
  background: "var(--bg, #ffffff)",
  color: "var(--text, #222)",
  cursor: "pointer",
  fontSize: 12,
};

function hasUnsafeDisplayContent(value: string): boolean {
  return UUID_PATTERN.test(value) || ABSOLUTE_PATH_PATTERN.test(value) || SECRET_PATTERN.test(value) || STACK_PATTERN.test(value);
}

/** 将 RPC 返回的展示文本收束为不含路径、密钥、UUID 或堆栈的信息。 */
export function safeDisplay(value: unknown, fallback = "未提供"): string {
  if (typeof value !== "string") return fallback;
  if (!value.trim() || hasUnsafeDisplayContent(value)) return "已隐藏敏感信息";
  const normalized = value.replace(/[\r\n\t]+/g, " ").trim().slice(0, 120);
  if (!normalized || hasUnsafeDisplayContent(normalized)) return "已隐藏敏感信息";
  return normalized;
}

function isSafeOpaqueValue(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 160 && !hasUnsafeDisplayContent(value);
}

/** 供应商 ID 同时是 credential-vault 键的一部分，必须服从键名白名单。 */
function isSafeProviderId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9._-]{1,160}$/i.test(value);
}


function clampNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}


/** 保存前收束受控数值，避免宽松 settings.update 将非法输入持久化。 */
export function normaliseSettingsUpdate(draft: SettingsView): SettingsView {
  return {
    ...draft,
    dailyGoalMinutes: Math.round(clampNumber(draft.dailyGoalMinutes, DEFAULT_SETTINGS_VIEW.dailyGoalMinutes, 10, 720)),
    ttsRate: clampNumber(draft.ttsRate, DEFAULT_SETTINGS_VIEW.ttsRate, 0.5, 2),
    availableTime: isSafeOpaqueValue(draft.availableTime) ? safeDisplay(draft.availableTime, "") : "",
  };
}

function settingsViewFrom(value: AppSettings): SettingsView {
  const ttsEngine = value.ttsEngine === "edge-tts" ? "edge-tts" : "sapi";
  const ttsVoice = value.ttsVoice === "女声" || value.ttsVoice === "男声" ? value.ttsVoice : "默认音色";
  const backupFrequency = value.backupFrequency === "manual" || value.backupFrequency === "daily" ? value.backupFrequency : "weekly";
  return {
    dailyGoalMinutes: Math.round(clampNumber(value.dailyGoalMinutes, DEFAULT_SETTINGS_VIEW.dailyGoalMinutes, 10, 720)),
    availableTime: isSafeOpaqueValue(value.availableTime) ? safeDisplay(value.availableTime, "") : "",
    ttsEngine,
    ttsRate: clampNumber(value.ttsRate, DEFAULT_SETTINGS_VIEW.ttsRate, 0.5, 2),
    ttsVoice,
    backupFrequency,
    experimentalFeatures: value.experimentalFeatures === true,
    debugLogging: value.debugLogging === true,
  };
}

function sanitizeProviders(value: ModelProvider[]): SafeModelProvider[] {
  return value.flatMap((provider) => {
    if (!isSafeProviderId(provider.id)) return [];
    const models = provider.models.flatMap((model) => {
      if (!isSafeOpaqueValue(model.id) || model.modality === "image" || model.modality === "video") return [];
      if (model.input && !model.input.includes("text")) return [];
      return [{ id: model.id, name: safeDisplay(model.name, "可用模型") }];
    });
    return [{ id: provider.id, name: safeDisplay(provider.name, "模型供应商"), models }];
  });
}

function sanitizeModelConfig(value: ModelConfig): ModelConfig {
  return {
    provider: isSafeProviderId(value.provider) ? value.provider : "",
    model: isSafeOpaqueValue(value.model) ? value.model : "",
    ...(value.managed === true ? { managed: true } : {}),
  };
}

/** ToolchainStatus 在 renderer 内主动丢弃 path，避免绝对路径进入 UI 状态。 */
export function sanitizeToolchainStatuses(value: unknown): ToolchainStatus[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const status = candidate as Partial<ToolchainStatus>;
    if (!isSafeOpaqueValue(status.capabilityId) || !isSafeOpaqueValue(status.name)) return [];
    if (status.health !== "unsupported" && status.health !== "unverified" && status.health !== "healthy") return [];
    const version = typeof status.version === "string" ? safeDisplay(status.version, "") : "";
    const reason = typeof status.reason === "string" ? safeDisplay(status.reason, "") : "";
    const recovery = typeof status.recovery === "string" ? safeDisplay(status.recovery, "") : "";
    return [
      {
        capabilityId: status.capabilityId,
        name: safeDisplay(status.name, "本机工具"),
        health: status.health,
        ...(version ? { version } : {}),
        ...(reason ? { reason } : {}),
        ...(recovery ? { recovery } : {}),
      },
    ];
  });
}
export async function loadSettingsPageData(rpc: TypedRpcClient): Promise<SettingsPageData> {
  const [settings, simpleMode, providers, modelConfig, modelKeys, parentContactKeys, toolchains] = await Promise.all([
    rpc.call("settings.get", {}),
    rpc.call("settings.getSimpleMode", {}),
    rpc.call("models.list", {}),
    rpc.call("modelsConfig.get", {}),
    rpc.call("credentials.listKeys", { prefix: "modelProvider:" }),
    rpc.call("credentials.listKeys", { prefix: "parentContact:" }),
    rpc.call("toolchains.list", {}),
  ]);

  return {
    settings: settingsViewFrom(settings),
    simpleMode,
    providers: sanitizeProviders(providers),
    modelConfig: sanitizeModelConfig(modelConfig),
    configuredCredentialKeys: configuredCredentialKeysFrom([...modelKeys, ...parentContactKeys]),
    toolchains: sanitizeToolchainStatuses(toolchains),
  };
}

/** 只保留当前设置页允许展示的 credential-vault 键名。 */
export function configuredCredentialKeysFrom(value: unknown): Set<string> {
  const keys = Array.isArray(value) ? value : [];
  return new Set(
    keys.filter(
      (key): key is string =>
        typeof key === "string" &&
        /^(?:modelProvider:[a-z0-9._-]{1,160}|parentContact:(?:email|feishu))$/i.test(key),
    ),
  );
}

/** 成功写入或移除后重新读取状态；绝不读取 credential 的值。 */
export async function loadConfiguredCredentialKeys(rpc: TypedRpcClient): Promise<Set<string>> {
  const [modelKeys, parentContactKeys] = await Promise.all([
    rpc.call("credentials.listKeys", { prefix: "modelProvider:" }),
    rpc.call("credentials.listKeys", { prefix: "parentContact:" }),
  ]);
  return configuredCredentialKeysFrom([...modelKeys, ...parentContactKeys]);
}

/** credential-vault 键名集中生成，防止 UI 拼接任意键名。 */
export function credentialKeyFor(kind: CredentialKind, providerId?: string): string {
  switch (kind) {
    case "model":
      if (!providerId || !/^[a-z0-9._-]{1,160}$/i.test(providerId)) {
        throw new Error("不支持的模型供应商");
      }
      return `modelProvider:${providerId}`;
    case "email":
      return "parentContact:email";
    case "feishu":
      return "parentContact:feishu";
  }
}

export async function saveCredential(rpc: TypedRpcClient, key: string, value: string): Promise<void> {
  if (!/^(?:modelProvider:[a-z0-9._-]{1,160}|parentContact:(?:email|feishu))$/i.test(key) || !value) {
    throw new Error("无效的密钥配置");
  }
  await rpc.call("credentials.set", { key, value });
}

/** 以单一 helper 固定通用设置写入的完整 RPC 参数映射，便于 TDD 复验。 */
export async function saveSettingsDraft(rpc: TypedRpcClient, draft: SettingsView): Promise<AppSettings> {
  const update = normaliseSettingsUpdate(draft);
  return rpc.call("settings.update", {
    dailyGoalMinutes: update.dailyGoalMinutes,
    availableTime: update.availableTime,
    ttsEngine: update.ttsEngine,
    ttsRate: update.ttsRate,
    ttsVoice: update.ttsVoice,
    backupFrequency: update.backupFrequency,
    experimentalFeatures: update.experimentalFeatures,
    debugLogging: update.debugLogging,
  });
}

/** 通过既有 settings API 更新简洁模式。 */
export async function setSimpleModePreference(rpc: TypedRpcClient, enabled: boolean): Promise<void> {
  await rpc.call("settings.setSimpleMode", { enabled });
}

/** 通过既有 modelsConfig API 更新默认模型。 */
export async function saveModelConfiguration(rpc: TypedRpcClient, provider: string, model: string): Promise<ModelConfig> {
  return rpc.call("modelsConfig.set", { provider, model });
}

/** 请求当前供应商目录；凭据仅由 agent-host 从 credential-vault 读取。 */
export async function probeProviderModels(rpc: TypedRpcClient, provider: string): Promise<SafeModelInfo[]> {
  if (!isSafeProviderId(provider)) throw new Error("不支持的模型供应商");
  const models = await rpc.call("models.probe", { provider });
  return models.flatMap((model) => {
    if (!isSafeOpaqueValue(model.id) || model.modality === "image" || model.modality === "video") return [];
    if (model.input && !model.input.includes("text")) return [];
    return [{ id: model.id, name: safeDisplay(model.name, "可用模型") }];
  });
}

/** 模型凭据由供应商 ID 分隔；标签必须显示当前选择，避免误以为不同供应商共用同一 Key。 */
export function providerCredentialLabel(provider?: SafeModelProvider): string {
  return provider ? `${provider.name} API Key` : "当前供应商 API Key";
}

/** 写入凭据保管库不等于远端服务已连通；远端验证由模型测试或实际投递单独报告。 */
export function credentialStatusLabel(configured: boolean): string {
  return configured ? "已保存，未验证服务可用性" : "未保存";
}

/** 只接受 credentialKeyFor 生成的受控键名删除凭据。 */
export async function deleteCredential(rpc: TypedRpcClient, key: string): Promise<void> {
  if (!/^(?:modelProvider:[a-z0-9._-]{1,160}|parentContact:(?:email|feishu))$/i.test(key)) {
    throw new Error("无效的密钥配置");
  }
  await rpc.call("credentials.delete", { key });
}

/** 目录只能由 main 原生选择器返回；安排迁移后路径不得进入 renderer 状态。 */
export async function scheduleSelectedDataRootMigration(
  bridge: Pick<import("../../contract/desktop").PiBridge, "selectDirectory" | "scheduleDataRootMigration"> | undefined,
): Promise<boolean> {
  if (!bridge) throw new Error("本机目录选择器暂不可用");
  const targetRoot = await bridge.selectDirectory();
  if (!targetRoot) return false;
  await bridge.scheduleDataRootMigration(targetRoot);
  return true;
}


/** 密钥仅在局部变量中短暂传递；读取 DOM 后立刻清空，成功或失败均不回显。 */
export function consumeCredentialInput(input: Pick<HTMLInputElement, "value"> | null): string {
  const value = input?.value ?? "";
  if (input) input.value = "";
  return value;
}

/** 初始 list 和 changed stream 竞态时，以已到达的最新 stream 快照为准。 */
export function preferredToolchainStatuses(
  listed: ToolchainStatus[],
  latestChanged: ToolchainStatus[] | null,
): ToolchainStatus[] {
  return latestChanged ?? listed;
}

export function subscribeToToolchainChanges(
  rpc: TypedRpcClient,
  onChanged: (statuses: ToolchainStatus[]) => void,
): () => void {
  return rpc.subscribe("toolchains.changed", undefined, (payload) => {
    onChanged(sanitizeToolchainStatuses(payload));
  });
}

/** 09-UI §13.3：只响应 Ctrl+,，不劫持带 Alt/Shift 的其他组合。 */
export function isSettingsShortcut(event: Pick<KeyboardEvent, "ctrlKey" | "key" | "altKey" | "shiftKey">): boolean {
  return event.ctrlKey && !event.altKey && !event.shiftKey && event.key === ",";
}

function healthLabel(health: ToolchainStatus["health"]): string {
  if (health === "healthy") return "健康";
  if (health === "unverified") return "待验证";
  return "未支持";
}

function toolchainOrder(statuses: ToolchainStatus[]): ToolchainStatus[] {
  const priority = ["js.node", "python.interpreter", "python.uv", "vcs.git"];
  return [...statuses].sort((left, right) => {
    const leftIndex = priority.indexOf(left.capabilityId);
    const rightIndex = priority.indexOf(right.capabilityId);
    return (leftIndex === -1 ? priority.length : leftIndex) - (rightIndex === -1 ? priority.length : rightIndex) || left.name.localeCompare(right.name);
  });
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section style={{ marginBottom: 18, padding: 16, border: "1px solid var(--border, #e0e0e0)", borderRadius: 8, background: "var(--bg, #ffffff)" }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 17, color: "var(--text, #222)" }}>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ display: "block", marginBottom: 12, color: "var(--text, #222)", fontSize: 13 }}>
      <span style={{ display: "block", marginBottom: 5, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

function CredentialControl({
  label,
  configured,
  inputRef,
  onSave,
  onDelete,
  disabled,
}: {
  label: string;
  configured: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSave: () => void;
  onDelete: () => void;
  disabled: boolean;
}): React.JSX.Element {
  return (
    <div style={{ padding: "10px 0", borderTop: "1px solid var(--border, #e0e0e0)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 7 }}>
        <strong style={{ color: "var(--text, #222)", fontSize: 13 }}>{label}</strong>
        <span aria-label={`${label}凭据状态`} style={{ color: configured ? "#137333" : "var(--text-muted, #666)", fontSize: 12 }}>
          {credentialStatusLabel(configured)}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          type="password"
          autoComplete="new-password"
          aria-label={`${label}密钥`}
          placeholder="输入后仅写入本机凭据保管库"
          disabled={disabled}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="button" onClick={onSave} disabled={disabled} style={buttonStyle}>保存</button>
        {configured ? <button type="button" onClick={onDelete} disabled={disabled} style={buttonStyle}>移除</button> : null}
      </div>
    </div>
  );
}

export function SettingsPage({ rpc, onClose }: Props): React.JSX.Element {
  const [pageData, setPageData] = React.useState<SettingsPageData | null>(null);
  const [draft, setDraft] = React.useState<SettingsView>(DEFAULT_SETTINGS_VIEW);
  const [modelConfig, setModelConfig] = React.useState<ModelConfig>({ provider: "", model: "" });
  const [simpleMode, setSimpleMode] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const modelSecretRef = React.useRef<HTMLInputElement>(null);
  const emailSecretRef = React.useRef<HTMLInputElement>(null);
  const feishuSecretRef = React.useRef<HTMLInputElement>(null);

  const refresh = React.useCallback(async () => {
    if (!rpc) return;
    try {
      const data = await loadSettingsPageData(rpc);
      setPageData(data);
      setDraft(data.settings);
      setModelConfig(data.modelConfig);
      setSimpleMode(data.simpleMode);
      setNotice("");
    } catch {
      setNotice("设置暂时无法读取，请稍后重试。");
    }
  }, [rpc]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const providers = pageData?.providers ?? [];
  const selectedProvider = providers.find((provider) => provider.id === modelConfig.provider) ?? providers[0];
  const selectedProviderId = selectedProvider?.id ?? "";
  const selectedModelId = selectedProvider?.models.some((model) => model.id === modelConfig.model)
    ? modelConfig.model
    : (selectedProvider?.models[0]?.id ?? "");

  function configured(key: string): boolean {
    return pageData?.configuredCredentialKeys.has(key) ?? false;
  }

  async function withBusy(action: () => Promise<void>, successMessage: string): Promise<void> {
    if (!rpc || busy) return;
    setBusy(true);
    try {
      await action();
      setNotice(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setNotice(safeDisplay(message, "操作未完成，请检查本机配置后重试。"));
    } finally {
      setBusy(false);
    }
  }

  function handleDraftSave(): void {
    if (!rpc) return;
    const update = normaliseSettingsUpdate(draft);
    void withBusy(async () => {
      const updated = await saveSettingsDraft(rpc, update);
      const settings = settingsViewFrom(updated);
      setDraft(settings);
      setPageData((previous) => previous ? { ...previous, settings } : previous);
    }, "学习偏好已保存。");
  }

  function handleSimpleMode(enabled: boolean): void {
    if (!rpc) return;
    void withBusy(async () => {
      await setSimpleModePreference(rpc, enabled);
      setSimpleMode(enabled);
    }, "简洁模式已更新。");
  }

  function handleModelSave(): void {
    if (!rpc || !selectedProviderId || !selectedModelId) return;
    void withBusy(async () => {
      const updated = await saveModelConfiguration(rpc, selectedProviderId, selectedModelId);
      setModelConfig(sanitizeModelConfig(updated));
    }, "默认模型已保存。");
  }
  function handleModelTest(): void {
    if (!rpc || !selectedProviderId || !selectedModelId) return;
    void withBusy(async () => {
      const result = await rpc.call("modelsConfig.test", { provider: selectedProviderId, model: selectedModelId });
      if (!result.ok) throw new Error(result.error ?? "模型配置不可用");
    }, "模型连接正常。");
  }

  function handleModelProbe(): void {
    if (!rpc || !selectedProviderId) return;
    void withBusy(async () => {
      const models = await probeProviderModels(rpc, selectedProviderId);
      const model = models[0]?.id ?? "";
      setPageData((previous) => previous
        ? {
            ...previous,
            providers: previous.providers.map((provider) => provider.id === selectedProviderId ? { ...provider, models } : provider),
          }
        : previous);
      setModelConfig({ provider: selectedProviderId, model });
    }, "模型目录已更新。请选择默认模型后测试连接。");
  }

  function handleCredential(kind: CredentialKind, inputRef: React.RefObject<HTMLInputElement | null>): void {
    if (!rpc) return;
    const providerId = kind === "model" ? selectedProviderId : undefined;
    const input = inputRef.current;
    const value = consumeCredentialInput(input);
    if (!value) {
      setNotice("请先输入密钥后再保存。");
      return;
    }
    let key: string;
    try {
      key = credentialKeyFor(kind, providerId);
    } catch {
      setNotice("请先选择可用的模型供应商。");
      return;
    }
    void withBusy(async () => {
      await saveCredential(rpc, key, value);
      const configuredCredentialKeys = await loadConfiguredCredentialKeys(rpc);
      setPageData((previous) => previous ? { ...previous, configuredCredentialKeys } : previous);
    }, "密钥已安全保存。");
  }

  function handleCredentialDelete(kind: CredentialKind): void {
    if (!rpc) return;
    let key: string;
    try {
      key = credentialKeyFor(kind, kind === "model" ? selectedProviderId : undefined);
    } catch {
      setNotice("请先选择可用的模型供应商。");
      return;
    }
    void withBusy(async () => {
      await deleteCredential(rpc, key);
      const configuredCredentialKeys = await loadConfiguredCredentialKeys(rpc);
      setPageData((previous) => previous ? { ...previous, configuredCredentialKeys } : previous);
    }, "密钥已移除。");
  }

  function handleDataRootMigration(): void {
    void withBusy(async () => {
      const scheduled = await scheduleSelectedDataRootMigration(globalThis.window?.piBridge);
      if (!scheduled) throw new Error("未选择数据根目录");
    }, "数据根迁移已安排。请关闭并重新打开应用后继续使用。");
  }


  return (
    <div style={{ flex: 1, overflow: "auto", padding: 20, background: "var(--bg-panel, #f5f5f5)", color: "var(--text, #222)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>⚙ 设置</h1>
            <p style={{ margin: "5px 0 0", color: "var(--text-muted, #666)", fontSize: 13 }}>本机学习偏好、密钥状态与工具链检查。</p>
          </div>
          {onClose ? <button type="button" onClick={onClose} style={buttonStyle}>返回学习工作台</button> : null}
        </header>

        {notice ? <div role="status" style={{ marginBottom: 14, padding: "8px 10px", borderRadius: 6, background: "#eef5ff", color: "#1a5fb4", fontSize: 13 }}>{notice}</div> : null}
        {!rpc ? <div role="status" style={{ marginBottom: 14, padding: "8px 10px", borderRadius: 6, background: "#fff8e1", color: "#7a5200", fontSize: 13 }}>设置服务暂不可用。</div> : null}

        <Section title="通用">
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>学习偏好</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <Field label="每日目标时长（分钟）">
              <input type="number" min={10} max={720} value={draft.dailyGoalMinutes} disabled={!rpc || busy} onChange={(event) => setDraft({ ...draft, dailyGoalMinutes: Number(event.target.value) })} style={inputStyle} />
            </Field>
            <Field label="可用时间">
              <input type="text" value={draft.availableTime} placeholder="如：19:00–21:00" disabled={!rpc || busy} onChange={(event) => setDraft({ ...draft, availableTime: event.target.value })} style={inputStyle} />
            </Field>
          </div>

          <h3 style={{ margin: "10px 0", fontSize: 14 }}>TTS</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Field label="默认引擎">
              <select value={draft.ttsEngine} disabled={!rpc || busy} onChange={(event) => setDraft({ ...draft, ttsEngine: event.target.value === "edge-tts" ? "edge-tts" : "sapi" })} style={inputStyle}>
                <option value="sapi">SAPI（本机）</option>
                <option value="edge-tts">Edge TTS</option>
              </select>
            </Field>
            <Field label="语速">
              <input type="number" min={0.5} max={2} step={0.1} value={draft.ttsRate} disabled={!rpc || busy} onChange={(event) => setDraft({ ...draft, ttsRate: Number(event.target.value) })} style={inputStyle} />
            </Field>
            <Field label="音色">
              <select value={draft.ttsVoice} disabled={!rpc || busy} onChange={(event) => setDraft({ ...draft, ttsVoice: event.target.value === "女声" || event.target.value === "男声" ? event.target.value : "默认音色" })} style={inputStyle}>
                <option value="默认音色">默认音色</option>
                <option value="女声">女声</option>
                <option value="男声">男声</option>
              </select>
            </Field>
          </div>

          <h3 style={{ margin: "10px 0", fontSize: 14 }}>备份</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <Field label="调度频率">
              <select value={draft.backupFrequency} disabled={!rpc || busy} onChange={(event) => setDraft({ ...draft, backupFrequency: event.target.value === "manual" || event.target.value === "daily" ? event.target.value : "weekly" })} style={inputStyle}>
                <option value="manual">手动</option>
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
              </select>
            </Field>
          </div>
          <p style={{ margin: "0 0 10px", color: "var(--text-muted, #666)", fontSize: 12 }}>备份目标目录在执行备份时通过系统目录选择器指定，不会写入或显示本机绝对路径。</p>
          <button type="button" onClick={handleDraftSave} disabled={!rpc || busy} style={buttonStyle}>保存通用设置</button>
        </Section>

        <Section title="安全">
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>模型供应商</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <Field label="默认供应商">
              <select value={selectedProviderId} disabled={!rpc || busy || providers.length === 0} onChange={(event) => {
                const provider = providers.find((item) => item.id === event.target.value);
                setModelConfig({ provider: event.target.value, model: provider?.models[0]?.id ?? "" });
              }} style={inputStyle}>
                {providers.length === 0 ? <option value="">暂无可用供应商</option> : providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
              </select>
            </Field>
            <Field label="默认模型">
              <select value={selectedModelId} disabled={!rpc || busy || !selectedProvider || selectedProvider.models.length === 0} onChange={(event) => setModelConfig({ provider: selectedProviderId, model: event.target.value })} style={inputStyle}>
                {selectedProvider?.models.length ? selectedProvider.models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>) : <option value="">请先获取模型目录</option>}
              </select>
            </Field>
          </div>
          {selectedProvider && selectedProvider.models.length === 0 ? <p style={{ margin: "0 0 10px", color: "var(--text-muted, #666)", fontSize: 12 }}>该中转供应商尚未发现可用聊天模型。先保存它的 API Key，再获取模型目录。</p> : <p style={{ margin: "0 0 10px", color: "var(--text-muted, #666)", fontSize: 12 }}>DeepSeek、Agnes 等内置供应商的目录已随应用提供；中转供应商可用“获取模型目录”刷新其账户可见模型。</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={handleModelProbe} disabled={!rpc || busy || !selectedProviderId || !configured(credentialKeyFor("model", selectedProviderId))} style={buttonStyle}>获取模型目录</button>
            <button type="button" onClick={handleModelSave} disabled={!rpc || busy || !selectedProviderId || !selectedModelId || !configured(credentialKeyFor("model", selectedProviderId))} style={buttonStyle}>保存默认模型</button>
            <button type="button" onClick={handleModelTest} disabled={!rpc || busy || !selectedProviderId || !selectedModelId || !configured(credentialKeyFor("model", selectedProviderId))} style={buttonStyle}>测试当前选中模型</button>
          </div>

          <h3 style={{ margin: "18px 0 6px", fontSize: 14 }}>密钥管理</h3>
          <p style={{ margin: "0 0 8px", color: "var(--text-muted, #666)", fontSize: 12 }}>密钥仅写入本机 credential-vault；页面只显示配置状态，不会读取或回显内容。</p>
          <CredentialControl label={providerCredentialLabel(selectedProvider)} configured={selectedProviderId ? configured(credentialKeyFor("model", selectedProviderId)) : false} inputRef={modelSecretRef} onSave={() => handleCredential("model", modelSecretRef)} onDelete={() => handleCredentialDelete("model")} disabled={!rpc || busy || !selectedProviderId} />
          <CredentialControl label="家长邮箱" configured={configured(credentialKeyFor("email"))} inputRef={emailSecretRef} onSave={() => handleCredential("email", emailSecretRef)} onDelete={() => handleCredentialDelete("email")} disabled={!rpc || busy} />
          <CredentialControl label="飞书渠道" configured={configured(credentialKeyFor("feishu"))} inputRef={feishuSecretRef} onSave={() => handleCredential("feishu", feishuSecretRef)} onDelete={() => handleCredentialDelete("feishu")} disabled={!rpc || busy} />

          <div style={{ marginTop: 14, padding: 12, borderRadius: 6, background: "var(--bg-panel, #f5f5f5)", fontSize: 13 }}>
            <strong>日志脱敏</strong>
            <p style={{ margin: "5px 0 0", color: "var(--text-muted, #666)" }}>日志不会记录密钥、模型完整输出、真实渠道地址、完整 UUID 或绝对路径。</p>
          </div>
          <div style={{ marginTop: 10, padding: 12, borderRadius: 6, background: "var(--bg-panel, #f5f5f5)", fontSize: 13 }}>
            <strong>数据根</strong>
            <p style={{ margin: "5px 0 8px", color: "var(--text-muted, #666)" }}>本机业务数据根已物理隔离。迁移会先复制并校验数据；完成后需重启应用生效。为保护隐私，页面不展示路径。</p>
            <button type="button" onClick={handleDataRootMigration} disabled={busy} style={buttonStyle}>选择新数据根并安排重启</button>
          </div>
        </Section>

        <Section title="开发者">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={draft.experimentalFeatures} disabled={!rpc || busy} onChange={(event) => setDraft({ ...draft, experimentalFeatures: event.target.checked })} />
              实验性功能
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={draft.debugLogging} disabled={!rpc || busy} onChange={(event) => setDraft({ ...draft, debugLogging: event.target.checked })} />
              调试日志（仅脱敏元数据）
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={simpleMode} disabled={!rpc || busy} onChange={(event) => handleSimpleMode(event.target.checked)} />
              简洁模式
            </label>
          </div>
          <h3 style={{ margin: "16px 0 8px", fontSize: 14 }}>本机工具检查</h3>
          <p style={{ margin: "0 0 8px", color: "var(--text-muted, #666)", fontSize: 12 }}>仅供诊断资料转换、课堂采集等功能依赖；模型、邮箱、飞书和备份不依赖这些工具。当前应用不携带下载源，缺失项不能在此自动安装。</p>
          {pageData?.toolchains.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            {toolchainOrder(pageData.toolchains).map((status) => <div key={status.capabilityId} style={{ padding: 8, border: "1px solid var(--border, #e0e0e0)", borderRadius: 6, fontSize: 12 }}>
              <strong>{status.name}</strong><br />{healthLabel(status.health)}{status.version ? ` · ${status.version}` : ""}
              {status.reason ? <div style={{ marginTop: 5, color: "var(--text-muted, #666)" }}>说明：{status.reason}</div> : null}
              {status.recovery ? <div style={{ marginTop: 3, color: "var(--text-muted, #666)" }}>恢复：{status.recovery}</div> : null}
            </div>)}
          </div> : <p style={{ margin: 0, color: "var(--text-muted, #666)", fontSize: 12 }}>暂未获得本机工具检查结果。</p>}
        </Section>
      </div>
    </div>
  );
}
