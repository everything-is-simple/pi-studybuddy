/**
 * pi-studybuddy 文件变更监听服务（03-Arch §6.5 + §6.6 + 06-API §3.2/§4）
 *
 * 实现：fs.watch({ recursive: true }, onEvent) → 100ms 防抖合并 →
 *       server.pushEvent("files.changed", { path, changeType }, watchedPath)
 *
 * changeType 推断规则（基于 per-target lastExists 跟踪）：
 *   - stat 成功 + lastExists=true  → "change"（已存在文件被修改）
 *   - stat 成功 + lastExists=false → "add"（新增文件）
 *   - stat 失败 + lastExists=true  → "unlink"（文件被删除）
 *   - stat 失败 + lastExists=false → "change"（兜底，避免事件丢失）
 *
 * 初始 lastExists 设置：
 *   - 单文件监听：start 时 stat 一次，预填 targets[filePath].lastExists=true
 *   - 目录监听：targets 初始空，新 target 默认 lastExists=false（首次事件 = 新增）
 *
 * path 字段语义：
 *   - 单文件监听：path = 监听的文件路径
 *   - 目录监听：path = path.join(watchedDir, filename)（实际变更的子文件路径）
 *
 * Stream 订阅 key：始终为监听路径（watchedPath），便于订阅者按目录订阅接收全部子文件事件。
 *
 * 参考：pi-desktop src/agent-host/file-watch.ts（WatchEntry / refs / 防抖范式），独立重实现。
 */
import fs from "node:fs";
import path from "node:path";
import type { RpcServer } from "../contract/rpc";

type ChangeType = "add" | "change" | "unlink";

interface TargetState {
  timer: ReturnType<typeof setTimeout> | null;
  lastExists: boolean;
}

interface WatchEntry {
  watcher: fs.FSWatcher;
  refs: number;
  isDirectory: boolean;
  watchedPath: string;
  /** 每个变更目标的独立防抖定时器 + 上次存在状态 */
  targets: Map<string, TargetState>;
}

export interface FileWatchService {
  /** 启动对 path 的监听；已存在则 refs++；100ms 防抖合并变更事件 */
  start(filePath: string): Promise<void>;
  /** 停止监听；引用计数--，归零时关闭 watcher + 清理所有 timer */
  stop(filePath: string): void;
  /** 停止全部监听并清理所有 timer（dispose 时调用，幂等） */
  dispose(): void;
}

const DEBOUNCE_MS = 100;

export function createFileWatchService(server: RpcServer): FileWatchService {
  const watches = new Map<string, WatchEntry>();

  function emitChange(
    entry: WatchEntry,
    filename?: string | Buffer | null,
  ): void {
    // 确定实际变更的目标路径
    let targetPath = entry.watchedPath;
    if (entry.isDirectory && filename != null) {
      const name = typeof filename === "string" ? filename : filename.toString("utf8");
      if (name) targetPath = path.join(entry.watchedPath, name);
    }

    // 每个目标独立防抖 + lastExists 跟踪
    let target = entry.targets.get(targetPath);
    if (!target) {
      // 新目标默认 lastExists=false（目录监听场景下表示"潜在新增文件"）
      target = { timer: null, lastExists: false };
      entry.targets.set(targetPath, target);
    }

    if (target.timer) clearTimeout(target.timer);
    target.timer = setTimeout(() => {
      target!.timer = null;
      let changeType: ChangeType;
      try {
        fs.statSync(targetPath);
        changeType = target!.lastExists ? "change" : "add";
        target!.lastExists = true;
      } catch {
        changeType = target!.lastExists ? "unlink" : "change";
        target!.lastExists = false;
      }
      server.pushEvent("files.changed", { path: targetPath, changeType }, entry.watchedPath);
    }, DEBOUNCE_MS);
  }

  function stopInternal(filePath: string, force: boolean): void {
    const entry = watches.get(filePath);
    if (!entry) return;
    entry.refs -= 1;
    if (!force && entry.refs > 0) return;
    try {
      entry.watcher.close();
    } catch {
      /* watcher 可能已关闭，忽略 */
    }
    for (const target of entry.targets.values()) {
      if (target.timer) clearTimeout(target.timer);
    }
    entry.targets.clear();
    watches.delete(filePath);
  }

  return {
    async start(filePath: string): Promise<void> {
      const existing = watches.get(filePath);
      if (existing) {
        existing.refs += 1;
        return;
      }

      let initialStats: fs.Stats;
      try {
        initialStats = fs.statSync(filePath);
      } catch {
        throw new Error(`Path not found: ${filePath}`);
      }

      if (!initialStats.isFile() && !initialStats.isDirectory()) {
        throw new Error(`Path is not watchable: ${filePath}`);
      }

      const isDirectory = initialStats.isDirectory();
      const entry: WatchEntry = {
        watcher: undefined as unknown as fs.FSWatcher,
        refs: 1,
        isDirectory,
        watchedPath: filePath,
        targets: new Map(),
      };

      // 单文件监听：预填 lastExists=true（文件已存在，首次事件应为 "change"）
      if (!isDirectory) {
        entry.targets.set(filePath, { timer: null, lastExists: true });
      }

      const onEvent = (_eventType: string, filename: string | Buffer | null): void => {
        emitChange(entry, filename);
      };

      let watcher: fs.FSWatcher;
      try {
        watcher = isDirectory
          ? fs.watch(filePath, { recursive: true }, onEvent)
          : fs.watch(filePath, onEvent);
      } catch {
        // recursive 监听不被支持时回退到非递归
        watcher = fs.watch(filePath, onEvent);
      }

      watcher.on("error", () => {
        stopInternal(filePath, true);
      });

      entry.watcher = watcher;
      watches.set(filePath, entry);
    },

    stop(filePath: string): void {
      stopInternal(filePath, false);
    },

    dispose(): void {
      // 复制 keys 避免迭代中修改 Map
      const paths = Array.from(watches.keys());
      for (const p of paths) stopInternal(p, true);
    },
  };
}
