import { defineConfig } from "vitest/config";

/**
 * pi-studybuddy vitest 配置（单件 + 集成测试）
 *
 * 测试运行数据隔离（AGENTS.md §5.3）：测试写入 H:\pi-studybuddy-tmp\runs\<task-id>\，
 * 绝不污染真实业务数据根 %LOCALAPPDATA%\PiStudyBuddy。
 */
export default defineConfig({
  test: {
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/security/**/*.test.ts",
    ],
    environment: "node",
    globals: false,
    deps: {
      optimizer: {
        ssr: {
          // node:sqlite 是 Node experimental 内置模块，esbuild 不认识会剥离 node: 前缀，
          // 排除优化，让 vite-node 以原生 require 加载
          exclude: ["node:sqlite"],
        },
      },
    },
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.test.json",
      include: ["tests/unit/contract.test.ts", "tests/unit/data-schema.test.ts"],
    },
  },
});