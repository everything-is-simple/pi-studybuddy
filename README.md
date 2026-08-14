# pi-studybuddy

**专属学习伙伴** — 以 pi coding agent 为 AI 底座的 Windows 单机桌面学习应用

**版本**：v0.1.1 ✅ 已审查批准（v0.1.0 用户 2026-08-07 批准；v0.1.1 治理体系五批资产全部就绪同步）
**日期**：2026-08-07
**许可**：待定（参考仓库：pi MIT / pi-desktop Apache-2.0 / pi-skills MIT）

---

## 项目定位

pi-studybuddy = **pi（AI 底座）+ pi-skills（组件供给）+ StudyBuddy 业务能力（内核）+ pi-desktop 式桌面壳（使用者介面）**

服务一名在 Windows 本机学习的学生，把课程/考试目标、学习节奏、资料笔记、练习、错题和考前冲刺连成可持续闭环；家长接收脱敏异步摘要。

### 核心特色

- **💬 对话默认主入口**：应用启动即打开"💬 对话"标签页，承载 pi 原生 AI 对话能力（流式回复 / 工具调用视图 / @文件引用 / 多模型切换），学生可零碎问答，AI 自主调用 S1-S7 全部工具
- **双层并存**：对话 Tab（自由探索）+ S1-S7 结构化标签页（学习闭环）数据贯通
- **规则优先、AI 辅助**：批改/聚合/速背卡由确定性规则负责，AI 只负责受约束生成或润色，失败降级为规则输出
- **隐私边界严格**：作答前 DTO 防泄露、家长报告脱敏、UUID 泄漏检测、AI 日志 allowlist
- **单机单用户单写**：无多用户、无远程协作、无公网入口

### 与 ai-studybuddy 的关系

**业务认知迁移、实现重构**。ai-studybuddy 已完成 S1-S7 原型验证（342 后端 + 149 前端 + 24 E2E 基线）；pi-studybuddy 以 pi 为底座重新组装，不复制其实现。

---

## 文档体系（01-13 ✅ 已审查批准）

| # | 文档 | 版本 | 权威范围 |
|---|---|---|---|
| 00 | [文档索引](./docs/00-文档索引-Index.md) | v0.1.16 | 文档导航 + 门禁 + 版本历史 |
| 01 | [TRD 技术需求](./docs/01-TRD-技术需求-Technical-Requirements.md) | v0.2.1 | 技术底座 + 五点定案决策 |
| 02 | [PRD 产品需求](./docs/02-PRD-产品需求-Product-Requirements.md) | v0.1.3 | 业务闭环 + §3.11 对话默认主入口 |
| 03 | [架构设计](./docs/03-架构设计-Architecture-Design.md) | v0.1.1 | 四层架构 + pi 扩展 + §6.7 会话管理 |
| 04 | [任务清单](./docs/04-任务清单-Todo-List.md) | v0.1.1 | 任务登记 + 组件治理看板 + 里程碑 M0-M3 + §1.4 治理体系就绪状态 |
| 05 | [数据模型 ERD](./docs/05-数据模型-ERD-Data-Model.md) | v0.1.1 | 全局库 + 学期库 + 三层记忆 |
| 06 | [API 契约](./docs/06-API契约-API-Contracts.md) | v0.1.1 | RPC 契约 + 100+ 方法 + 9 Streams |
| 07 | [工作流](./docs/07-工作流-Workflow.md) | v0.1.1 | 学生主路径 + 对话路径 + 11 状态机 |
| 08 | [测试验收](./docs/08-测试验收-Test-Plan.md) | v0.1.1 | 测试金字塔 + 四层分层 + 安全不变量 |
| 09 | [UI 设计](./docs/09-使用者介面-UI-Design.md) | v0.1.2 | 三栏布局 + 💬 对话默认 Tab + S1-S7 标签页 |
| 13 | [测试与运维](./docs/13-测试与运维-Testing-and-Operations.md) | ✅ v0.1.1 已审查批准 | 用户动作、错误归属、数据资产/SQLite 生命周期、真实测试、真机 UAT 与发布运维门禁 |

### 治理资产（✅ 已就绪，分五批创建完成）

| 文件 | 状态 | 作用 |
|---|---|---|
| `AGENTS.md` | ✅ v0.1.1 已审查批准 | 仓库操作宪章 |
| `README.md`（本文件） | ✅ v0.1.0 已审查批准 | 项目总览 |
| `docs/10-开发规范` | ✅ v0.1.0 已审查批准 | 16 步开发流程 |
| `docs/11-组件装配` | ✅ v0.1.0 已审查批准 | 先分解再组合 SoT |
| `docs/12-目录治理` | ✅ v0.1.0 已审查批准 | 目录职责隔离 |
| `.pi/skills/*` | ✅ 已创建 | 治理用 Skill（task-complete / component-assembly） |
| `.pi/prompts/*` | ✅ 已创建 | 工作流模板（wr / plan） |
| `scripts/verify.mjs` | ✅ 已创建 | 统一质量门（design/m0/full 阶段自适应） |
| `scripts/check-docs-governance.mjs` | ✅ 已创建 | 文档治理检查（9 项） |
| `scripts/check-contract-coverage.mjs` | ✅ 已创建 | 契约 AST 校验（M0 后启用完整校验） |
| `.plan/` | ✅ 已就绪 | 任务计划目录（00-当前任务.md 占位无任务） |
| `.record/` | ✅ 已就绪 | 实施记录目录（待首任务收尾写入） |

---

## 快速开始

### 前置条件（M0 启动时确认）

- Windows 10/11（单机桌面）
- Node.js >= 20.6（本项目基线 Node 24）
- Python 3.10+（OCR venv / WPS COM 桥 / whisper.cpp）
- WPS Office（doc/ppt/xls 转换，本机已装）
- Git

### 当前阶段（设计完成 + 治理体系就绪，待启动 M0）

```bash
# 克隆仓库
git clone https://github.com/everything-is-simple/pi-studybuddy.git
cd pi-studybuddy

# 阅读文档（按 AGENTS.md §0 强制入口顺序）
# 1. AGENTS.md
# 2. docs/00-文档索引-Index.md
# 3. docs/04-任务清单-Todo-List.md
# 4. .plan/00-当前任务.md（若存在）
# 5. 相关设计文档

# 文档治理检查（design 阶段即可用）
node scripts/check-docs-governance.mjs

# 契约校验（M0 骨架 src/contract/api.ts 就绪后自动启用完整校验）
node scripts/check-contract-coverage.mjs

# 统一质量门（按阶段自适应：design / m0 / full）
node scripts/verify.mjs
```

### M0 启动后（待补全）

```bash
# 待 M0 骨架搭建启动时补全
# pnpm install
# pnpm dev
# pnpm verify
```

---

## 仓库结构

```
pi-studybuddy/
├── AGENTS.md                    # 仓库操作宪章（对人+agent 同约束）
├── README.md                    # 项目总览（本文件）
├── .gitignore
│
├── docs/                        # 设计/治理文档（01-12 ✅ 已审查批准；13 📝 待审查）
│   ├── 00-文档索引-Index.md
│   ├── 01-TRD-技术需求.md
│   ├── 02-PRD-产品需求.md
│   ├── 03-架构设计.md
│   ├── 04-任务清单-Todo-List.md
│   ├── 05-数据模型-ERD.md
│   ├── 06-API契约.md
│   ├── 07-工作流.md
│   ├── 08-测试验收.md
│   ├── 09-使用者介面-UI-Design.md
│   ├── prep-参考点核对表.md
│   ├── 10-开发规范.md            # ✅ v0.1.0 已审查批准
│   ├── 11-组件装配.md            # ✅ v0.1.0 已审查批准
│   ├── 12-目录治理.md            # ✅ v0.1.0 已审查批准
│   └── 13-测试与运维.md          # ✅ v0.1.1 已审查批准
│
├── .pi/                         # pi 生态治理资产（✅ 已就绪）
│   ├── skills/                  # 治理用 Skill
│   │   ├── studybuddy-task-complete/SKILL.md
│   │   └── studybuddy-component-assembly/SKILL.md
│   └── prompts/                 # 工作流模板
│       ├── wr.md                # Wrap it 收尾
│       └── plan.md               # 创建任务计划
│
├── scripts/                     # 自动化门禁（✅ 已就绪）
│   ├── verify.mjs               # 统一质量门（design/m0/full 阶段自适应）
│   ├── check-docs-governance.mjs # 文档治理检查（9 项）
│   └── check-contract-coverage.mjs # 契约 AST 校验（M0 后启用）
│
├── .plan/                       # 任务计划（✅ 已就绪，无执行中任务）
│   ├── 00-当前任务.md           # 当前任务指针
│   └── README.md                # 目录说明 + 单一任务门禁
│
├── .record/                     # 实施记录（✅ 已就绪，待首任务收尾写入）
│   └── README.md                # 目录说明 + 8 章节模板
│
└── src/                         # 源码（M0 启动后创建）
    ├── contract/                # 类型化 IPC 契约（借鉴 pi-desktop）
    ├── main/                    # Electron 主进程
    ├── preload/                 # 安全桥接
    ├── agent-host/              # utilityProcess 跑 Pi Coding Agent
    ├── renderer/                # React UI
    └── shared/                  # 可测试纯函数与共享模块
```

---

## 里程碑规划（04-Todo §6）

| 里程碑 | 目标 | 退出门槛 |
|---|---|---|
| **M0 骨架** | Electron 四进程 + 五件骨架 + 数据层 + 扩展层空壳 | 应用可启动 + RPC 通 + 建库 + 安全六条 |
| **M1 核心闭环** | S1→S2→S3→S4 最小可用学习闭环 | E2E-01~03 + 防泄露断言 |
| **M2 完整闭环** | S5-S7 + TTS + 备份恢复 | E2E-01~09 + UUID 检测 |
| **M3 对话与打磨** | 💬 对话 Tab + 安全/性能/体验打磨 | E2E-10~13 + v0.1 候选 |

---

## 技术底座（01-TRD §7 已定案）

| 决策项 | 定案 | 理由 |
|---|---|---|
| AI 底座 | `@earendil-works/pi-coding-agent` | 不修改内核，通过 registerTool/扩展/技能接入 |
| WPS COM 桥 | Python pywin32 子进程 | 复用 OCR venv Python 运行时，零新依赖 |
| 桌面壳 | 取 pi-desktop 架构自建业务化壳 | 五件骨架直接搬运改名，业务层独立自建 |
| 数据隔离 | `~/.pi` 与业务数据根物理隔离 | pi 自管会话目录，业务数据根 `%LOCALAPPDATA%\PiStudyBuddy` |
| TTS 引擎 | SAPI 默认 + edge-tts 可选 skill | Windows SAPI 系统自带零依赖、离线可用 |
| 文档语言 | 中文优先 | 学生用户母语中文；代码标识符英文，注释中文 |

---

## 治理纪律（AGENTS.md 摘要）

1. **文档优先，禁止依赖聊天记忆** — 按 AGENTS.md §0 强制入口顺序读文档
2. **单一执行任务门禁** — `.plan/` 同一时刻只允许一个执行中任务
3. **TDD 强制** — RED → GREEN → REFACTOR
4. **拆分 → 小组件 → 组合** — 组件先在试炼场单件调通，再 Adapter 装配进主仓
5. **五阶段不可跳越** — 下载储存 → 单件 → 集成 → 组装 → 冒烟E2E
6. **受控收尾** — 复验 → 更新 04-Todo → 创建 .record → 停止
7. **自动化门禁** — verify.mjs + check-docs-governance.mjs + check-contract-coverage.mjs
8. **AGENTS.md 对人+agent 同约束** — 作为 context file 自动注入

详见 [AGENTS.md](./AGENTS.md)。

---

## 参考仓库

| 仓库 | 路径 | 用途 |
|---|---|---|
| pi | `H:\pi-references\pi` | AI 底座 + AGENTS.md 范式 + extensions/skills 规范 |
| inno-agent | `H:\pi-references\inno-agent` | 业务化范本 + 工作区级治理 |
| pi-desktop | `H:\pi-references\pi-desktop` | 桌面壳架构 + contract + verify.mjs 范式 |
| pi-skills | `H:\pi-references\pi-skills` | 技能供给 + SKILL.md 格式 |
| ai-studybuddy | `H:\ai-studybuddy` | 业务认知来源（不复制实现） |
| ai-malf-riskbench | `Z:\ai-malf-riskbench` | 治理范式参考（AGENTS.md / .plan / .record） |

---

## 版本历史

| 版本 | 日期 | 变更 |
|---|---|---|
| v0.1.1 | 2026-08-07 | 治理体系五批资产全部就绪同步：§治理资产表 12 项资产全部 ✅；§仓库结构图同步 .plan/.record/scripts/.pi 状态；§当前阶段补三条 node 脚本命令；§文档体系 04-Todo 版本号同步 v0.1.1（追加 §1.4 治理体系就绪状态） |
| v0.1.0 | 2026-08-07 | 初始草案：项目定位 + 文档体系导航 + 仓库结构 + 里程碑规划 + 技术底座定案 + 治理纪律摘要。设计阶段 10 文档全部审查批准，待启动 M0 骨架开发 |
