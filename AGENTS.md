# AGENTS.md — pi-studybuddy 仓库操作宪章

**版本**：v0.1.116
**日期**：2026-08-12
**状态**：📝 M5 进行中：T-M5-001/002/003 已受控收尾 done，T-M5-004 S1-S5 结构化学习页面逐控件修订 in_progress（复验修正，Git 收口待再次授权）（v0.1.116：独立复验修正——v0.1.115 的 done 登记过早（UAT v1 仅空态/可达性不满足 §6.6 完整闭环铁律）；回退 in_progress；UAT v2 完整闭环补齐（纯 UI 创建→使用→重启回查 + 非空 PNG + S2/S3/S4 依赖外部能力缺口如实登记）+ 修复 2 个 S5 空课程模拟考 FK 生产缺陷（mock-exam-generator default-module 假引用、mock-exams module_analyses null 模块）+ GEN-05；全量 verify full 全绿（unit/integration 128 files/1175 tests、真实 Electron E2E 33 files/142 tests）；Git 收口待用户再次授权；v0.1.115：T-M5-004 Git 收口完成：功能 `c4bb784` + 治理 `5eb4e67` 已由 `agent/T-M5-004-s1-s5-structured-learning-ui` 快进合并进入 master 并推送，核验 `master=origin/master=5eb4e67`；用户裁决方案 A（mistakes.get question 摘要）；S1-S5 逐控件真实闭环 + 真机 UAT 8 路径 + 双独立审查 PASS，任务登记 done，不启动 T-M5-005~008；v0.1.114：网络恢复后经备用 IP 通道推送成功并核验 `master=origin/master=48c93e2`（功能 `e754c78` + 治理 `ef047df` + 中间事实修正 `48c93e2` 一并推送）；§8.4 三要件齐全，任务登记 done；v0.1.113 中间事实见 §12；v0.1.110：唯一计划 `.plan/T-M5-003-chat-session-model-closure.md`，隔离分支 `agent/T-M5-003-chat-session-model-closure`；先写 RED，移除 `sess-001`/`mist-001` fixture 语义，不启动 T-M5-004~008）；评测 prompt 资产 `.pi/prompts/评估-项目技术评测.md` 已建立；M4 历史事实保持（v0.1.105 T-M4-026 Git 收口完成：网络恢复后 `git push origin master` 成功并核验 `master=origin/master=869de2f`（远端 refs/heads/master 一致；功能 `10d50eb` + 治理 `c3d2db3` + 中间事实 `869de2f` 一并推送）；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（118 files/1133 tests、真实 Electron E2E 29 files/137 tests），任务登记为 done（M4 26/0/26，合计 62/0/62）；7 个 provider 凭证仅写入本机 DPAPI vault，DeepSeek/火山/云雾/Agnes catalog 与 text/image/chat/image/video 分类已登记，未知中转站不猜测模型；v0.1.104 见历史行（推送待网络恢复中间事实）；v0.1.101 T-M4-024 模型 provider 接入与凭证委托修复完成：用户提供 agnes-2.5-flash（baseUrl `https://apihub.agnes-ai.com/v1`）并授权配置与登记提交；真实数据根 `%LOCALAPPDATA%\PiStudyBuddy\config\` 写入 models.json/pi-models.json/credentials.json（DPAPI）；修复 2 个生产缺陷（loader 未注入 modelRuntime 致 API key 不生效；agent-host 在 utilityProcess 无 electron safeStorage 致 DPAPI vault 不可用），新增 credential-client.ts parentPort 委托 main 主进程 vault；完整应用链路真实对话验证通过（agent.send 17 事件/32 token，回复真实 agnes 内容）；Node24.14.0 `verify --stage=full` 通过（unit/integration 113 files/1085 tests、真实 Electron E2E 20 files/124 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；功能与治理提交已推送 origin/master，任务登记为 done，不启动 T-M4-016~021；v0.1.100 T-M4-015 Git 收口完成：功能提交 `7974423` 与治理登记提交 `2d63bf5` 已由 `agent/T-M4-015-s5-cram-rpc` 快进合并进入 master，Node24 master 完整 `verify --stage=full` 复验通过（unit/integration 112 files/1079 tests、真实 Electron E2E 20 files/124 tests），origin/master 已推送并核验，任务登记为 done，不启动 T-M4-016~021；v0.1.99 T-M4-014 验收缺口补做完成：用户裁决将 09-UI §4.7 状态筛选纳入；MistakesTab 新增全部/需复习/已掌握前端筛选，integration 12 tests + renderer 14 tests + 真实 Electron E2E 2 tests 通过；`.pi/prompts/task-execution/00-标准任务执行提示词.md` 新增工程进度基线 §2.5 与标准验收清单 §2.6；v0.1.98 T-M4-014 Git 收口完成：功能提交 `cb7d62d` 已由 `agent/T-M4-014-s4-mistakes-rpc` 快进合并进入 master，Node24 master 完整质量门复验通过（unit/integration 110 files/1068 tests、真实 Electron E2E 19 files/122 tests），origin/master 已推送并核验，任务登记为 done，不启动 T-M4-015~021；v0.1.97 用户明确指令统一 Node.js 质量门基线为 `C:\node-v24.14.0-win-x64`，`node.exe --version` 已核验为 v24.14.0，supersedes v0.1.93 的 `D:\node-v24.14.0-win-x64` 定位，历史证据保留；pi 已由 0.83.0 升级至 0.84.1；v0.1.96 用户明确授权建立 `.pi/prompts/task-execution/` 的 T-M4-014~021 任务启动提示词包；其为受控参考资产，统一开发过程与验收主题，不是 `.plan/`，不代表任务开工或 Git 收口授权，不能绕过 §4.4 单一执行任务门禁；v0.1.95 T-M4-012 Git 收口完成：提交 `2e1e7f6` 已进入 master，Node24 master 完整质量门通过，origin/master 已推送并核验，任务登记为 done；不启动 T-M4-013~021；v0.1.93 用户明确指定跨会话 Node24 基线目录 `D:\node-v24.14.0-win-x64`，`node.exe --version` 已核验为 v24.14.0；质量门必须前置该目录，避免环境解析到 Node25；v0.1.92 用户明确批准 T-M4-012 开工：采用 NotesTab 局部显式资料选择；任务已登记为 in_progress，唯一计划与隔离分支已建立；不启动 T-M4-013~021；v0.1.91 T-M4-011 全部验收完成并获用户最终 Git 收口授权，任务登记为 done；v0.1.90 T-M4-011 target-machine acceptance 已通过，当前 `master=origin/master=91e92f8`，本轮治理 Git 同步待授权，任务保持 in_progress；v0.1.89 T-M4-011 Git 收口已完成并核验 `master=origin/master=73a95ad`，target-machine acceptance 待完成，任务保持 in_progress；v0.1.88 T-M4-011 功能提交已快进进入 master 并完成 master 复验，origin/master push 与 target-machine acceptance 待完成，任务保持 in_progress；v0.1.87 T-M4-011 renderer capability transport 修复与 Node24 全量复验，任务保持 in_progress；v0.1.86 T-M4-011 文件导入/storage 与 host 归档写防线修复，任务保持 in_progress；v0.1.85 T-M4-011 Node24.14.0/pnpm11.20.0 基线安装与完整质量门复验，任务保持 in_progress；v0.1.84 T-M4-011 本地实施与交叉审查证据同步，任务保持 in_progress；v0.1.0 用户 2026-08-07 批准；v0.1.1 治理资产清单同步更新；v0.1.2 省察修复 + §11.4 交叉审查元纪律；v0.1.3 §3.1 同步 01-TRD v0.2.2 决策 6；v0.1.4 §10 补全 M0 pnpm 命令；v0.1.5 §3.1 同步 00-索引 v0.1.24/04-Todo v0.1.9 T-M0-005 done；v0.1.6 §3.1 同步 00-索引 v0.1.25/04-Todo v0.1.11 T-M0-007 done；v0.1.7 §3.1 同步 00-索引 v0.1.26/04-Todo v0.1.13；v0.1.8 §3.1 同步 00-索引 v0.1.27/04-Todo v0.1.15；v0.1.9 §3.1 同步 00-索引 v0.1.28/04-Todo v0.1.17 T-M1-001 done；v0.1.10 §3.1 同步 00-索引 v0.1.29/04-Todo v0.1.19 T-M1-002 done + 头部版本号滞后修正 v0.1.6→v0.1.10；v0.1.11 §3.1 同步 00-索引 v0.1.30/04-Todo v0.1.21 T-M1-003 done；v0.1.12 §3.1 同步 00-索引 v0.1.32/04-Todo v0.1.24 T-M2-001 done；v0.1.13 §3.1 同步 00-索引 v0.1.33/04-Todo v0.1.25 T-M2-002 done；v0.1.14 §3.1 同步 00-索引 v0.1.34/04-Todo v0.1.26 T-M2-003 done；v0.1.15 §3.1 同步 00-索引 v0.1.35/04-Todo v0.1.28 T-M2-004 done；v0.1.16 §3.1 同步 00-索引 v0.1.36/04-Todo v0.1.29 T-M2-005 done；v0.1.17 §3.1 同步 00-索引 v0.1.37/04-Todo v0.1.30 §9 统计修正 M1 pending 5→6；v0.1.18 §3.1 同步 00-索引 v0.1.38/04-Todo v0.1.31 登记待做项 task-id M1 T-M1-005~010 + M2 T-M2-006~009；v0.1.19 §3.1 同步 00-索引 v0.1.39/04-Todo v0.1.32 登记 M3 task-id T-M3-001~008 + §7.5 全局执行顺序表 18 行统一排序 M1/M2/M3 pending；v0.1.20 §3.1 同步 00-索引 v0.1.41/04-Todo v0.1.34 登记 T-M1-009 done；v0.1.21 §3.1 同步 00-索引 v0.1.42/04-Todo v0.1.35 登记 T-M2-008 in_progress；v0.1.22 §3.1 同步 00-索引 v0.1.43/04-Todo v0.1.36 登记 T-M2-008 done；v0.1.23 §3.1 同步 08-Test v0.1.2 §6 E2E 框架 Playwright→vitest + Electron；v0.1.24 §3.1 同步 00-索引 v0.1.44/04-Todo v0.1.37 登记 T-M1-010 done；v0.1.25 §3.1 同步 00-索引 v0.1.45/04-Todo v0.1.38 登记 T-M2-009 done + §6.4 M2 退出门槛全勾选；v0.1.26 §3.1 同步 00-索引 v0.1.46/04-Todo v0.1.39 登记 T-M1-005 OCR venv Adapter in_progress；v0.1.27 §3.1 同步 00-索引 v0.1.47/04-Todo v0.1.40 登记 T-M1-005 done；v0.1.28 §3.1 同步 00-索引 v0.1.48/04-Todo v0.1.42 登记 T-M1-006 WPS COM 桥 done；v0.1.29 §3.1 同步 00-索引 v0.1.49/04-Todo v0.1.43 登记 T-M1-007 资料转换管道 in_progress；v0.1.30 §3.1 同步 00-索引 v0.1.50/04-Todo v0.1.44 登记 T-M1-007 资料转换管道 done；v0.1.31 §3.1 同步 00-索引 v0.1.51/04-Todo v0.1.45 登记 T-M1-008 跨切钩子 done，M1 全部 10 任务完成；v0.1.32 §3.1 同步 00-索引 v0.1.52/04-Todo v0.1.46 登记 T-M2-006 UUID 泄漏检测独立脚本 in_progress；v0.1.33 §3.1 同步 00-索引 v0.1.53/04-Todo v0.1.47 登记 T-M2-006 UUID 泄漏检测独立脚本 done；v0.1.34 §3.1 同步 00-索引 v0.1.54/04-Todo v0.1.48 登记 T-M2-007 whisper.cpp 真实 Adapter in_progress；v0.1.35 §3.1 同步 00-索引 v0.1.55/04-Todo v0.1.49 登记 T-M2-007 whisper.cpp 真实 Adapter done，M2 全部 9 任务完成；v0.1.36 §3.1 同步 00-索引 v0.1.56/04-Todo v0.1.50 登记 T-M3-001 开工；v0.1.37 §3.1 同步 00-索引 v0.1.57/04-Todo v0.1.51 登记 T-M3-001 done；v0.1.38 §3.1 同步 00-索引 v0.1.58/04-Todo v0.1.52 登记 T-M3-002 开工；v0.1.39 §3.1 同步 00-索引 v0.1.59/04-Todo v0.1.53 登记 T-M3-002 done + 06-API v0.1.3；v0.1.40 §3.1 同步 00-索引 v0.1.60/04-Todo v0.1.54 登记 T-M3-003 开工；v0.1.41 §3.1 同步 00-索引 v0.1.61/04-Todo v0.1.55 登记 T-M3-003 done + 06-API v0.1.4；v0.1.42 §3.1 同步 00-索引 v0.1.62/04-Todo v0.1.56 登记 T-M3-004 开工；v0.1.43 §3.1 同步 07-Workflow v0.1.2 §2.8 工具→Tab 映射表；v0.1.44 §3.1 同步 00-索引 v0.1.64/04-Todo v0.1.57 登记 T-M3-004 done + 头部版本号滞后修正 v0.1.42→v0.1.44；v0.1.45 §3.1 同步 00-索引 v0.1.65/04-Todo v0.1.58 登记 T-M3-005 开工；v0.1.46 §3.1 同步 00-索引 v0.1.66/04-Todo v0.1.59 登记 T-M3-005 done + 03-Arch v0.1.2/08-Test v0.1.3/06-API v0.1.5/09-UI v0.1.3/12-目录治理 v0.1.1 落点改业务数据根；v0.1.47 §3.1 同步 00-索引 v0.1.67/04-Todo v0.1.60 登记 T-M3-006 开工；v0.1.48 §3.1 同步 00-索引 v0.1.68/04-Todo v0.1.61 登记 T-M3-006 done；v0.1.49 §3.1 同步 00-索引 v0.1.69/04-Todo v0.1.63 登记 T-M3-007 done；v0.1.50 §3.1 同步 00-索引 v0.1.70/04-Todo v0.1.64 登记 T-M3-008 开工；v0.1.51 §3.1 同步 00-索引 v0.1.71/04-Todo v0.1.65 登记 T-M3-008 done，M3 收官；v0.1.52 §3.1 同步 00-索引 v0.1.72/04-Todo v0.1.66 登记 M4 里程碑（业务接线+打包部署 18 任务全 pending）+ 01-TRD v0.2.3 决策 6 修订（打包能力常态化，supersedes v0.2.2）；v0.1.53 §3.1 同步 00-索引 v0.1.73/04-Todo v0.1.67（§7.5 M4 执行顺序调整：T-M4-016 打包配置从执行序 34 提前到 22，P0 后立即验证打包链路；业务 Tab 按 S1→S7 依赖顺序）；v0.1.54 §3.1 同步 00-索引 v0.1.74/04-Todo v0.1.68（M4 重新规划：后端断裂修复前置，重新读系统设计发现 5 处后端断裂 E2E 全绿但生产不可用，M4 任务 18→21 新增 5 个 P0 后端断裂修复 T-M4-001~005，原 T-M4-001~018 重编号为 T-M4-006~021，§7.5 执行顺序表 M4 行 19-36→19-39 重排，§9 统计 54→57；v0.1.57 §3.1 同步 00-索引 v0.1.79/04-Todo v0.1.73（T-M4-022 业务 E2E 迁移为真实 Electron + 127.0.0.1 TCP，16 files/117 tests 通过，Git 收口待授权））；v0.1.69 §3.1/§3.3 同步 T-M4-007 功能提交 `9e5116f` 已快进进入 master 且 Node 24.14.0 完整质量门复验通过，首次推送正在执行；v0.1.70 §3.1/§3.3 同步 T-M4-007 Git 收口完成，功能与治理提交已推送 origin/master，任务登记为 done）
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
| [00-文档索引](./docs/00-文档索引-Index.md) | v0.1.166 | 文档导航 + 门禁 + 版本历史 + M5 用户验收阶段状态 + 任务启动提示词资产索引 |
| [01-TRD](./docs/01-TRD-技术需求-Technical-Requirements.md) | v0.2.4 | 技术底座决策 + 六点定案（决策 6 v0.2.3 修订：源码形态可运行 + 打包能力常态化） |
| [02-PRD](./docs/02-PRD-产品需求-Product-Requirements.md) | v0.1.4 | 产品需求 + 业务闭环 + §3.11 对话默认主入口 |
| [03-Architecture](./docs/03-架构设计-Architecture-Design.md) | v0.1.3 | 四层架构 + pi 扩展 + §6.7 会话管理 + §2.3 model_select 落点业务数据根 config/models.json |
| [04-Todo](./docs/04-任务清单-Todo-List.md) | v0.1.168 | 任务登记 + 组件治理看板 + 里程碑 M0-M5；T-M5-001/002/003/004 done，T-M5-005~008 pending；每任务用户端到端测试铁律已登记。 |
| [05-ERD](./docs/05-数据模型-ERD-Data-Model.md) | v0.1.2 | 全局库 + 学期库 + 三层记忆 |
| [06-API](./docs/06-API契约-API-Contracts.md) | v0.1.7 | RPC 契约 + 100+ 方法 + 9 Streams + §4 AgentEvent payload 结构化 + modelsConfig.get/set |
| [07-Workflow](./docs/07-工作流-Workflow.md) | v0.1.3 | 学生主路径 + 对话路径 + 11 状态机 + §2.8 工具→Tab 映射表 |
| [08-Test](./docs/08-测试验收-Test-Plan.md) | v0.1.5 | 测试金字塔 + 四层分层 + 安全不变量 + §6 E2E 框架改 vitest + Electron + §6.6 用户端到端测试铁律（真机 UAT）+ §4.2 model_select 断言落点业务数据根 |
| [09-UI](./docs/09-使用者介面-UI-Design.md) | v0.1.4 | 三栏布局 + 💬 对话默认 Tab + S1-S7 标签页 + 模型选择持久化业务数据根 |

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
| `docs/12-目录治理` | ✅ 已审查批准 v0.1.2 | 目录职责隔离 |
| `.pi/skills/*` | ✅ 已创建 | 治理用 Skill（task-complete / component-assembly） |
| `.pi/prompts/*` | ✅ 已创建 | 工作流模板（wr / plan）+ `task-execution/`（标准执行提示词 + T-M4-014~021 受控任务启动提示词；仅参考，不能替代 §4.4 的唯一 `.plan/`）+ `评估-项目技术评测.md`（六维可验证评测 prompt，2026-08-12 用户批准） |
| `scripts/verify.mjs` | ✅ 已创建 | 统一质量门 |
| `scripts/check-docs-governance.mjs` | ✅ 已创建 | 文档治理检查 |
| `scripts/check-contract-coverage.mjs` | ✅ 已创建 | 契约 AST 校验 |
| `.plan/` | ✅ 已就绪 | 任务计划目录（历史计划保留为证据；当前无执行中任务，最近完成计划为 `.plan/T-M5-002-first-run-s1-ui.md`） |
| `.record/` | ✅ 已就绪 | 实施记录目录（历史记录已就绪；T-M5-002 记录 `.record/T-M5-002-实施记录.md` 已完成） |

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

**提示词资产边界**：`.pi/prompts/task-execution/` 可以保存通用开发/验收标准与任务范围提示，但它不是执行计划，不得被视为当前任务已登记、已获批准或已进入实施；具体文件清单、实现步骤、RED 用例、命令与预期证据仍只能在用户批准且即将实施时写入唯一 `.plan/`。

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
1. 复验当前任务的测试、最小端到端路径和用户端到端测试（真机 UAT）
2. 更新 docs/04-Todo：任务完成、事实、提交号；不得替用户预选下一项
3. 创建 .record/T-<里程碑>-<序号>-实施记录.md：本任务唯一记录（8 章节，见 §7.1）
4. 如 API 合同变化，更新对应 spec 文档
5. 在计划和当前任务看板中标明完成状态；保留该计划原件作为历史范围与验收证据
6. 运行文档治理检查（scripts/check-docs-governance.mjs，待创建）
7. 停止并报告，等待用户明确指示
```

**用户端到端测试铁律（v0.1.111 用户明确指令，2026-08-12）**：

每个任务（含 M4 及以后）在完成收尾前，除了自动化全测试（unit/integration/E2E/verify full）之外，**必须执行用户端到端测试（真机 UAT）**：

- 使用真实 Electron 应用 + 全新隔离数据根（`H:\pi-studybuddy-tmp\runs\<task-id>\`），不种子、不调用 handler 绕过界面，完全通过可见 UI 操作走用户主路径；
- 至少覆盖本任务涉及的每个用户可见闭环（创建→使用→重启持久化），并逐页/逐按钮记录可达性与可用性；
- 记录步骤级证据（DOM/截图/JSON）到运行根，并在实施记录 §6 登记；
- DOM 不得含完整 UUID、绝对路径或错误栈；
- 真机 UAT 未通过或证据不足时，不得报告任务完成（v0.1.111）。

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

**Node.js 质量门运行时基线（v0.1.97，跨会话权威定位）**：

- 唯一应前置的 Node.js 目录：`C:\node-v24.14.0-win-x64`；可执行文件：`C:\node-v24.14.0-win-x64\node.exe`。
- 已于 2026-08-10 核验：`node.exe --version` = `v24.14.0`；pnpm 基线为 `11.20.0`。
- 运行所有 type-check / test / build / smoke / verify 命令前，必须在**当前 PowerShell 进程**执行：

```powershell
$env:Path = "C:\node-v24.14.0-win-x64;$env:Path"
node --version  # 必须输出 v24.14.0
pnpm --version  # 必须输出 11.20.0
```

- 不得依赖环境中默认解析到的 Node。若 `node --version` 不是 `v24.14.0`，停止质量门并先前置上述目录。Node25 会使既有 `toolchains-discovery` / `toolchains-manager` probe 误报 `unverified`，不构成业务代码失败。
- 本条 v0.1.97 将基线统一为 `C:\node-v24.14.0-win-x64`，supersedes v0.1.93 指定的 `D:\node-v24.14.0-win-x64` 定位；历史证据保留，不删除。

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

| v0.1.116 | 2026-08-13 | 独立复验修正：独立审查者发现 v0.1.115 的 T-M5-004 done 登记过早——UAT v1 仅验证 S1 创建 + S2-S5 空态/可达性，未走「创建→使用→重启回查」完整闭环（不满足 §6.6 铁律）；截图仅 01 步 PNG；全量 verify 曾因 T-M4-021 残留进程锁 + T-M5-003 截图 0 字节非全绿。处置：T-M5-004 done→in_progress 回退；UAT v2 完整闭环补齐（纯 UI 向导创建学期/课程→S1 面板新增任务/考试+确认→首页任务完成/考试查看→冲刺已确认考试生成模拟卷作答提交结果→重启回查；phase-a/phase-b JSON+DOM+非空 PNG 52KB/50KB；S2 资料文件对话框/S2 笔记模块 AI 生成/S3 练习依赖模块/S4 错题依赖练习四类无纯 UI 创建入口闭环如实登记为功能缺口，不冒充 UAT 成功）；修复 2 个 S5 空课程模拟考 FK 生产缺陷（mock-exam-generator.ts 空模块 default-module 假引用→null；mock-exams.ts submitAttempt 写 mock_exam_module_analyses 时 null/unknown 模块→空课程跳过分析写入）；新增 GEN-05 测试；全量 verify full 全绿（清理残留进程后：unit/integration 128 files/1175 tests、真实 Electron E2E 33 files/142 tests、contract 127/127、安全 6/6、UUID 7/7、docs 治理与 diff-check；T-M4-021 单独稳定化通过，残留进程环境性非回归）；docs/04 v0.1.170、实施记录附复验修正章；Git 收口待用户再次授权，任务保持 in_progress。依据：独立复验结论 + AGENTS.md §5/§7/§8.4/§11.1/§11.2。 |
| v0.1.115 | 2026-08-13 | T-M5-004 Git 收口完成：功能提交 `c4bb784`（feat(m5) S1-S5 逐控件真实闭环）与治理登记提交 `5eb4e67`（docs(m5) 本地实施与验收登记）已由 `agent/T-M5-004-s1-s5-structured-learning-ui` 快进合并进入 `master` 并推送 origin/master，核验 `master=origin/master=5eb4e67`（经 http.curloptResolve 备用 IP 通道 20.27.177.113，一次性，不落盘）。交付：用户裁决 CTRL-MISTAKE-04 方案 A（mistakes.get 返回 question 摘要，handler 既有数据，可选字段向后兼容，contract 方法数不变 127/127）+ mistakes.redo correct? 既有能力补登；首页任务完成动作+加载失败重试、资料预览（files.previewMarkdown/read storageKey 相对路径）+retryAiGeneration、笔记思维导图+证据回链可点击、练习结果页加入错题、错题重做正确/错误双动作+详情失败重试+作答历史+完整复盘、冲刺静态按钮禁用+未确认考试拦截固定错误+生成失败恢复；移除/禁用静态无 action 按钮；真机 UAT 8 路径两阶段纯 UI 证据落 runs/T-M5-004/uat/（不进 Git）；Node24 verify --stage=full 通过（unit/integration 128 files/1174 tests、真实 Electron E2E 33 files/143 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check；t-m4-021 打包冒烟 ECONNRESET / t-m5-002 first-run 抖动 / t-m5-003 uat PNG 0 字节三处环境性抖动单独重跑均通过）；双独立审查 PASS；§3.1 同步 00-索引 v0.1.166/04-Todo v0.1.168；§9 统计 M5 4 pending/0 in_progress/4 done（合计 4/0/66）；不启动 T-M5-005~008。依据：用户明确 Git 收口授权 + AGENTS.md §4.5/§7/§8.2/§8.4/§11.1/§11.2。 |
| v0.1.112 | 2026-08-12 | T-M5-003 受控收尾完成（用户明确同意 UAT 半自动方案 + 双审查收尾 + Git 两提交 ff-only 序列）。交付：生产空数据无 fixture、真实会话生命周期（新建真实 ID/发送物化/sessions.json 原子持久化重启可见/切换/重命名/删除/导出）、模型状态失败可见可重试、真实错题选择、发送失败固定中文、turn_end L3 索引经 sessionIdRef 携带真实 sessionId（用户裁决纳入，删除 sess-001 回退）、SessionSidebar 内联重命名（P1：Electron 不支持 window.prompt）、错误文案收敛 chat-errors.ts；真机 UAT 两阶段纯 UI 证据 21 文件落 runs/T-M5-003/uat/（不进 Git）；Node24 verify --stage=full 通过（unit/integration 123 files/1149 tests、真实 Electron E2E 32 files/141 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check；t-m4-021 一次环境性 second-launch ping 抖动重跑通过）；双独立审查无 P0/P1；功能提交 `e754c78`（feat(m5)）+ 治理登记提交已由 agent/T-M5-003-chat-session-model-closure 快进合并进入 master 并推送 origin/master；§3.1 同步 00-索引 v0.1.163/04-Todo v0.1.163；头部版本号滞后修正 v0.1.107→v0.1.112；无 API/handler/schema 方法变化（contract 127/127）；不启动 T-M5-004~008。依据：用户明确同意 + AGENTS.md §4.5/§7/§8.4/§11.1/§11.2。 |
| v0.1.111 | 2026-08-12 | 用户明确指令：每任务执行除全测试外必须进行用户端到端测试（真机 UAT），记录到治理文件。AGENTS.md §7 新增“用户端到端测试铁律”（真实 Electron + 隔离空数据根 + 纯 UI 操作 + 重启持久化 + 步骤级证据 + DOM 无敏感信息，UAT 未过不得报告完成）；docs/08-Test v0.1.5 新增 §6.6 同步；同步更新 T-M5-003 任务启动提示词（RED 与验收主题含真机 UAT）。依据：用户明确指令 + AGENTS.md §2/§4.5/§7/§11.1/§11.2。 |
| v0.1.110 | 2026-08-12 | 用户明确批准 T-M5-003 开工并同意存评测 prompt 资产。T-M5-003 对话/会话/模型/文件引用真实用户闭环修订 pending→in_progress；创建唯一计划 `.plan/T-M5-003-chat-session-model-closure.md` 并切换隔离分支 `agent/T-M5-003-chat-session-model-closure`；新增 `.pi/prompts/评估-项目技术评测.md`（六维可验证评测 prompt，受控参考资产）。范围仅移除 `sess-001`/`mist-001`/`sess-new` fixture 语义、真实会话管理、真实模型状态与失败可见、真实错题/文件选择；不新增 API/schema（contract 127/127）；不启动 T-M5-004~008；Git 收口另需授权。依据：用户明确同意 + AGENTS.md §4.4/§4.5/§5/§7/§11.1/§11.2。 |
| v0.1.109 | 2026-08-12 | T-M5-002 受控收尾完成：用户明确同意收尾。交付首次启动向导 + S1 管理 UI 闭环（空数据树“创建学习计划”入口、FirstRunWizard、S1PlanPanel 考试确认/手工课表/任务完成/学期课程编辑/状态迁移/归档前备份确认、AppShell 唯一上下文即时刷新与竞态门闩、S1 host 归档写防线 assertSemesterWritable、TabBar 常驻修复）；真机 UAT 两阶段通过（空数据纯 UI 创建闭环 + 重启持久化 + DOM 无敏感信息）；Node24 `verify --stage=full` 通过（121 files/1138 tests、真实 Electron E2E 30 files/138 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；双独立审查 PASS。无 API/handler/schema 方法变化；T-M5-003~008 保持 pending，Git 收口另需授权。依据：用户明确同意收尾 + AGENTS.md §4.5/§7/§8.4/§11.1/§11.2。 |
| v0.1.108 | 2026-08-12 | 用户明确批准 T-M5-002 开工；T-M5-001 按受控收尾流程标记 done（审计计划完成记录、实施记录、Node24 `verify --stage=full`、真实 NSIS 隔离安装两次启动、文档治理与 `git diff --check` 证据已复验）；创建唯一计划 `.plan/T-M5-002-first-run-s1-ui.md` 并切换隔离分支 `agent/T-M5-002-first-run-s1-ui`。本任务范围仅首次启动向导及学期/课程/考试/手工课表/任务 UI 闭环，复用既有 S1 RPC，不新增 API/schema，不启动 T-M5-003~008；Git 收口另需授权。依据：用户明确批准 + AGENTS.md §4.4/§4.5/§5/§7/§11.1/§11.2。 |
| v0.1.107 | 2026-08-12 | T-M5-001 真实安装审计证据同步：10 个 Tab 逐页打开并保存 DOM/控件/截图；空数据无初始化入口、生产 fixture 会话、固定 `sess-001`/`mist-001`、静态上下文/状态和 OCR/WPS/whisper 未随包等 P0/P1 缺口经两份独立审查复核；Node24 完整 verify、NSIS 隔离安装与两次 package smoke 通过但不等于全功能 UAT；新增 `.record/T-M5-001-实施记录.md`，任务保持 in_progress，不启动 T-M5-002~008。依据：用户继续指令 + T-M5-001 运行证据 + AGENTS.md §4.4/§4.5/§7/§8.4/§11.1/§11.2。 |
| v0.1.106 | 2026-08-12 | 用户明确“继续”，选择 T-M5-001 全 UI/功能/依赖用户验收审计与追踪矩阵开工；创建唯一计划 `.plan/T-M5-001-ui-acceptance-audit.md` 与隔离分支 `agent/T-M5-001-ui-acceptance-audit`，任务登记为 in_progress；范围仅真实安装应用逐页逐控件审计、生产实现/API/已有测试/依赖证据对照与 P0/P1/P2 差异矩阵，不修业务代码、不启动 T-M5-002~008。依据：用户明确指令 + AGENTS.md §4.4/§4.5/§5/§8/§11.1/§11.2。 |
| v0.1.105 | 2026-08-12 | T-M4-026 Git 收口完成：网络恢复后 `git push origin master` 成功并核验 `master=origin/master=869de2f`（远端 refs/heads/master 一致；功能 `10d50eb` + 治理 `c3d2db3` + 中间事实 `869de2f` 一并推送）；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit/integration 118 files/1133 tests、真实 Electron E2E 29 files/137 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs/diff-check）；任务登记为 done，M4 26/0/26，合计 62/0/62；无 API/handler/schema 方法变化，不启动后续任务。原因：用户明确 Git 收口授权（v0.1.103）+ 网络恢复后继续执行。影响：仅 T-M4-026 状态、Git 证据与版本登记同步。依据：用户明确指令 + 网络恢复证据 + AGENTS.md §4.5、§7、§8.2、§8.4、§11.1、§11.2。 |
| v0.1.104 | 2026-08-12 | 修正 T-M4-026 远端收口中间事实：功能提交 `10d50eb` 与治理登记提交 `c3d2db3`（docs(m4)）已由 `agent/T-M4-026-ai-provider-config` 快进合并进入本地 `master`，Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit/integration 118 files/1133 tests、真实 Electron E2E 29 files/137 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs/diff-check）；但 2 次 `git push origin master` 均因 GitHub 连接不可达（443 超时）失败，`origin/master` 尚未核验到新提交（仍为 6132f09），按 §8.4 任务保持 in_progress，待网络恢复后推送（v0.1.105 完成推送核验）。依据：用户明确 Git 收口授权 + 远端网络错误证据 + AGENTS.md §4.5、§7、§8.4、§11.2。 |
| v0.1.103 | 2026-08-12 | T-M4-026 Git 收口完成（推送事实由 v0.1.104 修正）：功能提交 `10d50eb` 与治理登记提交已由 `agent/T-M4-026-ai-provider-config` 快进合并进入 `master`；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit/integration 118 files/1133 tests、真实 Electron E2E 29 files/137 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs/diff-check）；origin/master 推送结果见 v0.1.104 修正；T-M4-026 登记为 done 待推送核验，M4 26/0/26，合计 62/0/62；无 API/handler/schema 方法变化，不启动后续任务。原因：用户明确 Git 收口授权。影响：仅 T-M4-026 状态、Git 证据与版本登记同步。依据：用户明确指令 + AGENTS.md §4.5、§7、§8.2、§8.4、§11.1、§11.2。 |
| v0.1.101 | 2026-08-11 | T-M4-024 模型 provider 接入与凭证委托修复完成：用户提供 agnes-2.5-flash 并授权登记提交；真实数据根写入 models.json/pi-models.json/credentials.json（DPAPI）；修复 loader 未注入 modelRuntime 致 key 不生效 + agent-host（utilityProcess）无 electron safeStorage 致 vault 不可用两个生产缺陷（新增 credential-client.ts parentPort 委托 main 主进程 DPAPI vault，main/ipc.ts forkAgent 响应 credential-request；credentials.* handler 改 async CredentialService）；完整应用链路真实对话验证通过（agent.send 17 事件/32 token）；Node24.14.0 `verify --stage=full` 通过（unit/integration 113 files/1085 tests、真实 Electron E2E 20 files/124 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check 通过）；§3.1 表格同步 00-索引 v0.1.128/04-Todo v0.1.124（§7.6.1 登记 T-M4-024 done，§9 统计 M4 总任务 23→24、done 17→18，合计 59→60、53→54）；头部版本号滞后修正 v0.1.99→v0.1.101。原因：用户明确指令（2026-08-11“登记 T-M4-024 并提交推送”）。影响：代码修复 + 治理登记同步，无 API/handler/schema 方法变化（contract 保持 127/127）；不启动 T-M4-016~021。依据：用户明确指令 + AGENTS.md §4.5、§7、§8.2、§8.4、§11.1、§11.2。 |
| v0.1.100 | 2026-08-11 | T-M4-015 Git 收口完成：功能提交 `7974423` 与治理登记提交 `2d63bf5` 已由 `agent/T-M4-015-s5-cram-rpc` 快进合并进入 `master`；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit/integration 112 files/1079 tests、真实 Electron E2E 20 files/124 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check 通过）；`git push origin master` 成功并核验 `master=origin/master=2d63bf5`；任务登记为 done，M4 由 6 pending/1 in_progress/16 done 更新为 6 pending/0 in_progress/17 done；§3.1 表格同步 00-索引 v0.1.127/04-Todo v0.1.123。原因：用户明确 Git 收口授权（2026-08-11“提交 推送 到 远端 然后 合并”）。影响：仅任务状态、Git 证据与版本登记同步，无 API/handler/schema 变化；不启动 T-M4-016~021。依据：用户明确指令 + AGENTS.md §4.5、§7、§8.2、§8.4、§11.1、§11.2。 |
| v0.1.99 | 2026-08-11 | T-M4-014 验收缺口补做完成：用户裁决将 09-UI §4.7 状态筛选（全部/需复习/已掌握）纳入 T-M4-014；MistakesTab 新增局部 `statusFilter` 与三档筛选控件，前端过滤不新增 RPC/handler/schema；integration 新增筛选用例，RED 初次失败后 GREEN；定向 26 tests + 真实 Electron E2E 2 tests 通过；同步 `.pi/prompts/task-execution/00-标准任务执行提示词.md` 新增 §2.5 工程进度基线与 §2.6 标准验收清单；§3.1 表格同步 00-索引 v0.1.123/04-Todo v0.1.119。原因：用户明确裁决（2026-08-11）。影响：仅 S4 renderer 筛选与治理资产，不改 API/handler/schema/任务状态；不启动 T-M4-015~021。依据：用户明确指令 + AGENTS.md §4.5、§5、§11.1、§11.2。 |
| v0.1.98 | 2026-08-11 | T-M4-014 Git 收口完成：功能提交 `cb7d62d` 已由 `agent/T-M4-014-s4-mistakes-rpc` 快进合并进入 `master`；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit/integration 110 files/1068 tests、真实 Electron E2E 19 files/122 tests、contract 127/127、安全 6/6、smoke、docs 治理通过）；`git push origin master` 成功并核验 `master=origin/master=cb7d62d`；任务登记为 done；§3.1 表格同步 00-索引 v0.1.122/04-Todo v0.1.118。原因：用户明确 Git 收口授权（2026-08-11“提交 推送”）。影响：仅任务状态、Git 证据与版本登记同步，不改 API/handler/schema；不启动 T-M4-015~021。依据：用户明确指令 + AGENTS.md §4.5、§7、§8.2、§8.4、§11.1、§11.2。 |
| v0.1.97 | 2026-08-10 | 用户明确指令统一 Node.js 质量门运行时基线为 `C:\node-v24.14.0-win-x64`（唯一前置目录与可执行文件，`$env:Path` 前置命令同步更新）；已核验 `C:\node-v24.14.0-win-x64\node.exe --version` 输出 v24.14.0。§10 基线标注由 v0.1.93 更新为 v0.1.97，显式 supersedes v0.1.93 的 `D:\node-v24.14.0-win-x64` 定位（历史证据保留，不删除）；同步更新 `.pi/prompts/task-execution/00-标准任务执行提示词.md` 与当前活动计划 `.plan/T-M4-014-s4-mistakes-rpc.md` 的路径引用；历史计划/实施记录（`.plan/T-M4-010`、`.record/T-M4-007` 等）保留原始路径作为历史证据，不追溯修改。原因：用户要求统一使用 C 盘 Node24 基线，避免多目录歧义。影响：仅开发环境定位与验证命令，不改 API/handler/schema/任务状态，不执行 Git 收口。依据：用户明确指令 + AGENTS.md §2、§10、§11.1、§11.2。 |
| v0.1.96 | 2026-08-10 | 用户明确授权建立 `.pi/prompts/task-execution/`：新增 `00-标准任务执行提示词.md`、README 及 T-M4-014~021 八份任务启动提示词，用于统一权威入口、开工门禁、TDD、质量门、双独立审查、受控收尾和验收主题；明确它们为参考资产，不替代 `.plan/`、04-Todo 状态、用户开工/Git 授权或单一执行任务门禁。原因：用户要求将剩余 M4 任务的过程与验收标准化并让治理系统可发现。影响：新增治理提示词资产并同步索引，不改 API/handler/schema/任务状态。依据：用户明确指令 + AGENTS.md §4.4、§5、§7、§8、§11.1、§11.2。 |
| v0.1.95 | 2026-08-10 | T-M4-012 Git 收口完成：功能提交 `2e1e7f6` 已快进进入 master；Node24.14.0/pnpm11.20.0 master `verify --stage=full` 通过（unit 107 files/1047 tests、真实 Electron E2E 17 files/119 tests、contract/security/smoke/UUID/docs 均通过）；`git push origin master` 成功并核验 `master=origin/master=2e1e7f6`；T-M4-012 登记为 done，不启动 T-M4-013~021。原因：用户明确授权 Git 收口。影响：任务状态与 Git/治理证据同步，不改 API/handler/schema。依据：用户明确指令 + AGENTS.md §4.5、§7、§8.2、§8.4、§11.1、§11.2。 |
| v0.1.94 | 2026-08-10 | T-M4-012 当前实现与证据同步：NotesTab 局部显式资料选择、notes.get/update、modules.list/updateLearnStatus、竞态与归档只读防线保持范围内；真实 Electron renderer E2E fixture 改为启动前隔离预置并补 UUID/Windows/POSIX/file URI/错误栈可见文本断言；Node24.14.0/pnpm11.20.0 `verify --stage=full` 通过（unit 107 files/1047 tests，真实 Electron E2E 17 files/119 tests），两名独立审查复核无 P0/P1；任务仍 in_progress，未更新为 done，不执行 commit/merge/push。原因：修复 E2E 证据缺口并同步历史记录与 live 结果。影响：仅测试证据、计划/治理元数据，不改 API/handler/schema/AppShell 全局资料状态。依据：用户授权继续执行 + AGENTS.md §4.5、§5、§7、§8.4、§9、§11.1、§11.2、§11.4。 |
| v0.1.93 | 2026-08-10 | 用户明确指定 Node.js v24.14.0 的跨会话质量门路径为 `D:\node-v24.14.0-win-x64`；已核验 `D:\node-v24.14.0-win-x64\node.exe --version` 输出 v24.14.0。§10 新增当前 PowerShell 前置 PATH 命令、版本自检和 Node25 toolchain `unverified` 环境漂移说明；supersedes 历史 Node24 路径定位但保留其审计证据。原因：防止换对话/新 shell 后误解析 Node25 导致非业务质量门失败。影响：仅开发环境定位与验证命令，不改 API/handler/schema/任务状态，不执行 Git 收口。依据：用户明确指令 + AGENTS.md §2、§10、§11.1、§11.2。 |
| v0.1.92 | 2026-08-10 | 用户明确批准 T-M4-012 开工并选择方案 A：NotesTab 内局部显式资料选择，不新增 AppShell 跨 Tab 状态；T-M4-012 已登记 in_progress，唯一计划与隔离分支已建立；仅进入治理登记与 RED 前置，不新增 API/handler/schema，不启动 T-M4-013~021，不执行 commit/merge/push。依据：用户明确授权 + AGENTS.md §4.4、§4.5、§5、§8、§11.1、§11.2。 |
| v0.1.87 | 2026-08-10 | 用户明确授权 T-M4-011 Git 收口后，发现并修正 renderer 未消费 main dialog 一次性导入 capability 的边界：`DialogResult` 返回 `importToken/fileName/fileSize`，`MaterialsTab` 以 capability 调用 `materials.upload`，全量 fixture/E2E 同步；Node24 `pnpm test` 106 files/1037 tests、`verify --stage=full` 真实 Electron E2E 16 files/118 tests 全绿。任务仍 in_progress，因为 target-machine acceptance 尚未完成；不启动 T-M4-012~021。依据：用户明确授权 + AGENTS.md §5、§7、§8、§9、§11.1、§11.4。 |
|---|---|---|
| v0.1.86 | 2026-08-10 | 用户明确授权解决 T-M4-011 P1：S2 host 对 source file 做普通文件校验、真实 stat 大小和原子 storage 导入；handler/Electron 证据证明转换从 storage 读取。materials/notes/modules 写 handler 在 host 侧拒绝 archived 学期直接 RPC。同步 06-API v0.1.7、04-Todo v0.1.103、00-索引 v0.1.107；Node24 定向、全量和 verify full 全绿，任务仍 in_progress，进入最终独立审查与 Git 收口，不启动 T-M4-012~021。依据：AGENTS.md §5、§7、§8.4、§11.1、§11.4 + 用户明确授权。 |
| v0.1.85 | 2026-08-10 | 用户明确授权环境适配后，Node.js 官方 v24.14.0 已 SHA-256 校验并安装到 `C:\Users\Administrator\.tools\node-v24.14.0`，用户 PATH 已同步；pnpm 11.20.0 经 Corepack 验证。该基线下 T-M4-011 `pnpm test` 105 files/1036 tests 与 `verify --stage=full`（真实 Electron E2E 16 files/118 tests）通过；真实文件导入/storage、host 侧归档写入防线、target-machine acceptance 与 Git 收口仍待后续授权/验证，任务 in_progress，不启动 T-M4-012~021。依据：AGENTS.md §5.3、§7、§8.4、§11.1、§11.2 + 用户明确授权。 |
| v0.1.84 | 2026-08-10 | T-M4-011 本地实施与交叉审查证据同步：MaterialsTab S2 RPC 接线、归档只读与异步竞态修复、openFile 边界、定向/真实 Electron RPC E2E/静态质量门结果已登记；Node25 全量质量门因 2 个既有 toolchain `unverified` 失败，文件导入/storage 闭环与 Node24.14.0 未验证，任务保持 in_progress，Git 收口待授权，不启动 T-M4-012~021。依据：AGENTS.md §4.5、§5、§7、§8.4、§11.1、§11.2、§11.4 + 用户明确授权。 |
| v0.1.83 | 2026-08-09 | §3.1/§3.3 同步 T-M4-011 开工门禁：04-Todo v0.1.100；创建唯一计划 `.plan/T-M4-011-s2-materials-rpc.md` 并切换隔离分支 `agent/T-M4-011-s2-materials-rpc`；任务 pending→in_progress。仅登记、计划与版本同步，不新增 API/handler/schema，不启动 T-M4-012~021，未执行 commit/merge/push。依据：AGENTS.md §4.4、§4.5、§5、§8、§11.1、§11.2 + 用户明确授权。 |
| v0.1.82 | 2026-08-09 | T-M4-023 Git 收口完成：功能提交 `92e0bcb` 已由 `agent/T-M4-023-cross-review-remediation` 快进合并进入 `master`；Node 24.14.0 master 完整质量门复验通过（unit/integration 104 files/1028 tests、真实 Electron E2E 16 files/118 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、文档治理与 `git diff --check` 通过）；治理同步已推送并核验 `master=origin/master`，任务登记为 done，不启动 T-M4-011~021。依据：AGENTS.md §4.5、§7、§8.2、§8.4、§11.1、§11.2 + 用户明确授权。 |
| v0.1.81 | 2026-08-09 | T-M4-023 本地修订与验收同步：Node 24.14.0 完整 verify full 通过（unit/integration 104 files/1028 tests、真实 Electron E2E 16 files/118 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、文档治理与 git diff --check）；任务仍 in_progress，Git 收口待用户授权，不启动 T-M4-011~021。依据：AGENTS.md §4.5、§7、§8.4、§11.1、§11.2、§11.4 + 用户明确修订指令。 |
| v0.1.80 | 2026-08-09 | 独立交叉审查修订同步：登记并实施 T-M4-023；生产 `agent.send` 不再静默回退测试夹具，未配置模型返回 `MODEL_NOT_CONFIGURED`；loader 从业务数据根配置与 DPAPI 凭证构造 runtime model；契约/IPC 覆盖与真实 Electron 代表性路由证据补强；同步 credential-vault 实际拓扑、默认对话入口和 00-12 元数据；新增审计恢复记录。任务保持 in_progress，未执行 commit/merge/push，不启动 T-M4-011~021。依据：用户明确修订指令 + AGENTS.md §4.4、§4.5、§5、§7、§8、§9、§11、§11.4。 |
|---|---|---|
| v0.1.79 | 2026-08-09 | T-M4-010 Git 收口完成：功能提交 `a06d8a5` 已由 `agent/T-M4-010-s1-home-rpc` 快进合并进入 `master`；Node 24.14.0 在 master 完整质量门复验通过（contract 127/127、安全 6/6、UUID 7/7、文档治理与 `git diff --check` 通过），此前网络恢复后已核验本地与远端 `refs/heads/master` 同为 `b9a3c49`，本次最终治理同步随后推送并复验。任务登记为 done，M4 由 9 pending / 1 in_progress / 10 done 更新为 9 pending / 0 in_progress / 11 done，总计由 9 pending / 1 in_progress / 46 done 更新为 9 pending / 0 in_progress / 47 done；无 API/handler/schema 变化，不启动 T-M4-011~021。依据：AGENTS.md §4.5、§7、§8.2、§8.4、§11.1、§11.2 + 用户明确授权。 |
| v0.1.75 | 2026-08-09 | §3.1/§3.3 同步 T-M4-010 开工门禁：00-索引 v0.1.96、04-Todo v0.1.92；用户明确授权 T-M4-010 S1 首页 Tab RPC 接线实施，已创建唯一计划 `.plan/T-M4-010-s1-home-rpc.md`，任务由 pending→in_progress，并切换隔离分支 `agent/T-M4-010-s1-home-rpc`。原因：落实 §4.4 单一执行任务、§4.5 任务状态 SoT、§5 TDD。影响：仅任务状态、计划与版本登记；不新增 API/handler/schema，不启动 T-M4-011~021，未获 Git commit/merge/push 授权。依据：§4.4、§4.5、§5、§8、§11.1、§11.2 + 用户明确授权。 |
| v0.1.78 | 2026-08-09 | 修正 T-M4-010 远端收口事实：功能与治理提交已在本地 `master`（`3aa51a7`）完成，但两次 `git push origin master` 均因 GitHub 连接重置失败，`origin/master` 尚未核验到新提交；任务保持 in_progress，不能满足 §8.4。依据：AGENTS.md §4.5、§7、§8.4、§11.2 + 远端网络错误证据。 |
| v0.1.74 | 2026-08-09 | T-M4-009 Git 收口完成：功能提交 `36202b0` 已由 `agent/T-M4-009-electron-builder` 快进合并进入 `master`；Node 24.14.0 在 master 完整质量门复验通过（unit/integration 103 files/1022 tests、真实 Electron E2E 16 files/117 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、文档治理与 `git diff --check` 通过），治理提交随后推送 `origin/master`。任务登记为 done，M4 由 11 pending / 1 in_progress / 9 done 更新为 10 pending / 0 in_progress / 10 done，总计由 11 pending / 1 in_progress / 45 done 更新为 10 pending / 0 in_progress / 46 done；无 API/handler/schema 变化，不启动 T-M4-010~021。依据：AGENTS.md §4.5、§7、§8.2、§8.4、§11.1、§11.2 + 用户明确授权。 |
| v0.1.76 | 2026-08-09 | T-M4-010 本地实施与验收完成但保持 in_progress：HomeTab 已接通 `tasks.dailyBrief({semesterId})`、`tasks.list({courseId})`、`exams.list({courseId})`，课程门控、异步竞态隔离、固定错误文案和动态倒计时测试通过；Node 24.14.0 完整质量门、契约 127/127、安全 6/6、UUID 7/7、文档治理与 `git diff --check` 通过。新增 `.record/T-M4-010-实施记录.md`；Git commit/merge/push 未获授权，不启动 T-M4-011~021。依据：AGENTS.md §4.5、§5、§7、§8.4、§11.1、§11.2 + 用户明确授权。 |
| v0.1.73 | 2026-08-09 | T-M4-008 Git 收口完成：功能提交 `76bef58` 已由 `agent/T-M4-008-appshell-dataflow` 快进合并进入 `master`；Node 24.14.0 在 master 完整质量门复验通过（unit/integration 102 files/1017 tests、真实 Electron E2E 16 files/117 tests、contract 127/127、security 6/6、smoke 6/6、UUID 7/7、文档治理与 `git diff --check` 通过），并已推送 `origin/master`。任务登记为 done，M4 由 13 pending / 1 in_progress / 8 done 更新为 12 pending / 0 in_progress / 9 done，总计由 13 pending / 1 in_progress / 44 done 更新为 12 pending / 0 in_progress / 45 done；无 API/handler/schema 变化，不启动 T-M4-009~021。依据：AGENTS.md §4.5、§7、§8.2、§8.4、§11.2 + 用户明确授权。 |
| v0.1.70 | 2026-08-09 | §3.1/§3.3 同步 T-M4-007 Git 收口完成：功能提交 `9e5116f` 已快进进入 master 并在 Node 24.14.0 下完成完整 verify full 复验；治理提交 `9493f99` 已与功能提交成功推送 `origin/master`，任务由 in_progress 更新为 done。原因：落实 §4.5、§7、§8.2、§8.4 完成判据。影响：仅任务状态、Git 证据与版本登记同步；无 API 或业务范围变化，T-M4-008~021 仍 pending，不自动启动。依据：§4.5、§7、§8.2、§8.4、§11.2 + 用户明确授权。 |
| v0.1.69 | 2026-08-09 | §3.1/§3.3 同步 T-M4-007 Git 收口中间事实：用户明确授权后，功能提交 `9e5116f` 已在 `agent/T-M4-007-semester-course-ui` 创建、经 `git merge --ff-only` 快进进入 `master`，且 Node 24.14.0 完整 verify full 已在 master 复验通过；首次 `origin/master` 推送正在执行。原因：落实 §7、§8.2、§8.4 的事实顺序。影响：任务在首次推送成功前仍为 in_progress；无 API/业务范围变更，T-M4-008~021 未启动。依据：§4.5、§7、§8.2、§8.4、§11.1、§11.2 + 用户明确授权。 |
| v0.1.68 | 2026-08-09 | §3.1/§3.3 同步 T-M4-007 最终本地验证证据：00-索引 v0.1.89、04-Todo v0.1.83；Node 24.14.0 `verify --stage=full` 退出码 0（unit/integration 101 files/1015 tests、真实 Electron E2E 16 files/117 tests），UUID 7/7、文档治理和 `git diff --check` 均通过；Mill、Erdos 两名独立审查最终 PASS，实施记录已回填。原因：落实 §7、§11.4，消除测试记录占位与治理摘要漂移。影响：仅治理和审计证据同步；任务仍 in_progress，未获 Git 授权，T-M4-008~021 未启动，无 API/业务范围变更。依据：§4.5、§7、§8.4、§11.1、§11.2、§11.4 + 用户明确授权。 |
| v0.1.67 | 2026-08-09 | §3.1/§3.3 同步 T-M4-007 本地收尾事实：00-索引 v0.1.88、04-Todo v0.1.82、当前唯一计划 T-M4-007 与实施记录已建立；学期/课程树、唯一上下文、归档只读浏览、安全展示与 AppShell 实挂载测试已完成，最终质量门和两名独立复审正在收口。原因：修复 AGENTS.md 与当前 SoT 的版本、计划、记录漂移。影响：仅治理状态与证据同步；任务仍 in_progress，Git 未获授权，T-M4-008~021 未启动，无 API/业务范围变更。依据：§4.5、§7、§8.4、§11.1、§11.2、§11.4 + 用户明确授权。 |
| v0.1.66 | 2026-08-09 | §3.1 版本登记与开工门禁同步：00-索引 v0.1.87 + 04-Todo v0.1.81；用户明确批准 T-M4-007 学期/课程切换 UI 的唯一计划并授权实施，创建 `.plan/T-M4-007-semester-course-ui.md`、登记 pending→in_progress 并切换 `agent/T-M4-007-semester-course-ui`。原因：落实 §4.4 单一执行任务、§4.5 状态 SoT。影响：仅任务状态、计划与版本登记；无 API/业务范围变更，T-M4-008~021 未启动，未 commit / merge / push。依据：§4.4、§4.5、§8、§11.2 + 用户明确授权。 |
| v0.1.65 | 2026-08-09 | §3.1 版本登记与受控收尾同步：00-索引 v0.1.86 + 04-Todo v0.1.80；用户明确授权 Git 收口后，T-M4-006 设置页 UI 的功能提交 `0e378c0` 已在 `master` 快进复验并推送 `origin/master`，任务由 in_progress 更新为 done。原因：落实 §4.5、§7、§8.3、§8.4 完成判据。影响：仅任务状态、Git 证据与版本登记同步；无 API 或业务范围变化，T-M4-007~021 仍 pending，不自动启动。依据：§4.5、§7、§8.3、§8.4、§11.2 + 用户明确授权。 |
| v0.1.64 | 2026-08-09 | §3.1 版本登记同步：00-索引 v0.1.85 + 04-Todo v0.1.79；修复 `scripts/verify.mjs` 子进程运行时漂移——由显式 Node 24.14.0 启动质量门时，将其运行时目录前置传给 npm/npx/node 子进程，防止 PATH 中 Node 25.4.0 覆盖验证基线并使 `js.node` 健康断言误报。原因：完整质量门 RED 证实父/子 Node 不一致；影响：仅质量门运行时一致性与 T-M4-006 证据更新，无业务/API 变化，任务仍 in_progress；依据：§5.1、§10、§11.1/§11.2 + 用户 2026-08-09 批准实施。 |
| v0.1.63 | 2026-08-09 | §3.1 版本登记与最终复审证据同步：00-索引 v0.1.84 + 04-Todo v0.1.78；T-M4-006 的 Heisenberg/Epicurus 两名独立审查最终 PASS，Epicurus 发现的 `AppShell.tsx` EOF 空白行已删除，`git diff --check` 复验通过。原因：§11.4 交叉审查与受控收尾要求将最终审查事实登记到治理 SoT。影响：仅治理状态/版本与质量证据同步；Git 提交、master 复验及 origin/master 推送仍未获授权，任务继续 in_progress；无 API 变更、无后续任务启动。依据：§4.5、§7、§8.4、§11.1/§11.2/§11.4 + 用户 2026-08-09 授权 |
| v0.1.62 | 2026-08-09 | §3.1 版本登记与受控收尾同步：00-索引 v0.1.83 + 04-Todo v0.1.77；T-M4-006 设置页 UI 的实现、TDD、完整质量门、实施记录与独立审查意见修复已完成（Epicurus 最终复审待回传），Git 提交/推送仍未经用户授权，任务保持 in_progress。原因：完整质量门通过后须如实同步治理 SoT，且不得违反 §8.4 提前报告完成。影响：仅治理状态/版本与测试稳定性事实；无 API 变更、无后续任务启动。依据：§4.5、§5、§7、§8.4、§11.1/§11.2 + 用户 2026-08-09 授权 |
| v0.1.61 | 2026-08-09 | §3.1/§3.3 同步 T-M4-006 已获用户批准且实施中的事实：00-索引 v0.1.82 + 04-Todo v0.1.76；唯一执行计划为 `.plan/T-M4-006-settings-ui.md`，已进入 RED→GREEN、设置页/AppShell 组装与定向 type-check，仍保持 in_progress。原因：独立审查发现治理资产表/任务证据仍声称“无执行中任务”或“待批准、未写代码”。影响：仅治理状态与版本登记，未提前报告完成、不变更 API/后续任务。依据：§4.5、§11.1/§11.2 + 用户 2026-08-09 授权 |
| v0.1.60 | 2026-08-09 | §3.1 版本登记与开工门禁同步：00-索引 v0.1.81 + 04-Todo v0.1.75；用户明确选择执行顺序第 25 项 T-M4-006，前置 T-M4-003/T-M4-022 已 done，创建唯一计划 `.plan/T-M4-006-settings-ui.md` 并登记 pending→in_progress，等待用户审查批准后才写业务代码。原因：本次 T-M4-006 Prompt 是唯一任务授权。影响：仅治理状态、计划和版本登记；无业务代码、API 契约或后续任务启动。依据：§4.4、§4.5、§5、§11.2 + 用户明确 Prompt |
| v0.1.59 | 2026-08-09 | §3.1 版本登记与受控收尾同步：00-索引 v0.1.80 + 04-Todo v0.1.74；T-M4-022 已完成 master 复验、commit `0ec4163` 与 origin/master 推送，任务状态由 in_progress 更新为 done。原因：用户明确授权“提交 推送”。影响：仅治理状态、提交证据与版本登记同步；T-M4-006~021 仍保持 pending，不自动启动。依据：§4.5、§7、§8.3、§8.4、§11.2 + 用户明确授权 |
| v0.1.58 | 2026-08-08 | §3.1 版本登记与治理门禁同步：00-索引 v0.1.79 + 04-Todo v0.1.73；修复 00-索引重复头部版本与计划/索引状态滞后，明确 T-M4-022 文档证据已登记但 Git 收口仍待用户授权；同步真实 Electron 36.9.5 / 内嵌 Node 22.19.0 + 127.0.0.1 TCP E2E 事实。原因：独立审查发现治理登记不一致。影响：仅治理版本/状态同步，无业务范围或 API 契约变更。依据：§4.5、§7、§8.4、§11.2、§11.4 + 用户 T-M4-022 Prompt |
| v0.1.57 | 2026-08-08 | §3.1 同步 00-索引 v0.1.79/04-Todo v0.1.73（T-M4-022 真实 Electron 业务 E2E 证据补强：业务 harness 删除 Node `fork(test-main.js)` 冒充路径，改为直接启动 Electron 36.9.5 + 127.0.0.1 TCP JSON-lines；新增 runtime sentinel，完整 E2E 16 files/117 tests 通过）。原因：用户 T-M4-022 Prompt 明确禁止 Node 子进程冒充真实 Electron E2E；实测 Electron 主进程不可靠接收 stdin pipe，采用仅监听回环 TCP。影响：仅测试边界、注释与证据同步，无生产 API 或业务范围变化；T-M4-022 仍因 Git 未授权保持 in_progress。依据：§4.5 任务状态不得只存在于聊天 + §5.3 测试运行数据隔离 + §9.1 网络边界 + §11.2 修订纪律 + 用户明确 Prompt |
| v0.1.56 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.78 + 04-Todo v0.1.72。原因：T-M4-022 已完成 Electron 生产运行时 / SQLite 兼容修复、真实 Electron 桌面双启动验证、全量质量门与两名独立审查，需将治理基线从“仅登记/待批准”同步为事实证据状态。影响：仅版本登记、实施记录与任务证据同步；无权威条款或 API 方法变化。因用户尚未授权 Git 收口，未 commit/push，任务按 §8.4 保持 in_progress。依据：§4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 + §8.4 完成判据 + §11.2 修订纪律 + §11.4 交叉审查元纪律 + 用户 T-M4-022 指令 |
| v0.1.55 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.77 + 04-Todo v0.1.71，登记 T-M4-022 in_progress。原因：用户提供 T-M4-022 Prompt 明确指出 Electron 33.4.11 / Node 20 生产路径与系统 Node + node:sqlite E2E 路径不一致，真实桌面启动为 P0 阻塞；按 §4.4/§4.5 先登记新 task-id、创建唯一执行计划并等待计划批准。影响：M4 21→22 任务，T-M4-022 前置于 T-M4-006；M4 统计 16 pending + 1 in_progress + 5 done，合计 58。无权威条款或 API 变化。依据：§4.4 单一执行任务门禁 + §4.5 任务状态不得只存在于聊天 + §11.1/§11.2 + 用户明确指令 |
| v0.1.54 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.74 + 04-Todo v0.1.68（M4 重新规划：后端断裂修复前置）。原因：用户"重新读系统设计重新安排任务力争按系统设计完成系统直到系统如期运行"——重新读 03-Arch/06-API/09-UI 对比代码发现 5 处后端断裂（E2E 全绿但生产不可用）：① agent-host 生产入口只装 6 类 handler（S1-S7/TTS/Backup 9 类未装配）② studybuddy-extension 35 工具 6 钩子无生产调用（extension-loader 不存在）③ agent.send 是受控夹具（假 TOKEN_FRAGMENTS）④ main.ts 未初始化 global.db ⑤ credentials/settings handler 完全不存在。影响：M4 任务 18→21（新增 5 个 P0 后端断裂修复 T-M4-001~005），原 T-M4-001~018 重编号为 T-M4-006~021，§7.5 执行顺序表 M4 行 19-36→19-39 重排（后端修复 19-23 先行），§9 统计 54→57。无权威条款变更（无契约方法新增，Api 方法总数仍 127）。M4 全部 21 任务 pending。依据：§4.5 任务状态不得只存在于聊天 + §11.2 修订纪律 + 03-Arch §6.2 生产入口装配要求 + 用户明确指令 |
| v0.1.53 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.73 + 04-Todo v0.1.67（§7.5 全局执行顺序表 M4 调整）。原因：用户讨论确认 M4 业务线优先级——P0 解锁基础能力（设置页+学期切换+AppShell）后立即验证打包链路（T-M4-016 从执行序 34 提前到 22，优先级 P4→P0.5），业务 Tab 按 S1→S2→S3→S4→S5→S6→S7 依赖顺序接线。影响：仅执行顺序调整 + 优先级标记，无权威条款变更（无契约方法新增，Api 方法总数仍 127）。M4 全部 18 任务 pending。依据：§11.2 修订纪律 + 01-TRD §7 决策 6 v0.2.3 + 用户明确批准执行顺序 |
| v0.1.52 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.72 + 01-TRD v0.2.3 + 04-Todo v0.1.66（新增 M4 里程碑：业务接线 + 打包部署）。原因：M3 收官后人工检验发现前端 127 RPC handler 仅接通约 12 个（AI 对话线），S1-S7 业务 Tab "有壳无接线"，设置页/学期切换 UI 完全缺失；用户 2026-08-08 明确指令"系统不管什么时候，只要功能正常，就要能够被打包"。影响：① 01-TRD §7 决策 6 权威条款修订（v0.2.2 "不打包 .exe" → v0.2.3 "源码形态可运行 + 打包能力常态化"，supersedes 关系显式标注）② 04-Todo 新增 M4 里程碑（§6.6 退出门槛 7 项 + §7.6/§7.6.1 任务大纲 18 任务 T-M4-001~018 全 pending + §7.5 全局执行顺序表追加 M4 行 19-36 + §9 统计加 M4 行 + 合计 36→54 + §6.0 版本演进同步 v0.2.3）③ 00-索引 文档表格 + 门禁状态 + 版本历史同步。无契约方法新增（Api 方法总数仍 127）。M4 全部 18 任务 pending。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + 01-TRD §7 决策 6 v0.2.3 + 用户明确指令 |
| v0.1.51 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.71 + 04-Todo v0.1.65（§7.4.1 T-M3-008 in_progress→done + §6.5 M3 退出门槛六项全勾选 + §9 统计 M3 in_progress 1→0 + done 7→8 + 合计 in_progress 1→0 + done 35→36）。原因：T-M3-008 E2E-01~13 全链回归 + 安全不变量最终校验实施完成（E2E_RUN_DIR 切换 runs\T-M3-008\ + 5 处注释路径同步 + electron-launcher.ts:5 头部注释 W1 修正），质量门全通过（type-check + 966 单元/集成测试 + 110 E2E 测试（14 文件全绿）+ build + smoke 6/6 + verify full 全绿 + 文档治理（1 条非阻塞警告）+ 契约覆盖 127 handlers + 安全不变量 6/6 + UUID 泄漏 7/7 + git diff --check 无空白错误）。§11.4 交叉审查：2 独立审查者（子代理 + 主会话），4 PASS + 2 WARNING（同源 W1 注释残留已修正 + W2 计划清单遗漏登记于实施记录）+ 0 FAIL，无阻塞性洞。影响：仅版本号同步 + 状态登记 + §6.5 退出门槛全勾选 + 5 处注释路径切换（无契约方法新增，Api 方法总数仍 127）。M3 全部 8 任务完成，v0.1 开发收官。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 + §8.4 完成判据 + §11.4 交叉审查元纪律 |
| v0.1.50 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.70 + 04-Todo v0.1.64（§7.4.1 T-M3-008 pending→in_progress + §9 统计 M3 pending 1→0 + in_progress 0→1 + 合计 pending 1→0 + in_progress 0→1）。原因：用户批准 T-M3-008 E2E-01~13 全链回归 + 安全不变量最终校验开工（§7.5 全局执行顺序表第 18 行，M3 收官任务，前置依赖 T-M3-001~007 全 done）。影响：仅版本号同步 + 状态登记，无权威条款变更。M3 剩余 pending：无（仅 T-M3-008 执行中）。依据：§11.2 修订纪律 + §4.4 单一执行任务门禁 + §4.5 任务状态不得只存在于聊天 |
| v0.1.49 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.69 + 04-Todo v0.1.63（§7.4.1 T-M3-007 in_progress→done + §9 统计 M3 in_progress 1→0 + done 6→7）。原因：T-M3-007 E2E-10~13 对话承载 E2E 实施完成（test-main.js 装配对话承载 handler + test.turnEndIndex 直调生产 + eventForwardServer shim + RpcDriver waitForEvent + reuseDataRoot 二次 launch + 4 E2E 文件 + 三处承载层根因修复：global.sql.ts 幂等建表 / indexer.ts 建父目录 / turn-end.ts 幂等计数），质量门全通过（type-check + 966 单元/集成测试 + 110 E2E 测试（+27）+ build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6 + UUID 泄漏 7/7）。影响：仅版本号同步 + 状态登记 + 三处承载层幂等/目录/计数修复（无契约方法新增，Api 方法总数仍 127）。M3 剩余 pending：T-M3-008。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 + §8.4 完成判据 |
| v0.1.48 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.68 + 04-Todo v0.1.61（§7.4.1 T-M3-006 in_progress→done + §9 统计 M3 in_progress 1→0 + done 5→6）。原因：T-M3-006 09-UI 对话 Tab 业务 UI + 会话管理 UI 实施完成（SessionStore rename/export + SessionSummary.unread? + sessions.rename/export handler 补齐 + SessionSidebar 组件 + AppShell 状态提升 + ChatTab 受控业务态），质量门全通过（type-check + 966 单元/集成测试 + 83 E2E + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6 + UUID 泄漏 7/7）。影响：仅版本号同步 + 状态登记，无权威条款变更（无契约方法新增，Api 方法总数仍 127）。M3 剩余 pending：T-M3-007~008。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 + §8.4 完成判据 |
| v0.1.47 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.67 + 04-Todo v0.1.60（§7.4.1 T-M3-006 pending→in_progress + §9 统计 M3 pending 3→2 + in_progress 0→1）。原因：用户批准 T-M3-006 09-UI 对话 Tab 业务 UI + 会话管理 UI 开工（§7.5 全局执行顺序表第 16 行，前置依赖 T-M3-001 + T-M1-009 模式，T-M3-005 已收尾 master a7b5db7 + origin/master 推送）。五裁决：① export 落点=runs 测试隔离目录 ② 新建会话=内存仓库空白会话+立即当前会话 ③ unread=SessionSummary 可选字段+fixture 演示值 ④ backup_* 无目标 Tab 确认维持不渲染跳转按钮（留 T-M3-008）⑤ 选中会话状态=AppShell 提升。影响：仅版本号同步 + 状态登记，无权威条款变更。M3 剩余 pending：T-M3-007~008。依据：§11.2 修订纪律 + §4.4 单一执行任务门禁 + §4.5 任务状态不得只存在于聊天 |
| v0.1.46 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.66 + 04-Todo v0.1.59（§7.4.1 T-M3-005 in_progress→done + §9 统计 M3 in_progress 1→0 + done 4→5）+ 03-Arch v0.1.2 / 08-Test v0.1.3 / 06-API v0.1.5 / 09-UI v0.1.3 / 12-目录治理 v0.1.1（model_select/modelsConfig 落点 `~/.pi/agent/models.json` → `<dataRoot>/config/models.json`，AGENTS.md §9.5 物理隔离）。原因：T-M3-005 model_select / turn_end 钩子实施完成（model-config 模块原子写 + L3 增量索引 assistant+tool + modelsConfig.get/set + ChatTab 落库），质量门全通过（type-check + 939 单元/集成测试 + 83 E2E + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6 + UUID 泄漏 7/7）。影响：版本号同步 + 状态登记 + 四文档 supersedes 落点修订（无契约方法新增，Api 方法总数仍 127）。M3 剩余 pending：T-M3-006~008。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 + §8.4 完成判据 |
| v0.1.44 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.64 + 04-Todo v0.1.57（§7.4.1 T-M3-004 in_progress→done + §9 统计 M3 in_progress 1→0 + done 3→4）+ 头部版本号滞后修正（v0.1.42→v0.1.44）。原因：T-M3-004 AI 自主调用工具+跳转结构化 Tab 实施完成，质量门全通过（type-check + 925 单元/集成测试 + 83 E2E + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6 + UUID 泄漏 7/7），master 280e642 + origin/master 推送成功（§8.4 三者齐全）。影响：仅版本号同步 + 状态登记，无权威条款变更（07-WF v0.1.2 映射表条款已登记于 v0.1.43）。M3 剩余 pending：T-M3-005~008。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 + §8.4 完成判据 |
| v0.1.43 | 2026-08-08 | §3.1 同步 07-Workflow v0.1.1→v0.1.2（§2.8 衔接段扩充工具→目标 Tab 映射表 35 工具全覆盖 + 跳转规则，T-M3-004 裁决 1b 落地）。原因：T-M3-004 实施中用户批准裁决 1b——映射表条款归属 07-WF §2.8（衔接语义而非 09-UI §4.1 标签页总览），实施完成后升格权威条款。影响：07-WF 权威条款增补，原四条衔接 bullet 并入映射表语义，无 supersedes；实现（src/renderer/tool-tab-map.ts 纯函数 + ChatTab 跳转按钮 + agent.ts 触发词扩展）与条款一一对应。依据：§11.2 修订纪律 + T-M3-004 裁决 1b |
| v0.1.42 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.62 + 04-Todo v0.1.56（§7.4.1 T-M3-004 pending→in_progress + §9 统计 M3 pending 5→4 + in_progress 0→1 + 04-Todo 头部版本号滞后修正 v0.1.52→v0.1.56）+ §3.1 表格 00-索引行滞后修正（v0.1.58→v0.1.62）。原因：用户批准 T-M3-004 AI 自主调用工具+跳转结构化 Tab 开工（§7.5 全局执行顺序表第 14 行，前置依赖 T-M3-002 + S1-S7 工具 done）。五裁决：① 工具→Tab 映射表——35 工具全覆盖（S3→practice/S2 笔记→notes/S2 资料→materials/S2 update_learn_status→notes/S4→mistakes/S5→cram/S6→report/S7→capture/S1+ocr→home/TTS 无跳转）；1a backup_* 无目标 Tab（TabBar 仅 9 Tab 无 backup，AppShell case backup→BackupPanel 存在但无 TabBar 入口），不渲染跳转按钮，留 T-M3-006；1b 映射表条款补 07-WF §2.8 衔接段（收尾时经批准）② 触发词按域分组覆盖（每域 1-2 触发词 + 既有 3 触发词无回归）③ 跳转按钮统一文案 [去<Tab名>]，无目标 Tab 不渲染 ④ 跳转 context { tabId, sessionId?, courseId? }，脱敏不含学生资料原文/完整 UUID ⑤ 受控发射扩展测试确定性。影响：仅版本号同步 + 状态登记，无权威条款变更。M3 剩余 pending：T-M3-005~008。依据：§11.2 修订纪律 + §4.4 单一执行任务门禁 + §4.5 任务状态不得只存在于聊天 |
| v0.1.41 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.61 + 04-Todo v0.1.55（§7.4.1 T-M3-003 in_progress→done + §9 统计 M3 in_progress 1→0 + done 2→3）+ 06-API v0.1.4（§3.1 sessions.search 落地注解 + SessionSummary 扩展 subject/goal/mistakeIds + §3.1.1 agent.send sessionMeta 扩展注解）。原因：T-M3-003 学习场景业务化实施完成（L3 承载层 bigram/indexer/search + L1 写回 + context-pack 学科/目标/错题段 + 会话级元数据 + sessions.search handler + ChatTab 学习场景元数据条 UI），质量门全通过（type-check + 892 单元/集成测试 + 83 E2E + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6 + UUID 泄漏 7/7）。影响：仅版本号同步 + 状态登记 + 06-API 说明性增补（SessionSummary 可选字段向后兼容），无权威条款变更。M3 剩余 pending：T-M3-004~008。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.40 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.60 + 04-Todo v0.1.54（§7.4.1 T-M3-003 pending→in_progress + §9 统计 M3 pending 6→5 + in_progress 0→1 + 04-Todo 头部版本号滞后修正 v0.1.52→v0.1.54）。原因：用户批准 T-M3-003 学习场景业务化开工（§7.5 全局执行顺序表第 13 行，前置依赖 T-M3-001 + T-M3-002 done）。五裁决：① L3 边界——承载层（bigram 分词/写入/检索/sessions.search handler）归 T-M3-003，turn_end 钩子接线归 T-M3-005（无 supersedes）② sessions.search 落 L3 检索库；rename/export 留 T-M3-006 ③ L1 写回 preferred_subjects/goals 现成字段，version 1.0 不变，原子写 ④ 错题关联会话级元数据，不新增表 ⑤ bigram CJK bigram + ASCII 整词小写，完整 UUID 不索引。影响：仅版本号同步 + 状态登记，无权威条款变更。M3 剩余 pending：T-M3-004~008。依据：§11.2 修订纪律 + §4.4 单一执行任务门禁 |
| v0.1.39 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.59 + 04-Todo v0.1.53（§7.4.1 T-M3-002 in_progress→done + §9 统计 M3 in_progress 1→0 + done 1→2）+ 06-API v0.1.3（§4 AgentEvent payload 结构化 + §3.2 files.read 落地注解 + §3.1.1 agent.send 扩展注解）。原因：T-M3-002 pi 原生能力承载实施完成，质量门全通过（type-check + 856 单元/集成测试 + 83 E2E 测试 + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6 + UUID 泄漏 7/7）。影响：仅版本号同步 + 状态登记 + 06-API 说明性增补，无权威条款变更。M3 剩余 pending：T-M3-003~008。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.38 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.58 + 04-Todo v0.1.52（§7.4.1 T-M3-002 pending→in_progress + §9 统计 M3 pending 7→6 + in_progress 0→1）。原因：用户批准 T-M3-002 pi 原生能力承载开工（§7.5 全局执行顺序表第 12 行，前置依赖 T-M3-001 done）。四项设计裁决：① tool_call/tool_result payload 结构化（types.ts + 06-API §4 增补，用户批准）② files.read 走现成契约 + allowed-roots 门禁（不新增契约方法，用户同意）③ 候选草案确认 ④ in_progress 登记确认。影响：仅版本号同步 + 状态登记，无权威条款变更。M3 剩余 pending：T-M3-003~008。依据：§11.2 修订纪律 + §4.4 单一执行任务门禁 + §4.5 任务状态不得只存在于聊天 |
| v0.1.37 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.57 + 04-Todo v0.1.51（§7.4.1 T-M3-001 in_progress→done + §9 统计 M3 in_progress 1→0 + done 0→1）+ 06-API v0.1.2（§3.1.1 新增 agent.send 契约）。原因：T-M3-001 💬 对话 Tab 默认主入口实施完成，质量门全通过（type-check + 823 单元/集成测试 + 83 E2E 测试 + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记 + 06-API 新增 agent.send，无权威条款变更。M3 剩余 pending：T-M3-002~008。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 | + §9 统计 M3 pending 8→7 + in_progress 0→1）。原因：用户批准 T-M3-001 💬 对话 Tab 默认主入口开工（§7.5 全局执行顺序表第 11 行，M3 起点，计划 .plan/T-M3-001-chat-tab.md 草案已创建，进入实施）。影响：仅版本号同步 + 状态登记，无权威条款变更。M3 剩余 pending：T-M3-002~008。依据：§11.2 修订纪律 + §4.4 单一执行任务门禁 + §4.5 任务状态不得只存在于聊天 | + §9 统计 M2 in_progress 1→0 + done 8→9）。原因：T-M2-007 whisper.cpp 真实 Adapter 替换 mock 实施完成，质量门全通过（type-check + 802 单元/集成测试 + 83 E2E 测试 + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记，无权威条款变更。M2 全部 9 任务完成。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.34 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.54 + 04-Todo v0.1.48（§7.3.1 T-M2-007 pending→in_progress + §9 统计 M2 pending 1→0 + in_progress 0→1）。原因：用户批准 T-M2-007 whisper.cpp 真实 Adapter 替换 mock 开工（§7.5 全局执行顺序表第 8 行，whisper.cpp CLI 就绪，阶段1 done）。影响：仅版本号同步 + 状态登记，无权威条款变更。M2 剩余 pending：无（仅 T-M2-007 执行中）。依据：§11.2 修订纪律 + §4.4 单一执行任务门禁 |
| v0.1.31 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.51 + 04-Todo v0.1.45（§7.2.1 T-M1-008 in_progress→done + §9 统计 M1 done 9→10）。原因：T-M1-008 跨切钩子实施完成，质量门全通过（type-check + 799 单元/集成测试 + 80 E2E 测试 + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记，无权威条款变更。M1 全部 10 任务完成，M1 核心闭环 MVP 达成。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.29 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.49 + 04-Todo v0.1.43（§7.2.1 T-M1-007 pending→in_progress + §9 统计 M1 pending 2→1 + in_progress 0→1）。原因：用户批准 T-M1-007 资料转换管道开工（§7.5 全局执行顺序表第 6 行，依赖 T-M1-005 OCR 桥 + T-M1-006 WPS 桥均已就绪）。影响：仅版本号同步 + 状态登记，无权威条款变更。M1 剩余 pending：T-M1-008。依据：§11.2 修订纪律 + §4.4 单一执行任务门禁 |
| v0.1.28 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.48 + 04-Todo v0.1.42（§7.2.1 T-M1-006 in_progress→done + §9 统计 M1 in_progress 1→0 + done 7→8）。原因：T-M1-006 WPS COM 桥 doc/ppt/xls 转换实施完成，质量门全通过（type-check + 754 单元/集成测试 + pytest 5 用例真实 WPS 转换 + build + smoke 6/6 + 文档治理 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记，无权威条款变更。M1 剩余 pending：T-M1-007 / T-M1-008。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.27 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.47 + 04-Todo v0.1.40（§7.2.1 T-M1-005 in_progress→done + §9 统计 M1 in_progress 1→0 + done 6→7）。原因：T-M1-005 OCR venv Adapter 课表图片识别实施完成，质量门全通过（type-check + 743 单元/集成测试 + pytest 7 格式真实识别 + build + smoke 6/6 + 文档治理 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记，无权威条款变更。M1 剩余 pending：T-M1-006 / T-M1-007 / T-M1-008。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.26 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.46 + 04-Todo v0.1.39（§7.2.1 T-M1-005 pending→in_progress + §9 统计 M1 pending 4→3 + in_progress 0→1）。原因：用户批准 T-M1-005 OCR venv Adapter 课表图片识别开工（§7.5 全局执行顺序表第 5 行，venv 就绪，阶段1 已下载）。影响：仅版本号同步 + 状态登记，无权威条款变更。依据：§11.2 修订纪律 + §4.4 单一执行任务门禁 |
| v0.1.25 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.45 + 04-Todo v0.1.38（§7.3.1 T-M2-009 pending→done + §6.4 M2 退出门槛全勾选 + §9 统计 M2 done 6→7）。原因：T-M2-009 E2E-04~09 实施完成，质量门全通过（type-check + 722 单元/集成测试 + 80 E2E 测试 + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：M2 退出门槛六项全勾选，M2 完整闭环达成。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.24 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.44 + 04-Todo v0.1.37（§7.2.1 T-M1-010 pending→done + §6.3 M1 退出门槛全勾选 + §9 统计 M1 done 5→6）。原因：T-M1-010 E2E-01~03 实施完成，质量门全通过（type-check + 722 单元/集成测试 + 36 E2E 测试 + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记，无权威条款变更。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.23 | 2026-08-08 | §3.1 版本登记同步：08-Test v0.1.2（§6 E2E 框架由 Playwright 改为 vitest + Electron 启动 + §1.2/§2/§6/§10.2/§10.3 同步）。原因：pi-studybuddy 是 Electron 单体（无独立后端），ai-studybuddy 的 Playwright webServer 模式不适用；参考 pi-desktop 范式采用 vitest + _electron.launch()，不引入新依赖。影响：08-Test §6 框架选择变更（权威条款修订），无 E2E 用例设计变更。依据：§11.2 修订纪律 + §6.4 禁止过度工程化 + 用户批准 T-M1-010 方案 A |
| v0.1.22 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.43 + 04-Todo v0.1.36（§7.3.1 T-M2-008 in_progress→done + §9 统计 M2 in_progress 1→0 + done 5→6）。原因：T-M2-008 09-UI S5-S7+TTS+备份恢复 UI 实施完成，质量门全通过（type-check + 722 测试 + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记，无权威条款变更。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.21 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.42 + 04-Todo v0.1.35（§7.3.1 T-M2-008 pending→in_progress + §9 统计 M2 pending 4→3 + in_progress 0→1）。原因：用户批准 T-M2-008 09-UI S5-S7+TTS+备份恢复 UI 开工（§7.5 全局执行顺序表第 2 行）。影响：仅版本号同步 + 状态登记，无权威条款变更。依据：§11.2 修订纪律 + §4.4 单一执行任务门禁 |
| v0.1.20 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.41 + 04-Todo v0.1.34（§7.2.1 T-M1-009 in_progress→done + §9 统计 M1 in_progress 1→0 + done 4→5）。原因：T-M1-009 09-UI S1-S4 业务 UI 实施完成，质量门全通过（type-check + 656 测试 + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记，无权威条款变更。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.19 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.39 + 04-Todo v0.1.32（登记 M3 task-id T-M3-001~008 + 新增 §7.5 全局执行顺序表 18 行统一排序 M1/M2/M3 pending）。原因：用户要求把 M3 和 M1/M2 的 pending 放一起明确先后顺序。影响：M3 登记表 +8 行，全局执行顺序表 +18 行，§9 统计数字不变。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 |
| v0.1.18 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.38 + 04-Todo v0.1.31（登记待做项 task-id：M1 追加 T-M1-005~010 + M2 追加 T-M2-006~009，全部 pending）。原因：用户核对发现 §6.3/§6.4 范围项与已登记 task 数量对不上，待做项未登记导致统计无法反映真实待办。影响：登记表行数增加 10 行，§9 统计数字不变但含义清晰化。依据：§11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 |
| v0.1.17 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.37 + 04-Todo v0.1.30（§9 统计修正 M1 pending 5→6，合计 pending 17→18）。原因：用户核对发现 M1 计划任务与实现任务数量对不上（大纲 10 行 - done 4 = 6，原写 5 为计数错误）。影响：仅统计数字修正，无权威条款变更。依据：§11.2 修订纪律 + §3.1 表格维护要求 |
| v0.1.16 | 2026-08-08 | §3.1 版本登记同步：00-索引 v0.1.36（T-M2-005 备份恢复工具注册 + API 完成）+ 04-Todo v0.1.29（§7.3.1 M2 任务登记表 T-M2-005 done + §9 统计 M2 5 done）。原因：T-M2-005 收尾同步版本号。影响：仅版本号同步，无其他权威条款变更。依据：§11.2 修订纪律 + §3.1 表格维护要求 |
| v0.1.15 | 2026-08-07 | §3.1 版本登记同步：00-索引 v0.1.35（T-M2-004 TTS skill 工具注册 + API 完成）+ 04-Todo v0.1.28（§7.3.1 M2 任务登记表 T-M2-004 done + §9 统计 M2 4 done）。原因：T-M2-004 收尾同步版本号。影响：仅版本号同步，无其他权威条款变更。依据：§11.2 修订纪律 + §3.1 表格维护要求 |
| v0.1.14 | 2026-08-07 | §3.1 版本登记同步：00-索引 v0.1.34（T-M2-003 S7 课堂采集工具注册 + API 完成）+ 04-Todo v0.1.26（§7.3.1 M2 任务登记表 T-M2-003 done + §9 统计 M2 3 done）。原因：T-M2-003 收尾同步版本号。影响：仅版本号同步，无其他权威条款变更。依据：§11.2 修订纪律 + §3.1 表格维护要求 |
| v0.1.13 | 2026-08-07 | §3.1 版本登记同步：00-索引 v0.1.33（T-M2-002 S6 家长报告工具注册 + API 完成）+ 04-Todo v0.1.25（§7.3.1 M2 任务登记表 T-M2-002 done + §9 统计 M2 2 done）。原因：T-M2-002 收尾同步版本号。影响：仅版本号同步，无其他权威条款变更。依据：§11.2 修订纪律 + §3.1 表格维护要求 |
| v0.1.12 | 2026-08-07 | §3.1 版本登记同步：00-索引 v0.1.32（T-M2-001 S5 期末冲刺工具注册 + API 完成）+ 04-Todo v0.1.24（新增 §7.3.1 M2 任务登记表 T-M2-001 done + §9 统计 M2 1 done）。原因：T-M2-001 收尾同步版本号 + M2 首任务完成。影响：仅版本号同步 + 04-Todo 权威范围补 §7.3.1，无其他权威条款变更。依据：§11.2 修订纪律 + §3.1 表格维护要求 |
| v0.1.10 | 2026-08-07 | §3.1 版本登记同步：00-索引 v0.1.29（T-M1-002 S2 资料/笔记/知识模块工具注册 + API 完成）+ 04-Todo v0.1.19（§7.2.1 M1 任务登记表 T-M1-002 done + §9 统计 M1 2 done）+ 头部版本号滞后修正（v0.1.6→v0.1.10，v0.1.7-9 仅 §3.1 同步未更新头部版本字段）。原因：T-M1-002 收尾同步版本号 + 修正头部版本号滞后。影响：仅版本号同步，无权威条款变更。依据：§11.2 修订纪律 + §3.1 表格维护要求 |
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
