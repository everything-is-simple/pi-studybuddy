import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { CredentialVault, type SafeStorageAdapter } from "../../src/main/credential-vault";

// src/main/credential-vault.ts 首行 import { safeStorage } from "electron"（INV-04 断言）。
// vitest(Node) 无 Electron 运行时，须 mock electron 模块使 import 安全加载，
// 单件测试通过构造注入 fake safeStorage 覆盖默认实现。
vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (v: string) => Buffer.from(v, "utf8"),
    decryptString: (b: Buffer) => b.toString("utf8"),
  },
}));

/**
 * T-M0-003 credential-vault 单件测试（03-Arch §4.5 + 08-Test §5.6 + 06-API §3.15）
 *
 * 断言：
 *   - safeStorage.encryptString/decryptString 往返一致（set→get 复原 value）
 *   - 私密性：磁盘文件不含明文 value（只存加密后 base64）
 *   - 写文件 mode 0o600（03-Arch §4.5 原子写 temp+rename）
 *   - 键名校验：合法 modelProvider:xxx / parentContact:xxx 通过，非法键拒绝
 *   - 06-API §3.15 四方法：set / get / delete / listKeys
 *   - listKeys 仅返回键名，不返回值
 *   - safeStorage 不可用时抛错（安全降级）
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M0-003\，不污染业务数据根。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M0-003\\unit";

/** 假 safeStorage：encryptString 加前缀、decryptString 去前缀，模拟 DPAPI 往返签名 */
const fakeSafeStorage: SafeStorageAdapter = {
  isEncryptionAvailable: () => true,
  encryptString: (value: string) => Buffer.from(`pseudocrypt:${value}`, "utf8"),
  decryptString: (buffer: Buffer) => {
    const text = buffer.toString("utf8");
    if (!text.startsWith("pseudocrypt:")) throw new Error("bad ciphertext");
    return text.slice("pseudocrypt:".length);
  },
};

function vaultPath(name: string): string {
  return path.join(ISOLATION_DIR, name);
}

describe("T-M0-003 credential-vault 单件测试", () => {
  beforeAll(() => {
    mkdirSync(ISOLATION_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
  });

  it("CV-01 set→get 往返一致（encryptString/decryptString）", () => {
    const file = vaultPath("cv-01.json");
    rmSync(file, { force: true });
    const vault = new CredentialVault(file, fakeSafeStorage);
    vault.set("modelProvider:openai", "sk-secret-123");
    expect(vault.get("modelProvider:openai")).toBe("sk-secret-123");
  });

  it("CV-02 磁盘文件不含明文 value（只存加密后 base64）", () => {
    const file = vaultPath("cv-02.json");
    rmSync(file, { force: true });
    const vault = new CredentialVault(file, fakeSafeStorage);
    vault.set("parentContact:mom_email", "mom@example.com");
    const raw = readFileSync(file, "utf8");
    expect(raw.includes("mom@example.com")).toBe(false);
    // 磁盘存 base64；解码后应为加密前缀串（含 pseudocrypt:），证明经过了 encryptString
    const stored = JSON.parse(raw).entries["parentContact:mom_email"] as string;
    expect(Buffer.from(stored, "base64").toString("utf8")).toMatch(/pseudocrypt:/);
  });

  it("CV-03 写文件 mode 0o600（非 Windows 平台断言；Windows chmod 为 best effort）", () => {
    const file = vaultPath("cv-03.json");
    rmSync(file, { force: true });
    const vault = new CredentialVault(file, fakeSafeStorage);
    vault.set("modelProvider:zai", "k");
    if (process.platform !== "win32") {
      const mode = statSync(file).mode & 0o777;
      expect(mode).toBe(0o600);
    }
    // Windows：文件存在且可读即可（chmod best effort，03-Arch §4.5 已注明）
    expect(existsSync(file)).toBe(true);
  });

  it("CV-04 键名校验：合法 modelProvider:xxx/parentContact:xxx 通过，非法键拒绝", () => {
    const file = vaultPath("cv-04.json");
    rmSync(file, { force: true });
    const vault = new CredentialVault(file, fakeSafeStorage);
    // 合法
    expect(() => vault.set("modelProvider:openai", "a")).not.toThrow();
    expect(() => vault.set("parentContact:mom_email", "b")).not.toThrow();
    // 非法：缺前缀 / 错误前缀 / 超长 / 非法字符
    expect(() => vault.set("openai", "a")).toThrow();
    expect(() => vault.set("channel:openai", "a")).toThrow();
    expect(() => vault.set("modelProvider:" + "x".repeat(161), "a")).toThrow();
    expect(() => vault.set("parentContact:bad space!", "a")).toThrow();
  });

  it("CV-05 get 不存在返回 null；listKeys 仅返回键名不返回值", () => {
    const file = vaultPath("cv-05.json");
    rmSync(file, { force: true });
    const vault = new CredentialVault(file, fakeSafeStorage);
    expect(vault.get("modelProvider:missing")).toBeNull();
    vault.set("modelProvider:openai", "sk-a");
    vault.set("parentContact:mom_email", "mom@example.com");
    const keys = vault.listKeys();
    expect(keys).toContain("modelProvider:openai");
    expect(keys).toContain("parentContact:mom_email");
    // 仅返回键名，不返回值
    expect(keys.some((k) => k.includes("sk-a") || k.includes("@"))).toBe(false);
  });

  it("CV-06 listKeys 支持 prefix 过滤", () => {
    const file = vaultPath("cv-06.json");
    rmSync(file, { force: true });
    const vault = new CredentialVault(file, fakeSafeStorage);
    vault.set("modelProvider:openai", "a");
    vault.set("parentContact:mom_email", "b");
    const modelKeys = vault.listKeys("modelProvider:");
    expect(modelKeys).toEqual(["modelProvider:openai"]);
  });

  it("CV-07 delete 删除后 get 返回 null", () => {
    const file = vaultPath("cv-07.json");
    rmSync(file, { force: true });
    const vault = new CredentialVault(file, fakeSafeStorage);
    vault.set("modelProvider:openai", "sk-a");
    expect(vault.get("modelProvider:openai")).toBe("sk-a");
    vault.delete("modelProvider:openai");
    expect(vault.get("modelProvider:openai")).toBeNull();
  });

  it("CV-08 safeStorage 不可用时抛错（安全降级，不落明文）", () => {
    const file = vaultPath("cv-08.json");
    rmSync(file, { force: true });
    const unavailable: SafeStorageAdapter = {
      isEncryptionAvailable: () => false,
      encryptString: (v) => Buffer.from(v),
      decryptString: (b) => b.toString("utf8"),
    };
    const vault = new CredentialVault(file, unavailable);
    expect(() => vault.set("modelProvider:openai", "sk-a")).toThrow();
    // 未落任何文件
    expect(existsSync(file)).toBe(false);
  });
});