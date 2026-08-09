/**
 * pi-studybuddy agent-host files handlers（06-API §3.2）
 *
 * T-M3-001：files.watch / files.unwatch 两 RPC handler。
 * T-M3-002：实现 files.read（现成契约 + allowed-roots 白名单门禁，用户批准方案）。
 *
 * files.read 语义（07-WF §2.8 步骤 4 @文件引用承载）：
 *   - 文件路径必须经 allowed-roots 白名单校验（AGENTS.md §9.4 符号链接逃逸防护）
 *   - 越权路径 → BAD_REQUEST（不泄漏真实路径细节）
 *   - 文件不存在 → NOT_FOUND
 *   - 内容 ≤1MB 截断（防超大文件注入上下文）
 *
 * 安全（AGENTS.md §9.3）：错误信息不携带完整路径/UUID；内容不落日志。
 */
import type { FileWatchService } from "../file-watch";
import fs from "node:fs";
import path from "node:path";
import { isPathWithinAllowedRoot, resolveDataRoot } from "../allowed-roots";

/** 读取内容上限（1MB，超出截断避免巨型文本注入对话上下文） */
const MAX_READ_BYTES = 1024 * 1024;

/** 白名单越权错误（不泄漏真实路径；RpcError 纯对象，06-API §2.2） */
function outsideAllowedRoot(): never {
  throw { code: "BAD_REQUEST", message: "文件路径不在业务数据根白名单内" };
}

/** 文件不存在错误 */
function fileNotFound(): never {
  throw { code: "NOT_FOUND", message: "文件不存在" };
}

function invalidParams(): never {
  throw { code: "BAD_REQUEST", message: "参数无效" };
}

function resolveAllowedPath(rawPath: unknown, dataRoot: string): string {
  if (typeof rawPath !== "string" || !rawPath) invalidParams();
  const absPath = path.isAbsolute(rawPath) ? rawPath : path.join(dataRoot, rawPath);
  if (!isPathWithinAllowedRoot(absPath, dataRoot)) outsideAllowedRoot();
  return absPath;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}

export function createFileHandlers(
  service: FileWatchService,
  options?: { dataRoot?: string },
) {
  const dataRoot = options?.dataRoot ?? resolveDataRoot();

  return {
    // 目录选择依赖 Electron main 的 dialog 能力，renderer 应调用 PiBridge.selectDirectory。
    // host 仍显式拒绝，避免契约方法在 production 入口中静默缺失。
    "files.selectDirectory": (): { path: string } => {
      throw { code: "BAD_REQUEST", message: "目录选择仅可通过桌面桥调用" };
    },
    "files.list": (params: unknown) => {
      const absDir = resolveAllowedPath((params as { dir?: unknown }).dir, dataRoot);
      if (!fs.existsSync(absDir)) fileNotFound();
      let stat: fs.Stats;
      try {
        stat = fs.statSync(absDir);
      } catch {
        throw { code: "BAD_REQUEST", message: "目录读取失败" };
      }
      if (!stat.isDirectory()) throw { code: "BAD_REQUEST", message: "目标不是目录" };
      return fs.readdirSync(absDir, { withFileTypes: true }).map((entry) => {
        const entryPath = path.join(absDir, entry.name);
        const entryStat = fs.statSync(entryPath);
        return {
          name: entry.name,
          path: entryPath,
          type: entry.isDirectory() ? ("dir" as const) : ("file" as const),
          ...(entry.isDirectory() ? {} : { size: entryStat.size }),
          mtime: entryStat.mtime.toISOString(),
        };
      });
    },
    "files.previewMarkdown": (params: unknown): { html: string } => {
      const absPath = resolveAllowedPath((params as { path?: unknown }).path, dataRoot);
      if (!fs.existsSync(absPath)) fileNotFound();
      if (path.extname(absPath).toLowerCase() !== ".md") {
        throw { code: "BAD_REQUEST", message: "仅支持 Markdown 预览" };
      }
      const content = fs.readFileSync(absPath, "utf8");
      return { html: `<pre>${escapeHtml(content)}</pre>` };
    },
    "files.previewDocx": (params: unknown): { html: string } => {
      const absPath = resolveAllowedPath((params as { path?: unknown }).path, dataRoot);
      if (!fs.existsSync(absPath)) fileNotFound();
      // 当前未引入 DOCX 渲染器；明确失败而非返回伪造 HTML 或泄漏内容。
      throw { code: "BAD_REQUEST", message: "DOCX 预览组件尚未配置" };
    },
    "files.watch": async (params: unknown): Promise<void> => {
      const { path } = params as { path: string };
      await service.start(path);
    },
    "files.unwatch": (params: unknown): void => {
      const { path } = params as { path: string };
      service.stop(path);
    },
    // T-M3-002：@文件引用内容读取（07-WF §2.8 步骤 4 + AGENTS.md §9.4）
    // 相对路径（materials.storageKey）先相对数据根解析为绝对路径，再做白名单校验
    "files.read": async (params: unknown): Promise<{ content: string; encoding: string }> => {
      const { path: rawPath } = params as { path: string };
      const absPath = resolveAllowedPath(rawPath, dataRoot);
      if (!fs.existsSync(absPath)) {
        fileNotFound();
      }
      let content: string;
      try {
        const stat = fs.statSync(absPath);
        let buf: Buffer;
        if (stat.size > MAX_READ_BYTES) {
          // 超大文件只读前 MAX_READ_BYTES 字节（防巨型文本注入对话上下文）
          const fd = fs.openSync(absPath, "r");
          try {
            buf = Buffer.alloc(MAX_READ_BYTES);
            const read = fs.readSync(fd, buf, 0, MAX_READ_BYTES, 0);
            buf = buf.subarray(0, read);
          } finally {
            fs.closeSync(fd);
          }
        } else {
          buf = fs.readFileSync(absPath);
        }
        content = buf.toString("utf8");
      } catch {
        throw { code: "BAD_REQUEST", message: "文件读取失败" };
      }
      return { content, encoding: "utf8" };
    },
  };
}
