/**
 * T-M4-003 credentials.* RPC handlers（06-API §3.15 + 03-Arch §4.5）
 *
 * 封装 CredentialVault（T-M0-003 已实现）为 RPC handler 映射。
 * DPAPI 加密存储，键名严格校验 modelProvider:xxx / parentContact:xxx。
 *
 * 安全（02-PRD §5.2 密钥边界）：
 *   - credentials.get 不存在 → { value: "" }（不抛错，前端按空串处理）
 *   - credentials.listKeys 仅返回键名，不返回值
 *   - 永不日志记录 value 明文（AGENTS.md §9.3）
 */
import type { CredentialVault } from "../../main/credential-vault";

/**
 * 构造 credentials.* handlers。
 * @param vault CredentialVault 实例（T-M0-003，由 agent-host 创建注入）
 */
export function createCredentialHandlers(vault: CredentialVault) {
  return {
    "credentials.set": (params: unknown): void => {
      const { key, value } = params as { key: string; value: string };
      vault.set(key, value);
    },
    "credentials.get": (params: unknown): { value: string } => {
      const { key } = params as { key: string };
      const value = vault.get(key);
      return { value: value ?? "" };
    },
    "credentials.delete": (params: unknown): void => {
      const { key } = params as { key: string };
      vault.delete(key);
    },
    "credentials.listKeys": (params: unknown): string[] => {
      const { prefix } = (params ?? {}) as { prefix?: string };
      return vault.listKeys(prefix);
    },
  };
}
