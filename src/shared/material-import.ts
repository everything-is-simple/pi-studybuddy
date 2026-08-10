/**
 * S2 资料导入 capability（T-M4-011）。
 *
 * main 进程仅能从用户选取的普通文件创建一次性 staging token；agent-host 只允许
 * 从业务数据根 imports/materials/<token> 导入，绝不接受 renderer 传入的任意绝对路径。
 */
import { copyFileSync, lstatSync, mkdirSync, renameSync, unlinkSync, type Stats } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface MaterialImportCapability {
  token: string;
  fileName: string;
  fileSize: number;
}

function fail(message: string): never {
  throw new Error(message);
}

function requireRegularFile(filePath: string, message: string): Stats {
  let stat: Stats;
  try {
    stat = lstatSync(filePath);
  } catch {
    return fail(message);
  }
  if (stat.isSymbolicLink() || !stat.isFile()) return fail(message);
  return stat;
}

export function materialImportDirectory(dataRoot: string): string {
  return path.join(dataRoot, "imports", "materials");
}

export function materialImportPath(dataRoot: string, token: string): string {
  if (!TOKEN_PATTERN.test(token)) return fail("资料导入凭据无效");
  return path.join(materialImportDirectory(dataRoot), token);
}

/** main 进程：将 dialog 选取的普通文件保存为一次性 capability。 */
export function stageMaterialImport(dataRoot: string, sourcePath: string): MaterialImportCapability {
  const source = path.resolve(sourcePath);
  const sourceStat = requireRegularFile(source, "所选资料不是普通文件，已拒绝导入");
  const token = randomUUID();
  const target = materialImportPath(dataRoot, token);
  mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp`;
  try {
    copyFileSync(source, temporary);
    renameSync(temporary, target);
  } catch {
    try { unlinkSync(temporary); } catch { /* best effort cleanup */ }
    return fail("资料暂存失败，请稍后重试");
  }
  return { token, fileName: path.basename(source), fileSize: Number(sourceStat.size) };
}

/** agent-host：把一次性 capability 导入 Material 的唯一 storageKey，消费 token。 */
export function consumeMaterialImport(dataRoot: string, token: string, storageKey: string): number {
  const source = materialImportPath(dataRoot, token);
  const sourceStat = requireRegularFile(source, "资料导入凭据无效或已过期");
  const destination = path.resolve(dataRoot, storageKey);
  const storageRoot = path.resolve(dataRoot, "semester");
  if (!destination.startsWith(`${storageRoot}${path.sep}`)) return fail("资料存储路径非法，已拒绝导入");

  mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    copyFileSync(source, temporary);
    renameSync(temporary, destination);
    unlinkSync(source);
  } catch {
    try { unlinkSync(temporary); } catch { /* best effort cleanup */ }
    return fail("资料文件导入失败，请稍后重试");
  }
  return Number(sourceStat.size);
}

/** DB 写入失败时清理本次唯一导入产物。 */
export function removeMaterialImportTarget(dataRoot: string, storageKey: string): void {
  try { unlinkSync(path.resolve(dataRoot, storageKey)); } catch { /* best effort cleanup */ }
}
