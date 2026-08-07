# 04 任务清单

**版本**：v0.1.25
**日期**：2026-08-07
**状态**：✅ 已审查批准（v0.1.0 里程碑划分/任务大纲粒度/task-id 规范/完成门槛四项通过；v0.1.1 追加 §1.4 治理体系就绪状态；v0.1.2 纠正 T-M0-009 跳号笔误；v0.1.3 登记 T-M0-001 完成；v0.1.4 登记 T-M0-002 完成；v0.1.5 登记 T-M0-006 完成；v0.1.6 登记 T-M0-003 完成；v0.1.7 登记 T-M0-004 完成；v0.1.8 登记 T-M0-005 开工；v0.1.9 登记 T-M0-005 完成；v0.1.10 登记 T-M0-007 开工 + §4.1 看板 pi 修正；v0.1.11 登记 T-M0-007 完成 + §4.1 看板 pi 标记阶段1/3 ✅；v0.1.12 登记 T-M0-008 开工；v0.1.13 登记 T-M0-008 完成；v0.1.14 登记 T-M0-009 开工；v0.1.15 登记 T-M0-009 完成 + §6.0 M0 完成与版本演进说明 + 头部版本号滞后修正；v0.1.16 登记 T-M1-001 开工 + 前置 DTO 对齐 schema + §7.2.1 M1 任务登记表；v0.1.17 登记 T-M1-001 完成 + §9 统计 M1 1 done；v0.1.18 登记 T-M1-002 开工 + 前置 DTO 对齐 schema；v0.1.19 登记 T-M1-002 完成 + §9 统计 M1 2 done；v0.1.20 登记 T-M1-003 开工 + §7.2.1 M1 任务登记表；v0.1.21 登记 T-M1-003 完成 + §9 统计 M1 3 done；v0.1.22 登记 T-M1-004 开工 + §7.2.1 M1 任务登记表；v0.1.23 登记 T-M1-004 完成 + §9 统计 M1 4 done；v0.1.24 登记 T-M2-001 完成 + §7.3.1 M2 任务登记表 + §9 统计 M2 1 done；v0.1.25 登记 T-M2-002 完成 + §7.3.1 M2 任务登记表 T-M2-002 done + §9 统计 M2 2 done）
**上游**：[01-TRD v0.2.1](./01-TRD-技术需求-Technical-Requirements.md)、[02-PRD v0.1.3](./02-PRD-产品需求-Product-Requirements.md)、[03-Architecture v0.1.1 §9](./03-架构设计-Architecture-Design.md)、[05-ERD v0.1.1](./05-数据模型-ERD-Data-Model.md)、[06-API v0.1.1](./06-API契约-API-Contracts.md)、[07-Workflow v0.1.1](./07-工作流-Workflow.md)、[08-Test v0.1.1 §11](./08-测试验收-Test-Plan.md)、[09-UI v0.1.2](./09-使用者介面-UI-Design.md)
**用途**：从设计文档到实现代码的执行桥梁——任务登记、组件治理状态跟踪、完成门槛门禁、修复证据记录

---

## 1. 概述

### 1.1 文档定位

04-Todo 是 pi-studybuddy 从"设计定案"走向"代码实现"的执行操作文档。它不重复设计文档的内容，而是：

- **登记**：每个开发任务有唯一 task-id，记录其分类、优先级、状态、关联文档
- **跟踪**：每个组件在五阶段组件治理中的当前位置（下载储存→单件→集成→组装→冒烟E2E）
- **门禁**：定义每个阶段的进入/退出条件和合并到 master 的门槛
- **取证**：冒烟失败修复记录写本文件作为证据（08-Test §11.3）

### 1.2 与其他文档的关系

```
设计定案层                    执行操作层                   代码实现层
┌─────────────┐              ┌───────────┐              ┌──────────┐
│ 01-TRD 定案  │              │           │              │ src/     │
│ 02-PRD       │ ──推导任务──→ │ 04-Todo   │ ──指导开发──→ │ tests/   │
│ 03-Arch      │              │           │              │ scripts/ │
│ 05-ERD       │              │           │              └──────────┘
│ 06-API       │              └───────────┘
│ 07-Workflow  │                   ↑
│ 08-Test      │              修复证据回写（§8）
│ 09-UI 定案   │              （08-Test §11.3）
└─────────────┘
```

### 1.3 任务铁律

1. **五阶段不可跳越**：任何组件必须走完下载储存→单件→集成→组装→冒烟E2E 五阶段（00 索引 §四）
2. **任一阶段失败退回上一阶段**：不进 master（08-Test §11.2）
3. **task-id 全局唯一**：运行数据隔离 `H:\pi-studybuddy-tmp\runs\<task-id>` 依赖此 id（00 索引 §五）
4. **壳层先于业务**：装配顺序 main+preload+renderer+agent-host+contract → 公用零件 → 业务模块（03-Architecture §9.2）
5. **修复留证据**：冒烟失败修复记录写 §8，可审计可追溯
6. **任务状态实时更新**：任务状态变更同步到本文件，不另立跟踪系统

### 1.4 治理体系就绪状态（M0 启动前置）

> 截至 2026-08-07，pi-studybuddy 治理体系已全部就绪，可启动 M0 骨架开发。

| 类别 | 资产 | 状态 |
|---|---|---|
| 仓库宪章 | [AGENTS.md](../AGENTS.md) v0.1.0 | ✅ 已审查批准 |
| 项目总览 | [README.md](../README.md) v0.1.0 | ✅ 已审查批准 |
| 开发规范 | [docs/10-开发规范](../docs/10-开发规范-Dev-Rules.md) v0.1.0 | ✅ 已审查批准 |
| 组件装配 | [docs/11-组件装配](../docs/11-组件装配-Component-Assembly.md) v0.1.0 | ✅ 已审查批准 |
| 目录治理 | [docs/12-目录治理](../docs/12-目录治理-Directory-Governance.md) v0.1.0 | ✅ 已审查批准 |
| 治理 Skills | [.pi/skills/studybuddy-task-complete](../.pi/skills/studybuddy-task-complete/SKILL.md) + [studybuddy-component-assembly](../.pi/skills/studybuddy-component-assembly/SKILL.md) | ✅ 已创建 |
| 工作流模板 | [.pi/prompts/wr.md](../.pi/prompts/wr.md) + [plan.md](../.pi/prompts/plan.md) | ✅ 已创建 |
| 治理脚本 | [scripts/verify.mjs](../scripts/verify.mjs) + [check-docs-governance.mjs](../scripts/check-docs-governance.mjs) + [check-contract-coverage.mjs](../scripts/check-contract-coverage.mjs) | ✅ 已创建并试运行通过（design 阶段） |
| 任务计划目录 | [.plan/](../.plan/) | ✅ 已就绪（无执行中任务） |
| 实施记录目录 | [.record/](../.record/) | ✅ 已就绪（空，待 M0 首任务收尾写入） |

**启动 M0 的前置条件已全部满足**：
- 设计阶段 10 文档全部 ✅ 已审查批准（详见 [00-索引 §七](../docs/00-文档索引-Index.md)）
- 治理体系 5 类资产全部就绪
- 用户已批准治理体系（分五批推进，全部审查通过）

**下一步**：等待用户明确选择 M0 首个任务（建议 `T-M0-001 Electron 四进程骨架`）并批准开工。

---

## 2. 任务登记规范

### 2.1 task-id 命名规则

```
T-<里程碑>-<序号>

里程碑：M0（骨架）/ M1（核心闭环）/ M2（完整闭环）/ M3（对话与打磨）
序号：三位数字，按里程碑内登记顺序递增

示例：T-M0-001、T-M1-042、T-M3-103
```

### 2.2 任务字段

每个任务登记以下字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `task-id` | string | 唯一标识（§2.1 规则） |
| `标题` | string | 中文简述，一行内说清做什么 |
| `分类` | enum | 壳层 / 扩展层 / 业务Adapter / 数据层 / 测试 / 文档 |
| `子系统` | enum | S1-S7 / TTS / 备份恢复 / 对话 / 壳 / 跨切 |
| `优先级` | enum | P0（阻塞）/ P1（必须）/ P2（应该）/ P3（可选） |
| `状态` | enum | pending / in_progress / testing / done / blocked |
| `治理阶段` | enum | 阶段1-5（当前所处五阶段位置） |
| `关联文档` | string | 依据的设计文档章节（如 03-Arch §6.1） |
| `产物` | string | 完成后产出的文件/模块 |
| `证据` | string | 测试通过截图/日志链接、修复记录（§8 引用） |
| `备注` | string | 阻塞原因、依赖关系等 |

### 2.3 任务状态机

```
pending → in_progress → testing → done
              ↑              │
              │              ↓
              └──── blocked ──┘
                  （修复后回 in_progress）
```

| 状态 | 含义 | 进入条件 |
|---|---|---|
| `pending` | 未开始 | 任务登记后默认 |
| `in_progress` | 开发中 | 开始编码 |
| `testing` | 测试中 | 代码完成，进入五阶段测试 |
| `done` | 已完成 | 五阶段全通过 + 合并门槛满足（§5） |
| `blocked` | 阻塞 | 依赖未就绪 / 测试失败退回修复 |

---

## 3. 任务分类体系

### 3.1 按架构层分类（03-Architecture §1 四层架构）

| 分类 | 范围 | 装配顺序 |
|---|---|---|
| **壳层** | main + preload + renderer + agent-host + contract + 安全沙箱 + toolchain + credential-vault + file-watch | 第 1 位（03-Arch §9.2） |
| **扩展层** | studybuddy-extension（registerTool + pi.on 钩子 + pi-ai provider） | 第 2 位 |
| **业务 Adapter** | S1-S7 工具 + TTS + 备份恢复 + WPS COM/whisper.cpp/OCR 桥 + workspace-path-guard | 第 3 位 |
| **数据层** | global.db + semester.db + 三层记忆 + credential-vault 存储 + 备份 zip | 与壳层并行 |

### 3.2 按子系统分类（02-PRD §3 业务闭环）

| 子系统 | 业务 | 关键文档 |
|---|---|---|
| **S1** | 学习节奏（学期/课程/考试/课表/任务/每日首页） | 07-Workflow §2.2 |
| **S2** | 资料笔记（上传/转换/AI笔记/知识模块/导图） | 07-Workflow §2.3 |
| **S3** | 限时练习（出题/作答/规则批改/结果） | 07-Workflow §2.4 |
| **S4** | 错题改错（幂等归档/错因/重做/薄弱点） | 07-Workflow §2.5 |
| **S5** | 期末冲刺（模拟考/速背卡/冲刺计划） | 07-Workflow §2.6 |
| **S6** | 家长报告（规则生成/冻结/脱敏/投递） | 07-Workflow §3 |
| **S7** | 课堂采集（许可确认/PCM WAV/whisper.cpp/handoff） | 07-Workflow §2.7 |
| **TTS** | 跨子系统朗读（SAPI/edge-tts/控制条/已复习标记） | 07-Workflow §4 |
| **备份恢复** | 手动/定期/归档备份 + 恢复 | 07-Workflow §5 |
| **对话** | 💬 对话 Tab（pi 原生 AI 对话默认主入口） | 07-Workflow §2.8 |
| **壳** | Electron 壳 + 五件骨架 | 03-Arch §6 |
| **跨切** | 安全不变量 / observability / 调度层 | 03-Arch §7-§8 |

### 3.3 按装配阶段分类（03-Architecture §9.1 五阶段）

| 阶段 | 内容 | 产物 |
|---|---|---|
| **1. 下载储存** | pi / pi-skills / pi-desktop / inno-agent / OCR venv / whisper.cpp | `H:\pi-references\*` + `node_modules` + venv |
| **2. 单件测试** | 每个工具契约断言 / 每个引入技能夹具 / 外部桥 Adapter | 独立冒烟 + 合成夹具 |
| **3. 集成测试** | extension×pi 底座 / 工具×pi.on 钩子 / createAgentSession | 契约验证 |
| **4. 系统配件组装** | 进入主仓 src/ + ~/.pi/agent/skills/ | Adapter/扩展代码 |
| **5. 冒烟 + E2E** | S1-S7 全链路 / TTS / 备份恢复 / 脱敏 / 安全不变量 | 全链回归 |

---

## 4. 组件治理状态看板

### 4.1 看板格式

每个组件跟踪其在五阶段中的当前位置：

| 组件 | 阶段1 下载 | 阶段2 单件 | 阶段3 集成 | 阶段4 组装 | 阶段5 冒烟E2E | 状态 |
|---|---|---|---|---|---|---|
| `pi`（npm dependencies） | ✅ | — | ✅ | — | — | T-M0-007 已安装 + 集成契约验证 |
| `pi-skills`（git clone） | ✅ | — | — | — | — | 已下载 |
| `pi-desktop` 骨架 | ✅ | — | — | — | — | 已下载 |
| `inno-agent` 范本 | ✅ | — | — | — | — | 已下载 |
| OCR venv | ✅ | — | — | — | — | 已下载 |
| whisper.cpp | ✅ | — | — | — | — | 已下载 |
| WPS COM 桥 | — | — | — | — | — | 待启动 |
| ... | | | | | | |

> 阶段标记：✅ 通过 / ⏳ 进行中 / ❌ 失败待修复 / — 未进入 / ⏭️ 跳过（不适用）

### 4.2 组件清单（初始，随开发推进动态更新）

**参考仓库组件**（阶段1 已完成）：
- `pi`（`@earendil-works/pi-coding-agent`）—— AI 底座
- `pi-skills`（badlogic）—— transcribe / browser-tools / youtube-transcript
- `pi-desktop`（DLYZZT）—— 五件骨架范本
- `inno-agent`（hhyqhh）—— 架构范本

**自建组件**（需走五阶段）：
- 桌面壳五件：contract / host-manager / credential-vault / toolchain / file-watch
- pi 扩展层：studybuddy-extension（registerTool + pi.on 钩子）
- 业务工具：S1-S7 全量 registerTool 工具（约 30 个）
- TTS skill：SAPI + edge-tts
- 备份恢复：zip 打包 + 恢复 + 调度
- 外部桥：WPS COM（pywin32）/ whisper.cpp / OCR venv
- 安全脚本：check-desktop-security.mjs（六条不变量）

---

## 5. 完成门槛（门禁）

### 5.1 五阶段进入/退出条件（03-Arch §9.1 + 08-Test §11.2）

| 阶段 | 进入条件 | 退出条件（门槛） |
|---|---|---|
| **1. 下载储存** | 组件已识别 | 组件在 `H:\pi-references\*` 或 `node_modules` / venv 中可用 |
| **2. 单件测试** | 阶段1 完成 | 独立冒烟通过 + 合成夹具断言全过（08-Test §3） |
| **3. 集成测试** | 阶段2 完成 | extension×pi 底座契约验证通过 + 钩子协作断言全过（08-Test §4） |
| **4. 系统组装** | 阶段3 完成 | 代码进入主仓 src/ + 类型检查通过 + lint 通过 |
| **5. 冒烟+E2E** | 阶段4 完成 | 系统冒烟通过 + 受影响 E2E 通过 + 安全不变量六条全过（08-Test §5） |

### 5.2 合并到 master 的门槛（08-Test §11.1）

- [ ] 全部单件测试通过（vitest + pytest）
- [ ] 全部集成测试通过
- [ ] 系统冒烟全部通过
- [ ] 安全不变量校验脚本六条断言全过
- [ ] 受影响子系统的 E2E 通过
- [ ] `git diff --check` 无空白错误
- [ ] 不提交：真实密钥/.env.local/资料原文/完整 UUID/node_modules

### 5.3 退回机制（08-Test §11.2）

```
阶段2 单件失败 → 修复组件 → 重跑单件（不退回阶段1）
阶段3 集成失败 → 退回单件 → 重跑集成
阶段5 冒烟/E2E 失败 → 退回集成 → 重跑冒烟
```

**退回时**：
- 任务状态改为 `blocked`
- 修复记录写入 §8
- 修复后状态改回 `in_progress`，重走当前阶段

---

## 6. 里程碑规划

> 依据 03-Architecture §9.2 装配顺序（壳层→公用零件→业务模块）+ ai-studybuddy 已验证 S1-S7 业务认知。

### 6.0 M0 完成与版本演进说明（01-TRD §7 决策 6 约定）

**M0 骨架搭建已于 2026-08-07 完成**（T-M0-001 ~ T-M0-009 全部 done）。

**退出门槛六项全部通过**（§6.2 + 08-Test §5）：
- ✅ Electron 应用可启动（build 产物齐全 + main 入口可加载，`pnpm dev` 人工验证）
- ✅ contract RPC 可 renderer→main→agent-host 往返（`system.ping` 冒烟通过）
- ✅ global.db + semester.db 可建库（4 表 + 25 表 + integrity_check 通过）
- ✅ credential-vault 可加密/解密往返（safeStorage set→get 一致 + 磁盘无明文 + 键名校验）
- ✅ 安全不变量校验脚本六条全过（INV-01~06 硬断言，T-M0-009 补全 INV-06）
- ✅ M0 系统冒烟通过（`pnpm smoke` 六项全过，退出码 0）

**版本演进**（01-TRD §7 决策 6：v0.1 交付形态为源码形态，不打包 .exe）：
- v0.1 交付：源码形态运行（`pnpm install && pnpm dev`），不打包 .exe 安装包
- 依据：AGENTS.md §1.2（v0.1 禁用运行级使用）+ §6.4（禁止提前设计 v0.2+ 产品化机制）
- v0.2+ 产品化（打包/签名/自动更新）延后至用户明确需求时启动

**M0 交付的九个任务**（详见 §7.1.1 登记表）：
| task-id | 标题 | commit |
|---|---|---|
| T-M0-001 | Electron 四进程骨架 + 自研 RPC + 最小 contract | 37e85e6 |
| T-M0-002 | contract 类型化契约面（api 126 方法 + types + streams + PiBridge） | 53942d8 |
| T-M0-003 | credential-vault（safeStorage/DPAPI 密钥库） | fb76ecf |
| T-M0-004 | toolchain 发现-探测-安装-绝对路径执行框架 | edb181b |
| T-M0-005 | file-watch（fs.watch recursive + 100ms 防抖） | 47a2357 |
| T-M0-006 | 数据层 schema（global.db + semester.db + L3 三层记忆） | de70670 |
| T-M0-007 | studybuddy-extension 空壳 | b0d7d55 |
| T-M0-008 | 09-UI 三栏布局 + 标签页骨架 | 034969c |
| T-M0-009 | M0 系统冒烟完整 | （本任务） |

### 6.1 里程碑总览

```
M0 骨架搭建          M1 核心闭环 MVP      M2 完整闭环          M3 对话与打磨
┌──────────┐        ┌──────────┐        ┌──────────┐        ┌──────────┐
│ Electron │        │ S1 学期   │        │ S5 冲刺   │        │ 💬 对话   │
│ 四进程   │ ──→   │ S2 笔记   │ ──→   │ S6 报告   │ ──→   │ 安全不变量│
│ 五件骨架 │        │ S3 练习   │        │ S7 采集   │        │ E2E 全链  │
│ 数据层   │        │ S4 错题   │        │ TTS/备份  │        │ 优化打磨  │
└──────────┘        └──────────┘        └──────────┘        └──────────┘
```

### 6.2 M0：骨架搭建

**目标**：Electron 桌面壳可启动，数据层 schema 可建库，contract RPC 可通

**范围**：
- Electron 四进程骨架（main + preload + renderer + agent-host）
- contract 类型化 IPC + RPC 层
- 安全沙箱（sandbox:true + 严格 CSP + preload 受控桥接）
- toolchain 发现（Node/Python/uv/Git/WPS/whisper.cpp）
- credential-vault（safeStorage/DPAPI）
- file-watch（fs.watch recursive + 100ms 防抖）
- 数据层基础（global.db schema + semester.db schema + 三层记忆 schema + PRAGMA）
- pi 扩展层空壳（createStudyBuddyExtension 可 setup 但无业务工具）
- 09-UI 三栏布局 + 标签页骨架（无业务内容）

**退出门槛**：
- [ ] Electron 应用可启动
- [ ] contract RPC 可 renderer→main→agent-host 往返
- [ ] global.db + semester.db 可建库
- [ ] credential-vault 可加密/解密往返
- [ ] 安全不变量校验脚本六条全过
- [ ] M0 系统冒烟通过

### 6.3 M1：核心闭环 MVP

**目标**：S1→S2→S3→S4 最小可用学习闭环可走通

**范围**：
- S1 学期初始化（建学期/课程/课表 OCR/考试确认/每日首页）
- S2 资料笔记（上传/转换/AI 笔记生成/知识模块/导图）
- S3 限时练习（出题/作答/规则批改/结果展示）
- S4 错题改错（幂等归档/错因建议/学生确认/重做/薄弱点）
- WPS COM 桥（doc/ppt/xls 转换）
- OCR venv Adapter
- studybuddy-extension 业务工具注册（S1-S4 工具）
- 09-UI S1-S4 标签页业务 UI

**退出门槛**：
- [ ] S1-S4 全链路冒烟通过
- [ ] E2E-01~03 通过
- [ ] 作答前 DTO 防泄露断言通过
- [ ] 幂等归档断言通过
- [ ] AI 失败降级规则输出断言通过

### 6.4 M2：完整闭环

**目标**：S1-S7 + TTS + 备份恢复全链路可走通

**范围**：
- S5 期末冲刺（模拟考/速背卡/冲刺计划）
- S6 家长报告（规则生成/冻结/脱敏/投递）
- S7 课堂采集（许可确认/PCM WAV/whisper.cpp/handoff）
- TTS 跨子系统（SAPI + edge-tts + 控制条 + 已复习标记）
- 备份恢复（手动/定期/归档/恢复 + content_hash + integrity_check）
- whisper.cpp Adapter
- studybuddy-extension 业务工具注册（S5-S7 + TTS + 备份恢复工具）
- 09-UI S5-S7 + TTS + 备份恢复 UI

**退出门槛**：
- [ ] S1-S7 全链路冒烟通过
- [ ] E2E-01~09 通过
- [ ] 家长报告 UUID 泄漏检测通过
- [ ] TTS 跨子系统朗读冒烟通过
- [ ] 备份恢复 content_hash + integrity_check 通过
- [ ] 投递渠道独立失败隔离通过

### 6.5 M3：对话与打磨

**目标**：💬 对话 Tab 默认主入口可用，安全/性能/体验打磨完成

**范围**：
- 💬 对话 Tab（pi 原生 AI 对话默认主入口）
- pi 原生能力承载（流式回复/工具调用视图/上下文压缩/@文件引用/多模型切换）
- 学习场景业务化（学科标签/学习目标/错题关联/L1 画像注入/L3 会话检索）
- AI 自主调用工具（S1-S7 + TTS + 备份恢复全部工具）
- 工具调用跳转（对话→结构化 Tab）
- 安全不变量校验脚本完善
- E2E 全链回归（E2E-01~13）
- 性能优化 / 体验打磨

**退出门槛**：
- [ ] E2E-10~13 对话 Tab 全通过
- [ ] 应用启动默认打开对话 Tab
- [ ] AI 自主调用工具 + 跳转结构化 Tab
- [ ] @文件引用 + TTS 朗读 + L3 会话检索
- [ ] 全部 E2E-01~13 通过
- [ ] v0.1 发布候选

---

## 7. 任务登记表

> 任务在实际开发中动态登记。以下为各里程碑的任务大纲（基于 03-Architecture §9.1 五阶段×架构组件推导），细化到 task-id 在开发启动时补全。

### 7.1 M0 骨架搭建任务大纲

| 分类 | 任务大纲 | 关联文档 | 治理阶段 |
|---|---|---|---|
| 壳层 | Electron 项目初始化（main + preload + renderer + agent-host） | 03-Arch §6.1 | 阶段4 |
| 壳层 | contract 类型化 IPC + RPC 层（createRpcServer/createRpcClient） | 03-Arch §6.3 + 06-API §1.2 | 阶段3-4 |
| 壳层 | 安全沙箱（sandbox:true + CSP + preload 受控桥接） | 03-Arch §6.4 + 08-Test §5.7 | 阶段4-5 |
| 壳层 | toolchain 发现（Node/Python/uv/Git/WPS/whisper.cpp 探测） | 03-Arch §6.5 | 阶段2-4 |
| 壳层 | credential-vault（safeStorage/DPAPI 加密存储） | 03-Arch §6.4 + 08-Test §5.6 | 阶段2-5 |
| 壳层 | file-watch（fs.watch recursive + 防抖） | 03-Arch §6.6 | 阶段2-4 |
| 数据层 | global.db schema 建库（semesters/parent_report_targets/backup_records/backup_schedules） | 05-ERD §2 | 阶段2-4 |
| 数据层 | semester.db schema 建库（S1-S7 全量表 + 触发器 + CHECK + 索引） | 05-ERD §3 + §6 | 阶段2-4 |
| 数据层 | 三层记忆 schema（L1 JSON / L2 BM25+图谱 / L3 FTS5） | 05-ERD §4 + 03-Arch §4 | 阶段2-4 |
| 扩展层 | studybuddy-extension 空壳（createStudyBuddyExtension 可 setup 无工具） | 03-Arch §2.1 | 阶段3 |
| 壳层 | 09-UI 三栏布局 + 标签页骨架（AppShell + TabBar 空壳） | 09-UI §2-§4 | 阶段4 |
| 测试 | M0 系统冒烟（应用启动 + RPC 往返 + 建库 + 安全不变量六条） | 08-Test §5 | 阶段5 |

### 7.1.1 M0 任务登记表（随开发动态更新）

| task-id | 标题 | 分类 | 优先级 | 状态 | 治理阶段 | 关联文档 | 证据 |
|---|---|---|---|---|---|---|---|
| T-M0-001 | Electron 四进程骨架 + 自研 RPC + 最小 contract | 壳层 | P1 | done | 阶段5 | 03-Arch §6 + §9.2 + 08-Test §5.7 | [.record/T-M0-001 实施记录](../.record/T-M0-001-实施记录.md) |
| T-M0-002 | contract 类型化 IPC + RPC 完整接口 | 壳层 | P1 | done | 阶段5 | 03-Arch §6.3 + 06-API §1.2-§5 | [.record/T-M0-002 实施记录](../.record/T-M0-002-实施记录.md) |
| T-M0-003 | credential-vault（safeStorage/DPAPI 密钥库） | 壳层 | P1 | done | 阶段5 | 03-Arch §4.5 + 06-API §3.15 + 01-TRD §9.2 + 08-Test §5.6-§5.7 | [.record/T-M0-003 实施记录](../.record/T-M0-003-实施记录.md) |
| T-M0-006 | 数据层 schema（global.db + semester.db + 三层记忆） | 数据层 | P1 | done | 阶段5 | 05-ERD §1-§10 + 03-Arch §4 + 08-Test §3.2 + §5.4 | [.record/T-M0-006 实施记录](../.record/T-M0-006-实施记录.md) |
| T-M0-004 | toolchain 发现-探测-安装-绝对路径执行框架 | 壳层 | P1 | done | 阶段5 | 03-Arch §6.5 + 06-API §3.16 + 01-TRD §7 决策 1 | [.record/T-M0-004 实施记录](../.record/T-M0-004-实施记录.md) |
| T-M0-005 | file-watch（fs.watch recursive + 100ms 防抖 → Streams["files.changed"]） | 壳层 | P1 | done | 阶段5 | 03-Arch §6.5/§6.6 + 06-API §3.2/§4 | [.record/T-M0-005 实施记录](../.record/T-M0-005-实施记录.md) |
| T-M0-007 | studybuddy-extension 空壳（createStudyBuddyExtension 可 setup 无工具） | 扩展层 | P1 | done | 阶段3 | 03-Arch §2.1/§2.2 + pi ExtensionFactory 契约 | [.record/T-M0-007 实施记录](../.record/T-M0-007-实施记录.md) |
| T-M0-008 | 09-UI 三栏布局 + 标签页骨架（AppShell + TabBar 空壳） | 壳层 | P1 | done | 阶段4 | 09-UI §2-§4 | [.record/T-M0-008 实施记录](../.record/T-M0-008-实施记录.md) |
| T-M0-009 | M0 系统冒烟完整（应用启动 + RPC 往返 + 建库 + 安全不变量六条） | 测试 | P1 | done | 阶段5 | 08-Test §5 + §5.7 + 04-Todo §6.2 | [.record/T-M0-009 实施记录](../.record/T-M0-009-实施记录.md) |

### 7.2 M1 核心闭环 MVP 任务大纲

| 分类 | 子系统 | 任务大纲 | 关联文档 | 治理阶段 |
|---|---|---|---|---|
| 业务Adapter | S1 | 学期/课程/考试/课表/任务 工具注册 + API | 07-WF §2.2 + 06-API §3.3 | 阶段2-4 |
| 业务Adapter | S1 | OCR venv Adapter（课表图片识别） | 03-Arch §3.3 + 08-Test §3.3 | 阶段2-3 |
| 业务Adapter | S2 | 资料/笔记/知识模块 工具注册 + API | 07-WF §2.3 + 06-API §3.4 | 阶段2-4 |
| 业务Adapter | S2 | WPS COM 桥（doc/ppt/xls 转换） | 03-Arch §3.3 + 08-Test §3.3.1 | 阶段2-3 |
| 业务Adapter | S2 | 资料转换管道（PDF/DOCX/PPTX/图片 OCR） | 07-WF §2.3 | 阶段2-4 |
| 业务Adapter | S3 | 练习会话/出题/作答/批改 工具注册 + API | 07-WF §2.4 + 06-API §3.5 | 阶段2-4 |
| 业务Adapter | S4 | 错题/薄弱点 工具注册 + API | 07-WF §2.5 + 06-API §3.6 | 阶段2-4 |
| 扩展层 | 跨切 | before_agent_start / session_start / tool_call / tool_result 钩子 | 03-Arch §2.3 + 08-Test §4.2 | 阶段3 |
| 壳层 | S1-S4 | 09-UI S1-S4 标签页业务 UI | 09-UI §4.3-§4.7 | 阶段4 |
| 测试 | S1-S4 | E2E-01~03（学期初始化/资料笔记/练习→错题→薄弱点） | 08-Test §6.1 | 阶段5 |

### 7.2.1 M1 任务登记表（随开发动态更新）

| task-id | 标题 | 分类 | 优先级 | 状态 | 治理阶段 | 关联文档 | 证据 |
|---|---|---|---|---|---|---|---|
| T-M1-001 | S1 学期/课程/考试/课表/任务 工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §2.2 + 06-API §3.3 + 03-Arch §3.1 + 05-ERD §3.1 + 08-Test §3.1/§3.2 | [.record/T-M1-001 实施记录](../.record/T-M1-001-实施记录.md) |
| T-M1-002 | S2 资料/笔记/知识模块 工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §2.3 + 06-API §3.4 + 03-Arch §3.1 + 05-ERD §3.2 + 08-Test §3.1/§3.2 | [.record/T-M1-002 实施记录](../.record/T-M1-002-实施记录.md) |
| T-M1-003 | S3 限时练习 工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §2.4 + 06-API §3.5 + 03-Arch §3.1 + 05-ERD §3.3 + 08-Test §3.1/§3.2 | [.record/T-M1-003 实施记录](../.record/T-M1-003-实施记录.md) |
| T-M1-004 | S4 错题/薄弱点 工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §2.5 + 06-API §3.6 + 03-Arch §3.1 + 05-ERD §3.4 + 08-Test §3.1/§3.2 | [.record/T-M1-004 实施记录](../.record/T-M1-004-实施记录.md) |

### 7.3 M2 完整闭环任务大纲

| 分类 | 子系统 | 任务大纲 | 关联文档 | 治理阶段 |
|---|---|---|---|---|
| 业务Adapter | S5 | 模拟考/速背卡/冲刺计划 工具注册 + API | 07-WF §2.6 + 06-API §3.7 | 阶段2-4 |
| 业务Adapter | S6 | 家长报告/投递/报告目标 工具注册 + API | 07-WF §3 + 06-API §3.8 | 阶段2-4 |
| 业务Adapter | S6 | assertNoSensitiveLeak UUID 泄漏检测 | 03-Arch §8.2 + 08-Test §5.4 | 阶段2-5 |
| 业务Adapter | S7 | 课堂采集/whisper.cpp Adapter 工具注册 + API | 07-WF §2.7 + 06-API §3.9 | 阶段2-4 |
| 业务Adapter | S7 | whisper.cpp Adapter（PCM WAV 转写） | 03-Arch §3.3 + 08-Test §3.3.2 | 阶段2-3 |
| 业务Adapter | TTS | TTS skill（SAPI + edge-tts + 降级） | 07-WF §4 + 06-API §3.10 | 阶段2-4 |
| 业务Adapter | 备份 | 备份恢复（zip + content_hash + 恢复 + 调度） | 07-WF §5 + 06-API §3.11 | 阶段2-4 |
| 壳层 | S5-S7 | 09-UI S5-S7 + TTS + 备份恢复 UI | 09-UI §4.8-§4.10 + §5-§6 | 阶段4 |
| 测试 | 全 | E2E-04~09（冲刺/报告/采集/TTS/备份恢复） | 08-Test §6.2-§6.4 | 阶段5 |

### 7.3.1 M2 任务登记表（随开发动态更新）

| task-id | 标题 | 分类 | 优先级 | 状态 | 治理阶段 | 关联文档 | 证据 |
|---|---|---|---|---|---|---|---|
| T-M2-001 | S5 期末冲刺（模拟考/速背卡/冲刺计划）工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §2.6 + 06-API §3.7 + 03-Arch §3.1 + 05-ERD §3.5 + 08-Test §3.1/§3.2/§5.5/§6.2 | [.record/T-M2-001 实施记录](../.record/T-M2-001-实施记录.md) |
| T-M2-002 | S6 家长报告（规则生成/冻结/脱敏/投递）工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §3 + 06-API §3.8 + 03-Arch §3.1 + 05-ERD §2.2/§3.6 + 02-PRD §5.2 + 08-Test §3.1/§3.2/§5.4/§5.5 | [.record/T-M2-002 实施记录](../.record/T-M2-002-实施记录.md) |

### 7.4 M3 对话与打磨任务大纲

| 分类 | 子系统 | 任务大纲 | 关联文档 | 治理阶段 |
|---|---|---|---|---|
| 扩展层 | 对话 | 💬 对话 Tab（pi 原生 AI 对话默认主入口） | 09-UI §4.2 + 07-WF §2.8 | 阶段3-4 |
| 扩展层 | 对话 | pi 原生能力承载（流式/工具调用视图/上下文压缩/@引用/多模型） | 09-UI §4.2 + 03-Arch §6.7 | 阶段3-4 |
| 扩展层 | 对话 | 学习场景业务化（学科标签/学习目标/错题关联/L1注入/L3检索） | 09-UI §4.2 + 03-Arch §6.7 | 阶段3-4 |
| 扩展层 | 对话 | AI 自主调用工具 + 跳转结构化 Tab | 07-WF §2.8 + 09-UI §4.2 | 阶段3-4 |
| 扩展层 | 跨切 | model_select / turn_end 钩子（多模型持久化 + L3 增量索引） | 03-Arch §2.3 + 08-Test §4.2 | 阶段3 |
| 壳层 | 对话 | 09-UI 对话 Tab 业务 UI + 会话管理 UI | 09-UI §4.2 + §7 | 阶段4 |
| 测试 | 对话 | E2E-10~13（对话默认主入口/工具调用/@引用/TTS+L3检索） | 08-Test §6.5 | 阶段5 |
| 测试 | 全 | E2E-01~13 全链回归 + 安全不变量最终校验 | 08-Test §6 + §5.7 | 阶段5 |

---

## 8. 修复记录区（08-Test §11.3 证据）

> 冒烟失败修复记录写此区域作为可审计证据。格式：

```
### FR-<序号> <task-id> <日期>
- 失败阶段：阶段X（单件/集成/冒烟/E2E）
- 失败用例：<E2E-XX / 冒烟用例名>
- 失败原因：<中文简述，脱敏不含路径/SQL/UUID>
- 修复措施：<改了什么文件/逻辑>
- 重跑结果：✅ 通过 / ❌ 再次失败（继续记录 FR-<序号+1>）
- 退回阶段：阶段X-1（如有退回）
```

<!-- 修复记录在开发阶段动态追加 -->

---

## 9. 任务统计（随开发动态更新）

| 里程碑 | 总任务数 | pending | in_progress | testing | done | blocked |
|---|---|---|---|---|---|---|
| M0 | 9 | 0 | 0 | 0 | 9 | 0 |
| M1 | 10 | 5 | 0 | 0 | 4 | 0 |
| M2 | 9 | 7 | 0 | 0 | 2 | 0 |
| M3 | 8 | 8 | 0 | 0 | 0 | 0 |
| **合计** | **36** | **20** | **0** | **0** | **15** | **0** |

> 注：M0 总任务数按实际 task-id 计为 9（§7.1 大纲 12 项中，安全沙箱合并入 T-M0-001，数据层 global/semester/三层记忆 3 项合并为 T-M0-006）。v0.1.15 修正口径。

---

## 10. 版本历史

| 版本 | 日期 | 变更 |
|---|---|---|
| v0.1.24 | 2026-08-07 | 登记 T-M2-001 完成：新增 §7.3.1 M2 任务登记表 T-M2-001 done（S5 期末冲刺 8 RPC handler + 2 studybuddy_* 工具注册：mockExams.generatePaper 触发器校验 confirmed + source_hash 防重复 + MockExamGenerator 可注入默认 mock + AI 失败不创建空卷→INTERNAL_ERROR、getPaper 未提交不含 correct_answer 防泄露、startAttempt 状态机 in_progress、submitAttempt 复用 S3 grader 三策略批改 + in_progress→graded + 模块分析 weakness_level strong/medium/weak + study_events 写入、getResult/getModuleAnalyses 只读查询；cramCards.get 确定性只读 DTO 不暴露题干/答案/作答 + 未确认考试 BAD_REQUEST；cramPlan.get 7 天 DTO 确定性只读不替学生改写事实 + 按剩余天数排序；studybuddy-extension 接入 S5 共 21 工具），§9 统计 M2 1 done。420 测试全绿（27 test files），verify 7+2 全通过。依据：AGENTS.md §7 受控收尾流程 + §5.1 TDD 纪律 |
| v0.1.23 | 2026-08-07 | 登记 T-M1-004 完成：§7.2.1 登记表 T-M1-004 done（S4 错题/薄弱点 10 RPC handler + 4 studybuddy_* 工具注册：mistakes.archive 幂等归档 UNIQUE(question_id)+UNIQUE(source_practice_answer_id)、confirmErrorCause 六分类学生确认、suggestErrorCause 可注入 ErrorCauseAdvisor 默认 mock + AI 失败降级、redo 状态机 needs_review↔mastered + evidence_count≥2 归纳 weak_point；weakPoints.resolve/regress 状态机 active→resolved→regressed；schema 修复 mistake_evidence.source_practice_answer_id 改为可空以支持 redo 证据不依赖新 practice_answer；studybuddy-extension 接入 S4 共 19 工具），§9 统计 M1 4 done。383 测试全绿（25 test files），verify 7+2 全通过。依据：AGENTS.md §7 受控收尾流程 + §5.1 TDD 纪律 |
| v0.1.22 | 2026-08-07 | 登记 T-M1-004 开工：§7.2.1 登记表新增 T-M1-004 in_progress（S4 错题/薄弱点 10 RPC handler + 4 studybuddy_* 工具注册：mistakes.archive 幂等归档 UNIQUE(question_id)+UNIQUE(source_practice_answer_id)、confirmErrorCause 六分类学生确认、suggestErrorCause 可注入 ErrorCauseAdvisor 默认 mock 带"不确定"标记 + AI 失败降级 INTERNAL_ERROR、redo 重做正确→evidence_count≥2 归纳 weak_point+mastered/错误→保持 needs_review；weakPoints.resolve/regress 状态机；aggregator 私有 evidence_count≥2 才形成 + UNIQUE(course_instance_id, knowledge_module_id)；S4Context 复用 S1/S2/S3 模式 + ErrorCauseAdvisor 注入；DTO 对齐 ERD §3.4 三表 mistakes/mistake_evidence/weak_points：ErrorCategory 六分类全修正、Mistake 补 7 字段 + 移除 archived、MistakeEvidence 新增类型、RedoResult 补 2 字段、WeakPoint 补 4 字段；错题状态机 needs_review↔mastered、薄弱点状态机 active→resolved→regressed；studybuddy-extension 接入 S4 工具注册共 19 工具），更新 §9 统计（M1 5 pending + 1 in_progress + 3 done）。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 |
| v0.1.21 | 2026-08-07 | 登记 T-M1-003 完成：§7.2.1 登记表 T-M1-003 done（S3 限时练习 5 RPC handler + 3 studybuddy_* 工具注册：practice.createSession 校验 questionCount 5-20 + 可注入 QuestionGenerator mock 生成题、getQuestions 作答前 DTO 防泄露、submit 规则批改三策略（单选精确/多选 deepEquals/填空 normalize+多等价答案）、getResult 含逐题正确答案解析、listSessions；S3Context 复用 S1/S2 模式 + QuestionGenerator 注入；grader.ts 纯确定性规则不调 LLM；DTO 对齐 ERD §3.3 三表 PracticeSession/PracticeResult 补字段 + status 改 in_progress/submitted/graded；AI 失败不创建空 session→INTERNAL_ERROR；studybuddy-extension 接入 S3 工具注册共 15 工具），§9 统计 M1 3 done + 6 pending。336 测试全绿，verify 7+2 全通过。依据：AGENTS.md §7 受控收尾流程 + §5.1 TDD 纪律 |
| v0.1.20 | 2026-08-07 | 登记 T-M1-003 开工：§7.2.1 登记表新增 T-M1-003 in_progress（S3 限时练习 5 RPC handler + 3 studybuddy_* 工具注册：practice.createSession 校验 questionCount 5-20 + 同步调 AI 生成题、getQuestions 作答前 DTO 防泄露、submit 规则批改三策略（单选精确/多选 deepEquals/填空 normalize）、getResult 含正确答案解析、listSessions；S3Context 复用 S1/S2 模式 + lookup 跨库；DTO 对齐 ERD §3.3 questions/practice_sessions/practice_answers 三表），更新 §9 统计（M1 7 pending + 1 in_progress + 2 done）。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 |
| v0.1.19 | 2026-08-07 | 登记 T-M1-002 完成：§7.2.1 登记表 T-M1-002 done（S2 资料/笔记/知识模块 17 RPC handler + 6 studybuddy_* 工具注册：materials 9 方法含状态机+Job 登记、notes 3 方法、modules 3 方法含学习状态机、jobs 2 方法；S2Context 复用 S1 模式 + lookup 跨库查找；DTO 对齐 ERD §3.2 七表 5 DTO + JobStatus/JobType；6 工具 TypeBox schema + execute 薄封装；studybuddy-extension 接入 S2 工具注册），§9 统计 M1 2 done + 8 pending。295 测试全绿，verify 7+2 全通过。依据：AGENTS.md §7 受控收尾流程 + §5.1 TDD 纪律 |
| v0.1.18 | 2026-08-07 | 登记 T-M1-002 开工：§7.2.1 登记表新增 T-M1-002 in_progress（S2 资料/笔记/知识模块 17 RPC handler + studybuddy_* 工具注册：materials 9 方法含状态机+Job 登记、notes 3 方法、modules 3 方法含学习状态机、jobs 2 方法；S2Context 复用 S1 模式 + lookup 跨库；DTO 对齐 ERD §3.2 七表），更新 §9 统计（M1 8 pending + 1 in_progress + 1 done）。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 |
| v0.1.17 | 2026-08-07 | 登记 T-M1-001 完成：§7.2.1 登记表 T-M1-001 done（S1 学习节奏 25 RPC handler + 6 studybuddy_* 工具注册：semesters 6 方法含跨库写+状态机、courses 5 方法、exams 4 方法含四态确认、schedule 4 方法、tasks 4 方法含 dailyBrief 规则聚合、events 2 方法；S1Context 管理全局/学期库句柄；lookup 跨库查找；6 工具 TypeBox schema + execute 薄封装；studybuddy-extension 接入 S1 工具注册；SqlParams 类型对齐 node:sqlite SQLInputValue），§9 统计 M1 1 done + 9 pending。237 测试全绿，verify 7+2 全通过。依据：AGENTS.md §7 受控收尾流程 + §5.1 TDD 纪律 |
| v0.1.16 | 2026-08-07 | 登记 T-M1-001 开工 + 前置 DTO 对齐 schema：新增 §7.2.1 M1 任务登记表（T-M1-001 in_progress），§9 统计 M1 9 pending + 1 in_progress。前置：核实发现 contract/types.ts DTO（T-M0-002）与 05-ERD schema（T-M0-006）10 处字段/值域不一致，按权威链 05-ERD（优先级4）> types.ts（优先级7）修正 7 个 S1 DTO + api.ts source 值域对齐 05-ERD，type-check + 171 测试全绿。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 + §11.2 修订纪律 |
| v0.1.15 | 2026-08-07 | 登记 T-M0-009 完成 + §6.0 M0 完成与版本演进说明 + 头部版本号滞后修正（v0.1.11→v0.1.15）+ §9 统计口径修正（M0 总任务数 12→9，按实际 task-id，3 项大纲合并）：§7.1.1 登记表 T-M0-009 done（M0 系统冒烟完整：smoke.mjs 扩展覆盖 §6.2 退出门槛六项 build+RPC+建库+vault+六不变量+汇总；补全 INV-06 HTML_PREVIEW_CSP form-action 'none' + protocol.ts 接入；check-desktop-security.mjs 六条转硬断言移除占位宽松；verify.mjs desktop-security 改硬阻塞；invariants.test.ts 加 INV-04/05/06 三断言），§6.0 补 M0 完成说明 + 版本演进（01-TRD §7 决策 6 约定），§9 统计 M0 9 done（M0 收官）。依据：AGENTS.md §7 受控收尾流程 + §11.2 修订纪律（口径修正显式记录） |
| v0.1.14 | 2026-08-07 | 登记 T-M0-009 开工：§7.1.1 登记表新增 T-M0-009 in_progress（M0 系统冒烟完整：应用启动 + RPC 往返 + 建库 + 安全不变量六条），更新 §9 统计。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 |
| v0.1.13 | 2026-08-07 | 登记 T-M0-008 完成：§7.1.1 登记表 T-M0-008 done（09-UI 三栏布局 + 标签页骨架：tabs.ts 9 Tab 纯数据 + AppShell.tsx 三栏布局壳 + TabBar.tsx 标签页栏 + App.tsx 组装 + renderer-layout.test.ts 14 断言；对话默认 Tab + 内联样式 + renderToStaticMarkup 静态渲染测试；vitest.config.ts 加 react 插件解析 tsx），§9 统计 M0 3 pending + 8 done。依据：AGENTS.md §7 受控收尾流程 |
| v0.1.12 | 2026-08-07 | 登记 T-M0-008 开工：§7.1.1 登记表新增 T-M0-008 in_progress（09-UI 三栏布局 + 标签页骨架：AppShell + TabBar 空壳，对话默认 Tab），更新 §9 统计（M0 3 pending + 1 in_progress + 7 done）。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 |
| v0.1.11 | 2026-08-07 | 登记 T-M0-007 完成：§7.1.1 登记表 T-M0-007 done（studybuddy-extension 空壳：createStudyBuddyExtension 工厂返回 pi ExtensionFactory 空 setup，零工具/零钩子/零 provider；pi 底座 @earendil-works/pi-coding-agent@0.80.10 + pi-ai@0.80.10 安装为 dependencies；7 单件 + 4 集成测试全绿），§4.1 看板 pi 行阶段1/3 标记 ✅（已安装 + 集成契约验证），§9 统计 M0 4 pending + 7 done。依据：AGENTS.md §7 受控收尾流程 + §6.2 组件化装配流程 |
| v0.1.10 | 2026-08-07 | 登记 T-M0-007 开工 + §4.1 看板 pi 修正：§7.1.1 登记表新增 T-M0-007 in_progress（studybuddy-extension 空壳：createStudyBuddyExtension 工厂 + pi ExtensionFactory 类型化契约 + 空 setup 无工具）；§4.1 看板 pi 行修正——"✅ 已下载"为自指断言（实际 node_modules 无 @earendil-works，阶段1 未完成）→ 改 ⏳ T-M0-007 安装中，"peerDeps"→"dependencies"（跟随 pi-desktop 权威范式 [pi-desktop package.json:47-48] 固定版本 dependencies）；§9 统计 M0 5 pending + 1 in_progress + 6 done。依据：AGENTS.md §11.1 治理基线修改 + §3.2 pi-desktop 参考范式 + §11.2 修订纪律（自指断言修正） |
| v0.1.9 | 2026-08-07 | 登记 T-M0-005 完成：§7.1.1 登记表 T-M0-005 done（file-watch：fs.watch recursive + 100ms 防抖 → Streams["files.changed"]，per-target lastExists 推断 changeType 规避 Windows eventType 不可靠），§9 统计 M0 6 done。前序 v0.1.8 收尾时遗漏版本历史条目与 §9 同步，本次补登。依据：AGENTS.md §7 受控收尾流程 + §11.2 修订纪律 |
| v0.1.8 | 2026-08-07 | 登记 T-M0-005 开工：§7.1.1 登记表新增 T-M0-005 in_progress（file-watch：fs.watch recursive + 100ms 防抖 → Streams["files.changed"]），更新 §9 统计（M0 6 pending + 1 in_progress + 5 done）。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 |
| v0.1.7 | 2026-08-07 | 登记 T-M0-004 完成：§7.1.1 登记表 T-M0-004 done（toolchain 发现-探测-安装-绝对路径执行框架：11 文件 discovery→probe→install→prependPath + 三 handler 注册 + 14 种 capability 全保留），更新 §9 统计（M0 7 pending + 5 done）。依据：AGENTS.md §7 受控收尾流程 |
| v0.1.6 | 2026-08-07 | 登记 T-M0-003 完成：§7.1.1 登记表 T-M0-003 done（credential-vault：safeStorage/DPAPI 密钥库 + 原子写 0o600 + 键名校验），更新 §9 统计（M0 8 pending + 4 done）。同时补全 scripts/check-desktop-security.mjs INV-04 占位为真实断言（已实现 5 条全绿）。依据：AGENTS.md §7 受控收尾流程 |
| v0.1.5 | 2026-08-07 | 登记 T-M0-006 完成：§7.1.1 登记表 T-M0-006 done（数据层 schema：global.db 4 表 + semester.db 25 表 9 触发器 + 三层记忆 L1/L2/L3 + PRAGMA + integrity 断言；node:sqlite 经 process.getBuiltinModule 动态加载规避 esbuild 剥离 node: 前缀），更新 §9 统计（M0 9 pending + 3 done）。依据：AGENTS.md §7 受控收尾流程 |
| v0.1.4 | 2026-08-07 | 登记 T-M0-002 完成：§7.1.1 登记表 T-M0-002 done（contract 类型化契约面：api ~126 方法 + types DTO + streams 9 主题 + PiBridge 8 桥面），更新 §9 统计（M0 10 pending + 2 done）。依据：AGENTS.md §7 受控收尾流程 |
| v0.1.3 | 2026-08-07 | 登记 T-M0-001 完成：新增 §7.1.1 M0 任务登记表（T-M0-001 done），更新 §9 任务统计（M0 12→11 pending + 1 done）。依据：AGENTS.md §7 受控收尾流程 |
| v0.1.2 | 2026-08-07 | 纠正 T-M0-009 跳号笔误：原候选表 008→010 跳号，T-M0-010（M0 系统冒烟完整）重编号为 T-M0-009，恢复 001-009 连续编号。依据：AGENTS.md §11.2（冲突通过显式记录解决，不得静默删除） |
| v0.1.1 | 2026-08-07 | 追加 §1.4 治理体系就绪状态（M0 启动前置）：10 类治理资产清单 + 启动 M0 前置条件确认 + 下一步指引。治理体系五批资产全部就绪，可启动 M0 骨架开发 |
| v0.1.0 | 2026-08-07 | 初始草案：文档定位（设计→实现桥梁）+ 任务登记规范（task-id 命名/字段/状态机）+ 任务分类体系（架构层/子系统/装配阶段三维度）+ 组件治理状态看板（五阶段跟踪）+ 完成门槛（五阶段进入退出条件 + 合并master门槛 + 退回机制）+ 里程碑规划（M0骨架/M1核心闭环/M2完整闭环/M3对话打磨）+ 任务登记表大纲（39 任务大纲基于 03-Arch §9.1 推导）+ 修复记录区（08-Test §11.3 证据）+ 任务统计。输入：01-TRD + 02-PRD + 03-Arch §9 + 05-ERD + 06-API + 07-Workflow + 08-Test §11 + 09-UI |
