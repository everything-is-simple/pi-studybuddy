import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { RENDERER_CSP, HTML_PREVIEW_CSP } from "../../src/shared/constants";

/**
 * 安全不变量测试（08-Test §5.7 六条）
 *
 * 六条硬断言：
 *   1. windowConfig.webPreferences.sandbox === true
 *   2. CSP 含 default-src 'self'
 *   3. preload 仅 contextBridge.exposeInMainWorld("piBridge", ...)
 *   4. credential-vault 用 safeStorage（T-M0-003）
 *   5. Host RPC 契约化（api.ts 完整接口，T-M0-002）
 *   6. HTML 预览独立 CSP 含 form-action 'none'（T-M0-009 补全）
 *
 * 静态审计源码（在统一质量门 check-desktop-security.mjs 中重复执行，供 shell 侧校验）。
 */

const ROOT = path.resolve(__dirname, "../..");

function readSource(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("安全不变量（08-Test §5.7 六条）", () => {
  it("不变量1：main 窗口 webPreferences.sandbox === true", () => {
    const src = readSource("src/main/window.ts");
    expect(src).toContain("sandbox: true");
    expect(src).toContain("contextIsolation: true");
    expect(src).toContain("nodeIntegration: false");
  });

  it("不变量2：CSP 含 default-src 'self'（renderer 常量 + index.html 双重生效）", () => {
    expect(RENDERER_CSP).toContain("default-src 'self'");
    // 服务端响应头 + HTML meta 双保险
    const html = readSource("src/renderer/index.html");
    expect(html).toContain("default-src 'self'");
    // main/protocol.ts 通过 CSP 响应头下发常量
    const protocol = readSource("src/main/protocol.ts");
    expect(protocol).toContain("content-security-policy");
  });

  it("不变量3：preload 仅 exposeInMainWorld('piBridge', ...)，无其他全局暴露", () => {
    const preload = readSource("src/preload/preload.ts");
    // 提取所有 exposeInMainWorld 的第一个字符串字面量实参（排除注释/类型声明）
    const exposed = [...new Set(
      [...preload.matchAll(/exposeInMainWorld\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1]),
    )];
    expect(exposed).toEqual(["piBridge"]);
    // 禁止直接把 ipcRenderer 等对象暴露到全局
    expect(preload).not.toContain('exposeInMainWorld("ipcRenderer"');
  });

  it("不变量4：credential-vault 用 safeStorage（T-M0-003）", () => {
    const src = readSource("src/main/credential-vault.ts");
    expect(/import\s*\{\s*safeStorage\s*\}\s*from\s*["']electron["']/.test(src)).toBe(true);
  });

  it("不变量5：Host RPC 契约化（api.ts 完整接口，T-M0-002）", () => {
    const apiTs = readSource("src/contract/api.ts");
    const methodCount = (apiTs.match(/^\s*"[a-zA-Z]+\.[a-zA-Z]+"\s*:/gm) || []).length;
    expect(methodCount).toBeGreaterThanOrEqual(50);
  });

  it("不变量6：HTML 预览独立 CSP 含 form-action 'none'（T-M0-009）", () => {
    // HTML_PREVIEW_CSP 常量存在且含 form-action 'none'
    expect(HTML_PREVIEW_CSP).toBeDefined();
    expect(HTML_PREVIEW_CSP).toContain("form-action 'none'");
    expect(HTML_PREVIEW_CSP).toContain("default-src 'self'");
    // protocol.ts 对 .html 响应注入 HTML_PREVIEW_CSP（更严格）
    const protocol = readSource("src/main/protocol.ts");
    expect(protocol).toContain("HTML_PREVIEW_CSP");
  });
});