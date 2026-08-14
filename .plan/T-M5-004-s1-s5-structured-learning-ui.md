# T-M5-004 唯一执行计划：S1-S5 结构化学习页面逐控件修订

**任务 ID**：T-M5-004
**状态**：📝 进行中（in_progress；2026-08-14 v4c 重验已证明 S2 单模块、重复创建脱敏错误与首次重启唯一模块回读；S3 原第二次重启缺口已以既有 typed RPC 的最小可见结果回读 UI 修复，并在同一未预置隔离根完成可见历史/结果读回。未新增 API/schema/handler/Stream/跨 Tab 状态/真实外部 AI；双独立审查 A/B 已完成且 P0/P1=0；Git 收口仍未授权）
**日期**：2026-08-14
**里程碑**：M5 用户可用性验收 + UI 修订 + 一键交付
**标题**：S1-S5 结构化学习页面逐控件修订
**优先级**：P0
**分支**：`agent/T-M5-004-test-database-real-data`
**基线**：`master=origin/master=dacec56`
**提示词资产**：`.pi/prompts/task-execution/T-M5-004-s1-s5-structured-learning-ui.md`
**运行根**：`H:\pi-studybuddy-tmp\runs\T-M5-004\`

## 1. 权威入口（已核验）

| 文件 | 版本/状态 |
|---|---|
| AGENTS.md | v0.1.124（T-M5-004 in_progress；v4c 原生 UAT、质量门与双独立审查 A/B 已通过；Git 收口仍待授权） |
| docs/00-索引 | v0.1.174 |
| docs/04-Todo | v0.1.176（T-M5-004 in_progress；非 Git 收尾准备完成，Git 收口未授权） |
| .plan/00-当前任务.md | 本计划 |
| live Git | `master=origin/master=dacec56`；本轮工作位于隔离分支，Git 收口未获授权 |

## 2. 目标

让 S1-S5 纳入范围内的每个用户可见控件，在真实 Electron 中具备**真实可达、真实可用、可解释、可恢复**的成功/失败/禁用/重试语义，且不破坏 T-M5-002（首次启动/S1 管理）与 T-M5-003（对话/会话/模型/文件引用）已验收闭环。

## 3. 纳入范围（与提示词 §4 一致）

1. **首页/S1 残余动作**（CTRL-HOME-01）：简报/任务/考试条目真实进入/查看/完成/明确不可操作语义；空态、加载失败、失败重试；复用 AppShell 上下文。
2. **S2 资料**（CTRL-MATERIAL-01~05）：真实文件选择导入、MIME/大小/归档校验、上传/转换/生成笔记 loading/success/empty/failure/retry、列表刷新、查看/预览、转换失败不静默、AI 不可用时明确失败恢复入口。不纳入 OCR/WPS 分发装配（T-M5-006）。
3. **S2 笔记**（CTRL-NOTE-01~05）：局部显式资料选择、空态、读取/新建/编辑/保存/取消、保存后真实刷新、失败固定中文+重试、Markdown/公式/Mermaid/思维导图/证据回链、模块学习状态更新、归档只读、竞态/卸载防线。硬约束：不新增 AppShell 跨 Tab materialId、不默认选第一资料、不硬编码 materialId、不以静态文字冒充证据回链。
4. **S3 练习**（CTRL-PRACTICE-01~05）：模块多选、题数选择、开始、加载、单选/多选/填空、上一题/下一题、提交、结果读取（含重启后从既有 `practice.listSessions` 选择已完成练习并调用既有 `practice.getResult` 的可见回读）、失败重试、计时/超时提交、提交中禁用、重复点击防线。安全：作答前不暴露 correct_answer/acceptable_answers/explanation；AI 失败不创建空 session；不显示假成功。
5. **S4 错题**（CTRL-MISTAKE-01~04）：全部/需复习/已掌握筛选、详情、题干/答案/解析/作答历史、AI 错因建议（标注不确定）、六分类确认、重做正确/错误、状态刷新、evidence_count、weak point、失败重试、归档只读。硬约束：AI 建议非事实；S4 不改写 S3 原始作答事实；已掌握可回退；不用短 ID/静态文本冒充复盘。
6. **S5 冲刺**（CTRL-CRAM-01~03）：已确认考试选择、未确认考试门控、题数/时间、生成试卷、开始模拟考、作答、上一题/下一题、提交、结果、模块分析、结果重试、空/失败/禁用态。硬约束：未确认考试不生成模拟考；不经 renderer 字面量绕过确认；速背卡/冲刺计划只读 DTO 语义保留；速背卡朗读/掌握标记属 T-M5-005。

**不纳入**：S6/S7/TTS/备份/设置/状态栏/上下文栏/响应式无障碍/OCR-WPS-whisper 自包含/发行验收/新增 schema/Stream/跨 Tab 全局状态/真实外部服务/生产数据。**唯一例外**：2026-08-13 用户明确同意的 `modules.create` 最小 RPC、host handler 与 NotesTab 局部可见创建入口，仅用于让资料关联模块经 UI 进入 S3/S4 真机闭环。

## 3.1 2026-08-13 用户范围裁决（本计划新增权威输入）

- **裁决**：S2 / S3 / S4 页面所需的“创建前置条件”**必须属于 T-M5-004**；不得以“前置条件不在范围”跳过。
- **必达验收**：在全新隔离运行根，以非注入、可见的真实 Electron UI 完成并记录：
  - S1：创建任务 → 使用/完成任务 → 重启 → 回读确认；
  - S2：通过文件选择 UI 创建资料 → 转换/预览或笔记使用 → 重启 → 回读确认；
  - S3：通过 UI 创建练习所需前置（课程/模块/可练习内容）→ 作答/提交 → 重启 → 回读确认；
  - S4：沿 S3 真实错误作答创建错题 → 查看/重做 → 重启 → 回读确认。
- **禁止替代**：不得用 `webContents.executeJavaScript`、CDP、RPC/handler 直调、数据库预置或 renderer 注入替代上述真机 UAT；自动化 E2E 可作为回归证据，但不抵充 UAT。
- **2026-08-13 补充裁决（supersedes 上述“无新增 API/handler”限制）**：用户明确同意只新增 `modules.create` 的最小 typed RPC、S2 host handler 与 NotesTab 局部可见创建入口；`materialId` 必须由当前 Tab 的学生显式选择提供，不新增 schema、Stream 或跨 Tab 全局状态，不连接真实外部 AI。任务仍为 `in_progress`，Git 收口仍须用户单独授权。
## 4. 输入证据（T-M5-001 运行证据）

- `H:\pi-studybuddy-tmp\runs\T-M5-001\gap-register.md`：G-P1-02（首页缺动作）、G-P1-03（S2 缺预览/回链/呈现）、G-P1-04（S3 结果/S4 详情）、G-P1-05（S5 动作）→ 本任务；G-P0-05（S2 转换）+T-M5-006。
- `H:\pi-studybuddy-tmp\runs\T-M5-001\control-inventory.md`：CTRL-HOME-01、CTRL-MATERIAL-01~05、CTRL-NOTE-01~05、CTRL-PRACTICE-01~05、CTRL-MISTAKE-01~04、CTRL-CRAM-01~03 为纳入；CTRL-CRAM-04/05 标记 T-M5-005。

## 5. 工作步骤（TDD：RED → GREEN → REFACTOR）

### 阶段 A：影响面追踪矩阵（先于任何业务实现）

生成 `H:\pi-studybuddy-tmp\runs\T-M5-004\traceability-matrix.md`，覆盖全部纳入控件 ID，逐行回答 8 个问题（真实 RPC/成功刷新/失败中文+恢复/loading-empty-disabled-readonly-archived/重复点击/竞态卸载/是否需要 API 变化/是否需停止裁决）。

### 阶段 B：RED 测试

先写失败测试（renderer mounted / integration），至少覆盖：空态、成功、失败、禁用、只读、归档、重试、重复点击、竞态、卸载、切换课程/学期/资料、答案泄漏、未确认考试拦截、固定中文错误、DOM 脱敏。

每页按序推进：
1. 首页/S1（CTRL-HOME-01）
2. S2 资料（CTRL-MATERIAL-01~05）
3. S2 笔记（CTRL-NOTE-01~05）
4. S3 练习（CTRL-PRACTICE-01~05）
5. S4 错题（CTRL-MISTAKE-01~04）
6. S5 冲刺（CTRL-CRAM-01~03）

### 阶段 C：GREEN

最小实现，优先复用 typed RPC / useTabData / AppShell 上下文 / 错误净化 / 归档防线 / 文件 capability / allowed-roots；所有 mutation 有 busy/重复提交防线；所有异步请求有上下文/请求版本/挂载保护；renderer 不直接展示内部异常。

### 阶段 D：REFACTOR

仅定向全绿后整理公共 loading/error/empty/retry 组件、按钮禁用语义、可访问名称、消除重复、整理 fixture 边界。

### 阶段 E：真机 UAT（铁律）

真实 Electron + 全新隔离数据根 `H:\pi-studybuddy-tmp\runs\T-M5-004\`；真机 UAT 数据必须由可见 UI 建立，禁止 handler 直调/RPC 绕过/DB 预置/CDP 注入/写真实数据根。**数据库型自动化 E2E**另行使用启动前构建的专用 SQLite 测试库（不提供运行中 `test.*` seed RPC），不得把该 E2E 夹具冒充真机 UAT。

### 阶段 F：质量门

Node24.14.0 前置 PATH；`pnpm type-check && pnpm build && pnpm test && pnpm smoke && node scripts/verify.mjs --stage=full && node scripts/check-docs-governance.mjs && node scripts/check-contract-coverage.mjs && node scripts/check-desktop-security.mjs && node scripts/check-uuid-leak.mjs && git diff --check`；数量与退出码以实际运行为准。

### 阶段 G：双独立审查

审查 A（业务/UI）+ 审查 B（系统/安全/治理），独立输出后合并去重；P0/P1/contract 缺口/UAT 证据不足/治理漂移未处置前不得报告完成。

### 阶段 H：受控收尾（等待用户单独授权）

复验 → 更新 docs/04（T-M5-004 done 证据）→ `.record/T-M5-004-实施记录.md`（8 章）→ 同步 06-API（本轮已裁决新增 `modules.create`）→ 计划/看板标记完成 → 治理脚本复验 → 停止报告。禁止自动 commit/merge/push/启动 T-M5-005~008。

## 6. 停止条件（立即报告，不施工）

同提示词 §13：完成链无法核验 / 未获开工批准（已获）/ 存在其他 in_progress / 状态冲突 / 未知 dirty / 需超出已裁决的 `modules.create` 最小 API-handler-局部 UI 范围而新增 API/schema/handler/Stream/全局状态 / contract 无法表达 / 需猜测安装外部工具 / 需真实外部服务 / 只能绕过 UI / DOM 泄漏敏感信息 / 问题属 T-M5-005~008 / 前序回归无法最小修复 / Git 需危险操作 / UAT 无法完成。

## 7. 验收清单（对提示词 §4 逐条）

- [x] 影响面追踪矩阵、RED/GREEN 历史证据已记录（见 `.record/T-M5-004-实施记录.md`）
- [x] 专用 SQLite 测试数据库建立：正式 schema/handler 建前置数据，E2E 移除 runtime `test.seedModule`
- [x] 答案不泄漏 / 未确认考试拦截 / 固定中文错误 / DOM 脱敏测试通过
- [x] Node24 完整质量门：2026-08-13 历史检查点（130/1189；33/141）保留；2026-08-14 当前 `verify --stage=full` 通过（130/1192；33/141，exit 0）
- [x] 原生真机 UAT v3：S1 与 S4 完整闭环证据保持；S2 的文件选择/转换/创建/重启回读保持。S3 因同一资料出现两个同名模块而降级，不能作为 PASS；原始证据不删除，见 `H:\pi-studybuddy-tmp\runs\T-M5-004\native-uat-v3-20260813-0119\evidence\` 与实施记录附录。
- [x] 审查 P1 最小整改：`modules.create` 拒绝同资料活动同名模块；NotesTab 为 BAD_REQUEST 显示脱敏可操作提示；定向 3 files/46 tests 通过。
- [x] 原生真机 UAT v4c 重验：在同一未预置隔离根完成 S2 单模块创建+重复创建提示→S3 使用/提交→第二次重启可见历史/结果读取；原缺口证据 `93` 保留，修复后证据为 `105/106`；不得注入/直调/预置。
- [ ] 双独立审查无 P0/P1（v4c 重验与 2026-08-14 全量质量门已完成，等待复审结论）
- [x] 治理事实同步：测试数据库修正已登记；任务状态仍为 in_progress
