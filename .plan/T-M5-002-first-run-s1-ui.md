# T-M5-002 首次启动向导与 S1 管理 UI 闭环

**状态**：执行中
**日期**：2026-08-12
**里程碑**：M5 用户可用性验收 + UI 修订 + 一键交付
**实施分支**：`agent/T-M5-002-first-run-s1-ui`
**测试运行根**：`H:\pi-studybuddy-tmp\runs\T-M5-002\`
**集成基线**：`master=origin/master=869de2f`

## 1. 裁决与范围

用户明确批准 T-M5-002 开工。T-M5-001 已确认：新安装的空数据根没有仅通过 UI 创建学期、课程、考试、课表和任务的路径。本任务将该 P0 闭环接入现有 S1 RPC，使学生不依赖开发者、终端、数据库或对话指令完成首次学习计划设置。

### 纳入范围

- 空数据根首次启动向导：创建学期，至少创建一门课程；成功后选择新建上下文并打开首页。
- 学期树与首页的 S1 管理入口：创建/编辑学期和课程；手工创建考试、课表项和任务；任务完成动作。
- 使用既有 `semesters.*`、`courses.*`、`exams.*`、`schedule.*`、`tasks.*` RPC；创建后刷新树、标题、首页任务/考试列表和学期状态。
- 显式的字段校验、取消、RPC 错误、重试、loading、防重复提交和归档只读 UI。
- 单元/集成和真实 Electron E2E：空数据根从首次启动到重启后保持可见的 S1 最小路径。

### 明确不纳入

- 不修改 API 契约、数据库 schema 或 S1 handler 业务规则，除非 RED 证实现有契约无法表达设计条款并另行请求裁决。
- 不修复 `defaultSessionFixture()`、对话/模型/文件引用，归 T-M5-003。
- 不修复 S2-S7、TTS、备份、设置、OCR/WPS/whisper 与打包自包含，归 T-M5-004~008。
- 不连接真实 AI、OCR、WPS、whisper、SMTP 或外部模型；测试仅使用隔离夹具和本地既有 S1 handler。
- 不写入真实业务数据根或真实凭证。

## 2. 已定实现裁决

1. 首次启动入口放在左侧学期区域的空状态，不将创建操作藏入设置页或对话命令。
2. 采用分步表单：学期 -> 至少一门课程；考试、课表和任务作为首页/管理面板中的可发现操作，可跳过并稍后添加。
3. 课表 OCR 是可选增强能力，不是首次可用的前置条件；本任务提供手工课表录入，OCR 自包含由 T-M5-006 裁决。
4. `semesters.create` 成功后立即刷新学期列表；`courses.create` 成功后将其设为 AppShell 唯一的当前学期/课程上下文，避免依赖重新启动或手动展开。
5. 新创建考试默认 `pending`，学生通过明确确认动作转为 `confirmed`；归档学期不显示写操作或明确禁用并解释原因。
6. 失败不得吞掉：仅显示固定、可操作的中文错误，不输出路径、内部 ID、原始异常或凭证；重试只重发最近失败的安全操作。

## 3. RED -> GREEN -> REFACTOR

### RED

先新增失败测试，至少覆盖：

- `SemesterCourseTree` 空数据态有“创建学期”入口，向导校验必填字段、取消不发 RPC、创建学期/课程后发出上下文刷新事件。
- S1 管理界面调用参数严格绑定当前学期/课程：创建考试、手工课表、任务；任务完成后更新列表。
- 创建/加载失败显示固定中文错误并提供重试；归档上下文阻止所有写操作。
- 真实 Electron E2E 在隔离空数据根完成首次学期/课程/考试/课表/任务创建，重启后树和首页仍显示创建结果；测试不使用 fixture 会话或直接数据库种子绕过 UI。

### GREEN

- 最小增量实现首次启动向导、S1 管理面板和 AppShell 刷新/选择回调。
- 将现有 HomeTab 的任务/考试展示升级为符合本任务范围的创建、完成、确认和手工课表交互。
- 在成功、失败、取消、加载、重试和只读状态下保持固定布局和可访问标签。

### REFACTOR

- 提取纯表单校验、错误文本和安全 mutation 状态，避免在 AppShell、树和首页复制异步规则。
- 核对中文文案、键盘焦点、长名称换行、按钮禁用和无完整 UUID/路径泄露。

## 4. 预期文件范围

- `src/renderer/components/SemesterCourseTree.tsx`
- `src/renderer/components/AppShell.tsx`
- `src/renderer/components/tabs/HomeTab.tsx`
- 新增或局部复用的 S1 renderer 组件/纯状态模块
- 对应 `tests/unit/`、`tests/integration/`、`tests/e2e/`
- `.record/T-M5-002-实施记录.md`（收尾时创建）
- 仅在实现与权威设计出现真实冲突时更新 docs/05/06/07/09；否则不改设计契约

## 5. 验收清单

- [x] 空数据根 UI 有清晰的“创建学习计划”入口，用户不需要阅读开发文档、运行命令或使用对话。
- [x] 学期表单校验标签、开始/结束日期和时区；取消不写入数据；失败可重试。
- [x] 创建课程为首次流程必经步骤；成功后标题栏、学期树和首页均绑定新上下文。
- [x] 用户可通过 UI 新增/编辑学期和课程，新增考试并确认，新增/编辑/删除手工课表，新增/完成任务；归档前备份入口只在既有能力允许的范围内呈现。
- [x] 所有写操作有 loading、防重复、成功刷新、固定错误和归档只读行为。
- [x] 真实 Electron E2E 使用空数据根完成上述最小路径，重启后数据仍显示；不直接种子绕过 UI。
- [x] 定向测试、受影响真实 Electron E2E、type-check、security/UUID 检查和完整 `verify --stage=full` 通过（121 files/1138 tests；30 files/138 E2E；contract 127/127；security 6/6；UUID 7/7；smoke 6/6）。
- [x] 两名独立审查者复核实现/UX 与安装态验收边界；未解决的 P0/P1 留给既定 M5 任务。

## 完成记录

- 完成日期：2026-08-12
- 实施记录：`.record/T-M5-002-实施记录.md`
- 状态：✅ 已完成
- 收尾事实：真机 UAT 两阶段通过（空数据纯 UI 创建闭环 + 重启持久化 + DOM 无敏感信息）；发现并修复管理面板隐藏 TabBar 缺陷；Node24 `verify --stage=full`、双独立审查、文档治理与 `git diff --check` 已复验。无 API/handler/schema 变化；T-M5-003~008 保持 pending，Git 收口另需授权。

## 6. 受控命令

```powershell
$env:Path = "C:\node-v24.14.0-win-x64;$env:Path"
node --version
pnpm --version
pnpm test -- <targeted-tests>
pnpm test:e2e -- <targeted-e2e>
pnpm type-check
pnpm verify -- --stage=full
node scripts/check-docs-governance.mjs
node scripts/check-contract-coverage.mjs
node scripts/check-desktop-security.mjs
node scripts/check-uuid-leak.mjs
git diff --check
```

所有测试运行数据写入 `H:\pi-studybuddy-tmp\runs\T-M5-002\`。不运行真实外部服务，不使用真实用户数据或凭证。

## 7. 停止条件

- API/schema 缺少首次流程必须表达的能力，或设计条款冲突：记录证据并请求用户裁决。
- 任何 P0/P1 不属于首次启动/S1 管理边界：登记到既定 T-M5-003~008，不扩展本任务。
- 完成所有验收项、独立审查与质量门后，按 AGENTS.md §7 受控收尾；不自动创建或启动下一任务，不自动 commit、merge 或 push。
