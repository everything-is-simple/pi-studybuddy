# T-M4-018：TTS 控制条 RPC 接线

**任务 ID**：T-M4-018  
**任务登记依据**：docs/04-任务清单-Todo-List.md T-M4-018；docs/09-使用者介面-UI-Design.md §5；docs/06-API契约-API-Contracts.md §3.10  
**提示词属性**：受控参考资产，不是 `.plan/`，不代表开工或 Git 收口授权。


## 调用方式

先把 `00-标准任务执行提示词.md` 与本文件一并提供给执行 Agent。本文件只提供当前任务的**范围和验收主题**；实际文件清单、实施序列、RED 测试与证据只能在获得开工授权后写入唯一 `.plan/`。

## 任务状态前提

本文件不改变任务状态。执行前必须重新核验 docs/04、`.plan/00-当前任务.md`、Git 工作区、`master` 与 `origin/master`；上一任务未完成时立即停止。


## 任务目标

接通全局朗读控制条与既有内嵌朗读入口，使用现有 TTS RPC 和状态流展示播放、暂停、停止、进度、语速与引擎降级。

## 权威入口

- docs/04-任务清单-Todo-List.md T-M4-018；docs/09-使用者介面-UI-Design.md §5；docs/06-API契约-API-Contracts.md §3.10
- AGENTS.md §4.4、§5、§7、§8、§9、§10、§11
- docs/03-架构设计-Architecture-Design.md §6.7（AppShell 上下文与 Tab 数据生命周期）
- docs/07-工作流-Workflow.md 的对应业务路径、状态机与错误处理条款
- docs/08-测试验收-Test-Plan.md §5、§6、§7
- docs/09-使用者介面-UI-Design.md 的对应 Tab/UI 章节
- 紧邻前序任务的 `.plan/`、`.record/`、源代码与真实 Electron E2E

## 既有能力与允许接线范围

- `tts.speak({ text, engine? })`；
- `tts.control({ playbackId, action, rate? })`；
- `tts.switchEngine({ engine })`；
- `tts.getStatus({ playbackId })`；
- 既有 `tts.state` stream、全局控制条和内嵌朗读按钮。

## 必须保持的约束

- SAPI 默认且离线；edge-tts 仅为既有可选引擎/降级语义；
- 状态机为 idle → playing → paused → stopped；
- renderer 不能泄露 playbackId 完整 UUID、错误栈、路径、语音引擎内部日志；
- 不朗读/记录敏感密钥或被设计文档标记为不可展示的数据；
- 多 Tab 生命周期、停止旧播放和重复控制必须稳定。

## RED 测试与验收主题

- speak/control/switchEngine/getStatus 参数与 UI 状态；
- tts.state stream 的进度、暂停、停止与播放完成；
- 多入口复用一个控制条，不产生重复播放；
- 引擎降级、固定错误文本、卸载与 Tab 切换；
- 真实 Electron E2E 使用 mock/fake adapter，不调用真实 SAPI/edge-tts。

## 明确非目标与停止条件

- 不重写 TTS handler、引擎 adapter、状态机或 stream contract；
- 不将朗读持久化为学习事实或 StudyEvent；
- 不把所有 S1-S7 文本入口一并重构；
- 需要改变播放契约/API 时停止并请求裁决。

完成本地实施后，必须按 `00-标准任务执行提示词.md` 的受控收尾与标准验收报告执行；未经用户单独授权，不得提交、合并、推送或启动下一任务。
