/**
 * T-M1-008 workspace-path-guard（03-Arch §3.4 + §8.1 + AGENTS.md §9.4 符号链接逃逸防护）
 *
 * 在 pi.on("tool_call") 钩子中校验 write/edit 类工具目标路径不逃逸业务数据根（dataRoot）。
 * 流程：normalizeToolPath → resolve（相对路径以 workspace 为基准）→ findExistingAncestor
 *       → realpathSync（解析符号链接）→ isWithin 边界判定。
 */
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export interface PathGuardDecision {
  block: boolean;
  reason?: string;
}

/** 越界固定文案（不泄漏绝对路径之外的敏感信息） */
const BLOCK_REASON = "拒绝写入业务数据根目录之外的路径，请使用业务数据根内的相对路径。";

/**
 * 规范化工具路径（与 pi 内置文件工具一致）。
 * - `file://` URI → 本地路径
 * - `~` / `~/` → 家目录
 * - 全角空格（U+3000）→ 半角空格
 */
export function normalizeToolPath(input: string): string {
  let p = input.trim();
  if (p.startsWith("file://")) {
    p = p.replace(/^file:\/\/\/?/, "");
  }
  if (p === "~" || p.startsWith("~/")) {
    p = path.join(os.homedir(), p.slice(1));
  }
  p = p.replace(/\u3000/g, " ");
  return p;
}

/** 判定 check 是否落在 base 边界内（含相等） */
function isWithin(base: string, check: string): boolean {
  const b = path.resolve(base);
  const c = path.resolve(check);
  return c === b || c.startsWith(b + path.sep);
}

/**
 * 解析路径并沿存在祖先做 realpath（符号链接逃逸防护）。
 * 目标路径可能不存在（新建文件）：从 p 向上找最近存在的祖先，realpath 解析后再接回尾段。
 */
function resolveWithExistingAncestor(p: string): string {
  let tail = "";
  let probe = p;
  while (!existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) return path.resolve(p); // 到根仍不存在，退化返回
    tail = path.join(path.basename(probe), tail);
    probe = parent;
  }
  const realAncestor = realpathSync(probe);
  return path.join(realAncestor, tail);
}

/**
 * 判定 write/edit 目标路径是否落在 workspaceDir 边界内。
 * @param workspaceDir 业务数据根目录（越界边界）
 * @param requestedPath 工具传入的待写路径（绝对/相对/~/file://）
 */
export function checkWorkspaceMutationPath(workspaceDir: string, requestedPath: string): PathGuardDecision {
  if (typeof requestedPath !== "string" || requestedPath.trim() === "") {
    return { block: true, reason: BLOCK_REASON };
  }
  const normalized = normalizeToolPath(requestedPath);
  const base = path.resolve(workspaceDir);
  const resolved = path.isAbsolute(normalized) ? path.resolve(normalized) : path.resolve(base, normalized);
  const realBase = realpathSync(base);
  const realTarget = resolveWithExistingAncestor(resolved);
  if (!isWithin(realBase, realTarget)) {
    return { block: true, reason: BLOCK_REASON };
  }
  return { block: false };
}