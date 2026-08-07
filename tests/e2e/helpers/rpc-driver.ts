/**
 * T-M1-010 E2E RPC 驱动器
 *
 * 通过 stdin/stdout JSON-lines 协议与 Electron 主进程通信，
 * 驱动业务 RPC 调用（semesters.create / materials.upload / practice.* 等）。
 *
 * 设计依据（08-Test §6 + 计划 §3 步骤 1）：
 *   - 测试驱动器发送 {"type":"rpc","id":"...","method":"...","args":[params]}
 *   - Electron 主进程返回 {"id":"...","result":...} 或 {"id":"...","error":{code,message}}
 *
 * 安全：RPC 调用通过 stdin/stdout 通道，不绕过沙箱。
 */
import type { E2EChannel } from "./electron-launcher";

interface RpcResponse {
  id: string;
  result?: unknown;
  error?: { code: string; message: string };
}

interface PendingEntry {
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  timer: NodeJS.Timeout;
}

export class RpcDriver {
  private nextId = 0;
  private readonly pending = new Map<string, PendingEntry>();

  constructor(private readonly channel: E2EChannel) {
    // 监听所有消息，按 id 分发 RPC 响应
    channel.on("message", (msg: unknown) => {
      const resp = msg as RpcResponse;
      if (typeof resp.id === "string" && this.pending.has(resp.id)) {
        const entry = this.pending.get(resp.id)!;
        this.pending.delete(resp.id);
        clearTimeout(entry.timer);
        if (resp.error) {
          entry.reject(resp.error);
        } else {
          entry.resolve(resp.result);
        }
      }
    });
  }

  /** 初始化（通道已在 launchElectron 中就绪，无需额外操作） */
  async init(): Promise<void> {
    // 无操作：通道已在 launchElectron 中建立
  }

  /**
   * 调用远程 RPC 方法。
   * @param method 方法名（如 "semesters.create"）
   * @param params 参数对象（作为 args[0] 传递）
   */
  async call<T = unknown>(method: string, params?: unknown): Promise<T> {
    const id = `r${this.nextId++}`;

    const promise = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`RPC 超时: ${method} (id=${id}, 60s)`));
        }
      }, 60_000);

      this.pending.set(id, {
        resolve: (v: unknown) => resolve(v as T),
        reject,
        timer,
      });
    });

    this.channel.send({
      type: "rpc",
      id,
      method,
      args: params !== undefined ? [params] : [],
    });

    return promise;
  }
}
