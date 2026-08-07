import { describe, it, expect, vi } from "vitest";
import { createRpcServer, createRpcClient, RpcErrorCode } from "../../src/contract/rpc";
import type { WireMessage } from "../../src/contract/types";

/**
 * T-M0-001 单件测试：自研 MessagePort RPC 层（03-Arch §6.3）
 *
 * 覆盖五种 wire 消息（request/response/subscribe/unsubscribe/event）的往返
 * 与错误处理（UNKNOWN_METHOD / INTERNAL_ERROR）。
 *
 * 测试运行于 Node：用全局 MessageChannel 模拟 renderer↔agent-host 的 MessagePort
 * 通道，server 挂消息通道一端，client 挂另一端（AGENTS.md §5.3 运行数据隔离）。
 */

/** 构造一对互相连通的 MessagePort（模拟跨上下文通道） */
function makeChannelPair(): { portA: MessagePort; portB: MessagePort } {
  const { port1, port2 } = new MessageChannel();
  return { portA: port1, portB: port2 };
}

describe("createRpcServer / createRpcClient", () => {
  it("attachPort 后可接收 request 并返回 response（request↔response 往返）", async () => {
    const { portA, portB } = makeChannelPair();
    const server = createRpcServer();
    server.handle({ "system.ping": () => ({ pong: "pong" }) });
    server.attachPort(portA);

    const client = createRpcClient(portB);
    const result = await client.call("system.ping");
    expect(result).toEqual({ pong: "pong" });

    client.dispose();
    server.dispose();
  });

  it("call(method, args) 将参数正确传递给 handler 并返回处理结果", async () => {
    const { portA, portB } = makeChannelPair();
    const server = createRpcServer();
    server.handle({
      "system.echo": (message: string) => ({ echo: message }),
    });
    server.attachPort(portA);

    const client = createRpcClient(portB);
    const result = await client.call("system.echo", "您好");
    expect(result).toEqual({ echo: "您好" });

    client.dispose();
    server.dispose();
  });

  it("subscribe(topic, key, on) 后 server 推送 event 时回调被触发（event 消息）", async () => {
    const { portA, portB } = makeChannelPair();
    const server = createRpcServer();
    server.attachPort(portA);

    const client = createRpcClient(portB);
    const onEvent = vi.fn();
    client.subscribe("files.changed", "s1", onEvent);

    // 等订阅消息到达 server 后再推送
    await new Promise((r) => setTimeout(r, 10));
    server.pushEvent("files.changed", { path: "/tmp/a.md" }, "s1");

    await new Promise((r) => setTimeout(r, 10));
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({ path: "/tmp/a.md" });

    client.dispose();
    server.dispose();
  });

  it("unsubscribe 后不再收到 event", async () => {
    const { portA, portB } = makeChannelPair();
    const server = createRpcServer();
    server.attachPort(portA);

    const client = createRpcClient(portB);
    const onEvent = vi.fn();
    const unsubscribe = client.subscribe("files.changed", "s1", onEvent);
    unsubscribe();

    await new Promise((r) => setTimeout(r, 10));
    server.pushEvent("files.changed", { path: "/tmp/a.md" }, "s1");

    await new Promise((r) => setTimeout(r, 10));
    expect(onEvent).not.toHaveBeenCalled();

    client.dispose();
    server.dispose();
  });

  it("五种 wire 消息类型在通道上正确流转（request/response/subscribe/unsubscribe/event）", async () => {
    const { portA, portB } = makeChannelPair();
    // portA（server 侧）观察 client 发来的 request/subscribe/unsubscribe
    const seenA: WireMessage["kind"][] = [];
    portA.onmessage = (ev: MessageEvent) => seenA.push((ev.data as WireMessage).kind);
    // portB（client 侧）观察 server 发来的 response/event
    const seenB: WireMessage["kind"][] = [];
    portB.onmessage = (ev: MessageEvent) => seenB.push((ev.data as WireMessage).kind);

    const server = createRpcServer();
    server.handle({ "system.ping": () => ({ pong: "pong" }) });
    server.attachPort(portA);

    const client = createRpcClient(portB);

    // request（client→server）→ response（server→client）
    const p = client.call("system.ping");
    await p;
    await new Promise((r) => setTimeout(r, 10));
    expect(seenA).toContain("request");
    expect(seenB).toContain("response");

    // subscribe（client→server）→ server 推送 event（server→client）
    client.subscribe("files.changed", "s1", vi.fn());
    await new Promise((r) => setTimeout(r, 10));
    expect(seenA).toContain("subscribe");
    server.pushEvent("files.changed", { n: 1 }, "s1");
    await new Promise((r) => setTimeout(r, 10));
    expect(seenB).toContain("event");

    // unsubscribe（client→server）
    const unsubs = client.subscribe("files.changed", "s2", vi.fn());
    unsubs();
    await new Promise((r) => setTimeout(r, 10));
    expect(seenA).toContain("unsubscribe");

    client.dispose();
    server.dispose();
  });

  it("request 无对应 handler → UNKNOWN_METHOD 错误响应", async () => {
    const { portA, portB } = makeChannelPair();
    const server = createRpcServer();
    server.handle({ "system.ping": () => ({ pong: "pong" }) });
    server.attachPort(portA);

    const client = createRpcClient(portB);
    await expect(client.call("system.nope")).rejects.toMatchObject({
      code: RpcErrorCode.UNKNOWN_METHOD,
    });

    client.dispose();
    server.dispose();
  });

  it("handler throw → INTERNAL_ERROR 错误响应", async () => {
    const { portA, portB } = makeChannelPair();
    const server = createRpcServer();
    server.handle({
      "system.boom": () => {
        throw new Error("内部异常");
      },
    });
    server.attachPort(portA);

    const client = createRpcClient(portB);
    await expect(client.call("system.boom")).rejects.toMatchObject({
      code: RpcErrorCode.INTERNAL_ERROR,
    });

    client.dispose();
    server.dispose();
  });
});