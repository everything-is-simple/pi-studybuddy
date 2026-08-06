#!/usr/bin/env node
/**
 * pi-studybuddy 文档治理检查（AGENTS.md §11 + docs/00-文档索引）
 *
 * 检查项：
 *   1. 设计文档文件名规范：^\d{2}-.+-[A-Za-z0-9-]+\.md$
 *   2. 每份 docs/ 文档已在 00-索引登记
 *   3. 文档头部版本/日期/状态三字段齐全
 *   4. 00-索引 §三 表格与磁盘文档一致（无幽灵、无遗漏）
 *   5. 00-索引 §七 当前状态与文档头部状态一致
 *   6. supersedes 关系显式（若文档标注 supersedes，需指向具体被替代的版本）
 *   7. 治理资产清单一致性（AGENTS.md §3.3 表）
 *
 * 失败任一项 → 非零退出码，阻塞合并。
 *
 * 用法：node scripts/check-docs-governance.mjs
 *
 * 参考：
 *   - AGENTS.md §11（治理文件修改规则）
 *   - AGENTS.md §3.3（治理资产清单）
 *   - docs/00-文档索引-Index.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(root, "docs");

const failures = [];
const warnings = [];

function fail(msg) {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
}
function warn(msg) {
  warnings.push(msg);
  console.warn(`WARN: ${msg}`);
}

// ---- 1. 读取 00-索引 ----
const indexPath = path.join(docsDir, "00-文档索引-Index.md");
if (!fs.existsSync(indexPath)) {
  fail("docs/00-文档索引-Index.md 不存在——无法治理");
  process.exit(1);
}
const indexContent = fs.readFileSync(indexPath, "utf8");

// ---- 2. 扫描 docs/ 下所有设计文档 ----
const docFileNamePattern = /^(\d{2})-(.+)-([A-Za-z0-9-]+)\.md$/;
const designDocs = [];
for (const file of fs.readdirSync(docsDir)) {
  if (!file.endsWith(".md")) continue;
  const m = file.match(docFileNamePattern);
  if (m) {
    designDocs.push({
      file,
      number: m[1],
      slug: m[2],
      suffix: m[3],
      fullPath: path.join(docsDir, file),
    });
  } else if (file === "prep-参考点核对表.md") {
    // prep 是合法的非编号文档，跳过
    continue;
  } else if (!/^\d{2}-/.test(file)) {
    // 非编号文档，跳过（如 README 等）
    continue;
  } else {
    fail(`文档文件名不规范：${file}（应匹配 ${docFileNamePattern}）`);
  }
}

// ---- 3. 每份设计文档头部字段检查 ----
function parseHeader(content) {
  const headerMatch = content.match(/^\*\*版本\*\*：(.+?)\n\*\*日期\*\*：(.+?)\n\*\*状态\*\*：(.+?)\n/m);
  if (!headerMatch) return null;
  return {
    version: headerMatch[1].trim(),
    date: headerMatch[2].trim(),
    status: headerMatch[3].trim(),
  };
}

const docHeaders = new Map();
for (const doc of designDocs) {
  const content = fs.readFileSync(doc.fullPath, "utf8");
  const header = parseHeader(content);
  if (!header) {
    // 00 索引作为元文档豁免（自身即治理元数据，头部字段为"用途"）
    if (doc.number === "00") continue;
    fail(`${doc.file}：头部缺少 **版本**/**日期**/**状态** 三字段`);
    continue;
  }
  docHeaders.set(doc.file, header);

  // 状态字段规范检查
  if (!header.status.includes("已审查批准") && !header.status.includes("草案") && !header.status.includes("待审查")) {
    warn(`${doc.file}：状态字段非标准格式："${header.status}"`);
  }
}

// ---- 4. 00-索引 §三 表格登记核对 ----
const indexTableSection = indexContent.split("## 三、文档结构")[1] || "";
const indexTableRows = [...indexTableSection.matchAll(/^\|\s*(\d{2})\s*\|[^|]+\|\s*(.+?)\s*\|/gm)];
const indexRegisteredNumbers = new Set(indexTableRows.map((m) => m[1]));

for (const doc of designDocs) {
  if (!indexRegisteredNumbers.has(doc.number)) {
    fail(`${doc.file}（编号 ${doc.number}）未在 00-索引 §三 登记为正式编号`);
  }
}

// 检查 00-索引登记的编号，是否在磁盘都有对应文件
const docNumbersOnDisk = new Set(designDocs.map((d) => d.number));
for (const num of indexRegisteredNumbers) {
  if (!docNumbersOnDisk.has(num) && num !== "00" && num !== "subsystems") {
    // subsystems 是占位符，允许
    fail(`00-索引 §三 登记了编号 ${num}，但磁盘无对应文档文件`);
  }
}

// ---- 5. 00-索引 §七 当前状态核对 ----
const statusSection = indexContent.split("## 七、当前状态")[1]?.split("## 八")[0] || "";
for (const [file, header] of docHeaders) {
  const docNumber = file.match(docFileNamePattern)?.[1];
  if (!docNumber || docNumber === "00") continue;
  // 在 §七 中精确查找以该编号开头的状态行（如 "- [x] 03-Architecture ..."）
  const statusLinePattern = new RegExp(`^\\s*-\\s*\\[x\\]\\s*${docNumber}[^\\n]*$`, "im");
  const statusMatch = statusSection.match(statusLinePattern);
  if (!statusMatch) {
    fail(`00-索引 §七 未找到 ${file} 的状态记录`);
    continue;
  }
  const statusLine = statusMatch[0];
  // 头部状态与索引 §七 状态一致性
  if (header.status.includes("已审查批准") && !statusLine.includes("✅") && !statusLine.includes("已审查批准")) {
    fail(`${file} 头部状态"已审查批准"与 00-索引 §七 状态不一致：\n  头部：${header.status}\n  索引：${statusLine}`);
  }
  if (header.status.includes("草案") && statusLine.includes("✅ 已审查批准")) {
    fail(`${file} 头部状态"草案"但 00-索引 §七 标"✅ 已审查批准"`);
  }
}

// ---- 6. supersedes 关系检查 ----
for (const doc of designDocs) {
  const content = fs.readFileSync(doc.fullPath, "utf8");
  const supersedesMatch = content.match(/\*\*supersedes\*\*[:：]\s*(.+)/i);
  if (supersedesMatch) {
    const target = supersedesMatch[1].trim();
    // supersedes 必须指向具体版本号
    if (!/v\d+\.\d+\.\d+/.test(target)) {
      fail(`${doc.file}：supersedes 未指向具体版本号（应含 vX.Y.Z 格式）："${target}"`);
    }
  }
}

// ---- 7. 治理资产清单一致性（AGENTS.md §3.3）----
const agentsPath = path.join(root, "AGENTS.md");
if (fs.existsSync(agentsPath)) {
  const agentsContent = fs.readFileSync(agentsPath, "utf8");
  // 提取 §3.3 表中列出的治理资产（status 📝/✅）
  const governanceAssetsSection = agentsContent.split("### 3.3 治理资产")[1]?.split("## §4")[0] || "";
  const listedAssets = [...governanceAssetsSection.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1]);
  for (const asset of listedAssets) {
    // 对已 ✅ 的资产检查文件存在
    const rowMatch = governanceAssetsSection.match(new RegExp(`\\| \\\`${asset.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\\`[^\\n]*✅`));
    if (!rowMatch) continue;

    // 资产存在性检查：
    // - 目录路径（如 .plan/ .record/ .pi/skills/*）→ 检查目录存在
    // - 无扩展名的 docs/ 资产（如 docs/10-开发规范）→ glob 匹配 docs/<asset>-*.md
    // - 完整文件路径 → 直接 fs.existsSync
    let exists = false;
    if (asset.endsWith("/")) {
      // 目录路径
      exists = fs.existsSync(path.join(root, asset));
    } else if (asset.includes("*")) {
      // glob 模式（如 .pi/skills/*）→ 至少存在一个匹配的子目录/文件
      const baseDir = path.join(root, path.dirname(asset));
      if (fs.existsSync(baseDir) && fs.statSync(baseDir).isDirectory()) {
        exists = fs.readdirSync(baseDir).length > 0;
      }
    } else if (asset.startsWith("docs/") && !path.extname(asset)) {
      // docs/ 下的无扩展名资产 → 匹配 docs/<asset>-*.md
      const dir = path.dirname(path.join(root, asset));
      const prefix = path.basename(asset);
      if (fs.existsSync(dir)) {
        exists = fs.readdirSync(dir).some((f) => f.startsWith(prefix + "-") && f.endsWith(".md"));
      }
    } else {
      exists = fs.existsSync(path.join(root, asset));
    }
    if (!exists) {
      fail(`AGENTS.md §3.3 标 ✅ 的治理资产 ${asset} 不存在`);
    }
  }
}

// ---- 8. 治理基线文件检查（AGENTS.md §11.1）----
const baselineFiles = [
  "AGENTS.md",
  "README.md",
  "docs/00-文档索引-Index.md",
  "docs/10-开发规范-Dev-Rules.md",
  "docs/11-组件装配-Component-Assembly.md",
  "docs/12-目录治理-Directory-Governance.md",
];
for (const file of baselineFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    fail(`治理基线文件缺失：${file}`);
  }
}

// ---- 9. .pi/skills 与 .pi/prompts 完整性 ----
const skillDirs = [
  ".pi/skills/studybuddy-task-complete",
  ".pi/skills/studybuddy-component-assembly",
];
for (const dir of skillDirs) {
  const skillFile = path.join(root, dir, "SKILL.md");
  if (!fs.existsSync(skillFile)) {
    fail(`治理 Skill 缺失：${skillFile}`);
  } else {
    const skillContent = fs.readFileSync(skillFile, "utf8");
    if (!skillContent.startsWith("---\n") || !skillContent.includes("name:")) {
      fail(`治理 Skill frontmatter 缺失：${skillFile}`);
    }
  }
}

const promptFiles = [".pi/prompts/wr.md", ".pi/prompts/plan.md"];
for (const file of promptFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    fail(`工作流模板缺失：${file}`);
  }
}

// ---- 汇总 ----
console.log("");
if (failures.length === 0) {
  console.log(`OK: 文档治理检查通过（${designDocs.length} 份设计文档 + ${skillDirs.length} 个 Skill + ${promptFiles.length} 个 prompt）`);
  if (warnings.length > 0) {
    console.log(`（${warnings.length} 条警告，不阻塞）`);
  }
  process.exit(0);
} else {
  console.error(`\n文档治理检查失败：${failures.length} 项失败`);
  process.exit(1);
}
