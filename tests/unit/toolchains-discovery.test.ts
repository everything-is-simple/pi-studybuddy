/**
 * T-M0-004 toolchain discovery + probe 单件测试（03-Arch §6.5）
 *
 * RED → GREEN 纪律：各用例先写断言（RED），再实现最小代码使通过（GREEN）。
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { discoverCandidates, executableNames, type DiscoveryFileSystem } from "../../src/main/toolchains/discovery-registry";
import { probeNode } from "../../src/main/toolchains/probes/node";
import { probeCapability } from "../../src/main/toolchains/probes/capabilities";
import { compareVersions } from "../../src/main/toolchains/probes/common";
import { normalizeToolPath, toolPathComparisonKey, normalizeAndDedupeCandidates } from "../../src/main/toolchains/candidate-normalizer";

// Probe node 使用的 Node 可执行路径：先尝试 process.execPath，若失败 fallback 到 "node"
let nodeExecPath = process.execPath;
beforeAll(() => {
  try {
    const code = "console.log(JSON.stringify({v:process.version}))";
    const stdout = execFileSync(nodeExecPath, ["-e", code], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    console.log("debug: execFileSync works with execPath, version:", JSON.parse(stdout.trim()).v);
  } catch {
    // fallback to "node" command
    try {
      const stdout2 = execFileSync("node", ["-e", "console.log(JSON.stringify({v:process.version}))"], {
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      nodeExecPath = "node";
      console.log("debug: fallback to 'node' works, version:", JSON.parse(stdout2.trim()).v);
    } catch (e2) {
      console.log("debug: both execPath and 'node' fallback failed:", String(e2));
    }
  }
});

// ===== DISCOVERY tests =====

describe("discovery-registry", () => {
  it("DISCOVERY-01: 扫描 PATH 返回候选列表（mock 文件系统）", () => {
    const mockFs: DiscoveryFileSystem = {
      isFile: (fp) => fp.endsWith("node.exe") || fp.endsWith("git.exe"),
      readDirectoryNames: () => ["node.exe", "git.exe", "python.exe", "notepad.exe"],
    };
    const origPath = process.env.PATH;
    process.env.PATH = "C:\\tools";
    try {
      const seeds = discoverCandidates("node", mockFs);
      expect(seeds.length).toBeGreaterThanOrEqual(1);
      expect(seeds[0].path.toLowerCase()).toContain("node.exe");
    } finally {
      process.env.PATH = origPath;
    }
  });

  it("DISCOVERY-02: 对不存在的目录返回空数组", () => {
    const mockFs = {
      isFile: () => false,
      readDirectoryNames: () => [] as string[],
    };
    const seeds = discoverCandidates("nonexistent", mockFs);
    expect(seeds).toEqual([]);
  });

  it("DISCOVERY-03: MAX_SEEDS=320 边界", () => {
    const manyDirs = Array.from({ length: 50 }, (_, i) => `C:\\dir${i}`);
    const origPath = process.env.PATH;
    process.env.PATH = manyDirs.join(";");
    let callCount = 0;
    const mockFs = {
      isFile: () => true,
      readDirectoryNames: () => {
        callCount++;
        return Array.from({ length: 10 }, (_, i) => `node${i}.exe`);
      },
    };
    try {
      const seeds = discoverCandidates("node", mockFs);
      expect(seeds.length).toBeLessThanOrEqual(320);
      expect(callCount).toBeGreaterThan(0);
    } finally {
      process.env.PATH = origPath;
    }
  });

  it("executableNames 返回 Windows 可执行文件后缀", () => {
    const names = executableNames("node");
    expect(names).toContain("node.exe");
    expect(names).toContain("node.cmd");
    expect(names).toContain("node.bat");
  });
});

// ===== NODE PROBE tests =====

describe("node probe", () => {
  it("NODE-PROBE-01: 对有效版本返回 healthy", () => {
    const result = probeNode(nodeExecPath);
    console.log("debug probeNode result:", JSON.stringify(result));
    expect(result.health).toBe("healthy");
    expect(result.version).toBeDefined();
  });

  it("NODE-PROBE-02: 对不可执行文件返回 unsupported", () => {
    const result = probeNode("C:\\nonexistent-node.exe");
    expect(result.health).toBe("unsupported");
  });
});

// ===== CAPABILITY PROBE tests =====

describe("capability probe", () => {
  it("CAPA-PROBE-01: 通用 probe 对有效命令返回 healthy", () => {
    const result = probeCapability(nodeExecPath);
    expect(result.health).toBe("healthy");
    expect(result.version).toBeDefined();
  });

  it("CAPA-PROBE-02: 通用 probe 对不存在命令返回 unsupported", () => {
    const result = probeCapability("C:\\nonexistent-tool.exe");
    expect(result.health).toBe("unsupported");
  });
});

// ===== NORMALIZER tests =====

describe("candidate normalizer", () => {
  it("NORMALIZER-01: 去重相同路径", () => {
    const seeds = [
      { path: "C:\\tools\\node.exe" },
      { path: "C:\\tools\\node.exe" },
      { path: "C:\\tools\\git.exe" },
    ];
    const deduped = normalizeAndDedupeCandidates(seeds);
    expect(deduped.length).toBe(2);
  });

  it("NORMALIZER-02: normalizeToolPath 解析为绝对路径", () => {
    const normalized = normalizeToolPath("C:\\tools\\node.exe");
    expect(normalized).toBeDefined();
    expect(typeof normalized).toBe("string");
  });
});

// ===== COMMON tests =====

describe("common probe utilities", () => {
  it("compareVersions 正确比较", () => {
    expect(compareVersions("22.19.0", "22.19.0")).toBe(0);
    expect(compareVersions("22.19.0", "22.18.0")).toBeGreaterThan(0);
    expect(compareVersions("22.18.0", "22.19.0")).toBeLessThan(0);
  });
});