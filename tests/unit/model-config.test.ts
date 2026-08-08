/**
 * T-M3-005 RED: model-config 模块（多模型持久化承载层）
 *
 * 权威依据：03-Arch §2.3（model_select 持久化默认模型，managed 标记）+ 裁决 1
 * （落点=业务数据根 config/models.json，原子写 + 测试隔离）+ 02-PRD §5.2
 * （config 不含 apiKey/baseUrl，密钥只存 credential-vault）。
 *
 * 数据隔离：PI_STUDYBUDDY_DATA_ROOT 指向 H:\pi-studybuddy-tmp\runs\T-M3-005\。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { readModelConfig, writeModelConfig, type ModelConfig } from "../../src/agent/model-config";

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M3-005\\model-config";

describe("model-config（T-M3-005 模型配置持久化承载层）", () => {
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

  it("config/models.json 不存在 → readModelConfig 返回 null", () => {
    const cfg = readModelConfig(ISOLATION_DIR);
    expect(cfg).toBeNull();
  });

  it("writeModelConfig 原子写 + __studybuddy_managed 标记 + updatedAt", () => {
    writeModelConfig(ISOLATION_DIR, { provider: "deepseek", model: "DeepSeek V4 Flash" });
    const filePath = path.join(ISOLATION_DIR, "config", "models.json");
    expect(existsSync(filePath)).toBe(true);
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    expect(raw.provider).toBe("deepseek");
    expect(raw.model).toBe("DeepSeek V4 Flash");
    expect(raw.__studybuddy_managed).toBe(true);
    expect(typeof raw.updatedAt).toBe("string");
  });

  it("writeModelConfig + readModelConfig 往返一致", () => {
    writeModelConfig(ISOLATION_DIR, { provider: "agnes", model: "agnes-2.5-pro" });
    const cfg = readModelConfig(ISOLATION_DIR) as ModelConfig;
    expect(cfg.provider).toBe("agnes");
    expect(cfg.model).toBe("agnes-2.5-pro");
  });

  it("config 文件不含 apiKey/baseUrl（02-PRD §5.2 密钥边界）", () => {
    writeModelConfig(ISOLATION_DIR, { provider: "deepseek", model: "DeepSeek V4 Flash" });
    const raw = readFileSync(path.join(ISOLATION_DIR, "config", "models.json"), "utf8");
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("baseUrl");
    expect(raw).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
  });
});