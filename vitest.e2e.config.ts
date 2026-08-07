/**
 * T-M1-010 E2E 专用 vitest 配置（08-Test §6）
 *
 * 与 vitest.config.ts 的区别：
 *   - 包含 tests/e2e 下所有 .test.ts（单元/集成配置排除 e2e）
 *   - 超时 60s（Electron 启动 + 全链回归）
 *   - 串行执行（单 Electron 实例，fullyParallel: false）
 *   - environment: node（_electron.launch 从 Node 端调用）
 *
 * 运行数据隔离（AGENTS.md §5.3）：测试写入 H:\pi-studybuddy-tmp\runs\T-M1-010\
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    environment: "node",
    globals: false,
    fullyParallel: false,
    timeout: 60_000,
    hookTimeout: 60_000,
    testTimeout: 60_000,
    deps: {
      optimizer: {
        ssr: {
          exclude: ["node:sqlite", "electron"],
        },
      },
    },
  },
});
