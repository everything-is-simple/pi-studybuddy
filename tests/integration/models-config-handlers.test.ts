/**
 * T-M3-005 RED: modelsConfig.get/set handler + models.list fixture 更新
 *
 * 权威依据：06-API §3.13（modelsConfig.get/set 契约）+ 裁决 1（落点=业务数据根
 * config/models.json）+ 裁决 5（真实模型配置仅纳别名入 config，key 入 vault，
 * fixture 含 deepseek + agnes 两组 provider，无 apiKey/baseUrl）。
 *
 * 数据隔离：PI_STUDYBUDDY_DATA_ROOT 指向 H:\pi-studybuddy-tmp\runs\T-M3-005\。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync, rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createModelHandlers } from "../../src/agent-host/handlers/models";
import type { ModelProvider } from "../../src/contract/types";

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M3-005\\handlers";

describe("modelsConfig.* + models.list fixture（06-API §3.13 + §9.5 + 裁决 5）", () => {
  let originalDataRoot: string | undefined;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(path.join(ISOLATION_DIR, "config"), { recursive: true });
    originalDataRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
    process.env.PI_STUDYBUDDY_DATA_ROOT = ISOLATION_DIR;
  });

  afterAll(() => {
    if (originalDataRoot === undefined) {
      delete process.env.PI_STUDYBUDDY_DATA_ROOT;
    } else {
      process.env.PI_STUDYBUDDY_DATA_ROOT = originalDataRoot;
    }
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
  });

  it("modelsConfig.get 无配置 → 返回空（provider/model 空串）", () => {
    const handlers = createModelHandlers(ISOLATION_DIR);
    const cfg = handlers["modelsConfig.get"]({});
    expect(cfg).toBeDefined();
    expect(cfg.provider).toBe("");
    expect(cfg.model).toBe("");
  });

  it("modelsConfig.set 落库 → get 回读一致", () => {
    const handlers = createModelHandlers(ISOLATION_DIR);
    const written = handlers["modelsConfig.set"]({ provider: "deepseek", model: "DeepSeek V4 Flash" });
    expect(written.provider).toBe("deepseek");
    expect(written.model).toBe("DeepSeek V4 Flash");
    const read = handlers["modelsConfig.get"]({});
    expect(read.provider).toBe("deepseek");
    expect(read.model).toBe("DeepSeek V4 Flash");
  });

  it("modelsConfig.set 持久化有序 fallback 并在重启读取后保持一致", () => {
    const handlers = createModelHandlers(ISOLATION_DIR);
    const routes = [
      { provider: "pixelgpt", model: "gpt-5.6-terra", label: "second" },
      { provider: "agnes", model: "agnes-2.5-flash" },
    ];
    handlers["modelsConfig.set"]({ provider: "voklygpt", model: "gpt-5.6-terra", fallbacks: routes });

    expect(createModelHandlers(ISOLATION_DIR)["modelsConfig.get"]({})).toMatchObject({
      provider: "voklygpt",
      model: "gpt-5.6-terra",
      fallbacks: routes,
      managed: true,
    });
  });

  it("modelsConfig.set 保持既有 models.list fixture 不泄漏密钥", () => {
    const handlers = createModelHandlers(ISOLATION_DIR);
    handlers["modelsConfig.set"]({ provider: "agnes", model: "agnes-2.5-pro" });
    const providers = handlers["models.list"]({}) as ModelProvider[];
    const raw = JSON.stringify(providers);
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("api_key");
    expect(raw).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
  });

  it("生产模型切换成功后才持久化默认配置", async () => {
    const applied: Array<{ provider: string; model: string }> = [];
    const handlers = createModelHandlers(ISOLATION_DIR, {
      onModelConfigChange: async (config) => {
        applied.push(config);
      },
    });

    const result = await handlers["modelsConfig.set"]({ provider: "sharkgpt", model: "gpt-5.6-terra" });

    expect(applied).toEqual([{ provider: "sharkgpt", model: "gpt-5.6-terra" }]);
    expect(result).toMatchObject({ provider: "sharkgpt", model: "gpt-5.6-terra", managed: true });
    expect(handlers["modelsConfig.get"]({})).toMatchObject({ provider: "sharkgpt", model: "gpt-5.6-terra" });
  });

  it("生产模型切换失败时不覆盖当前默认配置", async () => {
    const handlers = createModelHandlers(ISOLATION_DIR, {
      onModelConfigChange: async () => {
        throw new Error("credential unavailable");
      },
    });
    const before = handlers["modelsConfig.get"]({});

    await expect(handlers["modelsConfig.set"]({ provider: "pixelgpt", model: "gpt-5.6-terra" })).rejects.toThrow("credential unavailable");

    expect(handlers["modelsConfig.get"]({})).toEqual(before);
  });

  it("models.list fixture 含已登记的真实 provider 模型", () => {
    const handlers = createModelHandlers(ISOLATION_DIR);
    const providers = handlers["models.list"]({}) as ModelProvider[];
    const ids = providers.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["deepseek", "agnes", "sharkgpt", "pixelgpt", "voklygpt", "chickfarmgpt"]));
    expect(providers.find((p) => p.id === "deepseek")?.models.map((m) => m.id)).toContain("deepseek-chat");
    expect(providers.find((p) => p.id === "agnes")?.models.map((m) => m.id)).toContain("agnes-2.5-flash");
  });

  it("models.probe 使用已保存的 key 读取 provider 并持久化发现的文本模型", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: "relay-chat" }, { id: "relay-reasoner" }, { id: "relay-chat" }, { id: "" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const handlers = createModelHandlers(ISOLATION_DIR, {
      credentialService: { get: async (key) => key === "modelProvider:sharkgpt" ? "temporary-secret" : null },
      fetchImpl,
    });

    await expect(handlers["models.probe"]({ provider: "sharkgpt" })).resolves.toEqual([
      { id: "relay-chat", name: "relay-chat", input: ["text"] },
      { id: "relay-reasoner", name: "relay-reasoner", input: ["text"] },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://shayulajiao.xyz/v1/models",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer temporary-secret" }) }),
    );

    const providers = handlers["models.list"]({}) as ModelProvider[];
    expect(providers.find((provider) => provider.id === "sharkgpt")?.models.map((model) => model.id)).toEqual([
      "gpt-5.6-terra",
      "gpt-5.5",
      "relay-chat",
      "relay-reasoner",
    ]);
    expect(readFileSync(path.join(ISOLATION_DIR, "config", "pi-models.json"), "utf8")).not.toContain("temporary-secret");
  });

  it("models.probe 认证失败不覆盖已有模型目录，且不回显端点或密钥", async () => {
    const initial = createModelHandlers(ISOLATION_DIR);
    const before = initial["models.list"]({}) as ModelProvider[];
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("denied", { status: 401 }));
    const handlers = createModelHandlers(ISOLATION_DIR, {
      credentialService: { get: async () => "temporary-secret" },
      fetchImpl,
    });

    await expect(handlers["models.probe"]({ provider: "sharkgpt" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "API Key 验证失败，请检查后重试",
    });
    expect(handlers["models.list"]({})).toEqual(before);
  });

  it("modelsConfig.test 使用选中模型发送最小连接请求，不发送学生数据", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { role: "assistant", content: "ok" } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const handlers = createModelHandlers(ISOLATION_DIR, {
      credentialService: { get: async () => "temporary-secret" },
      fetchImpl,
    });

    const result = await handlers["modelsConfig.test"]({ provider: "deepseek", model: "deepseek-chat" });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.deepseek.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer temporary-secret" }),
        body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: "连接测试" }], max_tokens: 1, stream: false }),
      }),
    );
  });
});