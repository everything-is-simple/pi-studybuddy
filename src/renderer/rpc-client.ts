/**
 * pi-studybuddy renderer RPC 客户端封装（T-M1-009）
 *
 * 03-Arch §6.2 + 06-API §1-§3：从 contract/rpc 的 RpcClient 创建类型化封装，
 * 注入各 Tab 组件。测试通过 props 注入 mock。
 *
 * 类型化 call 方法基于 Api 契约（api.ts）提供 params/result 类型推导。
 */
import { createRpcClient, type AnyMessagePort, type RpcClient as RawRpcClient } from "../contract/rpc";
import type { Api } from "../contract/api";

/** 类型化 RPC 客户端（基于 Api 契约） */
export interface TypedRpcClient {
  /** 调用远程方法，返回 Promise<result>；出错时 rejects RpcError */
  call<P extends keyof Api>(method: P, ...args: Api[P]["params"] extends void ? [] : [Api[P]["params"]]): Promise<Api[P]["result"]>;
  /** 订阅 topic(+key) 的事件，返回取消订阅函数 */
  subscribe(topic: string, key: string | undefined, on: (payload: unknown) => void): () => void;
  dispose(): void;
}

/** 从 PiBridge 创建类型化 RpcClient */
export function createStudyBuddyRpcClient(port: AnyMessagePort): TypedRpcClient {
  const raw: RawRpcClient = createRpcClient(port);
  return {
    call(method, ...args) {
      return raw.call(method, ...args) as Promise<unknown> as Promise<never>;
    },
    subscribe(topic, key, on) {
      return raw.subscribe(topic, key, on);
    },
    dispose() {
      raw.dispose();
    },
  };
}

/** Mock RPC 客户端（测试用，返回预置数据） */
export function createMockRpcClient(handlers: Record<string, (...args: unknown[]) => unknown>): TypedRpcClient {
  return {
    call(method, ...args) {
      const handler = handlers[method];
      if (!handler) {
        return Promise.reject({ code: "UNKNOWN_METHOD", message: `未知方法: ${String(method)}` });
      }
      return Promise.resolve(handler(...args)) as Promise<never>;
    },
    subscribe() {
      return () => {};
    },
    dispose() {},
  };
}
