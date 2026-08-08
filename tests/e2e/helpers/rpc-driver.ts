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

/** 事件推送消息（test-main.js shim server 转发，T-M3-007） */
interface EventPushMessage {
  type: "event";
  topic: string;
  key?: string;
  payload: unknown;
}

export class RpcDriver {
  private nextId = 0;
  private readonly pending = new Map<string, PendingEntry>();
  /** 按 topic 缓存已到达事件（供 waitForEvent 回溯匹配） */
  private readonly eventBuffer = new Map<string, unknown[]>();
  /** 等待事件的条件回调（topic → 回调集合） */
  private readonly eventWaiters = new Map<string, Set<(payload: unknown) => boolean>>();

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
        return;
      }
      // 事件推送分发（T-M3-007：agent.events 等 Streams 主题）
      const event = msg as EventPushMessage;
      if (event?.type === "event" && typeof event.topic === "string") {
        this.dispatchEvent(event.topic, event.payload);
      }
    });
  }

  /** 分发到达事件：响应 waitForEvent 的等待者 + 缓存进 buffer */
  private dispatchEvent(topic: string, payload: unknown): void {
    const waiters = this.eventWaiters.get(topic);
    if (waiters) {
      for (const predicate of [...waiters]) {
        if (predicate(payload)) {
          waiters.delete(predicate);
        }
      }
    }
    const buf = this.eventBuffer.get(topic) ?? [];
    buf.push(payload);
    this.eventBuffer.set(topic, buf);
  }

  /**
   * 等待某 topic 上满足 predicate 的事件（T-M3-007：agent.events 流式事件订阅）。
   * 先查已缓存事件（dispatch 时序竞态兜底），再等新到达。
   * @param topic     事件主题（如 "agent.events"）
   * @param predicate 匹配条件（默认任意事件）
   * @param timeoutMs 超时（默认 15s）
   */
  async waitForEvent<T = unknown>(
    topic: string,
    predicate: (payload: unknown) => boolean = () => true,
    timeoutMs = 15_000,
  ): Promise<T> {
    // 回溯已缓存事件
    const buf = this.eventBuffer.get(topic);
    if (buf) {
      const hit = buf.find(predicate);
      if (hit !== undefined) return hit as T;
    }
    // 等待新到达
    return new Promise<T>((resolve, reject) => {
      const predicateWrap = (payload: unknown): boolean => {
        if (predicate(payload)) {
          clearTimeout(timer);
          resolve(payload as T);
          return true;
        }
        return false;
      };
      const waiters = this.eventWaiters.get(topic) ?? new Set();
      waiters.add(predicateWrap);
      this.eventWaiters.set(topic, waiters);
      const timer = setTimeout(() => {
        waiters.delete(predicateWrap);
        reject(new Error(`等待事件超时: ${topic} (${timeoutMs}ms)`));
      }, timeoutMs);
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
