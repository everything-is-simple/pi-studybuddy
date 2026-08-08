/**
 * T-M3-002 RED: models.list 最小 handler（受控 fixture 数据源）
 *
 * 权威依据：06-API §3.13（models.list 契约）+ AGENTS.md §9.5（物理隔离：
 * 不读真实 ~/.pi/agent/models.json，T-M3-002 用受控 fixture，真实读取属 T-M3-005）
 * + 08-Test §5.4（测试不连真实外部服务）。
 *
 * 安全：fixture 不含 apiKey/baseUrl（02-PRD §5.2 密钥只存 credential-vault）。
 */
import { describe, it, expect } from "vitest";
import { createModelHandlers } from "../../src/agent-host/handlers/models";

describe("models.list（06-API §3.13 + AGENTS.md §9.5 物理隔离）", () => {
  const handlers = createModelHandlers();

  it("返回受控 fixture ModelProvider[]（不读真实 ~/.pi/agent）", () => {
    const providers = handlers["models.list"]({});
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThanOrEqual(2);
    for (const p of providers) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.providerType).toBeTruthy();
      expect(Array.isArray(p.models)).toBe(true);
      for (const m of p.models) {
        expect(m.id).toBeTruthy();
        expect(m.name).toBeTruthy();
      }
    }
  });

  it("fixture 不泄漏 apiKey（02-PRD §5.2 密钥边界）", () => {
    const providers = handlers["models.list"]({});
    const raw = JSON.stringify(providers);
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("api_key");
    // 不泄漏真实密钥形态（sk-* / Bearer）
    expect(raw).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
    expect(raw).not.toMatch(/Bearer\s+\S+/);
  });
});
