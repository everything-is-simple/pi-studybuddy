/**
 * T-M0-006 node:sqlite 内置模块动态加载（05-ERD §9）
 *
 * 不能直接 `import { DatabaseSync } from "node:sqlite"`：
 * esbuild / vite-node 在 transform 阶段会把 `node:` 前缀剥离，导致
 * "Failed to load url sqlite (resolved id: sqlite). Does the file exist?"。
 *
 * 改用 `process.getBuiltinModule("node:sqlite")` 原生加载（Node 22.3+，
 * 本仓 Node v22.16 可用），运行时（Electron 主进程 / vitest）均解析为
 * 内置模块。`import type` 会被 esbuild 擦除、不参与运行时解析。
 */
import type { DatabaseSync as DatabaseSyncInstance } from "node:sqlite";

const nodeSqlite = process.getBuiltinModule("node:sqlite") as {
  DatabaseSync: typeof DatabaseSyncInstance;
};

/** node:sqlite 的 DatabaseSync 构造器（动态加载，避免 esbuild 剥离 node: 前缀） */
export const DatabaseSync = nodeSqlite.DatabaseSync;

/** DatabaseSync 实例类型（与构造器同名，供 `db: DatabaseSync` 类型标注使用） */
export type DatabaseSync = DatabaseSyncInstance;

/** SQLite 命名参数绑定类型（与 node:sqlite SQLInputValue 对齐） */
export type SqlParams = Record<string, string | number | bigint | Uint8Array | null>;