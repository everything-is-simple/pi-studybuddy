# T-M5-004 唯一执行计划：S1-S5 结构化学习页面逐控件修订

**任务 ID**：T-M5-004
**状态**：📝 进行中（in_progress，v0.1.166 登记开工）
**日期**：2026-08-13
**里程碑**：M5 用户可用性验收 + UI 修订 + 一键交付
**标题**：S1-S5 结构化学习页面逐控件修订
**优先级**：P0
**分支**：`agent/T-M5-004-s1-s5-structured-learning-ui`
**基线**：`master=origin/master=6d95ead`
**提示词资产**：`.pi/prompts/task-execution/T-M5-004-s1-s5-structured-learning-ui.md`
**运行根**：`H:\pi-studybuddy-tmp\runs\T-M5-004\`

## 1. 权威入口（已核验）

| 文件 | 版本/状态 |
|---|---|
| AGENTS.md | v0.1.114（T-M5-003 done 已登记） |
| docs/00-索引 | v0.1.165 |
| docs/04-Todo | v0.1.166（T-M5-004 in_progress） |
| .plan/00-当前任务.md | 本计划 |
| live Git | `master=origin/master=6d95ead`，工作区干净 |

## 2. 目标

让 S1-S5 纳入范围内的每个用户可见控件，在真实 Electron 中具备**真实可达、真实可用、可解释、可恢复**的成功/失败/禁用/重试语义，且不破坏 T-M5-002（首次启动/S1 管理）与 T-M5-003（对话/会话/模型/文件引用）已验收闭环。

## 3. 纳入范围（与提示词 §4 一致）

1. **首页/S1 残余动作**（CTRL-HOME-01）：简报/任务/考试条目真实进入/查看/完成/明确不可操作语义；空态、加载失败、失败重试；复用 AppShell 上下文。
2. **S2 资料**（CTRL-MATERIAL-01~05）：真实文件选择导入、MIME/大小/归档校验、上传/转换/生成笔记 loading/success/empty/failure/retry、列表刷新、查看/预览、转换失败不静默、AI 不可用时明确失败恢复入口。不纳入 OCR/WPS 分发装配（T-M5-006）。
3. **S2 笔记**（CTRL-NOTE-01~05）：局部显式资料选择、空态、读取/新建/编辑/保存/取消、保存后真实刷新、失败固定中文+重试、Markdown/公式/Mermaid/思维导图/证据回链、模块学习状态更新、归档只读、竞态/卸载防线。硬约束：不新增 AppShell 跨 Tab materialId、不默认选第一资料、不硬编码 materialId、不以静态文字冒充证据回链。
4. **S3 练习**（CTRL-PRACTICE-01~05）：模块多选、题数选择、开始、加载、单选/多选/填空、上一题/下一题、提交、结果读取、失败重试、计时/超时提交、提交中禁用、重复点击防线。安全：作答前不暴露 correct_answer/acceptable_answers/explanation；AI 失败不创建空 session；不显示假成功。
5. **S4 错题**（CTRL-MISTAKE-01~04）：全部/需复习/已掌握筛选、详情、题干/答案/解析/作答历史、AI 错因建议（标注不确定）、六分类确认、重做正确/错误、状态刷新、evidence_count、weak point、失败重试、归档只读。硬约束：AI 建议非事实；S4 不改写 S3 原始作答事实；已掌握可回退；不用短 ID/静态文本冒充复盘。
6. **S5 冲刺**（CTRL-CRAM-01~03）：已确认考试选择、未确认考试门控、题数/时间、生成试卷、开始模拟考、作答、上一题/下一题、提交、结果、模块分析、结果重试、空/失败/禁用态。硬约束：未确认考试不生成模拟考；不经 renderer 字面量绕过确认；速背卡/冲刺计划只读 DTO 语义保留；速背卡朗读/掌握标记属 T-M5-005。

**不纳入**：S6/S7/TTS/备份/设置/状态栏/上下文栏/响应式无障碍/OCR-WPS-whisper 自包含/发行验收/新增 API-schema-handler-Stream-全局状态/真实外部服务/生产数据。

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

真实 Electron + 全新隔离数据根 `H:\pi-studybuddy-tmp\runs\T-M5-004\`；纯 UI 操作 8 条路径（首页/S2 资料/S2 笔记/S3 练习/S4 错题/S5 冲刺/跨上下文/重启持久化）；证据 `uat/` 目录 JSON+截图+报告；禁止 handler 直调/RPC 绕过/DB 预置/CDP 注入/写真实数据根。

### 阶段 F：质量门

Node24.14.0 前置 PATH；`pnpm type-check && pnpm build && pnpm test && pnpm smoke && node scripts/verify.mjs --stage=full && node scripts/check-docs-governance.mjs && node scripts/check-contract-coverage.mjs && node scripts/check-desktop-security.mjs && node scripts/check-uuid-leak.mjs && git diff --check`；数量与退出码以实际运行为准。

### 阶段 G：双独立审查

审查 A（业务/UI）+ 审查 B（系统/安全/治理），独立输出后合并去重；P0/P1/contract 缺口/UAT 证据不足/治理漂移未处置前不得报告完成。

### 阶段 H：受控收尾（等待用户单独授权）

复验 → 更新 docs/04（T-M5-004 done 证据）→ `.record/T-M5-004-实施记录.md`（8 章）→ 若 contract 变化同步 06-API（预期不变化）→ 计划/看板标记完成 → 治理脚本复验 → 停止报告。禁止自动 commit/merge/push/启动 T-M5-005~008。

## 6. 停止条件（立即报告，不施工）

同提示词 §13：完成链无法核验 / 未获开工批准（已获）/ 存在其他 in_progress / 状态冲突 / 未知 dirty / 需新增 API-schema-handler-Stream-全局状态 / contract 无法表达 / 需猜测安装外部工具 / 需真实外部服务 / 只能绕过 UI / DOM 泄漏敏感信息 / 问题属 T-M5-005~008 / 前序回归无法最小修复 / Git 需危险操作 / UAT 无法完成。

## 7. 验收清单（对提示词 §4 逐条）

- [ ] 影响面追踪矩阵生成并覆盖全部纳入控件
- [ ] 每页 RED 初次失败证据记录
- [ ] GREEN 全绿（定向 + 全量）
- [ ] 答案不泄漏 / 未确认考试拦截 / 固定中文错误 / DOM 脱敏测试通过
- [ ] 真机 UAT 8 路径证据齐全
- [ ] Node24 完整质量门通过（以实际运行结果为准）
- [ ] 双独立审查无 P0/P1
- [ ] 治理事实同步（Todo/plan/record）
