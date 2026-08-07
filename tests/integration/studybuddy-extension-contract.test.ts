import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import { createStudyBuddyExtension } from "../../src/agent/studybuddy-extension";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";

/**
 * T-M1-001~004 studybuddy-extension × pi 底座契约对接（阶段3：S1+S2+S3+S4 工具装配验证）
 *
 * 断言（类型契约对接 + S1+S2+S3+S4 工具装配行为）：
 *   - createStudyBuddyExtension() 返回值符合 ExtensionFactory 类型契约
 *   - factory(stubPi) 调用后 registerTool 被调用 19 次（S1 6 + S2 6 + S3 3 + S4 4）
 *   - 多次调用 factory 安全（每次注册 19 个工具，无异常）
 *   - factory 返回 Promise<undefined>
 *
 * 数据隔离（AGENTS.md §5.3）：通过 PI_STUDYBUDDY_DATA_ROOT 注入隔离目录。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-001\\extension-contract";

/** 最小 stub pi：调用计数器 + 工具名收集，as ExtensionAPI 绕过完整接口 */
function createStubPi(): {
  calls: { registerTool: number; on: number; registerProvider: number };
  toolNames: string[];
  pi: ExtensionAPI;
} {
  const calls = { registerTool: 0, on: 0, registerProvider: 0 };
  const toolNames: string[] = [];
  const pi = {
    registerTool: (tool: { name: string }) => {
      calls.registerTool++;
      toolNames.push(tool.name);
    },
    on: () => {
      calls.on++;
    },
    registerProvider: () => {
      calls.registerProvider++;
    },
    registerCommand: () => {},
  } as unknown as ExtensionAPI;
  return { calls, toolNames, pi };
}

describe("T-M1-001~004 studybuddy-extension × pi 底座契约对接（S1+S2+S3+S4 工具装配）", () => {
  let originalDataRoot: string | undefined;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    originalDataRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
    process.env.PI_STUDYBUDDY_DATA_ROOT = ISOLATION_DIR;
  });

  afterAll(() => {
    if (originalDataRoot === undefined) {
      delete process.env.PI_STUDYBUDDY_DATA_ROOT;
    } else {
      process.env.PI_STUDYBUDDY_DATA_ROOT = originalDataRoot;
    }
    for (let i = 0; i < 3; i++) {
      try {
        rmSync(ISOLATION_DIR, { recursive: true, force: true });
        break;
      } catch {
        // 忽略 EBUSY
      }
    }
  });

  it("createStudyBuddyExtension() 返回值符合 ExtensionFactory 类型契约（编译时对接）", () => {
    const factory: ExtensionFactory = createStudyBuddyExtension();
    expect(typeof factory).toBe("function");
  });

  it("factory(stubPi) 调用后 registerTool 被调用 19 次（S1 6 + S2 6 + S3 3 + S4 4 工具装配）", async () => {
    const factory: ExtensionFactory = createStudyBuddyExtension();
    const { calls, pi } = createStubPi();
    await factory(pi);
    expect(calls.registerTool).toBe(19);
    expect(calls.on).toBe(0);
    expect(calls.registerProvider).toBe(0);
  });

  it("factory(stubPi) 注册的工具名全部以 studybuddy_ 开头", async () => {
    const factory: ExtensionFactory = createStudyBuddyExtension();
    const { toolNames, pi } = createStubPi();
    await factory(pi);
    expect(toolNames.length).toBe(19);
    for (const name of toolNames) {
      expect(name).toMatch(/^studybuddy_/);
    }
  });

  it("多次调用 factory 安全（每次注册 19 个工具，无异常）", async () => {
    const factory: ExtensionFactory = createStudyBuddyExtension();
    const { calls, pi } = createStubPi();
    await factory(pi);
    await factory(pi);
    await factory(pi);
    expect(calls.registerTool).toBe(57);
  });

  it("factory 返回 Promise<undefined>（符合 ExtensionFactory 返回 void | Promise<void>）", async () => {
    const factory: ExtensionFactory = createStudyBuddyExtension();
    const { pi } = createStubPi();
    const result = await factory(pi);
    expect(result).toBeUndefined();
  });
});
