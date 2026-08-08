# T-M3-006 执行计划：09-UI 对话 Tab 业务 UI + 会话管理 UI

**状态**：🔵 执行中（in_progress，用户已批准开工）
**日期**：2026-08-08
**里程碑**：M3 对话与打磨（§7.5 全局执行顺序表第 16 行）
**任务**：T-M3-006 09-UI 对话 Tab 业务 UI + 会话管理 UI
**前置依赖**：T-M3-001 done ✅ + T-M1-009 模式 ✅（T-M3-005 已收尾：master a7b5db7 + origin/master 推送）
**批准记录**：用户 2026-08-08 确认开工 Prompt 并授权 T-M3-005 收尾 + T-M3-006 开工；五裁决按推荐方案定案（见 §5）

---

## 一、任务目标与权威条款

### 1.1 权威条款
- `docs/09-使用者介面-UI-Design.md §4.2`（对话 Tab 通用 AI 问答）+ `§7`（会话管理 UI）+ `§3.3`（会话列表：日期分组/模糊搜索/unread/学科标签颜色）+ `§11.2`（Ctrl+N 新建会话）
- `docs/06-API契约-API-Contracts.md §3.1`（sessions.* 契约；**rename/export handler 归 T-M3-006**）
- `docs/03-架构设计-Architecture-Design.md §6.7`（会话管理，SessionSidebar 业务化）
- `docs/07-工作流-Workflow.md §2.8`（工具→Tab 映射表）
- `docs/08-测试验收-Test-Plan.md §6.5`（E2E-10~13 目标，本任务只做基础承载）
- `docs/02-PRD-产品需求-Product-Requirements.md §1.2/§3.11`（AI 受约束辅助 + 对话默认主入口）

### 1.2 任务目标
把会话管理从"ChatTab 内部最小列表"升级为**完整业务会话管理 UI**：AppShell 左侧栏 SessionSidebar（日期分组/模糊搜索/unread/学科标签颜色/新建）+ sessions.rename/export handler 补齐 + 会话切换/重命名/删除/导出操作 + ChatTab 业务态（空/加载/错误）补全。

## 二、范围与非目标

### 2.1 做（本任务）
| # | 内容 | 落点 |
|---|---|---|
| 1 | sessions.rename handler（契约已定义）+ SessionStore.rename | src/agent-host/session-store.ts + handlers/sessions.ts |
| 2 | sessions.export handler（契约已定义：md\|json → {path}）+ SessionStore.export；**导出到 `H:\pi-studybuddy-tmp\runs\T-M3-006\exports\`**（裁决 1），内容脱敏 | 同上 |
| 3 | AppShell 左侧栏占位 → SessionSidebar 组件：日期分组（今天/昨天/本周）、模糊搜索（sessions.search，L3 未建库降级内存过滤）、学科标签颜色、unread 计数、新建会话（裁决 2）、选中高亮 | src/renderer/components/SessionSidebar.tsx（新建）+ AppShell.tsx |
| 4 | 会话切换业务化：点击会话 → 对话 Tab 加载该会话；选中会话状态 AppShell 提升（裁决 5） | AppShell.tsx + ChatTab.tsx |
| 5 | 会话操作菜单：重命名（inline 编辑）/ 删除（确认）/ 导出（md\|json） | SessionSidebar.tsx |
| 6 | ChatTab 业务态补全：空态（无会话）/加载态/错误态；头部元数据条与选中会话联动 | ChatTab.tsx |
| 7 | SessionSummary 加可选 unread 字段（裁决 3，fixture 演示值，无后台事件源仅展示） | src/contract/types.ts |

### 2.2 不做（留后续）
- E2E-10~13（对话默认主入口/工具调用/@引用/TTS+L3 检索）→ T-M3-007
- E2E-01~13 全链回归 + 安全不变量最终校验 → T-M3-008
- backup_* 目标 Tab 决策 → **裁决 4 维持不渲染跳转按钮，留 T-M3-008 最终评估**
- 真实 LLM / 外部 AI 服务（08-Test §5.4 全 mock）
- 不读取真实 pi 会话目录 `~/.pi/agent/`（AGENTS.md §9.5 物理隔离）
- 不修改 pi 底座内核；不引入新运行时依赖（静态渲染 renderToStaticMarkup，不引入 jsdom）

### 2.3 红线
- 测试运行数据隔离写 `H:\pi-studybuddy-tmp\runs\T-M3-006\`，绝不污染业务数据根
- 日志/导出脱敏（AGENTS.md §9.3）：不记录请求正文/完整 UUID/学生资料原文/API key
- 新增 handler 必须过 check-contract-coverage（rename/export 已在 api.ts，无需改契约）
- TDD 纪律（AGENTS.md §5）：RED → GREEN → REFACTOR，禁止先实现再补测试

## 三、工程概况（已核实时点：2026-08-08，T-M3-005 收尾后）

- **契约**（src/contract/api.ts，127 方法）：sessions.list/get/context/rename/delete/export/search 已定义；agent.send 已带 sessionMeta。check-contract-coverage：Api 方法无 handler=WARN，unknown handler=FAIL。
- **handlers/sessions.ts**：已实现 list/get/context/delete/search（search 走 L3 bigram OR-combined MATCH）；**缺 rename/export**。
- **session-store.ts**（84 行）：内存仓库 createSessionStore(fixture?) + defaultSessionFixture()（sess-001 极限学习 / sess-002 导数练习）；方法 list/get/delete/context/updateMeta；SessionSummary 已有 subject/goal/mistakeIds；**缺 rename/export + unread 字段**。
- **renderer**：ChatTab.tsx（744 行）已实现消息/发送/agent.events 五态/工具卡片/模型选择/@引用/学习场景元数据条/跳转按钮；**会话列表在 ChatTab 内部**；AppShell 左侧栏为占位"导航：学期/课程/会话"（220px aside）。
- **测试基线**：939 单件/集成（+14）+ 83 E2E + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 127 handlers + 安全不变量 6/6 + UUID 泄漏 7/7。

## 四、接口设计

### 4.1 handler 补齐（契约已定义，无需改 api.ts）
```
"sessions.rename": { id, name } → Session   // SessionStore.rename：更新 name + updatedAt；不存在返回 undefined/错误
"sessions.export": { id, format: "md"|"json" } → { path }  // 导出到 runs/T-M3-006/exports/；md=对话摘要文本，json=结构化会话；内容脱敏
```

### 4.2 SessionStore 扩展
- `rename(id, name): Session | undefined`
- `export(id, format, destDir): { path }`（写文件在 handler 层或 store 层，需可注入 destDir 保证测试隔离）
- SessionSummary 加 `unread?: number`（fixture 演示值）

### 4.3 SessionSidebar 组件
```
SessionSidebar.tsx
  ├─ SessionSearchInput（sessions.search → L3；L3 空/失败 → 内存 sessions.list 过滤降级）
  ├─ SessionGroup（今天/昨天/本周，按 updatedAt 分组）
  │   └─ SessionItem（名称 + 📐学科标签颜色 + 未读徽标 + 选中高亮 + 右键/悬浮操作菜单）
  └─ SessionActions（新建会话 Ctrl+N / 重命名 inline / 删除确认 / 导出 md|json）
```

### 4.4 AppShell 状态提升（裁决 5）
- `activeSessionId` 提升到 AppShell；SessionSidebar 点击 → setActiveSessionId + 通知 ChatTab（props 或受控切换）
- ChatTab 保持既有能力，新增受控会话 prop（initialSessionId / onSessionChange），空态/加载态/错误态渲染

## 五、测试策略（TDD，08-Test §1.3 证据链）

### 5.1 单件（tests/unit/）
- `session-store-ext.test.ts`：rename（存在/不存在/空名）、export（md/json 格式 + **脱敏断言：无完整 UUID/密钥/学生资料原文** + 文件写 runs 隔离目录）、unread 字段回填
- `session-sidebar.test.tsx`：静态渲染——日期分组标题（今天/昨天/本周）、搜索框、学科标签颜色、未读徽标、空态；renderToStaticMarkup 不引入 jsdom
- `chat-tab-business.test.tsx`：ChatTab 空态/加载态/错误态/会话切换受控渲染

### 5.2 集成（tests/integration/）
- `session-rename-export-handlers.test.ts`：真实装配 createAgentHost（复用 host-rpc.test.ts makeSimulatedApp 夹具）→ sessions.rename 往返 → sessions.export 往返（返回 path 存在 + 文件内容脱敏断言）
- `session-sidebar-rpc.test.ts`：sessions.list/search → SessionSidebar 数据流

### 5.3 安全不变量
- export 文件内容不含完整 UUID/API key/学生资料原文（静态 + 集成断言）
- 既有 6 条不变量无回归

### 5.4 基线
- 当前 939 单件/集成 + 83 E2E + smoke 6/6 + verify 全绿，新增不得破坏

## 六、质量门（全绿才可收尾）

```bash
pnpm type-check && pnpm build && pnpm test && pnpm test:e2e && pnpm smoke
pnpm verify
node scripts/check-docs-governance.mjs
node scripts/check-contract-coverage.mjs
node scripts/check-desktop-security.mjs
node scripts/check-uuid-leak.mjs
```

## 七、收尾纪律（AGENTS.md §7）

- 完成后：更新 04-Todo（T-M3-006 done + §9 统计 M3 done 5→6）+ 00-索引 + AGENTS.md §3.1/§12 版本号同步 + 创建 `.record/T-M3-006-实施记录.md`（8 章节）
- 契约无新增（rename/export 已定义）→ 06-API spec 如需落地方言注解（export 落点）经用户批准后修订
- 不自动提交/推送：需用户明确授权后显式 git add + ff-only 合并 + 推送 origin/master
- 不替用户预选下一任务（T-M3-007）；完成后停止等待指示

## 八、16 步执行跟踪

- [x] 步骤 1：读文档、定边界（AGENTS.md/00-索引/04-Todo/09-UI/06-API/07-WF/03-Arch/08-Test + 代码现状）
- [x] 步骤 2：检查文档门禁（T-M3-005 收尾完成 ✅ + 用户批准 ✅ + .plan 无其他执行中任务 ✅）
- [x] 步骤 3：编写 .plan/ 计划（本文件定稿）+ 五裁决定案（§5）
- [ ] 步骤 4：独立审查计划
- [ ] 步骤 5：用户批准计划（用户已确认开工 Prompt + 五裁决推荐方案）
- [ ] 步骤 6：拆分任务、逐项实现（session-store → handlers → contract types → SessionSidebar → AppShell/ChatTab）
- [ ] 步骤 7：编写/更新测试（TDD：RED → GREEN）
- [ ] 步骤 8：type-check（零错误零警告）
- [ ] 步骤 9：build（无错误）
- [ ] 步骤 10：test（全绿无 skip）
- [ ] 步骤 11：smoke / E2E / 专项脚本全过
- [ ] 步骤 12：独立审查并修复
- [ ] 步骤 13：更新 04-Todo（T-M3-006 done）+ 00-索引 + AGENTS.md + 实施记录
- [ ] 步骤 14：文档治理检查
- [ ] 步骤 15：diff 检查（git diff --check，无意外文件）
- [ ] 步骤 16：提交交付（★ 待用户授权）

## 审查记录（步骤 4）

- 2026-08-08 初稿审查：
  - 范围：SessionSidebar 全功能（日期分组/搜索/unread/学科颜色/新建/操作菜单）+ rename/export handler 补齐 + 会话切换 + ChatTab 业务态。与 06-API §3.1"rename/export handler 归 T-M3-006"逐字对齐。✅
  - 裁决：① export 落点 runs 测试隔离目录（不进业务数据根）② 新建会话=内存仓库空白会话+立即当前会话 ③ unread 加可选字段 fixture 演示值 ④ backup_* 维持不渲染跳转按钮留 T-M3-008 ⑤ 选中会话 AppShell 提升。均按推荐方案，无 supersedes 需求。✅
  - 红线：不读 ~/.pi、导出脱敏、handler 过契约校验、静态渲染不引入 jsdom。✅
  - 无违反 AGENTS.md §4-§9 条款。✅
- 结论：通过，进入步骤 6。
