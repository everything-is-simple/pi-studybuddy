/**
 * agent-host credential 客户端（utilityProcess 委托 main 的 DPAPI vault）。
 *
 * 背景（2026-08-11 模型配置验证发现）：agent-host 运行于 utilityProcess（Electron 独立
 * Node 进程），其中 `safeStorage` 为 undefined（Electron utilityProcess 不提供 safeStorage），
 * 直接实例化 CredentialVault（默认 electron safeStorage）会抛错 → 生产模型 key 无法解密、
 * 设置页 credentials.* 无法读写。pi-desktop 范式：CredentialVault 只在 main 主进程持有。
 *
 * 本模块通过 utilityProcess 的 process.parentPort 将 vault 操作委托给 main：
 *   - agent-host → main：{ type: "credential-request", id, op, key, value, prefix }
 *   - main → agent-host：{ type: "credential-result", id, ok, result | error }
 * main 侧由 src/main/ipc.ts forkAgent 的 message 处理响应（DPAPI 只在 main 进程执行）。
 *
 * 安全：key/value 只在进程间内存传递（不落盘、不进日志）；错误只回传固定消息。
 */
export interface CredentialService {
  /** 返回 null 表示键不存在；错误抛 Error。 */
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  listKeys(prefix?: string): Promise<string[]>;
}

type ParentPortLike = {
  postMessage(message: unknown): void;
  on(event: "message", listener: (event: { data?: unknown }) => void): void;
};

function getParentPort(): ParentPortLike | null {
  const candidate = (process as unknown as { parentPort?: unknown }).parentPort;
  if (
    candidate &&
    typeof (candidate as ParentPortLike).postMessage === "function" &&
    typeof (candidate as ParentPortLike).on === "function"
  ) {
    return candidate as ParentPortLike;
  }
  return null;
}

/**
 * 通过 process.parentPort 委托 main 主进程执行 vault 加解密（生产 utilityProcess 路径）。
 * 无 parentPort 的环境（普通 Node/vitest）返回 null，调用方应注入 mock 或按不可用处理。
 */
export function createParentPortCredentialClient(): CredentialService | null {
  const parentPort = getParentPort();
  if (!parentPort) return null;

  interface Pending {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }
  const pending = new Map<string, Pending>();
  let nextId = 0;

  parentPort.on("message", (event) => {
    const message = (event?.data ?? event) as
      | { type?: string; id?: string; ok?: boolean; result?: unknown; error?: string }
      | undefined;
    if (!message || message.type !== "credential-result" || !message.id) return;
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    if (message.ok === true) {
      item.resolve(message.result);
    } else {
      item.reject(new Error(message.error ?? "凭证库操作失败"));
    }
  });

  const port = parentPort;
  function request(op: "get" | "set" | "delete" | "listKeys", key?: string, value?: string, prefix?: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = `cred-${++nextId}`;
      pending.set(id, { resolve, reject });
      try {
        port.postMessage({ type: "credential-request", id, op, key, value, prefix });
      } catch (error) {
        pending.delete(id);
        reject(error instanceof Error ? error : new Error("凭证库请求发送失败"));
      }
    });
  }

  return {
    get: (key) => request("get", key) as Promise<string | null>,
    set: (key, value) => request("set", key, value) as Promise<void>,
    delete: (key) => request("delete", key) as Promise<void>,
    listKeys: (prefix) => request("listKeys", undefined, undefined, prefix) as Promise<string[]>,
  };
}
