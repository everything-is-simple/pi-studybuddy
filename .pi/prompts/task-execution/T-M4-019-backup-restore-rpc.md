# T-M4-019：备份恢复面板 RPC 接线 + TabBar 入口

**任务 ID**：T-M4-019  
**任务登记依据**：docs/04-任务清单-Todo-List.md T-M4-019；docs/09-使用者介面-UI-Design.md §6；docs/06-API契约-API-Contracts.md §3.11  
**提示词属性**：受控参考资产，不是 `.plan/`，不代表开工或 Git 收口授权。


## 调用方式

先把 `00-标准任务执行提示词.md` 与本文件一并提供给执行 Agent。本文件只提供当前任务的**范围和验收主题**；实际文件清单、实施序列、RED 测试与证据只能在获得开工授权后写入唯一 `.plan/`。

## 任务状态前提

本文件不改变任务状态。执行前必须重新核验 docs/04、`.plan/00-当前任务.md`、Git 工作区、`master` 与 `origin/master`；上一任务未完成时立即停止。


## 任务目标

接通备份恢复面板、TabBar/设置入口、备份历史、恢复冲突确认和定期备份设置；完全复用既有备份安全、路径守卫和进度流。

## 权威入口

- docs/04-任务清单-Todo-List.md T-M4-019；docs/09-使用者介面-UI-Design.md §6；docs/06-API契约-API-Contracts.md §3.11
- AGENTS.md §4.4、§5、§7、§8、§9、§10、§11
- docs/03-架构设计-Architecture-Design.md §6.7（AppShell 上下文与 Tab 数据生命周期）
- docs/07-工作流-Workflow.md 的对应业务路径、状态机与错误处理条款
- docs/08-测试验收-Test-Plan.md §5、§6、§7
- docs/09-使用者介面-UI-Design.md 的对应 Tab/UI 章节
- 紧邻前序任务的 `.plan/`、`.record/`、源代码与真实 Electron E2E

## 既有能力与允许接线范围

- `backup.course/allCourses/restore/list`；
- `backup.configureSchedule/listSchedules/toggleSchedule`；
- 既有 backup.progress stream、受控文件/目录选择 capability 和 AppShell 入口。

## 必须保持的约束

- 备份 zip 的完整性、content_hash、schema_version、zip 炸弹和符号链接防护均由现有 host 保证，renderer 不得绕过；
- 恢复同名冲突必须由学生确认 overwrite/create_new；
- 展示 integrity_check 结果和恢复摘要，但不得显示真实路径、完整 UUID、原始资料或内部异常；
- backup_records 状态机与 schedule 语义只复用，不改写；
- 恢复/备份不得污染真实数据根，E2E 使用隔离目录。

## RED 测试与验收主题

- 单课程/全课程备份入口、进度、完成/失败与历史列表；
- 恢复文件选择 capability、冲突选择、RestoreResult 摘要与 integrity 状态；
- schedule 创建、列表、启停及参数校验；
- 归档触发备份提示、取消/错误、重复操作、竞态与错误净化；
- 真实 Electron E2E 需覆盖受控 zip fixture、restore 冲突及 schedule UI。

## 明确非目标与停止条件

- 不重写 zip 格式、恢复算法、路径守卫、数据库导入或调度器；
- 不执行真实用户资料备份/恢复；
- 不把 file path 直接暴露给 renderer/handler；
- 需要修改安全边界、schema 或新系统入口时停止并请求裁决。

完成本地实施后，必须按 `00-标准任务执行提示词.md` 的受控收尾与标准验收报告执行；未经用户单独授权，不得提交、合并、推送或启动下一任务。
