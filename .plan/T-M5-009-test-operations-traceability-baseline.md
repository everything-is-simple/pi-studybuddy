# T-M5-009 唯一执行计划：测试与运维追溯基线建立

**任务 ID**：T-M5-009
**状态**：✅ done（2026-08-14 用户任务特定裁决认可受控文档消费路径验收 PASS；功能 `156756c`、master 复验及本治理登记推送/远端同位核验后完成）
**日期**：2026-08-14
**里程碑**：M5 用户可用性验收 + UI 修订 + 一键交付
**标题**：测试与运维追溯基线建立
**优先级**：P0
**执行序**：45
**实施分支**：`agent/T-M5-009-traceability-baseline`
**集成分支**：`master`
**基线**：`408865e`（`master=origin/master`，分支创建前工作区干净）
**运行根**：`H:\pi-studybuddy-tmp\runs\T-M5-009\`
**权威依据**：AGENTS.md §4.4/§4.5/§5/§7/§8；docs/13 §3-§9；docs/08 §1/§6/§7；docs/04 §7.5 执行序 45

## 1. 开工门禁（已核验）

| 项目 | 当前证据 | 结论 |
|---|---|---|
| 上一任务 | `docs/04`：T-M5-004 = done | ✅ 满足 |
| 用户授权 | 本次明确指令：批准 T-M5-009 开工 | ✅ 满足 |
| 单一计划 | `.plan/00-当前任务.md` 将切换为本计划；无其他 in_progress 计划 | ✅ 满足 |
| 任务登记 | `docs/04` T-M5-009 从 `pending` 改为 `in_progress` | ✅ 本计划首个治理动作 |
| Git 基线 | `408865e`，`master=origin/master`，本分支仅承载本任务 | ✅ 满足 |

## 2. 目标

建立可被 T-M5-005~008 消费、可审查、可持续更新的首版测试与运维追溯基线，串联：

```text
UI 控件/用户动作 → 运行时能力 → 逻辑/handler → 数据资产 → 测试证据 → 运维/发布证据
```

本任务只盘点当前真实实现、已有证据和明确缺口；不把静态 JSX、历史测试、renderer 自动化或安装冒烟升级为真实用户闭环结论。

## 3. 纳入范围与交付物

在 `docs/traceability/` 建立以下六项受控资产：

1. `interaction-catalog.md`：`CTRL-* → ACT-*` 目录、动作字段、当前覆盖状态、统计口径和未分解控件登记。
2. `error-catalog.md`：`ERR-*`、错误码/触发边界、责任层、用户可见责任、恢复动作、日志脱敏边界和证据状态。
3. `data-asset-catalog.md`：`DATA-*`、SQLite/文件/配置落点、所有者、读写、生命周期、备份/恢复、测试隔离和敏感性。
4. `system-traceability.md`：UI → 运行 → 逻辑 → 数据 → 测试 → 运维的逐项矩阵，并区分已证实、部分证据、未覆盖和阻塞。
5. `operations-runbook.md`：启动健康、数据根、SQLite、备份恢复、升级/卸载、依赖健康、诊断和事故停止条件骨架。
6. `release-evidence.md`：每次发布/收尾可复制填写的自动化、真机 UAT、隔离根、安装/升级/恢复、Git 和治理证据模板。

## 4. RED → GREEN 验收步骤

### RED

- 新增治理测试 `tests/integration/t-m5-009-traceability-baseline.test.ts`。
- 测试在六项资产尚不存在时必须失败，且要求关键字段/安全边界/当前基线标记存在。
- 记录 RED 输出到 `H:\pi-studybuddy-tmp\runs\T-M5-009\red-governance-test.log`。

### GREEN

- 创建六项文档，引用 T-M5-001 的 `control-inventory.md`、`gap-register.md`、`ui-function-dependency-matrix.md` 及当前源码/契约/测试事实。
- 只登记当前证据；未知项使用 `未覆盖` / `待核验` / `阻塞`，不猜测 ACT 总数、错误总数或数据完整性。
- 运行治理测试并写结果文件；运行文档治理、diff-check 和与本任务相关的定向测试。

### REFACTOR / 收尾准备

- 统一 ID、字段和状态词；为 T-M5-005~008 标注消费入口。
- 更新 `.plan/00-当前任务.md`、`docs/04`、`docs/00`、`AGENTS.md` 的当前状态事实；不创建下一任务计划。
- 按 AGENTS.md §7 建立 `.record/T-M5-009-实施记录.md` 仅在任务证据完成、且用户另行授权 Git 收口前保留未收口状态。

## 5. 明确不纳入

- 不新增业务 API、schema、handler、stream、renderer 入口或跨 Tab 状态。
- 不修复 T-M5-005~008 的业务功能，不替代 S6/S7/TTS/备份/设置/依赖自包含/干净机 UAT/最终发行验收。
- 不写 `%LOCALAPPDATA%\PiStudyBuddy` 生产数据；不调用真实 AI、SMTP、WPS、OCR、whisper 或外部服务。
- 不把 `H:\pi-studybuddy-tmp\runs\T-M5-001` 证据复制进仓库；只在目录中引用其路径和事实。
- 不执行 commit、merge、push 或报告任务 done，除非用户另行授权 Git 收口并满足 §8.4。

## 6. 验收标准

- [x] 六项受控资产均存在于 `docs/traceability/`，且具备可持续追加的表头/字段。
- [x] `CTRL-* → ACT-*`、`ACT-* → ERR-*`、`ACT-* → DATA-*`、`ACT-* → TEST/UAT-*`、`ACT-* → OPS-*` 关系可追溯；未覆盖项显式标记。
- [x] 数据资产覆盖业务 SQLite、测试 SQLite、文件/配置和 DPAPI 凭证边界；每项有生命周期/备份/测试隔离字段。
- [x] 运行手册覆盖启动、数据根、SQLite、备份恢复、升级、卸载、依赖健康、脱敏诊断和停止条件。
- [x] 发布证据模板明确自动化证据不等于真机 UAT，且记录隔离根、截图/DOM/JSON、安装/升级/恢复、Git/治理三要件。
- [x] 定向治理测试、文档治理和 `git diff --check` 通过；真实当前状态与证据路径无敏感数据泄漏。
- [x] 用户明确认可 `T-M5-009-DOC-CONSUMER-001` 受控文档消费路径验收为 PASS，替代本无 Electron UI 变更任务的真机 Electron UAT；未使用 renderer 注入、handler 直调或数据库预置。该例外不得外推为应用 UI UAT 或后续任务豁免。

## 7. 停止条件

出现以下任一情况立即停止并请求裁决：

- 需要新增 API/schema/handler/入口才能形成目录；
- 现有 UI、运行时、逻辑或数据落点无法区分，必须猜测；
- 需要访问生产数据根、写入真实业务数据或连接真实外部服务；
- 需要把历史/间接证据表述为真机 UAT 或发布通过；
- `docs/00`、`docs/04`、`docs/13`、AGENTS.md 或本计划的状态互相冲突。

## 8. 当前进度日志

- 2026-08-14：恢复权威链，核验 `408865e`、`master=origin/master`、T-M5-009 pending、无其他执行中计划。
- 2026-08-14：用户批准 T-M5-009 开工；创建实施分支 `agent/T-M5-009-traceability-baseline`。
- 2026-08-14：RED→GREEN 完成；六项资产、实施记录和治理同步完成。`H:\pi-studybuddy-tmp\runs\T-M5-009\` 保存 RED/GREEN/verify 日志。
- 2026-08-14：用户明确裁决受控文档消费路径验收替代本任务真机 Electron UAT，并认可 `H:\pi-studybuddy-tmp\runs\T-M5-009\document-consumer-acceptance.json` 的 `T-M5-009-DOC-CONSUMER-001` 为 PASS；用户同时授权 Git 收口。
- 2026-08-14：功能/基线提交 `156756c` 已 ff-only 合并 master；Node24 master `verify --stage=full` 最终重跑通过（131 files/1195 tests、真实 Electron E2E 33 files/141 tests）。本治理登记推送并核验 origin/master 后完成；不启动 T-M5-005。
