/**
 * models.list 必须读取业务数据根的运行时目录，而不是 ~/.pi 目录或内置 fixture。
 *
 * 安全：返回的目录不含 apiKey/baseUrl（02-PRD §5.2 密钥边界）。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { createModelHandlers } from "../../src/agent-host/handlers/models";

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M5-005\\models-unit";

describe("models.list（06-API §3.13 + AGENTS.md §9.5 物理隔离）", () => {
  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(path.join(ISOLATION_DIR, "config"), { recursive: true });
  });

  afterAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
  });

  it("从隔离业务数据根返回默认目录，不读 ~/.pi/agent", () => {
    const providers = createModelHandlers(ISOLATION_DIR)["models.list"]({});
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThanOrEqual(2);
    expect(providers.find((provider) => provider.id === "deepseek")?.models.map((model) => model.id)).toEqual(
      expect.arrayContaining(["deepseek-chat", "deepseek-reasoner"]),
    );
    for (const provider of providers) {
      expect(provider.id).toBeTruthy();
      expect(provider.name).toBeTruthy();
      expect(provider.providerType).toBeTruthy();
      expect(Array.isArray(provider.models)).toBe(true);
      for (const model of provider.models) {
        expect(model.id).toBeTruthy();
        expect(model.name).toBeTruthy();
      }
    }
  });

  it("目录不泄漏 apiKey", () => {
    const raw = JSON.stringify(createModelHandlers(ISOLATION_DIR)["models.list"]({}));
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("api_key");
    expect(raw).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
    expect(raw).not.toMatch(/Bearer\s+\S+/);
  });
});
