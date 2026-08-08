# T-M3-001 执行计划：💬 对话 Tab 默认主入口（pi 原生 AI 对话承载层接通）

**状态**：🔵 执行中（in_progress，用户已批准开工）
**日期**：2026-08-08
**里程碑**：M3 对话与打磨（M3 起点，§7.5 全局执行顺序表第 11 行）
**任务**：T-M3-001 💬 对话 Tab（pi 原生 AI 对话默认主入口）
**前置依赖**：M1+M2 E2E 通过 ✅（T-M1-010 + T-M2-009 done，M2 全部 9 任务完成）
**批准记录**：用户于 2026-08-08 明确批准开工（"直接批准 T-M3-001 开工：登记 in_progress 后进入实施"）；04-Todo v0.1.50 + 00-索引 v0.1.56 + AGENTS.md v0.1.36 已同步

---

## 一、任务目标与权威条款

### 1.1 权威条款
- `docs/09-使用者介面-UI-Design.md §4.2`（对话 Tab：通用 AI 问答，pi 原生默认）+ `§7`（会话管理 UI）
- `docs/07-工作流-Workflow.md §2.8`（通用 AI 对话路径，默认主入口）
- `docs/03-架构设计-Architecture-Design.md §6.7`（会话管理，pi 原生 AI 对话承载）
- `docs/06-API契约-API-Contracts.md §3.1`（sessions.* 契约）+ `§4`（Streams，agent.events）
- `docs/02-PRD-产品需求-Product-Requirements.md §3.11`（对话默认主入口）
- `docs/08-测试验收-Test-Plan.md §6.5`（E2E-10~13 目标，本任务只做其基础承载）

### 1.2 任务目标
把"💬 对话"从占位 EmptyState 升级为**可用的默认主入口**：接通 agent-host 会话承载层 + renderer 订阅 agent.events + 会话列表/消息渲染的最小可用闭环。

## 二、范围与非目标

### 2.1 做（本任务）
| # | 内容 | 落点 |
|---|---|---|
| 1 | chat 分支替换 EmptyState → ChatTab 组件 | `src/renderer/components/tabs/ChatTab.tsx`（新建） |
| 2 | 启动默认落在 chat + 欢迎语"你好，今天想学点什么？" | ChatTab 内欢迎横幅 |
| 3 | 消息输入 + 发送 → agent-host（新契约 `agent.send`） | ChatTab + rpc-client 复用 |
| 4 | agent-host 端 `agent.events` 受控夹具发射端（message_start → token 流 → context_compressed 序列） | `src/agent-host/handlers/agent.ts`（新建） |
| 5 | renderer 订阅 `agent.events` 事件分发骨架 | ChatTab 内 subscribe + 状态机（idle/streaming/done） |
| 6 | sessions.* 最小 handler（list/get/delete）+ 内存会话仓库（可注入 fixture） | `src/agent-host/handlers/sessions.ts`（新建）+ `src/agent-host/session-store.ts`（新建） |
| 7 | 会话列表占位（左侧导航替换为最小会话列表） | AppShell 左侧栏 + ChatTab 会话列表 |
| 8 | 契约新增 `agent.send` + 06-API spec 同步 | `src/contract/api.ts` + `docs/06-API契约-API-Contracts.md` |

### 2.2 不做（留 T-M3-002/后续）
- @文件引用（T-M3-002）、多模型切换（T-M3-002）
- 完整流式增量渲染/工具调用视图（countToolCallBlocks）/上下文压缩（onContextUsageChange）（T-M3-002 承载）
- 学科标签/学习目标/错题关联/L1 注入 UI/L3 检索（T-M3-003）
- AI 自主调用全部工具 + 跳转结构化 Tab（T-M3-004）
- model_select/turn_end 钩子（T-M3-005）
- 完整会话管理 UI（SessionSidebar 全功能，T-M3-006）
- E2E-10~13（T-M3-007/008）

### 2.3 红线
- 不修改 pi 底座内核、不引入新运行时依赖（vitest 静态渲染范式沿用现有 renderToStaticMarkup，不引入 jsdom/@testing-library）
- 不连真实 LLM/外部 AI 服务（08-Test §5.4 全 mock；agent.events 用受控夹具发射）
- 测试运行数据隔离写 `H:\pi-studybuddy-tmp\runs\T-M3-001\`
- 日志脱敏（AGENTS.md §9.3）：不记录请求正文/完整 UUID/学生资料原文
- **不读取真实 pi 会话目录 `~/.pi/agent/`**（03-Arch §4.1 + AGENTS.md §9.5 物理隔离）；T-M3-001 sessions.* 用内存仓库 + fixture，真实 pi 会话读取属 T-M3-003

## 三、工程概况（已核实时点：2026-08-08）

- **形态**：Electron 四进程 main / preload / renderer / agent-host，MessagePort RPC 贯通（renderer ←PiBridge→ main ←RPC→ agent-host）。
- **AI 底座**：`@earendil-works/pi-ai@0.80.10` + `@earendil-works/pi-coding-agent@0.80.10`，不修改内核；扩展层 `src/agent/studybuddy-extension.ts` 已注册 35 工具 + 4 钩子（T-M1-008 完成）。
- **RPC 层**（`src/contract/rpc.ts`）：五种 wire 消息；`server.pushEvent(topic, payload, key)` 已用于 `files.changed`（file-watch.ts:90）——**agent.events 发射复用同范式**；`client.subscribe(topic, key, on)` renderer 可用。
- **契约层**：`AgentEvent { kind: "message_start"|"token"|"tool_call"|"tool_result"|"context_compressed"; sessionId; payload: unknown }`（types.ts §4）；`Streams["agent.events"]` 已定义；`sessions.*` 契约已定义（list/get/context/rename/delete/export/search）。
- **renderer**：`AppShell.tsx` 三栏布局，`renderTab()` case "chat" 渲染 EmptyState；`tabs.ts` DEFAULT_TAB_ID="chat"；`rpc-client.ts` 已具备 call/subscribe；其余 8 Tab 已有业务 UI。
- **agent-host**：`createAgentHost()` 注册 system.ping/toolchains/files handlers；**sessions.* 与 agent.* 均无 handler**。
- **契约校验**：`scripts/check-contract-coverage.mjs` 对 Api 方法无 handler 是 WARN 不阻塞；unknown handler（不在 Api 中）FAIL → **新增 handler 必须同步加入 contract/api.ts**。

## 四、接口设计

### 4.1 新增 RPC 契约（06-API §3.1 追加）
```
"agent.send": { params: { sessionId: string; text: string }; result: { eventCount: number } }
```
- 语义：renderer 发送用户消息 → agent-host 触发受控 agent.events 序列（message_start → N 个 token → context_compressed），返回发射事件数。
- 数据源：mock 回复生成器（固定 token 片段 + 压缩事件），不连真实 LLM。

### 4.2 Streams（复用现有主题，无新增）
- `"agent.events"`: AgentEvent —— agent-host `pushEvent("agent.events", event, undefined)` 发射；renderer `subscribe("agent.events", undefined, cb)` 消费。

### 4.3 sessions.* 最小实现（内存仓库）
- `session-store.ts`：`createSessionStore(fixture?)` → 内存 Map，seed fixture 会话（id/name/updatedAt/preview），提供 list/get/delete/context。
- handler 注册：`sessions.list` / `sessions.get` / `sessions.delete` 实现，`sessions.context/rename/export/search` 暂注册返回 NOT_FOUND 或最小实现（契约校验仅要求 Api 方法无 handler 时 WARN，但统一注册更干净）。

### 4.4 组件结构
```
ChatTab.tsx
  ├─ ChatWelcomeBanner（🤖 你好，今天想学点什么？）
  ├─ ChatMessageList（消息列表：user/assistant + 流式占位）
  ├─ ChatInput（文本输入 + 发送按钮）
  └─ ChatSessionList（会话列表：从 sessions.list 渲染）
```

## 五、测试策略（TDD，08-Test §1.3 证据链）

### 5.1 单件（tests/unit/）
- `renderer-chat-tab.test.ts`：ChatTab 静态渲染（renderToStaticMarkup）——欢迎语存在、输入框存在、会话列表渲染 fixture 会话名、发送按钮存在；消息列表渲染 user/assistant 消息；不引入 jsdom。
- `session-store.test.ts`：内存仓库 list/get/delete/context 断言。

### 5.2 集成（tests/integration/）
- `agent-events-rpc.test.ts`：真实装配 createAgentHost（复用 host-rpc.test.ts 的 makeSimulatedApp 夹具）→ renderer client 订阅 agent.events → 调用 agent.send → 断言收到 message_start + token* + context_compressed 事件序列（顺序断言）。
- `sessions-handlers.test.ts`：sessions.list/get/delete RPC 往返断言（mock fixture 数据）。

### 5.3 安全不变量
- 对话内容不泄漏 UUID/路径/密钥（断言 agent.send 参数不落日志、事件 payload 无完整 UUID）。
- AI 解读带明确标注（欢迎语/回复前有 🤖 标识）。

### 5.4 基线
- 当前 type-check + 802 单元/集成 + 83 E2E + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6，新增不得破坏。

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

- 完成后：更新 04-Todo（T-M3-001 done）+ 00-索引 + AGENTS.md §3.1/§12 版本号同步 + 创建 `.record/T-M3-001-实施记录.md`（8 章节）
- 契约新增 `agent.send` → 06-API spec 同步（§11.1 治理基线，说明原因/影响/依据）
- 不自动提交/推送：需用户明确授权后 `git add <显式路径>` + `git merge --ff-only` + 推送 origin/master
- 不替用户预选下一任务；完成后停止等待指示

## 八、16 步执行跟踪

- [x] 步骤 1：读文档、定边界（AGENTS.md/00-索引/04-Todo/09-UI/07-WF/03-Arch/06-API/08-Test + 代码现状）
- [x] 步骤 2：检查文档门禁（T-M2-007 done 登记 ✅ + 用户批准 ✅ + .plan 无其他执行中任务 ✅）
- [x] 步骤 3：编写 .plan/ 计划（本文件定稿）
- [ ] 步骤 4：独立审查计划（审查记录见下）
- [x] 步骤 5：用户批准计划（用户 2026-08-08 明确批准开工）
- [x] 步骤 6：拆分任务、逐项实现（agent-host → contract → renderer）
- [x] 步骤 7：编写/更新测试（TDD：RED 4 文件 7 失败 → GREEN 21 全绿）
- [x] 步骤 8：type-check（零错误零警告）
- [x] 步骤 9：build（无错误）
- [x] 步骤 10：test（823 全绿无 skip）
- [x] 步骤 11：smoke / E2E（smoke 6/6 + E2E 83/83 + 安全不变量 6/6 + verify 全绿）
- [x] 步骤 12：独立审查并修复（8 项审查通过）
- [x] 步骤 13：更新 04-Todo（T-M3-001 done v0.1.51）+ 06-API v0.1.2 + 00-索引 v0.1.57 + AGENTS.md v0.1.37 + 实施记录
- [x] 步骤 14：文档治理检查（通过，1 条既有警告不阻塞）
- [x] 步骤 15：diff 检查（git diff --check 通过，无意外文件）
- [ ] 步骤 16：提交交付（★ 待用户授权）

## 审查记录（步骤 4）

- 2026-08-08 初稿审查：
  - 范围：chat 分支替换 EmptyState → 最小对话闭环（欢迎语/输入/消息列表/会话列表）+ agent.send 契约 + agent.events 受控发射 + sessions.* 最小 handler。@引用/多模型/完整流式/工具视图/上下文压缩明确划 T-M3-002。✅
  - 红线：不读真实 ~/.pi/agent（物理隔离 §9.5），sessions.* 用内存仓库。✅
  - 契约校验：新增 agent.send 须同步 contract/api.ts（unknown handler FAIL）；06-API spec 同步在步骤 13。✅
  - 测试：静态渲染沿用 renderToStaticMarkup 不引入 jsdom（08-Test 未批准新依赖）。✅
  - 无违反 AGENTS.md §4-§9 条款。✅
- 结论：通过，进入步骤 6。
