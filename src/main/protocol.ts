/**
 * pi-studybuddy main 进程自定义协议 app://（03-Arch §6.4 安全骨架）
 *
 * 注册 app:// 协议，从 dist/renderer 提供静态资源，并通过 CSP 响应头
 * 强制 `default-src 'self'`（08-Test §5.7 安全不变量之二）。
 */
import { protocol } from "electron";
import path from "node:path";
import fs from "node:fs";
import { RENDERER_CSP, HTML_PREVIEW_CSP } from "../shared/constants";

const RENDERER_ROOT = path.join(__dirname, "../renderer");

/** MIME 类型映射（严格匹配，未命中默认拒绝，AGENTS.md §9.4） */
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

export function registerAppProtocol(): void {
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    // 防护：禁止路径穿越（workspace-path-guard，AGENTS.md §9.4）
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const filePath = path.normalize(path.join(RENDERER_ROOT, rel));
    if (!filePath.startsWith(RENDERER_ROOT)) {
      return new Response("Forbidden", { status: 403 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext];
    if (!contentType) {
      return new Response("Not Found", { status: 404 });
    }

    const body = fs.readFileSync(filePath);
    // .html 响应用更严格的 HTML_PREVIEW_CSP（含 form-action 'none'，08-Test §5.7 不变量 6），
    // 其他类型用 RENDERER_CSP。
    const csp = ext === ".html" ? HTML_PREVIEW_CSP : RENDERER_CSP;
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        "content-type": contentType,
        "content-security-policy": csp,
      },
    });
  });
}