# T-M4-015：S5 冲刺 Tab RPC 接线

**任务 ID**：T-M4-015  
**任务登记依据**：docs/04-任务清单-Todo-List.md T-M4-015；docs/09-使用者介面-UI-Design.md §4.8；docs/06-API契约-API-Contracts.md §3.7  
**提示词属性**：受控参考资产，不是 `.plan/`，不代表开工或 Git 收口授权。


## 调用方式

先把 `00-标准任务执行提示词.md` 与本文件一并提供给执行 Agent。本文件只提供当前任务的**范围和验收主题**；实际文件清单、实施序列、RED 测试与证据只能在获得开工授权后写入唯一 `.plan/`。

## 任务状态前提

本文件不改变任务状态。执行前必须重新核验 docs/04、`.plan/00-当前任务.md`、Git 工作区、`master` 与 `origin/master`；上一任务未完成时立即停止。


## 任务目标

在既有 S5 handler 与 AppShell 上下文之上，接通模拟考、临考速背卡和七天冲刺计划的 renderer UI；保持规则优先、确定性只读与学生决策边界。

## 权威入口

- docs/04-任务清单-Todo-List.md T-M4-015；docs/09-使用者介面-UI-Design.md §4.8；docs/06-API契约-API-Contracts.md §3.7
- AGENTS.md §4.4、§5、§7、§8、§9、§10、§11
- docs/03-架构设计-Architecture-Design.md §6.7（AppShell 上下文与 Tab 数据生命周期）
- docs/07-工作流-Workflow.md 的对应业务路径、状态机与错误处理条款
- docs/08-测试验收-Test-Plan.md §5、§6、§7
- docs/09-使用者介面-UI-Design.md 的对应 Tab/UI 章节
- 紧邻前序任务的 `.plan/`、`.record/`、源代码与真实 Electron E2E

## 既有能力与允许接线范围

- `mockExams.generatePaper/getPaper/startAttempt/submitAttempt/getResult/getModuleAnalyses`；
- `cramCards.get({ assessmentAttemptId })`；
- `cramPlan.get({ assessmentAttemptId })`；
- 复用前序 PracticeTab 的计时、作答、竞态、错误净化和真实 Electron 经验，但不得复制或改变其 S3 语义。

## 必须保持的约束

- 生成模拟卷前 assessmentAttempt 必须已 confirmed，由后端触发器/handler 判定；
- 模拟考题目、答案、评分与模块分析必须来自既有 API；
- cramCards/cramPlan 是确定性、即时、只读 DTO：不持久化、不依赖 AI；
- 速背卡不得暴露题干、答案或学生作答；冲刺计划不得替学生改写事实；
- 归档、竞态、重复提交、错误净化与数据根隔离均适用。

## RED 测试与验收主题

- 无有效 assessment context 时正确门控；
- 模拟卷生成、开始、答题、提交、结果和模块分析；
- 速背卡翻页、importance、要点展示与只读边界；
- 七天计划按既有 DTO 展示，不自行写入计划；
- 超时/重复提交/切换课程或 assessment/卸载的竞态保护；
- archived 只读、隐私展示与真实 Electron E2E。

## 明确非目标与停止条件

- 不新增模拟考/速背/计划 API、handler 或 schema；
- 不接入 TTS 控制条（T-M4-018）；
- 不做跨 Tab S4/S5 状态重构；
- 需要变更确认考试流程或出题规则时停止并请求裁决。

完成本地实施后，必须按 `00-标准任务执行提示词.md` 的受控收尾与标准验收报告执行；未经用户单独授权，不得提交、合并、推送或启动下一任务。
