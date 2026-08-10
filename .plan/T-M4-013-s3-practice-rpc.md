# T-M4-013 实施计划：S3 练习 Tab RPC 接线

- 任务 ID：T-M4-013
- 任务标题：S3 练习 Tab RPC 接线
- 任务类型：M4 业务接线
- 优先级：P1（核心：出题/作答/批改）
- 治理阶段：阶段 4（系统组装）
- 状态：in_progress（开工登记完成，RED 前置）
- 日期：2026-08-10
- 用户授权：已明确批准 T-M4-013 开工（2026-08-10）
- 集成基线：master=origin/master=f4e54c2（T-M4-012 功能与治理收官）
- 实施分支：agent/T-M4-013-s3-practice-rpc
- 集成分支：master
- 测试运行根：H:\pi-studybuddy-tmp\runs\T-M4-013\

## 一、当前工程整体进度（2026-08-10 快照）

### 里程碑状态

| 里程碑 | 状态 | 任务完成情况 |
|---|---|---|
| M0 骨架 | ✅ 完成 | 9/9（Electron 四进程 + contract RPC + 安全沙箱 + toolchain） |
| M1 核心闭环 | ✅ 完成 | 10/10（S1-S7 工具注册 + OCR/WPS/转换管道 + 跨切钩子 + S1-S4 UI + E2E） |
| M2 完整闭环 | ✅ 完成 | 9/9（S5-S7/TTS/备份 + UUID 泄漏检测 + whisper 真实 Adapter + UI + E2E） |
| M3 对话打磨 | ✅ 完成 | 8/8（对话主入口 + pi 原生能力 + 学习场景 + 工具跳转 + 模型钩子 + 会话 UI + E2E） |
| M4 业务接线+打包 | 🔄 进行中 | 23 任务：done 14 / in_progress 1（T-M4-013）/ pending 8（014~021） |

### M4 已完成（14 个）

- **T-M4-001~005**：后端 5 处断裂全部修复（数据根初始化 / handler 全装配 / credentials+settings / extension 接入 pi 内核 / agent.send 接真实 pi 流式）
- **T-M4-006**：设置页 UI（⚙ 入口 + Ctrl+, 独立页，密钥不回显）
- **T-M4-007**：学期/课程切换 UI（学期树 + 唯一上下文 + 归档只读）
- **T-M4-008**：AppShell 数据流（Tab 骨架 + 状态提升）
- **T-M4-009**：electron-builder 打包链路（源码形态可运行 + 打包能力常态化）
- **T-M4-010**：S1 首页 Tab RPC 接线（dailyBrief + tasks + exams）
- **T-M4-011**：S2 资料 Tab RPC 接线（upload + convert + generateNote + list）
- **T-M4-012**：S2 笔记 Tab RPC 接线（notes.get/update + modules.list/update）；master=origin/master=`f4e54c2`
- **T-M4-022**：真实 Electron 生产运行时修复（Electron 36.9.5 + 127.0.0.1 TCP E2E harness）
- **T-M4-023**：交叉审查修订（生产 agent.send 不静默回退测试夹具）

### M4 待办（8 个 pending）

| 任务 | 内容 | 优先级 |
|---|---|---|
| T-M4-014 | S4 错题 Tab RPC 接线（list + confirmErrorCause + redo + weakPoints） | P1 |
| T-M4-015 | S5 冲刺 Tab RPC 接线（mockExams + cramCards + cramPlan） | P2 |
| T-M4-016 | S6 报告 Tab RPC 接线（reports + deliveries + reportTargets） | P2 |
| T-M4-017 | S7 采集 Tab RPC 接线（classCapture.transcribe + saveTranscription） | P2 |
| T-M4-018 | TTS 控制条 RPC 接线（speak + control + switchEngine + getStatus） | P3 |
| T-M4-019 | 备份恢复面板 RPC 接线 + TabBar 入口 | P3 |
| T-M4-020 | E2E 全链回归（后端断裂修复 + 设置页/学期切换 + S1-S7 接线） | P4 |
| T-M4-021 | M4 收官验收 + 打包冒烟（安装 + 启动 + RPC 往返 + 安全不变量） | P4 |

### 环境基线（AGENTS.md §10 v0.1.96）

- Node：`C:\node-v24.14.0-win-x64`（v24.14.0，唯一前置目录）｜pnpm：11.20.0 ｜ Python：`D:\miniconda\py310`（3.10.19 / conda 26.1.1）｜ bash：`C:\cygwin64`（5.2.21）
- 质量门前置（当前 PowerShell）：`$env:Path = "C:\node-v24.14.0-win-x64;$env:Path"`，自检 node v24.14.0 / pnpm 11.20.0
- 测试运行数据隔离：`H:\pi-studybuddy-tmp\runs\<task-id>\`，绝不污染业务数据根 `%LOCALAPPDATA%\PiStudyBuddy`

## 1. 裁决与权威依据

- **系统身份**：pi-studybuddy = pi 底座 + pi-skills 组件供给 + StudyBuddy 业务内核 + Electron 桌面壳（AGENTS.md §1.1）。服务对象为一名在 Windows 本机学习的学生；AI 底座为 pi coding agent（`@earendil-works/pi-coding-agent`），所有业务能力通过 `registerTool` + 扩展 + 技能接入；形态为 Electron 桌面应用（单机、单用户、单写进程、本地 SQLite、127.0.0.1 边界，AGENTS.md §1.1 + §9.1）。

- **AGENTS.md**（v0.1.96）：系统身份 + 权威链 + 任务铁律 + §5 TDD + §7 受控收尾 + §8 Git 纪律 + §10 环境基线（Node C:\node-v24.14.0-win-x64 / pnpm 11.20.0）。
- **docs/00-文档索引-Index.md**（v0.1.115）：文档导航 + 门禁状态。
- **docs/04-任务清单-Todo-List.md**（v0.1.112）：T-M4-013 已登记 in_progress；§7.5 执行顺序第 32 行；前置 T-M4-008 done。
- **docs/10-开发规范-Dev-Rules.md**（v0.1.0）：16 步标准化开发流程——从 04-Todo 登记到 origin/master 推送的操作骨架。
- **docs/03-架构设计-Architecture-Design.md**（v0.1.3）：四层架构 + 壳层先于业务 + 生产入口装配。
- **docs/06-API契约-API-Contracts.md**（v0.1.7）§3.5：practice.* 契约（createSession/getQuestions/submit/getResult/listSessions/timer）。
- **docs/08-测试验收-Test-Plan.md**（v0.1.4）：测试金字塔 + §7.2 防泄露断言（作答前 DTO 无答案字段）+ §6 E2E 框架（vitest + 真实 Electron）。
- **docs/09-使用者介面-UI-Design.md**（v0.1.4）§4.6：练习 Tab 限时作答 UI + 结果视图。

## 2. 契约与 UI 依据（T-M4-013 核心）

06-API §3.5 练习会话（practice.*）：

| 方法 | 参数 | 返回 | 关键约束 |
|---|---|---|---|
| `practice.createSession` | `{ courseId, moduleIds, questionCount, timeLimit?, difficulty?, questionTypes? }` | `PracticeSession` | questionCount 5-20；题型分布 single 60% / multiple 20% / fill 20% |
| `practice.getQuestions` | `{ sessionId }` | `QuestionDTO[]` | **作答前 DTO 不含 correct_answer/acceptable_answers/explanation（防泄露铁律，08-Test §7.2 断言）** |
| `practice.submit` | `{ sessionId, answers: Answer[] }` | `PracticeResult` | 触发规则批改（非 AI）；三策略 |
| `practice.getResult` | `{ sessionId }` | `PracticeResult` | 含逐题结果；is_correct=false 只读输出给 S4 |
| `practice.listSessions` | `{ courseId? }` | `PracticeSession[]` | |
| `practice.timer`（Streams） | `{ sessionId, elapsedMs, remainingMs? }` | — | 前端计时，限时可超时标记 |

09-UI §4.6：限时练习视图（模块选择 + ⏱ 剩余时间 + 题号进度 + 单题作答 + 上一题/下一题/提交）+ 结果视图（正确率 + 用时 + 逐题 ✅/❌ + 正确答案/解析 + [加入错题] + [▶ 朗读错题解析]）。

## 3. 实施范围

允许修改：

- src/renderer/components/tabs/PracticeTab.tsx（或对应练习 Tab 组件）
- tests/unit/integration 新增 t-m4-013-practice-rpc 相关测试
- tests/e2e 新增真实 Electron RPC E2E（应用启动前隔离 fixture 预置）
- 必要的 T-M4-013 治理记录同步文件

明确不修改：

- src/agent-host/handlers/**（生产 handler 语义，除非发现断裂需单独立项）
- src/contract/api.ts、数据库 schema、RPC 方法表（Api 方法总数保持 127）
- src/renderer/components/AppShell.tsx 全局状态
- S4 错题写入（T-M4-014 范围）；[加入错题] 按钮可占位/只读输出
- T-M4-014~021

## 4. TDD 执行顺序

### RED

先建立 mounted renderer 失败测试，至少覆盖：

- 课程门控：无选中课程时练习入口禁用/提示，不发 RPC；
- createSession 参数正确（courseId + moduleIds + questionCount 5-20 + 题型分布约束）；
- 作答前 getQuestions 返回 DTO **不含 correct_answer/acceptable_answers/explanation**（防泄露断言）；
- 作答流程：answers 组装 → submit 调用参数正确；
- getResult 展示逐题 ✅/❌ 与正确率/用时；is_correct=false 只读（不写入 S4）；
- 前端计时器：限时超时可提交但标记超时；timer Stream 事件接收；
- 竞态/卸载：课程切换、会话切换、卸载时旧响应不污染当前 UI；
- UI 不展示完整 UUID、绝对路径、错误栈或敏感正文日志。

测试 fixture、mock RPC 与 Electron 运行数据全部隔离到 H:\pi-studybuddy-tmp\runs\T-M4-013\。

### GREEN / REFACTOR

- 只实现使 RED 通过的最小 renderer 接线逻辑；
- 复用既有 typed RPC、useTabData 竞态/卸载保护与课程门控范式（T-M4-010~012 产物）；
- 不新增 API/handler/schema；保持既有静态 props 测试兼容，随后整理组件状态与错误/空状态展示。

## 5. 验收与证据

1. 定向 unit/integration 测试通过（t-m4-013-practice-rpc）。
2. pnpm type-check、pnpm build、pnpm test、pnpm smoke 通过。
3. node scripts/verify.mjs --stage=full 通过（本轮实测 unit/integration 109 files/1057 tests；真实 Electron E2E 18 files/120 tests，含新增练习 renderer 路径）。
4. node scripts/check-docs-governance.mjs、契约覆盖（127 handlers）、安全不变量 6/6、UUID 泄漏检查与 git diff --check 通过。
5. 两名独立审查者分别核对 RPC 参数、防泄露断言、竞态、课程门控、隐私边界和范围边界。
6. 本地收尾后更新 Todo、计划和唯一实施记录 `.record/T-M4-013-实施记录.md`；等待用户另行授权 Git 收口。

## 6. 停止条件

发现需要新增 API、handler、schema、AppShell 全局状态、改变 T-M4-010~012 语义、启动 T-M4-014~021、写入真实业务数据根、运行目录越界、E2E 无法启动、安全不变量失败、无法区分用户 dirty worktree，或需要 commit/merge/push 时，立即停止并报告。

## 7. 当前执行证据

- RED：`tests/integration/t-m4-013-practice-rpc.test.ts` 初次运行 3/3 失败（缺模块选择器、归档只读门控），已保留命令输出；随后补为 5 条 mounted renderer 断言。
- GREEN / REFACTOR：`PracticeTab.tsx` 已复用 `modules.list`、`practice.createSession/getQuestions/submit/getResult`；显式多模块选择、前端计时/stream 接收、答案状态、重复提交防线、归档只读、课程竞态/卸载保护与固定错误文本已实现；不新增 API/handler/schema/AppShell 全局状态。
- 定向证据：unit + integration 2 files/16 tests、真实 Electron renderer E2E 1 file/1 test 通过。
- 完整质量门：Node v24.14.0 / pnpm 11.20.0；`verify --stage=full` 通过（unit/integration 109 files/1057 tests；真实 Electron E2E 18 files/120 tests；contract 127 handlers/8 PiBridge/35 tools；security 6/6；smoke 6/6；UUID 7/7；docs governance；`git diff --check`）。日志位于 `H:\pi-studybuddy-tmp\runs\T-M4-013\logs\`。
- 独立审查：审查者 A/B 已独立复核覆盖范围、RPC 参数、模块/课程归属、防泄露、竞态/卸载、归档只读、真实 Electron E2E、隐私展示和未授权改动边界；均无遗留 P0/P1。审查发现的 P1/P2 已修复并复验。
- 审查范围裁决：`practice.listSessions` 虽存在于历史 Todo/API/handler 能力中，但不属于本轮批准的 renderer 接线目标；该范围裁决 supersedes v0.1.112 中的“listSessions 接线”描述，历史记录保留；不在本任务新增或删除。
- 实施记录：`.record/T-M4-013-实施记录.md` 已创建；任务仍保持 `in_progress`，因为尚未获得 Git 收口授权。
- Git 收口：未获授权。

（本计划为 T-M4-013 唯一执行计划，原件保留作为历史范围与验收证据。）
