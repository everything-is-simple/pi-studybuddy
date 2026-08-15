/**
 * T-M4-006 RED：设置页 UI
 *
 * 权威依据：09-UI §3.1 / §10 / §11 / §12 / §13.3 / §14.2；06-API §3.13-§3.16。
 * 约束：仅使用既有 RPC；renderer 永不调用 credentials.get，不保留或回显密钥。
 */
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMockRpcClient } from "../../src/renderer/rpc-client";
import {
  SettingsPage,
  configuredCredentialKeysFrom,
  consumeCredentialInput,
  credentialKeyFor,
  isSettingsShortcut,
  loadConfiguredCredentialKeys,
  loadSettingsPageData,
  normaliseSettingsUpdate,
  preferredToolchainStatuses,
  safeDisplay,
  saveCredential,
  saveModelConfiguration,
  saveSettingsDraft,
  setSimpleModePreference,
  deleteCredential,
    probeProviderModels,
    providerCredentialLabel,
    credentialStatusLabel,
    scheduleSelectedDataRootMigration,
    subscribeToToolchainChanges,
  } from "../../src/renderer/components/SettingsPage";
describe("SettingsPage（09-UI §10 + §11）", () => {
  it("渲染通用、安全、开发者三组，且密钥输入框均为 password", () => {
    const html = renderToStaticMarkup(React.createElement(SettingsPage));

    expect(html).toContain("通用");
    expect(html).toContain("学习偏好");
    expect(html).toContain("TTS");
    expect(html).toContain("备份");
    expect(html).toContain("安全");
    expect(html).toContain("密钥管理");
    expect(html).toContain("日志脱敏");
    expect(html).toContain("开发者");
    expect(html).toContain("本机工具检查");
    expect(html).toContain("缺失项不能在此自动安装");
    expect(html).toContain("获取模型目录");
    expect(html).toContain("测试当前选中模型");
    expect(html).toContain("备份目标目录在执行备份时通过系统目录选择器指定");
    expect(html).toContain("未保存");
    expect(html).not.toContain("工具链健康检查");
    expect(html).not.toContain("备份目录名称");

    expect((html.match(/type="password"/g) ?? [])).toHaveLength(3);
    expect(html).toContain("本机业务数据根已物理隔离");
  });

  it("加载真实设置数据时只调用既有安全 RPC，且不保留工具绝对路径", async () => {
    const calls: string[] = [];
    const rpc = createMockRpcClient({
      "settings.get": () => {
        calls.push("settings.get");
        return {
          simpleMode: false,
          dailyGoalMinutes: 90,
          availableTime: "19:00–21:00",
          ttsEngine: "sapi",
          ttsRate: 1,
          ttsVoice: "默认音色",
          backupDirectoryName: "backups",
          backupFrequency: "weekly",
          experimentalFeatures: false,
          debugLogging: false,
        };
      },
      "settings.getSimpleMode": () => {
        calls.push("settings.getSimpleMode");
        return false;
      },
      "models.list": () => {
        calls.push("models.list");
        return [
          { id: "deepseek", name: "DeepSeek", providerType: "openai-compatible", models: [{ id: "v4", name: "V4" }, { id: "image", name: "Image", modality: "image" }] },
          { id: "xiaojigpt", name: "小鸡 GPT", providerType: "openai-compatible", models: [] },
          { id: "bad/provider", name: "Invalid", providerType: "openai-compatible", models: [] },
        ];
      },
      "modelsConfig.get": () => {
        calls.push("modelsConfig.get");
        return { provider: "deepseek", model: "v4", managed: true };
      },
      "credentials.listKeys": (params: unknown) => {
        calls.push(`credentials.listKeys:${(params as { prefix?: string }).prefix ?? ""}`);
        return ["modelProvider:deepseek", "parentContact:email"];
      },
      "toolchains.list": () => {
        calls.push("toolchains.list");
        return [{ capabilityId: "js.node", name: "Node.js", health: "healthy", version: "v24.14.0", path: "C:\\private\\node.exe" }];
      },
    });

    const data = await loadSettingsPageData(rpc);

    expect(calls).toEqual(expect.arrayContaining([
      "settings.get",
      "settings.getSimpleMode",
      "models.list",
      "modelsConfig.get",
      "credentials.listKeys:modelProvider:",
      "credentials.listKeys:parentContact:",
    ]));
    expect(calls).toContain("toolchains.list");
    expect(calls).not.toContain("credentials.get");
    expect(data.configuredCredentialKeys).toEqual(new Set(["modelProvider:deepseek", "parentContact:email"]));
    expect(data.providers).toEqual([
      { id: "deepseek", name: "DeepSeek", models: [{ id: "v4", name: "V4" }] },
      { id: "xiaojigpt", name: "小鸡 GPT", models: [] },
    ]);
    expect(data.toolchains).toEqual([{ capabilityId: "js.node", name: "Node.js", health: "healthy", version: "v24.14.0" }]);
  });

  it("所有外部展示文本都会隐藏路径、UUID、密钥和堆栈样式内容", () => {
    expect(safeDisplay("C:\\private\\node.exe")).toBe("已隐藏敏感信息");
    expect(safeDisplay("550e8400-e29b-41d4-a716-446655440000")).toBe("已隐藏敏感信息");
    expect(safeDisplay("Bearer sk-example-secret-value")).toBe("已隐藏敏感信息");
    expect(safeDisplay("Error\n    at sensitiveFunction (module.ts:1:1)")).toBe("已隐藏敏感信息");
    expect(safeDisplay("\\\\server\\private\\tool.exe")).toBe("已隐藏敏感信息");
    expect(safeDisplay("\\\\?\\C:\\private\\tool.exe")).toBe("已隐藏敏感信息");
    expect(safeDisplay("/opt/private/tool")).toBe("已隐藏敏感信息");
  });

  it("保存前规范化每日目标和 TTS 语速，且不再携带备份目录字段", () => {
    const update = normaliseSettingsUpdate({
      dailyGoalMinutes: Number.NaN,
      availableTime: "19:00–21:00",
      ttsEngine: "sapi",
      ttsRate: 9,
      ttsVoice: "默认音色",
      backupFrequency: "weekly",
      experimentalFeatures: false,
      debugLogging: false,
    });

    expect(update.dailyGoalMinutes).toBe(60);
    expect(update.ttsRate).toBe(2);
    expect(update).not.toHaveProperty("backupDirectoryName");
  });


  it("读取凭据输入后立即清空 DOM 值，失败路径也不会保留秘密", () => {
    const input = { value: "temporary-secret" };

    expect(consumeCredentialInput(input)).toBe("temporary-secret");
    expect(input.value).toBe("");
    expect(consumeCredentialInput(null)).toBe("");
  });

  it("凭据变更后仅重读允许的键名状态，不读取密钥值", async () => {
    const calls: string[] = [];
    const rpc = createMockRpcClient({
      "credentials.listKeys": (params: unknown) => {
        calls.push((params as { prefix?: string }).prefix ?? "");
        return ["modelProvider:deepseek", "parentContact:email", "unsafe:skip"];
      },
    });

    const keys = await loadConfiguredCredentialKeys(rpc);

    expect(calls).toEqual(["modelProvider:", "parentContact:"]);
    expect(keys).toEqual(new Set(["modelProvider:deepseek", "parentContact:email"]));
    expect(configuredCredentialKeysFrom(["parentContact:feishu", "not-allowed"])).toEqual(new Set(["parentContact:feishu"]));
  });

  it("密钥写入只接受受限 credential-vault 键名，且不会读取密钥", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "credentials.set": (params: unknown) => {
        calls.push({ method: "credentials.set", params });
      },
    });

    expect(credentialKeyFor("model", "deepseek")).toBe("modelProvider:deepseek");
    expect(credentialKeyFor("email")).toBe("parentContact:email");
    expect(credentialKeyFor("feishu")).toBe("parentContact:feishu");
    await saveCredential(rpc, "parentContact:email", "temporary-input");

    expect(calls).toEqual([{ method: "credentials.set", params: { key: "parentContact:email", value: "temporary-input" } }]);
  });

  it("实时 toolchains.changed 快照优先于较早的初始 list 结果", () => {
    const listed = [{ capabilityId: "js.node", name: "Node.js", health: "unverified" as const }];
    const changed = [{ capabilityId: "js.node", name: "Node.js", health: "healthy" as const }];

    expect(preferredToolchainStatuses(listed, changed)).toEqual(changed);
    expect(preferredToolchainStatuses(listed, null)).toEqual(listed);
  });

  it("toolchains.changed 流更新经过脱敏，路径不会进入页面状态", () => {
    let received: unknown;
    let unsubscribed = false;
    let streamHandler: ((payload: unknown) => void) | undefined;
    const rpc = {
      call: async () => undefined,
      subscribe: (_topic: string, _key: string | undefined, on: (payload: unknown) => void) => {
        streamHandler = on;
        return () => { unsubscribed = true; };
      },
      dispose: () => {},
    } as Parameters<typeof subscribeToToolchainChanges>[0];

    const unsubscribe = subscribeToToolchainChanges(rpc, (statuses) => {
      received = statuses;
    });
    streamHandler?.([{ capabilityId: "vcs.git", name: "Git", health: "healthy", path: "C:\\private\\git.exe" }]);

    expect(received).toEqual([{ capabilityId: "vcs.git", name: "Git", health: "healthy" }]);
    unsubscribe();
    expect(unsubscribed).toBe(true);
  });

  it("获取模型目录只发送 provider 标识，并过滤非文本模型", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "models.probe": (params: unknown) => {
        calls.push({ method: "models.probe", params });
        return [
          { id: "relay-chat", name: "Relay Chat", input: ["text"] },
          { id: "relay-image", name: "Relay Image", modality: "image" },
        ];
      },
    });

    await expect(probeProviderModels(rpc, "xiaojigpt")).resolves.toEqual([{ id: "relay-chat", name: "Relay Chat" }]);
    expect(calls).toEqual([{ method: "models.probe", params: { provider: "xiaojigpt" } }]);
  });

  it("模型密钥标签明确绑定当前供应商，凭据状态不声称服务已连通", () => {
    expect(providerCredentialLabel()).toBe("当前供应商 API Key");
    expect(providerCredentialLabel({ id: "deepseek", name: "DeepSeek 直连（文本）", models: [] })).toBe("DeepSeek 直连（文本） API Key");
    expect(credentialStatusLabel(false)).toBe("未保存");
    expect(credentialStatusLabel(true)).toBe("已保存，未验证服务可用性");
  });

  it("各项设置动作精确映射到既有 RPC 参数，且不触发工具安装 RPC", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "settings.update": (params: unknown) => {
        calls.push({ method: "settings.update", params });
        return { simpleMode: false, ...(params as object) };
      },
      "settings.setSimpleMode": (params: unknown) => calls.push({ method: "settings.setSimpleMode", params }),
      "modelsConfig.set": (params: unknown) => {
        calls.push({ method: "modelsConfig.set", params });
        return params;
      },
      "credentials.delete": (params: unknown) => calls.push({ method: "credentials.delete", params }),
    });

    await saveSettingsDraft(rpc, {
      dailyGoalMinutes: 999,
      availableTime: "19:00–21:00",
      ttsEngine: "edge-tts",
      ttsRate: 0.1,
      ttsVoice: "女声",
      backupFrequency: "daily",
      experimentalFeatures: true,
      debugLogging: true,
    });
    await setSimpleModePreference(rpc, true);
    await saveModelConfiguration(rpc, "deepseek", "v4");
    await deleteCredential(rpc, "parentContact:feishu");

    expect(calls).toEqual([
      { method: "settings.update", params: {
        dailyGoalMinutes: 720,
        availableTime: "19:00–21:00",
        ttsEngine: "edge-tts",
        ttsRate: 0.5,
        ttsVoice: "女声",
        backupFrequency: "daily",
        experimentalFeatures: true,
        debugLogging: true,
      } },
      { method: "settings.setSimpleMode", params: { enabled: true } },
      { method: "modelsConfig.set", params: { provider: "deepseek", model: "v4" } },
      { method: "credentials.delete", params: { key: "parentContact:feishu" } },
    ]);
    expect(calls.map((call) => call.method)).not.toContain("toolchains.install");
  });

  it("数据根迁移仅使用原生目录桥，并且不将路径写入页面状态", async () => {
    const calls: string[] = [];
    const bridge = {
      selectDirectory: async () => {
        calls.push("select");
        return "H:\\pi-studybuddy-tmp\\runs\\T-M5-010\\new-root";
      },
      scheduleDataRootMigration: async (target: string) => {
        calls.push(`schedule:${target}`);
      },
    };

    await expect(scheduleSelectedDataRootMigration(bridge)).resolves.toBe(true);
    await expect(scheduleSelectedDataRootMigration({ ...bridge, selectDirectory: async () => null })).resolves.toBe(false);
    expect(calls).toEqual(["select", "schedule:H:\\pi-studybuddy-tmp\\runs\\T-M5-010\\new-root"]);
  });

  it("凭据保存和移除后重读 key 状态，不读取密钥明文", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "credentials.set": (params: unknown) => calls.push({ method: "credentials.set", params }),
      "credentials.delete": (params: unknown) => calls.push({ method: "credentials.delete", params }),
      "credentials.listKeys": (params: unknown) => {
        calls.push({ method: "credentials.listKeys", params });
        return ["parentContact:email"];
      },
    });

    await saveCredential(rpc, "parentContact:email", "temporary-secret");
    const afterSave = await loadConfiguredCredentialKeys(rpc);
    await deleteCredential(rpc, "parentContact:email");
    const afterDelete = await loadConfiguredCredentialKeys(rpc);

    expect(afterSave).toEqual(new Set(["parentContact:email"]));
    expect(afterDelete).toEqual(new Set(["parentContact:email"]));
    expect(calls).toEqual([
      { method: "credentials.set", params: { key: "parentContact:email", value: "temporary-secret" } },
      { method: "credentials.listKeys", params: { prefix: "modelProvider:" } },
      { method: "credentials.listKeys", params: { prefix: "parentContact:" } },
      { method: "credentials.delete", params: { key: "parentContact:email" } },
      { method: "credentials.listKeys", params: { prefix: "modelProvider:" } },
      { method: "credentials.listKeys", params: { prefix: "parentContact:" } },
    ]);
    expect(calls.map((call) => call.method)).not.toContain("credentials.get");
  });

  it("Ctrl+, 是设置快捷键，其他组合不会误触发", () => {
    expect(isSettingsShortcut({ ctrlKey: true, key: ",", altKey: false, shiftKey: false })).toBe(true);
    expect(isSettingsShortcut({ ctrlKey: false, key: ",", altKey: false, shiftKey: false })).toBe(false);
    expect(isSettingsShortcut({ ctrlKey: true, key: "s", altKey: false, shiftKey: false })).toBe(false);
  });
});
