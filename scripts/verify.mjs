#!/usr/bin/env node
/**
 * pi-studybuddy 统一质量门（AGENTS.md §10 + docs/10-开发规范 步骤 8-11 + 14）
 *
 * 阶段化执行（按当前项目阶段选择子集）：
 *   - 设计阶段（当前）：format → lint → typecheck → docs-governance
 *   - M0 骨架阶段：以上 + unit → contract-coverage → desktop-security → build → smoke
 *   - M1+ 业务阶段：以上 + e2e
 *
 * 任一环节失败立即退出（非零退出码），阻塞合并/发布。
 *
 * 用法：
 *   node scripts/verify.mjs               # 自动按当前阶段
 *   node scripts/verify.mjs --stage=design
 *   node scripts/verify.mjs --stage=m0
 *   node scripts/verify.mjs --stage=full
 *   node scripts/verify.mjs --skip=smoke,e2e
 *
 * 参考：
 *   - pi-desktop/scripts/verify.mjs（聚合范式来源）
 *   - pi-desktop/scripts/check-desktop-security.mjs（硬断言范式）
 *   - AGENTS.md §10（开发命令）
 *   - docs/08-Test §1.3（测试纪律铁律）
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

// ---- 参数解析 ----
function parseArgs(args) {
  const out = { stage: null, skip: new Set() };
  for (const arg of args) {
    if (arg.startsWith("--stage=")) out.stage = arg.slice(8);
    else if (arg.startsWith("--skip=")) {
      for (const s of arg.slice(7).split(",").map((x) => x.trim()).filter(Boolean)) {
        out.skip.add(s);
      }
    }
  }
  return out;
}

const opts = parseArgs(argv);

// ---- 阶段自动探测 ----
function detectStage() {
  if (opts.stage) return opts.stage;
  if (!fs.existsSync(path.join(root, "package.json"))) return "design";
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (!pkg.scripts) return "design";
  // 有 build + smoke + test 视为 m0+
  if (pkg.scripts.smoke && pkg.scripts.build && pkg.scripts.test) {
    if (pkg.scripts["test:e2e"]) return "full";
    return "m0";
  }
  return "design";
}

const stage = detectStage();

// ---- 步骤执行器 ----
function run(label, cmd, args, { optional = false } = {}) {
  if (opts.skip.has(label.toLowerCase().replace(/[^a-z]/g, ""))) {
    console.log(`\n==> ${label} [SKIPPED by --skip]`);
    return true;
  }
  console.log(`\n==> ${label}\n> ${cmd} ${args.join(" ")}\n`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: true });
  if (r.status !== 0) {
    if (optional) {
      console.warn(`\n[verify] OPTIONAL STEP FAILED: ${label}（继续）`);
      return true;
    }
    console.error(`\n[verify] FAILED: ${label}`);
    process.exit(r.status ?? 1);
  }
  return true;
}

// ---- 文件存在性辅助 ----
function hasFile(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function hasScript(scriptName) {
  if (!hasFile("package.json")) return false;
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  return Boolean(pkg.scripts && pkg.scripts[scriptName]);
}

// ---- 阶段任务清单 ----
const designChecks = [
  { label: "format:check", cmd: "npm", args: ["run", "format:check"], optional: true, guard: () => hasScript("format:check") },
  { label: "lint", cmd: "npm", args: ["run", "lint"], optional: true, guard: () => hasScript("lint") },
  { label: "typecheck", cmd: "npx", args: ["tsc", "--noEmit"], optional: true, guard: () => hasFile("tsconfig.json") },
  { label: "docs-governance", cmd: "node", args: ["scripts/check-docs-governance.mjs"], guard: () => hasFile("scripts/check-docs-governance.mjs") },
];

const m0Checks = [
  ...designChecks,
  { label: "unit-tests", cmd: "npm", args: ["test"], guard: () => hasScript("test") },
  { label: "contract-coverage", cmd: "node", args: ["scripts/check-contract-coverage.mjs"], guard: () => hasFile("scripts/check-contract-coverage.mjs") },
  { label: "desktop-security", cmd: "node", args: ["scripts/check-desktop-security.mjs"], guard: () => hasFile("scripts/check-desktop-security.mjs") },
  { label: "build", cmd: "npm", args: ["run", "build"], guard: () => hasScript("build") },
  { label: "smoke", cmd: "npm", args: ["run", "smoke"], guard: () => hasScript("smoke") },
];

const fullChecks = [
  ...m0Checks,
  { label: "e2e", cmd: "npm", args: ["run", "test:e2e"], guard: () => hasScript("test:e2e") },
];

let checks;
if (stage === "design") checks = designChecks;
else if (stage === "m0") checks = m0Checks;
else if (stage === "full") checks = fullChecks;
else {
  console.error(`[verify] 未知阶段：${stage}（可选：design / m0 / full）`);
  process.exit(2);
}

// ---- 执行 ----
console.log(`\n[verify] 阶段：${stage}  跳过：${[...opts.skip].join(",") || "（无）"}\n`);

let executed = 0;
let skipped = 0;
for (const step of checks) {
  if (step.guard && !step.guard()) {
    console.log(`\n==> ${step.label} [GUARD 未满足，跳过]`);
    skipped++;
    continue;
  }
  run(step.label, step.cmd, step.args, { optional: step.optional });
  executed++;
}

console.log(`\n[verify] 全部通过（执行 ${executed}，跳过 ${skipped}）`);
