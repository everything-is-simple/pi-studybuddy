# T-M5-004 任务启动提示词：S1-S5 结构化学习页面逐控件修订

> 本文件是 `.pi/prompts/task-execution/` 下的受控任务提示词。
>
> 它不是 `.plan/`，不等于任务已登记、已获开工授权、已建立分支，也不授权 commit、merge、push。
>
> 只有用户明确选择并批准 T-M5-004 开工后，执行 Agent 才能进入本任务实施。

---

## 0. 任务身份

你是 `H:\pi-studybuddy` 的实施 Agent。

当前任务：

```text
task-id：T-M5-004
标题：S1-S5 结构化学习页面逐控件修订
里程碑：M5 用户可用性验收 + UI 修订 + 一键交付
Todo 状态：pending
优先级：P0
```

任务目标不是“页面能渲染”或“RPC 已接线”，而是：

> 让 S1-S5 纳入范围内的每个用户可见控件，在真实 Electron 中具备真实可达、真实可用、可解释、可恢复的成功/失败/禁用/重试语义，并且不破坏 T-M5-002 与 T-M5-003 已验收闭环。

禁止因为看到本提示词、Todo 中存在 pending 行，或前一任务已完成，就自行：

- 创建 `.plan`
- 修改 Todo 状态
- 创建或切换分支
- 编写业务代码
- 启动 T-M5-005~008
- commit / merge / push

---

## 1. 强制权威恢复顺序

实施前严格按以下顺序读取，并记录实际版本、状态和冲突：

1. `AGENTS.md`
2. `docs/00-文档索引-Index.md`
3. `docs/04-任务清单-Todo-List.md`
4. `.plan/00-当前任务.md`（若存在）
5. 相关设计文档：
   - `docs/01-TRD-技术需求-Technical-Requirements.md`
   - `docs/02-PRD-产品需求-Product-Requirements.md`
   - `docs/03-架构设计-Architecture-Design.md`
   - `docs/05-数据模型-ERD-Data-Model.md`
   - `docs/06-API契约-API-Contracts.md`
   - `docs/07-工作流-Workflow.md`
   - `docs/08-测试验收-Test-Plan.md`
   - `docs/09-使用者介面-UI-Design.md`
6. 前序任务计划与记录：
   - `.plan/T-M5-001-ui-acceptance-audit.md`
   - `.record/T-M5-001-实施记录.md`
   - `.plan/T-M5-002-first-run-s1-ui.md`
   - `.record/T-M5-002-实施记录.md`
   - `.plan/T-M5-003-chat-session-model-closure.md`
   - `.record/T-M5-003-实施记录.md`
7. T-M5-001 运行证据：
   - `H:\pi-studybuddy-tmp\runs\T-M5-001\control-inventory.md`
   - `H:\pi-studybuddy-tmp\runs\T-M5-001\gap-register.md`
   - `H:\pi-studybuddy-tmp\runs\T-M5-001\ui-function-dependency-matrix.md`
   - `H:\pi-studybuddy-tmp\runs\T-M5-001\review-a-implementation-ux.md`
8. 当前 renderer、typed RPC、contract、handler、测试和真实 Electron E2E fixture。

禁止依赖本 Prompt 的静态快照覆盖 live 仓库事实。

---

## 2. 开工前必须核验的 Git 与治理状态

先运行：

```powershell
git status --short --branch
git log --oneline --decorate -5
git branch --show-current
git rev-parse HEAD
git rev-parse origin/master
git branch --list "agent/T-M5-004*"
```

开工门禁必须同时满足：

- T-M5-003 已在 Todo 登记 done；
- T-M5-003 具备 Todo 证据、master 复验、origin/master 推送三项完成事实；
- 用户已明确选择并批准 T-M5-004 开工；
- `.plan/` 中没有其他正在执行的任务；
- `.plan/00-当前任务.md`、Todo、分支和计划不存在互相矛盾；
- 工作区 dirty 修改均可确认归属；
- 没有需要覆盖未知修改的文件；
- 不需要 `reset --hard`、`clean -fd`、`stash`、`--no-verify`、强推或非 ff-only 合并。

本 Prompt 生成时 live Git 为：

```text
master=origin/master=6d95ead
```

但部分治理文档仍保留 T-M5-003 的历史事实：

```text
master=origin/master=48c93e2
```

实施时必须以 live Git 为准，记录并修复治理事实漂移；不得删除历史记录，也不得未经授权直接改写治理基线。

只有正式开工后才允许：

```text
docs/04：T-M5-004 pending → in_progress
.plan：建立唯一 T-M5-004 计划
分支：agent/T-M5-004-s1-s5-structured-learning-ui
运行根：H:\pi-studybuddy-tmp\runs\T-M5-004\
```

---

## 3. M5 进度与前序任务边界

### 3.1 T-M5-001

已完成：

- 全 UI/功能/依赖验收审计；
- 逐控件 inventory；
- P0/P1/P2 缺口登记；
- 安装包和依赖边界审计；
- 两份独立审查。

T-M5-001 的缺口登记是本任务的输入证据，但不代表本任务可以无边界修复所有问题。

### 3.2 T-M5-002

已完成：

- 首次启动向导；
- 学期/课程/考试/任务基础管理；
- S1 管理面板；
- AppShell 学期/课程上下文刷新；
- 归档学期写保护；
- 真机 UAT 和重启持久化。

本任务不得重复实现第二套 S1 管理逻辑，也不得破坏已验收的首次启动路径。

### 3.3 T-M5-003

已完成：

- 空数据根无生产 fixture 会话；
- 真实会话新建、切换、重命名、删除、导出和重启持久化；
- 真实模型状态、失败可见和重试；
- 真实错题选择；
- 真实资料引用；
- turn_end 的真实会话归属。

本任务不得重新引入：

```text
defaultSessionFixture()
sess-001
mist-001
sess-new
```

不得重做会话、模型和对话闭环。发现回归时，只做最小回归修复并记录证据。

---

## 4. T-M5-004 纳入范围

### 4.1 首页 / S1 残余动作

在不破坏 T-M5-002 的前提下：

- 让首页简报、任务、考试条目具有真实进入、查看、完成或明确不可操作语义；
- 修复首页静态按钮、无 action 按钮或无法解释的空态；
- 处理无学期、无课程、无任务、无考试、加载失败、失败重试；
- 使用已有 AppShell 学期/课程上下文；
- 不新增第二套全局上下文；
- 既有契约无法表达时，先写 RED 并停工请求裁决。

### 4.2 S2 资料

纳入：

- 通过真实文件选择 capability 导入资料；
- MIME、大小、路径、归档只读校验；
- 上传、转换、生成笔记的 loading / success / empty / failure / retry；
- 资料列表刷新；
- 文件查看、预览和可解释状态；
- 转换失败不能静默或伪装成功；
- AI 不可用时保留可查看的原文或明确失败恢复入口。

不纳入：

- OCR/Python/WPS 的分发、许可、安装和随包自包含；
- 运行依赖装配；
- 猜测外部工具路径；
- 真实 WPS/OCR/AI 服务。

这些属于 T-M5-006 或后续任务。

### 4.3 S2 笔记

纳入：

- NotesTab 内的局部显式资料选择；
- 资料列表为空态；
- 读取笔记；
- 新建、编辑、保存、取消；
- 保存成功后的真实刷新；
- 保存失败后的固定中文错误和重试；
- Markdown、公式、Mermaid、思维导图和 source evidence 回链；
- 知识模块学习状态更新；
- 归档学期只读；
- 请求竞态、切换上下文和组件卸载防线。

硬约束：

```text
不新增 AppShell 跨 Tab materialId 全局状态；
不默认选择第一个资料；
不硬编码 materialId；
不以“资料回链”静态文字冒充可点击证据回链。
```

### 4.4 S3 练习

纳入：

- 知识模块多选；
- 题目数量选择；
- 开始练习；
- 题目加载；
- 单选、多选、填空；
- 上一题、下一题；
- 提交；
- 结果读取；
- 题目失败重试；
- 结果失败重试；
- 计时、超时提交；
- 提交中禁用；
- 重复点击防线。

安全约束：

- 作答前不得向 renderer 暴露 `correct_answer`；
- 作答前不得暴露 `acceptable_answers`；
- 作答前不得暴露 `explanation`；
- AI/生成失败不得创建空练习 session；
- 不得显示假成功。

### 4.5 S4 错题与薄弱点

纳入：

- 全部 / 需复习 / 已掌握筛选；
- 错题详情；
- 题干、答案、解析、作答历史；
- AI 错因建议；
- 六分类错因确认；
- 重做正确；
- 重做错误；
- 状态刷新；
- evidence_count 变化；
- weak point 相关状态；
- 失败和重试；
- 归档学期只读。

硬约束：

- AI 建议必须标记为建议或不确定；
- 学生确认后才形成事实；
- S4 不能改写 S3 原始作答事实；
- “已掌握”不是不可回退终态；
- 不得用短 ID、静态文本或 fixture 冒充完整复盘。

### 4.6 S5 冲刺

纳入：

- 已确认考试选择；
- 未确认考试门控；
- 模拟考题数/时间；
- 生成试卷；
- 开始模拟考；
- 作答；
- 上一题/下一题；
- 提交；
- 结果；
- 模块分析；
- 结果读取重试；
- 空态、失败态、禁用态。

硬约束：

- 未确认考试不得生成模拟考；
- 不得通过 renderer 字面量绕过考试确认；
- 速背卡和冲刺计划的确定性只读 DTO 语义必须保留；
- 速背卡朗读、掌握标记、冲刺计划动作属于 T-M5-005，不得扩张纳入。

---

## 5. 明确不纳入范围

以下内容禁止在本任务中顺手实现：

- T-M5-002 首次启动和 S1 基础 CRUD 重做；
- T-M5-003 对话、会话、模型和文件引用重做；
- S6 报告生成、冻结、导出、投递；
- S7 课堂采集、录音转写；
- 全局 TTS 控制条；
- 速背卡朗读；
- 速背卡掌握标记；
- 备份、恢复、调度；
- 设置页；
- 状态栏、上下文栏整体 UX；
- 响应式和无障碍总修订；
- OCR/Python/WPS/whisper 随包自包含；
- setup、portable zip、升级和卸载验收；
- 新增 API、schema、handler、Stream 或跨 Tab 全局状态；
- 真实外部服务；
- 生产数据、真实学生资料、真实凭证。

---

## 6. 影响面追踪矩阵

任何业务实现前，必须先生成：

```text
H:\pi-studybuddy-tmp\runs\T-M5-004\traceability-matrix.md
```

矩阵至少包含：

| 设计条款 | 控件 ID | 当前组件 | 既有 RPC/handler | 状态机 | RED 测试 | 成功语义 | 失败语义 | 禁用语义 | 重试语义 | UAT 证据 | 任务归属 |
|---|---|---|---|---|---|---|---|---|---|---|---|

必须覆盖：

```text
CTRL-HOME-01
CTRL-MATERIAL-01~05
CTRL-NOTE-01~05
CTRL-PRACTICE-01~05
CTRL-MISTAKE-01~04
CTRL-CRAM-01~03
```

以下必须明确标注为 T-M5-005，不能误收：

```text
CTRL-CRAM-04
CTRL-CRAM-05
```

矩阵必须回答：

1. 控件是否绑定真实 RPC，而非只显示按钮；
2. 成功后是否展示真实结果并刷新状态；
3. 失败是否固定中文、无路径/UUID/栈，并提供恢复入口；
4. 是否覆盖 loading、empty、disabled、readonly、archived；
5. 是否有重复点击防线；
6. 是否有异步竞态和卸载保护；
7. 是否需要 API、schema、handler 或全局状态变化；
8. 若需要变化，是否应立即停止并请求裁决。

---

## 7. TDD 开发流程

严格执行：

```text
RED → GREEN → REFACTOR
```

### 7.1 RED

先写失败测试，不得先实现。

至少覆盖：

- 空态；
- 成功；
- 失败；
- 禁用；
- 只读；
- 归档；
- 重试；
- 重复点击；
- 竞态；
- 卸载；
- 切换课程；
- 切换学期；
- 切换资料；
- 答案泄漏；
- 未确认考试拦截；
- 固定中文错误；
- DOM 脱敏。

RED 证据必须记录：

- 命令；
- 失败断言；
- 失败原因；
- 对应设计条款；
- 测试文件；
- 运行输出路径。

禁止：

- 删除测试；
- 放宽断言；
- 使用待测实现自动生成 golden；
- 用 fixture 结果伪装生产结果；
- 先实现后补测试。

### 7.2 GREEN

只写使当前 RED 通过的最小实现：

- 优先复用 typed RPC；
- 优先复用 `useTabData`；
- 优先复用 AppShell 已有上下文；
- 复用已有错误净化；
- 复用已有归档只读防线；
- 复用已有文件 capability 和 allowed-roots；
- 所有 mutation 有 busy/重复提交防线；
- 所有异步请求有上下文/请求版本/挂载保护；
- renderer 不直接展示内部异常对象。

### 7.3 REFACTOR

只有定向测试全绿后才允许：

- 整理公共 loading/error/empty/retry 组件；
- 统一按钮禁用语义；
- 统一可访问名称；
- 消除重复代码；
- 整理测试 fixture 边界；
- 完善脱敏证据。

不得在 REFACTOR 阶段扩大任务范围。

---

## 8. 真机 UAT 硬门槛

自动化测试通过不等于任务完成。

必须使用：

```text
真实 Electron
全新隔离数据根：
H:\pi-studybuddy-tmp\runs\T-M5-004\
```

禁止：

- handler 直调；
- 直接 RPC 绕过 UI；
- 数据库预置业务数据；
- CDP 注入业务状态；
- fixture 渲染替代真实用户路径；
- 写入 `%LOCALAPPDATA%\PiStudyBuddy`。

### 8.1 UAT 路径

至少覆盖：

1. 首页/S1：
   - 空态；
   - 学期/课程选择；
   - 简报、任务、考试；
   - 本任务纳入的进入/查看/完成动作；
   - 刷新；
   - 重启持久化。

2. S2 资料：
   - UI 文件选择；
   - 上传；
   - 转换；
   - 失败；
   - 重试；
   - 查看；
   - 预览；
   - 生成笔记或 AI 不可用时的固定失败恢复。

3. S2 笔记：
   - 局部资料选择；
   - 读取；
   - 编辑；
   - 保存；
   - 取消；
   - 模块状态更新；
   - 保存失败重试；
   - 重启后验证。

4. S3 练习：
   - 模块选择；
   - 题数选择；
   - 开始；
   - 作答；
   - 翻题；
   - 提交；
   - 结果；
   - 失败重试；
   - 答案不泄漏。

5. S4 错题：
   - 筛选；
   - 详情；
   - 题干/答案/解析；
   - AI 错因建议；
   - 六分类确认；
   - 重做正确；
   - 重做错误；
   - 状态刷新。

6. S5 冲刺：
   - 已确认考试；
   - 未确认考试拦截；
   - 生成/开始模拟考；
   - 作答；
   - 提交；
   - 结果；
   - 失败重试。

7. 跨上下文：
   - 切换课程；
   - 切换学期；
   - 切换页面；
   - 旧响应不能覆盖新上下文；
   - 归档学期写入控件禁用；
   - host 仍拒绝越权写入。

8. 重启：
   - 关闭应用；
   - 重新启动同一隔离数据根；
   - 复核本任务产生的持久化结果；
   - 复核列表、状态、当前上下文和重试入口。

### 8.2 UAT 证据

每个步骤必须保存：

```text
动作
预期
实际结果
控件 ID
成功/失败/禁用/重试分类
DOM 或截图路径
JSON 结构化结果
```

建议目录：

```text
H:\pi-studybuddy-tmp\runs\T-M5-004\uat\
├── UAT-报告.md
├── step-01.json
├── step-01.png
├── step-02.json
├── step-02.png
└── ...
```

报告必须区分：

```text
真机纯 UI UAT
真实 Electron 自动化 E2E
mounted renderer 测试
fixture 集成测试
```

不能把自动化 E2E 或 fixture 测试写成真机 UAT。

---

## 9. 安全与隐私

所有 renderer DOM、截图、JSON、日志和报告不得出现：

- 完整 UUID；
- 绝对路径；
- `file://`；
- API key；
- provider 凭证；
- 数据库 SQL；
- 错误栈；
- 学生资料原文；
- 家长渠道地址；
- 完整模型输出；
- 内部异常对象。

测试只能写入：

```text
H:\pi-studybuddy-tmp\runs\T-M5-004\
```

不得写入：

```text
%LOCALAPPDATA%\PiStudyBuddy
```

外部 AI、SMTP、飞书、WPS、OCR、whisper 全部使用受控 mock 或验证固定失败路径，不连接真实服务。

---

## 10. Node24 质量门

同一 PowerShell 进程前置：

```powershell
$env:Path = "C:\node-v24.14.0-win-x64;$env:Path"
node --version
pnpm --version
```

必须确认：

```text
node v24.14.0
pnpm 11.20.0
```

至少运行：

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

同时运行：

- T-M5-004 定向 unit/integration 测试；
- renderer mounted 测试；
- 受影响的真实 Electron E2E；
- 失败、重试、归档、竞态、卸载、重复 mutation 和脱敏测试；
- 真机 UAT。

实际测试数量、退出码和证据路径必须以本次运行结果为准，不得预填历史数字。

---

## 11. 双独立审查

至少两名独立审查者分别输出审查结果，再合并去重。

### 审查 A：业务与 UI

重点检查：

- S1-S5 控件是否真实可用；
- 成功/失败/禁用/重试；
- 状态机；
- 归档只读；
- 竞态/卸载；
- T-M5-002 回归；
- T-M5-003 回归；
- 是否把静态按钮误判为可用。

### 审查 B：系统、安全与治理

重点检查：

- Electron → preload → piBridge → TCP/RPC → handler → renderer 全链路；
- contract 与 handler 一致性；
- 作答前答案泄漏；
- UUID/路径/密钥/栈泄漏；
- fixture 与生产边界；
- UAT 是否纯 UI；
- 是否越界到 T-M5-005~008；
- Todo、plan、record、master、origin/master 是否同步。

P0/P1、contract 缺口、UAT 证据不足或治理漂移未处置前，不得报告完成。

---

## 12. 受控收尾顺序

只有所有实现、自动化测试、真实 Electron E2E、真机 UAT 和独立审查均通过后，才允许执行：

1. 复验当前任务定向测试、完整质量门、最小端到端路径和真机 UAT；
2. 更新 `docs/04-任务清单-Todo-List.md`：
   - T-M5-004 状态；
   - 实际交付；
   - 测试证据；
   - UAT 证据；
   - Git 事实；
3. 创建唯一八章记录：
   - `.record/T-M5-004-实施记录.md`
4. 如果 API 合同确实变化，再同步 `docs/06` 和相关设计文档；
5. 在唯一计划和 `.plan/00-当前任务.md` 标记本地完成；
6. 运行文档治理、contract、安全、UUID 和 diff-check；
7. 停止并报告，等待用户对 Git 收口和下一任务的单独授权。

禁止自动：

```text
commit
merge
push
启动 T-M5-005
启动 T-M5-006
启动 T-M5-007
启动 T-M5-008
```

只有用户另行授权 Git 收口后，才执行 Git 操作。

---

## 13. 强制停止条件

遇到以下任一情况，立即停止业务施工并报告：

- T-M5-003 的 Todo/master/origin/master 完成链无法核验；
- 用户没有明确批准 T-M5-004；
- 存在其他 in_progress 任务或计划；
- Todo、plan、分支、master 状态互相冲突；
- 工作区存在未知 dirty 修改；
- 需要新增 API、schema、handler、Stream 或全局状态；
- 既有 contract 无法表达所需闭环；
- 需要猜测或安装 OCR/WPS/Python/whisper/模型；
- 需要真实外部 AI 或其他外部服务；
- 只能通过 RPC、handler、数据库或 CDP 绕过 UI；
- DOM 或证据出现 UUID、路径、密钥、资料原文或错误栈；
- 发现问题属于 T-M5-005~008；
- 发现 T-M5-002 或 T-M5-003 回归且无法最小修复；
- Git 操作需要 reset、clean、stash、强推或非 ff-only 合并；
- 真机 UAT 无法完成或证据不足。

停止报告必须包含：

```text
已读取的权威文件
live Git 状态
触发的停止条件
RED/审计证据路径
需要用户裁决的唯一问题
```

不得在停止报告后顺带启动其他任务。

---

## 14. 本 Prompt 的完成定义

本 Prompt 资产完成，只表示以下内容已经明确：

- T-M5-004 的任务身份；
- 当前工程进度；
- 前序任务边界；
- 纳入范围与非目标；
- 开工门禁；
- RED→GREEN→REFACTOR 流程；
- 真机 UAT 标准；
- 质量门；
- 双独立审查；
- 受控收尾；
- 强制停止条件。

本 Prompt 不表示：

- T-M5-004 已开工；
- Todo 已改为 in_progress；
- `.plan` 已建立；
- 分支已建立；
- 代码已修改；
- 测试已通过；
- Git 已提交、合并或推送；
- T-M5-005~008 已被选择。
