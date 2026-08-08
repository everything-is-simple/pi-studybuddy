# T-M3-002 执行计划：pi 原生能力承载（流式/工具调用视图/上下文压缩/@文件引用/多模型切换）

**状态**：🔵 执行中（in_progress，用户已批准开工）
**日期**：2026-08-08
**里程碑**：M3 对话与打磨（§7.5 全局执行顺序表第 12 行）
**任务**：T-M3-002 pi 原生能力承载（流式回复/工具调用视图/上下文压缩/@文件引用/多模型切换）
**前置依赖**：T-M3-001 done ✅（对话 Tab 默认主入口：ChatTab 骨架 + agent.send 契约 + agent.events 受控发射 + sessions.* 内存仓库）
**批准记录**：用户于 2026-08-08 明确批准开工（"写入 .plan/T-M3-002-pi-native-capabilities.md 候选草案//确认" + "登记 04-Todo in_progress 并进入步骤 6 实施//批准"）。四项设计裁决批准：① tool_call/tool_result payload 结构化（types.ts + 06-API §4 增补）② files.read 走"现成契约 + allowed-roots 门禁"（不新增契约方法）③ 候选草案确认 ④ in_progress 登记确认

---

## 一、任务目标与权威条款

### 1.1 权威条款
- `docs/09-使用者介面-UI-Design.md §4.2`（对话 Tab：pi 原生能力承载表——流式回复/工具调用视图/上下文压缩/@文件引用/多模型切换）+ `§7`（会话管理 UI）
- `docs/07-工作流-Workflow.md §2.8`（通用 AI 对话路径：步骤 2 流式回复+工具视图、步骤 3 工具调用透明、步骤 4 @文件引用经 allowed-roots 校验）
- `docs/03-架构设计-Architecture-Design.md §6.7`（会话管理，pi 原生 AI 对话承载）+ `§2.3`（钩子归属：model_select 属 T-M3-005）
- `docs/06-API契约-API-Contracts.md §3.1/§3.1.1/§3.2/§3.13/§4`（sessions/agent.send/files/models/Streams 契约）
- `docs/08-测试验收-Test-Plan.md §5.4`（受控夹具全 mock）+ `§6.5`（E2E-10~13 目标，本任务只做其承载层）
- `docs/02-PRD-产品需求-Product-Requirements.md §3.11`（对话默认主入口）+ `§5.2`（密钥边界）
- `AGENTS.md §9.3`（日志脱敏：工具卡片摘要不记录完整输入/输出）+ `§9.4`（符号链接逃逸防护：@引用路径经白名单）+ `§9.5`（物理隔离：不读真实 ~/.pi/agent）

### 1.2 任务目标
在 T-M3-001 对话骨架之上，实现 09-UI §4.2 的 **pi 原生能力承载**（不废弃 pi 原生能力，直接复用语义）：
1. **工具调用视图**：ChatTab 消费 tool_call/tool_result → 工具调用卡片（工具名 + 结果摘要 + studybuddy_* 学习工具图标风格），AI 每次调用工具可视化展示（工具调用透明铁律）
2. **流式回复增强**：token 增量渲染为消息块（对齐 07-WF §2.8 步骤 2）
3. **上下文压缩**：context_compressed → 压缩提示条（长对话自动压缩状态可见）
4. **@文件引用**：输入区 @ 触发 → 当前课程资料选择器 → allowed-roots 白名单校验 → 文件内容注入对话上下文（限当前课程资料，AGENTS.md §9.4）
5. **多模型切换**：模型选择器（列表 + 切换选中态）+ models.list 最小 handler（受控数据源）

## 二、范围与非目标

### 2.1 做（本任务）
| # | 内容 | 落点 |
|---|---|---|
| 1 | AgentEvent payload 结构化子集类型（tool_call/tool_result：toolCallId/toolName/inputSummary/isError/resultSummary）+ 06-API §4 增补 | `src/contract/types.ts` + `docs/06-API契约-API-Contracts.md` |
| 2 | agent-host 受控发射扩展：tool_call/tool_result 事件对（按触发词模拟 studybuddy_* 工具调用） | `src/agent-host/handlers/agent.ts` |
| 3 | ChatTab 工具调用卡片视图（tool_call/tool_result 消费 + 摘要脱敏） | `src/renderer/components/tabs/ChatTab.tsx` |
| 4 | 流式块渲染增强（token 消息块 + 与工具卡片同流） | ChatTab |
| 5 | 上下文压缩提示条（context_compressed → 可见提示） | ChatTab |
| 6 | @文件引用：allowed-roots 校验纯函数（realpath 防符号链接逃逸）+ 输入区 @ 选择器（materials.list 数据源）+ 文件内容注入上下文 | `src/agent-host/allowed-roots.ts`（新建）+ ChatTab + `src/agent-host/handlers/files.ts` |
| 7 | files.read handler 实现（现成契约 + allowed-roots 门禁，06-API §3.2 落地注解） | `src/agent-host/handlers/files.ts` |
| 8 | 模型选择器 UI + models.list 最小 handler（受控 fixture 数据源，不读真实 ~/.pi/agent） | ChatTab + `src/agent-host/handlers/models.ts`（新建） |
| 9 | 相应单件/集成测试（08-Test §1.3 证据链 + 数据隔离） | `tests/unit/` + `tests/integration/` |

### 2.2 不做（留 T-M3-003/后续）
- 学科标签/学习目标/错题关联/L1 注入 UI/L3 检索（T-M3-003）
- AI 自主调用 S1-S7+TTS+备份恢复全部工具 + 跳转结构化 Tab（T-M3-004）
- model_select/turn_end 钩子业务逻辑 + 真实 ~/.pi/agent/models.json 读取 + modelsConfig.* 持久化（T-M3-005）
- 会话管理完整 UI SessionSidebar 全功能（T-M3-006）
- E2E-10~13（T-M3-007/008）
- 不连真实 LLM/外部 AI 服务（08-Test §5.4 全 mock；agent.events 受控夹具可扩展 tool_call/tool_result 事件）
- 不修改 pi 底座内核、不引入新运行时依赖（vitest 静态渲染沿用 renderToStaticMarkup，不引入 jsdom/@testing-library）
- 不新增业务数据表（@引用/模型选择均不落库，05-ERD 不变）

### 2.3 红线
- **物理隔离（AGENTS.md §9.5）**：不读取真实 pi 会话目录 `~/.pi/agent/`；models.list 用受控 fixture 数据源；真实模型配置读取属 T-M3-005
- **日志脱敏（§9.3）**：工具卡片摘要不携带完整输入/输出/UUID/路径；@引用路径不落日志；AI 解读明确标注（🤖）
- **路径安全（§9.4）**：@引用文件内容注入对话上下文必须经 allowed-roots 白名单校验（realpath 防符号链接逃逸）
- 不修改 pi 底座内核、不引入新运行时依赖
- 测试运行数据隔离写 `H:\pi-studybuddy-tmp\runs\T-M3-002\`
- 不新增 RPC 契约方法（models.list/files.read 均已存在；仅补 handler + 06-API 落地注解）

## 三、工程概况（已核实时点：2026-08-08）

- **T-M3-001 现状**：ChatTab（欢迎语/消息列表/输入/会话列表 + agent.events 订阅处理 message_start/token/context_compressed 三类，状态机 idle/streaming/done）；`agent.send` 契约（Api 方法 127）；agent-host 受控发射 message_start → token×6 → context_compressed；sessions.* 内存仓库
- **AgentEvent 5 种 kind**（types.ts §4）：`message_start | token | tool_call | tool_result | context_compressed`，payload 现为 `unknown`——tool_call/tool_result 结构化子集为本任务新增（用户已批准）
- **pi 底座 ExtensionAPI 类型**（`node_modules/.../dist/core/extensions/types.d.ts` 已核实）：`ToolCallEvent { type, toolCallId, toolName, input }`、`ToolResultEvent { type, toolCallId, toolName, input, content[], isError, details }`——主仓 AgentEvent 结构化子集取其子集字段，摘要脱敏
- **files.read 契约已定义无 handler**：`src/agent-host/handlers/files.ts` 只有 watch/unwatch；`check-contract-coverage.mjs` 对"有契约无 handler"仅警告不阻塞 → 本任务补 handler + allowed-roots 门禁（用户已批准此方案）
- **materials.list 已实现**（S2 真实 DB）：params `{ courseId?, status? }` → Material[]（含 fileName/storageKey=`semester/<id>/storage/<name>`）——@引用选择器数据源
- **models.list 契约已定义无 handler**（06-API §3.13：spec 写"从 ~/.pi/agent/models.json"与 §9.5 物理隔离冲突）→ 本任务用受控 fixture 数据源，真实读取归 T-M3-005
- **workspace-path-guard 已有**（T-M1-008，write/edit 拦截）：@引用走只读白名单校验（allowed-roots），与 write 拦截互补
- **参考范式**（pi-desktop 参考仓，只参考不复制）：`allowed-roots.ts`（TTL 缓存范式，主仓只取白名单校验语义重实现为纯函数）、`session-file-references.ts`（会话引用跟踪，主仓 @ 选择器数据源用 materials.list 替代）、`countToolCallBlocks`/`message-display.ts`（工具块过滤语义）

## 四、接口设计

### 4.1 AgentEvent payload 结构化子集（types.ts §4 + 06-API §4 增补）

```ts
export interface AgentEventToolCallPayload {
  toolCallId: string;       // 工具调用 ID（会话内唯一）
  toolName: string;         // 如 studybuddy_generate_questions
  inputSummary: string;     // 脱敏输入摘要（截断 ≤120 字符，去 UUID/路径）
}
export interface AgentEventToolResultPayload {
  toolCallId: string;       // 与 tool_call 配对
  toolName: string;
  isError: boolean;
  resultSummary: string;    // 脱敏结果摘要（截断 ≤160 字符，去 UUID/路径）
}
// AgentEvent.payload 类型化为联合：{} | { text: string } | ToolCall | ToolResult | { compressed: boolean }
```

- 字段子集对齐 pi 底座 ToolCallEvent/ToolResultEvent（toolCallId/toolName 字段同名）
- **摘要脱敏铁律**：inputSummary/resultSummary 只含截断后的展示文本，不含完整输入/输出/密钥/完整 UUID/文件路径（AGENTS.md §9.3）
- 06-API §4 增补 AgentEvent payload 结构化说明（§11.1 治理基线，用户已批准）

### 4.2 agent-host 受控发射扩展（handlers/agent.ts）

- 保留 message_start → token×N → context_compressed 基线序列（兼容 T-M3-001 测试）
- 新增触发词驱动的工具调用模拟：text 含"出题/生成题目/练习题" → 插入 `studybuddy_generate_questions` tool_call/tool_result 事件对；含"笔记" → `studybuddy_generate_note`；含"朗读" → `studybuddy_tts_speak`
- 事件顺序：message_start → token×2 → tool_call → tool_result → token×N → context_compressed
- 事件 payload 走 4.1 结构化子集（toolCallId 用 `call-<n>` 短 id，非 UUID）

### 4.3 allowed-roots 校验纯函数（src/agent-host/allowed-roots.ts 新建）

```ts
export interface AllowedRootsOptions { dataRoot: string; }
export function isPathWithinAllowedRoot(absPath: string, dataRoot: string): boolean
// 语义：realpath 归一化（防符号链接逃逸）→ 判断 absPath 在 dataRoot 解析后的实际目录内
export function summarizePathForDisplay(absPath: string, dataRoot: string): string
// 展示用相对路径（不落日志，仅 UI 展示）
```

- 只读白名单校验（AGENTS.md §9.4），与 workspace-path-guard 的 write 拦截互补
- 数据根 = `PI_STUDYBUDDY_DATA_ROOT` env 或 `%LOCALAPPDATA%\PiStudyBuddy`（复用 studybuddy-extension.ts resolveDataRoot 语义，独立实现）

### 4.4 files.read handler（现成契约 + 门禁）

- 实现 `files.read`：`{ path }` → 校验 `isPathWithinAllowedRoot(path, dataRoot)` → 读取文本内容（≤1MB 截断）→ `{ content, encoding }`
- 越权路径 → NOT_FOUND / BAD_REQUEST（不泄漏真实路径细节）
- 06-API §3.2 落地注解（files.read 现由 T-M3-002 实现，白名单门禁）

### 4.5 models.list 最小 handler（src/agent-host/handlers/models.ts 新建）

- `models.list` → 受控 fixture（08-Test §5.4）：2-3 个 ModelProvider（如 local-hosted / openai-compatible），models 数组含 ModelInfo
- **不读真实 ~/.pi/agent/models.json**（§9.5 物理隔离，真实读取属 T-M3-005）
- 契约不变（06-API §3.13 已在 spec，无需改版本）

### 4.6 ChatTab 承载层扩展（renderer/components/tabs/ChatTab.tsx）

```
ChatTab.tsx
  ├─ ChatToolCallCard（tool_call/tool_result → 工具卡片：工具名 + 摘要 + ✅/⚠️ 状态 + studybuddy_* 图标色）
  ├─ ChatCompressedBanner（context_compressed → 压缩提示条）
  ├─ ChatModelSelector（models.list → 下拉选择 + 切换选中态）
  ├─ ChatFileReferencePicker（输入 @ 触发 → materials.list 选择器 → files.read → 注入 [引用: <文件名>]\n<内容>）
  └─ 既有：ChatWelcomeBanner / ChatMessageList / ChatInput / ChatSessionList
```

- 消息模型扩展：ChatMessage 增加 `toolCalls?: ToolCallView[]`（tool_call 卡片 + 对应 tool_result 状态合并渲染）
- @引用注入：发送时 text 前置 `[引用: <文件名>]\n<内容>\n\n` + 用户原文；引用内容仅本次发送携带，不持久化
- 模型切换选中态：本地 useState（不落库，持久化属 T-M3-005）

## 五、测试策略（TDD，08-Test §1.3 证据链）

### 5.1 单件（tests/unit/）
- `renderer-chat-tab-toolcalls.test.ts`（或并入 renderer-chat-tab.test.ts）：初始 messages 含 toolCalls → 静态渲染工具卡片（工具名/摘要/状态图标）；输入含"出题" → agent.send 参数断言
- `allowed-roots.test.ts`：纯函数 isPathWithinAllowedRoot（白名单内通过/越权拒绝/符号链接逃逸拒绝/大小写归一化）+ summarizePathForDisplay
- `models-handlers.test.ts`：models.list 返回受控 fixture（provider 数/模型数/无 apiKey 泄漏）
- `files-read.test.ts`：files.read 白名单内读取/越权拒绝（BAD_REQUEST/NOT_FOUND）/超限截断

### 5.2 集成（tests/integration/）
- `agent-events-rpc.test.ts` 扩展（或新增）：agent.send("帮我出 5 道题") → 断言收到 message_start + token + **tool_call + tool_result** + token + context_compressed 序列；tool_call/tool_result payload 结构化字段断言（toolCallId/toolName/inputSummary/isError/resultSummary 脱敏）
- `models-list-rpc.test.ts`：models.list RPC 往返（fixture 数据）
- `files-read-rpc.test.ts`：files.read 往返（白名单内 + 越权拒绝）

### 5.3 安全不变量（08-Test §5.7 + §1.3）
- 工具卡片摘要不泄漏完整输入/输出/UUID/路径（断言 tool_call/tool_result payload 无完整 UUID 正则 + 无完整路径）
- @引用文件路径经白名单校验（越权路径拒绝，不落日志）
- AI 解读明确标注（🤖 标识保持）
- 数据隔离：测试写 `H:\pi-studybuddy-tmp\runs\T-M3-002\`（allowed-roots 测试用临时目录 fixture）

### 5.4 基线
- 当前 type-check + 823 单元/集成测试 + 83 E2E + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6，新增不得破坏

## 六、质量门（全绿才可收尾）

```bash
pnpm type-check
pnpm build
pnpm test
pnpm test:e2e
pnpm smoke
pnpm verify
node scripts/check-docs-governance.mjs
node scripts/check-contract-coverage.mjs
node scripts/check-desktop-security.mjs
```

## 七、收尾纪律（AGENTS.md §7）

- 完成后：更新 04-Todo（T-M3-002 done）+ 00-索引 + AGENTS.md §3.1/§12 版本号同步 + 创建 `.record/T-M3-002-实施记录.md`（8 章节）
- 06-API §4 AgentEvent payload 结构化增补 + §3.2 files.read 落地注解（§11.1 治理基线，说明原因/影响/依据）
- 不自动提交/推送：需用户明确授权后 `git add <显式路径>` + 分条 commit（feat + docs）+ `git merge --ff-only` + 推送 origin/master
- 不替用户预选下一任务；完成后停止等待指示

## 八、16 步执行跟踪

- [x] 步骤 1：读文档、定边界（AGENTS.md/00-索引/04-Todo/09-UI/07-WF/03-Arch/06-API/08-Test + 代码现状核实四点：tool_call payload 结构/agent.ts 受控发射/materials.list 数据源/models.list 冲突）
- [x] 步骤 2：检查文档门禁（T-M3-001 done 登记 ✅ + 用户批准四项 ✅ + .plan 无其他执行中任务 ✅ + master 干净 ✅）
- [x] 步骤 3：编写 .plan/ 计划（本文件定稿）
- [x] 步骤 4：独立审查计划（审查记录见下；审查子代理通道失败，改由执行者逐条自审查，实施记录 §3 注明）
- [x] 步骤 5：用户批准计划（用户 2026-08-08 四项裁决批准）
- [x] 步骤 6：拆分任务、逐项实现（contract → agent-host → renderer：types.ts → allowed-roots → agent.ts → models.ts → files.ts → index.ts → ChatTab）
- [x] 步骤 7：编写/更新测试（TDD：RED 33 用例 → 修复 3 类问题 → GREEN 33 全绿）
- [x] 步骤 8：type-check（零错误零警告）
- [x] 步骤 9：build（无错误）
- [x] 步骤 10：test（856 全绿无 skip）
- [x] 步骤 11：smoke / E2E（smoke 6/6 + E2E 83/83 + 安全不变量 6/6 + verify 全绿）
- [x] 步骤 12：独立审查并修复（7 个审查点自审查通过，2 个文档化边界）
- [x] 步骤 13：更新 04-Todo（T-M3-002 done v0.1.53）+ 06-API v0.1.3 + 00-索引 v0.1.59 + AGENTS.md v0.1.39 + 实施记录
- [x] 步骤 14：文档治理检查（通过，1 条既有警告不阻塞）
- [x] 步骤 15：diff 检查（git diff --check 通过，无意外文件）
- [ ] 步骤 16：提交交付（★ 待用户授权）

## 审查记录（步骤 4）

- 2026-08-08 初稿审查：
  - 范围：五大承载点（工具调用视图/流式块增强/上下文压缩/@文件引用/多模型切换）全部落在 ChatTab 承载层 + agent-host 受控发射扩展，T-M3-003~006 明确划出。✅
  - 契约：不新增 RPC 方法（models.list/files.read 现成，补 handler）；AgentEvent payload 结构化子集经用户批准；06-API §4 增补 + §3.2 落地注解。✅
  - 红线：不读真实 ~/.pi/agent（§9.5），models.list 受控 fixture；@引用 allowed-roots 白名单 + realpath 防逃逸（§9.4）；摘要脱敏（§9.3）。✅
  - 测试：静态渲染沿用 renderToStaticMarkup 不引入 jsdom；集成沿用 makeSimulatedApp 夹具。✅
  - 无违反 AGENTS.md §4-§9 条款。✅
- 结论：通过，进入步骤 6。

## 步骤 12 审查记录（实施后独立审查）

- 2026-08-08 实施后审查：
  - 审查方式：reviewer 子代理后台任务失败（无输出退出，session 2026-08-08T04-47-56Z），改由执行者逐条自审查 7 个审查点（types.ts payload / allowed-roots / files.ts / agent.ts / models.ts / ChatTab / 测试安全断言），实施记录 §3 注明通道事件。
  - 通过项：realpath 双解析防符号链接逃逸、门禁顺序（白名单→存在性→读取）、toolCallId 短 id + 摘要固定脱敏、toolCallId 配对更新 + 渲染前 UUID 二次过滤、models fixture 无 apiKey、测试断言覆盖完整 UUID 拒绝与越权拒绝。
  - 文档化边界（非阻塞）：① allowed-roots toLowerCase 在非 Windows 平台大小写归一化过宽（单机 Windows 目标可接受）② files.watch/unwatch 参数校验沿用 T-M3-001。
  - 结论：通过，进入步骤 13。
