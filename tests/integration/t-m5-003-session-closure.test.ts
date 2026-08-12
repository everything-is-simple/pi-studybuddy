/**
 * T-M5-003 RED：对话/会话真实用户闭环（host 侧）
 *
 * 权威依据：09-UI §3.3/§7（真实会话生命周期 + 重启持久化）、06-API §3.1/§3.1.1
 * （sessions.* + agent.send）、AGENTS.md §5.1（RED→GREEN）、§5.3（数据隔离）。
 *
 * RED 目标（当前生产行为必须失败）：
 *   C-RED-01 生产空数据根 `sessions.list` 返回空（生产不注入 defaultSessionFixture）。
 *   C-RED-02 `agent.send` 携带真实（非 sess-001/sess-new 常量）sessionId → 会话被
 *            物化进列表；两个不同 ID 各自历史/元数据不串。
 *   C-RED-03 会话元数据在重启（同 dataRoot 新 host）后仍可见（持久化）。
 *
 * 数据隔离：PI_STUDYBUDDY_DATA_ROOT → H:\pi-studybuddy-tmp\runs\T-M5-003\。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MessageChannel } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { createHostManager } from "../../src/main/host-manager";
import { createAgentHost } from "../../src/agent-host";
import { createRpcClient, type AnyMessagePort } from "../../src/contract/rpc";
import type { Session, SessionSummary } from "../../src/contract/types";

const RUN_ROOT = path.join("H:", "pi-studybuddy-tmp", "runs", "T-M5-003", "integration-session-closure");
const DATA_ROOT = path.join(RUN_ROOT, "data");

function makeMemoryParentPort(): {
  parentPort: AnyMessagePort;
  deliverConnect(hostEnd: AnyMessagePort): void;
} {
  const listeners: Array<(ev: { data: unknown; ports?: AnyMessagePort[] }) => void> = [];
  const parentPort: AnyMessagePort = {
    addEventListener(_type: string, cb: (ev: { data: unknown; ports?: AnyMessagePort[] }) => void) {
      listeners.push(cb);
    },
    start() {},
  };
  return {
    parentPort,
    deliverConnect(hostEnd: AnyMessagePort) {
      for (const cb of listeners) cb({ data: { type: "connect" }, ports: [hostEnd] });
    },
  };
}

/** 启动一个完整 agent-host + renderer 端 RPC 客户端（复用 sessions-handlers.test.ts 范式） */
async function makeApp(): Promise<{ client: ReturnType<typeof createRpcClient>; dispose: () => void }> {
  const control = makeMemoryParentPort();
  const agentHost = createAgentHost(control.parentPort);
  const hostManager = createHostManager({
    forkAgent: () => ({
      sendConnectPort(port: AnyMessagePort) {
        control.deliverConnect(port);
      },
      onExit() {},
      kill() {},
    }),
    createChannelPair: () => {
      const { port1, port2 } = new MessageChannel();
      return { rendererEnd: port1 as unknown as AnyMessagePort, hostEnd: port2 as unknown as AnyMessagePort };
    },
  });
  const rendererEnd = await hostManager.connectHost();
  const client = createRpcClient(rendererEnd);
  return {
    client,
    dispose() {
      client.dispose();
      hostManager.dispose();
      agentHost.dispose();
    },
  };
}

describe("T-M5-003 host 侧会话真实闭环（RED）", () => {
  beforeAll(() => {
    process.env.PI_STUDYBUDDY_DATA_ROOT = DATA_ROOT;
    fs.rmSync(RUN_ROOT, { recursive: true, force: true });
    fs.mkdirSync(DATA_ROOT, { recursive: true });
  });

  afterAll(() => {
    delete process.env.PI_STUDYBUDDY_DATA_ROOT;
    fs.rmSync(RUN_ROOT, { recursive: true, force: true });
  });

  it("C-RED-01 生产空数据根 sessions.list 返回空（不注入 fixture 会话）", async () => {
    const app = await makeApp();
    try {
      const list = (await app.client.call("sessions.list", {})) as SessionSummary[];
      expect(list).toEqual([]);
    } finally {
      app.dispose();
    }
  });

  it("C-RED-02 agent.send 用真实新 ID 物化会话，两个会话各自元数据不串", async () => {
    const app = await makeApp();
    try {
      const idA = randomUUID();
      const idB = randomUUID();
      await app.client.call("agent.send", {
        sessionId: idA,
        text: "帮我理解极限的 ε-δ 定义",
        sessionMeta: { subject: "高数", goal: "极限练习" },
      });
      await app.client.call("agent.send", {
        sessionId: idB,
        text: "帮我整理英语听力笔记",
        sessionMeta: { subject: "英语", goal: "听力笔记" },
      });

      const list = (await app.client.call("sessions.list", {})) as SessionSummary[];
      expect(list.some((s) => s.id === idA)).toBe(true);
      expect(list.some((s) => s.id === idB)).toBe(true);

      const sessionA = (await app.client.call("sessions.get", { id: idA })) as Session;
      expect(sessionA).toBeTruthy();
      expect(sessionA.subject).toBe("高数");
      expect(sessionA.goal).toBe("极限练习");

      const sessionB = (await app.client.call("sessions.get", { id: idB })) as Session;
      expect(sessionB.subject).toBe("英语");
      expect(sessionB.goal).toBe("听力笔记");
    } finally {
      app.dispose();
    }
  });

  it("C-RED-03 会话在重启（同 dataRoot 新 host）后仍可见（持久化）", async () => {
    const app1 = await makeApp();
    const id = randomUUID();
    try {
      await app1.client.call("agent.send", {
        sessionId: id,
        text: "重启后仍应保留的会话",
        sessionMeta: { subject: "物理", goal: "重启持久化" },
      });
      const list1 = (await app1.client.call("sessions.list", {})) as SessionSummary[];
      expect(list1.some((s) => s.id === id)).toBe(true);
    } finally {
      app1.dispose();
    }

    // 同 dataRoot 重新启动（模拟应用重启）
    const app2 = await makeApp();
    try {
      const list2 = (await app2.client.call("sessions.list", {})) as SessionSummary[];
      expect(list2.some((s) => s.id === id)).toBe(true);
      const session = (await app2.client.call("sessions.get", { id: id })) as Session;
      expect(session.subject).toBe("物理");
    } finally {
      app2.dispose();
    }
  });
});
