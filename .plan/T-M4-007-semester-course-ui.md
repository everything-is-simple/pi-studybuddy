# T-M4-007：学期/课程切换 UI

**状态**：in_progress（用户已批准计划并授权实施）
**日期**：2026-08-09
**里程碑**：M4 业务接线 + 打包部署
**优先级**：P0
**分支**：`agent/T-M4-007-semester-course-ui`

## 1. 任务裁决与范围

### 用户授权

用户明确批准“批准 T-M4-007 计划并开始实施”。本计划是唯一执行计划；仅实施学期/课程切换 UI、相关测试、治理文档与实施记录。本地复验完成后停止，等待用户单独授权 Git commit / merge / push。

### 权威依据

- `AGENTS.md` §4.4、§4.5、§5、§7、§8、§9
- `docs/09-使用者介面-UI-Design.md` §2.1、§2.2、§3.1、§3.2
- `docs/03-架构设计-Architecture-Design.md` §6.7
- `docs/06-API契约-API-Contracts.md` §3.3
- `docs/07-工作流-Workflow.md` §2
- `docs/08-测试验收-Test-Plan.md` §6、§5.7
- `docs/04-任务清单-Todo-List.md` §6.6、§7.5、§7.6.1

### 必须交付

1. 左侧栏新增学期树：加载学期、展开/收起、状态标识、归档只读标识。
2. 展开学期后以既有 `courses.list({ semesterId })` 加载课程；呈现加载、空和安全化错误状态。
3. 在 `AppShell` 中持有唯一当前学期/课程上下文；选课后标题栏动态显示学期名与课程名，既有 Tab 接收相同上下文。
4. 快速切换学期时，以请求序号和卸载清理忽略旧的课程请求结果。
5. 设置页开关与工作台 Tab、学期/课程上下文相互独立；返回工作台后上下文保留。
6. UI 不展示完整 UUID、绝对路径、数据库路径、密钥、Bearer、stack 或 RPC 原始错误。

### 明确排除

- 不新增或修改 RPC 契约、handler、数据库 schema。
- 不做学期/课程创建、归档、课表 OCR 导入或右键业务动作。
- 不启动 T-M4-008，不做 AppShell 的跨 Tab 自动加载重构。
- 不连接真实 AI、SMTP、飞书、WPS 或 whisper.cpp；测试运行数据仅使用 `H:\pi-studybuddy-tmp\runs\T-M4-007\`。

## 2. 现状与改动落点

| 文件 | 读取/修改目的 |
|---|---|
| `src/renderer/components/AppShell.tsx` | 当前标题栏为静态“学期名 / 课程名”，左栏仅会话；在此进行最小壳层状态与接线。 |
| `src/renderer/components/SemesterCourseTree.tsx` | 新增纯展示学期/课程树，接收受控状态和回调，保持无 RPC/无副作用。 |
| `src/renderer/semester-course-state.ts` | 新增纯状态机、状态文案和安全显示 helper，便于覆盖选择、折叠和过期结果规则。 |
| `tests/unit/renderer-semester-course-tree.test.ts` | RED→GREEN 覆盖 reducer、状态标识、空/错误安全文案、标题文本与 UUID/路径泄漏。 |
| `tests/unit/renderer-layout.test.ts` | 覆盖 AppShell 左栏树及标题栏最小组装，不新增第 10 个 Tab。 |
| `tests/integration/renderer-semester-course-rpc.test.ts` | 使用记录型 TypedRpcClient 覆盖 `semesters.list` / `courses.list({ semesterId })` 的精确 RPC 方法与参数。 |
| `tests/integration/renderer-semester-course-app-shell.test.ts` | 使用仅开发期 `happy-dom` 真实挂载 AppShell，以 deferred RPC 覆盖课程乱序、标题更新、Tab 切换和设置页往返后的上下文保持。 |
| `docs/04-任务清单-Todo-List.md`、`docs/00-文档索引-Index.md`、`AGENTS.md` | 登记开工事实、版本与受控收尾证据。 |
| `.record/T-M4-007-实施记录.md` | 收尾时写入规定 8 章节。 |

## 3. 执行步骤（TDD）

1. **RED**：先添加纯状态、静态渲染与记录型 RPC 集成测试；确认实现缺口导致断言失败。
2. **GREEN**：新增受控树组件和最小状态 helper，在 `AppShell` 调用既有读取 RPC；不改变 API 和既有 Tab 数据加载策略。
3. **REFACTOR**：整理中文注释、提取固定中文错误文案，检查没有多余状态源。
4. **验证**：定向 unit/integration、type-check、build、smoke、`verify --stage=full`、UUID 泄漏、`git diff --check`、文档治理检查。现有真实 Electron + `127.0.0.1` TCP harness 继续验证生产进程/RPC 路径；该 harness 不观察 renderer DOM。课程乱序、标题与 Tab/设置往返的 renderer DOM 断言由 happy-dom 实际挂载 AppShell 的测试承担，不将 TCP harness 误写为 DOM 覆盖。
5. **收尾**：更新 Todo/索引/AGENTS/本计划/实施记录，停止并等待 Git 收口授权。

## 4. 验收映射

| 要求 | 可验证证据 |
|---|---|
| 树、状态、展开、空/错误、归档只读浏览 | 纯状态 + 静态渲染 unit 测试 |
| `courses.list` 精确参数 | 记录型 RPC integration 测试 |
| 课程乱序、标题栏及上下文保持 | happy-dom 实际挂载 AppShell 的 deferred-RPC integration 测试 |
| 生产进程/RPC 基线路径 | 既有真实 Electron + 127.0.0.1 TCP E2E；不宣称其观察 renderer DOM |
| 不泄漏 UUID/路径/原始错误 | 展示 helper 与 markup 断言 + UUID 检查脚本 |
| 不破坏设置页/不新增 Tab | 既有 AppShell reducer 与 `TABS` 测试 |
| 不污染真实数据根/无外部服务 | mock RPC、既有测试运行目录和完整质量门 |

## 5. 风险与回滚点

- 课程查询存在快速切换竞态：以当前选择和递增请求序号双重校验，清理 effect 后不写状态。
- 既有 `AppShell` 承载会话和设置页：新增树只占用左栏上部；设置页使用原有 `settingsOpen`，不改变 `activeTabId`。
- 回滚点：本任务仅新增 renderer 组件/状态 helper 和对应测试；若运行时集成异常，移除新增左栏块及其导入即可回到 T-M4-006 的已验证结构。


## 6. API / 状态 / 写操作边界

- 只读取既有 `semesters.list({})` 与 `courses.list({ semesterId })`；不调用创建、更新、归档或导入方法。
- `AppShell` 是本任务的唯一学期/课程状态来源；既有 Tab 只接收 `semesterId/courseId`，不在本任务接线 S1-S7 具体业务 RPC。
- archived 学期在树和工作台显示“只读浏览”；当前工作台的学期业务写入口尚未接线。逐控件的禁用、`aria-disabled` 与写 RPC 阻断属于后续 S1-S7 业务接线任务，不能以本任务对会话、设置或占位控件做泛化拦截。

## 7. 16 步执行跟踪

1. [x] 读取 AGENTS、索引、Todo、当前任务及相关设计文档。
2. [x] 核对前序 T-M4-006 已完成、当前分支和唯一执行计划。
3. [x] 创建本任务计划与任务登记。
4. [x] 先写状态、树、RPC 和 AppShell 交互 RED 测试。
5. [x] 实现最小学期树、唯一上下文、竞态/卸载保护与安全展示。
6. [x] 补充 archived 只读浏览标识与可访问课程组名称。
7. [x] 复核“不接线 S1-S7 具体 RPC”的任务边界，未对无关/占位控件添加泛化写拦截。
8. [x] 补充 happy-dom AppShell 实挂载测试，覆盖 deferred RPC 乱序和设置页往返。
9. [x] 更新实施记录、治理 SoT 和审查结论。
10. [x] 以 Node 24.14.0 完成完整质量门复验（101 files/1015 tests + 真实 Electron E2E 16 files/117 tests）、UUID 7/7、文档治理与 `git diff --check`；日志留存于 `H:\pi-studybuddy-tmp\runs\T-M4-007\verify-full-rerun.log`。
11. [x] Mill、Erdos 两名独立审查最终 PASS；已按审查意见回填实施记录测试证据并收敛 archived 写操作边界。
12. [x] 已停止业务施工，等待用户明确 Git 收口授权。

## 8. 审查记录

- Erdos 第二轮提出治理版本漂移、实际 AppShell 交互测试和实施记录三个阻塞项；前两项分别通过治理同步与新增 happy-dom 实挂载测试处理，实施记录在本计划收尾中创建；第三轮确认测试证据回填后最终 PASS。
- Mill 审查确认归档状态、请求 gate 与安全展示；其对“无真实写入口的泛化守卫”的意见已按用户附件“本任务不接线 S1-S7 业务 Tab 具体 RPC”重新裁定：保留只读浏览语义，不对会话、设置或占位控件进行错误阻断，最终 PASS。
- 最终 PASS/FAIL、质量门命令结果与等待 Git 收口的状态已如实登记至 `.record/T-M4-007-实施记录.md`、`docs/04-任务清单-Todo-List.md` 与 `.plan/00-当前任务.md`。
