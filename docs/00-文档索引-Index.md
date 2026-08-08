# Pi StudyBuddy 文档索引

**版本**：v0.1.57
**日期**：2026-08-08
**用途**：pi-studybuddy 项目的导航中心和单一事实来源（SoT）。AI Agent 和开发者在开始任何任务前，必须先读本文件。

---

## 一、项目定位

**pi-studybuddy = pi（AI 底座）+ pi-skills（组件供给）+ StudyBuddy 业务能力（内核）**

- **AI 底座**：[pi-coding-agent](https://github.com/earendil-works/pi)（不修改内核，通过扩展/技能接入）
- **组件供给**：[badlogic/pi-skills](https://github.com/badlogic/pi-skills)（8 个可复用技能）+ 自建技能
- **业务内核**：StudyBuddy 已验证的考试驱动学习闭环（S1-S7 业务认知迁移，实现不复制）
- **参考范本**：[inno-agent](https://github.com/hhyqhh/inno-agent)（MIT，以 pi SDK 构建的个人学习智能体，三层记忆 + 技能系统 + 练习实验室）

## 二、参考仓库（本地只读）

| 仓库 | 本地路径 | 用途 |
|---|---|---|
| earendil-works/pi | `H:\pi-references\pi` | AI 底座，扩展/skill/工具 API 来源 |
| badlogic/pi-skills | `H:\pi-references\pi-skills` | 可复用技能（brave-search、browser-tools、transcribe 等） |
| hhyqhh/inno-agent | `H:\pi-references\inno-agent` | 架构范本（MIT）：registerTool 注册、分层记忆、技能系统 |
| DLYZZT/pi-desktop | `H:\pi-references\pi-desktop` | 使用者介面范本（Apache-2.0）：Electron 三进程 + 类型化 IPC + 内置浏览器 + 技能/插件管理 |

参考仓库只读，不进入 pi-studybuddy 的 workspace；借鉴结论必须先回填到本索引对应的编号文档。

## 三、文档结构

| 编号 | 文档名 | 状态 | 用途 |
|---|---|---|---|
| 00 | 本文档 | ✅ 已创建 | 导航、门禁、参考仓库清单 |
| 01 | TRD-技术需求-Technical-Requirements.md | ✅ v0.2.2 决策已定案 | 运行环境、pi 集成方式、WPS COM、格式矩阵、安全边界、六点决策定案（原五点 + 决策 6 v0.1 交付形态：源码形态不打包 .exe）+ §2.4 会话管理对话默认主入口 |
| 02 | PRD-产品需求-Product-Requirements.md | ✅ v0.1.3 已审查批准 | 产品定位、考试驱动学习闭环、使用者与边界、kaobuddy 吸收结论、家长报告边界、TTS 跨子系统朗读、备份恢复 + §3.11 通用 AI 对话（默认主入口） |
| prep | prep-参考点核对表.md | ✅ 已创建 | 03-Architecture 准备材料：四参考仓库逐项核对表 + 跨仓库结论 |
| 03 | 架构设计-Architecture-Design.md | ✅ v0.1.1 已审查批准 | 四层架构（桌面壳/pi 扩展/业务 Adapter/数据层）+ 工具注册清单 + 三层记忆 + 技能体系 + 桌面壳五件骨架 + 调度层 + 安全不变量 + §6.7 会话管理 pi 原生 AI 对话默认主入口 |
| 04 | 任务清单-Todo-List.md | ✅ v0.1.51 已审查批准 | 任务登记 + 组件治理看板 + 完成门槛 + 里程碑规划（M0骨架/M1核心闭环/M2完整闭环/M3对话打磨）+ 39 任务大纲 + 修复记录区 + §1.4 治理体系就绪状态 + §6.0 M0 完成与版本演进说明 + §7.1.1 M0 任务登记表（T-M0-001~009 全 done，M0 收官）+ §7.2.1 M1 任务登记表（T-M1-001~010 全 done，M1 收官）+ §7.3.1 M2 任务登记表（T-M2-001~009 全 done，M2 收官）+ §7.4.1 M3 任务登记表（T-M3-001 done + T-M3-002~008 pending）+ §7.5 全局执行顺序表（M1/M2/M3 统一排序） |
| 05 | 数据模型-ERD-Data-Model.md | ✅ v0.1.1 已审查批准 | 全局库 + 学期库（S1-S7 全量表 30+）+ 三层记忆 schema + ER 关系图 + 触发器 + 索引 + 备份 zip 结构 + §4.3 L3 对话 Tab 会话承载 |
| 06 | API契约-API-Contracts.md | ✅ v0.1.2 已审查批准 | RPC 契约（非 REST）+ API 信封 + 5 错误码 + 100+ 方法表（S1-S7/TTS/备份恢复 + agent.send）+ 9 Streams + DTO 规范 + §3.1 sessions 对话 Tab 承载注解 + §3.1.1 agent.send 对话发送通道 |
| 07 | 工作流-Workflow.md | ✅ v0.1.1 已审查批准 | 学生主路径（S1-S7 闭环）/ 家长报告 / TTS 朗读 / 备份恢复 / 组件治理 / 调度层 / 11 状态机汇总 + §2.8 通用 AI 对话路径 |
| 08 | 测试验收-Test-Plan.md | ✅ v0.1.1 已审查批准 | 测试金字塔 + 四层分层（单件/集成/系统冒烟/系统 E2E）+ 关键断言矩阵 + 11 状态机测试 + 安全不变量校验 + 夹具与运行隔离 + §6.5 通用 AI 对话 E2E |
| 09 | 使用者介面-UI-Design.md | ✅ v0.1.2 已审查批准 | 三栏布局 + **💬 对话默认 Tab（pi 原生 AI 对话）** + 8 学习标签页（S1-S7）+ TTS 随时可击发 UI + 备份恢复 + 会话业务化 + 文件体验 + 技能/模型管理 + 设置 + 安全隐私边界 + Streams 映射 + 响应式 |
| 10 | 开发规范-Dev-Rules.md | ✅ v0.1.0 已审查批准 | 16 步开发流程（准备/执行/收尾三阶段）+ TDD 纪律 + 单一执行任务门禁 + 文档治理检查 + diff 检查 + 用户授权门 |
| 11 | 组件装配-Component-Assembly.md | ✅ v0.1.0 已审查批准 | "先分解再组合" SoT + 6 步装配流程 + 能力卡规范 + 试炼场边界 + 装配门禁四项（测试全绿/工作区干净/API 有文档/无越权） |
| 12 | 目录治理-Directory-Governance.md | ✅ v0.1.0 已审查批准 | 目录职责速查 + 物理隔离（主仓/试炼场/临时/数据根/pi 会话/参考仓/备份）+ Git 纪律 + 不提交清单 + 数据流图 |
| subsystems/ | 业务子系统文档（S1-S7 收编） | 📝 待创建 | 学习节奏/资料笔记/限时练习/错题/冲刺/家长报告/课堂采集 |

## 四、组件治理流程（强制）

> 用户定义的五阶段组件治理，是本项目的铁律：

```text
1. 组件下载储存 → H:\pi-references 或组件专用目录
2. 组件单件测试 → 独立冒烟（合成夹具）
3. 组件集成测试 → 与 pi 底座对接契约验证
4. 系统配件组装 → 进入主仓 Adapter/扩展
5. 系统冒烟测试 + 系统端到端测试 → 全链回归
```

任何组件（开源库、技能、自写模块）必须走完五阶段才能算"已装配"；任一阶段失败退回上一阶段，不进 master。

## 五、目录治理

- `<repo-root>`：`H:\pi-studybuddy`，唯一主系统 Git 仓库，只保存有效设计文档、正式实现和可审计结论。
- `H:\pi-references\*`：参考仓库只读区，不加入 workspace。
- 运行数据必须隔离：E2E/冒烟使用 `H:\pi-studybuddy-tmp\runs\<task-id>`。
- 不提交：真实密钥、`.env.local`、资料原文、完整 UUID、node_modules。

## 六、文档门禁

1. 新建文档前先读本索引，检查目标文档是否已存在。
2. 按编号顺序推进：01-TRD → 02-PRD → 03-Design → 05-ERD → 06-API → 07-Workflow → 08-Test → 04-Todo。
3. 创建后同步更新本索引。
4. 提交前运行文档治理检查（实现中）与 `git diff --check`。

## 七、当前状态

- [x] 初始化仓库（git init + 关联远端 `https://github.com/everything-is-simple/pi-studybuddy.git`）
- [x] 下载四参考仓库到 `H:\pi-references`（pi / pi-skills / inno-agent / pi-desktop）
- [x] 本文档（00 索引）
- [x] 01-TRD v0.2.1：技术需求 + 五点待决项定案（Python pywin32 / 自建壳 / 物理隔离 / SAPI 默认 / 中文优先）+ §2.4 会话管理对话默认主入口 —— 决策已定案
- [x] prep-参考点核对表：四参考仓库逐项核对 + 跨仓库结论（03-Architecture 准备材料）
- [x] 02-PRD v0.1.3 ✅ 已审查批准：产品需求（业务闭环、使用者、家长报告边界、kaobuddy 吸收结论、TTS 跨子系统朗读、备份恢复）+ §1.2 愿景 + §3.11 通用 AI 对话（默认主入口）
- [x] 03-Architecture v0.1.1 ✅ 已审查批准：四层架构 + pi 扩展层 + 业务 Adapter + 数据层 + 技能体系 + 桌面壳 + 调度 + 安全 + §6.7 会话管理 pi 原生 AI 对话默认主入口
- [x] 05-ERD v0.1.1 ✅ 已审查批准：全局库 + 学期库（S1-S7 全量表 30+）+ 三层记忆 + ER 图 + 触发器 + 索引 + 备份 zip 结构 + §4.3 L3 对话 Tab 会话承载
- [x] 06-API v0.1.1 ✅ 已审查批准：RPC 契约（非 REST）+ API 信封 + 5 错误码 + 100+ 方法表 + 9 Streams + DTO 规范 + §3.1 sessions 对话 Tab 承载注解
- [x] 07-Workflow v0.1.1 ✅ 已审查批准：学生主路径（S1-S7 闭环）+ 家长报告 + TTS 朗读 + 备份恢复 + 组件治理 + 调度层 + 11 状态机汇总 + §2.8 通用 AI 对话路径
- [x] 08-Test v0.1.1 ✅ 已审查批准：测试金字塔 + 四层分层 + 关键断言矩阵 + 11 状态机测试 + 安全不变量校验 + 夹具与运行隔离 + §6.5 通用 AI 对话 E2E
- [x] 09-UI v0.1.2 ✅ 已审查批准：三栏布局 + **💬 对话默认 Tab（pi 原生 AI 对话，响应用户反馈不废弃）** + 8 学习标签页（S1-S7）+ TTS 随时可击发 UI + 备份恢复 + 会话业务化 + 文件体验 + 技能/模型管理 + 设置 + 安全隐私边界 + Streams 映射 + 响应式 —— 完整性/上游一致性/铁律落实/E2E 覆盖四项通过
- [x] 04-Todo v0.1.0 ✅ 已审查批准：任务登记规范 + 组件治理看板 + 完成门槛 + 里程碑规划（M0-M3）+ 39 任务大纲 + 修复记录区 —— 里程碑划分/任务大纲粒度/task-id 规范/完成门槛四项通过
- [x] 04-Todo v0.1.1：追加 §1.4 治理体系就绪状态（10 类治理资产清单 + M0 启动前置条件确认）
- [x] 04-Todo v0.1.2：纠正 T-M0-009 跳号笔误（原 T-M0-010 重编号为 T-M0-009，恢复 001-009 连续编号）
- [x] 04-Todo v0.1.3：登记 T-M0-001 完成（新增 §7.1.1 M0 任务登记表 + 更新 §9 任务统计），M0 首个任务落地
- [x] 04-Todo v0.1.4：登记 T-M0-002 完成（contract 类型化契约面：api 126 方法 + types DTO + streams 9 主题 + PiBridge 8 桥面），更新 §9 任务统计
- [x] 04-Todo v0.1.5：登记 T-M0-006 完成（数据层 schema：global.db 4 表 + semester.db 25 表 + 三层记忆 + PRAGMA + integrity；node:sqlite 经 process.getBuiltinModule 动态加载），更新 §9 任务统计
- [x] 04-Todo v0.1.6：登记 T-M0-003 完成（credential-vault：safeStorage/DPAPI 密钥库 + 原子写 0o600 + 键名校验；补全 check-desktop-security.mjs INV-04 占位为真实断言，已实现 5 条不变量全绿），更新 §9 任务统计
- [x] 04-Todo v0.1.7：登记 T-M0-004 完成（toolchain 发现-探测-安装-绝对路径执行框架：14 种 capability 全保留，仅框架不实现组件下载；src/main/toolchains/ 11 文件 + toolchain-runtime.ts + handlers；121 测试全绿），更新 §9 任务统计
- [x] 04-Todo v0.1.9：登记 T-M0-005 完成（file-watch：fs.watch recursive + 100ms 防抖 → Streams["files.changed"]；per-target lastExists 推断 changeType；src/agent-host/file-watch.ts + handlers/files.ts + index.ts 装配；14 单件 + 8 集成测试，143 测试全绿），更新 §9 任务统计
- [x] 04-Todo v0.1.10：登记 T-M0-007 开工 + §4.1 看板 pi 修正（"✅ 已下载"自指断言 → ⏳ T-M0-007 安装中；peerDeps → dependencies 跟随 pi-desktop 范式），更新 §9 任务统计
- [x] 04-Todo v0.1.11：登记 T-M0-007 完成（studybuddy-extension 空壳：createStudyBuddyExtension 工厂返回 pi ExtensionFactory 空 setup；pi 底座 0.80.10 安装为 dependencies；7 单件 + 4 集成测试，154 测试全绿），§4.1 看板 pi 阶段1/3 ✅，更新 §9 任务统计
- [x] 04-Todo v0.1.12：登记 T-M0-008 开工（09-UI 三栏布局 + 标签页骨架：AppShell + TabBar 空壳，对话默认 Tab），更新 §9 任务统计
- [x] 04-Todo v0.1.13：登记 T-M0-008 完成（09-UI 三栏布局 + 标签页骨架：tabs.ts 9 Tab + AppShell.tsx 三栏壳 + TabBar.tsx + App.tsx 组装 + renderer-layout.test.ts 14 断言；renderToStaticMarkup 静态渲染测试；vitest.config.ts 加 react 插件；168 测试全绿），更新 §9 任务统计
- [x] 04-Todo v0.1.15：登记 T-M0-009 完成（M0 系统冒烟完整：smoke.mjs 扩展覆盖 §6.2 退出门槛六项 build+RPC+建库+vault+六不变量+汇总；补全 INV-06 HTML_PREVIEW_CSP form-action 'none' + protocol.ts 接入；check-desktop-security.mjs 六条转硬断言；verify.mjs desktop-security 改硬阻塞；171 测试全绿）+ §6.0 M0 完成与版本演进说明 + §9 统计口径修正（M0 9 task-id）+ 头部版本号滞后修正（v0.1.11→v0.1.15）。M0 收官，9 任务全 done
- [x] 04-Todo v0.1.16：登记 T-M1-001 开工 + 前置 DTO 对齐 schema（contract/types.ts DTO 与 05-ERD schema 10 处不一致，按权威链 05-ERD > types.ts 修正 7 个 S1 DTO；新增 §7.2.1 M1 任务登记表 T-M1-001 in_progress；171 测试全绿）
- [x] 04-Todo v0.1.17：登记 T-M1-001 完成（S1 学习节奏 25 RPC handler + 6 studybuddy_* 工具注册 + S1Context 句柄管理 + lookup 跨库查找 + SqlParams 类型对齐 node:sqlite；studybuddy-extension 接入 S1 工具注册；237 测试全绿，verify 7+2 全通过；§9 统计 M1 1 done + 9 pending）
- [x] 04-Todo v0.1.21：登记 T-M1-003 完成（S3 限时练习 5 RPC handler + 3 studybuddy_* 工具注册 + S3Context 复用 S1/S2 模式 + QuestionGenerator 可注入 mock + grader 规则批改三策略 + DTO 对齐 ERD §3.3 三表；studybuddy-extension 接入 S3 工具注册共 15 工具；336 测试全绿，verify 7+2 全通过；§9 统计 M1 3 done + 6 pending）
- [x] 04-Todo v0.1.23：登记 T-M1-004 完成（S4 错题/薄弱点 10 RPC handler + 4 studybuddy_* 工具注册 + 幂等归档 + 六分类确认 + AI 降级 + 状态机 + 薄弱点归纳；schema 修复 mistake_evidence.source_practice_answer_id 改为可空；studybuddy-extension 接入 S4 共 19 工具；383 测试全绿，verify 7+2 全通过；§9 统计 M1 4 done）
- [x] 04-Todo v0.1.19：登记 T-M1-002 完成（S2 资料/笔记/知识模块 17 RPC handler + 6 studybuddy_* 工具注册 + S2Context 复用 S1 模式 + lookup 跨库查找 + DTO 对齐 ERD §3.2 七表 5 DTO + JobStatus/JobType；studybuddy-extension 接入 S2 工具注册；295 测试全绿，verify 7+2 全通过；§9 统计 M1 2 done + 8 pending）
- [x] 04-Todo v0.1.24：登记 T-M2-001 完成（S5 期末冲刺 8 RPC handler + 2 studybuddy_* 工具注册 + S5Context 复用 S1/S2/S3/S4 模式 + MockExamGenerator 可注入 mock + source_hash 防重复 + 触发器校验 confirmed + getPaper 防泄露 + submitAttempt 复用 S3 grader 三策略 + 模块分析 weakness_level strong/medium/weak + study_events 写入；cramCards/cramPlan 确定性只读 DTO 不建表不持久化不依赖 AI；studybuddy-extension 接入 S5 共 21 工具；420 测试全绿，verify 7+2 全通过；§9 统计 M2 1 done）—— M2 首任务落地
- [x] 04-Todo v0.1.25：登记 T-M2-002 完成（S6 家长报告 11 RPC handler + 3 studybuddy_* 工具注册 + S6Context 句柄管理 + lookup 跨库查找 + ReportGenerator 规则生成 + ReportPolisher 可注入 mock + DeliveryChannel 可注入 mock 渠道独立失败隔离 + leak-detector UUID 泄漏检测 + report frozen 状态机 + DTO 对齐 ERD §2.2/§3.6；studybuddy-extension 接入 S6 共 24 工具；455 测试全绿，verify 7+2 全通过；§9 统计 M2 2 done）
- [x] 04-Todo v0.1.26：登记 T-M2-003 完成（S7 课堂采集 2 RPC handler + 2 studybuddy_* 工具注册 + S7Context 句柄管理 + WhisperCppAdapter 可注入 mock/failing/real + PCM WAV 文件头服务端字节级验证（RIFF/WAVE/PCM/16kHz/单声道/16-bit 44 字节 8 项）+ 许可确认强制 + 错误消息固定文案不泄漏路径/stdout/stderr/密钥 + 原始音频 tmp/class-capture/<request-id>/ finally 清理 + handoff 到 S2 materials+normalized_texts+study_events（source_type='class_audio_transcription' / status='converted' / permission_confirmed=1 / content_hash=SHA-256 / event_type='class_handoff_saved' source_system='S7'）；前置 DTO/schema 已就绪无需修改；studybuddy-extension 接入 S7 共 26 工具；扩展装配测试同步更新 24→26；509 测试全绿（34 test files），type-check + build + smoke 6 项全通过；§9 统计 M2 3 done）
- [x] 04-Todo v0.1.28：登记 T-M2-004 完成（TTS skill 4 RPC handler + 3 studybuddy_* 工具注册 + TtsContext 双引擎可注入 sapiAdapter/edgeTtsAdapter mock/failing/real + SAPI 默认 + edge-tts 失败降级 fallbackUsed=true + 朗读状态机 idle→playing→paused→stopped + Streams["tts.state"] 推送 + 无独立 TTS 表朗读不持久化 + 朗读不写 StudyEvent + 不连真实 SAPI/edge-tts 全 mock + 契约微调 api.ts tts.speak result 扩展 engine/fallbackUsed + types.ts 补 TtsSpeakResult；studybuddy-extension 接入 TTS 共 29 工具；扩展装配测试同步更新 26→29；562 测试全绿（38 test files），type-check + build + smoke 6 项全通过；§9 统计 M2 4 done）
- [x] 04-Todo v0.1.29：登记 T-M2-005 完成（备份恢复 7 RPC handler + 5 studybuddy_* 工具注册 + BackupContext 句柄管理 + 手写最小 zip 格式无外部依赖 + content_hash=SHA-256 + schema_version 兼容 + 冲突 overwrite/create_new/none + PRAGMA integrity_check + zip 炸弹防护 + 符号链接逃逸防护 + backup_records 状态机 in_progress→completed/failed + Streams["backup.progress"] 推送 + 调度配置 CRUD + DTO 对齐 05-ERD §2.3/§2.4 BackupRecord 15 字段+BackupSchedule 10 字段+RestoreResult 补 schemaVersion；studybuddy-extension 接入备份恢复共 34 工具；扩展装配测试同步更新 29→34；598 测试全绿（43 test files），type-check + build + smoke 6 项全通过 + 文档治理检查通过；§9 统计 M2 5 done）—— M2 最后一个业务 Adapter 完成
- [x] 01-TRD v0.2.2：§7 加决策 6「v0.1 交付形态：源码形态（pnpm dev），不打包 .exe」（依据 AGENTS.md §1.2 + §6.4；M0 完成后 04-Todo §6.0 补版本演进说明）
- [x] 10-开发规范 v0.1.0 ✅ 已审查批准：16 步开发流程（准备/执行/收尾三阶段）+ TDD 纪律 + 单一执行任务门禁 + 文档治理检查 + diff 检查 + 用户授权门
- [x] 11-组件装配 v0.1.0 ✅ 已审查批准："先分解再组合" SoT + 6 步装配流程 + 能力卡规范 + 试炼场边界 + 装配门禁四项
- [x] 12-目录治理 v0.1.0 ✅ 已审查批准：目录职责速查 + 物理隔离（主仓/试炼场/临时/数据根/pi 会话/参考仓/备份）+ Git 纪律 + 不提交清单
- [x] 治理资产：AGENTS.md v0.1.0 + README.md v0.1.0 ✅ 已审查批准
- [x] 治理 Skills：studybuddy-task-complete / studybuddy-component-assembly ✅ 已创建
- [x] 工作流模板：.pi/prompts/wr.md / plan.md ✅ 已创建
- [x] 治理脚本：scripts/verify.mjs + check-docs-governance.mjs + check-contract-coverage.mjs ✅ 已创建
- [x] 04-Todo v0.1.37：登记 T-M1-010 完成（E2E-01~03 学生主路径端到端测试：3 E2E 文件 36 测试 + vitest + child_process.fork + Node.js IPC + 防泄露铁律 assertNoLeakage 双重检查 + 幂等归档 UNIQUE(question_id) + 薄弱点 evidence_count≥2 + 规则批改可证伪全错0分/全对满分 + AI 降级 mock 不连真实服务 + 运行数据隔离 H:\pi-studybuddy-tmp\runs\T-M1-010\；722 单元/集成 + 36 E2E 测试全绿，verify full 阶段全通过；§6.3 M1 退出门槛全勾选 + §9 统计 M1 6 done）—— M1 核心闭环 MVP 退出门槛达成
- [x] 08-Test v0.1.2：§6 E2E 框架由 Playwright 改为 vitest + Electron 启动（pi-studybuddy 是 Electron 单体无独立后端，ai-studybuddy Playwright webServer 模式不适用；参考 pi-desktop 范式，不引入新依赖）
- [x] 04-Todo v0.1.38：登记 T-M2-009 完成（E2E-04~09：S5 期末冲刺 11 用例 + S6 家长报告+UUID 泄漏检测+渠道隔离 6 用例 + S7 课堂采集→S2 handoff 8 用例 + TTS 跨子系统+引擎切换 8 用例 + 备份恢复 content_hash+integrity_check 5 用例 + 定期调度 cron 校验 6 用例 = 44 新增 E2E；test-main.js 扩展 + test.seedModule 种子 + tts-adapter mock engine 修复 + zip-restorer FK 映射修复；80 E2E 全绿；§6.4 M2 退出门槛全勾选 + §9 统计 M2 7 done）—— M2 完整闭环退出门槛达成
- [x] 04-Todo v0.1.40：登记 T-M1-005 完成（OCR venv Adapter 课表图片识别：Python 桥 ocr_bridge.py RapidOCR stdin/stdout JSON 协议 + pytest 7 图格式参数化真实识别 + OcrAdapter 可注入三态 mock/failing/real + handleOcrSchedule 路径校验 + studybuddy_ocr_schedule 工具注册工具数 34→35 + 错误固定文案不泄漏路径/stdout/stderr；743 单元/集成测试 + pytest 7 格式真实识别全绿，type-check + build + smoke 6/6 + 文档治理 + 安全不变量 6/6 全通过；§9 统计 M1 in_progress 1→0 + done 6→7）—— M1 最后一个真实组件 Adapter 完成，M1 剩余 pending：T-M1-006 WPS COM 桥 / T-M1-007 资料转换管道 / T-M1-008 跨切钩子
- [x] 04-Todo v0.1.42：登记 T-M1-006 完成（WPS COM 桥 doc/ppt/xls 转换：Python 桥 wps_bridge.py 经 WPS COM KWPS/KET/KWPP.Application 转 docx/pptx/xlsx 中间格式 + pytest 5 用例三格式真实转换归一化 JSON + 崩溃隔离 + JSON 协议 + WpsAdapter 可注入三态 mock/failing/real + 接入 materials.convert/retryConversion 的 wps_convert 真实转换（成功 Material→converted + Job→completed；失败 conversion_failed + Job→failed；不写 normalized_texts 属 T-M1-007）+ 错误固定文案不泄漏路径/stdout/stderr + 数据隔离 runs/T-M1-006；754 单元/集成测试 + pytest 5 用例真实 WPS 转换全绿，type-check + build + smoke 6/6 + 文档治理 + 安全不变量 6/6 全通过；§9 统计 M1 in_progress 1→0 + done 7→8）—— M1 第二个真实组件 Adapter 完成，M1 剩余 pending：T-M1-007 资料转换管道 / T-M1-008 跨切钩子
- [x] 04-Todo v0.1.43：登记 T-M1-007 开工（§7.2.1 T-M1-007 pending→in_progress + §9 统计 M1 pending 2→1 + in_progress 0→1）。用户批准 T-M1-007 资料转换管道（PDF/DOCX/PPTX/图片 OCR 编排 + normalized_texts 写入）开工（§7.5 全局执行顺序表第 6 行，依赖 T-M1-005 OCR 桥 + T-M1-006 WPS 桥均已就绪）—— M1 第三个真实组件管道编排任务，M1 剩余 pending：T-M1-008 跨切钩子
- [x] 04-Todo v0.1.44：登记 T-M1-007 完成（资料转换管道：TextExtractor 三态 mock/failing/real + Node 库 pdf-parse/jszip/mammoth 真实提取 pdf/docx/pptx/xlsx + OcrAdapter 复用接入 ocr_image + materials.convert/retryConversion 按 job_type 分派提取/OCR + 成功写 normalized_texts（content_hash/char_count/source_type/先删后插幂等）+ Material→converted + 失败 conversion_failed + Job→failed（error_message 固定文案）+ wps_convert 补齐中间格式文本提取 + 合成夹具单件（jszip 构建 OOXML + 受控 pdf）；773 单元/集成测试 + 80 E2E 测试全绿，type-check + build + smoke 6/6 + verify 全绿 + 文档治理 + 安全不变量 6/6 全通过；§9 统计 M1 pending 1→0 + in_progress 1→0 + done 8→9）—— M1 第三个真实组件管道编排任务完成，M1 剩余 pending：T-M1-008 跨切钩子
- [x] 04-Todo v0.1.45：登记 T-M1-008 完成（跨切钩子：before_agent_start 多源上下文注入 L1 画像/激活学期课程/最近事件 + session_start 初始化学期库/L1 目录 + tool_call workspace-path-guard 拦截 write/edit 逃逸业务数据根路径（normalizeToolPath + checkWorkspaceMutationPath + realpath 符号链接逃逸拦截）+ tool_result 集中错误日志 observability（errorCode 提取 + UNKNOWN_TOOL_ERROR 回退 + 日志脱敏）；799 单元/集成测试 + 80 E2E 测试全绿，type-check + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6 全通过；§9 统计 M1 done 9→10）—— M1 最后一个任务完成，M1 全部 10 任务 done，M1 核心闭环 MVP 达成
- [x] 04-Todo v0.1.46：登记 T-M2-006 开工（§7.3.1 T-M2-006 pending→in_progress + §9 统计 M2 pending 2→1 + in_progress 0→1）。用户批准 T-M2-006 S6 assertNoSensitiveLeak UUID 泄漏检测独立校验脚本开工（§7.5 全局执行顺序表第 10 行，前置依赖 T-M2-002 done，leak-detector.ts 已实现，本任务固化独立静态审计脚本 scripts/check-uuid-leak.mjs）—— M2 第 6 个任务开工
- [x] 04-Todo v0.1.47：登记 T-M2-006 完成（S6 assertNoSensitiveLeak UUID 泄漏检测独立校验脚本 scripts/check-uuid-leak.mjs：7 条硬断言 UUID-01~07 静态审计 leak-detector/reports/errors/types 布线，仿 check-desktop-security.mjs 范式；--src 覆盖源根 + readSource 优雅降级；新增 tests/e2e/check-uuid-leak.script.test.ts 脚本冒烟 3 用例；799 单元/集成测试 + 83 E2E 测试全绿，type-check + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6 全通过；§9 统计 M2 in_progress 1→0 + done 7→8）—— M2 第 6 个任务完成，M2 剩余 pending：T-M2-007 whisper.cpp Adapter
- [x] 04-Todo v0.1.49：登记 T-M2-007 完成（whisper.cpp 真实 Adapter：createStudyBuddyExtension 增加可选 whisper 配置 StudyBuddyExtensionOptions.whisperCliPath/whisperModelPath，优先级调用参数 > 环境变量 PI_STUDYBUDDY_WHISPER_CLI/MODEL > 空默认 mock；有 cliPath+modelPath 装配 createRealWhisperAdapter 接入 S7Context；whisper-adapter.ts 头注释更新为真实已接入；真实转写单件测试——合成 3s 正弦波 PCM WAV + 真实 whisper-cli -nt（stdout 即纯文本），探测 whisper-cli+ggml-base.bin 存在才跑，只断言 text 非空+无泄漏字段；装配测试——带 whisper 路径 setup 不抛错+工具数仍 35；集成/E2E 保持 mock 08-Test §9.3；802 单元/集成测试 + 83 E2E 测试全绿，type-check + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6 全通过；§9 统计 M2 in_progress 1→0 + done 8→9）—— M2 最后一个任务完成，M2 全部 9 任务 done

## 八、版本历史

| 版本 | 日期 | 变更 |
|---|---|---|
| v0.1.57 | 2026-08-08 | 04-Todo v0.1.51 登记 T-M3-001 完成（§7.4.1 T-M3-001 in_progress→done + §9 统计 M3 in_progress 1→0 + done 0→1）+ 06-API v0.1.2（§3.1.1 新增 agent.send 契约）。原因：T-M3-001 💬 对话 Tab 默认主入口实施完成，质量门全通过（type-check + 823 单元/集成测试 + 83 E2E 测试 + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记 + 06-API 新增 agent.send，无权威条款变更。M3 剩余 pending：T-M3-002~008。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |（§7.4.1 T-M3-001 pending→in_progress + §9 统计 M3 pending 8→7 + in_progress 0→1）。原因：用户批准 T-M3-001 💬 对话 Tab 默认主入口开工（§7.5 全局执行顺序表第 11 行，M3 起点，前置依赖 M1+M2 E2E 通过）。影响：仅版本号同步 + 状态登记，无权威条款变更。M3 剩余 pending：T-M3-002~008。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |（§7.3.1 T-M2-007 in_progress→done + §9 统计 M2 in_progress 1→0 + done 8→9）。原因：T-M2-007 whisper.cpp 真实 Adapter 替换 mock 实施完成，质量门全通过（type-check + build + 802 单元/集成测试 + 83 E2E 测试 + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：M2 全部 9 任务完成。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.54 | 2026-08-08 | 04-Todo v0.1.48 登记 T-M2-007 开工（§7.3.1 T-M2-007 pending→in_progress + §9 统计 M2 pending 1→0 + in_progress 0→1）。原因：用户批准 T-M2-007 whisper.cpp 真实 Adapter 替换 mock 开工（§7.5 全局执行顺序表第 8 行，whisper.cpp CLI 就绪，阶段1 done）。影响：仅版本号同步 + 状态登记，无权威条款变更。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.53 | 2026-08-08 | 04-Todo v0.1.47 登记 T-M2-006 完成（§7.3.1 T-M2-006 in_progress→done + §9 统计 M2 in_progress 1→0 + done 7→8）。原因：T-M2-006 S6 assertNoSensitiveLeak UUID 泄漏检测独立校验脚本实施完成，质量门全通过（type-check + build + 799 单元/集成测试 + 83 E2E 测试 + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记，无权威条款变更。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.52 | 2026-08-08 | 04-Todo v0.1.46 登记 T-M2-006 开工（§7.3.1 T-M2-006 pending→in_progress + §9 统计 M2 pending 2→1 + in_progress 0→1）。原因：用户批准 T-M2-006 S6 assertNoSensitiveLeak UUID 泄漏检测独立校验脚本开工（§7.5 全局执行顺序表第 10 行，前置依赖 T-M2-002 done）。影响：仅版本号同步 + 状态登记，无权威条款变更。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.51 | 2026-08-08 | 04-Todo v0.1.45 登记 T-M1-008 完成（§7.2.1 T-M1-008 pending→done + §9 统计 M1 done 9→10）。原因：T-M1-008 跨切钩子实施完成，质量门全通过（type-check + 799 单元/集成测试 + 80 E2E 测试 + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：M1 全部 10 任务完成，M1 核心闭环 MVP 达成。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.50 | 2026-08-08 | 04-Todo v0.1.44 登记 T-M1-007 完成（§7.2.1 T-M1-007 in_progress→done + §9 统计 M1 pending 1→0 + in_progress 1→0 + done 8→9）。原因：T-M1-007 资料转换管道实施完成，质量门全通过（type-check + build + 773 单元/集成测试 + 80 E2E 测试 + smoke 6/6 + verify 全绿 + 文档治理 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记，无权威条款变更。M1 剩余 pending：T-M1-008 跨切钩子。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.49 | 2026-08-08 | 04-Todo v0.1.43 登记 T-M1-007 开工（§7.2.1 T-M1-007 pending→in_progress + §9 统计 M1 pending 2→1 + in_progress 0→1）。原因：用户批准 T-M1-007 资料转换管道开工（§7.5 全局执行顺序表第 6 行，依赖 T-M1-005 OCR 桥 + T-M1-006 WPS 桥均已就绪）。影响：仅版本号同步 + 状态登记，无权威条款变更。M1 剩余 pending：T-M1-008 跨切钩子。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.48 | 2026-08-08 | 04-Todo v0.1.42 登记 T-M1-006 完成（§7.2.1 T-M1-006 in_progress→done + §9 统计 M1 in_progress 1→0 + done 7→8）。原因：T-M1-006 WPS COM 桥 doc/ppt/xls 转换实施完成，质量门全通过（type-check + 754 单元/集成测试 + pytest 5 用例真实 WPS 转换 + build + smoke 6/6 + 文档治理 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记，无权威条款变更。M1 剩余 pending：T-M1-007 资料转换管道 / T-M1-008 跨切钩子。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.47 | 2026-08-08 | 04-Todo v0.1.40 登记 T-M1-005 完成（§7.2.1 T-M1-005 in_progress→done + §9 统计 M1 in_progress 1→0 + done 6→7）。原因：T-M1-005 OCR venv Adapter 课表图片识别实施完成，质量门全通过（type-check + 743 单元/集成测试 + pytest 7 格式真实识别 + build + smoke 6/6 + 文档治理 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记，无权威条款变更。M1 剩余 pending：T-M1-006 WPS COM 桥 / T-M1-007 资料转换管道 / T-M1-008 跨切钩子。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.46 | 2026-08-08 | 04-Todo v0.1.39 登记 T-M1-005 开工（§7.2.1 T-M1-005 pending→in_progress + §9 统计 M1 pending 4→3 + in_progress 0→1）。原因：用户批准 T-M1-005 OCR venv Adapter 课表图片识别开工（§7.5 全局执行顺序表第 5 行，venv 就绪，阶段1 已下载）。影响：仅版本号同步 + 状态登记，无权威条款变更。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.45 | 2026-08-08 | 04-Todo v0.1.38 登记 T-M2-009 完成（§7.3.1 T-M2-009 pending→done + §6.4 M2 退出门槛全勾选 + §9 统计 M2 done 6→7）。原因：T-M2-009 E2E-04~09 实施完成，质量门全通过（type-check + 722 单元/集成测试 + 80 E2E 测试 + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：M2 退出门槛六项全勾选，M2 完整闭环达成。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.44 | 2026-08-08 | 04-Todo v0.1.37 登记 T-M1-010 完成（§7.2.1 T-M1-010 pending→done + §6.3 M1 退出门槛全勾选 + §9 统计 M1 done 5→6）。原因：T-M1-010 E2E-01~03 实施完成，质量门全通过（type-check + 722 单元/集成测试 + 36 E2E 测试 + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记，无权威条款变更。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.43 | 2026-08-08 | 04-Todo v0.1.36 登记 T-M2-008 完成（§7.3.1 T-M2-008 in_progress→done + §9 统计 M2 in_progress 1→0 + done 5→6）。原因：T-M2-008 09-UI S5-S7+TTS+备份恢复 UI 实施完成，质量门全通过（type-check + 722 测试 + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记，无权威条款变更。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.42 | 2026-08-08 | 04-Todo v0.1.35 登记 T-M2-008 开工（§7.3.1 T-M2-008 pending→in_progress + §9 统计 M2 pending 4→3 + in_progress 0→1）。原因：用户批准 T-M2-008 09-UI S5-S7+TTS+备份恢复 UI 开工（§7.5 全局执行顺序表第 2 行）。影响：仅版本号同步 + 状态登记，无权威条款变更。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.41 | 2026-08-08 | 04-Todo v0.1.34 登记 T-M1-009 完成（§7.2.1 T-M1-009 in_progress→done + §9 统计 M1 in_progress 1→0 + done 4→5）。原因：T-M1-009 09-UI S1-S4 业务 UI 实施完成，质量门全通过（type-check + 656 测试 + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅版本号同步 + 状态登记，无权威条款变更。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.40 | 2026-08-08 | 04-Todo v0.1.33 登记 T-M1-009 开工（§7.2.1 T-M1-009 pending→in_progress + §9 统计 M1 pending 6→5 + in_progress 0→1）。原因：用户批准 T-M1-009 09-UI S1-S4 业务 UI 开工（§7.5 全局执行顺序表第 1 行）。影响：仅版本号同步 + 状态登记，无权威条款变更。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.39 | 2026-08-08 | 04-Todo v0.1.32 登记 M3 task-id（§7.4.1 T-M3-001~008 全部 pending）+ 新增 §7.5 全局执行顺序表（18 行统一排序 M1/M2/M3 pending，明确前置依赖和执行理由）。原因：用户要求把 M3 和 M1/M2 的 pending 放一起明确先后顺序。影响：M3 登记表 +8 行，全局执行顺序表 +18 行，§9 统计数字不变。依据：AGENTS.md §11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 |
| v0.1.38 | 2026-08-08 | 04-Todo v0.1.31 登记待做项 task-id（建议 B）：§7.2.1 M1 追加 T-M1-005~010（OCR venv Adapter / WPS COM 桥 / 资料转换管道 / 跨切钩子 / 09-UI S1-S4 / E2E-01~03，全部 pending）+ §7.3.1 M2 追加 T-M2-006~009（S6 UUID 泄漏检测 / whisper.cpp 真实 Adapter / 09-UI S5-S7+TTS+备份恢复 / E2E-04~09，全部 pending）。原因：用户核对发现 §6.3/§6.4 范围项与已登记 task 数量对不上，待做项未登记导致统计无法反映真实待办。影响：登记表行数增加 10 行，§9 统计数字不变（M1 10/6/4、M2 9/4/5 已正确），但含义清晰化——总任务数=已登记 task-id 数，里程碑退出门槛未全勾选前不算完成。依据：AGENTS.md §11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 |
| v0.1.37 | 2026-08-08 | 04-Todo v0.1.30 §9 统计修正：M1 pending 5→6（大纲 10 行 - done 4 = 6，原写 5 为计数错误），合计 pending 17→18。原因：用户核对发现计划任务与实现任务数量对不上。影响：仅统计数字修正，无权威条款变更。依据：AGENTS.md §11.2 修订纪律 |
| v0.1.36 | 2026-08-08 | T-M2-005 备份恢复工具注册 + API 完成（M2 第 5 任务，M2 最后一个业务 Adapter）：7 RPC handler（backup.course 单课程 zip 打包 manifest.json+data/*.jsonl+storage/ + content_hash=SHA-256 + 写 backup_records(manual) / backup.allCourses 遍历 course_instances 逐个备份 / backup.restore 解压+content_hash 校验+schema_version 兼容+冲突 overwrite/create_new/none+jsonl 导入+storage 复制+PRAGMA integrity_check / backup.list 按 semesterId/courseInstanceId 过滤 / backup.configureSchedule 写 backup_schedules cron_expression+timezone / backup.listSchedules 查询 / backup.toggleSchedule 启用/禁用）+ 5 studybuddy_* 工具（backup_course/backup_all_courses/restore_course/list_backups/configure_backup_schedule）+ BackupContext 句柄管理 + 手写最小 zip 格式（Node 内置 zlib，无外部依赖）+ zip 炸弹防护条目数+解压比限制 AGENTS.md §9.4 + 符号链接逃逸防护 + 错误码固定文案不泄漏路径/stdout/stderr + backup_records 状态机 in_progress→completed/failed + Streams["backup.progress"] 推送 + 调度配置 CRUD + DTO 对齐 05-ERD §2.3/§2.4（BackupRecord 15 字段+BackupSchedule 10 字段+RestoreResult 补 schemaVersion）；studybuddy-extension 接入备份恢复共 34 工具；扩展装配测试同步更新 29→34；单件 backup-zip-packer 7 + backup-zip-restorer 6 + backup-handlers 10 + backup-tools 8 + 集成 backup-handlers 5 测试，598 测试全绿（43 test files），type-check + build + smoke 6 项全通过 + 文档治理检查通过；04-Todo → v0.1.29（§7.3.1 T-M2-005 done + §9 统计 M2 5 done）；§三表格 04-Todo 版本号同步；§七登记 T-M2-005 done —— M2 业务 Adapter 层全部完成 |
| v0.1.35 | 2026-08-07 | T-M2-004 TTS skill 工具注册 + API 完成（M2 第 4 任务）：4 RPC handler（tts.speak SAPI 默认 + edge-tts 失败降级 fallbackUsed=true + tts.control play/pause/stop 状态机 + tts.switchEngine 切换引擎 + tts.getStatus 查询）+ 3 studybuddy_* 工具（tts_speak/tts_control/tts_switch_engine）+ TtsContext 双引擎可注入 sapiAdapter/edgeTtsAdapter + TtsAdapter 接口 mock/failing/failingEdge/realSapi/realEdgeTts 五实现（参照 WhisperCppAdapter 范式，真实 spawn 框架不连真实子进程 08-Test §5.4 全 mock）+ 朗读状态机 idle→playing→paused→stopped + Streams["tts.state"] 推送 + 无独立 TTS 表朗读不持久化（03-Arch §3.1）+ 朗读不写 StudyEvent（08-Test §3.5 断言 3）+ 错误消息固定文案不泄漏路径/stdout/stderr/密钥 + 契约微调 api.ts tts.speak result 扩展 engine/fallbackUsed 对齐 08-Test §3.5 断言 + types.ts 补 TtsSpeakResult；studybuddy-extension 接入 TTS 工具注册共 29 工具；扩展装配测试同步更新 26→29；单件 tts-adapter 18 + tts-handlers 19 + tts-tools 9 + 集成 tts-handlers 7 测试，562 测试全绿（38 test files），type-check + build + smoke 6 项全通过；04-Todo → v0.1.28（§7.3.1 T-M2-004 done + §9 统计 M2 4 done）；§三表格 04-Todo 版本号同步；§七登记 T-M2-004 done |
| v0.1.34 | 2026-08-07 | T-M2-003 S7 课堂采集工具注册 + API 完成（M2 第 3 任务）：2 RPC handler（classCapture.transcribe 许可确认强制 permissionConfirmed=false→BAD_REQUEST + PCM WAV 文件头服务端字节级验证 + WhisperCppAdapter 可注入 + 错误消息固定文案不泄漏路径/stdout/stderr/密钥 + 原始音频 tmp/class-capture/<request-id>/ finally 清理 / classCapture.saveTranscription handoff 到 S2 materials+normalized_texts+study_events）+ 2 studybuddy_* 工具（transcribe_class/save_transcription）+ S7Context 句柄管理 + WhisperCppAdapter 可注入（mock/failing/real 三实现，真实 spawn 框架不连真实子进程 08-Test §5.4 全 mock）+ wav-validator 44 字节头部 8 项校验（RIFF/WAVE/PCM/16kHz/单声道/16-bit）+ handoff source_type='class_audio_transcription' / status='converted' / permission_confirmed=1 / content_hash=SHA-256 / event_type='class_handoff_saved' source_system='S7'；前置 DTO/schema 已就绪无需修改；studybuddy-extension 接入 S7 工具注册共 26 工具；扩展装配测试同步更新 24→26；单件 wav-validator 14 + whisper-adapter 8 + class-capture 14 + s7-tools 9 + 集成 s7-handlers 9 测试，509 测试全绿（34 test files），type-check + build + smoke 6 项全通过；04-Todo → v0.1.26（§7.3.1 T-M2-003 done + §9 统计 M2 3 done）；§三表格 04-Todo 版本号同步；§七登记 T-M2-003 done |
| v0.1.33 | 2026-08-07 | T-M2-002 S6 家长报告工具注册 + API 完成（M2 第 2 任务）：11 RPC handler（reports.generate 规则生成 + 跨库聚合 S1-S5 摘要 + ReportPolisher 可注入 mock AI 润色失败降级 / reports.freeze 冻结状态机 draft→frozen / reports.get/getList；deliveries.deliver 渠道独立失败隔离 + study_events 写入 report_delivered / deliveries.retry / deliveries.list；reportTargets.list/create/update/delete 软删）+ 3 studybuddy_* 工具（generate_parent_report/deliver_report/manage_report_targets）+ S6Context 句柄管理 + lookup 跨库查找 + leak-detector UUID 泄漏检测（content_json 全文扫描 UUID 正则）+ DeliveryChannel 可注入 mock（local_export/smtp/feishu_webhook/print 四渠道，单渠道失败不影响其他）+ DTO 对齐 ERD §2.2 parent_report_targets + §3.6 parent_reports/parent_report_deliveries；修复 report-generator buildExamReminder 查询 assessment_attempts 用 confirmation_status='confirmed'（非 confirmed 列）+ events.ts study_events 列名 event_data_json（非 metadata_json）；studybuddy-extension 接入 S6 工具注册共 24 工具；单件 16 + 集成 19 测试，455 测试全绿（29 test files），verify 7+2 全通过；04-Todo → v0.1.25（§7.3.1 T-M2-002 done + §9 统计 M2 2 done）；§三表格 04-Todo 版本号同步；§七登记 T-M2-002 done |
| v0.1.32 | 2026-08-07 | T-M2-001 S5 期末冲刺工具注册 + API 完成（M2 首任务）：8 RPC handler（mockExams.generatePaper 触发器校验 confirmed + source_hash 防重复 + MockExamGenerator 可注入 mock + AI 失败不创建空卷→INTERNAL_ERROR / getPaper 未提交不含 correct_answer 防泄露 / startAttempt 状态机 in_progress / submitAttempt 复用 S3 grader 三策略批改 + in_progress→graded + 模块分析 weakness_level strong/medium/weak + study_events 写入 / getResult / getModuleAnalyses；cramCards.get 确定性只读 DTO 不暴露题干/答案/作答 + 未确认考试 BAD_REQUEST；cramPlan.get 7 天 DTO 确定性只读不替学生改写事实 + 按剩余天数排序）+ 2 studybuddy_* 工具 + S5Context 复用 S1/S2/S3/S4 模式 + lookup 跨库查找 + MockExamGenerator 可注入 + aggregator 确定性聚合（只读 S2/S3/S4 摘要）；DTO 对齐 ERD §3.5 五表；studybuddy-extension 接入 S5 工具注册共 21 工具；单件 11 + 集成 26 测试，420 测试全绿（27 test files），verify 7+2 全通过；04-Todo → v0.1.24（新增 §7.3.1 M2 任务登记表 T-M2-001 done + §9 统计 M2 1 done）；§三表格 04-Todo 版本号同步；§七登记 T-M2-001 done —— M2 首任务落地 |
| v0.1.31 | 2026-08-07 | T-M1-004 S4 错题/薄弱点工具注册 + API 完成（M1 第 4 任务）：10 RPC handler（mistakes.list/get/archive/confirmErrorCause/suggestErrorCause/redo + weakPoints.list/get/resolve/regress）+ 4 studybuddy_* 工具 + S4Context 复用 S1/S2/S3 模式 + ErrorCauseAdvisor 可注入 mock + aggregator 私有 evidence_count≥2 归纳 + DTO 对齐 ERD §3.4 三表；schema 修复 mistake_evidence.source_practice_answer_id 改为可空（redo 证据不依赖新 practice_answer，规避 UNIQUE(practice_session_id, question_id) + T5 触发器冲突）；studybuddy-extension 接入 S4 工具注册共 19 工具；383 测试全绿（25 test files，S4 集成 28 + 单件 + 扩展），verify 7+2 全通过；04-Todo → v0.1.23（§7.2.1 T-M1-004 done + §9 统计 M1 4 done）；§三表格 04-Todo 版本号同步；§七登记 T-M1-004 done |
| v0.1.30 | 2026-08-07 | T-M1-003 S3 限时练习工具注册 + API 完成（M1 第 3 任务）：5 RPC handler（practice.createSession 校验 questionCount 5-20 + 可注入 QuestionGenerator mock 生成题 / getQuestions 作答前 DTO 防泄露 / submit 规则批改三策略（单选精确/多选 deepEquals/填空 normalize+多等价答案）/ getResult 含逐题正确答案解析 / listSessions）+ 3 studybuddy_* 工具 + S3Context 复用 S1/S2 模式 + QuestionGenerator 可注入 + grader.ts 纯确定性规则不调 LLM + DTO 对齐 ERD §3.3 三表（PracticeSession/PracticeResult 补字段 + status 改 in_progress/submitted/graded）；AI 失败不创建空 session→INTERNAL_ERROR；studybuddy-extension 接入 S3 工具注册共 15 工具；单件 15 + 集成 26 + 扩展 14 测试，336 测试全绿，verify 7+2 全通过；04-Todo → v0.1.21（§7.2.1 T-M1-003 done + §9 统计 M1 3 done）；§三表格 04-Todo 版本号同步；§七登记 T-M1-003 done |
| v0.1.29 | 2026-08-07 | T-M1-002 S2 资料/笔记/知识模块工具注册 + API 完成（M1 第 2 任务）：17 RPC handler（materials 9 含状态机+Job 登记 / notes 3 / modules 3 含学习状态机 / jobs 2）+ 6 studybuddy_* 工具（TypeBox schema + execute 薄封装 handler）+ S2Context 复用 S1 模式 + lookup 跨库查找 + DTO 对齐 ERD §3.2 七表（5 DTO + JobStatus/JobType）；studybuddy-extension 接入 S2 工具注册（12 工具并列）；单件 24 + 集成 34 + 扩展 14 测试，295 测试全绿，verify 7+2 全通过；04-Todo → v0.1.19（§7.2.1 T-M1-002 done + §9 统计 M1 2 done）；§三表格 04-Todo 版本号同步；§七登记 T-M1-002 done |
| v0.1.28 | 2026-08-07 | T-M1-001 S1 学习节奏工具注册 + API 完成（M1 首任务）：25 RPC handler（semesters 6 含跨库写+状态机 / courses 5 / exams 4 含四态确认 / schedule 4 / tasks 4 含 dailyBrief 规则聚合 / events 2）+ 6 studybuddy_* 工具（TypeBox schema + execute 薄封装 handler）+ S1Context 句柄管理 + lookup 跨库查找 + SqlParams 类型对齐 node:sqlite SQLInputValue；studybuddy-extension 接入 S1 工具注册；单件 30 + 集成 33 + 扩展契约 5 测试，237 测试全绿，verify 7+2 全通过；04-Todo → v0.1.17（§7.2.1 T-M1-001 done + §9 统计 M1 1 done）；§三表格 04-Todo 版本号同步；§七登记 T-M1-001 done（含 v0.1.16 开工补登记） |
| v0.1.27 | 2026-08-07 | T-M0-009 M0 系统冒烟完整完成（M0 收官）：smoke.mjs 扩展覆盖 §6.2 退出门槛六项（build 产物 10 项 + RPC system.ping 往返 + global.db 4 表建库 + semester.db 25 表建库 + credential-vault set→get 往返/磁盘无明文/键名校验 + 安全不变量六条子进程）；补全 INV-06（HTML_PREVIEW_CSP form-action 'none' + protocol.ts 对 .html 接入）；check-desktop-security.mjs 六条转硬断言移除占位宽松；verify.mjs desktop-security 改硬阻塞；invariants.test.ts 加 INV-04/05/06 三断言；171 测试全绿，verify 全绿（执行 7 跳过 2）；04-Todo → v0.1.15（§6.0 M0 完成与版本演进说明 + §9 统计口径修正 M0 9 task-id + 头部版本号滞后修正）；§三表格 04-Todo 版本号同步；§七登记 T-M0-009 done（M0 9 任务全 done） |
| v0.1.26 | 2026-08-07 | T-M0-008 09-UI 三栏布局 + 标签页骨架完成：src/renderer/tabs.ts（9 Tab 纯数据 + DEFAULT_TAB_ID=chat）+ src/renderer/components/AppShell.tsx（三栏布局壳：标题栏 + 左侧栏导航 + 主内容区 TabBar + 朗读控制条占位 + 右侧面板上下文 + 状态栏）+ src/renderer/components/TabBar.tsx（9 Tab + aria-selected 激活态）+ App.tsx 组装 AppShell（保留 T-M0-001 RPC 通道验证）；测试策略：renderToStaticMarkup 静态渲染断言（不引入 jsdom/@testing-library/react）；vitest.config.ts 加 @vitejs/plugin-react 插件解析 tsx；单件 14 断言全绿，verify 全绿（168 测试）；04-Todo → v0.1.13；§三表格 04-Todo 版本号同步（T-M0-001/002/003/004/005/006/007/008 done） |
| v0.1.25 | 2026-08-07 | T-M0-007 studybuddy-extension 空壳完成：src/agent/studybuddy-extension.ts（createStudyBuddyExtension 工厂返回 pi ExtensionFactory 空 setup，零工具/零钩子/零 provider）；pi 底座 @earendil-works/pi-coding-agent@0.80.10 + pi-ai@0.80.10 安装为 dependencies（计划 0.84.0 降级为 0.80.10，原因：0.84.0 npm 包缺 dist 目录）；tsconfig.node.json include 加 src/agent；pnpm-workspace.yaml allowBuilds 补 @google/genai + protobufjs；单件 7 + 集成 4 测试全绿，verify 全绿（154 测试）；04-Todo → v0.1.11（§4.1 看板 pi 阶段1/3 ✅ + §9 统计 M0 7 done）；§三表格 04-Todo 版本号同步（T-M0-001/002/003/004/005/006/007 done） |
| v0.1.24 | 2026-08-07 | T-M0-005 file-watch 完成：fs.watch({ recursive: true }) + 100ms 防抖 → Streams["files.changed"] 推送 { path, changeType }；per-target lastExists 跟踪推断 changeType（避开 Windows eventType 不可靠）；src/agent-host/file-watch.ts + handlers/files.ts + index.ts 装配；单件 14 + 集成 8 测试全绿，verify 全绿（143 测试）；04-Todo → v0.1.9；§三表格 04-Todo 版本号同步（T-M0-001/002/003/004/005/006 done） |
| v0.1.23 | 2026-08-07 | T-M0-004 toolchain 完成：discovery→probe→install→prependPath 四段式框架落地（src/main/toolchains/ 11 文件 + src/agent-host/toolchain-runtime.ts + handlers）；14 种 capability 全保留，仅框架不实现组件下载；单件 16 + 集成 5 测试全绿，verify 全绿（121 测试）；04-Todo → v0.1.7；§三表格 04-Todo 版本号同步（T-M0-001/002/003/004/006 done） |
| v0.1.22 | 2026-08-07 | T-M0-003 credential-vault 完成：src/main/credential-vault.ts（safeStorage/DPAPI 密钥库 + 原子写 0o600 + 键名校验 + 加密不可用安全降级）+ 单件 8 断言；scripts/check-desktop-security.mjs INV-04 占位转真实断言（已实现 5 条全绿）；verify 全绿（执行 7，跳过 2，100 测试）；04-Todo → v0.1.6；§三表格 04-Todo 版本号同步（T-M0-001/002/003/006 done） |
| v0.1.21 | 2026-08-07 | T-M0-006 数据层 schema 完成：global.db 4 表 + semester.db 25 表 9 触发器 + 三层记忆（L1/L2/L3）+ PRAGMA + integrity 断言；node:sqlite 经 process.getBuiltinModule 动态加载规避 esbuild 剥离 node: 前缀；单件 13 + 集成 4 测试全绿，verify 全绿；04-Todo → v0.1.5；§三表格 04-Todo 版本号同步（T-M0-001/002/006 done） |
| v0.1.20 | 2026-08-07 | T-M0-002 contract 类型化契约面完成：api 126 方法 + types DTO + streams 9 主题 + PiBridge 8 桥面 + preload 转发 + 类型契约测试 25 断言；04-Todo → v0.1.4；AGENTS.md §3.1 版本登记同步；§三表格 04-Todo 版本号同步 |
| v0.1.19 | 2026-08-07 | T-M0-001 Electron 四进程骨架完成：04-Todo → v0.1.3（§7.1.1 M0 任务登记表 + §9 任务统计）；AGENTS.md → v0.1.4（§10 补全 M0 pnpm 命令）；§三表格同步 |
| v0.1.18 | 2026-08-07 | 01-TRD v0.2.2：§7 加决策 6「v0.1 交付形态：源码形态（pnpm dev 直接运行），不打包 .exe」——依据 AGENTS.md §1.2（v0.1 禁用运行级使用）+ §6.4（禁止提前设计 v0.2+ 产品化机制）；§三表格同步 01-TRD 版本号；M0 完成后在 04-Todo §6.0 补版本演进说明 |
| v0.1.17 | 2026-08-07 | 省察修复批次：删除根目录 14 份 docs/ 副本 + CLAUDE.md + src/tests/6 源文件 + 6 配置文件（清空重来）；.plan/00-当前任务.md 修正自指谎言（"master 干净"改为事实）；T-M0-010 重编号为 T-M0-009 纠正跳号笔误；.gitignore 补 .workbuddy/；check-docs-governance.mjs 加文档位置校验（根目录不得有 docs/ 副本）；AGENTS.md §3.1 版本登记同步（00-索引 v0.1.17 / 04-Todo v0.1.2）+ §11.4 加二次审查交叉验证条款；04-Todo 升 v0.1.2 |
| v0.1.16 | 2026-08-07 | 第五批治理资产收尾：.plan/ 目录就绪（00-当前任务.md 占位"无执行中任务" + README.md 单一任务门禁说明）；.record/ 目录就绪（README.md 8 章节模板）；04-Todo 升级 v0.1.1 追加 §1.4 治理体系就绪状态（10 类资产清单 + M0 启动前置确认）；§三 表格 04-Todo 版本号同步 v0.1.1 |
| v0.1.15 | 2026-08-07 | 治理体系资产登记：§三 表格补 10-开发规范 / 11-组件装配 / 12-目录治理 三份治理文档登记；§七 当前状态补齐 10/11/12 + AGENTS.md + README.md + 治理 Skills + 工作流模板 + 治理脚本 五类治理资产状态 |
| v0.1.14 | 2026-08-07 | 全文档审查批准：02-PRD v0.1.3 / 03-Arch v0.1.1 / 05-ERD v0.1.1 / 06-API v0.1.1 / 07-Workflow v0.1.1 / 08-Test v0.1.1 六个文档用户全部批准。设计阶段正式闭环：10 文档全部 ✅ 已审查批准，可启动 M0 骨架开发 |
| v0.1.13 | 2026-08-07 | 04-Todo v0.1.0 审查批准：里程碑划分/任务大纲粒度/task-id 规范/完成门槛四项通过。文档体系 10 文档全部创建完成，设计阶段闭环 |
| v0.1.12 | 2026-08-07 | 04-Todo v0.1.0 草案创建：任务登记规范（task-id/字段/状态机）+ 组件治理看板（五阶段跟踪）+ 完成门槛（门禁+退回机制）+ 里程碑规划（M0骨架/M1核心闭环/M2完整闭环/M3对话打磨）+ 39 任务大纲（基于 03-Arch §9.1 推导）+ 修复记录区（08-Test §11.3 证据） |
| v0.1.11 | 2026-08-07 | 09-UI v0.1.2 审查定案：§4 子章节编号修正（4.3 重号→4.4-4.10 连续）；§12 Streams 与 06-API §4 对齐（material.status→jobs.progress，context.usage 归入 agent.events，补 toolchains.changed）；§14.1 补充 E2E-10~13 对话 Tab UI 断言。审查结论：完整性/上游一致性/铁律落实/E2E 覆盖四项通过 |
| v0.1.10 | 2026-08-07 | 对话功能贯通修订（"💬 对话"默认 Tab 影响扩散到全文档）：01-TRD v0.2.1（§2.4 会话管理行补对话默认主入口）；02-PRD v0.1.3（§1.2 愿景 + §3.11 通用 AI 对话）；03-Architecture v0.1.1（§6.7 会话管理补 pi 原生 AI 对话默认主入口）；05-ERD v0.1.1（§4.3 L3 补对话 Tab 会话承载注）；06-API v0.1.1（§3.1 sessions 补对话 Tab 承载注解）；07-Workflow v0.1.1（§1.1 + §2.8 通用 AI 对话路径）；08-Test v0.1.1（§6.5 对话 E2E + §7.1 闭环表） |
| v0.1.9 | 2026-08-07 | 09-UI v0.1.1 修订：按用户反馈把"💬 对话"提升为默认第一标签页，ChatInput 升级为核心承载 pi 原生 AI 对话能力——pi 天生自带对话，作为"专属 studybuddy"不废弃，避免学生被迫用别的 AI |
| v0.1.8 | 2026-08-07 | 09-UI v0.1.0 草案完成待审查（三栏布局 + 8 学习标签页 S1-S7 + TTS 随时可击发 UI + 备份恢复 + 会话业务化 + 文件体验 + 技能/模型管理 + 设置 + 安全隐私边界 + Streams 映射 + 响应式） |
| v0.1.7 | 2026-08-07 | 07-Workflow v0.1.0 审查批准；08-Test v0.1.0 草案完成待审查（测试金字塔 + 四层分层 + 单件/集成/系统冒烟/系统 E2E + 关键断言矩阵 + 11 状态机测试 + 安全不变量校验 + 夹具与运行隔离） |
| v0.1.6 | 2026-08-07 | 06-API v0.1.0 审查批准；07-Workflow v0.1.0 草案完成待审查（学生主路径 S1-S7 闭环 + 家长报告 + TTS 朗读 + 备份恢复 + 组件治理 + 调度层 + 11 状态机汇总） |
| v0.1.5 | 2026-08-07 | 05-ERD v0.1.0 审查批准；06-API v0.1.0 草案完成待审查（RPC 契约 + API 信封 + 5 错误码 + 100+ 方法表 + 9 Streams + DTO 规范） |
| v0.1.4 | 2026-08-07 | 03-Architecture v0.1.0 审查批准；05-ERD v0.1.0 草案完成待审查（全局库 + 学期库 S1-S7 全量表 30+ + 三层记忆 + ER 图 + 触发器 + 索引 + 备份 zip 结构） |
| v0.1.3 | 2026-08-07 | 02-PRD v0.1.2 审查批准（含 TTS 跨子系统 + 备份恢复）；03-Architecture v0.1.0 草案完成待审查（四层架构 + pi 扩展层 + 业务 Adapter + 数据层 + 技能体系 + 桌面壳 + 调度 + 安全） |
| v0.1.2 | 2026-08-07 | 01-TRD 升级 v0.2.0（五点待决项定案）；新增 prep-参考点核对表（03-Architecture 准备材料）；02-PRD v0.1.0 草案完成待审查 |
| v0.1.1 | 2026-08-06 | 加入 pi-desktop 参考仓库（使用者介面范本，Apache-2.0）；文档结构增加 09-使用者介面 |
| v0.1.0 | 2026-08-06 | 初始版本：仓库初始化、参考仓库下载梳理、文档结构定义 |
