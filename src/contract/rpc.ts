/**
 * pi-studybuddy 自研 MessagePort RPC 层（03-Arch §6.3）
 *
 * 轻量、无外部依赖，五种 wire 消息（request/response/subscribe/unsubscribe/event）。
 * 兼容 renderer（DOM MessagePort）、main/agent-host（Node / MessagePortMain 接收端）。
 *
 * 错误码（RpcErrorCode）：
 *   - UNKNOWN_METHOD：RPC 传输层新增码（06-API §2.2 未定义，属壳层 wire 语义）
 *   - INTERNAL_ERROR：与 06-API §2.2 对齐（内部错误脱敏后返回，永不暴露内部栈）
 */
import type { RpcError, WireMessage } from "./types";

export const RpcErrorCode = {
  UNKNOWN_METHOD: "UNKNOWN_METHOD",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

/** 统一端口适配：DOM / Node / MessagePortMain 接收端 / utilityProcess 控制通道 */
export interface AnyMessagePort {
  postMessage(message: unknown, transfer?: unknown[]): void;
  start?(): void;
  close?(): void;
  onmessage?: ((event: { data: unknown }) => void) | null;
  addEventListener?(
    type: "message",
    listener: (event: { data: unknown }) => void,
    options?: unknown,
  ): void;
  removeEventListener?(type: "message", listener: (event: { data: unknown }) => void): void;
  /** utilityProcess 控制通道（parentPort）的 on 风格监听 */
  on?(event: "message", listener: (event: { data: unknown }) => void): void;
}

export type RpcHandler = (...args: unknown[]) => unknown | Promise<unknown>;

/** 传输层错误判定：已带 code/message 的对象视为 RpcError */
function isRpcError(e: unknown): e is RpcError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}

/** handler 抛出的内部异常 → 脱敏为 INTERNAL_ERROR（06-API §2.3 永不暴露内部栈） */
function toError(_e: unknown): RpcError {
  return { code: RpcErrorCode.INTERNAL_ERROR, message: "操作失败，请稍后重试" };
}

/** 把监听器挂到任意类型端口上，并启动接收 */
function attachPortListener(port: AnyMessagePort, onMessage: (msg: WireMessage) => void): void {
  const listener = (ev: { data: unknown }) => onMessage(ev.data as WireMessage);
  if (typeof port.addEventListener === "function") {
    port.addEventListener("message", listener);
  } else if (typeof port.on === "function") {
    port.on("message", listener);
  } else if (port.onmessage == null) {
    port.onmessage = listener;
  }
  port.start?.();
}

/** 服务端订阅登记 */
interface ServerSubscription {
  topic: string;
  key?: string;
}

export interface RpcServer {
  /** 注册 handler 映射（method → handler），可多次调用累加 */
  handle(handlers: Record<string, RpcHandler>): void;
  /** 挂载到某条 MessagePort，开始接收请求/订阅 */
  attachPort(port: AnyMessagePort): void;
  /** 向匹配 topic(+key) 的所有订阅者推送 event */
  pushEvent(topic: string, payload: unknown, key?: string): void;
  dispose(): void;
}

export function createRpcServer(): RpcServer {
  const handlers = new Map<string, RpcHandler>();
  const subscriptions = new Map<string, ServerSubscription>();
  let port: AnyMessagePort | null = null;

  function respond(id: string, result?: unknown, error?: RpcError): void {
    if (!port) return;
    const msg: WireMessage = error
      ? { kind: "response", id, error }
      : { kind: "response", id, result };
    port.postMessage(msg);
  }

  function handleRequest(msg: Extract<WireMessage, { kind: "request" }>): void {
    const handler = handlers.get(msg.method);
    if (!handler) {
      respond(msg.id, undefined, {
        code: RpcErrorCode.UNKNOWN_METHOD,
        message: `未知方法: ${msg.method}`,
      });
      return;
    }
    try {
      const result = handler(...(msg.args ?? []));
      if (result instanceof Promise) {
        result
          .then((r) => respond(msg.id, r))
          .catch((e) => respond(msg.id, undefined, toError(e)));
      } else {
        respond(msg.id, result);
      }
    } catch (e) {
      respond(msg.id, undefined, toError(e));
    }
  }

  function onMessage(msg: WireMessage): void {
    switch (msg.kind) {
      case "request":
        handleRequest(msg);
        break;
      case "subscribe":
        subscriptions.set(msg.id, { topic: msg.topic, key: msg.key });
        break;
      case "unsubscribe":
        subscriptions.delete(msg.id);
        break;
      default:
        // response / event 不应由客户端发往服务端，忽略
        break;
    }
  }

  return {
    handle(handlersMap) {
      for (const [method, handler] of Object.entries(handlersMap)) {
        handlers.set(method, handler);
      }
    },
    attachPort(p) {
      port = p;
      attachPortListener(p, onMessage);
    },
    pushEvent(topic, payload, key) {
      for (const sub of subscriptions.values()) {
        if (sub.topic === topic && sub.key === key) {
          port?.postMessage({ kind: "event", topic, key, payload } satisfies WireMessage);
        }
      }
    },
    dispose() {
      port = null;
      subscriptions.clear();
    },
  };
}

export interface RpcClient {
  /** 调用远程方法，返回 Promise<result>；出错时 rejects RpcError */
  call(method: string, ...args: unknown[]): Promise<unknown>;
  /** 订阅 topic(+key) 的事件，返回取消订阅函数 */
  subscribe(topic: string, key: string | undefined, on: (payload: unknown) => void): () => void;
  dispose(): void;
}

export function createRpcClient(port: AnyMessagePort): RpcClient {
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
  const localSubs = new Map<string, Set<(payload: unknown) => void>>();
  let nextId = 0;

  function onMessage(msg: WireMessage): void {
    if (msg.kind === "response") {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.error) p.reject(msg.error);
      else p.resolve(msg.result);
    } else if (msg.kind === "event") {
      const subKey = `${msg.topic}\u0000${msg.key ?? ""}`;
      const cbs = localSubs.get(subKey);
      if (cbs) for (const cb of cbs) cb(msg.payload);
    }
  }

  attachPortListener(port, onMessage);

  return {
    call(method, ...args) {
      const id = `c${nextId++}`;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        port.postMessage({ kind: "request", id, method, args } satisfies WireMessage);
      });
    },
    subscribe(topic, key, on) {
      const subKey = `${topic}\u0000${key ?? ""}`;
      if (!localSubs.has(subKey)) localSubs.set(subKey, new Set());
      localSubs.get(subKey)!.add(on);
      const subId = `s${nextId++}`;
      port.postMessage({ kind: "subscribe", id: subId, topic, key } satisfies WireMessage);
      return () => {
        localSubs.get(subKey)?.delete(on);
        port.postMessage({ kind: "unsubscribe", id: subId } satisfies WireMessage);
      };
    },
    dispose() {
      pending.clear();
      localSubs.clear();
    },
  };
}