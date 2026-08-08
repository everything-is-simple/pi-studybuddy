/**
 * T-M3-002 RED: allowed-roots 白名单校验纯函数
 *
 * 权威依据：07-WF §2.8 步骤 4（@文件引用经 allowed-roots 校验）+ AGENTS.md §9.4
 * （符号链接逃逸防护：文件路径注入对话上下文必须经 allowed-roots 白名单校验）。
 *
 * 测试策略：纯函数断言，无文件系统写入（临时目录仅作路径字符串夹具）。
 */
import { describe, it, expect } from "vitest";
import { isPathWithinAllowedRoot, summarizePathForDisplay } from "../../src/agent-host/allowed-roots";

// Windows 风格路径夹具（业务数据根 = %LOCALAPPDATA%\PiStudyBuddy）
const DATA_ROOT = "C:\\Users\\student\\AppData\\Local\\PiStudyBuddy";

describe("isPathWithinAllowedRoot（AGENTS.md §9.4 白名单校验）", () => {
  it("白名单内路径通过", () => {
    expect(isPathWithinAllowedRoot(`${DATA_ROOT}\\semester\\s1\\storage\\note.pdf`, DATA_ROOT)).toBe(true);
  });

  it("数据根自身通过", () => {
    expect(isPathWithinAllowedRoot(DATA_ROOT, DATA_ROOT)).toBe(true);
  });

  it("越权路径拒绝（父目录之外）", () => {
    expect(isPathWithinAllowedRoot("C:\\Users\\student\\Documents\\secret.txt", DATA_ROOT)).toBe(false);
  });

  it("路径穿越（..）拒绝", () => {
    expect(isPathWithinAllowedRoot(`${DATA_ROOT}\\..\\..\\secret.txt`, DATA_ROOT)).toBe(false);
  });

  it("前缀相似但越权拒绝（PiStudyBuddy2 不是白名单内）", () => {
    expect(isPathWithinAllowedRoot("C:\\Users\\student\\AppData\\Local\\PiStudyBuddy2\\x.txt", DATA_ROOT)).toBe(false);
  });

  it("大小写归一化（Windows 不区分大小写）", () => {
    expect(isPathWithinAllowedRoot("c:\\users\\student\\appdata\\local\\pistudybuddy\\a.txt", DATA_ROOT)).toBe(true);
  });

  it("空路径/未定义拒绝", () => {
    expect(isPathWithinAllowedRoot("", DATA_ROOT)).toBe(false);
    expect(isPathWithinAllowedRoot(undefined as unknown as string, DATA_ROOT)).toBe(false);
  });
});

describe("summarizePathForDisplay（展示用相对路径，不落日志）", () => {
  it("白名单内返回相对路径", () => {
    expect(summarizePathForDisplay(`${DATA_ROOT}\\semester\\s1\\storage\\note.pdf`, DATA_ROOT)).toBe("semester\\s1\\storage\\note.pdf");
  });

  it("越权路径返回占位符（不泄漏路径）", () => {
    expect(summarizePathForDisplay("C:\\Users\\student\\Documents\\secret.txt", DATA_ROOT)).toBe("[外部路径]");
  });
});
