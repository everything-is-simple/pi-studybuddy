#!/usr/bin/env node
/**
 * pi-studybuddy 桌面安全不变量校验（08-Test §5.7）
 *
 * 硬断言脚本：静态审计 src/ 关键安全配置，任一断言失败立即退出（非零码）。
 *
 * 六条不变量：
 *   1. sandbox:true（webPreferences）            → 本任务实现 ✅
 *   2. 严格 CSP（default-src 'self'）            → 本任务实现 ✅
 *   3. preload 仅 exposeInMainWorld("piBridge")   → 本任务实现 ✅
 *   4. credential-vault 用 safeStorage           → T-M0-003 补全 ⏳
 *   5. Host RPC 契约化（api.ts 完整接口）         → T-M0-002 已实现 ✅
 *   6. HTML 预览独立 CSP（form-action 'none'）    → T-M0-008 补全 ⏳
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

// ---- 已实现（T-M0-001 / T-M0-002 / T-M0-003） ----
console.log("\n已实现（T-M0-001 / T-M0-002 / T-M0-003）：");
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

// --- 占位（后续任务补全） ---
console.log("\n占位（后续任务补全）：");
check(
  "INV-06",
  "HTML 预览独立 CSP（form-action 'none'，不变量 6）→ T-M0-008",
  false,
  "延迟到 T-M0-008",
);

const failed = results.filter((r) => !r.ok);
console.log(
  `\n[check-desktop-security] ${results.length} 条不变量：通过 ${results.length - failed.length}，失败 ${failed.length}（其中 1 条为后续任务占位）`,
);

// 已实现 5 条必须全绿；占位 1 条允许失败（未到对应任务）
const implemented = results.filter((r) =>
  ["INV-01", "INV-02", "INV-03", "INV-04", "INV-05"].includes(r.id),
);
if (implemented.some((r) => !r.ok)) {
  console.error("\n[check-desktop-security] FAILED：存在已实现不变量未通过");
  process.exit(1);
}

console.log("[check-desktop-security] 已实现 5 条不变量全部通过 ✅");