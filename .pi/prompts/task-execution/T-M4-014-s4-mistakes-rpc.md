# T-M4-014：S4 错题 Tab RPC 接线

**任务 ID**：T-M4-014  
**任务登记依据**：docs/04-任务清单-Todo-List.md T-M4-014；docs/09-使用者介面-UI-Design.md §4.7；docs/06-API契约-API-Contracts.md §3.6  
**提示词属性**：受控参考资产，不是 `.plan/`，不代表开工或 Git 收口授权。


## 调用方式

先把 `00-标准任务执行提示词.md` 与本文件一并提供给执行 Agent。本文件只提供当前任务的**范围和验收主题**；实际文件清单、实施序列、RED 测试与证据只能在获得开工授权后写入唯一 `.plan/`。

## 任务状态前提

本文件不改变任务状态。执行前必须重新核验 docs/04、`.plan/00-当前任务.md`、Git 工作区、`master` 与 `origin/master`；上一任务未完成时立即停止。


## 任务目标

在现有 AppShell 的 semesterId/courseId 上下文和既有 S4 handler 之上，接通 MistakesTab 的错题列表、筛选、详情、学生确认错因、原题重做和薄弱点展示/既有状态操作。

## 权威入口

- docs/04-任务清单-Todo-List.md T-M4-014；docs/09-使用者介面-UI-Design.md §4.7；docs/06-API契约-API-Contracts.md §3.6
- AGENTS.md §4.4、§5、§7、§8、§9、§10、§11
- docs/03-架构设计-Architecture-Design.md §6.7（AppShell 上下文与 Tab 数据生命周期）
- docs/07-工作流-Workflow.md 的对应业务路径、状态机与错误处理条款
- docs/08-测试验收-Test-Plan.md §5、§6、§7
- docs/09-使用者介面-UI-Design.md 的对应 Tab/UI 章节
- 紧邻前序任务的 `.plan/`、`.record/`、源代码与真实 Electron E2E

## 既有能力与允许接线范围

- `mistakes.list({ courseId?, status? })`、`mistakes.get({ id })`；
- `mistakes.suggestErrorCause({ id })` 仅作为“建议且不确定”的展示；
- `mistakes.confirmErrorCause({ id, category, causeNote? })`；
- `mistakes.redo({ id })`；
- `weakPoints.list/get/resolve/regress`，仅按现有 UI 与 contract 接线；
- 复用 T-M4-008~013 的 useTabData、typed RPC、竞态/卸载、错误净化、归档只读与真实 Electron fixture 模式。

## 必须保持的约束

- 错因必须为六分类：概念不清、看错题、公式错误、步骤遗漏、时间压力、其他；学生必须确认，AI 不能替学生确认；
- AI 建议必须含“不确定”或等价标识；
- `needs_review → mastered` 与 `mastered → needs_review` 均以既有后端结果为准，“已掌握”不是终态；
- `evidence_count >= 2` 才形成薄弱点，renderer 不得自行推导或伪造；
- archived 学期只读，confirm/redo/weakPoint 写操作须有 renderer 与 host 双层防线；
- 不显示 UUID、路径、栈、SQL、密钥或敏感日志。

## RED 测试与验收主题

- 无课程时不发越权 RPC；课程切换、筛选切换、错题详情切换和卸载时旧响应不污染 UI；
- 列表、筛选、详情、空态、错误态、加载态；
- AI 建议标识、六分类确认、可选 causeNote、确认后刷新；
- redo 正确/错误的状态展示与重复 mutation 防线；
- weakPoints 列表/evidence_count/状态操作（如 UI 范围要求）；
- archived 只读与错误净化；
- 真实 Electron：main → preload → RPC → agent-host → S4 handler → renderer，全链 fixture 隔离。

## 明确非目标与停止条件

- 不新增 API、handler、schema、AppShell 全局状态；
- 不实现 `mistakes.archive` 或重做 S3 `[加入错题]` 业务；
- 不提前接 TTS、S5~S7、备份恢复或 M4 全链回归；
- 发现既有 S4 API/handler 无法支撑 UI 时停止并请求单独裁决。

完成本地实施后，必须按 `00-标准任务执行提示词.md` 的受控收尾与标准验收报告执行；未经用户单独授权，不得提交、合并、推送或启动下一任务。
