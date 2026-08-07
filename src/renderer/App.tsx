/**
 * pi-studybuddy renderer 入口（03-Arch §6.2 + 09-UI §2.1）
 *
 * T-M0-008：组装 AppShell 三栏布局 + TabBar 骨架。
 * T-M1-009：创建类型化 RpcClient 注入 AppShell，供 S1-S4 业务 Tab 使用。
 * 保留 T-M0-001 的 piBridge.connectHost() + system.ping RPC 通道验证。
 */
import { useEffect, useState } from "react";
import { type AnyMessagePort } from "../contract/rpc";
import type { PiBridge } from "../contract/desktop";
import { AppShell } from "./components/AppShell";
import { createStudyBuddyRpcClient, type TypedRpcClient } from "./rpc-client";

declare global {
  interface Window {
    piBridge?: PiBridge;
  }
}

export function App(): React.JSX.Element {
  const [status, setStatus] = useState("连接中…");
  const [result, setResult] = useState<string | null>(null);
  const [rpcClient, setRpcClient] = useState<TypedRpcClient | undefined>(undefined);

  async function runPing(): Promise<void> {
    const bridge = window.piBridge;
    if (!bridge) {
      setStatus("piBridge 不可用");
      return;
    }
    const port = (await bridge.connectHost()) as unknown as AnyMessagePort;
    const client = createStudyBuddyRpcClient(port);
    setRpcClient(client);
    const res = (await client.call("system.ping", { message: "骨架通道通畅" })) as {
      pong: string;
      timestamp: number;
    };
    setResult(`${res.pong} @ ${new Date(res.timestamp).toLocaleTimeString()}`);
    setStatus("已连接");
  }

  useEffect(() => {
    void runPing();
  }, []);

  return (
    <AppShell
      rpcStatus={status}
      rpcResult={result}
      onVerifyRpc={() => void runPing()}
      rpc={rpcClient}
    />
  );
}
