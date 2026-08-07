/**
 * T-M0-004 toolchain-runtime 单件测试（03-Arch §6.5 第 4 点）
 *
 * prependPath 函数：把托管工具目录前缀到 PATH，不修改原 env。
 */
import { describe, it, expect } from "vitest";
import { prependPath } from "../../src/agent-host/toolchain-runtime";

describe("toolchain-runtime", () => {
  it("RUNTIME-01: prependPath 把目录前缀到 PATH", () => {
    const result = prependPath(
      { PATH: "/usr/bin:/bin" },
      ["/opt/tools"],
      "linux",
    );
    expect(result.PATH).toBe("/opt/tools:/usr/bin:/bin");
  });

  it("RUNTIME-02: prependPath 保留原有 PATH 条目", () => {
    const result = prependPath(
      { PATH: "/usr/bin" },
      ["/opt/tools"],
      "linux",
    );
    expect(result.PATH).toContain("/usr/bin");
    expect(result.PATH).toContain("/opt/tools");
  });

  it("RUNTIME-03: prependPath 对空目录数组返回原样", () => {
    const result = prependPath(
      { PATH: "/usr/bin" },
      [],
      "linux",
    );
    expect(result.PATH).toBe("/usr/bin");
  });

  it("RUNTIME-04: prependPath 处理 Windows 路径分隔符", () => {
    const result = prependPath(
      { PATH: "C:\\Windows;C:\\Tools" },
      ["D:\\toolchains"],
      "win32",
    );
    expect(result.PATH).toBe("D:\\toolchains;C:\\Windows;C:\\Tools");
  });

  it("RUNTIME-05: prependPath 不修改原 env 对象", () => {
    const original = { PATH: "/usr/bin" };
    const originalPath = original.PATH;
    prependPath(original, ["/opt/tools"], "linux");
    expect(original.PATH).toBe(originalPath);
  });
});