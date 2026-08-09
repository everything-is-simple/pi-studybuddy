# 任务计划：T-M4-010 S1 首页 Tab RPC 接线（本地实施完成，Git 待授权）

**任务 ID**：T-M4-010
**计划文件**：`.plan/T-M4-010-s1-home-rpc.md`
**状态**：🟡 in_progress（用户明确授权实施；Git 收口未授权）
**日期**：2026-08-09
**里程碑**：M4 业务接线 + 打包部署
**标题**：S1 首页 Tab RPC 接线（dailyBrief + tasks + exams）
**优先级**：P1
**工作目录**：`H:\pi-studybuddy`
**隔离分支**：`agent/T-M4-010-s1-home-rpc`

## 1. 任务裁决与权威依据

- 用户明确指定下一任务为 T-M4-010，并于 2026-08-09 明确授权计划批准与实施。
- `AGENTS.md` §0、§4.4、§4.5、§5、§7、§8、§9、§11；`docs/10-开发规范-Dev-Rules.md` 的 16 步开发流程。
- `docs/04-任务清单-Todo-List.md` §7.6.1 T-M4-010、§7.5 执行序 29；前置 T-M4-008、T-M4-009 均已 done 并推送。
- `docs/09-使用者介面-UI-Design.md` §3、§4.3；`docs/06-API契约-API-Contracts.md` §3.3；`docs/03-架构设计-Architecture-Design.md` §6.7；`docs/08-测试验收-Test-Plan.md`。

## 2. 当前基线事实

- M0 9/9、M1 10/10、M2 9/9、M3 8/8 均完成；M4 已完成 T-M4-001~009、T-M4-022（10 done），当前为 9 pending / 1 in_progress / 10 done。
- 开工前 `master` 与 `origin/master` 同为 `474976dee886e2ca375d791cbd25dc407be9ff14`，工作区干净；实施在隔离分支进行。
- `AppShell` 是 `semesterId/courseId` 的唯一所有者，`HomeTab` 已接收 `rpc`、`semesterId`、`academicContext`；复用 `useTabData` 的 idle/loading/error/empty/ready、旧响应与卸载保护。
- 现有首页只接通 `tasks.dailyBrief`，任务未使用 `tasks.list`，考试仍是静态 prop；不得保留冻结生产日期计算。
- `tasks.list` / `exams.list` 在未传 `courseId` 时可能遍历多个学期库；本任务禁止无范围调用。
- 完整质量门使用 `F:\1.devel-tools\nodejs\node-v24.14.0-win-x64\node.exe`（Node 24.14.0）；默认 Node 25.4.0 不是本任务最终验证基线。

## 3. 目标

1. 在唯一上下文内加载 `tasks.dailyBrief({ semesterId })`、`tasks.list({ courseId })` 和 `exams.list({ courseId })`。
2. 每日简报、任务、考试分别展示 loading/error/empty/ready；一个调用失败不得遮蔽其他成功数据。
3. 切换学期、切换课程、卸载或 rpc 替换后，旧响应和旧异常不得污染当前界面。
4. 考试来自真实 RPC，倒计时基于当前时钟或可注入时钟，错误和展示字段均安全化。

## 4. 范围与非目标

### 范围

- 最小修改 `HomeTab` 和同范围单元/renderer 集成测试。
- 只使用既有 RPC 合同，不新增 API、handler、schema 或数据库迁移。
- 测试运行数据仅允许在 `H:\pi-studybuddy-tmp\runs\T-M4-010\`。

### 非目标

- 不实现 T-M4-011~021、TTS、AI 重试、错题建议、资料/练习/报告/采集/备份或全链 E2E。
- 不调用无 `courseId` 的 `tasks.list` / `exams.list`，不跨学期读取。
- 不连接真实外部服务、真实学生资料或业务数据根。
- 不 commit、merge、push；本次授权不包含 Git 收口。

## 5. 标准化开发过程（16 步 + TDD）

1. 已读治理入口、相关设计文档、计划与 Todo，并复核依赖/基线。
2. 已建立唯一计划、任务状态与隔离分支。
3. RED：先写失败测试，覆盖三组 RPC 参数、无课程不请求、独立状态、错误安全化、竞态/卸载和非冻结日期。
4. GREEN：以最小实现复用 `useTabData` 接线，不建立平行数据框架。
5. REFACTOR：测试全绿后消除重复，保持 AppShell 唯一上下文。
6. 运行定向测试、type-check、build、unit/integration、smoke、真实 Electron E2E 与完整质量门。
7. 复核合同、数据隔离、安全展示、文档与差异；记录发现和修复。
8. 创建八章节实施记录，更新 Todo/当前计划；停在 Git 前，等待用户单独授权。

## 6. 标准化验收标准

### 功能与隔离

- 已选学期只请求 `tasks.dailyBrief({ semesterId })`；切换后旧响应不可覆盖。
- 已选课程才请求 `tasks.list({ courseId })` 与 `exams.list({ courseId })`；参数始终绑定当前课程。
- 无课程时任务/考试为受控空/提示态，且绝不发起无参数/跨学期列表调用。
- 三个数据域各自可进入 loading/error/empty/ready，失败隔离。
- 考试展示为 `exams.list` 数据；倒计时不使用冻结日期。

### 安全与质量

- 不回显原始异常、UUID、密钥、资料正文或跨学期数据。
- 没有 API/handler/schema 变化，契约覆盖保持 127/127。
- 夹具不含真实 UUID、密钥、学生数据；运行数据隔离。
- Node 24.14.0 下受影响测试、完整质量门、文档治理与 `git diff --check` 均通过。

## 7. 验证命令与证据

```powershell
pnpm exec vitest run tests/unit/renderer-home-tab.test.ts tests/integration/renderer-tab-dataflow.test.ts
pnpm type-check
pnpm build
pnpm test
pnpm smoke
pnpm test:e2e
pnpm verify -- --stage=full
node scripts/check-contract-coverage.mjs
node scripts/check-desktop-security.mjs
node scripts/check-uuid-leak.mjs
node scripts/check-docs-governance.mjs
git diff --check
```

实施记录必须记录 RED→GREEN→REFACTOR、三组 RPC 参数和异步状态断言、工具版本、全部退出码/测试数量、审阅结果、Git 状态与未授权收口事实。

> 任务只有在 docs/04 完成证据、master 复验和 `origin/master` 推送均满足后才可登记 done；在此之前保持 in_progress，且不自动启动后续任务。
