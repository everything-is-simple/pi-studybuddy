/**
 * T-M0-004 toolchain manager 集成测试（03-Arch §6.5 + 06-API §3.16）
 *
 * 真实 PATH 探测 + 隔离目录安装 + 60s TTL 重扫。
 * 数据隔离：写入 H:\pi-studybuddy-tmp\runs\T-M0-004\ 绝不污染业务数据。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createToolchainManager } from "../../src/main/toolchains/manager";
import { setBaseDir } from "../../src/main/toolchains/paths";
import { TOOL_CAPABILITY_IDS } from "../../src/main/toolchains";

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M0-004";

describe("toolchain manager integration", () => {
  beforeAll(() => {
    // 隔离目录初始化
    fs.mkdirSync(ISOLATION_DIR, { recursive: true });
    setBaseDir(ISOLATION_DIR);
  });

  afterAll(() => {
    // 清理隔离目录
    try {
      fs.rmSync(ISOLATION_DIR, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("MANAGER-01: manager.list() 返回全部 14 种 capability", () => {
    const manager = createToolchainManager();
    const statuses = manager.list();
    expect(statuses.length).toBe(TOOL_CAPABILITY_IDS.length);
    // 至少 node 为 healthy
    const node = statuses.find((s) => s.capabilityId === "js.node");
    expect(node).toBeDefined();
    expect(node!.health).toBe("healthy");
    expect(node!.version).toBeDefined();
    manager.dispose();
  }, 30_000);

  it("MANAGER-02: manager.rescan() 刷新缓存", () => {
    const manager = createToolchainManager();
    const first = manager.list();
    const second = manager.rescan();
    expect(second.length).toBe(first.length);
    manager.dispose();
  }, 30_000);

  it("MANAGER-03: manager.install() 明确拒绝无受控来源的自动安装", async () => {
    const manager = createToolchainManager();
    await expect(manager.install("js.node")).rejects.toMatchObject({
      code: "INSTALLER_UNAVAILABLE",
      message: "当前版本不提供该工具的自动安装器",
    });
    manager.dispose();
  }, 30_000);

  it("MANAGER-04: manager.onChanged 在 rescan 后被调用", () => {
    const manager = createToolchainManager();
    let called = false;
    manager.onChanged(() => {
      called = true;
    });
    manager.rescan();
    expect(called).toBe(true);
    manager.dispose();
  }, 30_000);

  it("ISOLATION-01: 测试写入隔离目录，不产生真实数据文件", () => {
    // 验证隔离目录存在
    expect(fs.existsSync(ISOLATION_DIR)).toBe(true);
    // 验证没有写入真实 userData 路径
    const userData = process.env.LOCALAPPDATA ?? "";
    if (userData) {
      const possibleLeak = path.join(userData, "PiStudyBuddy", "toolchains");
      expect(fs.existsSync(possibleLeak)).toBe(false);
    }
  });
});