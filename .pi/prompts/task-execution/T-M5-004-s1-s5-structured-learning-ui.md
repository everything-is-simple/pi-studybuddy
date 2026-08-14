# T-M5-004 续作 / 复验治理提示词：S1-S5 结构化学习页面逐控件修订

> **资产定位**：`.pi/prompts/task-execution/` 下的受控参考资产；配合 `00-标准任务执行提示词.md` 使用。
>
> **不是执行计划**：本文件不替代唯一 `.plan/T-M5-004-s1-s5-structured-learning-ui.md`，不授权开新计划、扩张范围、修改任务状态、写真实业务数据，亦不授权 `commit` / `merge` / `push`。
>
> **快照日期**：2026-08-13。任何静态快照均服从实时 `AGENTS.md`、`docs/00`、`docs/04`、唯一 `.plan/`、`.record/` 与 Git 事实；冲突时停止业务施工，先报告并修复治理漂移。

---

## 0. 交接目标与当前裁决

你是 `H:\pi-studybuddy` 的续作 / 复验 Agent。仅处理当前已登记的唯一任务：

```text
task-id：T-M5-004
标题：S1-S5 结构化学习页面逐控件修订
里程碑：M5 用户可用性验收 + UI 修订 + 一键交付
实时状态（2026-08-13 快照）：in_progress
实时分支（2026-08-13 快照）：agent/T-M5-004-test-database-real-data
实时基线（2026-08-13 快照）：HEAD = master = origin/master = dacec56
```

**本轮核心任务不是重复实现已交付的控件，也不是把自动化 E2E 描述成 UAT。**应当以原生真机 UAT 的缺口为中心，完成或请求裁决以下阻断项：

1. S1 的任务 / 考试 / 冲刺相关用户闭环必须是“可见 UI 创建 → 使用 / 操作 → 重启持久化回查”，不能仅证明课程创建和 S1 可达。
2. S2、S3、S4 若不存在合法的纯 UI 前置数据创建入口，必须先进行**范围裁决**；不能用 `webContents.executeJavaScript`、CDP、RPC/handler 直调、运行中 seed RPC 或数据库预置把它们伪装为真机 UAT。
3. 当前专用 SQLite 测试数据库、真实 Electron 自动化 E2E 与组件级 mock renderer 测试仍可作为各自类别的自动化证据，但必须与“原生真机 UAT”严格分栏。
4. 在 UAT 完整证据、范围裁决和双独立审查均闭环前，T-M5-004 **不得报告 done，也不得进入 Git 收口**。

本提示词 supersedes 旧版 T-M5-004 “任务启动提示词”中以下已经失效的静态表述：

- `Todo 状态：pending`；
- “只有正式开工后才允许建立 plan / 分支”的启动阶段措辞；
- 旧基线 `master=origin/master=6d95ead`；
- 任何将 renderer 自动化或早期 UAT 流水表述为“8 路径纯 UI 完整真机 UAT”的措辞。

它**不删除历史记录**。历史“曾 done / 曾 Git 收口”的叙述已由 2026-08-13 的复查事实 supersede，必须保留其可审计性。

---

## 1. 权威恢复顺序（每次续作都必须执行）

按 AGENTS.md §0 顺序读取、摘要并记录版本 / 任务状态 / 冲突：

1. `AGENTS.md`；
2. `docs/00-文档索引-Index.md`；
3. `docs/04-任务清单-Todo-List.md`；
4. `.plan/00-当前任务.md`；
5. `.plan/T-M5-004-s1-s5-structured-learning-ui.md`（唯一实时执行计划，不重写其历史裁决）；
6. `.record/T-M5-004-实施记录.md`（特别是“测试阶段数据库修正”与“2026-08-13 原生可见 UI 复查补证”）；
7. 相关权威设计条款：
   - `docs/06-API契约-API-Contracts.md`；
   - `docs/07-工作流-Workflow.md`；
   - `docs/08-测试验收-Test-Plan.md`，尤其 §6.6、§9.1、§9.3；
   - `docs/09-使用者介面-UI-Design.md`；
8. T-M5-001 的 `control-inventory.md`、`gap-register.md`、依赖矩阵和审查证据；
9. 当前 renderer、preload、typed RPC、contract、main / agent-host handler、测试与 Electron 启动器。

立即运行并在续作证据中记录：

```powershell
git status --short --branch
git log --oneline --decorate -5
git branch --show-current
git rev-parse HEAD
git rev-parse master
git rev-parse origin/master
git branch --list "agent/T-M5-004*"
```

### 1.1 本快照已知事实（必须再核验）

- `dacec56` 是本快照中 `HEAD=master=origin/master`；当前工作分支为 `agent/T-M5-004-test-database-real-data`。
- 工作区已有可追溯的未收口修改：测试数据库 helper、E2E 启动 / test-main 调整、UUID 检查和 renderer 自动化重命名、`src/main/data-root-init.ts` Windows SQLite 连接生命周期修正，以及 plan / record / docs 的同步。不得覆盖、删除、stash、reset 或 clean。
- 2026-08-13 最近一次完整自动化复验：`verify --stage=full` 通过，unit/integration **130 files / 1183 tests**、真实 Electron E2E **33 files / 141 tests**、contract **127/127**、安全 **6/6**、UUID **7/7**；这只是历史自动化证据，后续变更后须以实际结果重新记录。
- 专用 SQLite 测试库已建立，且已移除运行时 `test.seedModule`。`initializeDataRoot()` 已在返回前关闭建库 SQLite 连接，以避免 Windows WAL/SHM 锁竞争。
- `tests/e2e/t-m5-004-uat-renderer.test.ts` 的 `webContents.executeJavaScript` 路径是 **renderer 自动化 E2E**，不是 §6.6 原生真机 UAT。
- 原生 OS 鼠标 / 键盘补证仅证明“首次创建学期和课程 → S1 可达 → 同隔离根重启仍可见课程”；继续进入 S1 任务表单时误入无关工作台，未创建或完成任务。因此它不能证明 S1 任务闭环，更不能证明 S2/S3/S4 完整闭环。

若任一事实不一致，以实时 SoT 和 Git 为准；记录偏差、权威依据、影响与修正，不得静默选择对完成更有利的旧记录。

---

## 2. 已交付范围、未交付边界和任务不变量

### 2.1 已有实现 / 自动化证据（不得无故回退）

| 区域 | 已交付控件 / 语义 |
|---|---|
| 首页 / S1 | `tasks.complete` 完成动作、刷新、固定中文失败、简报 / 任务 / 考试加载重试、考试详情、归档禁用 |
| S2 资料 | 转换资料预览（`files.previewMarkdown` / `files.read`）、失败重试、`note_generating` 重新生成笔记、列表重试、归档禁用 |
| S2 笔记 | 思维导图、模块证据“查看来源”真实回链、失败重试、归档禁用 |
| S3 练习 | 错题“加入错题”、成功 / 固定中文失败、重复点击防线、静态空态假 action 清除 |
| S4 错题 | 筛选、详情失败重试、显式“重做正确 / 重做错误”、历史与状态刷新；用户已裁决方案 A：`mistakes.get` 返回兼容的 question 摘要（题干 / 题型 / 我的答案 / 正确答案 / 解析） |
| S5 冲刺 | 未确认考试时前端禁用 + 后端拒绝固定中文错误；生成失败回到 idle 并可重试 |

### 2.2 不变量

- **不新增未经裁决的 API / schema / handler / Stream / 全局状态。**已有 `mistakes.get` DTO 的向后兼容字段扩展是已裁决例外；方法总数保持 contract 127/127，除非用户另行裁决。
- renderer 只消费后端事实，不自行伪造状态；写操作必须 busy 防重、错误可恢复、归档前后端双层拒绝、异步请求避免旧上下文覆盖和卸载后更新。
- 作答前不得向 renderer 泄漏 `correct_answer`；DOM、截图、JSON、日志均不得含完整 UUID、绝对路径 / file URI、密钥、错误栈、SQL、资料原文。
- 所有测试和 UAT 只使用 `H:\pi-studybuddy-tmp\runs\T-M5-004\...`；绝不读取、复制、写入或查询 `%LOCALAPPDATA%\PiStudyBuddy`。
- 外部 AI / OCR / WPS / whisper 等不接真实外部服务；S3 / S5 的确定性生成器只是受控测试替代，不能被叙述为真实 AI 成功。
- 不启动 T-M5-005～T-M5-008；不扩展到 S6 / S7 / TTS / 备份 / 设置 / 发行验收。

### 2.3 证据类别必须分离

| 类别 | 允许的前置数据 / 驱动 | 可证明什么 | 绝不能声称什么 |
|---|---|---|---|
| unit / integration / mounted renderer | `createMockRpcClient` 或合成 fixture | 组件级 loading / error / retry / 禁用 / 竞态语义 | 真机 UAT、完整主路径 |
| 真实 Electron 自动化 E2E | 启动前建立专用 SQLite 测试库；运行中仅正式业务 RPC | main→preload→piBridge→TCP/RPC→handler→renderer 链路 | 原生人工 UI 操作 |
| 原生真机 UAT | 全新隔离根；可见 OS 鼠标 / 键盘操作；数据也由 UI 创建 | 每个纳入用户闭环的创建→使用→重启持久化 | fixture、DB seed、CDP / `executeJavaScript` 结果 |

禁止运行中 `test.*` seed RPC；禁止把 Electron E2E 中的数据库夹具称为真机 UAT。

---

## 3. 当前阻断项：先做可行性审计，再实施

先在 `H:\pi-studybuddy-tmp\runs\T-M5-004\uat\` 新建 / 更新以下**证据文件**（不创建第二份 `.plan/`）：

```text
uat-feasibility-audit.md
uat-scope-decision-request.md        # 只有遇到无合法 UI 前置入口时创建
UAT-报告.md
native-uat-evidence.json
```

### 3.1 对每个纳入用户可见闭环做 10 列审计

| 控件 / 路径 ID | 权威来源 | UI 起点 | UI 可创建前置数据？ | UI 可使用 / mutation？ | UI 可重启回查？ | 归档 / 错误 / 重试 | 自动化证据位置 | 原生 UAT 证据位置 | 结论 / 裁决需求 |
|---|---|---|---|---|---|---|---|---|---|

至少覆盖：

1. S1：课程上下文 → 任务创建 / 完成 → 刷新 → 重启；考试查看 / 确认与冲刺入口的适用路径。
2. S2 资料：选择文件 → 导入 / 转换 → 预览或失败重试 → 笔记关联 / 重启。
3. S2 笔记：可见资料选择 → 打开 / 编辑 / 保存或取消 → 来源回链 / 重启。
4. S3 练习：合法 UI 产生或选择模块 → 开始 → 作答 / 翻题 / 提交 → 结果 / 错题 → 重启。
5. S4 错题：合法 UI 产生错题 → 筛选 / 详情 / 完整复盘 → AI 建议或固定失败恢复 → 重做正确和错误 → 状态刷新 / 重启。
6. S5 冲刺：已确认考试门控 → 生成 / 开始模拟考 → 作答 / 提交 / 结果 / 重试 → 重启；未确认考试的前后端拦截另列负向路径。

### 3.2 范围裁决的硬规则

如果某路径没有用户可见、权威范围内的前置数据创建入口：

1. 不得绕过 UI；
2. 不得自行新增 API、隐藏开发入口、数据库按钮、seed handler 或测试后门；
3. 不得把“空态可达”计作“创建→使用→重启”的完整闭环；
4. 生成 `uat-scope-decision-request.md`，每一项必须写明：
   - 缺少的 UI 前置入口和实际观察；
   - 对应控制项、设计条款、当前页面 / RPC / handler；
   - 可选方案（例如：A 纳入本任务补真实 UI；B 明确从 T-M5-004 UAT 范围移出并登记后续 task-id；C 仅保留自动化 fixture 证据且明确不能作为 UAT）；
   - 对 API / schema / 范围 / 前序验收的影响；
   - 推荐方案与原因；
   - 需要用户作出的唯一裁决。
5. 停止该路径的业务施工，继续只做不依赖该裁决的审计 / 证据整理；在用户裁决前，不可把 T-M5-004 标为完成。

**2026-08-13 已知需优先审计的范围问题**：S2 / S3 / S4 纯 UI 创建入口；以及 S1 任务 / 考试 / 冲刺完整闭环。不得假定它们已被覆盖。

---

## 4. 原生真机 UAT 执行纪律

### 4.1 环境与禁止项

- 使用真实 Electron、全新数据根 `H:\pi-studybuddy-tmp\runs\T-M5-004\native-uat-<timestamp>\`。
- 启动前确认该根为空或本次专属；不得种子、不得写数据库、不得调用 handler / RPC 绕过界面、不得 CDP、不得 `webContents.executeJavaScript`。
- 仅使用可见 OS 级鼠标、键盘、窗口操作；应用关闭后以**同一隔离根**重新启动以验证持久化。
- 任何 automation helper 只可用于观察 / 截图采集而不得向 renderer 注入数据或调用业务逻辑。若无法证明该边界，证据降级为自动化，不得标为原生 UAT。
- 不使用真实课程名称、资料原文、密钥或真实数据根。

### 4.2 每个合格路径的最低步骤

```text
1. 首次启动；通过可见 UI 创建前置上下文。
2. 进入目标页 / 控件；记录可达性。
3. 通过 UI 执行目标“使用”动作；记录成功状态或固定中文失败恢复。
4. 覆盖适用的 disabled / archived / retry / duplicate-click / privacy 观察。
5. 关闭应用，以同一隔离根重新启动。
6. 回到目标页，确认本路径产生的列表、详情、状态或结果可被 UI 回查。
```

“首次创建学期和课程 → S1 可达 → 重启课程仍在”只能作为环境建立及 S1 可达性证据，不能替代其中的任务 / 考试 / 冲刺使用闭环。

### 4.3 证据格式

为每步保存非敏感截图和 JSON / DOM 摘要，并在 `UAT-报告.md` 中至少列出：

```text
UAT ID
页面 / 控件 ID
数据根
前置创建步骤（纯 UI）
实际操作（纯 UI）
预期
实际结果
成功 / 失败 / 禁用 / 重试 / 重启回查分类
截图、DOM 摘要、JSON 路径
是否含敏感泄漏（必须为否）
结论：通过 / 不通过 / 等待范围裁决
```

保留负向结果。任何导航误入、控件不可达、无法创建前置数据、错误文案不合规或重启丢失都必须记录为不通过，而不是选择性省略。

---

## 5. TDD 与测试数据库边界

若范围裁决允许继续对具体缺陷施工，严格执行 RED → GREEN → REFACTOR：

1. **RED**：测试先对应权威条款；保存失败命令、失败断言和原因。不得删测试或用实现生成 golden 伪造通过。
2. **GREEN**：仅实现当前闭环所需的最小变更；复用 typed RPC、错误净化、归档防线、请求版本 / mounted guard 与已有 UI 组件。
3. **REFACTOR**：定向全绿后才消除重复；不改变已验证行为。

数据库型自动化测试遵守 `docs/08 §9.1`：

- 在每个专属运行根创建独立 `global.db` 与 `semester/<semester-id>/sem.db`；
- 优先通过正式 schema / handler 建立学期、课程、任务、考试、资料等；无公开创建 RPC 的前置实体仅可在 Electron 启动**前**写入专属库，并保留真实 FK / CHECK / trigger；
- 创建 helper 返回前关闭 SQLite 连接；Windows WAL / SHM 句柄不得阻塞清理或抢占随后 Electron 数据根；
- 运行期只走正式业务 RPC；不得恢复或新增运行中 `test.*` seed RPC；
- mock renderer 只承担组件语义，不承担系统数据验收。

任何测试数据库修正都必须有测试证明：隔离根正确、真实业务根未触碰、连接已关闭、Electron 能以该库启动、正式 RPC 可读取 / 写入预期数据。

---

## 6. 质量门、独立审查与完成条件

### 6.1 命令基线

在同一个 PowerShell 进程前置：

```powershell
$env:Path = "C:\node-v24.14.0-win-x64;$env:Path"
node --version  # 必须为 v24.14.0
pnpm --version  # 必须为 11.20.0
```

至少依序运行受影响定向测试后，再运行：

```powershell
pnpm type-check
pnpm build
pnpm test
pnpm smoke
node scripts/verify.mjs --stage=full
node scripts/check-docs-governance.mjs
node scripts/check-contract-coverage.mjs
node scripts/check-desktop-security.mjs
node scripts/check-uuid-leak.mjs
git diff --check
```

实际版本、测试数量、退出码、日志位置必须以当次运行写入 `.record`，不得复制历史数字充数。自动化全绿不是 UAT 通过的替代。

### 6.2 双独立审查

审查 A（业务 / UI）必须核对：每个纳入控件真实动作、成功 / 失败 / 禁用 / 重试、归档只读、跨上下文竞态、S1-S5 用户闭环与 UAT 证据分类。

审查 B（系统 / 安全 / 治理）必须核对：Electron→preload→piBridge→TCP/RPC→handler→renderer 链路；contract 一致性；答案 / UUID / 路径 / 栈泄漏；专用 SQLite 与生产数据边界；`test.*` seed RPC 未复活；UAT 无注入；Todo / plan / record / master / origin 同步性。

P0、P1、contract 缺口、原生 UAT 不足、范围裁决未取得或治理漂移未处置时，结论只能是 `in_progress`。

### 6.3 T-M5-004 完成的不可替代条件

只有同时满足下列条件，才可请求用户 Git 收口授权：

- 所有纳入且经用户确认的用户可见闭环具备原生真机 UAT 的“创建→使用→重启持久化”证据；
- 无法通过 UI 形成前置数据的项目，已得到明确的用户范围裁决并同步到 Todo / plan / record，且不再错误计入本任务闭环；
- 定向测试、完整质量门、真实 Electron 自动化 E2E 全绿；
- 审查 A / B 均无未处置 P0 / P1；
- docs/04、`.plan`、`.record` 的当前 `in_progress / done` 事实一致；
- 用户已单独授权 Git 收口。

**在最后一项之前，禁止 `git add`、commit、merge、push。**获得授权后仍只可显式 `git add <path>`，仅 ff-only 合并；禁止 `git add -A`、`git add .`、`stash`、`reset --hard`、`clean -fd`、`--no-verify`、强推。

---

## 7. 停止与用户裁决模板

遇到以下任一项立即停止相关业务施工并报告：

- 当前任务、唯一 plan、分支、Git、Todo 或 record 的 live 事实矛盾；
- 需要新增 API / schema / handler / Stream / 全局状态而未获裁决；
- UAT 只能依赖注入、CDP、RPC、handler、数据库或 runtime seed；
- 无法在可见 UI 内创建本路径前置数据；
- 发现真实业务根被触碰或证据含敏感数据；
- 发现问题属于 T-M5-005～T-M5-008；
- 需要危险 Git 操作；
- 质量门或独立审查发现 P0 / P1。

停止报告固定包含：

```text
1. 已读取的权威文件及版本
2. live Git（branch / HEAD / master / origin/master / dirty files）
3. 已完成的审计 / RED / UAT 证据路径
4. 触发条件与最小复现步骤
5. 对任务范围、API、测试、UAT、Git 的影响
6. 可选裁决方案、推荐方案与需要用户回答的唯一问题
7. 在裁决前明确不会执行的动作
```

---

## 8. 本资产的完成定义

本资产仅表示：T-M5-004 已有一份与 **2026-08-13** 当前事实一致的续作 / 复验治理上下文，明确了自动化、专用测试数据库与原生真机 UAT 的边界，列出了范围裁决、审计、质量门与 Git 停止条件。

它不表示：

- T-M5-004 已完成；
- S1 或 S2/S3/S4 的原生真机闭环已完成；
- 用户已作出范围裁决；
- 双独立审查已完成；
- Git 已获授权或已收口；
- T-M5-005～T-M5-008 已启动。
