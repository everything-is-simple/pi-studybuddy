/**
 * T-M3-005 RED: modelsConfig.get/set handler + models.list fixture 更新
 *
 * 权威依据：06-API §3.13（modelsConfig.get/set 契约）+ 裁决 1（落点=业务数据根
 * config/models.json）+ 裁决 5（真实模型配置仅纳别名入 config，key 入 vault，
 * fixture 含 deepseek + agnes 两组 provider，无 apiKey/baseUrl）。
 *
 * 数据隔离：PI_STUDYBUDDY_DATA_ROOT 指向 H:\pi-studybuddy-tmp\runs\T-M3-005\。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
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

  it("modelsConfig.set 保持既有 models.list fixture 不泄漏密钥", () => {
    const handlers = createModelHandlers(ISOLATION_DIR);
    handlers["modelsConfig.set"]({ provider: "agnes", model: "agnes-2.5-pro" });
    const providers = handlers["models.list"]({}) as ModelProvider[];
    const raw = JSON.stringify(providers);
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("api_key");
    expect(raw).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
  });

  it("models.list fixture 含 deepseek + agnes 两组真 model provider（裁决 5）", () => {
    const handlers = createModelHandlers(ISOLATION_DIR);
    const providers = handlers["models.list"]({}) as ModelProvider[];
    const ids = providers.map((p) => p.id);
    expect(ids).toContain("deepseek");
    expect(ids).toContain("agnes");
    const deepseek = providers.find((p) => p.id === "deepseek");
    const agnes = providers.find((p) => p.id === "agnes");
    expect(deepseek?.models.map((m) => m.id)).toContain("DeepSeek V4 Flash");
    expect(deepseek?.models.map((m) => m.id)).toContain("DeepSeek V4 Pro");
    expect(agnes?.models.map((m) => m.id)).toContain("agnes-2.5-flash");
    expect(agnes?.models.map((m) => m.id)).toContain("agnes-2.5-pro");
    expect(agnes?.models.map((m) => m.id)).toContain("agnes-image-2.1-flash");
    expect(agnes?.models.map((m) => m.id)).toContain("agnes-video-v2.0");
  });
});