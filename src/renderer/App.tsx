/**
 * pi-studybuddy renderer 最小页面（03-Arch §6.2 + 09-UI §1.3）
 *
 * 显示"骨架就绪"占位，并通过 piBridge.connectHost() + RPC 层调用 system.ping
 * 验证 renderer→main→agent-host 通道往返。
 */
import React, { useEffect, useState } from "react";
import { createRpcClient, type AnyMessagePort } from "../contract/rpc";
import type { PiBridge } from "../contract/desktop";

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
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1>pi-studybuddy 骨架就绪</h1>
      <p>状态：{status}</p>
      <button type="button" onClick={() => void runPing()}>
        验证 RPC 通道
      </button>
      {result && <p>ping 结果：{result}</p>}
    </div>
  );
}