import { useEffect, useRef, useState } from "react";
import type { TypedRpcClient } from "../../rpc-client";

/** Tab 只读数据的生命周期状态。 */
export type TabDataStatus = "idle" | "loading" | "error" | "empty" | "ready";

export interface TabDataState<T> {
  status: TabDataStatus;
  data: T;
}

function defaultIsEmpty<T>(value: T): boolean {
  if (value == null) return true;
  return Array.isArray(value) ? value.length === 0 : false;
}

/**
 * 所有数据型 Tab 统一使用的 RPC 读取生命周期。
 *
 * - key 绑定学术上下文，semester/course 切换必然触发新读取；
 * - rpc 替换也触发新读取，旧客户端结果不能回写；
 * - disabled 或缺少有效上下文时不调用 RPC，并回到 idle；
 * - requestId + cleanup 同时防止乱序响应和卸载后 setState；
 * - 错误只暴露固定状态，调用方不应渲染 RPC 原始异常。
 */
export function useTabData<T>(options: {
  rpc?: TypedRpcClient;
  key: string;
  enabled: boolean;
  initialData: T;
  load: (rpc: TypedRpcClient) => Promise<T>;
  isEmpty?: (value: T) => boolean;
}): TabDataState<T> {
  const { rpc, key, enabled, initialData, load, isEmpty = defaultIsEmpty } = options;
  const [state, setState] = useState<TabDataState<T>>({
    status: rpc && enabled ? "loading" : "idle",
    data: initialData,
  });
  const requestIdRef = useRef(0);
  const committedKeyRef = useRef(key);
  const committedRpcRef = useRef(rpc);
  const initialDataRef = useRef(initialData);
  const isEmptyRef = useRef(isEmpty);
  const loadRef = useRef(load);
  initialDataRef.current = initialData;
  isEmptyRef.current = isEmpty;
  loadRef.current = load;
  const contextChanged = committedKeyRef.current !== key || committedRpcRef.current !== rpc;

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    committedKeyRef.current = key;
    committedRpcRef.current = rpc;
    let cancelled = false;

    if (!rpc || !enabled) {
      setState({ status: "idle", data: initialDataRef.current });
      return () => {
        cancelled = true;
        requestIdRef.current += 1;
      };
    }

    setState({ status: "loading", data: initialDataRef.current });
    void loadRef.current(rpc)
      .then((data) => {
        if (cancelled || requestId !== requestIdRef.current) return;
        setState({ status: isEmptyRef.current(data) ? "empty" : "ready", data });
      })
      .catch(() => {
        if (cancelled || requestId !== requestIdRef.current) return;
        setState({ status: "error", data: initialDataRef.current });
      });

    return () => {
      cancelled = true;
      if (requestId === requestIdRef.current) requestIdRef.current += 1;
    };
  }, [rpc, key, enabled]);

  // effect 在浏览器提交后才运行；先在当前 render 阻断旧课程数据的可见性。
  if (contextChanged) {
    return { status: rpc && enabled ? "loading" : "idle", data: initialData };
  }
  return state;
}
