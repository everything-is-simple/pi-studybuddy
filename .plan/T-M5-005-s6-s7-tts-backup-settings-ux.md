# T-M5-005 唯一执行计划：S6/S7/TTS/备份/设置与整体 UX 修订

**任务 ID**：T-M5-005
**状态**：📝 in_progress
**日期**：2026-08-14
**里程碑**：M5 用户可用性验收 + UI 修订 + 一键交付
**优先级**：P0
**执行序**：46
**实施分支**：`agent/T-M5-005-s6-s7-tts-backup-settings-ux`
**集成分支**：`master`
**运行根**：`H:\pi-studybuddy-tmp\runs\T-M5-005\`
**前置**：T-M5-001、T-M5-009 均已 done；用户于 2026-08-14 明确批准开工。
**权威依据**：AGENTS.md §4.4/§4.5/§5/§7/§8/§9/§11；docs/07 §2.7/§3-§5；docs/08 §1/§5-§7；docs/09 §4.9-§13；docs/13 §2-§9；docs/traceability/*；docs/04 §7.5 执行序 46。

## 1. 开工门禁

| 项目 | 当前事实 | 结论 |
|---|---|---|
| 上一任务 | T-M5-009 完成 Git 收口；`docs/traceability/` 六项资产已 done | ✅ |
| 用户授权 | 用户明确批准先同步 T-M5-009 滞后状态、完成后开工 T-M5-005 | ✅ |
| 单一计划 | 本文件是唯一 in_progress 详细计划 | ✅ |
| 任务登记 | `docs/04` 将 T-M5-005 pending→in_progress | ✅ |
| 数据边界 | 只用 `H:\pi-studybuddy-tmp\runs\T-M5-005\`；不读写生产根 | ✅ |
| Git | 开工时未获 commit/merge/push 授权；用户现已授权本轮显式任务文件提交、推送和 ff-only 合并，安装器保持未暂存 | ✅ |

## 2. 目标

将已有 S6、S7、TTS、备份恢复、设置和壳层 UI 接线从“已有局部路径/自动化”收敛为可追溯的真实桌面用户闭环：成功、失败、恢复、持久化、重启回读、敏感信息边界和真机 UAT 均有对应证据。

本任务消费而不替代 T-M5-009 的 `CTRL → ACT → ERR → DATA → TEST/E2E/UAT → OPS` 基线。不得以既有 renderer 自动化或历史 E2E 充当本任务原生真机 UAT。

## 3. 已核验实现输入

| 领域 | 当前实现/证据 | 本任务必须补足的判断 |
|---|---|---|
| S6 | `ReportTab.tsx` 已接线 reports/deliveries；T-M4-016 的 integration 与 Electron renderer E2E 存在 | 动作拆分、脱敏、生成→冻结→投递/失败恢复→重启回读的真机 UAT；补齐缺失 UI/错误行为 |
| S7 | `CaptureTab.tsx` 已接线许可→选择 rawPath→转写→编辑→保存；T-M4-017 E2E 存在 | 真机 UI 闭环及转写依赖不可用中文恢复；whisper 自包含不进入本任务，转交 T-M5-006 |
| TTS | `TtsControlBar.tsx`、`tts-playback.ts`、Notes/Mistakes 局部入口已接线 | 按设计核实所有文字区入口、播放/暂停/停止/失败/已复习持久化与真机 UAT |
| 备份 | `BackupPanel.tsx` 与 backup.* RPC、进度 stream 已接线；T-M4-019 有 zip/integrity_check E2E | 用户路径、调度、危险恢复确认、真实恢复/重启回读、文件—数据库补偿/孤儿处理边界 |
| 设置 | `SettingsPage.tsx`、settings/credentials/models/toolchains RPC 已接线；已有脱敏 helper | 非开发者可理解性、可恢复失败、敏感显示边界、设置持久化与重启回读；不把开发环境安装步骤暴露给用户 |
| 壳层 UX | `AppShell.tsx` 已有 Tab、设置入口、TTS 控制条和占位右栏/状态栏 | 真实状态栏/上下文栏、消息/stream 可见反馈、空/加载/失败/重试、响应式与键盘可达性 |

## 4. 纳入范围

1. **S6 报告与投递**：生成、历史、详情、冻结、脱敏投递、失败隔离、重试、归档只读和重启回读。
2. **S7 课堂采集**：许可确认、PCM WAV 选择、转写、可编辑文本、S2 handoff、失败可恢复和重启后读取。
3. **TTS**：可用文本区的朗读入口、常驻控制条、引擎/速率/播放状态、失败降级、显式“标记已复习”的持久化。
4. **备份恢复**：手动备份、调度管理、历史、进度、恢复前验证、冲突确认、恢复后完整性/重启回读及危险动作确认。
5. **设置与壳层 UX**：非开发者设置、模型/凭证安全状态、依赖健康、状态栏/上下文栏/消息反馈、加载/空/失败/重试、响应式与键盘可访问性。
6. **追溯资产**：补齐 T-M5-005 影响的 `ACT-S6-*`、`ACT-S7-*`、`ACT-TTS-*`、`ACT-BACKUP-*`、`ACT-SETTINGS-*`、相应 `ERR-*`、`DATA-*`、`TRACE-*`、OPS/发布证据。

## 5. 明确不纳入

- 不做 T-M5-006：OCR/Python/whisper 等依赖随包、离线装配、许可证/体积/更新清单；本任务只能如实显示可用或不可用但可恢复状态。
- 不做 T-M5-007：干净 Windows 已安装应用全功能签收；本任务只为其提供所涉功能的合规 UAT 证据。
- 不做 T-M5-008：最终 setup/portable zip 发行、升级/卸载发行验收。
- 不连接真实 AI、SMTP、飞书、WPS、OCR 或 whisper 服务；外部依赖按受控 mock 或明确不可用边界处理。
- 不读写 `%LOCALAPPDATA%\PiStudyBuddy`，不引入 runtime `test.*` RPC 或运行中 seed。
- 不执行 commit、merge、push；不删除/暂存其他工作者已有文件。

## 6. 追溯与验收设计

### 6.1 首先更新的基线

- `interaction-catalog.md`：拆分 CTRL-REPORT/CAPTURE/TTS/BACKUP/SETTINGS 和 CTRL-SHELL-04..06 为事实可证实的 ACT；未证实项保留 `部分证据/未覆盖/阻塞`。
- `error-catalog.md`：S6 隐私/投递、S7 许可/格式/转写、TTS 引擎、备份恢复、设置/工具链错误和用户恢复路径。
- `data-asset-catalog.md`：S6 报告/投递、S7 S2 handoff、TTS review event、备份包/调度/恢复、用户设置的 owner、持久化、恢复和敏感性。
- `system-traceability.md`：更新 TRACE-S6-001、TRACE-S7-001、TRACE-BACKUP-001、TRACE-SETTINGS-001，并新增 TTS/壳层行（仅在实际证据成立时）。
- `operations-runbook.md` 与 `release-evidence.md`：填入本任务的依赖健康、备份/恢复、数据根、UAT 和未覆盖边界。

### 6.2 RED → GREEN

每个可见闭环按以下顺序推进，RED 输出写入运行根：

1. 读取现有对应测试、contract、handler、renderer 和数据资产，建立动作/错误/数据行；先写因缺口失败的测试。
2. 只写使该测试通过的最小生产实现；禁止把前端禁用作为 handler 防线的替代。
3. 定向单元/集成测试必须涵盖成功、前置失败、重复/重试、归档只读、敏感显示及重启回读（适用时）。
4. 为真正改变的桌面路径补真实 Electron E2E；外部能力受控 mock 不得伪造业务 SQLite 事实。
5. 真机 UAT 在全新隔离根完成，逐动作保存脱敏 DOM/截图/JSON，不得使用 renderer 注入、CDP、webContents.executeJavaScript、RPC/handler 直调或数据库预置。

### 6.3 真机 UAT 最低闭环

| UAT 领域 | 可见路径 | 必须回读 |
|---|---|---|
| S6 | 生成→冻结→本地安全投递或投递失败重试 | 重启后报告冻结/投递状态仍一致，无敏感正文 |
| S7 | 许可→选择受控 WAV→转写→编辑→保存为 S2 输入 | 重启后 S2 可读取 handoff；暂存音频不作为业务事实 |
| TTS | 从真实文本入口开始→播放/暂停/停止或完成→显式标记已复习 | 重启后仅 review event 存在；播放本身不持久化 |
| 备份 | 创建→验证 manifest/hash→恢复冲突确认→integrity_check | 新隔离根重启后恢复事实可见；不覆盖原始根 |
| 设置/壳层 | 修改安全设置/模型状态/依赖健康→可见反馈与失败恢复 | 重启后设置持久化，UI 不泄漏路径、UUID、key、栈或渠道地址 |

## 7. 初始源码与测试盘点目标

先精读并以当前内容为准：

- `src/renderer/components/tabs/ReportTab.tsx`
- `src/renderer/components/tabs/CaptureTab.tsx`
- `src/renderer/components/TtsControlBar.tsx`
- `src/renderer/tts-playback.ts`
- `src/renderer/components/BackupPanel.tsx`
- `src/renderer/components/SettingsPage.tsx`
- `src/renderer/components/AppShell.tsx`
- 对应 contract、agent-host handlers、backup/S6/S7/TTS 服务与 schema
- `tests/integration/t-m4-016-report-rpc.test.ts`
- `tests/integration/t-m4-017-capture-rpc.test.ts`
- `tests/integration/t-m4-018-tts-rpc.test.ts`
- `tests/integration/t-m4-019-backup-rpc.test.ts`
- 对应 Electron E2E 及现有 Settings/AppShell 测试

在修改任何导出符号前，先使用 LSP references 枚举调用方；跨文件重命名使用 LSP rename。

## 8. 验收门槛

- [ ] 所涉 CTRL 均拆为事实可证实 ACT，且 ACT→ERR→DATA→TEST/E2E/UAT→OPS 可追溯。
- [ ] S6/S7/TTS/备份/设置/壳层 UX 的每个实际变更同时具备成功、失败、恢复、持久化和重启语义。
- [ ] 不泄漏 UUID、绝对路径、密钥、base URL、错误栈、学生资料原文或真实渠道地址。
- [ ] 外部依赖不可用时显示中文可恢复边界，不静默回退 fixture，也不把 T-M5-006 依赖装配问题伪装为已解决。
- [ ] 定向测试、受影响 Electron E2E、Node24 `pnpm verify --stage=full`、文档治理和 `git diff --check` 通过。
- [ ] 每个用户可见闭环都完成真实 Electron、全新隔离根、纯 UI 的创建/使用/重启 UAT；截图/DOM/JSON 进入运行根而非 Git。
- [ ] `.record/T-M5-005-实施记录.md` 完整八章节；两位独立审查者 P0/P1 为零。

## 9. 停止条件

立即停止受影响施工并请求裁决，如果：

- 需要新增 API/schema/handler/stream、跨 Tab 全局状态或未知数据资产；
- 需用生产根、真实外部服务、runtime seed 或 UI 绕过证明结果；
 - T-M5-006 的依赖自包含问题成为本任务 S7/TTS 等路径的唯一解；本任务可记录合规确认、原生 WAV 选择和依赖不可用恢复边界，但成功 whisper 转写、结果保存为 S2 输入及结果重启回读属于 T-M5-006 自包含依赖范围，不得在本任务中伪造完成。
- 文件—数据库补偿、备份恢复覆盖或 DPAPI 卸载/升级语义不明确；
- 文档、代码、contract、测试或真实 UAT 证据范围互相冲突；
- 用户已有未跟踪文件的归属或处理方式不明确。

## 10. 当前进度日志

- 2026-08-14：用户授权先同步 T-M5-009 滞后治理状态；AGENTS、00 索引、13 测试与运维已修正到 T-M5-009 done，文档治理和 diff-check 通过。
- 2026-08-14：用户明确批准 T-M5-005 开工；本计划、任务登记和实施分支已建立。后续先完成源码/测试事实盘点，再写 RED；不执行 Git 收口。
- 2026-08-14：完成 S6/S7/TTS/备份/设置/AppShell 事实盘点和 renderer RED→GREEN。新增速背卡、转写结果、报告朗读入口，复用 AppShell `useTtsPlayback`；`overwrite` 恢复先确认后调用。定向 renderer 合同 4/4、相关 RPC 47/47、Electron renderer E2E 7/7、Node24 type-check/build 均通过。
- 2026-08-14：真实 Electron UAT 以隔离数据根完成向导创建学期/课程、重启后展开并选择课程回读、冲刺无已确认考试空态、设置保存反馈、最大化导航、采集合规空态与原生 WAV 选择器。未覆盖确认考试→速背生成/朗读、报告生成/投递/详情朗读、成功转写/失败恢复、真实备份恢复、设置值重启回读；在 `.record/T-M5-005-实施记录.md` 与 `docs/traceability/` 登记，任务保持 in_progress。
- 2026-08-14：用户明确授权提交、推送并合并当前改动。完整 Node24 `verify --stage=full` 首次暴露备份 renderer E2E 未消费新增覆盖确认态；仅补测试的“开始恢复→确认覆盖→恢复完成”可见步骤后，定向真实 Electron E2E 1/1 和完整门禁均通过（unit/integration 132 files/1199 tests、真实 Electron E2E 33 files/141 tests、contract 128/128、安全 6/6、build/smoke/docs-governance 通过）。Git 收口开始执行，任务仍因原生 UAT 缺口保持 `in_progress`。
- 2026-08-14：功能/证据提交 `112da31`（`feat(m5): S6-S7 TTS 备份设置 UX 修订`）已推送 `agent/T-M5-005-s6-s7-tts-backup-settings-ux`，随后 ff-only 合并并推送 master；合并后 Node24 完整门禁通过，首次核验 `HEAD=origin/master=112da31`。该 Git 事实不替代原生 UAT或独立审查；任务保持 `in_progress`，安装器未读取、未暂存。
- 2026-08-15：修正 TTS 复习资格：`useTtsPlayback` 只对同时具有 `refType/refId` 的目标开放「标记已复习」；报告等仅标题朗读停止后不再显示不可持久化按钮。TTS RPC 11/11、renderer UX 4/4、type-check、build 通过；真实 Electron TTS 1/1、报告 2/2、备份 1/1、采集 2/2、设置标准回归 1/1 通过。上述自动化不替代原生 UAT。
- 2026-08-15：复核原生证据后，设置值重启回读已由后续真实 Electron 纯 UI 截图取代早期 runner 失败并按 PASS 记录；报告投递重启循环、S7 成功转写/结果回读、备份恢复后业务数据回读、TTS 原生复习持久化仍未覆盖。任务保持 `in_progress`，不启动 T-M5-006~008；安装器未读取、未暂存。
- 2026-08-15：新增后续真实 Electron 纯 UI 设置回读证据：保存每日目标 `61` 后重启，设置页可见值仍为 `61`；隔离根 `app-data-2/config/settings.json` 同步为 `61`。早期专用 runner 的 phase-two 失败保留为历史事实，不再阻塞设置闭环。报告投递重启、S7 成功转写/结果回读、备份恢复后业务数据回读、TTS 原生复习持久化仍未覆盖。
 - 2026-08-15：修复 `ReportTab` 本会话冻结状态回退：成功 `reports.freeze` 后按 `reportKey` 记忆，返回列表再进入详情仍显示“已冻结”；新增报告 RPC 导航回归，定向 10/10 通过。该状态不替代跨重启冻结证据。
 - 2026-08-15：明确 S7 边界：本任务验收合规确认、原生 WAV 选择和依赖不可用恢复；成功 whisper 转写、S2 handoff 和结果重启回读依赖 T-M5-006 自包含运行依赖，保持未完成且不阻塞本任务其他收尾。
- 2026-08-15：第三轮独立代码审查与治理审查均返回 `PASS`，P0/P1=0；确认 TTS 注入/资格门控、备份覆盖确认、报告冻结本会话缓存、脱敏边界和自动化与原生 UAT证据边界无缺陷。原生报告投递重启、真实备份恢复后业务数据回读、TTS 原生复习持久化仍因无可用桌面控制设备未覆盖；任务继续 `in_progress`，不启动 T-M5-006~008。
- 2026-08-15：用户决定暂置当前工作台缺口，重装一套干净 Windows 后运行 setup，在真实已安装应用中完成最后三条用户闭环：S6 报告投递后重启回读、真实备份恢复后业务数据完整性/重启回读、TTS 原生“标记已复习”持久化并重启回读。当前不继续扩展代码；发现真实安装环境问题后再针对性修复。安装器验收属于本次用户授权的下一步真实验证，证据必须来自可见 UI、原生文件选择器和应用重启，不得使用 CDP、注入、handler 直调或数据库预置替代。
