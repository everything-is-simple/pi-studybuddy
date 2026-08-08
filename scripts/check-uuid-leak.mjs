#!/usr/bin/env node
/**
 * pi-studybuddy S6 UUID 泄漏检测独立静态审计脚本（T-M2-006）
 *
 * 硬断言脚本：静态审计 S6 家长报告 assertNoSensitiveLeak UUID 泄漏检测布线。
 * 任一断言失败立即退出（非零码），阻塞合并（03-Arch §8.2 + 08-Test §5.4 + §5.7 范式）。
 *
 * 七条断言：
 *   UUID-01  leak-detector.ts 定义 UUID 正则 8-4-4-4-12 hex          → T-M2-002 ✅
 *   UUID-02  assertNoSensitiveLeak 存在且 JSON.stringify 后扫描      → T-M2-002 ✅
 *   UUID-03  errors.ts privacyViolation + types.ts ErrorCode 含该码  → T-M2-002 ✅
 *   UUID-04  reports.ts 规则报告阶段 assertNoSensitiveLeak(ruleReport)→ T-M2-002 ✅
 *   UUID-05  reports.ts 冻结阶段 assertNoSensitiveLeak(content)      → T-M2-002 ✅
 *   UUID-06  错误 message 固定文案（不含路径分隔符，不泄漏堆栈）      → AGENTS.md §9.3
 *   UUID-07  types.ts ParentReport.privacyCheckPassed                → 05-ERD §3.6
 *
 * 用法：
 *   node scripts/check-uuid-leak.mjs [--src <dir>]
 *
 * --src：覆盖源根目录（用于测试注入"布线缺失"夹具），默认仓库根。
 *
 * 参考：scripts/check-desktop-security.mjs（硬断言 + 非零退出码范式，独立重实现）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- 参数解析：--src <dir> 覆盖源根（测试用），--help / -h ----
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("用法: node scripts/check-uuid-leak.mjs [--src <dir>]");
  process.exit(0);
}
const srcIdx = args.indexOf("--src");
const root = srcIdx >= 0 && args[srcIdx + 1] ? path.resolve(args[srcIdx + 1]) : repoRoot;

function readSource(rel) {
  try {
    return fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    // 源文件缺失视为布线缺失：该源的所有断言失败，最终统一打印 FAILED 退出非零码
    return "";
  }
}

const results = [];
function check(id, name, ok, detail = "") {
  results.push({ id, name, ok });
  const mark = ok ? "✅" : "❌";
  console.log(`  ${mark} [${id}] ${name}${detail ? ` — ${detail}` : ""}`);
}

console.log("[check-uuid-leak] S6 UUID 泄漏检测布线静态审计（03-Arch §8.2 + 08-Test §5.4）");

// ---- UUID-01：leak-detector.ts 定义 8-4-4-4-12 hex 正则（03-Arch §8.2） ----
const leakSrc = readSource("src/agent-host/handlers/s6/leak-detector.ts");
check(
  "UUID-01",
  "leak-detector.ts 定义 UUID 正则 8-4-4-4-12 hex",
  leakSrc.includes("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"),
);

// ---- UUID-02：assertNoSensitiveLeak 存在且 JSON.stringify 后扫描（03-Arch §8.2） ----
check(
  "UUID-02",
  "assertNoSensitiveLeak 存在 + JSON.stringify 后扫描",
  /function\s+assertNoSensitiveLeak\s*\(/.test(leakSrc) && leakSrc.includes("JSON.stringify"),
);

// ---- UUID-03：errors.ts privacyViolation + types.ts ErrorCode（06-API §2.2 + 02-PRD §5.2） ----
const errorsSrc = readSource("src/agent-host/handlers/s6/errors.ts");
const typesSrc = readSource("src/contract/types.ts");
check(
  "UUID-03",
  "privacyViolation + ErrorCode PARENT_REPORT_PRIVACY_VIOLATION",
  /function\s+privacyViolation\s*\(/.test(errorsSrc) &&
    errorsSrc.includes("PARENT_REPORT_PRIVACY_VIOLATION") &&
    /PARENT_REPORT_PRIVACY_VIOLATION/.test(typesSrc),
);

// ---- UUID-04：reports.ts 规则报告阶段调用 assertNoSensitiveLeak(ruleReport)（08-Test §5.4） ----
const reportsSrc = readSource("src/agent-host/handlers/s6/reports.ts");
check(
  "UUID-04",
  "规则报告阶段 assertNoSensitiveLeak(ruleReport)",
  /assertNoSensitiveLeak\s*\(\s*ruleReport\s*\)/.test(reportsSrc),
);

// ---- UUID-05：reports.ts 冻结阶段调用 assertNoSensitiveLeak(content)（07-WF §3.1） ----
check(
  "UUID-05",
  "冻结阶段 assertNoSensitiveLeak(content)",
  /assertNoSensitiveLeak\s*\(\s*content\s*\)/.test(reportsSrc),
);

// ---- UUID-06：错误 message 固定文案（不含路径分隔符 : \ /，不泄漏堆栈）（AGENTS.md §9.3） ----
const privacyMatch = leakSrc.match(/privacyViolation\s*\(\s*"([^"]+)"/);
const privacyMessage = privacyMatch ? privacyMatch[1] : "";
const noPathLeak = privacyMessage.length > 0 && !/[:\\/]/.test(privacyMessage);
check(
  "UUID-06",
  "错误 message 固定文案不含路径分隔符",
  noPathLeak,
  privacyMessage ? `message="${privacyMessage.slice(0, 24)}…"` : "未提取到 message",
);

// ---- UUID-07：types.ts ParentReport 含 privacyCheckPassed（05-ERD §3.6） ----
check(
  "UUID-07",
  "types.ts ParentReport.privacyCheckPassed",
  /privacyCheckPassed/.test(typesSrc),
);

const failed = results.filter((r) => !r.ok);
console.log(
  `\n[check-uuid-leak] ${results.length} 条断言：通过 ${results.length - failed.length}，失败 ${failed.length}`,
);

// 七条全绿才通过（任一断言失败退出非零码，阻塞合并）
if (failed.length > 0) {
  console.error("\n[check-uuid-leak] FAILED：存在未通过的 UUID 泄漏检测布线断言");
  process.exit(1);
}

console.log("[check-uuid-leak] S6 UUID 泄漏检测布线全部通过 ✅");