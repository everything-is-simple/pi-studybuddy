/**
 * T-M4-001 业务数据根初始化（03-Arch §1.2 + §4.3 + 05-ERD §2）
 *
 * main 进程首次启动时调用，确保：
 *   1. global.db 建库 + integrity 断言（复用 T-M0-006 createGlobalDb）
 *   2. 业务数据根子目录就绪（semester/storage/config/exports/memory/l1/memory/l3）
 *
 * 幂等：global.db schema 全部 IF NOT EXISTS（T-M3-007 修复），二次启动不报错。
 * 物理隔离（AGENTS.md §9.5）：仅操作业务数据根，不侵入 ~/.pi。
 */
import { createGlobalDb } from "../data/global";
import { mkdirSync } from "node:fs";
import path from "node:path";

/** 业务数据根子目录清单（03-Arch §1.2 数据流图） */
const DATA_ROOT_SUBDIRS = [
  "semester",
  "storage",
  "config",
  "exports",
  "memory/l1",
  "memory/l3",
] as const;

/**
 * 初始化业务数据根：建 global.db + 创建子目录。
 *
 * `createGlobalDb` 为建库和 integrity 检查打开 SQLite 连接；这里不持有该连接，必须在
 * 返回前关闭，否则 Windows 上的 WAL/SHM 句柄会阻止专用测试数据库清理或后续 Electron
 * 进程独占打开同一数据根。
 *
 * @param dataRoot 业务数据根路径（resolveDataRoot() 解析）
 * @returns global.db 文件路径
 */
export function initializeDataRoot(dataRoot: string): string {
  const global = createGlobalDb(dataRoot);
  try {
    for (const sub of DATA_ROOT_SUBDIRS) {
      mkdirSync(path.join(dataRoot, sub), { recursive: true });
    }
    return global.path;
  } finally {
    global.db.close();
  }
}
