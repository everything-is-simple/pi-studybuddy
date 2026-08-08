import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  checkWorkspaceMutationPath,
  normalizeToolPath,
  type PathGuardDecision,
} from "../../src/agent/workspace-path-guard";

/**
 * T-M1-008 workspace-path-guard 单件测试（03-Arch §3.4 + §8.1 + AGENTS.md §9.4 符号链接逃逸防护）
 *
 * 断言：
 *   - normalizeToolPath：file:// / ~ / 全角空格 规范化
 *   - checkWorkspaceMutationPath：
 *     · 合法相对路径 → block:false
 *     · `..` 逃逸 → block:true
 *     · 符号链接逃逸（realpath 解析）→ block:true（08-Test §4.2）
 *     · `~` 展开到家目录（非 workspace 内）→ block:true
 *     · 空串 → block:true
 *     · 路径不存在但有合法父级 → 不误杀 block:false
 *
 * 数据隔离：H:\pi-studybuddy-tmp\runs\T-M1-008\（AGENTS.md §5.3）
 */

const BASE = "H:\\pi-studybuddy-tmp\\runs\\T-M1-008\\path-guard";
const OUTSIDE = "H:\\pi-studybuddy-tmp\\runs\\T-M1-008\\outside";

describe("normalizeToolPath", () => {
  it("file:// URI → 本地路径", () => {
    expect(normalizeToolPath("file:///C:/data/notes/a.txt")).toBe("C:/data/notes/a.txt");
  });

  it("~ 展开到家目录", () => {
    expect(normalizeToolPath("~/notes/a.txt").startsWith(os.homedir())).toBe(true);
  });

  it("全角空格 → 半角空格", () => {
    expect(normalizeToolPath("a\u3000b.txt")).toBe("a b.txt");
  });
});

describe("checkWorkspaceMutationPath", () => {
  beforeAll(() => {
    rmSync(BASE, { recursive: true, force: true });
    rmSync(OUTSIDE, { recursive: true, force: true });
    mkdirSync(path.join(BASE, "notes"), { recursive: true });
    mkdirSync(OUTSIDE, { recursive: true });
    writeFileSync(path.join(OUTSIDE, "secret.txt"), "secret", "utf8");
  });

  afterAll(() => {
    for (const dir of [BASE, OUTSIDE]) {
      for (let i = 0; i < 3; i++) {
        try {
          rmSync(dir, { recursive: true, force: true });
          break;
        } catch {
          // 忽略 EBUSY
        }
      }
    }
  });

  it("合法相对路径 → block:false", () => {
    const d = checkWorkspaceMutationPath(BASE, "notes/a.txt");
    expect(d.block).toBe(false);
  });

  it("合法绝对路径（workspace 内）→ block:false", () => {
    const d = checkWorkspaceMutationPath(BASE, path.join(BASE, "notes", "a.txt"));
    expect(d.block).toBe(false);
  });

  it("`..` 逃逸 → block:true", () => {
    const d = checkWorkspaceMutationPath(BASE, path.join("..", "..", "other", "evil.txt"));
    expect(d.block).toBe(true);
    expect(d.reason).toBeTruthy();
  });

  it("`~` 展开到家目录（非 workspace 内）→ block:true", () => {
    const d = checkWorkspaceMutationPath(BASE, "~/notes/a.txt");
    expect(d.block).toBe(true);
  });

  it("空串 → block:true", () => {
    const d = checkWorkspaceMutationPath(BASE, "");
    expect(d.block).toBe(true);
  });

  it("路径不存在但有合法父级 → 不误杀 block:false", () => {
    const d = checkWorkspaceMutationPath(BASE, "notes/not-yet-created.md");
    expect(d.block).toBe(false);
  });

  it("符号链接逃逸 → block:true（08-Test §4.2 断言）", () => {
    let linkCreated = false;
    try {
      symlinkSync(OUTSIDE, path.join(BASE, "notes", "escape"), "dir");
      linkCreated = true;
    } catch {
      // Windows 需提升权限，无法创建符号链接则标注跳过
    }
    if (!linkCreated) {
      // 环境不支持符号链接，本用例无法验证，跳过（不产生误报）
      return;
    }
    const d = checkWorkspaceMutationPath(BASE, path.join("notes", "escape", "secret.txt"));
    expect(d.block).toBe(true);
  });
});