/**
 * T-M4-015（2026-08-11 模型配置缺陷修复）credential-client 委托协议单件测试。
 *
 * 背景：agent-host 运行于 utilityProcess（无 electron safeStorage），凭证经
 * process.parentPort 委托 main 主进程 DPAPI vault。本测试用伪 parentPort 验证：
 *   - 请求消息格式（{ type: "credential-request", id, op, key, value, prefix }）
 *   - 响应分发（ok → resolve result；error → reject 固定消息）
 *   - 无 parentPort 环境返回 null（调用方注入 mock）
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { createParentPortCredentialClient } from "../../src/agent-host/credential-client";

interface SentMessage {
  type?: string;
  id?: string;
  op?: string;
  key?: string;
  value?: string;
  prefix?: string;
}

/** 模拟 utilityProcess 的 process.parentPort（main 端响应由测试手动回放） */
function createFakeParentPort() {
  const listeners: Array<(event: { data?: unknown }) => void> = [];
  const sent: SentMessage[] = [];
  return {
    parentPort: {
      postMessage: (message: unknown): void => {
        sent.push(message as SentMessage);
      },
      on: (event: string, listener: (event: { data?: unknown }) => void): void => {
        if (event === "message") listeners.push(listener);
      },
      /** 测试回放 main 的 credential-result */
      emit(mainMessage: unknown): void {
        for (const listener of listeners) listener({ data: mainMessage });
      },
    },
    sent,
  };
}

describe("createParentPortCredentialClient", () => {
  it("无 parentPort（普通 Node/vitest）返回 null", () => {
    expect(createParentPortCredentialClient()).toBeNull();
  });

  it("get 请求格式正确并解析 main 响应（ok → 解密值）", async () => {
    const fake = createFakeParentPort();
    // 临时注入 parentPort
    (process as unknown as { parentPort?: unknown }).parentPort = fake.parentPort;
    try {
      const client = createParentPortCredentialClient();
      expect(client).not.toBeNull();
      const promise = client!.get("modelProvider:agnes");
      // 捕获发出的请求
      expect(fake.sent).toHaveLength(1);
      const request = fake.sent[0];
      expect(request.type).toBe("credential-request");
      expect(request.op).toBe("get");
      expect(request.key).toBe("modelProvider:agnes");
      expect(typeof request.id).toBe("string");
      // main 回放响应
      fake.parentPort.emit({ type: "credential-result", id: request.id, ok: true, result: "sk-secret" });
      await expect(promise).resolves.toBe("sk-secret");
    } finally {
      delete (process as unknown as { parentPort?: unknown }).parentPort;
    }
  });

  it("set 请求携带 key/value；错误响应 reject 固定消息", async () => {
    const fake = createFakeParentPort();
    (process as unknown as { parentPort?: unknown }).parentPort = fake.parentPort;
    try {
      const client = createParentPortCredentialClient();
      const promise = client!.set("modelProvider:agnes", "sk-new");
      const request = fake.sent[0];
      expect(request.op).toBe("set");
      expect(request.key).toBe("modelProvider:agnes");
      expect(request.value).toBe("sk-new");
      fake.parentPort.emit({ type: "credential-result", id: request.id, ok: false, error: "凭证库操作失败" });
      await expect(promise).rejects.toThrow("凭证库操作失败");
    } finally {
      delete (process as unknown as { parentPort?: unknown }).parentPort;
    }
  });

  it("listKeys 携带 prefix 并解析数组响应", async () => {
    const fake = createFakeParentPort();
    (process as unknown as { parentPort?: unknown }).parentPort = fake.parentPort;
    try {
      const client = createParentPortCredentialClient();
      const promise = client!.listKeys("modelProvider:");
      const request = fake.sent[0];
      expect(request.op).toBe("listKeys");
      expect(request.prefix).toBe("modelProvider:");
      fake.parentPort.emit({ type: "credential-result", id: request.id, ok: true, result: ["modelProvider:agnes"] });
      await expect(promise).resolves.toEqual(["modelProvider:agnes"]);
    } finally {
      delete (process as unknown as { parentPort?: unknown }).parentPort;
    }
  });

  it("无关消息（非 credential-result / id 不匹配）被忽略", async () => {
    const fake = createFakeParentPort();
    (process as unknown as { parentPort?: unknown }).parentPort = fake.parentPort;
    try {
      const client = createParentPortCredentialClient();
      const promise = client!.get("modelProvider:agnes");
      const request = fake.sent[0];
      fake.parentPort.emit({ type: "other", id: request.id });
      fake.parentPort.emit({ type: "credential-result", id: "unknown-id", ok: true, result: "x" });
      // 尚未响应，Promise 仍 pending
      let settled = false;
      void promise.then(() => { settled = true; }).catch(() => { settled = true; });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(settled).toBe(false);
      // 正确 id 响应后 resolve
      fake.parentPort.emit({ type: "credential-result", id: request.id, ok: true, result: "ok" });
      await expect(promise).resolves.toBe("ok");
    } finally {
      delete (process as unknown as { parentPort?: unknown }).parentPort;
    }
  });
});
