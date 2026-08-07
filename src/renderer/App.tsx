/**
 * pi-studybuddy renderer 入口（03-Arch §6.2 + 09-UI §2.1）
 *
 * T-M0-008：组装 AppShell 三栏布局 + TabBar 骨架。
 * 保留 T-M0-001 的 piBridge.connectHost() + system.ping RPC 通道验证，
 * 将状态/结果/回调传给 AppShell 在主内容区显示。
 */
import { useEffect, useState } from "react";
import { createRpcClient, type AnyMessagePort } from "../contract/rpc";
import type { PiBridge } from "../contract/desktop";
import { AppShell } from "./components/AppShell";

declare global {
  interface Window {
    piBridge?: PiBridge;
  }
}

export function App(): React.JSX.Element {
  const [status, setStatus] = useState("连接中…");
  const [result, setResult] = useState<string | null>(null);

  async function runPing(): Promise<void> {
    const bridge = window.piBridge;
    if (!bridge) {
      setStatus("piBridge 不可用");
      return;
    }
    const port = (await bridge.connectHost()) as unknown as AnyMessagePort;
    const client = createRpcClient(port);
    const res = (await client.call("system.ping", { message: "骨架通道通畅" })) as {
      pong: string;
      timestamp: number;
    };
    setResult(`${res.pong} @ ${new Date(res.timestamp).toLocaleTimeString()}`);
    setStatus("已连接");
    client.dispose();
  }

  useEffect(() => {
    void runPing();
  }, []);

  return (
    <AppShell
      rpcStatus={status}
      rpcResult={result}
      onVerifyRpc={() => void runPing()}
    />
  );
}
