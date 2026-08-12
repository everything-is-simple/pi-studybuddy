# T-M5-003：对话/会话/模型/文件引用真实用户闭环修订

**任务 ID**：T-M5-003
**任务登记依据**：docs/04-任务清单-Todo-List.md T-M5-003；docs/07-工作流-Workflow.md §2.8；docs/09-使用者介面-UI-Design.md §3.3/§4.2/§7-§9；docs/03-架构设计-Architecture-Design.md §6.7
**提示词属性**：受控参考资产，不是 `.plan/`，不代表开工或 Git 收口授权。

## 调用方式

先把 `00-标准任务执行提示词.md` 与本文件一并提供给执行 Agent。本文件只提供当前任务的**范围和验收主题**；实际文件清单、实施序列、RED 测试与证据只能在获得开工授权后写入唯一 `.plan/`。

## 任务状态前提

本文件不改变任务状态。执行前必须重新核验 docs/04、`.plan/00-当前任务.md`、Git 工作区、`master` 与 `origin/master`；上一任务未完成时立即停止。

## 任务目标

移除对话主入口的 fixture 语义与占位/静默失败，打通真实用户闭环：真实会话（新建/切换/重命名/导出/删除 + 重启持久化）、真实模型状态（失败可见可重试）、真实错题/文件选择。真机 UAT 已确认的 P0：空数据首屏显示 `defaultSessionFixture()` 假会话、ChatTab 硬编码 `sess-001`/`mist-001`、模型下拉列出 7 provider 但底部恒"未配置"。

## 权威入口

- docs/04-任务清单-Todo-List.md T-M5-003；docs/07-工作流-Workflow.md §2.8；docs/09-使用者介面-UI-Design.md §3.3/§4.2/§7-§9；docs/03-架构设计-Architecture-Design.md §6.7
- AGENTS.md §4.4、§5、§7、§8、§9、§10、§11
- docs/08-测试验收-Test-Plan.md §5、§6、§7（含每任务用户端到端测试铁律）
- 前序 T-M5-001/T-M5-002 的 `.plan/`、`.record/`、源代码与真实 Electron E2E

## 既有能力与允许接线范围

- 既有 `sessions.*`（list/search/get/rename/delete/export/context）、`agent.send`、`modelsConfig.get/set`、`mistakes.list`、`files.read` 契约；
- 既有 session-store（`defaultSessionFixture` 仅允许测试注入，生产必须空初始化）；
- 既有 AppShell 唯一学期/课程上下文与 SessionSidebar。

## 必须保持的约束

- **不新增 API/schema**（contract 保持 127/127）；若 RED 证明既有契约无法表达条款，先请求用户裁决；
- 生产路径移除 `sess-001`/`mist-001`/`sess-new` 字面量；fixture 仅留测试注入 seam；
- 失败路径必须固定中文错误 + 可重试，不静默 catch；
- 不连真实外部 AI 服务；测试用受控 mock；
- **每任务必须执行用户端到端测试（真机 UAT）**：真实 Electron + 空数据根 + 纯 UI 操作，验证会话创建→发送→重启持久化，DOM 无 fixture 内容与敏感信息；
- 运行数据隔离，无密钥/路径/UUID 泄漏。

## RED 测试与验收主题

- 空数据根 `sessions.list` 返回空（生产不注入 fixture），真实 Electron 首屏无"导数练习/极限学习"；
- ChatTab 发送携带当前 `activeSessionId`（新建会话后首条消息归属新会话）；两次会话各自历史/标题正确；
- 关联错题从真实列表选择，`agent.send` sessionMeta.mistakeIds 仅含选中项；无选中时不写入；
- 模型配置失败显示固定错误且可重试；成功保存后底部状态栏显示所选模型；
- 会话/模型/文件引用失败均固定中文错误，无静默 catch；
- 完整质量门 + 真机 UAT 两阶段（首次+重启持久化）+ 两名独立审查。

## 明确非目标与停止条件

- 不修改 S1-S7/TTS/备份/设置页面控件（T-M5-004/005）；不处理 OCR/WPS/whisper 随包（T-M5-006）；
- 不新增 API/schema；不自动 commit/merge/push，所有 Git 动作仍需用户单独授权；
- 完成本地实施后，必须按 `00-标准任务执行提示词.md` 的受控收尾与标准验收报告执行。
