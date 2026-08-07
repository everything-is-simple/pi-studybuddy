/**
 * pi-studybuddy main 进程 host-manager（03-Arch §6.2 + §6.3）
 *
 * 负责 fork agent-host utilityProcess，并响应 renderer 的 connectHost 请求：
 * 创建一对 MessageChannelMain，一端通过 parentPort 的 { type: "connect" } 控制消息
 * 转交给 agent-host，另一端返回 renderer，从而建立 renderer↔agent-host 的 RPC 通道。
 *
 * 本文件实现进程编排逻辑；真实 Electron 的 utilityProcess.fork 与 MessageChannelMain
 * 由 main.ts 提供的依赖注入（forkAgent + createChannelPair），便于集成测试模拟。
 */
import type { AnyMessagePort } from "../contract/rpc";

/** main 侧持有的 agent-host 句柄（抽象 utilityProcess 的最小接口） */
export interface AgentHostHandle {
  /** 通过控制消息把一条 MessagePort 转交给 agent-host */
  sendConnectPort(port: AnyMessagePort): void;
  /** 注册 agent-host 退出回调 */
  onExit(cb: () => void): void;
  /** 终止 agent-host */
  kill(): void;
}

/** 创建一对连通 MessagePort（真实 Electron 为 MessageChannelMain） */
export type ChannelPairFactory = () => { rendererEnd: AnyMessagePort; hostEnd: AnyMessagePort };

export interface HostManager {
  /** 建立 renderer↔agent-host 的 RPC 通道，返回 renderer 端 MessagePort */
  connectHost(): Promise<AnyMessagePort>;
  /** 注册 agent-host 异常退出回调（用于重启） */
  onExit(cb: () => void): void;
  dispose(): void;
}

export interface HostManagerDeps {
  forkAgent(): AgentHostHandle;
  createChannelPair: ChannelPairFactory;
}

export function createHostManager(deps: HostManagerDeps): HostManager {
  let agent = deps.forkAgent();
  const exitCbs = new Set<() => void>();
  agent.onExit(() => {
    for (const cb of exitCbs) cb();
  });

  return {
    connectHost() {
      const { rendererEnd, hostEnd } = deps.createChannelPair();
      agent.sendConnectPort(hostEnd);
      return Promise.resolve(rendererEnd);
    },
    onExit(cb) {
      exitCbs.add(cb);
    },
    dispose() {
      exitCbs.clear();
      agent.kill();
    },
  };
}