/**
 * T-M4-003 credentials.* RPC handlers（06-API §3.15 + 03-Arch §4.5）
 *
 * 封装 CredentialVault（T-M0-003 已实现）为 RPC handler 映射。
 * DPAPI 加密存储，键名严格校验 modelProvider:xxx / parentContact:xxx。
 *
 * 2026-08-11 修复：agent-host 运行于 utilityProcess（无 electron safeStorage），
 * 改用 CredentialService 接口——生产注入 parentPort 委托客户端（main 主进程执行 DPAPI），
 * 测试注入 mock。RPC handler 为 async（RPC server 支持 Promise 结果）。
 *
 * 安全（02-PRD §5.2 密钥边界）：
 *   - credentials.get 不存在 → { value: "" }（不抛错，前端按空串处理）
 *   - credentials.listKeys 仅返回键名，不返回值
 *   - 永不日志记录 value 明文（AGENTS.md §9.3）
 */
import type { CredentialService } from "../credential-client";

/**
 * 构造 credentials.* handlers。
 * @param service CredentialService 实例（生产：parentPort 委托 main 的 DPAPI vault；测试：mock）
 */
export function createCredentialHandlers(service: CredentialService) {
  return {
    "credentials.set": async (params: unknown): Promise<void> => {
      const { key, value } = params as { key: string; value: string };
      await service.set(key, value);
    },
    "credentials.get": async (params: unknown): Promise<{ value: string }> => {
      const { key } = params as { key: string };
      const value = await service.get(key);
      return { value: value ?? "" };
    },
    "credentials.delete": async (params: unknown): Promise<void> => {
      const { key } = params as { key: string };
      await service.delete(key);
    },
    "credentials.listKeys": async (params: unknown): Promise<string[]> => {
      const { prefix } = (params ?? {}) as { prefix?: string };
      return service.listKeys(prefix);
    },
  };
}
