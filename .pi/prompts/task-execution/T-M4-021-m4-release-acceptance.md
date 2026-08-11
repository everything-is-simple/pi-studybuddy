# T-M4-021：M4 收官验收 + 打包冒烟

**任务 ID**：T-M4-021  
**任务登记依据**：docs/04-任务清单-Todo-List.md T-M4-021；docs/08-测试验收-Test-Plan.md §5、§5.7、§6；docs/01-TRD-技术需求-Technical-Requirements.md §7 决策6  
**提示词属性**：受控参考资产，不是 `.plan/`，不代表开工或 Git 收口授权。


## 调用方式

先把 `00-标准任务执行提示词.md` 与本文件一并提供给执行 Agent。本文件只提供当前任务的**范围和验收主题**；实际文件清单、实施序列、RED 测试与证据只能在获得开工授权后写入唯一 `.plan/`。

## 任务状态前提

本文件不改变任务状态。执行前必须重新核验 docs/04、`.plan/00-当前任务.md`、Git 工作区、`master` 与 `origin/master`；上一任务未完成时立即停止。


## 任务目标

完成 M4 最终发布验收：在干净 master 上验证 x64 安装包构建、隔离安装、首次启动、renderer/preload/RPC 往返和安全不变量，并汇总 M4 退出证据。

## 权威入口

- docs/04-任务清单-Todo-List.md T-M4-021；docs/08-测试验收-Test-Plan.md §5、§5.7、§6；docs/01-TRD-技术需求-Technical-Requirements.md §7 决策6
- AGENTS.md §4.4、§5、§7、§8、§9、§10、§11
- docs/03-架构设计-Architecture-Design.md §6.7（AppShell 上下文与 Tab 数据生命周期）
- docs/07-工作流-Workflow.md 的对应业务路径、状态机与错误处理条款
- docs/08-测试验收-Test-Plan.md §5、§6、§7
- docs/09-使用者介面-UI-Design.md 的对应 Tab/UI 章节
- 紧邻前序任务的 `.plan/`、`.record/`、源代码与真实 Electron E2E

## 既有能力与允许接线范围

- 既有 electron-builder/NSIS 配置；
- 既有真实 Electron 启动、global.db、system.ping、preload piBridge、RPC 与安全检查能力；
- M4 全链 E2E 与所有前序任务实施记录。

## 必须保持的约束

- 必须在干净 master、明确 Node24/pnpm 基线下执行；
- 安装/启动验证必须使用隔离目录与数据根，不能破坏日常环境；
- 必须验证安装后应用的真实 main/preload/renderer/RPC 链路，而非仅构建产物存在；
- 质量门、安全不变量、UUID、文档治理、diff-check 均为收官必要条件；
- M4 任何未完成任务、未解决 P0/P1 或前序证据缺失时不得宣告收官。

## RED 测试与验收主题

- x64 setup 构建、哈希、静默/隔离安装和至少两次启动；
- installed app 的 renderer、piBridge、system.ping、global.db 与代表性 RPC 往返；
- M4 全链 E2E、contract 覆盖、安全 6/6、smoke、UUID、docs governance；
- 运行数据隔离、无密钥/路径/UUID 泄漏；
- M4 退出门槛逐条对照、两名独立审查和最终发布证据矩阵。

## 明确非目标与停止条件

- 不在收官阶段顺手实现新功能；
- 不绕过签名/安装/安全失败；
- 不因打包成功而忽略实际启动或 RPC 失败；
- 不自动 commit/merge/push/发布，所有 Git 与发布动作仍需用户单独授权。

完成本地实施后，必须按 `00-标准任务执行提示词.md` 的受控收尾与标准验收报告执行；未经用户单独授权，不得提交、合并、推送或启动下一任务。
