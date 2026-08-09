# 任务计划：T-M4-023 独立交叉审查问题修订

**任务 ID**：T-M4-023
**计划文件**：`.plan/T-M4-023-cross-review-remediation.md`
**状态**：🔄 本地实施与验证完成；Git 收口待单独授权
**日期**：2026-08-09
**里程碑**：M4 业务接线 + 打包部署
**标题**：独立交叉审查问题修订（审查者 A：架构/契约；审查者 B：治理/任务）
**优先级**：P0
**工作目录**：`H:\pi-studybuddy`
**隔离分支**：`agent/T-M4-023-cross-review-remediation`

## 1. 任务裁决与权威依据

- 用户于 2026-08-09 明确要求完成本轮独立交叉审查发现的修订；不启动 T-M4-011~021。
- 依据 `AGENTS.md` §0、§4.4、§4.5、§5、§7、§8、§9、§11、§11.4；`docs/00-文档索引-Index.md`；`docs/04-任务清单-Todo-List.md`；以及 03-Arch / 05-ERD / 06-API / 08-Test / 09-UI。
- 本轮两名独立审查者已分别输出洞集，并由当前会话交叉核对代码、文档治理脚本与远端事实。

## 2. 基线与审查结论

- 基线提交：`6cd1e903ea8622f1afd5678264de29f01b66b62a`，工作区干净。
- P0：`agent.send` 的生产入口在 session/model 初始化失败或缺失时静默走 `runMockFixture`；loader 未从设置配置装配实际 model。
- P1：contract checker 无法解析 handler spread，缺失仅 warning，preload IPC 只匹配字面量 invoke；真实 Electron E2E 仅覆盖 `system.ping`。
- P1/P2：P0 批次 001~005 的个别实施计划/记录缺口、credential-vault 目录拓扑漂移、默认 Tab 文档冲突、索引/设计文档版本元数据漂移、T-M4-010 记录未写最终远端事实。

## 3. 交付目标

1. 生产 `agent.send` 仅允许真实 pi session/model；未配置或初始化失败返回固定 `MODEL_NOT_CONFIGURED`/脱敏错误，fixture 只能测试显式注入。
2. loader 支持从业务 `models.json` + DPAPI vault 显式装配 pi model runtime，测试可注入确定性模型/fixture，不连真实外部服务。
3. contract coverage 对 assembled handler registry 做阻塞校验，并覆盖常量 IPC channel；增加代表性真实 Electron RPC 与 agent.send 路由断言。
4. 统一默认对话 Tab、credential-vault 实际拓扑及设计文档元数据；补充 P0 历史审计恢复记录与 T-M4-010 最终 Git 事实。

## 4. 非目标

- 不启动 T-M4-011~021，不做其他业务 Tab RPC 接线。
- 不发起真实 LLM、SMTP、飞书、WPS COM、whisper.cpp 调用。
- 不改真实业务数据根，不提交真实密钥/学生资料。
- 不执行 Git commit、merge、push。

## 5. 标准化实施顺序

1. RED：新增生产 agent.send 无模型必须失败、显式 fixture 只在测试启用、模型配置解析、handler registry coverage、AppShell 默认入口、Electron 代表性 RPC 与审计/文档断言。
2. GREEN：最小实现 model runtime 装配、生产 fallback 移除、registry 导出与 checker 阻塞、E2E 扩展及文档修订。
3. REFACTOR：隔离初始化错误、收敛固定错误文案/类型、保持数据与秘密边界。
4. 验证：定向测试、type-check、build、contract/security/smoke、真实 Electron E2E、完整 `node scripts/verify.mjs --stage=full`、文档治理、`git diff --check`（已完成，证据见第 7 节）。
5. 受控收尾：已更新 Todo、当前计划、实施记录；停在 Git 前等待用户另行授权。

## 6. 验收标准

- 生产 host 不存在 fixture fallback；模型未配置/加载失败不会发射伪造 token/tool 事件。
- 配置 provider/model 与 vault key 的解析只读业务数据根，agentDir 与业务数据根物理隔离；测试路径不读 `~/.pi`。
- contract checker 对 API handler 缺失退出非 0，且能够解析 host assembled registry；IPC 常量通道覆盖通过。
- 真实 Electron E2E 至少覆盖 `semesters.list` 和 `agent.send` 的生产路由（未配置时固定错误），现有 E2E 继续通过。
- 默认入口代码、PRD/Workflow/UI/Index 一致为 `chat`/对话；credential-vault 文档与实现一致。
- P0 001~005 审计缺口以新增恢复记录明确记录，不篡改历史事实；T-M4-010 记录使用最终 `6cd1e903`/`origin/master` 事实。
- Node 24.14.0 下受影响测试、完整质量门、文档治理、安全不变量和 diff check 通过；本地验收完成，但 Git 收口仍待用户授权。

## 7. 最终验证证据

- `node scripts/verify.mjs --stage=full`：退出码 0；日志 `H:\pi-studybuddy-tmp\runs\T-M4-023\verify-full-node24.log`。
- unit/integration：104 files / 1028 tests；真实 Electron E2E：16 files / 118 tests。
- contract coverage：127/127 API handlers、35 registerTool tools、8 IPC channels。
- desktop security：6/6；smoke：6/6；UUID：7/7；文档治理：13 design docs + 2 Skills + 2 prompts；`git diff --check` 通过。
- Git 尚未执行 commit/merge/push；T-M4-023 保持 `in_progress`，不启动 T-M4-011~021。
