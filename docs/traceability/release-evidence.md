# T-M5-005 `release-evidence`

**状态**：in_progress；本任务功能/证据提交已进入 master、完整质量门通过，原生 Electron UAT 部分完成；Git 集成事实已核验但不替代未完成的 UAT与审查
**盘点日期**：2026-08-14
**任务**：T-M5-005
**填写规则**：空白字段和未覆盖路径不得解释为通过；T-M5-005 证据消费 T-M5-009 基线。


## 1. 基本信息

| 字段 | 值 |
|---|---|
| task-id / release-id | `T-M5-005` / `T-M5-005-native-uat-20260814` |
| 日期（绝对日期） | `2026-08-14` |
| 分支 / commit | `agent/T-M5-005-s6-s7-tts-backup-settings-ux` / `112da31`（已 ff-only 合并并推送 master） |
| 数据根模式 | `isolated` |
| 运行根 | `H:\pi-studybuddy-tmp\runs\T-M5-005\` |
| 版本 / Node / pnpm / Electron | `源码工作台 / Node24.14.0 / pnpm11.20.0 / Electron36.9.5` |
| 变更范围 | renderer TTS 入口、overwrite 确认、T-M5-009 追溯消费 |
| 非范围与停止条件 | T-M5-006 依赖自包含、T-M5-007 干净机、T-M5-008 发行；真实恢复/升级/卸载未覆盖 |


## 2. 追溯矩阵摘要

| TRACE-ID | ACT/CTRL | ERR | DATA | TEST/E2E | UAT | OPS | 状态 |
|---|---|---|---|---|---|---|---|
| TRACE-S1-RESTART-001 | ACT-S1-002 | ERR-STATE-001 | DATA-BIZ-001/002 | native Electron | `23..28-restart-*.png` | OPS-START-001 | 已证实 |
| TRACE-SHELL-NAV-001 | ACT-SHELL-001 | ERR-UI-001 | 无直接写入 | native Electron | `30-management-maximized.png` | OPS-START-001 | 已证实 |
| TRACE-SETTINGS-001 | ACT-SETTINGS-001 | ERR-SQLITE-001 | DATA-CFG-003 | renderer/RPC + native | `21-settings-opened.png`, `22-settings-save-feedback.png` | OPS-SEC-001 | 部分证据 |
| TRACE-S7-001 | ACT-S7-001 | ERR-FILE-001/ERR-DEPENDENCY-001 | DATA-FILE-* | renderer/E2E + native | `37..39-capture-*.png` | OPS-DEP-001 | 阻塞 |
| TRACE-TTS-001 | ACT-TTS-001 | ERR-DEPENDENCY-001 | review event | renderer contract/E2E | native content entry未到达 | OPS-DEP-001 | 部分证据 |
| TRACE-BACKUP-001 | ACT-BACKUP-001 | ERR-BACKUP-001 | DATA-FILE-003 | renderer/RPC | native restore未覆盖 | OPS-BACKUP-001 | 部分证据 |
| TRACE-S6-001 | ACT-S6-001 | ERR-STATE-001 | DATA-BIZ-* | renderer contract/E2E | native report detail未覆盖 | OPS-REPORT-001 | 部分证据 |

## 3. 自动化质量门

| 门禁 | 命令/证据 | 结果 | 运行根相对路径 | 备注 |
|---|---|---|---|---|
| type-check | 完整 Node24 `verify --stage=full` | PASS | terminal evidence | Type Errors 0 |
| unit/integration | 完整 Node24 `verify --stage=full` | PASS：132 files / 1199 tests | terminal evidence | 既有 React `act(...)` warnings 保留 |
| Electron E2E | 完整 Node24 `verify --stage=full` | PASS：33 files / 141 tests | terminal evidence | 覆盖确认旧 E2E 修正后全绿；renderer automation 不替代原生 UAT |
| contract/security | 完整 Node24 `verify --stage=full` | PASS：128 handlers；安全 6/6 | terminal evidence | build、smoke 同步通过 |
| docs/diff-check | `scripts/check-docs-governance.mjs` + `git diff --check` | PASS | terminal evidence | 文档治理 14 份设计文档、2 个 Skill、2 个 prompt 通过；提交前将再次执行 diff-check |

## 4. 真机 UAT（必填，不得降级偷换）

| UAT-ID | 全新隔离根 | 可见 UI 路径 | 创建→使用→重启回读 | DOM/截图/JSON | 注入/直调/预置 | 结果 |
|---|---|---|---|---|---|---|
| UAT-S1-RESTART-20260814 | 是 | 向导创建学期/课程→关闭→重启→展开学期→选择课程 | 是 | `native-uat-20260814/evidence/17..28-*.png` | 无 | PASS（仅 S1 context） |
| UAT-SHELL-SETTINGS-20260814 | 是 | 最大化→设置→保存反馈；状态栏/上下文栏脱敏检查 | 设置重启值未完成 | `native-uat-20260814/evidence/21-settings-opened.png`, `22-settings-save-feedback.png`, `30-management-maximized.png` | 无 | 部分证据 |
| UAT-S7-CAPTURE-20260814 | 是 | 采集→勾选合规→原生 WAV 文件选择器→空态检查 | 转写未完成 | `native-uat-20260814/evidence/37-capture-refocused.png`, `38-capture-file-dialog-clean.png`, `39-capture-wav-selected-clean.png` | 无 | 部分证据/阻塞 |
| UAT-S6-TTS-BACKUP-20260814 | 是 | 报告详情、朗读目标、备份恢复 | 未执行完整路径 | — | 无 | 未覆盖 |

> 早期白屏/退出事实保留于 `native-uat-20260814/evidence/01..04-*.png`；不以该失败替代后续已可交互实例，也不删除失败证据。

## 5. 数据、安装与运维证据

- [x] 当前 UAT 使用隔离根；未读写生产根。
- [ ] SQLite 建库/连接关闭/WAL/SHM 句柄证据存在。
- [ ] 文件—数据库双写、失败补偿、孤儿文件处理：显式未覆盖。
- [ ] 首次启动与再次启动有证据；异常退出后再启动：未覆盖。
- [ ] 备份、恢复、升级、卸载和数据保留策略：未覆盖。
- [x] 运行依赖边界已登记；whisper 自包含转交 T-M5-006。
- [x] 已检查应用可见区域，无完整 UUID、绝对路径、密钥、错误栈或原始异常；原生文件选择器路径仅在证据截图中可见。

## 6. Git 与治理收口

| 要件 | 证据 | 结果 |
|---|---|---|
| docs/04 任务登记 | `docs/04-任务清单-Todo-List.md:T-M5-005` | PASS（任务仍 in_progress；部分 UAT/未覆盖范围已同步） |
| master 集成与复验 | `112da31` 已 ff-only 合并 master；`C:\node-v24.14.0-win-x64\node.exe scripts/verify.mjs --stage=full` | PASS：132 files/1199 tests、33 files/141 Electron E2E、contract 128/128、安全 6/6、build/smoke/docs-governance |
| origin/master 推送核验 | `git rev-parse HEAD` 与 `git rev-parse origin/master` | PASS：首次均为 `112da3114d048bcdaa4a1949c8f7844479e60ec4` |
| `.record` 八章节 | `.record/T-M5-005-实施记录.md` | PASS（本轮记录） |

只有上述三项 Git/治理要件齐全，才可依据 AGENTS.md §8.4 报告任务完成。

## 7. 审查状态

本任务尚未达到收尾条件，未开展独立复审或用户签收；不得填入模板化姓名、日期或 PASS 结论。独立审查仅在完整原生 UAT、质量门和 Git 授权路径具备后进行。
