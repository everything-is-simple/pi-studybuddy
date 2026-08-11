# T-M4-016：S6 报告 Tab RPC 接线

**任务 ID**：T-M4-016  
**任务登记依据**：docs/04-任务清单-Todo-List.md T-M4-016；docs/09-使用者介面-UI-Design.md §4.9；docs/06-API契约-API-Contracts.md §3.8  
**提示词属性**：受控参考资产，不是 `.plan/`，不代表开工或 Git 收口授权。


## 调用方式

先把 `00-标准任务执行提示词.md` 与本文件一并提供给执行 Agent。本文件只提供当前任务的**范围和验收主题**；实际文件清单、实施序列、RED 测试与证据只能在获得开工授权后写入唯一 `.plan/`。

## 任务状态前提

本文件不改变任务状态。执行前必须重新核验 docs/04、`.plan/00-当前任务.md`、Git 工作区、`master` 与 `origin/master`；上一任务未完成时立即停止。


## 任务目标

在既有 S6 handler 上接通学生侧家长报告生成、冻结、查看、投递状态与报告目标管理 UI，同时坚持脱敏、规则优先和凭证隔离。

## 权威入口

- docs/04-任务清单-Todo-List.md T-M4-016；docs/09-使用者介面-UI-Design.md §4.9；docs/06-API契约-API-Contracts.md §3.8
- AGENTS.md §4.4、§5、§7、§8、§9、§10、§11
- docs/03-架构设计-Architecture-Design.md §6.7（AppShell 上下文与 Tab 数据生命周期）
- docs/07-工作流-Workflow.md 的对应业务路径、状态机与错误处理条款
- docs/08-测试验收-Test-Plan.md §5、§6、§7
- docs/09-使用者介面-UI-Design.md 的对应 Tab/UI 章节
- 紧邻前序任务的 `.plan/`、`.record/`、源代码与真实 Electron E2E

## 既有能力与允许接线范围

- `reports.generate/freeze/get/list`；
- `deliveries.deliver/retry/list`；
- `reportTargets.list/create/update/delete`；
- 复用 Settings 中 credential-vault 相关展示/错误边界，但不得泄露真实地址或密钥。

## 必须保持的约束

- 报告应以规则为先，AI 仅润色，AI 失败必须保留规则报告；
- freeze 使用既有快照和 `assertNoSensitiveLeak` 语义；
- 投递按 report_key + channel 去重、渠道失败隔离、最多 3 次重试，达到上限 retained_locally；
- 报告和家长界面不得显示资料原文、题干、答案、学生作答、错因、完整 UUID、真实渠道地址或密钥；
- 真实地址仅在 credential-vault，renderer 只展示安全标识/名称。

## RED 测试与验收主题

- 报告列表、生成、冻结、详情、投递状态、重试与错误态；
- 报告目标 CRUD 的参数、脱敏与归档只读；
- 无敏感内容/UUID/路径/栈泄漏；
- 渠道失败隔离和重复投递防线；
- semester/course 切换、卸载和 mutation 竞态；
- 真实 Electron E2E 需验证预置 fixture、脱敏 UI、冻结及投递状态链路，不连接真实渠道。

## 明确非目标与停止条件

- 不接入真实 SMTP、飞书或其他渠道；
- 不修改 credential-vault、投递重试后端语义、schema 或报告生成规则；
- 不把报告内容转存到测试外的数据根；
- 需要新增脱敏字段/API 时停止并请求裁决。

完成本地实施后，必须按 `00-标准任务执行提示词.md` 的受控收尾与标准验收报告执行；未经用户单独授权，不得提交、合并、推送或启动下一任务。
