# AGENTS.md — pi-studybuddy 仓库操作宪章

**版本**：v0.1.6
**日期**：2026-08-07
**状态**：✅ 已审查批准（v0.1.0 用户 2026-08-07 批准；v0.1.1 治理资产清单同步更新；v0.1.2 省察修复 + §11.4 交叉审查元纪律；v0.1.3 §3.1 同步 01-TRD v0.2.2 决策 6；v0.1.4 §10 补全 M0 pnpm 命令；v0.1.5 §3.1 同步 00-索引 v0.1.24/04-Todo v0.1.9；v0.1.6 §3.1 同步 00-索引 v0.1.25/04-Todo v0.1.11 T-M0-007 done；v0.1.7 §3.1 同步 00-索引 v0.1.26/04-Todo v0.1.13；v0.1.8 §3.1 同步 00-索引 v0.1.27/04-Todo v0.1.15；v0.1.9 §3.1 同步 00-索引 v0.1.28/04-Todo v0.1.17 T-M1-001 done）
**适用**：对人和 AI agent 同等约束（仿 pi 生态 AGENTS.md 约定，作为 context file 自动注入 system prompt）

> 本文件是 pi-studybuddy 仓库的最高治理文件。任何 AI、开发者或自动化工具在对话中断后，只读本文件与 [docs/00-文档索引](./docs/00-文档索引-Index.md) 即可恢复系统身份、权威来源、当前任务和禁止事项；**不得依赖聊天记忆代替仓库文档**。

---

## §0 每次开工的强制入口顺序

任何开发会话开始时，必须按以下顺序读取文档，建立完整上下文：

```
1. AGENTS.md（本文件）              ← 系统身份 + 权威链 + 任务铁律
2. docs/00-文档索引-Index.md         ← 文档导航 + 门禁状态 + 当前状态总览
3. docs/04-任务清单-Todo-List.md     ← 当前任务注册表 + 里程碑状态
4. .plan/00-当前任务.md（若存在）    ← 唯一执行中任务计划
5. 相关设计文档（依据任务范围）       ← 01-TRD / 02-PRD / 03-Arch / 05-ERD / 06-API / 07-Workflow / 08-Test / 09-UI
```

**门禁规则**：
- 若上述文件缺失、相互冲突或当前任务不明确 → **停止业务施工**，只允许修复治理文档或请求用户裁决
- 未在 04-Todo 登记任务行时 → 先登记，不能直接写业务代码
- `.plan/` 无执行中任务时 → 等待用户明确选择任务，不预写未来计划

---

## §1 系统身份与定位

### 1.1 系统身份

**pi-studybuddy = pi（AI 底座）+ pi-skills（组件供给）+ StudyBuddy 业务能力（内核）+ pi-desktop 式桌面壳（使用者介面）**

- **服务对象**：一名在 Windows 本机学习的学生
- **核心价值**：把课程/考试目标、学习节奏、资料笔记、练习、错题和考前冲刺连成可持续闭环；家长接收脱敏异步摘要
- **AI 底座**：pi coding agent（`@earendil-works/pi-coding-agent`），不修改内核，所有业务能力通过 `registerTool` + 扩展 + 技能接入
- **形态**：Electron 桌面应用（单机、单用户、单写进程）

### 1.2 明确不做什么（v0.1 边界）

- 不支持多用户、多终端并发、远程协作
- 不自动选课、不替学生改写事实、不接管决策
- AI 解读必须明确标注，不可凌驾学生决策
- 不引入真实交易/支付/外部账户集成
- v0.1 明确禁用"运行级使用"（仅允许 verification_only / research_only）

### 1.3 与 ai-studybuddy 的关系

**业务认知迁移、实现重构**。ai-studybuddy 已完成 S1-S7 原型验证（342 后端 + 149 前端 + 24 E2E 基线）；pi-studybuddy 以 pi 为底座重新组装，**不复制其实现**。

---

## §2 权威链裁决

冲突时按以下优先级裁决（高优先级覆盖低优先级）：

| 优先级 | 权威源 | 说明 |
|---|---|---|
| 1 | 用户明确批准的治理决策 | 用户在本次会话的明确指令 |
| 2 | AGENTS.md（本文件）安全约束 | 不可被下游文档覆盖 |
| 3 | docs/01-TRD §7 已定案决策 | 五点待决项经用户批准定案 |
| 4 | docs/00-09 设计文档 | 设计阶段已审查批准的文档 |
| 5 | docs/04-Todo 已登记任务 | 任务注册表与证据 SoT |
| 6 | .plan/ 已批准任务计划 | 唯一执行中计划 |
| 7 | 已通过测试的代码 | master 分支代码 |
| 8 | 历史参考（ai-studybuddy / 参考仓库） | 仅参考不构成权威 |
| 9 | 聊天记录 | 最弱，不可单独作为施工依据 |

**冲突处理纪律**：
- 不得删除历史决策来"让文档看起来一致"
- 冲突必须通过新增决策记录和显式 `supersedes` 关系解决
- 修改治理基线文件（§11 列出）前必须说明原因、影响和权威依据

---

## §3 文档权威源

### 3.1 设计文档（docs/00-09，全部 ✅ 已审查批准）

| 文档 | 版本 | 权威范围 |
|---|---|---|
| [00-文档索引](./docs/00-文档索引-Index.md) | v0.1.28 | 文档导航 + 门禁 + 版本历史 |
| [01-TRD](./docs/01-TRD-技术需求-Technical-Requirements.md) | v0.2.2 | 技术底座决策 + 六点定案（含 v0.1 交付形态） |
| [02-PRD](./docs/02-PRD-产品需求-Product-Requirements.md) | v0.1.3 | 产品需求 + 业务闭环 + §3.11 对话默认主入口 |
| [03-Architecture](./docs/03-架构设计-Architecture-Design.md) | v0.1.1 | 四层架构 + pi 扩展 + §6.7 会话管理 |
| [04-Todo](./docs/04-任务清单-Todo-List.md) | v0.1.17 | 任务登记 + 组件治理看板 + 里程碑 M0-M3 + §6.0 M0 完成说明 + §7.2.1 M1 任务登记表 |
| [05-ERD](./docs/05-数据模型-ERD-Data-Model.md) | v0.1.1 | 全局库 + 学期库 + 三层记忆 |
| [06-API](./docs/06-API契约-API-Contracts.md) | v0.1.1 | RPC 契约 + 100+ 方法 + 9 Streams |
| [07-Workflow](./docs/07-工作流-Workflow.md) | v0.1.1 | 学生主路径 + 对话路径 + 11 状态机 |
| [08-Test](./docs/08-测试验收-Test-Plan.md) | v0.1.1 | 测试金字塔 + 四层分层 + 安全不变量 |
| [09-UI](./docs/09-使用者介面-UI-Design.md) | v0.1.2 | 三栏布局 + 💬 对话默认 Tab + S1-S7 标签页 |

### 3.2 参考仓库（仅参考，不构成权威）

| 仓库 | 路径 | 用途 |
|---|---|---|
| pi | `H:\pi-references\pi` | AI 底座 + AGENTS.md 范式 + extensions/skills 规范 |
| inno-agent | `H:\pi-references\inno-agent` | 业务化范本 + 工作区级治理 |
| pi-desktop | `H:\pi-references\pi-desktop` | 桌面壳架构 + contract + verify.mjs 范式 |
| pi-skills | `H:\pi-references\pi-skills` | 技能供给 + SKILL.md 格式 |
| ai-studybuddy | `H:\ai-studybuddy` | 业务认知来源（不复制实现） |
| ai-malf-riskbench | `Z:\ai-malf-riskbench` | 治理范式参考（AGENTS.md / .plan / .record） |

### 3.3 治理资产（✅ 已就绪，分五批创建完成）

| 文件 | 状态 | 作用 |
|---|---|---|
| `AGENTS.md`（本文件） | ✅ 已审查批准 v0.1.0 | 仓库操作宪章 |
| `README.md` | ✅ 已审查批准 v0.1.0 | 项目总览 |
| `docs/10-开发规范` | ✅ 已审查批准 v0.1.0 | 16 步开发流程 |
| `docs/11-组件装配` | ✅ 已审查批准 v0.1.0 | 先分解再组合 SoT |
| `docs/12-目录治理` | ✅ 已审查批准 v0.1.0 | 目录职责隔离 |
| `.pi/skills/*` | ✅ 已创建 | 治理用 Skill（task-complete / component-assembly） |
| `.pi/prompts/*` | ✅ 已创建 | 工作流模板（wr / plan） |
| `scripts/verify.mjs` | ✅ 已创建 | 统一质量门 |
| `scripts/check-docs-governance.mjs` | ✅ 已创建 | 文档治理检查 |
| `scripts/check-contract-coverage.mjs` | ✅ 已创建 | 契约 AST 校验 |
| `.plan/` | ✅ 已就绪 | 任务计划目录（无执行中任务） |
| `.record/` | ✅ 已就绪 | 实施记录目录（空，待首任务收尾写入） |

---

## §4 任务铁律

### 4.1 五阶段组件治理不可跳越（00 索引 §四）

任何组件必须走完五阶段：

```
1. 下载储存    →  H:\pi-references\* 或 node_modules / venv
2. 单件测试    →  独立冒烟 + 合成夹具断言（vitest + pytest）
3. 集成测试    →  extension×pi 底座契约 + 钩子协作
4. 系统组装    →  代码进入 src/ + 类型检查 + lint
5. 冒烟 + E2E  →  系统冒烟 + 受影响 E2E + 安全不变量六条
```

**任一阶段失败退回上一阶段，不进 master**（08-Test §11.2）。

### 4.2 task-id 全局唯一

```
T-<里程碑>-<序号>
里程碑：M0（骨架）/ M1（核心闭环）/ M2（完整闭环）/ M3（对话与打磨）
示例：T-M0-001、T-M1-042
```

运行数据隔离依赖此 id：`H:\pi-studybuddy-tmp\runs\<task-id>\`（00 索引 §五）。

### 4.3 壳层先于业务（03-Arch §9.2 装配顺序）

```
1. 壳层（main + preload + renderer + agent-host + contract + 安全沙箱 + toolchain + credential-vault + file-watch）
2. 公用零件（数据层 schema + 扩展层空壳）
3. 业务模块（S1-S7 + TTS + 备份恢复 + 对话）
```

**禁止**在壳层未就绪时开发业务模块。

### 4.4 单一执行任务门禁（仿 ai-malf-riskbench）

`.plan/` 同一时刻只允许存在一个**正在执行**的详细任务计划。

创建新计划的三项前置条件（必须同时满足）：
1. 上一项任务已完成并在 04-Todo 记录
2. 用户已明确选择该任务并批准开工
3. 该任务即将进入实施

**未选任务**只能在 `.plan/00-当前任务.md` 作为候选名称出现，**不得**预写文件清单、命令、预期输出或实现步骤。

### 4.5 任务状态不得只存在于聊天

`docs/04-Todo` 是任务注册表和完成证据 SoT，`.plan/` 是获批行动计划 SoT。

- 计划文件存在 ≠ 实现开始
- 实现提交存在 ≠ master 完成
- **只有 docs/04 证据 + master 复验 + origin/master 推送三者齐全才可报告完成**

---

## §5 TDD 纪律（强制）

### 5.1 RED → GREEN → REFACTOR

```
RED      先写与权威条款对应的失败测试
GREEN    只写使当前测试通过的最小实现
REFACTOR 测试保持通过后再整理结构
```

**禁止**：
- 先实现再补测试
- 用待测实现自动生成自己的 golden 预期
- 仅以覆盖率百分比验收

### 5.2 证据顺序（08-Test §1.3）

```
设计文档权威条款 → 测试 ID → fixture → 预期事件序列 → 实际结果 → 审计证据
```

每条关键不变量必须建立完整证据链。

### 5.3 测试运行数据隔离

所有测试写 `H:\pi-studybuddy-tmp\runs\<task-id>\`，**绝不污染真实业务数据根**（`%LOCALAPPDATA%\PiStudyBuddy`）。

### 5.4 不连真实外部服务

AI / SMTP / 飞书 / whisper.cpp / WPS COM 全部 mock，仅冒烟/E2E 可走受控夹具（08-Test §1.3 第 6 条）。

---

## §6 拆分 → 小组件 → 组合（用户宗旨）

### 6.1 核心原则：先分解，再组合

pi-studybuddy 的系统能力来自成熟组件的组合，**而不是从零造轮子**。

系统开发不是先写完整业务再找组件；而是**先把成熟组件一个个调通，再通过 Adapter 组合成系统能力**。

### 6.2 组件化装配流程（docs/11 待创建，此处先定骨架）

```
1. 组件识别    →  从 01-TRD §2 + 03-Arch §3 识别所需组件
2. 试炼场单件  →  在试炼场独立调通（H:\pi-studybuddy-composer，待创建）
3. 能力卡沉淀  →  COMPONENT-CARD.md 记录组件能力与边界
4. Adapter 封装 →  在主仓 src/ 重新实现 Adapter（不复制试炼场代码）
5. 主仓装配    →  通过 contract RPC 装配进系统
6. 装配门禁    →  组件测试全绿 + 工作区干净 + 公开 API 有文档 + 无越权行为
```

### 6.3 试炼场与主仓的边界

- 试炼场代码**不得**被主仓库 `import`
- 主仓库**不复制**试炼场样例，必须在主仓独立重新实现 Adapter
- 试炼场不变成主系统，运行数据不进入 Git
- 备份不反向污染当前 SoT

### 6.4 组件粒度原则

- **直接套库**：成熟开源组件直接用（如 SQLite、Electron）
- **套组件配薄胶水**：开源组件 + 薄 Adapter（如 OCR venv + Adapter）
- **主要自研但薄**：业务逻辑自研但保持精简（如 S5 组卷规则）
- **禁止过度工程化**：不为"将来可能需要"的功能提前设计

---

## §7 受控收尾流程

任务完成时必须按以下顺序执行（仿 ai-malf-riskbench `riskbench-task-complete` Skill）：

```
1. 复验当前任务的测试和最小端到端路径
2. 更新 docs/04-Todo：任务完成、事实、提交号；不得替用户预选下一项
3. 创建 .record/T-<里程碑>-<序号>-实施记录.md：本任务唯一记录（8 章节，见 §7.1）
4. 如 API 合同变化，更新对应 spec 文档
5. 在计划和当前任务看板中标明完成状态；保留该计划原件作为历史范围与验收证据
6. 运行文档治理检查（scripts/check-docs-governance.mjs，待创建）
7. 停止并报告，等待用户明确指示
```

**禁止**：
- 创建下一任务启动 Prompt
- 自动写生产数据库
- 自动提交/推送/合并（必须在用户明确要求后执行）
- 以"任务完成"为由启动其他未选任务

### 7.1 实施记录 8 章节

`.record/T-<里程碑>-<序号>-实施记录.md` 必须包含：

1. 任务裁决与范围
2. 实际交付
3. 偏差
4. 问题及根因
5. 关键决定及依据
6. 测试证据
7. Git 证据
8. 未解决事项/下一步约束

---

## §8 Git 纪律

### 8.1 分支命名

```
<executor>/<work-id>-<scope>
executor: human / agent（单人单机，不区分 codex/claude）
work-id:  task-id（如 T-M0-001）
scope:   简短英文 scope

示例：human/T-M0-001-electron-skeleton
       agent/T-M1-042-s1-semester-tools
```

### 8.2 合并流程

```
git checkout master
git pull --ff-only
git merge --ff-only <task-branch>
```

- 只允许 `git merge --ff-only`（快进合并）
- **禁止** `git reset --hard` / `git clean -fd` / `git stash` / `--no-verify`
- 冲突时停下，**不得** 强推

### 8.3 提交纪律

- 只 commit 自己本 session 改的文件
- `git add <显式路径>`，**禁止** `git add -A` / `git add .`
- commit message 格式：`type(scope): 中文描述`
  - type: feat / fix / docs / test / refactor / chore
  - scope: 模块名（如 m0 / s1 / tts / backup）
  - 示例：`feat(m0): Electron 四进程骨架 + contract RPC`

### 8.4 完成判据

master 分支只代表已集成、已验证、docs/04 已同步的事实。

**只有以下三者齐全才可报告任务完成**：
1. docs/04-Todo 证据已登记
2. master 分支复验通过
3. origin/master 推送成功

### 8.5 不提交清单

- 真实密钥 / `.env.local` / `credentials.json`
- 资料原文 / 完整 UUID / 学生数据
- `node_modules/` / `venv/` / 临时文件
- 试炼场代码副本 / 运行数据

---

## §9 安全与隐私边界（01-TRD §5 + 02-PRD §5.2）

### 9.1 网络边界

- 只监听 `127.0.0.1`，无公网入口
- 无云数据库，无远程协作

### 9.2 密钥边界

- 真实密钥只在本机配置存储（Windows DPAPI，pi-desktop credential-vault）
- 键名匹配：`/^modelProvider:[a-z0-9._-]{1,160}$/i` 和 `/^parentContact:[a-z0-9._-]{1,160}$/i`

### 9.3 日志脱敏

**永不记录**：请求正文、模型完整输出、base URL、key、完整 UUID
**AI 日志字段 allowlist**：只记录 allowlist 内字段
**学生资料原文、考试名称、家长渠道地址**：默认敏感

### 9.4 组件安全

- zip 炸弹防护（条目/解压比限制）
- MIME 严格匹配
- 不执行嵌入代码
- 符号链接逃逸防护（workspace-path-guard）

### 9.5 数据隔离（01-TRD §7 决策 3）

- pi 会话目录 `~/.pi` 与业务数据根 `%LOCALAPPDATA%\PiStudyBuddy` **物理隔离**
- pi-studybuddy 不侵入 `~/.pi`

---

## §10 开发命令（M0 已启动）

**M0 骨架开发命令（T-M0-001 落地，pnpm 包管理）**：

```
pnpm install              # 安装依赖（electron/esbuild 已加入 pnpm-workspace.yaml allowBuilds）
pnpm dev                  # 构建 + 启动 Electron（npm run build && electron .）
pnpm build                # tsc 编译 main/preload/agent-host + vite 打包 renderer
pnpm type-check           # tsc --noEmit（tsconfig.json + tsconfig.node.json 双配置）
pnpm test                 # vitest run（单件 + 集成 + 安全不变量）
pnpm smoke                # node scripts/smoke.mjs（构建产物 + RPC 冒烟）
pnpm verify               # 统一质量门（node scripts/verify.mjs）
```

**专项校验脚本**：

```
node scripts/check-docs-governance.mjs      # 文档治理检查
node scripts/check-contract-coverage.mjs    # 契约 AST 校验（M0 后启用完整校验）
node scripts/check-desktop-security.mjs     # 08-Test §5.7 安全不变量（3 条实现 + 3 条占位）
```

> `python -m pytest`（WPS COM / OCR 桥）在 M1 引入时补全。

**质量门阶段**（scripts/verify.mjs 自动按当前阶段选择）：
- design 阶段：仅 docs-governance
- m0 阶段：type-check + unit-test + contract-coverage + desktop-security + build + smoke
- full 阶段：再补 e2e

---

## §11 治理文件修改规则

### 11.1 治理基线文件

修改以下文件前必须说明原因、影响和权威依据：

- `AGENTS.md`（本文件）
- `README.md`
- `docs/00-文档索引-Index.md`
- `docs/01-TRD` ~ `docs/09-UI`（设计文档）
- `docs/10-开发规范` / `docs/11-组件装配` / `docs/12-目录治理`（待创建）
- `.pi/skills/*/SKILL.md`（待创建）
- `scripts/verify.mjs` / `scripts/check-docs-governance.mjs` / `scripts/check-contract-coverage.mjs`（待创建）

### 11.2 修订纪律

- 不得删除历史决策来"让文档看起来一致"
- 冲突必须通过新增决策记录和显式 `supersedes` 关系解决
- 每次修订在 §12 修订记录中登记

### 11.3 用户授权

用户指令与本文件冲突时，**先明确确认才能覆盖**。不得凭推测扩大用户授权范围。

### 11.4 设计阶段与治理基线的交叉审查（元纪律）

设计阶段闭环、治理基线建立或重大修订、里程碑退出门禁，必须经 **≥2 个独立审查者交叉核对**才能定案。

**为什么**：单审查者（人或 AI）的盲区是结构性的。2026-08-07 省察中，3 个 AI 审查者共发现 25 处洞，重叠仅 4 处——任一单点审查都会漏掉大部分问题。

**适用场景**：
- 设计文档体系闭环（00-09 全部审查批准时）
- 治理基线建立或重大修订（AGENTS.md / 治理脚本 / 治理 Skills）
- 里程碑退出门禁（M0-M3 完成）

**执行方式**：
- 至少 2 个独立审查者（不同 AI 会话 / 不同人 / AI+人组合）
- 各自独立输出洞集，再合并去重
- 交叉核对待办清单（非穷尽）：版本登记一致性、文件落位（无幽灵副本）、自指断言真实性、编号连续性、跨文档契约对齐、计划状态与实际实现一致性
- 洞未处置前不得报告"已完成"

**记录**：交叉审查结论写入对应文档版本历史或 `.record/` 实施记录。

---

## §12 修订记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v0.1.9 | 2026-08-07 | §3.1 版本登记同步：00-索引 v0.1.28（T-M1-001 S1 学习节奏工具注册 + API 完成）+ 04-Todo v0.1.17（§7.2.1 M1 任务登记表 T-M1-001 done + §9 统计 M1 1 done）。原因：T-M1-001 收尾同步版本号 + M1 首任务完成。影响：仅版本号同步 + 04-Todo 权威范围补 §7.2.1，无其他权威条款变更。依据：§11.2 修订纪律 + §3.1 表格维护要求 |
| v0.1.8 | 2026-08-07 | §3.1 版本登记同步：00-索引 v0.1.27（T-M0-009 M0 系统冒烟完整完成）+ 04-Todo v0.1.15（§6.0 M0 完成与版本演进说明 + §9 统计口径修正 + 头部版本号滞后修正）。原因：T-M0-009 收尾同步版本号 + M0 收官。影响：仅版本号同步 + 04-Todo 权威范围补 §6.0，无其他权威条款变更。依据：§11.2 修订纪律 + §3.1 表格维护要求 |
| v0.1.7 | 2026-08-07 | §3.1 版本登记同步：00-索引 v0.1.26（T-M0-008 09-UI 三栏布局 + 标签页骨架完成）+ 04-Todo v0.1.13（T-M0-001/002/003/004/005/006/007/008 done）。原因：T-M0-008 收尾同步版本号。影响：仅版本号同步，无权威条款变更。依据：§11.2 修订纪律 + §3.1 表格维护要求 |
| v0.1.6 | 2026-08-07 | §3.1 版本登记同步：00-索引 v0.1.25（T-M0-007 studybuddy-extension 空壳完成）+ 04-Todo v0.1.11（T-M0-001/002/003/004/005/006/007 done）。原因：T-M0-007 收尾同步版本号。影响：仅版本号同步，无权威条款变更。依据：§11.2 修订纪律 + §3.1 表格维护要求 |
| v0.1.5 | 2026-08-07 | §3.1 版本登记同步：00-索引 v0.1.24（T-M0-005 file-watch 完成）+ 04-Todo v0.1.9（T-M0-001/002/003/004/005/006 done）。原因：前序任务（T-M0-003/004/005）收尾时未同步 §3.1 版本号，导致登记滞后。影响：仅版本号同步，无权威条款变更。依据：§11.2 修订纪律 + §3.1 表格维护要求 |
| v0.1.4 | 2026-08-07 | §10 开发命令由"M0 启动后补全"落定为"M0 已启动"：补全 pnpm 命令清单（install/dev/build/type-check/test/smoke/verify）+ 专项校验脚本 + 质量门阶段说明 |
| v0.1.3 | 2026-08-07 | §3.1 版本登记同步：01-TRD v0.2.2（§7 加决策 6 v0.1 交付形态：源码形态不打包 .exe）+ 00-索引 v0.1.18 |
| v0.1.2 | 2026-08-07 | 省察修复批次：§3.1 版本登记同步（00-索引 v0.1.17 / 04-Todo v0.1.2）；新增 §11.4 交叉审查元纪律（≥2 独立审查者）；删除未登记的 CLAUDE.md 幽灵治理资产；治理脚本 check-docs-governance.mjs 加文档位置校验；.gitignore 补 .workbuddy/；T-M0-010 重编号为 T-M0-009 纠正跳号笔误；清空前序会话违规写入的 src/tests/6 源文件 + 6 配置文件（违反 §4.4 单一任务门禁与 §5.1 TDD 纪律） |
| v0.1.1 | 2026-08-07 | §3.3 治理资产清单从"📝 待创建"全部更新为"✅ 已创建/已就绪"（五批治理资产分批推进完成）；§10 当前阶段补 design 阶段三个 node 脚本命令；新增 `.plan/` 和 `.record/` 两项资产登记 |
| v0.1.0 | 2026-08-07 | 初始草案：12 章仓库操作宪章。参考 ai-malf-riskbench AGENTS.md（13 章结构 + 权威链 + 单一任务门禁 + 受控收尾）+ pi AGENTS.md（对人+agent 同约束）+ ai-studybuddy（16 步流程 + 组件装配）+ pi-desktop（verify.mjs + contract 校验）。适配 pi-studybuddy 单人单机单写场景，落地"拆分→小组件→组合"宗旨 |
