# T-M5-009 `release-evidence`

**状态**：首版模板，`in_progress`
**盘点日期**：2026-08-14
**任务**：T-M5-009
**填写规则**：每个受控任务/发布候选复制本模板到对应运行根或 `.record`，填写真实证据；空白字段不得解释为通过。

## 1. 基本信息

| 字段 | 值 |
|---|---|
| task-id / release-id | `<T-...>` |
| 日期（绝对日期） | `YYYY-MM-DD` |
| 分支 / commit | `<branch>` / `<sha>` |
| 数据根模式 | `isolated` / `default`（默认必须说明原因） |
| 运行根 | `H:\pi-studybuddy-tmp\runs\<task-id>\` |
| 版本 / Node / pnpm / Electron | `<value>` |
| 变更范围 | `<真实范围>` |
| 非范围与停止条件 | `<真实声明>` |

## 2. 追溯矩阵摘要

| TRACE-ID | ACT/CTRL | ERR | DATA | TEST/E2E | UAT | OPS | 状态 |
|---|---|---|---|---|---|---|---|
| `<TRACE-...>` | `<ACT-/CTRL->` | `<ERR->` | `<DATA->` | `<TEST-/E2E->` | `<UAT->` | `<OPS->` | `已证实/部分证据/未覆盖/阻塞` |

## 3. 自动化质量门

| 门禁 | 命令/证据 | 结果 | 运行根相对路径 | 备注 |
|---|---|---|---|---|
| type-check | `<command>` | `PASS/FAIL` | `<file>` | 不能替代 UAT |
| unit/integration | `<command + counts>` | `PASS/FAIL` | `<file>` | 记录真实数量 |
| Electron E2E | `<command + counts>` | `PASS/FAIL` | `<file>` | 说明是否 renderer 自动化 |
| contract/security/UUID | `<command>` | `PASS/FAIL` | `<file>` | 脱敏检查 |
| docs/diff-check | `<command>` | `PASS/FAIL` | `<file>` | 治理同步 |

## 4. 真机 UAT（必填，不得降级偷换）

| UAT-ID | 全新隔离根 | 可见 UI 路径 | 创建→使用→重启回读 | DOM/截图/JSON | 注入/直调/预置 | 结果 |
|---|---|---|---|---|---|---|
| `<UAT-...>` | `是/否` | `<步骤摘要>` | `是/否/不适用` | `<relative files>` | `无/有（不合格）` | `PASS/FAIL/未覆盖` |

> renderer 自动化、CDP、`webContents.executeJavaScript`、RPC/handler 直调或数据库预置的证据，**不等于真机 UAT**；有任一项时只能登记自动化/部分证据。

## 5. 数据、安装与运维证据

- [ ] 生产根与 `H:\pi-studybuddy-tmp\runs\<task-id>\` 物理隔离。
- [ ] SQLite 建库/连接关闭/WAL/SHM 句柄证据存在。
- [ ] 文件—数据库双写、失败补偿、孤儿文件处理已核验或显式未覆盖。
- [ ] 首次启动、再次启动、异常退出后再启动均有证据。
- [ ] 备份、恢复、升级、卸载和数据保留策略均有证据；没有证据不得宣称发布通过。
- [ ] 运行依赖的可用/不可用但可恢复边界已登记。
- [ ] 日志和 DOM 脱敏：不记录请求正文、模型完整输出、base URL、密钥、完整 UUID、绝对路径、错误栈或资料原文。

## 6. Git 与治理收口

| 要件 | 证据 | 结果 |
|---|---|---|
| docs/04 任务登记 | `<path + line/entry>` | `PASS/待补` |
| master 集成与复验 | `<sha + command>` | `PASS/待补` |
| origin/master 推送核验 | `<sha + refs>` | `PASS/待补` |
| `.record` 八章节 | `<path>` | `PASS/待补` |

只有上述三项 Git/治理要件齐全，才可依据 AGENTS.md §8.4 报告任务完成；本 T-M5-009 当前模板状态不代表收口完成。

## 7. 审查签名

| 角色 | 姓名/标识 | 日期 | 结论 |
|---|---|---|---|
| 实施者 | `<name>` | `YYYY-MM-DD` | `PASS/待补` |
| 独立复审 A | `<name>` | `YYYY-MM-DD` | `PASS/待补` |
| 独立复审 B | `<name>` | `YYYY-MM-DD` | `PASS/待补` |
| 用户/维护者 | `<name>` | `YYYY-MM-DD` | `PASS/待补` |
