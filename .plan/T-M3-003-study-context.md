# T-M3-003 执行计划：学习场景业务化（学科标签/学习目标/错题关联/L1 画像注入/L3 会话检索）

> 状态：📝 草案（待用户批准，批准后登记 04-Todo in_progress 方可开工）
> 日期：2026-08-08
> 里程碑：M3 对话与打磨（done 2/8：T-M3-001/002）
> 任务：T-M3-003 学习场景业务化
> 前置依赖：T-M3-001（对话 Tab）+ T-M3-002（pi 原生能力承载）均已 done

---

## 一、任务目标与权威条款

### 1.1 权威条款

| 条款 | 要点 |
|---|---|
| 09-UI §4.2 | 对话 Tab 头部 `💬 学习对话 \| 📐 高数 \| 目标：极限练习 \| 关联错题：#极限-001`；输入区 `[📎 @文件] [📐 学科] [输入消息...] [发送]`；E2E-10 断言"会话标题栏显示学科标签（L1 画像注入）" |
| 03-Arch §6.7 + §2.3 | 会话管理业务化（学科标签/学习目标/错题关联）；钩子清单：`before_agent_start` 多源上下文注入、`turn_end` L3 增量索引（归 T-M3-005） |
| 05-ERD §4.1 | L1 learner-profile.json：`learning_preferences.preferred_subjects` + `goals: []` 现成字段（version "1.0"） |
| 05-ERD §4.3 | L3 conversation.sqlite：chunks 表 + chunks_fts（FTS5/unicode61，bigram 由应用层实现）；查询 OR-combined MATCH；bigram 示例「学习计划→学习/习计/计划」「practice→practice」 |
| 06-API §3.1 | `sessions.search { query } → SessionSummary[]` 契约已定义无 handler；`sessions.rename/export` 契约已定义（归 T-M3-006） |
| 07-WF §2.8 | 通用 AI 对话路径：学生问错题 → @引用错题 ID → AI 读取 S4 错题上下文；会话可检索：L3 FTS5 bigram 索引对话内容 |
| 08-Test §4.2 | 钩子集成断言：`before_agent_start` 注入 L1 画像 + 当前学期/课程上下文；`turn_end` L3 增量索引（归 T-M3-005） |

### 1.2 任务目标

在 T-M3-001/002 对话承载之上实现 09-UI §4.2 "学习场景业务化" 五大承载点：

1. **学科标签**：ChatTab 输入区学科选择（颜色标识），影响 agent.send 上下文
2. **学习目标**：会话可设目标（"极限练习"），注入上下文影响工具调用偏好
3. **错题关联**：会话关联错题 ID（S4 跳转语义），AI 可读错题上下文
4. **L1 画像注入扩展**：context-pack.ts 增补学科/目标/错题上下文段
5. **L3 会话检索承载层**：bigram 分词 + chunks_fts 写入 + MATCH 检索 + sessions.search handler（**边界按裁决：承载层归本任务，turn_end 钩子接线归 T-M3-005**）

---

## 二、范围与非目标

### 2.1 做（本任务）

- ChatTab 学科标签/学习目标/错题关联 UI（头部语义 + 输入区控件）
- context-pack 上下文段扩展（学科/目标/错题注入 before_agent_start）
- L3 承载层：bigram 分词器（纯函数）+ chunks 写入 + OR-combined MATCH 检索 + `sessions.search` handler
- L1 画像写回（学科偏好/目标持久化到 learner-profile.json，业务数据根内，原子写）
- 会话级元数据（subject/goal/mistakeIds）承载（session-store Session 扩展）
- 相应单件/集成测试（08-Test §1.3 证据链 + 数据隔离）

### 2.2 不做（留 T-M3-004~008）

- turn_end/model_select 钩子接线 + L3 增量索引触发（**T-M3-005**，本任务只交付承载层可独立调用）
- AI 自主调用全部工具 + 跳转结构化 Tab（T-M3-004）
- 会话管理完整 UI + sessions.rename/export（T-M3-006）
- E2E-10~13（T-M3-007/008）
- 不连真实 LLM（08-Test §5.4 全 mock；agent.send 受控夹具）
- 不修改 pi 底座内核、不引入新运行时依赖（node:sqlite 现成，Node≥22.5）
- 不新增业务数据表（学科/目标写 L1 JSON；错题关联用会话级元数据；L3 用现成 chunks schema）

### 2.3 红线

- 不读真实 `~/.pi/agent`（§9.5 物理隔离）
- 学科/目标/错题内容属学生资料，**默认敏感不落日志**（§9.3）；错题正文不进 S6 报告（S4 已约束）
- L3 索引**不索引完整 UUID**（check-uuid-leak 7/7 基线不可破）
- 测试写 `H:\pi-studybuddy-tmp\runs\T-M3-003\`，绝不污染 `%LOCALAPPDATA%\PiStudyBuddy`

---

## 三、工程概况（已核实时点：2026-08-08）

- **T-M3-001/002 现状**：ChatTab（欢迎语/消息流/工具卡片/压缩条/模型选择器/@文件引用/会话列表）+ agent.send 受控发射（message_start → token×2 → [tool_call→tool_result] → token×N → context_compressed，触发词「出题/笔记/朗读」）+ sessions.* 内存仓库（list/get/delete/context）+ AgentEvent payload 结构化（tool_call/tool_result 脱敏载荷）
- **L3 承载层现状**：`src/data/schema/conversation.sql.ts` 已含 chunks + chunks_fts DDL（`tokenize='unicode61'`，bigram 由应用层实现）；**bigram 分词器/写入/检索全仓零实现**（grep 确认）；`sessions.search` 契约已定义（api.ts:70）**无 handler**（handlers/sessions.ts 仅 4 项）
- **L1 现状**：`src/data/memory.ts` DEFAULT_PROFILE 含 `learning_preferences.preferred_subjects: []` + `goals: []`（version "1.0"）；`src/agent/context-pack.ts` 已注入 L1 画像/当前学期/最近事件三段，**无学科/目标/错题段**
- **mistakes 现成**：`mistakes.get(id)` → MistakeWithEvidence（api.ts:221 + s4/mistakes.ts:112 handler 已实现）——错题关联注入用现成 handler 不重写
- **session-store 现状**：内存仓库 SessionSummary { id, name, updatedAt, preview }，无 subject/goal/mistakeIds 字段
- **数据库范式**：`src/data/sqlite.ts` DatabaseSync + db.ts applyPragmas（WAL/busy_timeout 等）——L3 承载层复用此范式
- **参考范式**（只参考不复制）：inno-agent `src/memory/l3/`（sqlite-store.ts 基于 node:sqlite，03-Arch §4.2 借鉴来源）——主仓独立实现

---

## 四、接口设计

### 4.1 L3 承载层（src/data/l3/ 新建，纯模块无钩子依赖）

```
src/data/l3/
  ├─ bigram.ts      # 分词器（纯函数）
  ├─ indexer.ts     # chunks 写入（应用层 bigram 后写 chunks_fts）
  └─ search.ts      # OR-combined MATCH 检索
```

**bigram 分词器**（纯函数，05-ERD §4.3 语义）：

```ts
export function tokenizeBigram(text: string): string[]
// CJK 段切 bigram："学习计划" → ["学习", "习计", "计划"]
// ASCII 段整词小写："practice" → ["practice"]
// 混合："极限ε-δ练习" → CJK bigram + ASCII 词混合 token
// 过滤：完整 UUID 不索引（/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i 命中的 token 丢弃）、空 token 丢弃
export function buildMatchQuery(tokens: string[]): string
// OR-combined MATCH："学习 OR 习计 OR 计划"（FTS5 语法）
```

**indexer.ts**：

```ts
export interface ChunkInput {
  id: string; session_id: string; content: string; role: "user" | "assistant" | "tool";
  source_type?: string; created_at: string; last_offset: number; last_mtime_ms: number;
}
export function openConversationDb(dbPath: string): DataDb   // applyPragmas + CREATE TABLE IF NOT EXISTS（复用 CONVERSATION_SCHEMA_SQL）
export function insertChunk(db: DataDb, chunk: ChunkInput): void
// chunks 行写入 + bigram tokens 写入 chunks_fts（content='chunks' 外部内容表 + tokenize='unicode61'，
// 应用层 bigram：将 tokens 以空格 join 写回 chunks_fts.content 列，05-ERD §4.3 "bigram 分词由应用层实现（CJK 切 bigram），写入 chunks_fts"）
```

**search.ts**：

```ts
export function searchChunks(db: DataDb, query: string, limit?: number): ChunkHit[]
// tokenizeBigram(query) → buildMatchQuery → SELECT session_id, content, role, created_at FROM chunks_fts WHERE chunks_fts MATCH ?
// 返回命中（按 session_id 去重聚合，取最近 3 条 content 摘要）
```

### 4.2 sessions.search handler（handlers/sessions.ts 扩展）

- 新增 `sessions.search: ({ query }) => SessionSummary[]`：L3 检索（`%LOCALAPPDATA%\PiStudyBuddy\memory\l3\conversation.sqlite`）→ 命中 session_id 与内存仓库 SessionSummary 映射（缺失则用检索库中最近内容生成摘要条目）
- 不实现 rename/export（归 T-M3-006）
- 06-API §3.1 契约已有，**不改 spec**（check-contract-coverage 通过即证明契约落地）

### 4.3 会话级元数据（session-store.ts 扩展 + contract types）

- `SessionSummary` 扩展可选字段：`subject?: string; goal?: string; mistakeIds?: string[]`（06-API §3.1 SessionSummary 已有 id/name/updatedAt/preview——**契约不新增方法**，仅类型扩展 + 06-API §3.1 说明性注解，用户已裁决）
- 内存仓库增 `updateMeta(id, meta)` 内部方法（新 RPC 方法？**否**——meta 写入走现成 `agent.send` 参数携带 + ChatTab 本地 state；持久化属 T-M3-006 会话管理）

### 4.4 L1 画像写回（src/data/memory.ts 扩展 或 src/agent/l1-profile.ts 新建）

```ts
export function updateLearnerProfile(dataRoot: string, patch: {
  preferred_subjects?: string[]; goals?: string[];
}): void
// 读 learner-profile.json → 合并 patch → 原子写（tmp + rename，单写进程 OK）
// 结构不变（05-ERD §4.1 version "1.0"），仅 preferred_subjects / goals 更新
// 调用点：学科选择 / 目标设置时（ChatTab → agent-host → 写回）
```

### 4.5 context-pack 扩展（src/agent/context-pack.ts）

- 在现有 L1/学期/事件三段之上增补：
  - `【当前学科】<subject>（对话级）`——来自 agent.send 上下文参数
  - `【学习目标】<goal>`——来自 L1 goals 最新一项 + agent.send 上下文参数
  - `【关联错题】<mistakeId>：<错因摘要>`——mistakes.get 读取（现成 handler），只注入错因分类/知识模块摘要，**不注入完整题干/答案/证据**（§9.3 + S4 约束）
- 缺失任一来源跳过对应段（不阻塞 agent 启动，延续现有容错语义）
- 注入方式：`buildStudyContextSections` 签名扩展 `(opts: { dataRoot; sessionMeta?; })`，错题读取经注入的 handler 或查找器（可测试）

### 4.6 ChatTab 业务化 UI（renderer/components/tabs/ChatTab.tsx）

```
头部信息条（09-UI §4.2 语义）：
  📐 学科选择（下拉：数学/物理/化学/英语/语文… 颜色标识 chip）
  目标设置（输入/选择："极限练习" 等，显示 目标：<goal>）
  关联错题（选择器：mistakes.list 数据源 → 显示 #<错题名> chip，可移除）

输入区（09-UI §4.2）：
  [📎 @文件] [📐 学科] [输入消息...] [发送]  ← 学科选择器并入输入区 + 头部信息条展示选中态

agent.send 扩展：
  参数携带 sessionMeta: { subject, goal, mistakeIds } → agent-host 受控发射时注入上下文段
```

- 渲染前 UUID 二次脱敏（延续 T-M3-002 既有铁律）

---

## 五、测试策略（TDD，08-Test §1.3 证据链）

### 5.1 单件（tests/unit/）

- `l3-bigram.test.ts`：`tokenizeBigram("学习计划") → ["学习","习计","计划"]`；`tokenizeBigram("practice") → ["practice"]`；混合文本；**完整 UUID 不产出 token**（泄漏基线）
- `l3-indexer.test.ts`：临时目录 fixture → insertChunk → chunks 行 + chunks_fts 有记录（content 含 bigram tokens）
- `l3-search.test.ts`：写入「学习计划/极限/导数」fixture → `searchChunks("极限")` 命中 → OR-combined 多词命中；无命中返回空
- `l1-profile-write.test.ts`：updateLearnerProfile 写回断言（preferred_subjects/goals 更新 + version 不变 + 原子写无残留 tmp）
- `context-pack-ext.test.ts`：sessionMeta 注入断言（学科段/目标段/错题摘要段出现；缺失来源跳过；错题只含摘要不含题干）
- `renderer-chat-tab-meta.test.ts`：学科选择/目标设置/错题 chip 静态渲染（renderToStaticMarkup）+ agent.send 参数携带 sessionMeta 断言

### 5.2 集成（tests/integration/）

- `sessions-search-rpc.test.ts`：L3 fixture 库（临时目录）→ sessions.search("极限") RPC 往返 → SessionSummary[] 断言
- `agent-send-meta-rpc.test.ts`：agent.send 带 sessionMeta → 受控发射参数断言（上下文段注入）

### 5.3 安全不变量（08-Test §5.7 + §1.3）

- L3 索引无完整 UUID（tokenizeBigram 过滤 + search 结果扫描）
- 学科/目标/错题内容不落日志（L3 content 写入是业务数据非日志；断言无 console/logger 调用）
- 错题注入只含摘要不含题干/答案/证据（context-pack 断言）
- AI 解读明确标注（🤖 标识保持）
- 数据隔离：测试写 `H:\pi-studybuddy-tmp\runs\T-M3-003\`（L3 库用临时目录 fixture）

### 5.4 基线

- 当前：type-check + 856 单元/集成测试 + 83 E2E + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6 + UUID 泄漏 7/7（新增不得破坏）

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
node scripts/check-contract-coverage.mjs   # sessions.search 现成契约落地，无需改 spec
node scripts/check-desktop-security.mjs
node scripts/check-uuid-leak.mjs
```

---

## 七、收尾纪律（AGENTS.md §7）

1. 复验测试 + 最小端到端路径
2. 更新 04-Todo：T-M3-003 done（事实 + 提交号；不预选下一任务）
3. 创建 `.record/T-M3-003-实施记录.md`（8 章节）
4. API 契约若变化 → 同步 06-API（本任务预计仅 §3.1 说明性注解，无方法变更）
5. 计划/看板标明完成；保留计划原件作为历史验收证据
6. 文档治理检查
7. 停止报告，等待用户指示
- L3 边界裁决（承载层/钩子接线）显式记录决策，不删历史

## 八、16 步执行跟踪

| 步骤 | 内容 | 状态 |
|---|---|---|
| 1 | 核实权威条款 + 五前置确认（L3 边界/sessions.search 落点/L1 写回/错题形态/bigram 边界） | ✅ 已完成并裁决 |
| 2 | 起草本计划 | ✅ 待批准 |
| 3 | 用户批准 → 04-Todo 登记 in_progress | ⏳ |
| 4 | 设计审查（交叉审查） | ⬜ |
| 5-7 | TDD：RED 测试先行（L3 承载层 → L1 写回 → context-pack） | ⬜ |
| 8-10 | GREEN 最小实现 + REFACTOR | ⬜ |
| 11 | ChatTab UI（学科/目标/错题） | ⬜ |
| 12 | 集成测试（sessions.search RPC + agent.send meta） | ⬜ |
| 13 | 质量门全跑 | ⬜ |
| 14 | 04-Todo + 00-索引 + AGENTS.md §3.1/§12 同步 | ⬜ |
| 15 | .record 实施记录（8 章节） | ⬜ |
| 16 | 提交交付（★ 待用户授权后 git add 显式路径 + commit + merge + push） | ⬜ |

---

## 审查记录（步骤 4）

- 待批准后填写（≥2 独立审查者交叉核对，§11.4 元纪律——本任务为里程碑中途任务，非里程碑门禁，采用"计划自审 + 用户批准"双人核对）

## 步骤 12 审查记录（实施后独立审查）

- 待实施后填写
