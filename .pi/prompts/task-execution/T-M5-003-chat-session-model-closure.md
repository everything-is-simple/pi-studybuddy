# T-M5-003：对话/会话/模型/文件引用真实用户闭环修订

**任务 ID**：T-M5-003
**任务登记依据**：docs/04-任务清单-Todo-List.md T-M5-003（v0.1.162，in_progress）
**提示词属性**：受控参考资产，不是 `.plan/`，不代表开工或 Git 收口授权（AGENTS.md §4.4/§4.5）。
**配套文件**：必须与 `00-标准任务执行提示词.md` 一并提供给执行 Agent。
**唯一执行计划**：`.plan/T-M5-003-chat-session-model-closure.md`（已获用户批准，执行中）
**实施分支**：`agent/T-M5-003-chat-session-model-closure`
**测试运行根**：`H:\pi-studybuddy-tmp\runs\T-M5-003\`

## 1. 开始前必须核验的事实

先按 AGENTS.md §0 顺序读取权威文件，再运行并报告：

```powershell
git status --short --branch
git branch --show-current
git log --oneline --decorate -5
git show-ref --verify refs/heads/agent/T-M5-003-chat-session-model-closure
```

以下三元组必须一致指向 T-M5-003，任一不一致时先做最小治理同步（记录修复前后事实），**不得先写业务代码**：

1. docs/04 §7.7 登记 T-M5-003 = `in_progress`；
2. `.plan/00-当前任务.md` 指向 `.plan/T-M5-003-chat-session-model-closure.md`；
3. 当前 shell 分支 = `agent/T-M5-003-chat-session-model-closure`（2026-08-12 核验：`master=origin/master=agent/T-M5-003=9ec9b1e`，T-M5-002 已快进并入 master；实施前须重新核验并确认分支位置）。

工作区不得使用 `git reset --hard` / `git clean -fd` / `git stash` / `git add -A` / `git add .`；既有未跟踪用户文件不得纳入任何改动。T-M5-003 已获开工授权，但 **commit/merge/push 一律等待用户单独授权**。

## 2. 权威条款（充足上下文）

| 权威来源 | 必须兑现的语义 |
|---|---|
| 03-Arch §6.7 | 会话是「💬 对话 Tab」的承载；对话是默认主入口；对话与 S1-S7 双层并存、数据贯通 |
| 03-Arch §2.3 + 09-UI §9.2 | 模型选择持久化到业务数据根 `config/models.json`（`__studybuddy_managed`），不侵入 `~/.pi` |
| 09-UI §3.3/§7 | 会话列表按日期分组、可搜索、unread；会话可附加学科标签/学习目标/错题关联；新建/切换/重命名/导出/删除 |
| 09-UI §4.2 | 学习场景元数据（📐学科/目标/关联错题）随发送携带，影响 AI 上下文；工具调用透明可跳转 |
| 09-UI §7.2 | `@` 文件引用限当前课程资料，选中的文件作为上下文传入对话 |
| 06-API §3.1/§3.1.1 | `sessions.list/get/context/rename/delete/export/search`；`agent.send(sessionId, text, sessionMeta?)` |
| 06-API §3.2/§3.4/§3.6/§3.13 | `files.read`（allowed-roots）；`materials.list`；`mistakes.list`；`modelsConfig.get/set` |
| 07-WF §2.8 | 通用 AI 对话路径：零碎问答 → AI 自主调用工具 → @文件引用 → TTS → L3 索引 → 与 S1-S7 衔接 |
| 08-Test §5/§6.5/§6.6 | 安全不变量六条；对话 E2E-10~13；**每任务真机 UAT 铁律（真实 Electron + 隔离空数据根 + 纯 UI）** |
| AGENTS.md §4.4/§4.5/§5/§7/§8/§9/§10/§11 | 单一执行任务门禁；状态 SoT；RED→GREEN→REFACTOR；受控收尾；Git 纪律；安全隐私；Node24 质量门；治理修订纪律 |

**任务目标**：移除生产路径的 fixture/占位/静默失败，打通默认主入口的真实用户闭环——真实会话（新建/切换/重命名/导出/删除 + 重启持久化）、真实模型状态（失败可见可重试）、真实错题/文件引用（从真实列表选择）。

## 3. 已核验的现状断点（2026-08-12 代码审计，RED 起点）

| 位置 | 已确认现状 | 必须达到的结果 |
|---|---|---|
| `src/agent-host/index.ts:132` | 生产 `createSessionStore(defaultSessionFixture())` 注入假会话 | 生产空数据根会话列表为空；fixture 仅测试显式注入 |
| `src/agent-host/session-store.ts` | 内存 Map；无 create 方法、无持久化；`makeContext` 硬编码 `sess-001`=12 条/1240 tokens | 真实会话由用户动作产生、ID 非常量、重启后可见（持久化方案须先经裁决或在既有边界内最小实现，**不新增 API/schema**） |
| `src/contract/api.ts` §3.1 | `sessions.*` 无 `create` 契约（127/127） | 不得用 `sess-new` 等 renderer 字面量冒充创建；若既有 `agent.send` + host 存储无法表达首次创建，**RED 留证后停止并请求用户裁决** |
| `ChatTab.tsx:353` | 发送固定 `sessionId: "sess-001"` | 消费 AppShell 唯一 `activeSessionId`；首条消息归属真实会话 |
| `ChatTab.tsx:676` | 关联错题固定加 `"mist-001"` | 从 `mistakes.list({ courseId })` 真实选择；未选中不写入 `sessionMeta.mistakeIds` |
| `ChatTab.tsx:746` | 工具跳转固定 `sessionId: "sess-001"` | 携带当前真实会话上下文 |
| `ChatTab.tsx` 多处 | `sessions.list`/`models.list`/`modelsConfig.get`/`materials.list`/`agent.send`/`modelsConfig.set` 静默 catch | 固定中文错误 + 可重试；loading/error/empty/retry 四态齐全；不吞异常 |
| `AppShell.tsx:364` | 「新建会话」= `setActiveSessionId("sess-new")` | 真实新建会话并成为当前会话；`handleRename/Delete/Export` 失败可见可重试（当前静默 catch） |
| `handlers/models.ts` | `modelsConfig.get` 空配置返回 `{provider:"",model:""}`；`set` 已写业务数据根 | 对话下拉/状态栏/设置页/实际对话请求对同一已保存配置一致；写入失败不乐观伪装成功 |
| `handlers/agent.ts` | 未配置模型抛 `modelNotConfiguredError()`（生产不静默回退 fixture） | 模型未配置错误在 UI 可见且指向可操作入口 |
| `handlers/files.ts` | `files.read` 已有 allowed-roots 白名单守卫 | `@` 引用限当前课程资料；读失败固定中文错误、不泄漏路径/栈 |
| `studybuddy-extension.ts:234/255` | `turn_end` L3 索引写死 `DEFAULT_SESSION_ID="sess-001"`（注释：事件无法取真实会话 id） | 核验项：若真实会话闭环要求 L3 索引归属真实会话 id，属本任务边界还是后续任务，**记录证据并请求裁决，不静默扩大范围** |

> 边界提醒：`sess-001`/`mist-001` 在既有测试 fixture（`tests/unit/session-store*.test.ts`、`tests/e2e/e2e-13-l3-search.test.ts`、`tests/e2e/test-main.js` 等）中可保留作为稳定测试值；本任务移除的是**生产依赖及以生产路径为目标的断言**，不得做跨仓库全局字面量替换。

## 4. 范围与边界

### 纳入
- 空数据会话状态（无 fixture 会话；左栏/对话区空态 + 新建入口）
- 真实会话生命周期（新建/选择/首条消息归属/重命名/导出/删除/切换 + 重启持久化；删除当前会话后无悬空 ID）
- 真实错题关联（`mistakes.list` 当前课程选择；选中才进 `sessionMeta.mistakeIds`）
- 真实 `@` 文件引用（`materials.list` 当前课程选择；`files.read` 白名单；读失败固定文案）
- 真实模型状态（`modelsConfig.get/set` 成功/失败/空态可见可重试；底部状态栏/设置页/对话请求一致）
- 失败路径可见（会话/模型/错题/资料/文件读取/发送/重命名/删除/导出，固定中文错误 + 重试，无静默 catch）
- 竞态/卸载防线（切换课程、切换会话、卸载后旧响应不得覆盖新状态；重复点击不重复 mutation）

### 明确不纳入
- S1-S7/TTS/备份/设置页产品控件修订 → T-M5-004/005
- OCR/WPS/whisper 随包自包含 → T-M5-006
- 不新增 API/schema（contract 保持 127/127）；既有契约不足 → 停止请求裁决
- 不连真实 AI/SMTP/飞书/WPS/OCR/whisper 外部服务；自动化用受控 mock，UAT 验证无模型/失败/重试的可见产品行为
- 不写入真实业务数据根 `%LOCALAPPDATA%\PiStudyBuddy` 或真实凭证

## 5. RED 追踪矩阵

每条测试先在当前生产行为下失败（记录命令、失败断言与原因），再写最小 GREEN 实现。

| ID | 条款/风险 | RED 断言 | 证据类型 |
|---|---|---|---|
| C-RED-01 | 空数据无 demo 会话 | 生产装配 `sessions.list` 为空；真实 Electron 首屏无「极限学习/导数练习」 | host 单元/集成 + renderer E2E |
| C-RED-02 | 新建不得伪造 ID | 新会话 ID 非常量；首条发送归属该会话；刷新后列表/历史一致 | host/renderer 集成 |
| C-RED-03 | 重启持久化 | 隔离数据根重启后仍列出/选择/读取先前会话 | 真实 Electron E2E |
| C-RED-04 | 当前会话单一来源 | 发送与工具跳转携带 AppShell `activeSessionId`；删除当前会话后不再发送已删 ID | renderer 集成 |
| C-RED-05 | 真实错题选择 | `mistakes.list({ courseId })` 为数据源；仅选中项进 `sessionMeta` | renderer 集成 |
| C-RED-06 | 文件引用边界 | 当前课程资料可选；读失败固定中文错误；越权仍被 host 拒绝 | 集成 + E2E |
| C-RED-07 | 模型事实一致 | `modelsConfig.get` 空/失败/成功状态可见；`set` 失败不改变有效状态且可重试；成功后重启一致 | renderer 集成 + E2E |
| C-RED-08 | 无静默失败 | 会话列表/模型/错题/资料/读文件/发送/会话 mutation 拒绝路径均可见可恢复 | 定向集成 |
| C-RED-09 | 用户侧真实路径 | 新空根纯 UI：建前置学习计划 → 进入对话 → 新建会话 → 发送 → 无模型失败可见 → 重启验证持久化 | 真机 UAT 两阶段 |

## 6. 真机 UAT（硬门槛，08-Test §6.6）

UAT 必须使用已构建真实 Electron + 全新 `H:\pi-studybuddy-tmp\runs\T-M5-003\uat\` 数据根，完全通过可见 UI 操作；**禁止** CDP 改状态、RPC/handler 直调、数据库种子绕过界面。

- **阶段 A（首次启动与失败可见）**：纯 UI 创建必要 S1 前置学习计划 → 进入默认对话 → 确认无 fixture 文案 → 新建会话 → 输入并发送 → 验证无模型/受控失败的固定中文错误与重试入口；检查模型选择的空/成功/失败态与资料、错题的真实空态。
- **阶段 B（重启持久化）**：关闭并重启同一隔离根 → 新建会话与有效模型选择仍可见 → 选中会话后元数据/消息归属不串 → 重命名/删除等本任务已实现控件逐项记录可达性与固定反馈。
- 每一步保存 `step-xx.json` / `step-xx.png` / 脱敏 DOM 与 `UAT-报告.md`；报告必须区分「真机纯 UI」「真实 Electron 自动化 E2E」「fixture 集成测试」，不得把后两者写成 UAT。
- 检查 DOM/截图/报告不含完整 UUID、绝对路径、file URI、密钥、资料原文、错误栈。
- 若 M5-004 尚未提供纯 UI 创建错题/资料的前置路径，UAT 至少验证真实空态、不可用说明与无泄漏失败态，并将「成功选择已有错题/资料」的用户路径登记到 T-M5-004/007，不跨任务补功能。

## 7. 完整质量门

同一 PowerShell 前置 Node 基线：

```powershell
$env:Path = "C:\node-v24.14.0-win-x64;$env:Path"
node --version   # 必须 v24.14.0
pnpm --version   # 必须 11.20.0
```

定向 RED/GREEN + 受影响真实 Electron E2E + 真机 UAT 通过后，运行：

```text
pnpm type-check / pnpm build / pnpm test / pnpm smoke
node scripts/verify.mjs --stage=full
node scripts/check-docs-governance.mjs
node scripts/check-contract-coverage.mjs
node scripts/check-desktop-security.mjs
node scripts/check-uuid-leak.mjs
git diff --check
```

实际命令、版本、测试文件/用例数、E2E 数、contract/security/smoke/UUID 结果与日志路径必须写入证据。

## 8. 独立交叉审查与受控收尾

- 至少两名独立审查者分别核对：会话所有权与持久化、真实 Electron 跨进程链路（main→preload→piBridge→TCP/RPC→agent-host→handler→renderer）、模型状态一致性、ID/路径/密钥泄漏、异步竞态/卸载/重复 mutation、fixture 与生产边界、UAT 纯 UI 证据、未授权范围。P0/P1 必须修复并复验。
- 本地验收完成后按 AGENTS.md §7：更新 docs/04（事实/测试/Git 证据）；创建八章 `.record/T-M5-003-实施记录.md`；`.plan/00-当前任务.md` 与唯一计划标记本地完成；仅当 API 契约确有变化才同步设计文档（本任务预期无变化）；运行文档治理检查；停止并报告。
- **停止条件**：既有契约无法表达对话闭环必需能力（先留 RED 证据）；发现 P0/P1 超出本任务边界（登记到 T-M5-004~008）；完成全部验收项后等待用户对 Git 收口与下一任务的选择，不自动 commit/merge/push，不启动 T-M5-004~008。
