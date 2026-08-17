import { describe, expect, it, vi } from "vitest";
import { CredentialVault, type SafeStorageAdapter } from "../../src/main/credential-vault";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString("utf8"),
  },
}));

const unavailable: SafeStorageAdapter = {
  isEncryptionAvailable: () => false,
  encryptString: (value) => Buffer.from(value),
  decryptString: (value) => value.toString("utf8"),
};

describe("T-M5-011 DPAPI 不可用错误语义（RED）", () => {
  it("CRED-01 DPAPI 不可用时拒绝明文保存，并只返回固定可恢复中文", () => {
    const vault = new CredentialVault("H:\\pi-studybuddy-tmp\\runs\\T-M5-011\\credential-errors\\credentials.json", unavailable);

    let received: unknown;
    try {
      vault.set("modelProvider:demo", "temporary-secret");
    } catch (error) {
      received = error;
    }
    expect(received).toMatchObject({
      code: "CREDENTIAL_UNAVAILABLE",
      message: "系统加密暂不可用，请解锁 Windows 后重试。",
      recoverable: true,
    });
    expect(String(received)).not.toContain("temporary-secret");
    expect(String(received)).not.toMatch(/[a-z]:[\\/]|\\\\|\bat\s+.+\(/i);
  });
});
