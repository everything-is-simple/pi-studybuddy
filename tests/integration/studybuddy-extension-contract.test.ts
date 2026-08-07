import { describe, it, expect } from "vitest";
import { createStudyBuddyExtension } from "../../src/agent/studybuddy-extension";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";

/**
 * T-M0-007 studybuddy-extension 集成测试（阶段3：与 pi 底座契约对接验证）
 *
 * 断言（类型契约对接 + 行为安全）：
 *   - createStudyBuddyExtension() 返回值赋给 ExtensionFactory 类型变量（编译时类型契约对接）
 *   - factory 符合 ExtensionFactory 签名：(pi: ExtensionAPI) => void | Promise<void>
 *   - 调用 factory(stubPi) 完成后 stubPi 状态不变（无副作用，空壳不修改 pi）
 *   - 多次调用 factory 安全（幂等空壳，无累积副作用）
 *
 * 注：真正的 pi 运行时加载（pi discoverAndLoadExtensions 加载 studybuddy-extension.ts）
 * 属于 03-Arch §6.7 会话管理后续任务，本测试只验证类型契约 + 调用安全。
 *
 * 数据隔离（AGENTS.md §5.3）：纯函数测试无 IO，不涉及运行数据目录。
 */

/** 最小 stub pi：调用计数器，as ExtensionAPI 绕过完整接口 */
function createStubPi(): { calls: { total: number }; pi: ExtensionAPI } {
  const calls = { total: 0 };
  const pi = {
    registerTool: () => {
      calls.total++;
    },
    on: () => {
      calls.total++;
    },
    registerProvider: () => {
      calls.total++;
    },
    registerCommand: () => {
      calls.total++;
    },
  } as unknown as ExtensionAPI;
  return { calls, pi };
}

describe("studybuddy-extension × pi 底座契约对接（阶段3）", () => {
  it("createStudyBuddyExtension() 返回值符合 ExtensionFactory 类型契约（编译时对接）", () => {
    // 类型契约对接：赋值给 ExtensionFactory 类型变量，编译时验证签名兼容
    const factory: ExtensionFactory = createStudyBuddyExtension();
    expect(typeof factory).toBe("function");
  });

  it("factory(stubPi) 调用后 stubPi 状态不变（无副作用）", async () => {
    const factory: ExtensionFactory = createStudyBuddyExtension();
    const { calls, pi } = createStubPi();
    await factory(pi);
    expect(calls.total).toBe(0);
  });

  it("多次调用 factory 安全（幂等空壳，无累积副作用）", async () => {
    const factory: ExtensionFactory = createStudyBuddyExtension();
    const { calls, pi } = createStubPi();
    await factory(pi);
    await factory(pi);
    await factory(pi);
    expect(calls.total).toBe(0);
  });

  it("factory 返回 Promise<undefined>（符合 ExtensionFactory 返回 void | Promise<void>）", async () => {
    const factory: ExtensionFactory = createStudyBuddyExtension();
    const { pi } = createStubPi();
    const result = await factory(pi);
    expect(result).toBeUndefined();
  });
});
