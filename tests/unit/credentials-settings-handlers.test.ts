/**
 * T-M4-003 credentials + settings handler 单件测试（06-API §3.14 + §3.15）
 *
 * 断言：
 *   - CRED-01 credentials.set/get 往返
 *   - CRED-02 credentials.get 不存在 → { value: "" }
 *   - CRED-03 credentials.delete
 *   - CRED-04 credentials.listKeys + prefix 过滤
 *   - CRED-05 非法键名抛错（modelProvider:xxx / parentContact:xxx 限制）
 *   - SET-01 settings.get 默认 simpleMode=false
 *   - SET-02 settings.update 合并字段
 *   - SET-03 settings.getSimpleMode / setSimpleMode
 *   - SET-04 持久化：重读文件值一致
 *
 * 2026-08-11：credentials.* handler 改为 async CredentialService（生产 parentPort 委托
 * main DPAPI vault；测试用 mock vault）。RPC server 支持 Promise 结果。
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M4-003\。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { createSettingsHandlers } from "../../src/agent-host/handlers/settings";
import { readSettings } from "../../src/agent/settings-config";

/** Windows SQLite/文件可能短暂锁定，清理时容错 */
function safeRmSync(p: string): void {
  try {
    rmSync(p, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M4-003\\unit";

// ── credentials handler 测试：用 mock CredentialService 避免依赖 electron safeStorage ──

/** Mock CredentialService（模拟 main DPAPI vault 委托，不依赖 electron） */
function createMockCredentialService() {
  const store = new Map<string, string>();
  const KEY_PATTERN = /^(modelProvider|parentContact):[a-z0-9._-]{1,160}$/i;
  function validateKey(key: string): string {
    const trimmed = key.trim();
    if (!KEY_PATTERN.test(trimmed)) {
      throw new Error("非法凭证键名：仅接受 modelProvider:xxx / parentContact:xxx");
    }
    return trimmed;
  }
  return {
    get: async (key: string): Promise<string | null> => store.get(validateKey(key)) ?? null,
    set: async (key: string, value: string): Promise<void> => {
      store.set(validateKey(key), value);
    },
    delete: async (key: string): Promise<void> => {
      store.delete(validateKey(key));
    },
    listKeys: async (prefix?: string): Promise<string[]> => {
      const keys = Array.from(store.keys());
      return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
    },
  };
}

import { createCredentialHandlers } from "../../src/agent-host/handlers/credentials";

describe("T-M4-003 credentials.* handler", () => {
  const vault = createMockCredentialService();
  const handlers = createCredentialHandlers(vault);

  beforeEach(async () => {
    await vault.set("modelProvider:deepseek", "sk-test-123");
    await vault.set("parentContact:mom_email", "mom@example.com");
  });

  it("CRED-01 credentials.set/get 往返", async () => {
    await handlers["credentials.set"]({ key: "modelProvider:agnes", value: "sk-agnes-456" });
    const result = await handlers["credentials.get"]({ key: "modelProvider:agnes" });
    expect(result.value).toBe("sk-agnes-456");
  });

  it("CRED-02 credentials.get 不存在 → { value: '' }", async () => {
    const result = await handlers["credentials.get"]({ key: "modelProvider:nonexistent" });
    expect(result.value).toBe("");
  });

  it("CRED-03 credentials.delete", async () => {
    await handlers["credentials.delete"]({ key: "modelProvider:deepseek" });
    const result = await handlers["credentials.get"]({ key: "modelProvider:deepseek" });
    expect(result.value).toBe("");
  });

  it("CRED-04 credentials.listKeys + prefix 过滤", async () => {
    const all = await handlers["credentials.listKeys"]({});
    expect(all).toContain("modelProvider:deepseek");
    expect(all).toContain("parentContact:mom_email");

    const filtered = await handlers["credentials.listKeys"]({ prefix: "modelProvider:" });
    expect(filtered.every((k) => k.startsWith("modelProvider:"))).toBe(true);
    expect(filtered).toContain("modelProvider:deepseek");
    expect(filtered).not.toContain("parentContact:mom_email");
  });

  it("CRED-05 非法键名抛错", async () => {
    await expect(handlers["credentials.set"]({ key: "invalid:bad", value: "x" })).rejects.toThrow();
    await expect(handlers["credentials.get"]({ key: "nope" })).rejects.toThrow();
  });
});

// ── settings handler 测试：真实文件持久化 ──

describe("T-M4-003 settings.* handler", () => {
  let dataRoot: string;

  beforeAll(() => {
    safeRmSync(ISOLATION_DIR);
    mkdirSync(ISOLATION_DIR, { recursive: true });
  });

  afterAll(() => {
    safeRmSync(ISOLATION_DIR);
  });

  beforeEach(() => {
    dataRoot = path.join(ISOLATION_DIR, `case-${Date.now()}`);
    mkdirSync(dataRoot, { recursive: true });
  });

  it("SET-01 settings.get 默认 simpleMode=false", () => {
    const handlers = createSettingsHandlers(dataRoot);
    const settings = handlers["settings.get"]();
    expect(settings.simpleMode).toBe(false);
  });

  it("SET-02 settings.update 合并字段", () => {
    const handlers = createSettingsHandlers(dataRoot);
    const updated = handlers["settings.update"]({ simpleMode: true }) as { simpleMode: boolean };
    expect(updated.simpleMode).toBe(true);
    // 重读确认持久化
    const reread = handlers["settings.get"]();
    expect(reread.simpleMode).toBe(true);
  });

  it("SET-03 settings.getSimpleMode / setSimpleMode", () => {
    const handlers = createSettingsHandlers(dataRoot);
    expect(handlers["settings.getSimpleMode"]()).toBe(false);
    handlers["settings.setSimpleMode"]({ enabled: true });
    expect(handlers["settings.getSimpleMode"]()).toBe(true);
  });

  it("SET-04 持久化：重读文件值一致", () => {
    const handlers1 = createSettingsHandlers(dataRoot);
    handlers1["settings.setSimpleMode"]({ enabled: true });

    // 新 handler 实例读同一 dataRoot（模拟重启）
    const handlers2 = createSettingsHandlers(dataRoot);
    expect(handlers2["settings.getSimpleMode"]()).toBe(true);

    // 直接读文件确认
    const fileSettings = readSettings(dataRoot);
    expect(fileSettings.simpleMode).toBe(true);
    expect(existsSync(path.join(dataRoot, "config", "settings.json"))).toBe(true);
  });
});
