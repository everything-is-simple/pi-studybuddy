# T-M3-005 执行计划：model_select / turn_end 钩子（多模型持久化 + L3 增量索引）

> 状态：📝 草案（待用户批准，批准后登记 04-Todo in_progress 方可开工）
> 日期：2026-08-08
> 里程碑：M3 对话与打磨（done 4/8：T-M3-001/002/003/004）
> 任务：T-M3-005 model_select / turn_end 钩子（多模型持久化 + L3 增量索引）
> 前置依赖：T-M3-001 done（04-Todo §7.5 第 15 行）；承载层由 T-M3-002/T-M3-003 移交

---

## 一、任务目标与权威条款

### 1.1 权威条款

| 条款 | 要点 |
|---|---|
| 03-Arch §2.3 钩子表 | `model_select`：持久化默认模型（`__studybuddy_managed` 标记）；`turn_end`：L3 增量索引（基于 last_offset + last_mtime_ms） |
| 05-ERD §4.3 L3 会话检索 | chunks + chunks_fts（FTS5 unicode61 + 应用层 bigram）；session_id 引用 pi 会话 id；对话内容经 turn_end 钩子增量索引；增量键 last_offset + last_mtime_ms |
| 08-Test §4.2 钩子集成断言 | `model_select` → 持久化默认模型（managed 标记）；`turn_end` → L3 增量索引（断言 chunks_fts 有记录） |
| 06-API §3.13 models.* 契约 | `modelsConfig.get/set/test`、`models.addProvider`、`models.probe` 已定义契约但无 handler；`models.list` 约束列原文"从 ~/.pi/agent/models.json"（与 §9.5 冲突，T-M3-002 裁决用受控 fixture） |
| 09-UI §9.2 + §4.2 | 模型供应商配置 / 多模型切换：模型选择持久化；ChatTab 模型选择器当前 useState 本地态不落库 |
| AGENTS.md §9.5 | pi 会话目录 `~/.pi` 与业务数据根 `%LOCALAPPDATA%\PiStudyBuddy` 物理隔离，pi-studybuddy 不侵入 `~/.pi`（优先级 2 安全约束，不可被下游文档覆盖） |

### 1.2 核心冲突（★ 四文档 vs §9.5）

03-Arch §2.3 / 08-Test §4.2 / 06-API §3.13 / 09-UI §9.2 四处权威条款均写"模型配置持久化到 `~/.pi/agent/models.json`"，但 AGENTS.md §9.5（优先级 2）禁止侵入 `~/.pi`。本任务通过裁决 1 解决此冲突（落点改到业务数据根 + 四文档加 supersedes）。

### 1.3 任务目标

补全 03-Arch §2.3 钩子表中尚未注册的 2 个 pi.on 钩子，并让 ChatTab 模型选择器落库：

1. **model_select 钩子**：持久化学生选择的默认模型到业务数据根 config/models.json（managed 标记 + 原子写）
2. **turn_end 钩子**：L3 会话检索增量索引（assistant + tool 消息 → chunks/chunks_fts，基于 max(last_offset) 增量）
3. **modelsConfig.get/set handler**：RPC 面落库读写（共用 model-config 模块）
4. **ChatTab 模型选择器落库**：挂载时 get 回填 + 切换时 set 落库
5. **四文档 supersedes**：03-Arch §2.3 + 08-Test §4.2 + 06-API §3.13 + 09-UI §9.2/§4.2 落点修订

---

## 二、范围与非目标

### 2.1 做（本任务）

- **model-config 模块**（新文件 `src/agent/model-config.ts`）：readModelConfig / writeModelConfig（原子写 + __studybuddy_managed 标记 + 路径 `<dataRoot>/config/models.json`）
- **扩展层 2 钩子注册**（修改 `src/agent/studybuddy-extension.ts`）：
  - `pi.on("model_select")`：event.model → writeModelConfig
  - `pi.on("turn_end")`：event.message（assistant）+ event.toolResults（tool）→ insertChunk 增量写入
- **agent-host 2 handler**（修改 `src/agent-host/handlers/models.ts`）：modelsConfig.get（readModelConfig）+ modelsConfig.set（writeModelConfig）
- **ChatTab 模型选择器落库**（修改 `src/renderer/components/tabs/ChatTab.tsx`）：挂载 useEffect 调 modelsConfig.get 回填 selectedModel + onChange 调 modelsConfig.set 落库
- **四文档 supersedes 修订**：03-Arch §2.3 + 08-Test §4.2 + 06-API §3.13 + 09-UI §9.2/§4.2 落点改业务数据根
- **相应单件/集成测试**（08-Test §1.3 证据链 + 数据隔离）

### 2.2 不做（留后续）

- **modelsConfig.test / models.addProvider / models.probe**：留后续任务，避免范围膨胀（裁决 3）
- **user 消息入 L3 索引**：turn_end 事件不携带 user message，留 E2E-13（T-M3-007）或后续评估（裁决 2）
- **E2E-10~13**：归 T-M3-007/008
- **真实 LLM 调用 / 真实模型服务连通**：08-Test §5.4 全 mock，测试只 stub pi 事件
- **会话管理完整 UI**：归 T-M3-006
- 不修改 pi 底座内核、不新增运行时依赖

### 2.3 红线

- **不侵入 `~/.pi`**（AGENTS.md §9.5）；不读真实模型配置/会话文件
- 模型配置不含 apiKey/baseUrl（密钥只存 credential-vault，02-PRD §5.2）；models.list fixture 仅别名，真实 key 值不写入仓库/计划/记录/记忆/config/fixture（裁决 5）
- 日志脱敏：不记录请求正文/完整输出/完整 UUID（§9.3）；L3 索引复用 bigram 的 UUID 剥离
- 测试写 `H:\pi-studybuddy-tmp\runs\T-M3-005\`，绝不污染真实业务数据根
- UUID 泄漏检测 7/7 基线不可破；安全不变量 6/6 不可破
- 不自动提交/推送/合并；收尾走 AGENTS.md §7 受控流程

---

## 三、工程概况（已核实时点：2026-08-08）

### 3.1 质量门基线

- 925 单元/集成测试 + 83 E2E 全绿；verify 全绿；契约覆盖 127 handlers；安全不变量 6/6；UUID 泄漏 7/7
- master = 6c9fa0c，origin/master 已同步（T-M3-004 已完成推送）

### 3.2 扩展层已注册 4 钩子（缺 model_select / turn_end）

`src/agent/studybuddy-extension.ts`：
- before_agent_start（多源上下文注入）
- session_start（initMemoryL1）
- tool_call（workspace-path-guard）
- tool_result（observability）

### 3.3 L3 承载层已就绪（缺增量接线）

`src/data/l3/`：
- `bigram.ts`：tokenizeBigram / buildMatchQuery（CJK bigram + ASCII 整词小写 + 完整 UUID 剥离）
- `indexer.ts`：openConversationDb（幂等建表）/ insertChunk（chunks 行 + chunks_fts token 写入）/ openConversationDbAt
- `search.ts`：searchChunks（OR-combined MATCH）+ aggregateBySession
- `src/data/schema/conversation.sql.ts`：chunks（含 last_offset / last_mtime_ms 列）+ chunks_fts DDL
- 测试：`tests/unit/l3-bigram.test.ts` + `tests/unit/l3-indexer-search.test.ts`
- **注意**：insertChunk 是纯追加，无增量逻辑——增量（按 session 查 max(last_offset) 只写新增）是本任务要补的钩子接线

### 3.4 models 现状

`src/agent-host/handlers/models.ts`：
- `models.list` 返回受控 fixture（local: deepseek-r1/qwen2.5 + cloud: gpt-5/claude-sonnet-4，无 apiKey/baseUrl）
- modelsConfig.get/set/test、models.addProvider、models.probe **未注册 handler**（契约校验对无 handler 方法仅 WARN）
- 边界裁决注释明确："真实模型配置读取 + model_select 钩子业务逻辑属 T-M3-005"
- **本次用户提供真实模型配置（2026-08-08）**，经授权纳入 provider/model 别名（见 §4 裁决 5）：
  - **多媒体（agnes）**：provider id `agnes`，baseUrl `https://apihub.agnes-ai.com/v1`，模型 `agnes-2.5-flash` / `agnes-2.5-pro` / `agnes-image-2.1-flash` / `agnes-video-v2.0`
  - **文字（deepseek）**：provider id `deepseek`，baseUrl `https://api.deepseek.com`，模型 `DeepSeek V4 Flash` / `DeepSeek V4 Pro`

### 3.4.1 credential-vault 键名规范（key 入 vault 依据）

`src/main/credential-vault.ts`（已核实）：
- 键名严格校验：`/^(modelProvider|parentContact):[a-z0-9._-]{1,160}$/i`
- RPC：`credentials.set/get/delete/listKeys`（DPAPI via safeStorage）
- **模型 provider API key 只存 vault**，键名 `modelProvider:<provider>`（如 `modelProvider:agnes` / `modelProvider:deepseek`）
- config/models.json **不含 key/baseUrl**（02-PRD §5.2）；baseUrl 归 provider 配置，本任务 fixtures 保留别名语义

### 3.5 ChatTab 模型选择器现状

`src/renderer/components/tabs/ChatTab.tsx`：
- 行 157 `useState(initialModelId ?? "")` 本地态
- 行 247-255 models.list 加载
- 行 384-385 `<select>` onChange 仅 `setSelectedModel(e.target.value)` —— **切换不落库**

### 3.6 pi 底座事件类型（只读参考，已核实）

`H:\pi-references\pi\packages\coding-agent\src\core\extensions\types.ts`：
- `ModelSelectEvent`：`{ type: "model_select", model: Model<any>, previousModel: Model<any> | undefined, source: "set"|"cycle"|"restore" }`
  - Model 有 provider/id/name/baseUrl/cost 等
- `TurnEndEvent`：`{ type: "turn_end", turnIndex: number, message: AgentMessage, toolResults: ToolResultMessage[] }`
- inno-agent 参考：model_select 写 config（setDefaultModel）；turn_end 用 `ctx.sessionManager.getSessionFile()` 全量 indexById —— **本任务不采用**（不读 ~/.pi 会话文件，裁决 2）

### 3.7 钩子测试范式

`tests/integration/cross-cutting-hooks.test.ts`：createStubPi 收集 handlers；`PI_STUDYBUDDY_DATA_ROOT` 指向 `H:\pi-studybuddy-tmp\runs\T-M3-005\` 隔离目录

### 3.8 已有裁决与移交边界（前序任务登记，勿违反）

1. **T-M3-002 裁决**：models.list 用受控 fixture，不读真实 ~/.pi/agent/models.json；"真实模型配置读取 + model_select 钩子业务逻辑属 T-M3-005"
2. **T-M3-003 裁决①**：承载层归 T-M3-003，turn_end 钩子接线归 T-M3-005（无 supersedes）
3. **T-M3-003 裁决⑤**：bigram CJK bigram + ASCII 整词小写，完整 UUID 不索引（已实现于承载层，钩子复用）

---

## 四、四裁决定案（用户 2026-08-08 批准）

### 裁决 1（落点）：业务数据根 config/models.json ✅

- 默认模型持久化到 `<dataRoot>/config/models.json`（`%LOCALAPPDATA%\PiStudyBuddy\config\models.json`）
- 含 `__studybuddy_managed` 标记，原子写（tmp + rename）
- 测试走 `PI_STUDYBUDDY_DATA_ROOT` 环境变量隔离到 `H:\pi-studybuddy-tmp\runs\T-M3-005\`
- **同步修订 4 文档**（显式 supersedes 记录，版本号递增）：
  - 03-Arch §2.3 钩子表 model_select 行：`~/.pi/agent/models.json` → `<dataRoot>/config/models.json`
  - 08-Test §4.2 断言表：落点同步
  - 06-API §3.13：models.list 约束列 + modelsConfig.set 约束列落点同步
  - 09-UI §9.2 + §4.2：持久化路径同步

### 裁决 2（turn_end 数据源）：assistant + tool，不读 ~/.pi ✅

- turn_end 只索引事件携带内容：
  - `event.message`（assistant）→ role: assistant, source_type: message
  - `event.toolResults`（tool）→ role: tool, source_type: tool_result
- **不读 ~/.pi 会话文件**（§9.5）
- user 消息入索引留待 E2E-13（T-M3-007）或后续任务按需评估
- chunk id 复合键 `sessionId:turnIndex:role:seq` 保证幂等
- 增量：取该 session 现有 `max(last_offset)`，只写 offset > max 的新增 chunk

### 裁决 3（modelsConfig.* 范围）：get/set 两个 ✅

- 本任务实现 `modelsConfig.get/set` 两个 handler：
  - get：返回默认 provider/model（readModelConfig）
  - set：原子写 config/models.json + managed 标记（writeModelConfig），返回写入后的 config
- ChatTab 挂载时 get 回填选中态、切换时 set 落库
- `modelsConfig.test / models.addProvider / models.probe` 留待后续，避免范围膨胀

### 裁决 4（扩展层 vs agent-host 分工）：各自写同一文件，共用模块 ✅

- 扩展层 `pi.on("model_select")` 与 agent-host `modelsConfig.set` 各自写同一配置文件
- 共用 `src/agent/model-config.ts` 模块（readModelConfig / writeModelConfig）
- 单写进程下无并发问题（AGENTS.md §1.1 单写进程）
- 扩展层钩子测试用 stub 事件断言写文件

### 裁决 5（真实模型配置纳入 — 用户 2026-08-08 批准）：仅纳别名入 config，key 入 vault ✅

用户在 T-M3-005 开工准备阶段提供真实模型配置（agnes 多媒体 + deepseek 文字），经授权处理如下：

- **config/models.json 仅存 provider/model 别名**（managed 标记 + 原子写），**不含 apiKey/baseUrl**（02-PRD §5.2 密钥边界）
- **API key 只存 credential-vault**（DPAPI via safeStorage），键名规范 `modelProvider:<provider>`（如 `modelProvider:agnes` / `modelProvider:deepseek`），运行时通过 `credentials.set` RPC 写入（T-M3-005 代码交付物不含 key，vault 写入不属本任务代码范围）
- **models.list fixture 更新**为纳入 agnes（多媒体）+ deepseek（文字）两组真实 provider 别名（仍受控 fixture，无 apiKey/baseUrl）
- **真实 key 值不写入**：仓库、.plan 计划、.record、聊天记忆、config/models.json、fixture 均不含 key 明文
- 默认选中：deepseek/DeepSeek V4 Flash（文字主模型，或按用户后续调整）

---

## 五、实施计划

### 5.1 文件清单

**新增（2 文件）**：
- `src/agent/model-config.ts` — readModelConfig / writeModelConfig 模块
- `tests/unit/model-config.test.ts` — read/write 原子性 + managed 标记 + 不存在返回 null + 路径隔离

**修改（5 文件）**：
- `src/agent/studybuddy-extension.ts` — +2 钩子注册（model_select / turn_end）
- `src/agent-host/handlers/models.ts` — +2 handler（modelsConfig.get/set）
- `src/renderer/components/tabs/ChatTab.tsx` — 模型选择器落库（get 回填 + set 落库）
- `tests/integration/cross-cutting-hooks.test.ts` — +2 钩子断言（model_select 写文件 / turn_end 增量索引）
- `tests/integration/models-config-handlers.test.ts`（新文件）或扩展既有 — modelsConfig.get/set handler 测试

**文档修订（4 文档 supersedes）**：
- `docs/03-架构设计-Architecture-Design.md` §2.3
- `docs/08-测试验收-Test-Plan.md` §4.2
- `docs/06-API契约-API-Contracts.md` §3.13
- `docs/09-使用者介面-UI-Design.md` §9.2 + §4.2

### 5.2 model-config 模块设计

```typescript
// src/agent/model-config.ts
// 仅存 provider/model 别名（02-PRD §5.2 密钥边界）：API key 在 credential-vault（modelProvider:<provider>），
// baseUrl 归 provider 配置；本文件不含 key/baseUrl 明文。
export interface ModelConfig {
  provider: string;
  model: string;
  __studybuddy_managed?: boolean;
  updatedAt?: string; // ISO 时间戳
}

export function readModelConfig(dataRoot: string): ModelConfig | null {
  // 读 <dataRoot>/config/models.json，不存在返回 null
}

export function writeModelConfig(dataRoot: string, config: ModelConfig): void {
  // 原子写：tmp 文件 + rename + __studybuddy_managed: true + updatedAt
}
```

**models.list fixture 更新（裁决 5）**：纳入两组真实 provider 别名（仍无 apiKey/baseUrl）：

```typescript
// src/agent-host/handlers/models.ts  MODEL_FIXTURE
[
  {
    id: "deepseek",
    name: "DeepSeek 文字模型",
    providerType: "openai-compatible",
    models: [
      { id: "DeepSeek V4 Flash", name: "DeepSeek V4 Flash" },
      { id: "DeepSeek V4 Pro", name: "DeepSeek V4 Pro" },
    ],
  },
  {
    id: "agnes",
    name: "Agnes 多媒体模型",
    providerType: "openai-compatible",
    models: [
      { id: "agnes-2.5-flash", name: "Agnes 2.5 Flash" },
      { id: "agnes-2.5-pro", name: "Agnes 2.5 Pro" },
      { id: "agnes-image-2.1-flash", name: "Agnes Image 2.1 Flash" },
      { id: "agnes-video-v2.0", name: "Agnes Video 2.0" },
    ],
  },
]
```

### 5.3 turn_end 钩子增量逻辑

```typescript
pi.on("turn_end", (event) => {
  const db = openConversationDbAt(dataRoot);
  const sessionId = getCurrentSessionId(); // 从扩展上下文或事件推断
  const turnIndex = event.turnIndex;

  // 增量：查 max(last_offset) where session_id = ?
  const maxOffset = db.db
    .prepare("SELECT COALESCE(MAX(last_offset), -1) AS m FROM chunks WHERE session_id = ?")
    .get(sessionId).m;

  const offsetBase = maxOffset + 1;
  let seq = 0;

  // assistant message → chunk
  if (event.message) {
    const chunkId = `${sessionId}:${turnIndex}:assistant:${seq}`;
    insertChunk(db, {
      id: chunkId,
      session_id: sessionId,
      content: extractText(event.message), // 复用已有脱敏 + UUID 剥离
      role: "assistant",
      source_type: "message",
      created_at: new Date().toISOString(),
      last_offset: offsetBase,
      last_mtime_ms: Date.now(),
    });
    seq++;
  }

  // toolResults → chunks
  for (const tr of event.toolResults ?? []) {
    const chunkId = `${sessionId}:${turnIndex}:tool:${seq}`;
    insertChunk(db, {
      id: chunkId,
      session_id: sessionId,
      content: extractToolText(tr),
      role: "tool",
      source_type: "tool_result",
      created_at: new Date().toISOString(),
      last_offset: offsetBase + seq,
      last_mtime_ms: Date.now(),
    });
    seq++;
  }
});
```

### 5.4 测试策略（TDD：RED → GREEN → REFACTOR）

**单件测试**：
- `tests/unit/model-config.test.ts`：
  - readModelConfig 不存在文件返回 null
  - writeModelConfig 原子写（tmp + rename）+ __studybuddy_managed 标记
  - writeModelConfig + readModelConfig 往返一致
  - 路径隔离（PI_STUDYBUDDY_DATA_ROOT 指向 runs/T-M3-005/）

**集成测试**：
- `tests/integration/cross-cutting-hooks.test.ts` 扩展：
  - model_select stub 事件 → 断言 config/models.json 写入 + managed 标记 + provider/model 正确
  - turn_end stub 事件（assistant message + toolResults）→ 断言 chunks 行写入 + chunks_fts 有记录
  - turn_end 增量：同 session 两次 turn_end → 第二次只写新增（max(last_offset) 门控）
  - turn_end 幂等：同 turnIndex 重复触发 → chunk id 复合键去重（INSERT OR IGNORE 或先查后写）
- `tests/integration/models-config-handlers.test.ts`：
  - modelsConfig.get 空配置返回 null/默认
  - modelsConfig.set 落库 + get 回读一致
  - modelsConfig.set 不含 apiKey/baseUrl
- **models.list fixture 变更测试**（裁决 5）：断言 fixture 含 deepseek + agnes 两组 provider + 各模型 id，且**无任何 apiKey/baseUrl 字段**（密钥边界回归）

**ChatTab 测试扩展**：
- 挂载时 modelsConfig.get 回填 selectedModel
- onChange 时 modelsConfig.set 落库 + setSelectedModel

### 5.5 文档 supersedes 修订

四文档统一修订模式：
- 原文 `~/.pi/agent/models.json` → `<dataRoot>/config/models.json`
- 加显式 supersedes 注记：`<!-- supersedes: v0.x.y 原写 ~/.pi/agent/models.json，T-M3-005 裁决 1 改业务数据根（AGENTS.md §9.5 物理隔离） -->`
- 版本号递增

---

## 六、16 步流程进度

| 步骤 | 内容 | 状态 |
|---|---|---|
| 1 | 文档审查 + 权威条款核实 | ✅ 完成（四文档条款 + §9.5 冲突 + pi 事件类型已核实） |
| 2 | 访问控制检查（权限边界） | ✅ 完成（扩展层 + agent-host + renderer 三层权限） |
| 3 | .plan 创建 | ✅ 本文件（草案） |
| 4 | 独立审查 | ⏳ 待用户批准后执行 |
| 5 | **用户授权节点** | ⏳ **待用户批准开工** |
| 6 | 任务分支创建 | ⏳ |
| 7 | TDD RED：先写失败测试 | ⏳ |
| 8 | TDD GREEN：最小实现 | ⏳ |
| 9 | type-check | ⏳ |
| 10 | pnpm test（单件 + 集成） | ⏳ |
| 11 | pnpm build | ⏳ |
| 12 | pnpm smoke | ⏳ |
| 13 | pnpm verify + 专项脚本 | ⏳ |
| 14 | 文档同步（04-Todo + 00-索引 + AGENTS.md + 4 文档 supersedes） | ⏳ |
| 15 | .record 实施记录 | ⏳ |
| 16 | **提交交付**（★ 待用户授权） | ⏳ |

---

## 七、验收与收尾

### 7.1 质量门

```
pnpm type-check && pnpm test && pnpm build && pnpm smoke && pnpm verify
node scripts/check-docs-governance.mjs
node scripts/check-contract-coverage.mjs
node scripts/check-desktop-security.mjs
node scripts/check-uuid-leak.mjs
```

### 7.2 完成判据（AGENTS.md §8.4）

04-Todo 证据 + master 复验 + origin/master 推送三者齐全

### 7.3 收尾七步（AGENTS.md §7）

1. 复验测试和最小端到端路径
2. 更新 04-Todo（T-M3-005 done + §9 统计 M3 done 4→5）
3. 创建 `.record/T-M3-005-实施记录.md`（8 章节）
4. 06-API 落地注解（本任务预计无需新增 RPC 方法，仅 §3.13 约束列 supersedes）
5. 标记完成保留计划原件
6. 文档治理检查
7. 停止报告，等待用户指示（不预选 T-M3-006）

---

## 八、风险评估

| 风险 | 缓解 |
|---|---|
| turn_end 增量逻辑与承载层 insertChunk 接口不匹配 | 复用 insertChunk 签名（ChunkInput），增量门控在钩子层实现，不改承载层 |
| chunk id 复合键幂等性 | `${sessionId}:${turnIndex}:${role}:${seq}` + INSERT OR IGNORE 或先查后写 |
| 扩展层钩子获取 dataRoot 路径 | 复用 StudyBuddyExtensionOptions.dataRoot 或 PI_STUDYBUDDY_DATA_ROOT 环境变量（与 before_agent_start 一致） |
| ChatTab 落库引入异步竞态 | 挂载 useEffect 异步 get + 切换 set 不阻塞 UI；失败静默（与 models.list 一致） |
| 四文档 supersedes 版本号协调 | 统一在本任务收尾时递增，supersedes 注记指向 T-M3-005 裁决 1 |
