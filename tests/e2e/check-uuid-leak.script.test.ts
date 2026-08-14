/**
 * T-M2-006 check-uuid-leak.mjs 脚本冒烟测试（08-Test §5.4 + §5.7）
 *
 * 对独立静态审计脚本本身做冒烟：
 *   - 真实源码下全绿（退出码 0）
 *   - 源目录缺失（布线缺失夹具）→ 失败标记（非零退出码）
 *   - --help 正常退出 0
 *
 * 数据隔离（AGENTS.md §5.3）：夹具写入 H:\pi-studybuddy-tmp\runs\T-M2-006\
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts", "check-uuid-leak.mjs");
const runs = "H:/pi-studybuddy-tmp/runs/T-M2-006";

function runScript(args: string[]): { code: number; output: string } {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  return {
    code: result.status ?? (result.error ? 1 : 0),
    output: String(result.stdout ?? "") + String(result.stderr ?? ""),
  };
}

describe("check-uuid-leak.mjs 脚本冒烟", () => {
  it("真实源码下全绿（退出码 0 + 全部通过标记）", () => {
    const { code, output } = runScript([]);
    expect(code).toBe(0);
    expect(output).toContain("全部通过");
  });

  it("源目录缺失（布线缺失夹具）→ 失败标记 + 非零退出码", () => {
    const emptyDir = path.join(runs, "empty-src");
    fs.mkdirSync(emptyDir, { recursive: true });
    const { code, output } = runScript(["--src", emptyDir]);
    expect(code).not.toBe(0);
    expect(output).toContain("FAILED");
  });

  it("--help 正常退出 0", () => {
    const { code, output } = runScript(["--help"]);
    expect(code).toBe(0);
    expect(output).toContain("用法");
  });
});