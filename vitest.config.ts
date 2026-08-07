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
  },
});