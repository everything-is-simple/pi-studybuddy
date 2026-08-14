/**
 * T-M4-022 真实 Electron 业务 E2E 启动器
 *
 * 使用 node_modules/electron/dist/electron.exe 启动真实 Electron 主进程，
 * 不再用系统 Node.js 子进程冒充 Electron E2E。
 * 运行数据隔离（AGENTS.md §5.3）：
 *   process.env.PI_STUDYBUDDY_E2E_RUN_DIR ?? H:\\pi-studybuddy-tmp\\runs\\T-M4-022\\e2e\\<suffix>
 *
 * 通信协议：127.0.0.1 回环 TCP JSON-lines
 *   - 测试驱动器 → Electron：{"type":"rpc","id":"...","method":"...","args":[...]}
 *   - Electron → 测试驱动器：{"type":"ready","runtime":...} 或
 *     {"id":"...","result":...} / {"id":"...","error":...}
 *
 * Electron 主进程仍运行既有 test-main.js 的业务 handler fixture；改变的是进程边界，
 * 使 handler 代码在真实 Electron 的内嵌 Node/SQLite 运行时中执行。
 */
import path from "node:path";
import fs from "node:fs";
import net, { type Socket } from "node:net";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once, EventEmitter } from "node:events";

/** E2E 运行数据隔离根（AGENTS.md §5.3）；任务可显式注入专属目录。 */
export const E2E_RUN_DIR = process.env.PI_STUDYBUDDY_E2E_RUN_DIR ?? "H:\\pi-studybuddy-tmp\\runs\\T-M4-022\\e2e";

/** 测试主入口绝对路径 */
const TEST_MAIN = path.resolve(__dirname, "..", "test-main.js");

/** 项目根 */
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

/** Electron 可执行文件（pnpm build/install 后由 package.json 提供） */
const ELECTRON_BIN = path.resolve(
  PROJECT_ROOT,
  "node_modules",
  "electron",
  "dist",
  process.platform === "win32" ? "electron.exe" : "electron",
);

/** 协议前缀，避免日志污染 JSON-lines */
const PROTOCOL_PREFIX = "__PI_STUDYBUDDY_E2E__";

export interface ElectronRuntimeInfo {
  electron: string | null;
  node: string;
}

/** 子进程通信通道 */
export interface E2EChannel extends EventEmitter {
  send(obj: unknown): void;
  child: ChildProcessWithoutNullStreams;
  socket: Socket;
}

export interface LaunchedApp {
  channel: E2EChannel;
  dataRoot: string;
  runtime: ElectronRuntimeInfo;
  dispose: () => Promise<void>;
}

/**
 * 创建回环 TCP JSON-lines 通信通道。
 *
 * Electron 主进程在当前 Windows Electron 环境中不会可靠接收 stdin pipe，
 * 因此真实 E2E 使用仅监听 127.0.0.1 的短生命周期 socket；stdout/stderr 仅作诊断。
 */
function createChannel(
  child: ChildProcessWithoutNullStreams,
  socket: Socket,
): E2EChannel {
  const emitter = new EventEmitter() as E2EChannel & {
    child: ChildProcessWithoutNullStreams;
    socket: Socket;
  };
  emitter.child = child;
  emitter.socket = socket;

  let socketBuffer = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk: string | Buffer) => {
    socketBuffer += chunk.toString();
    let newlineIndex = socketBuffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = socketBuffer.slice(0, newlineIndex).replace(/\r$/, "");
      socketBuffer = socketBuffer.slice(newlineIndex + 1);
      if (line.startsWith(PROTOCOL_PREFIX)) {
        const payload = line.slice(PROTOCOL_PREFIX.length);
        try {
          emitter.emit("message", JSON.parse(payload));
        } catch (error) {
          emitter.emit(
            "error",
            new Error(`Electron E2E TCP 协议解析失败: ${String(error)}; line=${line}`),
          );
        }
      } else if (line.trim()) {
        console.error(`[e2e electron tcp] ${line}`);
      }
      newlineIndex = socketBuffer.indexOf("\n");
    }
  });

  socket.on("error", (error) => {
    emitter.emit("channelError", error);
  });
  socket.on("close", () => emitter.emit("close"));
  socket.resume();

  child.stdout.on("data", (chunk: Buffer | string) => {
    const text = chunk.toString().trim();
    if (text) console.error(`[e2e electron stdout] ${text}`);
  });
  child.stderr.on("data", (chunk: Buffer | string) => {
    const text = chunk.toString().trim();
    if (text) console.error(`[e2e electron stderr] ${text}`);
  });

  emitter.send = (obj: unknown) => {
    if (socket.destroyed || !socket.writable) {
      throw new Error("Electron E2E TCP socket 已关闭");
    }
    socket.write(`${PROTOCOL_PREFIX}${JSON.stringify(obj)}\n`);
  };

  return emitter;
}

function listenOnLoopback(server: net.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("E2E TCP server 未取得监听端口"));
        return;
      }
      resolve(address.port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(0, "127.0.0.1");
  });
}

function acceptOneConnection(server: net.Server): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const onConnection = (socket: Socket) => {
      server.off("error", onError);
      server.close();
      // 在 createChannel 安装 data listener 前暂停 socket，避免 ready 消息丢失。
      socket.pause();
      resolve(socket);
    };
    const onError = (error: Error) => {
      server.off("connection", onConnection);
      reject(error);
    };
    server.once("connection", onConnection);
    server.once("error", onError);
  });
}

function withTimeout<T>(promise: Promise<T>, message: string, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * 启动真实 Electron 业务 E2E 进程。
 *
 * 前置：pnpm build 已完成（dist/ 产物齐全）。
 *
 * @param suffix 数据根子目录后缀（多测试用例隔离）
 * @param options.reuseDataRoot 复用同一 dataRoot 不清理（E2E-13 二次 launch 重启语义）
 */
export async function launchElectron(
  suffix = "default",
  options: { reuseDataRoot?: boolean; dataRoot?: string } = {},
): Promise<LaunchedApp> {
  const dataRoot = options.dataRoot ?? path.join(E2E_RUN_DIR, suffix);
  if (!options.reuseDataRoot) {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(dataRoot, { recursive: true });

  if (!fs.existsSync(ELECTRON_BIN)) {
    throw new Error(`Electron 可执行文件不存在：${ELECTRON_BIN}`);
  }

  const server = net.createServer();
  let child: ChildProcessWithoutNullStreams | undefined;
  let socket: Socket | undefined;
  try {
    const port = await listenOnLoopback(server);
    const connectionPromise = acceptOneConnection(server);
    child = spawn(ELECTRON_BIN, ["--no-sandbox", TEST_MAIN], {
      env: {
        ...process.env,
        PI_STUDYBUDDY_DATA_ROOT: dataRoot,
        PI_STUDYBUDDY_E2E_PORT: String(port),
      },
      cwd: PROJECT_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    child.once("error", (error) => console.error(`[e2e electron process] ${error.message}`));
    const childExitPromise = new Promise<never>((_, reject) => {
      child!.once("exit", (code, signal) => {
        reject(new Error(`真实 Electron 在连接前退出：code=${code}, signal=${signal}`));
      });
    });
    socket = await withTimeout(
      Promise.race([connectionPromise, childExitPromise]),
      "真实 Electron TCP 连接超时（30s 未连接）",
      30_000,
    );
    const channel = createChannel(child, socket);

    // 等待 {"type":"ready"} 消息（最多 30s）。ready 同时携带 Electron/Node 运行时事实。
    const readyPromise = once(channel, "message").then(([msg]) => {
      const m = msg as {
        type?: string;
        error?: unknown;
        runtime?: { electron?: unknown; node?: unknown };
      };
      if (m.type === "error") {
        throw new Error(`真实 Electron E2E 启动失败: ${JSON.stringify(msg)}`);
      }
      if (m.type !== "ready") {
        throw new Error(`预期 Electron ready 消息但收到: ${JSON.stringify(msg)}`);
      }
      return {
        electron: typeof m.runtime?.electron === "string" ? m.runtime.electron : null,
        node: typeof m.runtime?.node === "string" ? m.runtime.node : "",
      } satisfies ElectronRuntimeInfo;
    });
    const runtime = await withTimeout(
      readyPromise,
      "真实 Electron 启动超时（30s 未收到 ready）",
      30_000,
    );

    return {
      channel,
      dataRoot,
      runtime,
      async dispose() {
        try {
          channel.removeAllListeners();
          if (!socket!.destroyed) socket!.destroy();
          if (!child!.killed && child!.exitCode === null) child!.kill("SIGTERM");
          await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
              if (!child!.killed && child!.exitCode === null) child!.kill("SIGKILL");
              resolve();
            }, 5_000);
            child!.once("exit", () => {
              clearTimeout(timer);
              resolve();
            });
            if (child!.exitCode !== null) {
              clearTimeout(timer);
              resolve();
            }
          });
        } catch {
          // 忽略关闭异常；测试主体已经完成，避免 teardown 覆盖原始断言。
        }
      },
    };
  } catch (error) {
    socket?.destroy();
    if (child && !child.killed && child.exitCode === null) child.kill("SIGKILL");
    server.close();
    throw error;
  }
}

export { PROTOCOL_PREFIX };
