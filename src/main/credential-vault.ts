/**
 * pi-studybuddy credential-vault（03-Arch §4.5 DPAPI 密钥库）
 *
 * 安全不变量之一（08-Test §5.7 INV-04）：credential-vault 用 safeStorage。
 * Windows 上 Electron safeStorage 后端即 DPAPI（01-TRD §9.2 密钥边界）。
 *
 * 设计要点：
 *   - `import { safeStorage } from "electron"`（INV-04 静态断言首行）
 *   - 构造注入 SafeStorageAdapter，默认用 electron safeStorage，便于单件测试注入 fake
 *   - 键格式严格校验：/^(modelProvider|parentContact):[a-z0-9._-]{1,160}$/i
 *   - 写文件 mode 0o600（原子写：temp + rename；Windows chmod 为 best effort）
 *   - 磁盘只存加密后 base64，永不落明文
 *
 * 权威依据：03-Arch §4.5 + 06-API §3.15 + 01-TRD §9.2 + 08-Test §5.6
 */
import { safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

/** safeStorage 最小适配面（测试注入假实现） */
export interface SafeStorageAdapter {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

/** 存储文件结构：{ version, entries }，entries 值为加密后 base64 */
interface VaultFile {
  version: 1;
  entries: Record<string, string>;
}

/** 键名严格校验（03-Arch §4.5 + 01-TRD §9.2）：仅 modelProvider:xxx / parentContact:xxx */
const KEY_PATTERN = /^(modelProvider|parentContact):[a-z0-9._-]{1,160}$/i;

export class CredentialVaultError extends Error {
  constructor(
    readonly code: "CREDENTIAL_UNAVAILABLE" | "CREDENTIAL_INVALID",
    message: string,
    readonly recoverable = true,
  ) {
    super(message);
    this.name = "CredentialVaultError";
  }
}

function validateKey(key: string): string {
  const trimmed = key.trim();
  if (!KEY_PATTERN.test(trimmed)) {
    throw new CredentialVaultError("CREDENTIAL_INVALID", "凭据标识无效，请重新配置后重试。", false);
  }
  return trimmed;
}

export class CredentialVault {
  constructor(
    private readonly filePath: string,
    private readonly crypto: SafeStorageAdapter = safeStorage,
  ) {}

  /** 加密能力不可用则拒绝读写（安全降级，不落明文） */
  private assertAvailable(): void {
    if (!this.crypto.isEncryptionAvailable()) {
      throw new CredentialVaultError("CREDENTIAL_UNAVAILABLE", "系统加密暂不可用，请解锁 Windows 后重试。");
    }
  }

  private read(): VaultFile {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as Partial<VaultFile>;
      if (parsed.version !== 1 || !parsed.entries || typeof parsed.entries !== "object" || Array.isArray(parsed.entries)) {
        throw new CredentialVaultError("CREDENTIAL_INVALID", "凭据保管库不可用，请重新保存凭据后重试。");
      }
      return { version: 1, entries: parsed.entries };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, entries: {} };
      if (error instanceof CredentialVaultError) throw error;
      throw new CredentialVaultError("CREDENTIAL_INVALID", "凭据保管库不可用，请重新保存凭据后重试。");
    }
  }

  /** 原子写：temp + rename，mode 0o600；Windows chmod 为 best effort */
  private write(data: VaultFile): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temp, this.filePath);
    try {
      fs.chmodSync(this.filePath, 0o600);
    } catch {
      /* best effort on Windows */
    }
  }

  /** credentials.get：DPAPI 解密；不存在返回 null */
  get(key: string): string | null {
    this.assertAvailable();
    const encrypted = this.read().entries[validateKey(key)];
    if (!encrypted) return null;
    return this.crypto.decryptString(Buffer.from(encrypted, "base64"));
  }

  /** credentials.set：DPAPI 加密后落盘 */
  set(key: string, value: string): void {
    this.assertAvailable();
    const data = this.read();
    const encrypted = this.crypto.encryptString(value);
    data.entries[validateKey(key)] = encrypted.toString("base64");
    this.write(data);
  }

  /** credentials.delete */
  delete(key: string): void {
    this.assertAvailable();
    const data = this.read();
    delete data.entries[validateKey(key)];
    this.write(data);
  }

  /** credentials.listKeys：仅返回键名，不返回值 */
  listKeys(prefix?: string): string[] {
    this.assertAvailable();
    const keys = Object.keys(this.read().entries);
    if (prefix) return keys.filter((k) => k.startsWith(prefix));
    return keys;
  }
}