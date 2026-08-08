# T-M1-008 跨切钩子（before_agent_start / session_start / tool_call / tool_result 业务级逻辑）

**任务**：T-M1-008（扩展层 / 跨切，P1）
**里程碑**：M1 核心闭环 MVP
**状态**：完成（步骤 5-15 已完成，待步骤 16 提交交付）
**日期**：2026-08-08
**依据**：03-Arch §2.3（pi.on 生命周期钩子清单）+ §3.4/§8.1（workspace-path-guard）+ §3.5（observability）+ 08-Test §4.2（钩子集成断言）+ AGENTS.md §9.3（日志脱敏）+ §9.4（组件安全）

---

## 1. 任务目标

为 studybuddy-extension（[studybuddy-extension.ts](../src/agent/studybuddy-extension.ts)）注册 4 个 pi.on 生命周期钩子，落地业务级逻辑：

| 钩子 | 业务逻辑 | 设计依据 |
|---|---|---|
| `before_agent_start` | 多源上下文注入：L1 学习者画像 + 当前激活学期/课程上下文 + 最近学习事件 | 03-Arch §2.3 |
| `session_start` | 初始化学期库连接、加载 L1 画像 | 03-Arch §2.3 |
| `tool_call` | **workspace-path-guard 拦截**：write/edit 类工具校验路径不逃逸业务数据根 | 03-Arch §3.4 + §8.1 + AGENTS.md §9.4 |
| `tool_result` | **集中错误日志**：所有工具失败统一记录（observability） | 03-Arch §3.5 + AGENTS.md §9.3 |

> `model_select` / `turn_end` 钩子属 M3（T-M3-005），本任务不实现。

## 2. 范围与非目标

### 2.1 范围（做）

- 新建 `src/agent/workspace-path-guard.ts`：`normalizeToolPath` + `checkWorkspaceMutationPath`（判定 `{block, reason}`）
- 新建 `src/agent/context-pack.ts`：`buildStudyContextSections`（L1 画像 + 激活学期/课程上下文 + 最近事件）
- 新建 `src/agent/observability.ts`：`createObservability` + `registerToolResultLogging`
- 修改 `src/agent/studybuddy-extension.ts`：setup 中注册 4 个 `pi.on`
- 新建单件/集成测试（见 §5）

### 2.2 非目标（不做）

- ❌ `model_select` / `turn_end` 钩子（M3 T-M3-005）
- ❌ L2/L3 索引注入（M3）
- ❌ registerProvider / Simple Mode（M3 T-M3-001+）
- ❌ 不新增 RPC 方法 / 不新增数据表（纯扩展层钩子）
- ❌ 不连真实 LLM / 不连真实外部服务（AGENTS.md §5.4）

## 3. 文件清单

| 操作 | 路径 | 说明 |
|---|---|---|
| 新建 | `src/agent/workspace-path-guard.ts` | 路径守卫判定函数 |
| 新建 | `src/agent/context-pack.ts` | before_agent_start 上下文构造 |
| 新建 | `src/agent/observability.ts` | tool_result 集中错误日志 |
| 修改 | `src/agent/studybuddy-extension.ts` | 注册 4 个钩子 |
| 新建 | `tests/unit/workspace-path-guard.test.ts` | 单件：路径守卫 |
| 新建 | `tests/unit/context-pack.test.ts` | 单件：上下文构造 |
| 新建 | `tests/unit/observability.test.ts` | 单件：错误日志 |
| 新建 | `tests/integration/cross-cutting-hooks.test.ts` | 集成：钩子注册 + 协作 |

## 4. 接口设计

### 4.1 workspace-path-guard.ts

```typescript
export interface PathGuardDecision {
  block: boolean;
  reason?: string;
}

/** 规范化工具路径（@/~ ~/ file:// Unicode 空格），与 pi 内置文件工具一致 */
export function normalizeToolPath(input: string): string;

/** 判定 write/edit 目标路径是否落在 workspaceDir 边界内（含符号链接解析） */
export function checkWorkspaceMutationPath(workspaceDir: string, requestedPath: string): PathGuardDecision;
```

- 流程：`normalizeToolPath` → `resolve` → `findExistingAncestor` → `realpathSync` → `isWithin`
- 越界判定 `block: true`，reason 固定中文文案（不泄漏绝对路径之外的敏感信息）
- 符号链接逃逸：`realpathSync` 解析后 `isWithin` 拦截（08-Test §4.2 断言）

### 4.2 context-pack.ts

```typescript
export interface StudyContextSections {
  sections: string[];
}

/** 构造 before_agent_start 多源上下文：L1 画像 + 激活学期/课程 + 最近事件 */
export function buildStudyContextSections(opts: {
  dataRoot: string;
}): Promise<StudyContextSections>;
```

- L1 画像：读 `memory/l1/learner-profile.json`（05-ERD §4.1），缺失时返回空段
- 激活学期：global.db `semesters WHERE status='active' AND deleted_at IS NULL`，取最近创建
- 当前课程：对应 semester.db `course_instances WHERE deleted_at IS NULL`
- 最近事件：`memory/l1/events.jsonl` 末尾 8 行
- 输出为可注入 systemPrompt 的文本段（`sections.join("\n")`）

### 4.3 observability.ts

```typescript
export interface ToolErrorRecord {
  event: "tool_execution_end";
  toolName: string;
  toolCallId: string;
  errorCode: string;
  occurredAt: string;
}

export interface Observability {
  records: ToolErrorRecord[];
  recordToolError(rec: Omit<ToolErrorRecord, "occurredAt">): void;
}

export function createObservability(): Observability;

/** 注册 tool_result 钩子：isError=true 时统一记录（含 errorCode，不泄漏路径/堆栈） */
export function registerToolResultLogging(pi: ExtensionAPI, obs: Observability): void;
```

- errorCode 提取自 `event.content` 文本中的固定错误码（如 `INTERNAL_ERROR`/`BAD_REQUEST`），否则回退 `UNKNOWN_TOOL_ERROR`
- **日志脱敏**（AGENTS.md §9.3）：不记录输入全文、不记录绝对路径、不记录 UUID

### 4.4 studybuddy-extension.ts

在 setup 中注册 4 个钩子（沿用现有 `pi.on` 签名）：

```typescript
pi.on("before_agent_start", async (event) => {
  const { sections } = await buildStudyContextSections({ dataRoot });
  if (sections.length === 0) return undefined;
  return { systemPrompt: [event.systemPrompt, ...sections].join("\n\n") };
});

pi.on("session_start", async () => {
  // 初始化学期库连接（s1Ctx.semesterDb 惰性打开）+ 确保 L1 目录存在
  initMemoryL1(dataRoot);
});

pi.on("tool_call", async (event) => {
  if (event.toolName !== "write" && event.toolName !== "edit") return undefined;
  const requestedPath = (event.input as { path?: unknown }).path;
  if (typeof requestedPath !== "string") return { block: true, reason: "文件路径无效，请使用当前工作区内的相对路径。" };
  const decision = checkWorkspaceMutationPath(dataRoot, requestedPath);
  if (decision.block) return { block: true, reason: decision.reason };
  return undefined;
});

const obs = createObservability();
registerToolResultLogging(pi, obs);
```

## 5. 测试策略

### 5.1 单件测试（阶段 2）

**workspace-path-guard.test.ts**
- 合法相对路径 → `{block:false}`
- `..` 逃逸 → `{block:true}`
- 符号链接逃逸（`fs.symlinkSync`）→ `{block:true}`（08-Test §4.2 断言）
- `~` 展开到家目录（非 workspace 内 → block）
- 空串 → `{block:true}`
- 路径不存在但有合法父级 → 不误杀（`block:false`）

**context-pack.test.ts**
- 无 L1 画像 → sections 为空
- 有 L1 画像 + 激活学期 + 课程 → sections 含画像/学期/课程/事件字段
- 无激活学期 → 仅含 L1 段

**observability.test.ts**
- 工具失败（isError）→ records 含 `tool_execution_end` + errorCode（08-Test §4.2 断言）
- 工具成功（isError=false）→ 不记录
- content 含固定错误码 → errorCode 精确提取；无 → `UNKNOWN_TOOL_ERROR`

### 5.2 集成测试（阶段 3，cross-cutting-hooks.test.ts）

- factory(stubPi) 注册 4 个钩子（`on` 被调用 ≥4 次，事件名含 4 种）
- 调用 `before_agent_start` handler → 返回 systemPrompt 含 L1 段
- 调用 `tool_call` handler（write edit 逃逸）→ `{block:true}`
- 调用 `tool_result` handler（isError）→ observability.records 增长

### 5.3 数据隔离

- 所有测试用 `H:\pi-studybuddy-tmp\runs\T-M1-008\` 隔离目录（AGENTS.md §5.3）
- 通过 `PI_STUDYBUDDY_DATA_ROOT` 注入

## 6. 五阶段治理定位

| 阶段 | 定位 |
|---|---|
| 阶段1 下载 | pi 底座已安装（T-M0-007） |
| 阶段2 单件 | 本任务：路径守卫 + context-pack + observability 单件测试 |
| 阶段3 集成 | 本任务：cross-cutting-hooks 钩子协作测试 |
| 阶段4 组装 | 代码进入 src/agent/ |
| 阶段5 冒烟E2E | 不新增 E2E（钩子无独立 UI 路径，由集成测试覆盖） |

## 7. 依赖关系

- 前置：T-M1-007 done（资料转换管道，上一任务）
- 依赖：pi 底座 `ExtensionAPI.on`（已确认 4 个钩子签名，types.d.ts:840-870）
- 数据：`initMemoryL1`（src/data/memory.ts）+ S1Context.semesterDb（src/agent-host/handlers/s1/context.ts）

## 8. 预期产物

- 3 个新源文件 + 1 个修改文件 + 4 个测试文件
- type-check + build + 全量测试 + smoke 通过
- 04-Todo v0.1.45（登记 done）+ 00-索引 v0.1.51 + AGENTS.md v0.1.31 + .record/T-M1-008

## 9. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界
- [x] 步骤 2：检查文档门禁（master 干净 a041e6e + 无执行中任务 + 用户已选 T-M1-008）
- [x] 步骤 3：编写 .plan/ 计划
- [x] 步骤 4：独立审查计划
- [x] 步骤 5：用户批准计划（★ 用户授权）
- [x] 步骤 6：拆分任务、逐项实现
- [x] 步骤 7：编写或更新测试（TDD）
- [x] 步骤 8：type-check（零错误零警告）
- [x] 步骤 9：build（无错误）
- [x] 步骤 10：test（全绿无 skip）
- [x] 步骤 11：smoke / E2E（铁律不破）
- [x] 步骤 12：独立审查并修复
- [x] 步骤 13：更新 04-Todo + 文档
- [x] 步骤 14：文档治理检查
- [x] 步骤 15：diff 检查
- [ ] 步骤 16：提交交付（★ 用户授权）

## 审查记录

**步骤 4 独立审查（2026-08-08）**：
- ✅ 钩子签名核实：`ExtensionAPI.on` 支持 `before_agent_start`(855) / `session_start`(842) / `tool_call`(869) / `tool_result`(870)，与 §4.4 完全一致
- ✅ 依赖核实：`initMemoryL1(dir)`（src/data/memory.ts:51）存在；`S1Context.semesterDb(semesterId)`（s1/context.ts:28）存在，满足惰性打开
- ✅ 范围边界：非目标（model_select/turn_end → M3 T-M3-005）正确排除；不新增 RPC/数据表，符合纯扩展层定位
- ✅ 测试策略：单件（路径守卫/context-pack/observability）+ 集成（钩子协作）+ 数据隔离（PI_STUDYBUDDY_DATA_ROOT）闭环
- ✅ 安全：路径守卫 realpathSync 符号链接解析 + 错误日志脱敏（不泄漏路径/UUID），对齐 AGENTS.md §9.3/§9.4
- 结论：计划完整、技术上可执行，无阻塞项