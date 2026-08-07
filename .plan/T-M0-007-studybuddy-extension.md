# 任务计划：T-M0-007 studybuddy-extension 空壳

**任务 ID**：T-M0-007
**日期**：2026-08-07
**状态**：✅ 已完成（2026-08-07 用户批准开工，质量门全绿，154 tests，待用户授权提交推送）
**关联文档**：03-Arch §2.1（单一扩展工厂，权威）+ 03-Arch §2.2（registerTool 契约）+ 03-Arch §3.1（工具前缀 `studybuddy_*`）+ pi 参考 `ExtensionFactory` / `ExtensionAPI` / `ToolDefinition` 类型
**里程碑**：M0 骨架搭建
**前置**：T-M0-001 ✅ done（agent-host 骨架）+ T-M0-002 ✅ done（contract 契约面）+ T-M0-005 ✅ done（file-watch，最后完成的前序任务，commit 47a2357）

---

## 1. 任务目标

### 做什么

为 pi-studybuddy 落地 **pi 扩展层空壳**：单一扩展工厂 `createStudyBuddyExtension()`，返回 pi `ExtensionFactory` 类型，`setup(pi)` 空实现（无 registerTool / 无 pi.on 钩子 / 无 registerProvider）。

### 为什么

- **M0 退出门槛前置**：04-Todo §6.2 退出门槛含"studybuddy-extension 空壳（createStudyBuddyExtension 可 setup 无工具）"
- **扩展层基座**：AGENTS.md §4.3 装配顺序——壳层就绪后建公用零件，扩展层空壳是后续 M1+ 业务工具注册（S1-S7 + TTS + 备份恢复）和 pi.on 钩子（03-Arch §2.3）的承载基座
- **03-Arch §2.1 权威条款**：`createStudyBuddyExtension()` 单一扩展工厂，对应 inno-agent `createInnoExtension()` 范式
- **pi 契约对接**：pi 底座 `ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>`（pi types.ts:1518），空壳需类型化对接此契约

### 依据

- 03-Arch §2.1：`src/agent/studybuddy-extension.ts`，`createStudyBuddyExtension()` 工厂
- 03-Arch §2.2：registerTool 契约（空壳不调用，M1+ 业务工具才调用）
- 03-Arch §3.1：工具名前缀 `studybuddy_*`（空壳无工具，前缀规范待 M1+）
- pi 参考（H:\pi-references\pi\packages\coding-agent\src\core\extensions\types.ts）：
  - line 1518：`export type ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>;`
  - line 1198：`export interface ExtensionAPI { on(...); registerTool(...); registerProvider(...); ... }`
  - line 449：`export interface ToolDefinition<TParams, TDetails, TState> { name; label; description; parameters; execute; ... }`
- pi 参考 index.ts:79/86/136：`ExtensionAPI` / `ExtensionFactory` / `ToolDefinition` 从 `@earendil-works/pi-coding-agent` 导出
- pi-desktop 权威范式（H:\pi-references\pi-desktop\package.json:47-48）：`@earendil-works/pi-coding-agent` + `@earendil-works/pi-ai` 作为 **dependencies**（固定版本 `0.80.10`，非 `^`，非 peerDeps）
- inno-agent 范式（H:\pi-references\inno-agent）：`createInnoExtension()` 返回 `ExtensionFactory`

### 类型命名偏差说明

03-Arch §2.1 伪代码写 `createStudyBuddyExtension(): PiExtension`，但 pi 底座无 `PiExtension` 类型——实际类型为 `ExtensionFactory`。这是设计文档命名与实现的偏差：03-Arch §2.1 核心意图是"单一扩展工厂"，类型名以 pi 底座契约为准（`ExtensionFactory`）。本任务实现采用 `ExtensionFactory` 类型，不偏离 03-Arch §2.1 权威意图。

---

## 2. 前置依赖：pi 底座安装

### 问题

`@earendil-works/pi-coding-agent` + `@earendil-works/pi-ai` 未安装（node_modules 无 @earendil-works，package.json 无此依赖）。04-Todo §4.1 看板原标记 "pi ✅ 已下载" 为自指断言（阶段1 未完成），已在 v0.1.10 修正为 ⏳ T-M0-007 安装中。

### 安装方案（用户批准选项 A）

- **依赖类型**：dependencies（跟随 pi-desktop 范式，非 peerDeps）
- **版本**：固定 `0.84.0`（与参考仓库 H:\pi-references\pi 本地版本一致，便于类型核对；非 `^` 避免漂移）
- **命令**：`pnpm add @earendil-works/pi-coding-agent@0.84.0 @earendil-works/pi-ai@0.84.0`
- **npm 可用性**：已确认 `pnpm view` 返回 coding-agent 0.84.1 / ai 0.84.0（0.84.0 应可用；若不可用 fallback 0.84.1）

### 安装后校验

- `node_modules/@earendil-works/pi-coding-agent/dist/index.d.ts` 存在（类型导出可解析）
- 04-Todo §4.1 看板 pi 行：⏳ → ✅（阶段1 下载完成）

---

## 3. 范围与非目标

### 范围

1. **`src/agent/studybuddy-extension.ts`**：核心工厂
   - `export const STUDYBUDDY_EXTENSION_NAME = "pi-studybuddy"`（扩展标识，03-Arch §2.1 name 字段）
   - `export function createStudyBuddyExtension(): ExtensionFactory`（返回 `async (pi: ExtensionAPI) => { /* 空实现 */ }`）
   - setup 内**空实现**：无 registerTool / 无 pi.on / 无 registerProvider / 无 Simple Mode（全部 M1+ 任务）
   - 仅保留扩展标识 + 空 setup 脚手架

2. **`tsconfig.node.json`**：include 加入 `"src/agent"`（当前 include 不含 agent 目录）
   - 原因：studybuddy-extension.ts 需 tsc 编译到 dist/agent/，供 pi 运行时加载

3. **测试**（TDD，数据隔离 `H:\pi-studybuddy-tmp\runs\T-M0-007\`）：
   - **单件测试** `tests/unit/studybuddy-extension.test.ts`：
     - `createStudyBuddyExtension()` 返回可调用 factory（typeof === "function"）
     - factory 返回 Promise（async）
     - 调用 `factory(stubPi)` 不抛错（setup 空实现）
     - 断言 `stubPi.registerTool` **未被调用**（验证空壳，零工具注册）
     - 断言 `stubPi.on` **未被调用**（验证空壳，零钩子订阅）
   - **集成测试** `tests/integration/studybuddy-extension-contract.test.ts`：
     - 类型契约对接：`const factory: ExtensionFactory = createStudyBuddyExtension()` 赋值不报错（类型化对接 pi 契约）
     - 调用 factory(stubPi) 完成后 stubPi 状态不变（无副作用）
   - stubPi：最小 mock，实现 `registerTool` / `on` / `registerProvider` 等 API 的空方法 + 调用计数器

### 非目标

- ❌ 不注册任何业务工具（createS1RhythmTools 等 S1-S7 + TTS + 备份恢复）→ M1+ 业务任务
- ❌ 不实现 pi.on 生命周期钩子（before_agent_start / tool_call / tool_result / model_select / turn_end）→ 03-Arch §2.3 后续任务（M1+ §7.2 / M3 §7.4）
- ❌ 不实现 pi-ai provider 注入（registerProvider）→ 03-Arch §2.4 后续任务
- ❌ 不实现 Simple Mode 总开关 → 03-Arch §2.5 后续任务
- ❌ 不实现 skills.* 业务方法 → M1+ 业务任务
- ❌ 不接入 agent-host 运行时加载（agent-host 当前是 RPC 服务，不加载 pi 扩展）→ 03-Arch §6.7 会话管理后续任务
- ❌ 不复制 pi / inno-agent 代码：参考范式但独立重实现（AGENTS.md §6.2 + §6.3）
- ❌ 不实现 RPC handler（06-API 无 extension.* 方法，扩展层不涉及 RPC）

---

## 4. TDD 步骤（RED → GREEN → REFACTOR）

### RED：先写失败测试

1. 写 `tests/unit/studybuddy-extension.test.ts`：
   - import `createStudyBuddyExtension` from `../src/agent/studybuddy-extension`（模块不存在 → RED）
   - 断言 factory 可调用 + setup 空实现 + 零 registerTool/on 调用
2. 写 `tests/integration/studybuddy-extension-contract.test.ts`：
   - import `ExtensionFactory` from `@earendil-works/pi-coding-agent`（类型契约对接）
   - 断言 `createStudyBuddyExtension()` 赋值给 `ExtensionFactory` 类型 + 调用无副作用

### GREEN：最小实现

3. 创建 `src/agent/studybuddy-extension.ts`：
   ```ts
   import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";

   export const STUDYBUDDY_EXTENSION_NAME = "pi-studybuddy";

   export function createStudyBuddyExtension(): ExtensionFactory {
     return async (pi: ExtensionAPI): Promise<void> => {
       // 空壳：不注册工具、不订阅钩子、不注入 provider
       // 业务能力（S1-S7 + TTS + 备份恢复 + pi.on 钩子）由 M1+ 任务逐步接入
     };
   }
   ```
4. 更新 `tsconfig.node.json`：include 加 `"src/agent"`

### REFACTOR

5. 测试全绿后整理结构（保持精简，不过度工程化）

---

## 5. 质量门

| 质量门 | 命令 | 预期 |
|---|---|---|
| 类型检查 | `pnpm type-check` | 通过（tsconfig.json + tsconfig.node.json 双配置） |
| 单件+集成测试 | `pnpm test` | 全绿（新增 studybuddy-extension 测试 + 既有 143 tests 不回归） |
| 构建 | `pnpm build` | 通过（tsc + vite，src/agent 编译到 dist/agent/） |
| 冒烟 | `pnpm smoke` | 通过（构建产物 + RPC 冒烟） |
| 统一质量门 | `pnpm verify` | 全绿（type-check + unit-test + contract-coverage + desktop-security + build + smoke） |
| 工作区 | `git diff --check` | 无空白错误 |
| 文档治理 | `node scripts/check-docs-governance.mjs` | 通过 |

---

## 6. 收尾（AGENTS.md §7 受控收尾流程）

1. 复验测试 + 最小端到端路径（factory 可调用 + 空壳无副作用）
2. 更新 04-Todo：
   - §7.1.1 T-M0-007 状态 in_progress → done + 证据链接
   - §4.1 看板 pi 行 ⏳ → ✅（阶段1/3 完成：已安装 + 集成契约验证）
   - §9 统计 M0：5 pending + 1 in_progress + 6 done → 4 pending + 0 in_progress + 7 done
   - 版本历史 v0.1.11 登记 T-M0-007 完成
3. 创建 `.record/T-M0-007-实施记录.md`（8 章节）
4. 更新 00-索引 + .plan/00-当前任务.md
5. 运行文档治理检查
6. 停止并报告，等待用户授权提交推送

---

## 7. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（已完成：03-Arch §2.1/§2.2/§3.1 + pi types.ts ExtensionFactory/ExtensionAPI/ToolDefinition + pi-desktop package.json 范式）
- [x] 步骤 2：检查文档门禁（已完成：T-M0-005 done + .plan 无执行中任务 + 用户已批准选项 A）
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [x] 步骤 4：独立审查计划（自审：pi 底座契约对齐 + inno-agent 范式参考 + 空壳边界清晰 + TDD 覆盖完整）
- [x] 步骤 5：用户批准计划（★ 用户授权，2026-08-07 批准开工，选项 A：先装 pi 底座再做空壳）
- [x] 步骤 6：拆分任务、逐项实现（pi 底座安装 + studybuddy-extension.ts + tsconfig.node.json + 单件/集成测试）
- [x] 步骤 7：TDD 测试（RED 11 测试 → GREEN 全绿 → REFACTOR 注释精简）
- [x] 步骤 8：type-check（`pnpm type-check` 通过）
- [x] 步骤 9：build（`pnpm build` 通过，34 modules transformed）
- [x] 步骤 10：test（`pnpm test` 154/154 通过，含 7 单件 + 4 集成 studybuddy-extension 新增）
- [x] 步骤 11：smoke / 安全脚本（`pnpm smoke` 通过 + check-desktop-security 5/6 通过 INV-06 占位 T-M0-008）
- [x] 步骤 12：独立审查并修复（pi 0.84.x npm 包缺 dist 目录 → 降级 0.80.10；pnpm-workspace.yaml allowBuilds 补 @google/genai + protobufjs）
- [x] 步骤 13：更新 04-Todo + 文档（v0.1.11 登记 T-M0-007 done + §4.1 看板 pi ✅ + §9 统计）
- [x] 步骤 14：文档治理检查（`node scripts/check-docs-governance.mjs` 通过，1 warning 非阻塞）
- [x] 步骤 15：diff 检查（`git diff --check` 通过，仅 LF/CRLF 警告）
- [ ] 步骤 16：提交交付（★ 用户授权后执行）

## 8. 证据登记

- 测试日志：`pnpm verify` 全绿（执行 7 守卫，跳过 2）
  - typecheck ✅
  - docs-governance ✅（1 warning 非阻塞，01-TRD 状态字段格式，既有遗留）
  - unit-tests ✅（154 tests passed，含 7 单件 + 4 集成 studybuddy-extension 新增）
  - contract-coverage ✅（126 Api handlers + 8 PiBridge methods + 0 registerTool 工具）
  - desktop-security ✅（5/6 INV 通过，INV-06 占位 T-M0-008）
  - build ✅（34 modules transformed）
  - smoke ✅（RPC ping + 8 build artifacts）
- 实施记录：`.record/T-M0-007-实施记录.md`（收尾时创建）
- 偏差记录：pi 底座版本从计划 0.84.0 降级为 0.80.10（0.84.0 npm 包缺 dist 目录），详见实施记录 §3 偏差
