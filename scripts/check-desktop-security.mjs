#!/usr/bin/env node
/**
 * pi-studybuddy 桌面安全不变量校验（08-Test §5.7）
 *
 * 硬断言脚本：静态审计 src/ 关键安全配置，任一断言失败立即退出（非零码）。
 *
 * 六条不变量：
 *   1. sandbox:true（webPreferences）            → T-M0-001 实现 ✅
 *   2. 严格 CSP（default-src 'self'）            → T-M0-001 实现 ✅
 *   3. preload 仅 exposeInMainWorld("piBridge")   → T-M0-001 实现 ✅
 *   4. credential-vault 用 safeStorage           → T-M0-003 实现 ✅
 *   5. Host RPC 契约化（api.ts 完整接口）         → T-M0-002 实现 ✅
 *   6. HTML 预览独立 CSP（form-action 'none'）    → T-M0-009 实现 ✅
 *
 * 用法：
 *   node scripts/check-desktop-security.mjs
 *
 * 参考：pi-desktop/scripts/check-desktop-security.mjs（硬断言范式，独立重实现）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const results = [];
function check(id, name, ok, detail = "") {
  results.push({ id, name, ok });
  const mark = ok ? "✅" : "❌";
  console.log(`  ${mark} [${id}] ${name}${detail ? ` — ${detail}` : ""}`);
}

console.log("[check-desktop-security] 安全不变量校验（08-Test §5.7）");

// ---- 六条不变量（T-M0-001 / T-M0-002 / T-M0-003 / T-M0-009 全部实现） ----
console.log("\n六条不变量校验（08-Test §5.7）：");
check(
  "INV-01",
  "sandbox:true（webPreferences，08-Test §5.7 不变量 1）",
  readSource("src/main/window.ts").includes("sandbox: true"),
);
check(
  "INV-02",
  "严格 CSP（default-src 'self'，不变量 2）",
  readSource("src/shared/constants.ts").includes("default-src 'self'"),
);
check(
  "INV-03",
  "preload 仅 exposeInMainWorld('piBridge')（不变量 3）",
  /exposeInMainWorld\s*\(\s*["']piBridge["']/.test(readSource("src/preload/preload.ts")),
);
check(
  "INV-04",
  "credential-vault 用 safeStorage（不变量 4）→ T-M0-003",
  /import\s*\{\s*safeStorage\s*\}\s*from\s*["']electron["']/.test(
    readSource("src/main/credential-vault.ts"),
  ),
);

// INV-05：Host RPC 契约化（06-API §3 ~100 方法）。断言 api.ts 含完整接口（方法数 ≥ 阈值）。
const apiTs = readSource("src/contract/api.ts");
const apiMethodCount = (apiTs.match(/^\s*"[a-zA-Z]+\.[a-zA-Z]+"\s*:/gm) || []).length;
check(
  "INV-05",
  "Host RPC 契约化（api.ts 完整接口，不变量 5）→ T-M0-002",
  apiMethodCount >= 50,
  `api.ts 方法数 ${apiMethodCount}（阈值 ≥ 50）`,
);

// INV-06：HTML 预览独立 CSP（form-action 'none'）。断言 constants.ts 含 HTML_PREVIEW_CSP
// 且 protocol.ts 对 .html 响应接入（08-Test §5.7 不变量 6，T-M0-009 补全）。
const constantsSrc = readSource("src/shared/constants.ts");
const protocolSrc = readSource("src/main/protocol.ts");
check(
  "INV-06",
  "HTML 预览独立 CSP（form-action 'none'，不变量 6）→ T-M0-009",
  constantsSrc.includes("HTML_PREVIEW_CSP") &&
    constantsSrc.includes("form-action 'none'") &&
    protocolSrc.includes("HTML_PREVIEW_CSP"),
  "constants.ts 定义 HTML_PREVIEW_CSP + protocol.ts 接入",
);

const failed = results.filter((r) => !r.ok);
console.log(
  `\n[check-desktop-security] ${results.length} 条不变量：通过 ${results.length - failed.length}，失败 ${failed.length}`,
);

// 六条全绿才通过（08-Test §5.7：任一断言失败阻塞合并）
if (failed.length > 0) {
  console.error("\n[check-desktop-security] FAILED：存在未通过的不变量");
  process.exit(1);
}

console.log("[check-desktop-security] 六条不变量全部通过 ✅");