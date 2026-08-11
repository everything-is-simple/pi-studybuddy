# T-M4-017：S7 采集 Tab RPC 接线

**任务 ID**：T-M4-017  
**任务登记依据**：docs/04-任务清单-Todo-List.md T-M4-017；docs/09-使用者介面-UI-Design.md §4.10；docs/06-API契约-API-Contracts.md §3.9  
**提示词属性**：受控参考资产，不是 `.plan/`，不代表开工或 Git 收口授权。


## 调用方式

先把 `00-标准任务执行提示词.md` 与本文件一并提供给执行 Agent。本文件只提供当前任务的**范围和验收主题**；实际文件清单、实施序列、RED 测试与证据只能在获得开工授权后写入唯一 `.plan/`。

## 任务状态前提

本文件不改变任务状态。执行前必须重新核验 docs/04、`.plan/00-当前任务.md`、Git 工作区、`master` 与 `origin/master`；上一任务未完成时立即停止。


## 任务目标

在既有 S7 handler 和受控文件能力之上，接通课堂音频转写、许可确认、可编辑转写文本与保存至资料库的 UI 路径。

## 权威入口

- docs/04-任务清单-Todo-List.md T-M4-017；docs/09-使用者介面-UI-Design.md §4.10；docs/06-API契约-API-Contracts.md §3.9
- AGENTS.md §4.4、§5、§7、§8、§9、§10、§11
- docs/03-架构设计-Architecture-Design.md §6.7（AppShell 上下文与 Tab 数据生命周期）
- docs/07-工作流-Workflow.md 的对应业务路径、状态机与错误处理条款
- docs/08-测试验收-Test-Plan.md §5、§6、§7
- docs/09-使用者介面-UI-Design.md 的对应 Tab/UI 章节
- 紧邻前序任务的 `.plan/`、`.record/`、源代码与真实 Electron E2E

## 既有能力与允许接线范围

- `classCapture.transcribe({ courseId, audioFile, permissionConfirmed })`；
- `classCapture.saveTranscription({ courseId, transcription, title })`；
- 复用 S2 的 capability/文件导入安全边界、课程上下文、归档只读、固定错误消息和真实 Electron fixture 模式。

## 必须保持的约束

- 未确认许可时必须禁用/阻止转写，host 侧仍须强制校验；
- 音频只允许受控 PCM WAV，文件头验证必须留在既有 host；
- renderer 不能把原始路径越权交给 host；
- 转写结果可编辑，保存后使用既有 S2 Material 语义；
- 不记录或展示路径、stdout/stderr、密钥、内部栈；原始音频/临时文件不得进入 Git 或真实业务根。

## RED 测试与验收主题

- 许可确认门控；
- 可用/无效音频的净化错误；
- 转写 loading、成功、取消/失败、可编辑文本和保存；
- course 切换、卸载、重复点击、归档写防线；
- 保存后资料刷新/正确提示；
- 真实 Electron E2E 使用受控 mock fixture，证明 main/preload/host/renderer 链路，不调用真实 whisper。

## 明确非目标与停止条件

- 不实现或修改 whisper.cpp；
- 不放宽 PCM WAV 验证、许可或 path guard；
- 不改变 S2 material/schema 语义；
- 需要真实音频、真实转写或新文件能力时停止并请求裁决。

完成本地实施后，必须按 `00-标准任务执行提示词.md` 的受控收尾与标准验收报告执行；未经用户单独授权，不得提交、合并、推送或启动下一任务。
