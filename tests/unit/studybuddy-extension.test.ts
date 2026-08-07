import { describe, it, expect } from "vitest";
import { createStudyBuddyExtension, STUDYBUDDY_EXTENSION_NAME } from "../../src/agent/studybuddy-extension";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * T-M0-007 studybuddy-extension 单件测试（03-Arch §2.1 + pi ExtensionFactory 契约）
 *
 * 断言（空壳契约）：
 *   - createStudyBuddyExtension() 返回可调用 factory（typeof === "function"）
 *   - factory 返回 Promise（async 签名，符合 ExtensionFactory = (pi) => void | Promise<void>）
 *   - 调用 factory(stubPi) 不抛错（setup 空实现）
 *   - stubPi.registerTool 未被调用（零工具注册，空壳核心断言）
 *   - stubPi.on 未被调用（零钩子订阅，空壳核心断言）
 *   - stubPi.registerProvider 未被调用（零 provider 注入）
 *   - STUDYBUDDY_EXTENSION_NAME === "pi-studybuddy"（扩展标识，03-Arch §2.1 name 字段）
 *
 * 数据隔离（AGENTS.md §5.3）：纯函数测试无 IO，不涉及运行数据目录。
 */

/** 最小 stub pi：仅实现空壳可能调用的 API + 调用计数器，as ExtensionAPI 绕过完整接口 */
function createStubPi(): { calls: { registerTool: number; on: number; registerProvider: number }; pi: ExtensionAPI } {
  const calls = { registerTool: 0, on: 0, registerProvider: 0 };
  const pi = {
    registerTool: () => {
      calls.registerTool++;
    },
    on: () => {
      calls.on++;
    },
    registerProvider: () => {
      calls.registerProvider++;
    },
  } as unknown as ExtensionAPI;
  return { calls, pi };
}

describe("createStudyBuddyExtension", () => {
  it("返回可调用 factory（typeof === 'function'）", () => {
    const factory = createStudyBuddyExtension();
    expect(typeof factory).toBe("function");
  });

  it("factory 调用后返回 Promise（async 签名，符合 ExtensionFactory 契约）", () => {
    const factory = createStudyBuddyExtension();
    const { pi } = createStubPi();
    const result = factory(pi);
    expect(result).toBeInstanceOf(Promise);
    // 消费 Promise 避免未处理的 rejection 警告
    return result;
  });

  it("调用 factory(stubPi) 不抛错（setup 空实现）", async () => {
    const factory = createStudyBuddyExtension();
    const { pi } = createStubPi();
    await expect(factory(pi)).resolves.toBeUndefined();
  });

  it("不调用 registerTool（零工具注册，空壳核心断言）", async () => {
    const factory = createStudyBuddyExtension();
    const { calls, pi } = createStubPi();
    await factory(pi);
    expect(calls.registerTool).toBe(0);
  });

  it("不调用 pi.on（零钩子订阅，空壳核心断言）", async () => {
    const factory = createStudyBuddyExtension();
    const { calls, pi } = createStubPi();
    await factory(pi);
    expect(calls.on).toBe(0);
  });

  it("不调用 registerProvider（零 provider 注入）", async () => {
    const factory = createStudyBuddyExtension();
    const { calls, pi } = createStubPi();
    await factory(pi);
    expect(calls.registerProvider).toBe(0);
  });

  it("STUDYBUDDY_EXTENSION_NAME === 'pi-studybuddy'（扩展标识）", () => {
    expect(STUDYBUDDY_EXTENSION_NAME).toBe("pi-studybuddy");
  });
});
