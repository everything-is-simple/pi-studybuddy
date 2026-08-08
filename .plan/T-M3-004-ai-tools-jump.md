# T-M3-004 执行计划：AI 自主调用工具 + 跳转结构化 Tab

> 状态：📝 草案（待用户批准，批准后登记 04-Todo in_progress 方可开工）
> 日期：2026-08-08
> 里程碑：M3 对话与打磨（done 3/8：T-M3-001/002/003）
> 任务：T-M3-004 AI 自主调用工具（S1-S7+TTS+备份恢复全部工具）+ 跳转结构化 Tab
> 前置依赖：T-M3-002（受控发射 + 工具卡片）done + S1-S7 全部工具 done（35 工具注册）

---

## 一、任务目标与权威条款

### 1.1 权威条款

| 条款 | 要点 |
|---|---|
| 07-WF §2.8 步骤 3 | AI 自主调用工具（按需）：学生问"帮我出 5 道导数定义题" → AI 调用 `studybuddy_generate_questions` → tool_call 钩子 workspace-path-guard 校验 → tool_result 钩子 observability 记录 → renderer 展示"已生成 5 题 [去练习]" → 点击跳转练习 Tab（**带 sessionId**） |
| 09-UI §4.2 | 工具调用可跳转："AI 调用 `studybuddy_generate_note` 后，『查看』按钮跳转到笔记 Tab"；对话原型 `[工具调用：studybuddy_generate_questions] ✅ 已生成 5 题 [去练习]` |
| 09-UI §4.1 | TabBar 九 Tab（💬对话/📊首页/📁资料/📝笔记/✏️练习/❌错题/🎯冲刺/📋报告/🎤采集）+ "主要 RPC"列（daily_brief→首页 / materials.*→资料 / notes.*→笔记 / practice.*→练习 / mistakes.*→错题 / mockExams.*→冲刺 / reports.*→报告 / classCapture.*→采集） |
| 07-WF §2.8 衔接 | 对话出题 → 跳练习 Tab（S3）；上传资料 → 跳资料 Tab（S2）；问错题 → @引用错题 ID → S4；请求报告 → `studybuddy_generate_report`（S6） |
| 08-Test §6.5 E2E-11 | 学生发送"帮我出 5 道导数定义题" → AI 调用 generate_questions → 工具视图可见 → 展示"已生成 5 题 [去练习]" → 点击跳转练习 Tab（**断言 sessionId 传递**）——**E2E 归 T-M3-007，本任务做承载层 + 单件/集成** |
| 08-Test §5.4 | 受控夹具全 mock：AI/工具调用不连真实外部服务；agent.send 受控发射语义保持 |

### 1.2 任务目标

在 T-M3-001/002/003 对话承载之上实现 07-WF §2.8 + 09-UI §4.2 "AI 自主调用工具 + 跳转结构化 Tab"：

1. **受控发射触发词扩展**：agent.ts `TOOL_TRIGGERS` 从 3 个扩展到覆盖 35 工具全部域（触发词→工具映射，可测试）
2. **工具→目标 Tab 映射纯函数**：独立模块（35 工具 → tabId），可单测
3. **ChatTab 跳转承载**：`onNavigateTab(tabId, context?)` prop + 工具卡片"去练习/[查看]"按钮（按映射渲染）
4. **AppShell 接线**：setActiveTabId 传给 ChatTab
5. **相应单件/集成测试**（08-Test §1.3 证据链 + 数据隔离）

---

## 二、范围与非目标

### 2.1 做（本任务）

- 触发词→工具映射扩展（35 工具域全覆盖，受控夹具语义，按域分组触发词）
- 工具→目标 Tab 映射纯函数 + 单测
- ChatTab 工具卡片跳转按钮 + `onNavigateTab` prop + AppShell 接线（setActiveTabId 传入）
- 跳转 context 传递（tabId + sessionId 等，脱敏）
- 相应集成测试（agent.send 新触发词 → tool_call/tool_result → 跳转回调断言）

### 2.2 不做（留 T-M3-005~008）

- **E2E-10~13（T-M3-007/008）**：本任务只做单件/集成；E2E-11 端到端断言（真实 Electron 启动 + 点击跳转）归 T-M3-007
- **真实 LLM 调用**（08-Test §5.4 全 mock；agent.send 保持受控夹具，不连真实外部服务）
- **真实工具执行**（35 工具业务 handler 已在 S1-S7 Adapter 层实现并注册；renderer"自主调用"仍是受控模拟事件，真实 AI 自主调用需真实 LLM + pi 底座工具执行管线，非本任务）
- 会话管理完整 UI + 真实 sessionId（T-M3-006）
- 多模型持久化 + turn_end/model_select 钩子（T-M3-005）
- 不修改 pi 底座内核、不新增运行时依赖

### 2.3 红线

- 工具输入/结果摘要保持脱敏（≤120/≤160 字符 + 去 UUID，§9.3）；跳转 context 不含学生资料原文
- 测试写 `H:\pi-studybuddy-tmp\runs\T-M3-004\`，绝不污染 `%LOCALAPPDATA%\PiStudyBuddy`
- 不新增契约 RPC 方法（跳转走 renderer 内部回调，不跨 RPC；若裁决需新增，须同步 06-API）
- UUID 泄漏检测 7/7 基线不可破；安全不变量 6/6 不可破

---

## 三、工程概况（已核实时点：2026-08-08，与用户开工 Prompt 有三处事实修正）

### 3.1 现状核实

- **T-M3-003 已 done 在 master**（5 commits 0a8444f..2d2eeb2 已推送，实施记录已建，工作区干净，仅 `.pi-subagents/` 未跟踪）
- **T-M3-004 已登记 pending**（04-Todo v0.1.55 §7.4.1 + §7.5 全局执行顺序表第 14 行）
- **TOOL_TRIGGERS 3 项**（`src/agent-host/handlers/agent.ts:32-56`）：出题→generate_questions / 笔记→generate_note / 朗读→tts_speak；`matchToolTrigger` 用 `text.includes(keyword)` 匹配
- **ChatTab 无跳转回调 prop**（`src/renderer/components/tabs/ChatTab.tsx:59` Props 含 rpc/initialMessages/initialSessions/initialCompressed/initialModels/initialModelId/initialPickerOpen/initialMaterials/initialSubject/initialGoal/initialMistakeIds，无 onNavigateTab）
- **AppShell 内部持有 tab 状态**（`src/renderer/components/AppShell.tsx:97` `useState(DEFAULT_TAB_ID)`；TabBar `onSelectTab={setActiveTabId}`；renderTab 按 activeTabId 渲染 10 分支含 `case "backup"` → BackupPanel）
- **35 工具已注册**（`src/agent/studybuddy-extension.ts` 10 组工厂 registerTool；全名清单见下节）
- **既有集成测试**：`tests/integration/agent-events-toolcalls.test.ts` 4 用例断言 3 触发词序列 + 无触发词基线（**扩展须保持兼容无回归**）

### 3.2 对用户开工 Prompt 的三处事实修正（已核实）

| # | Prompt 说法 | 实际核实 | 影响 |
|---|---|---|---|
| 1 | S2 工具 6 个清单列 5 个（漏 `studybuddy_update_learn_status`） | `src/agent/tools/s2/tools.ts:166` 注册第 6 个工具 `studybuddy_update_learn_status` → modules.updateLearnStatus；**35 工具总数成立**（6+1+6+3+4+2+3+2+3+5=35） | 映射表需补此工具（S2 学习状态语义 → notes 或 home） |
| 2 | "TabBar 有 backup" | **TABS 数组仅 9 个 Tab，无 backup**（`src/renderer/tabs.ts`）；但 AppShell `case "backup"` → BackupPanel 存在（09-UI §6 备份 UI，T-M2-008 实现），**backup 不在 TabBar 渲染** | backup_* 工具→Tab 映射需裁决（见裁决 1） |
| 3 | "09-UI §4.1 表格无 backup 行" | ✅ 属实；且 **TabBar 亦无 backup**——09-UI §4.1 与 §6 备份 UI 的落位关系需在映射裁决中一并明确 | 裁决 1 |

### 3.3 35 工具全名清单（已核实 `src/agent/tools/*/tools.ts` name 字段）

**S1（6）**：init_semester / transition_semester / add_exam / confirm_exam / complete_task / daily_brief
**S1-OCR（1）**：ocr_schedule
**S2（6）**：upload_material / convert_material / replace_material_text / generate_note / update_note / **update_learn_status**（Prompt 遗漏项）
**S3（3）**：generate_questions / submit_practice / get_practice_result
**S4（4）**：confirm_error_cause / redo_mistake / archive_mistake / aggregate_weak_point
**S5（2）**：generate_mock_exam / submit_mock_exam
**S6（3）**：generate_parent_report / deliver_parent_report / manage_report_targets
**S7（2）**：transcribe_class / save_transcription
**TTS（3）**：tts_speak / tts_control / tts_switch_engine
**备份（5）**：backup_course / backup_all_courses / restore_course / list_backups / configure_backup_schedule

---

## 四、五裁决点（步骤 1 核实产出，待用户批准）

### 裁决 1：工具→Tab 映射表（核心设计点）

建议映射（依据 09-UI §4.1 主要 RPC 列 + 07-WF §2.8 衔接语义 + 工具域语义）：

| 工具域 | 工具 | 目标 Tab |
|---|---|---|
| S3 练习 | generate_questions / submit_practice / get_practice_result | `practice` |
| S2 笔记 | generate_note / update_note | `notes` |
| S2 资料 | upload_material / convert_material / replace_material_text | `materials` |
| S2 学习状态 | update_learn_status | `notes`（或 home，待定） |
| S4 错题 | confirm_error_cause / redo_mistake / archive_mistake / aggregate_weak_point | `mistakes` |
| S5 冲刺 | generate_mock_exam / submit_mock_exam | `cram` |
| S6 报告 | generate_parent_report / deliver_parent_report / manage_report_targets | `report` |
| S7 采集 | transcribe_class / save_transcription | `capture` |
| S1 首页 | init_semester / transition_semester / add_exam / confirm_exam / complete_task / daily_brief / ocr_schedule | `home` |
| 备份 | backup_course / backup_all_courses / restore_course / list_backups / configure_backup_schedule | **待裁决**（TabBar 无 backup Tab，见裁决 1a） |
| TTS | tts_speak / tts_control / tts_switch_engine | **无跳转**（朗读控制条全局，不跳转） |

**裁决 1a（backup 落位）**：TabBar 无 backup Tab（§3.2 修正 2）。三个选项：
- A：备份工具不渲染跳转按钮（与 tts_* 同类"无目标 Tab"）——最小改动，但"备份完成可跳转查看"体验缺失
- B：09-UI §4.1 TabBar 增补备份 Tab（权威条款变更，需用户批准 + 09-UI 修订）——超出本任务范围
- C：本任务映射表含 backup 工具但 UI 层先不渲染按钮，留 T-M3-006 会话管理 UI 一并落位
**建议 A**（本任务不做权威条款变更，backup 语义后续 T-M3-006 处理）

**裁决 1b（映射表权威归属）**：工具级映射表 09-UI §4.1 无现成条款（只有"主要 RPC"列）。建议：**映射纯函数实现 + 在 09-UI §4.1 或 07-WF §2.8 补映射表条款**（后者更贴近衔接语义）。**建议补 07-WF §2.8**（衔接段扩充为映射表），09-UI §4.2 已有"工具调用可跳转"文字条款足够。

### 裁决 2：触发词覆盖粒度

建议**按域分组**（§6.4 禁止过度工程）：每域 1-2 个触发词即可测通映射 + 跳转全链路，不必 35 工具逐一触发词。示例：
- 「速背卡/模拟卷/冲刺」→ generate_mock_exam
- 「转写/课堂/录音」→ transcribe_class
- 「备份」→ backup_course
- 「错题/薄弱点」→ aggregate_weak_point
- 「报告/家长」→ generate_parent_report
- 「上传/资料」→ upload_material
- 保留既有 3 触发词（出题/笔记/朗读）兼容无回归

### 裁决 3：跳转按钮文案/行为

建议：**所有有目标 Tab 的工具渲染跳转按钮，统一文案 `[去<Tab名>]`**（E2E-11 断言"已生成 5 题 [去练习]"是"已生成 5 题"文案 + "[去练习]"按钮的复合断言；09-UI §4.2 "查看"是笔记 Tab 语义）。备选：按工具域定制（笔记域"[查看]"，其余"[去<Tab名>]"）。**建议统一 `[去<Tab名>]`**（简单一致，E2E-11 兼容）；无目标 Tab 的（tts_*、backup 按裁决 1a）不渲染。

### 裁决 4：sessionId 传递语义

建议跳转 context 结构 `{ tabId, sessionId?, courseId? }`：
- tabId：目标 Tab
- sessionId：当前对话 sessionId（受控发射当前固定 "sess-001" fixture 语义；真实会话管理归 T-M3-006，本任务保证字段通道就位）
- courseId：从材料/错题关联场景可解析（暂可选，无则省略）
- **脱敏**：context 不含学生资料原文、不含完整 UUID（§9.3 + check-uuid-leak）

### 裁决 5：受控发射扩展的测试确定性

- 扩展后**保持既有 3 触发词测试兼容**（agent-events-toolcalls.test.ts 4 用例不回归）
- 新增断言：新触发词（如"速背卡"→generate_mock_exam、"转写课堂"→transcribe_class、"备份课程"→backup_course）→ tool_call/tool_result 序列 + toolName 正确
- 触发词匹配保持 `text.includes(keyword)` 确定性（无正则无随机）

---

## 五、交付物与测试策略（TDD，08-Test §1.3）

### 5.1 交付物

| 文件 | 内容 |
|---|---|
| `src/renderer/tool-tab-map.ts`（新建，或 src/agent-host/ 独立模块） | 工具→目标 Tab 映射纯函数（35 工具全覆盖 + 无目标 Tab 工具返回 undefined） |
| `src/agent-host/handlers/agent.ts`（修改） | TOOL_TRIGGERS 扩展（3→全域分组，按裁决 2） |
| `src/renderer/components/tabs/ChatTab.tsx`（修改） | `onNavigateTab(tabId, context?)` prop + 工具卡片跳转按钮（按映射渲染，裁决 3） |
| `src/renderer/components/AppShell.tsx`（修改） | `onNavigateTab={setActiveTabId}` 接线（+context 透传） |
| 测试文件（新建/修改） | 见 5.2 |

### 5.2 测试

- **单件**：工具→Tab 映射纯函数（35 工具全覆盖断言：generate_questions→practice、tts_speak→undefined、backup_course→按裁决 1a、update_learn_status→notes 等）；触发词→工具映射扩展断言（新触发词命中新工具）；ChatTab 工具卡片跳转按钮静态渲染（renderToStaticMarkup：有目标 Tab 的工具渲染按钮、tts_* 不渲染）
- **集成**：agent.send 新触发词（"速背卡/转写课堂/备份课程"等）→ tool_call/tool_result 序列断言；ChatTab onNavigateTab 回调触发断言（模拟工具卡片点击 → 断言回调参数 tabId+context）
- **安全不变量**：工具摘要脱敏保持（≤120/≤160 + 去 UUID）；跳转 context 不含学生资料原文
- **数据隔离**：写 `H:\pi-studybuddy-tmp\runs\T-M3-004\`
- **基线参考**：892 单元/集成 + 83 E2E + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6 + UUID 泄漏 7/7（新增不得破坏）

---

## 六、质量门（全绿才可收尾）

```bash
pnpm type-check
pnpm build
pnpm test
pnpm test:e2e
pnpm smoke
pnpm verify
node scripts/check-docs-governance.mjs
node scripts/check-contract-coverage.mjs   # 本任务不新增契约方法（预期），若新增须同步 06-API
node scripts/check-desktop-security.mjs
node scripts/check-uuid-leak.mjs
```

---

## 七、收尾纪律（AGENTS.md §7）

1. 复验测试 + 最小端到端路径
2. 更新 04-Todo：T-M3-004 done（事实、提交号）；不替用户预选下一项
3. 创建 `.record/T-M3-004-实施记录.md`（8 章节）
4. 若 API 契约变化更新 06-API spec（预期不新增契约方法——跳转走 renderer 内部回调，不跨 RPC）
5. 若裁决 1b 通过：07-WF §2.8 衔接段补映射表条款（权威条款修订，登记 AGENTS.md §12）
6. 运行文档治理检查
7. 停止报告，等待用户明确指示

**禁止**：自动提交/推送/合并（须用户明确授权 `git add <显式路径>` + 分条 commit（feat+test+docs）+ `git merge --ff-only` + 推送 origin/master）；创建下一任务启动 Prompt。

---

## 八、批准清单

用户批准以下五裁决后登记 04-Todo in_progress 开工：

- [ ] 裁决 1：工具→Tab 映射表（含 update_learn_status 补录 + 1a backup 落位 + 1b 映射表条款归属）
- [ ] 裁决 2：触发词按域分组覆盖（35 工具域全覆盖 + 既有 3 触发词兼容）
- [ ] 裁决 3：跳转按钮统一文案 `[去<Tab名>]`（无目标 Tab 不渲染）
- [ ] 裁决 4：跳转 context `{ tabId, sessionId?, courseId? }`（脱敏）
- [ ] 裁决 5：受控发射扩展保持测试确定性 + 既有测试无回归
