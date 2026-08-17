# T-M5-011 唯一执行计划：本机配置资产与设置能力控制台闭环

**任务 ID**：T-M5-011
**状态**：in_progress（阶段 1-5 实现、定向/完整自动化、专属 Electron E2E 与部分原生 UAT已完成；仍缺七类设置逐类纯 UI 保存→重启回读、双独立审查和用户明确收尾。）
**日期**：2026-08-17
**里程碑**：M5 用户可用性验收 + 一键交付
**优先级**：P0
**执行序**：49
**实施分支**：`agent/T-M5-011-local-config-settings-console`
**集成分支**：`master`
**运行根**：`H:\pi-studybuddy-tmp\runs\T-M5-011\`
**前置**：T-M5-010 done；T-M5-006 的运行资产与派生状态实现/验证完成，但独立审查和受控收尾未完成，当前 blocked 等待。
**权威依据**：用户本会话任务指令；AGENTS.md §2、§4.4-§4.5、§5、§7、§9、§11；01-TRD §5/§7；03-Architecture §2.3/§4.1/§4.5/§6.4-§6.5；06-API §2-§3.13-§3.16；08-Test §1、§6.6、§9；09-UI §9-§11；13-测试与运维 §2-§8。

## 1. 开工门禁与边界

| 项目 | 事实 | 结论 |
|---|---|---|
| 用户授权 | 用户明确指定执行 T-M5-011，并要求登记、建计划、切分支、先 RED | OK |
| 单一执行任务 | T-M5-006 尚未完成，但用户的当前指令覆盖原顺序；006 改为 blocked 等待审查/收尾。本计划为唯一 in_progress 计划 | OK |
| 分支与运行根 | 已切换 `agent/T-M5-011-local-config-settings-console`；所有运行证据写入 `H:\pi-studybuddy-tmp\runs\T-M5-011\` | OK |
| T-M5-006 边界 | 仅运行资源 manifest、受管 skills、派生能力状态、外部能力降级；不负责通用设置或配置生命周期 | 011 只消费其脱敏运行状态 |
| 数据隔离 | 不读取 `%LOCALAPPDATA%\PiStudyBuddy`、`~/.pi`、真实凭据或真实业务数据 | 强制 |
| 发布边界 | 不生成、读取、暂存、运行安装器；T-M5-007/008 不启动 | 强制 |
| Git | 用户未授权 commit/push/merge | 不执行 |

## 2. 数据与所有权裁决

| DATA-ID | 资产 / SoT | 介质与 owner | 持久化规则 |
|---|---|---|---|
| DATA-CFG-001 | 默认模型选择 | `<dataRoot>/config/models.json`，models 配置模块 | 版本化 JSON；不含 key/base URL/health |
| DATA-CFG-002 | 非敏感模型目录 | `<dataRoot>/config/pi-models.json`，model catalog | 版本化 JSON；仅别名、能力、非敏感目录 |
| DATA-CFG-003 | 通用学习偏好 | `<dataRoot>/config/settings.json`，settings 模块 | 版本化 JSON；包含 simple mode、TTS、学习偏好与非敏感本机选项 |
| DATA-CFG-004 | 凭证密文 | `<dataRoot>/config/credentials.json`，Electron main DPAPI vault | 只写 DPAPI 密文；renderer 永不读值；不纳入 JSON 配置迁移导出 |
| DATA-CFG-005 | 受管运行资源清单 | 安装资源 manifest，T-M5-006 owner | 只读随包资源；运行 health 每次派生，不写配置 |
| DATA-BIZ-* | 报告目标、投递、备份调度、学习事实 | `global.db` / semester SQLite | 继续由业务 schema 与备份规则负责 |

瞬时运行健康不属于配置 SoT。配置备份/恢复只覆盖可安全导出的非敏感 JSON；DPAPI 密文随数据根保留但不解密、不展示、不导出明文；卸载必须保留用户数据，除非用户明确选择删除。

## 3. 设计和契约前置

本任务会先依据盘点，更新 05-ERD、06-API、09-UI 与 traceability 的 `DATA-CFG-*`/`ACT-*`/`ERR-*`，再实现。若七类控制台需要新 RPC、DTO、错误码、stream 或 schema，先将修改及理由登记在设计文档，再写 RED。

七类设置页面：通用、模型、学习技能、运行能力、家长渠道、数据与备份、关于与更新。运行能力仅展示脱敏派生状态；凭据只显示已配置状态和受限 key 名，不回显值。

## 4. RED → GREEN 追踪矩阵

| 权威条款 | RED 测试 ID | 初始失败预期 | GREEN 最小实现 | 证据 |
|---|---|---|---|---|
| 13 §5/§8：DATA-CFG owner、原子写、迁移与恢复 | `T-M5-011-CFG-01` | 现有 JSON 无统一 schema/version/迁移 | shared config envelope、validator、temp+rename 原子写 | unit + isolated file inspection |
| 用户配置边界：缺失配置可恢复 | `T-M5-011-CFG-02` | 缺失文件仅靠隐式默认或不建目录 | 初始化默认值与明确 recoverable result | unit/integration |
| 用户配置边界：旧版本可迁移 | `T-M5-011-CFG-03` | 旧无 version 格式无迁移记录 | versioned migrator、保留兼容字段 | unit/integration |
| 用户配置边界：损坏配置不可静默丢失 | `T-M5-011-CFG-04` | JSON parse 失败无固定恢复 | 隔离损坏文件、重建默认、固定中文错误 | unit/integration |
| 13 §4：只读/写失败可恢复 | `T-M5-011-CFG-05` | 写入异常泄漏系统错误或部分写 | `CONFIG_WRITE_FAILED` 脱敏错误；原文件不变 | unit/integration 通过 |
| 03 §4.5：DPAPI 不可用 | `T-M5-011-CRED-01` | vault 不可用无一致 UI 恢复 | 固定凭据不可用语义；不返回 key/value/stack | unit/handler/renderer 通过 |
| 09 §10/§11：七类控制台与隐私 | `T-M5-011-UI-01` | 现有三类设置结构、不含全部区域 | seven-section navigation + safe display | renderer unit + dedicated Electron E2E 通过 |
| 08 §6.6：可见 UI 保存→重启回读 | `T-M5-011-E2E-01` | 现有 E2E 未覆盖七类/迁移/损坏恢复 | 真实 Electron 隔离根动作闭环 | 专属 Electron E2E通过；原生 UAT只完成通用与渠道闭环 |

RED 首次输出必须写入 `H:\pi-studybuddy-tmp\runs\T-M5-011\red\`，不得使用待测实现生成 golden，也不得读写生产根。

## 5. 实施步骤

1. 盘点当前 `settings.json`、`models.json`、`pi-models.json`、credential vault、数据根迁移、runtime capabilities、SettingsPage 与已有测试；记录兼容输入和现有 UI 动作。
2. 修订设计/追溯资产，定义统一 config envelope、每个资产的 version、字段验证、迁移序列、原子写、损坏隔离、备份/恢复/卸载行为以及固定错误语义。
3. 先添加失败单元与集成测试，覆盖创建、修改、重启回读、迁移、损坏、写失败和 DPAPI 不可用；保存 RED 结果。
4. 实现最小共享配置存储和 per-asset migration；保持 credentials 的 DPAPI 密文边界，绝不把凭据接入普通 JSON 序列化、日志或 renderer。
5. 扩展 typed contract/handlers 仅到七类控制台确实需要的最小表面；增加主进程/agent-host 错误净化，禁止路径、完整 UUID、栈、命令输出和密钥穿透。
6. 重组 SettingsPage 为七个实际可操作区，接入设置读取、保存、重启回读、运行状态只读展示、模型显式最小测试和渠道显式脱敏测试消息；不做每日测试、持久化 health 或自动 fallback。
7. 执行受影响 unit/integration、真实 Electron E2E、Node24 完整质量门（不得执行安装器路径）与原生真机 UAT。

## 6. 真机 UAT

- 使用真实 Electron、全新 `H:\pi-studybuddy-tmp\runs\T-M5-011\uat\` 数据根；不 seed、不通过 CDP/handler/RPC/数据库绕过界面。
- 已完成：首次启动纯 UI 创建学期/课程；SMTP 一次性输入保存到 DPAPI 后不回显；仅含安全别名的目标创建；关闭/重启后目标回读；通过 UI 显式发送受控固定测试消息并显示固定成功反馈；通用设置保存 `95`/`evening` 并在重启后回读。证据仅保留 `14-smtp-saved-redacted.png`、`21-general-saved.png`、`22-restart-settings-readback.png`、`27-vault-backed-test-message.png` 与 `evidence-summary.json`。
- 未完成：模型、学习技能、运行能力、数据与备份、关于与更新的逐类原生保存→关闭→重启→回读；配置损坏、迁移、写失败与 DPAPI 不可用的逐类可见恢复。因此 UAT 不可被标记为完整通过。
- 自动化专属 Electron E2E 已覆盖通用、学习技能与更新偏好保存→重启回读以及 DOM 脱敏；所有外部 AI/SMTP/飞书/OCR/WPS/whisper 均使用受控 mock。
- 每步保存脱敏 DOM、截图与 JSON；扫描完整 UUID、绝对路径、file URI、错误栈、密钥和模型请求正文。

## 7. 完成边界

完成本地实现不代表 task done。已完成 RED→GREEN、定向回归、Node24 `pnpm test`（142 files/1254 tests）、`type-check`、build、contract 132/132、安全 6/6、专属真实 Electron E2E和部分原生 UAT；`verify --stage=full --skip=e2e` 通过（8 执行/2 跳过，跳过集合包含明确排除的历史安装器验收）。此前一次跨任务 E2E 汇总曾失败于 T-M5-004 renderer fixture 与 T-M5-006 runtime settings；在用户明确授权复核后，当前 Node24 非安装器完整 Electron E2E 已重跑 `34 files/142 tests` 全绿，两个用例均通过，未发现需要修改的生产或测试代码。

收尾前仍必须补齐七类逐类原生 UAT和两名独立审查。完成后保持 `in_progress`，等待用户明确要求收尾；不得自动 commit、push、merge、启动 T-M5-007/008，或生成/读取/暂存安装器。
