/**
 * T-M1-010 E2E Node.js 子进程启动器
 *
 * 使用 child_process.fork() 启动系统 Node.js 22+ 子进程（node:sqlite 可用）。
 * 运行数据隔离（AGENTS.md §5.3）：PI_STUDYBUDDY_DATA_ROOT 指向 H:\pi-studybuddy-tmp\runs\T-M3-008\。
 *
 * 通信协议：Node.js IPC 通道（child.send / child.on('message')）
 *   - 测试驱动器 → 子进程：{"type":"rpc","id":"...","method":"...","args":[...]}
 *   - 子进程 → 测试驱动器：{"type":"ready"} 或 {"id":"...","result":...} 或 {"id":"...","error":{...}}
 *
 * 注：Electron 33 使用 Node.js 20，不含 node:sqlite；E2E 测试用 child_process.fork
 * 启动系统 Node.js 22，复用生产 utilityProcess.fork 范式（agent-host 独立进程）。
 */
import path from "node:path";
import fs from "node:fs";
import { fork, type ChildProcess } from "node:child_process";
import { once, EventEmitter } from "node:events";

/** E2E 运行数据隔离根（AGENTS.md §5.3） */
export const E2E_RUN_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M3-008\\e2e";

/** 测试主入口绝对路径 */
const TEST_MAIN = path.resolve(__dirname, "..", "test-main.js");

/** 项目根 */
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

/** 子进程通信通道 */
export interface E2EChannel extends EventEmitter {
  send(obj: unknown): void;
  child: ChildProcess;
}

export interface LaunchedApp {
  channel: E2EChannel;
  dataRoot: string;
  dispose: () => Promise<void>;
}

/**
 * 创建 IPC 通信通道
 *
 * 协议：
 *   发送：child.send(obj)
 *   接收：child.on('message', msg => emitter.emit('message', msg))
 */
function createChannel(child: ChildProcess): E2EChannel {
  const emitter = new EventEmitter() as E2EChannel & { child: ChildProcess };
  emitter.child = child;

  child.on("message", (msg: unknown) => {
    emitter.emit("message", msg);
  });

  emitter.send = (obj: unknown) => {
    child.send(obj);
  };

  return emitter;
}

/**
 * 启动 E2E 测试子进程。
 *
 * 前置：pnpm build 已完成（dist/ 产物齐全）。
 *
 * @param suffix 数据根子目录后缀（多测试用例隔离）
 * @param options.reuseDataRoot 复用同一 dataRoot 不清理（E2E-13 二次 launch 重启语义，
 *   验证 L3 检索跨进程持久化；默认 false 每次清理）
 */
export async function launchElectron(
  suffix = "default",
  options: { reuseDataRoot?: boolean } = {},
): Promise<LaunchedApp> {
  const dataRoot = path.join(E2E_RUN_DIR, suffix);
  if (!options.reuseDataRoot) {
    // 清理旧数据
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(dataRoot, { recursive: true });

  const child = fork(TEST_MAIN, [], {
    env: {
      ...process.env,
      PI_STUDYBUDDY_DATA_ROOT: dataRoot,
    },
    cwd: PROJECT_ROOT,
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });

  // 收集 stderr 用于调试
  child.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) console.error(`[e2e child stderr] ${text}`);
  });

  const channel = createChannel(child);

  // 等待 {"type":"ready"} 消息（最多 30s）
  const readyPromise = once(channel, "message").then(([msg]) => {
    const m = msg as { type?: string };
    if (m.type === "error") {
      throw new Error(`子进程启动失败: ${JSON.stringify(msg)}`);
    }
    if (m.type !== "ready") {
      throw new Error(`预期 ready 消息但收到: ${JSON.stringify(msg)}`);
    }
  });
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("子进程启动超时（30s 未收到 ready）")), 30_000);
  });
  await Promise.race([readyPromise, timeoutPromise]);

  return {
    channel,
    dataRoot,
    async dispose() {
      try {
        channel.removeAllListeners();
        child.kill("SIGTERM");
        // 等待进程退出
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            child.kill("SIGKILL");
            resolve();
          }, 5_000);
          child.on("exit", () => {
            clearTimeout(timer);
            resolve();
          });
        });
      } catch {
        // 忽略关闭异常
      }
    },
  };
}
