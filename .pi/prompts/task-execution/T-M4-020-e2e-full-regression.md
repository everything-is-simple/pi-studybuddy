# T-M4-020：E2E 全链回归

**任务 ID**：T-M4-020  
**任务登记依据**：docs/04-任务清单-Todo-List.md T-M4-020；docs/08-测试验收-Test-Plan.md §5、§6、§7；docs/09-使用者介面-UI-Design.md §11  
**提示词属性**：受控参考资产，不是 `.plan/`，不代表开工或 Git 收口授权。


## 调用方式

先把 `00-标准任务执行提示词.md` 与本文件一并提供给执行 Agent。本文件只提供当前任务的**范围和验收主题**；实际文件清单、实施序列、RED 测试与证据只能在获得开工授权后写入唯一 `.plan/`。

## 任务状态前提

本文件不改变任务状态。执行前必须重新核验 docs/04、`.plan/00-当前任务.md`、Git 工作区、`master` 与 `origin/master`；上一任务未完成时立即停止。


## 任务目标

建立并执行 M4 真实 Electron 全链回归，覆盖后端断裂修复、设置页、学期课程切换和 S1-S7 已接线主路径；以缺陷修复和回归证明为目的，不扩大产品功能。

## 权威入口

- docs/04-任务清单-Todo-List.md T-M4-020；docs/08-测试验收-Test-Plan.md §5、§6、§7；docs/09-使用者介面-UI-Design.md §11
- AGENTS.md §4.4、§5、§7、§8、§9、§10、§11
- docs/03-架构设计-Architecture-Design.md §6.7（AppShell 上下文与 Tab 数据生命周期）
- docs/07-工作流-Workflow.md 的对应业务路径、状态机与错误处理条款
- docs/08-测试验收-Test-Plan.md §5、§6、§7
- docs/09-使用者介面-UI-Design.md 的对应 Tab/UI 章节
- 紧邻前序任务的 `.plan/`、`.record/`、源代码与真实 Electron E2E

## 既有能力与允许接线范围

- 真实 Electron main/preload/renderer/agent-host/handler 路由；
- 已完成的 S1-S7、Settings、TTS/Backup 已有能力；
- 隔离 fixture、测试运行根、contract/security/UUID/docs 治理检查。

## 必须保持的约束

- E2E 不能只 mock renderer；应在启动前预置隔离数据并验证实际 piBridge/TCP/RPC 往返；
- 覆盖安全不变量、数据根隔离、错误净化、归档只读、UUID 泄漏与关键状态机；
- 测试可以修复 fixture、测试 adapter 和确定性等待，但不得借回归名义重构或新增业务能力；
- 任何生产缺陷修复必须最小化、先 RED、保留影响证据。

## RED 测试与验收主题

- S1 首页、S2 资料/笔记、S3 练习、S4 错题、S5 冲刺、S6 报告、S7 采集的代表性主路径；
- Settings、学期/课程切换、归档只读、错误净化、敏感信息/UUID；
- TTS 与备份恢复的系统 E2E；
- 失败路径、竞态和真实安装/源码运行链路（按现有测试计划）；
- 全量 verify --stage=full、docs governance、diff-check 和审查证据。

## 明确非目标与停止条件

- 不在本任务引入未完成 Tab 的新功能；
- 不将 E2E 假阳性通过当作验收；
- 不以提高覆盖率为唯一目标；
- 发现需要新增产品/API/schema 时停止并按缺陷单独裁决。

完成本地实施后，必须按 `00-标准任务执行提示词.md` 的受控收尾与标准验收报告执行；未经用户单独授权，不得提交、合并、推送或启动下一任务。
