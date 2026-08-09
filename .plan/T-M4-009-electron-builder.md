# 任务计划：T-M4-009 electron-builder 配置 + x64 setup 首次验证

**任务 ID**：T-M4-009
**计划文件**：`.plan/T-M4-009-electron-builder.md`
**状态**：✅ 已完成，Git 收口执行中（2026-08-09）
**日期**：2026-08-09
**里程碑**：M4 业务接线 + 打包部署
**标题**：electron-builder 配置 + x64 setup 首次验证
**优先级**：P0.5
**工作目录**：`H:\pi-studybuddy`

## 1. 任务裁决与权威依据

- 用户明确选择并批准执行 T-M4-009。
- `H:\pi-studybuddy\AGENTS.md` §0、§4.4、§4.5、§5、§7、§8、§9、§11。
- `H:\pi-studybuddy\docs\01-TRD-技术需求-Technical-Requirements.md` §7 决策 6 v0.2.3：源码形态可运行，同时打包能力常态化，可产出 Windows x64 setup。
- `H:\pi-studybuddy\docs\04-任务清单-Todo-List.md` §7.5 执行序 28、§7.6.1 T-M4-009。
- `H:\pi-studybuddy\docs\03-架构设计-Architecture-Design.md` 壳层、真实 Electron 启动、数据根与安全边界。
- `H:\pi-studybuddy\docs\08-测试验收-Test-Plan.md` 测试金字塔、真实 Electron E2E、安全不变量六条。
- `H:\pi-studybuddy\docs\10-开发规范-Dev-Rules.md` 16 步开发流程。
- `H:\pi-studybuddy\docs\11-组件装配-Component-Assembly.md` 五阶段组件治理。
- `H:\pi-studybuddy\docs\12-目录治理-Directory-Governance.md` 源码、构建产物、业务数据根和临时运行数据隔离。

## 2. 当前基线事实

- M0 9/9、M1 10/10、M2 9/9、M3 8/8 已完成。
- M4 已完成 T-M4-001~005、T-M4-022、T-M4-006~008；T-M4-009~021 尚 pending。
- 开工前 `master` 与 `origin/master` 一致，工作区干净；以现场命令复核为准。
- 当前应用入口为 `dist/main/main.js`，构建为 `tsc -p tsconfig.node.json && vite build`。
- `package.json` 当前没有 electron-builder 依赖、builder 配置或打包脚本。
- 当前 Electron 为 36.9.5；质量门基线为 Node 24.14.0；Electron 生产运行时已由 T-M4-022 真实验证。
- T-M0-001 历史上曾删除旧版 electron-builder 占位；该旧决定已被 TRD v0.2.3 决策 6 supersedes，本任务重新建立正式打包能力。

## 3. 任务目标

1. 引入与当前 Electron、Node、pnpm 工具链兼容且精确锁定的 electron-builder。
2. 建立可审计、可重复的 Windows x64 NSIS setup 配置。
3. 增加明确的 Windows 打包命令，同时保留 `pnpm dev`、`pnpm build` 和既有质量门。
4. 确认 `dist/main`、`dist/preload`、`dist/renderer`、`dist/agent-host`、`dist/agent`、`dist/contract`、`dist/data` 和运行所需 dependencies 可被安装包加载。
5. 在 `H:\pi-studybuddy-tmp\runs\T-M4-009\` 下生成 setup、安装并从安装目录真实启动，完成最小 `system.ping` 往返验证。
6. 验证打包不引入真实密钥、学生资料、业务数据库，不侵入 `~/.pi`，不改变本地回环网络边界。

## 4. 范围与非目标

### 4.1 范围

- package.json 的精确依赖和脚本调整。
- electron-builder 配置文件或 package.json `build` 配置（二选一，以可审计性和当前仓库范式为准）。
- builder 配置测试、打包产物检查、安装后启动检查。
- 必要的脚本、测试夹具、文档与任务证据。

### 4.2 非目标

- 不实现 T-M4-010~T-M4-019 业务 Tab 接线。
- 不启动 T-M4-020 全链 E2E 或 T-M4-021 M4 收官验收。
- 不引入自动更新、代码签名、发布渠道、CI/CD、多平台打包。
- 不新增 API、RPC、handler、schema；若打包暴露真实生产阻塞，必须停止并报告，不得扩大范围。
- 用户已明确授权 Git 收口；仅执行本任务的提交、快进合并与推送。

## 5. 预期文件范围

预期可能修改或新增（以实际审计为准）：

- `H:\pi-studybuddy\package.json`
- `H:\pi-studybuddy\pnpm-lock.yaml`
- `H:\pi-studybuddy\electron-builder.yml` 或等价 builder 配置
- `H:\pi-studybuddy\scripts\package-smoke.mjs` 或等价测试/验证脚本
- `H:\pi-studybuddy\tests\unit\electron-builder-config.test.ts` 或等价测试
- `H:\pi-studybuddy\tests\e2e\...`（仅在现有真实 Electron harness 可复用且范围必要时）
- `H:\pi-studybuddy\docs\04-任务清单-Todo-List.md`
- `H:\pi-studybuddy\.plan\00-当前任务.md`
- `H:\pi-studybuddy\.record\T-M4-009-实施记录.md`

不预先承诺其他文件；如需修改治理基线文件，必须记录原因、影响和权威依据。

## 6. TDD 与验证策略

### RED

先建立失败断言，至少覆盖：

- builder 配置存在且可解析；
- main 入口、产品标识、Windows NSIS、x64 target 正确；
- package script 存在并调用锁定工具链；
- 预期运行时目录纳入打包范围；
- 敏感数据根和运行时临时目录不进入包。

### GREEN

用最小配置和脚本使上述断言通过，然后真实执行 Windows x64 setup 构建。

### REFACTOR

在测试保持通过后，整理配置重复项、命令命名、日志和隔离路径；不提前抽象多平台发布能力。

## 7. 真实打包验收路径

运行数据和安装验证必须隔离到：

`H:\pi-studybuddy-tmp\runs\T-M4-009\`

必须完成：

1. `pnpm build`；
2. Windows x64 NSIS setup 构建；
3. 记录 setup 绝对路径、大小和 SHA-256；
4. 安装到任务临时安装目录；
5. 从安装目录启动真实应用；
6. 验证 BrowserWindow、preload bridge、renderer 和最小 `system.ping`；
7. 验证 global.db 在隔离数据根创建；
8. 二次启动验证幂等；
9. 正常退出；
10. 检查无 `~/.pi`、真实业务数据根、密钥和公网监听污染。

不得用普通 Node 子进程冒充生产 Electron 启动验证。

## 8. 标准质量门

至少执行并记录：

```powershell
pnpm type-check
pnpm build
pnpm test
pnpm test:e2e
pnpm smoke
pnpm verify --stage=full
node H:\pi-studybuddy\scripts\check-docs-governance.mjs
node H:\pi-studybuddy\scripts\check-contract-coverage.mjs
node H:\pi-studybuddy\scripts\check-desktop-security.mjs
git diff --check
```

任何失败必须修复并重跑，不得用旧日志替代本次证据。

## 9. 完成判据

代码完成不等于任务 done。任务只有在以下事实齐全后才能登记 done：

1. `docs/04-Todo` 有 T-M4-009 完成事实和证据；
2. 实施记录八章节完成；
3. 当前 master 复验通过；
4. 用户已明确授权 Git 收口；功能提交已创建并快进合并至 `master`；
5. `origin/master` 推送成功。

治理提交推送成功后，任务状态改为 done；不启动 T-M4-010。

## 10. 风险与停止条件

遇到以下情况必须停止并报告：

- Electron/electron-builder/pnpm 版本兼容性无法证明；
- x64 setup 构建依赖未记录的全局工具；
- 安装后应用无法从真实 Electron 启动；
- 打包后 `node:sqlite`、动态 import、utilityProcess、preload sandbox 或 app:// renderer 失效；
- 需要新增 API/handler/schema 才能完成；
- 需要修改 AGENTS.md、TRD、架构或测试基线但缺少明确依据；
- 出现真实数据、密钥、UUID、安装包或 dist 文件进入 Git 的风险。

## 11. 证据输出

实施记录必须记录：

- 精确工具版本；
- 打包命令和退出码；
- setup 产物绝对路径、大小、SHA-256；
- 安装目录和启动路径；
- system.ping、global.db、二次启动和退出证据；
- 全部质量门命令、退出码、测试数量；
- 安全和隐私检查结果；
- 独立审查意见及修复；
- Git 状态和未授权收口事实。

> 收口完成后不启动 T-M4-010 或任何后续任务。
