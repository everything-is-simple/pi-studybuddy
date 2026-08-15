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
import { assertIntegrity } from "../data/db";
import { DatabaseSync } from "../data/sqlite";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
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

export interface DataRootMigrationRequest {
  currentRoot: string;
  targetRoot: string;
  registryPath: string;
}

export interface StartupDataRootOptions {
  defaultRoot: string;
  registryPath: string;
  environmentRoot?: string;
}

export interface StartupDataRootResolution {
  dataRoot: string;
  source: "environment" | "scheduled" | "active" | "default" | "recovered";
  recovered: boolean;
}

interface DataRootRegistry {
  activeRoot?: string;
  pendingRoot?: string;
}

function normalizedPath(value: string): string {
  return path.resolve(value);
}

function isSameOrDescendant(candidate: string, ancestor: string): boolean {
  const relative = path.relative(ancestor, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function readRegistry(registryPath: string): DataRootRegistry {
  try {
    const parsed = JSON.parse(readFileSync(registryPath, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const registry = parsed as DataRootRegistry;
    return {
      activeRoot: typeof registry.activeRoot === "string" ? registry.activeRoot : undefined,
      pendingRoot: typeof registry.pendingRoot === "string" ? registry.pendingRoot : undefined,
    };
  } catch {
    return {};
  }
}

function writeRegistry(registryPath: string, registry: DataRootRegistry): void {
  mkdirSync(path.dirname(registryPath), { recursive: true });
  const temporaryPath = `${registryPath}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(registry), "utf8");
  renameSync(temporaryPath, registryPath);
}

function isUsableDataRoot(dataRoot: string): boolean {
  const globalPath = path.join(dataRoot, "global.db");
  if (!existsSync(globalPath)) return false;
  let globalDb: DatabaseSync | undefined;
  try {
    globalDb = new DatabaseSync(globalPath);
    assertIntegrity(globalDb);
    const semesters = globalDb
      .prepare("SELECT id, db_relative_path FROM semesters WHERE deleted_at IS NULL")
      .all() as Array<{ id: string; db_relative_path: string }>;
    for (const semester of semesters) {
      const relativePath = semester.db_relative_path.replace(/[\\/]+/g, path.sep);
      const semesterPath = path.resolve(dataRoot, relativePath);
      const root = path.resolve(dataRoot) + path.sep;
      if (!semesterPath.startsWith(root) || !existsSync(semesterPath)) return false;
      let semesterDb: DatabaseSync | undefined;
      try {
        semesterDb = new DatabaseSync(semesterPath);
        assertIntegrity(semesterDb);
      } finally {
        semesterDb?.close();
      }
    }
    return true;
  } catch {
    return false;
  } finally {
    globalDb?.close();
  }
}

/**
 * Copies all managed assets into an empty controlled target and records a next-launch switch.
 * The running process continues using `currentRoot`; only `resolveStartupDataRoot` consumes it.
 */
export function prepareDataRootMigration(request: DataRootMigrationRequest): void {
  const currentRoot = normalizedPath(request.currentRoot);
  const targetRoot = normalizedPath(request.targetRoot);
  if (currentRoot === targetRoot || isSameOrDescendant(targetRoot, currentRoot) || isSameOrDescendant(currentRoot, targetRoot)) {
    throw new Error("数据根迁移目标不能与当前数据根重叠");
  }
  if (!isUsableDataRoot(currentRoot)) throw new Error("当前数据根不可用，无法迁移");
  if (existsSync(targetRoot) && readdirSync(targetRoot).length > 0) {
    throw new Error("数据根迁移目标必须为空目录");
  }

  try {
    if (existsSync(targetRoot)) rmSync(targetRoot, { recursive: true, force: true });
    mkdirSync(path.dirname(targetRoot), { recursive: true });
    cpSync(currentRoot, targetRoot, { recursive: true, errorOnExist: true, force: false });
    if (!isUsableDataRoot(targetRoot)) throw new Error("迁移副本校验失败");
    writeRegistry(request.registryPath, { activeRoot: currentRoot, pendingRoot: targetRoot });
  } catch (error) {
    rmSync(targetRoot, { recursive: true, force: true });
    throw error;
  }
}
export function resolveStartupDataRoot(options: StartupDataRootOptions): StartupDataRootResolution {
  if (options.environmentRoot) {
    return { dataRoot: options.environmentRoot, source: "environment", recovered: false };
  }
  const registry = readRegistry(options.registryPath);
  if (registry.pendingRoot) {
    if (isUsableDataRoot(registry.pendingRoot)) {
      writeRegistry(options.registryPath, { activeRoot: registry.pendingRoot });
      return { dataRoot: registry.pendingRoot, source: "scheduled", recovered: false };
    }
    const fallback = registry.activeRoot && isUsableDataRoot(registry.activeRoot)
      ? registry.activeRoot
      : options.defaultRoot;
    writeRegistry(options.registryPath, { activeRoot: fallback });
    return { dataRoot: fallback, source: "recovered", recovered: true };
  }
  if (registry.activeRoot && isUsableDataRoot(registry.activeRoot)) {
    return { dataRoot: registry.activeRoot, source: "active", recovered: false };
  }
  return { dataRoot: options.defaultRoot, source: "default", recovered: false };
}

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
