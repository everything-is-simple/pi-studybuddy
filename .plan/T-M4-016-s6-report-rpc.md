# T-M4-016 实施计划：S6 报告 Tab RPC 接线

- 任务 ID：T-M4-016
- 任务标题：S6 报告 Tab RPC 接线（reports + deliveries + reportTargets）
- 任务类型：M4 业务接线
- 优先级：P2
- 治理阶段：阶段 4（系统组装）
- 状态：✅ 已批准并实施完成（本地实施、定向验收、真实 Electron E2E、完整质量门与双维度独立审查通过；Git 收口待用户单独授权）
- 日期：2026-08-11
- 用户授权：用户明确选择并批准开工 T-M4-016（2026-08-11“开始 T-M4-016”）+ 批准计划（2026-08-11“批准计划”）
- 集成基线：master=origin/master=3dcf93f（T-M4-024 Git 收口事实核验，`git rev-parse master origin/master` 同一提交）
- 实施分支：agent/T-M4-016-s6-report-rpc
- 集成分支：master
- 测试运行根：H:\pi-studybuddy-tmp\runs\T-M4-016\

## 一、前置事实与权威依据

- T-M4-024 已完成治理事实收口：`docs/04-Todo` v0.1.124 已登记 done，`master=origin/master=3dcf93f` 已核验；工作区除未跟踪的 pi-session 导出 html（用户 dirty 文件）外干净。
- `.plan/` 无其他执行中任务（00-当前任务.md 指向已 done 的 T-M4-015），单一执行任务门禁满足。
- 权威范围：09-UI §4.9、06-API §3.8、07-Workflow §3/§8.8、08-Test §5/§6/§7.4/§5.7、02-PRD §5.2、AGENTS.md §4.4/§5/§7/§8/§9。
- 既有 contract 能力（已装配于 src/agent-host/handlers/s6/，contract 保持 127/127，仅复用不新增）：
  - `reports.list({ semesterId?, reportType? })` → `ParentReport[]`（ReportTab 已接线）
  - `reports.generate({ semesterId, reportType, periodStart, periodEnd })` → `ParentReport`（规则优先 + AI 仅润色；AI 失败保留规则报告）
  - `reports.freeze({ reportKey })` → `ParentReport`（冻结快照 content_json + content_hash；assertNoSensitiveLeak）
  - `reports.get({ reportKey })` → `ParentReport`
  - `deliveries.list({ reportKey? })` → `ReportDelivery[]`
  - `deliveries.deliver({ reportKey, channel })` → `ReportDelivery`（report_key+channel 去重；渠道独立失败隔离）
  - `deliveries.retry({ reportKey, channel })` → `ReportDelivery`（最多重试 3 次；达上限 retained_locally）
  - `reportTargets.list({ semesterId })` → `ParentReportTarget[]`（渠道配置状态：已配置可投递/未配置 ─）
- 明确不新增、不改动：API contract（保持 127/127）、handler、schema、AppShell 全局状态、S1-S5 已验收语义、真实外部服务（SMTP/飞书全部 mock，仅 local_export 为真实渠道）和真实业务数据根。

## 二、允许修改范围

1. `src/renderer/components/tabs/ReportTab.tsx`（接通既有 S6 RPC：生成入口 + 报告类型/周期选择 + 查看历史 + 冻结 + 投递状态可视化 + 投递/重试 + 渠道配置状态）
2. `tests/integration/t-m4-016-report-rpc.test.ts`（新增，RPC/门控/竞态/卸载/重复 mutation/隐私夹具）
3. `tests/e2e/t-m4-016-report-renderer.test.ts`（新增，真实 Electron + 127.0.0.1 TCP 链路，隔离 fixture 预置）
4. `.plan/T-M4-016-s6-report-rpc.md`（本文件）
5. `.plan/00-当前任务.md`
6. `.record/T-M4-016-实施记录.md`（受控收尾时创建）
7. `docs/04-任务清单-Todo-List.md`、`docs/00-文档索引-Index.md`（开工登记与受控收尾时同步事实）

禁止覆盖当前工作区既有用户 dirty 修改（未跟踪 pi-session html）与既有治理资产。

## 三、RED 测试追踪

| ID | 设计条款 | 失败证据 |
|---|---|---|
| S6-RED-01 | 报告列表加载与学期上下文（06-API §3.8 + 09-UI §4.9） | `reports.list({ semesterId })` 按当前学期加载；无学期/加载中/失败显示明确状态；空列表显示空态与生成入口 |
| S6-RED-02 | 生成报告（09-UI §4.9“生成报告”+ 06-API §3.8） | 选择 reportType（日报/周报/月报/考试提醒）+ periodStart/periodEnd 默认当前窗口；点击“生成”只调用一次 `reports.generate`；重复点击不重复 mutation；生成成功后列表刷新并展示新报告 |
| S6-RED-03 | 查看历史详情（09-UI §4.9“查看历史”） | 点击历史条目调 `reports.get({ reportKey })` 展示冻结脱敏 contentJson（summary + sections）；返回列表不丢状态 |
| S6-RED-04 | 冻结（09-UI §4.9“冻结并投递”+ 06-API §3.8 冻结快照） | 点击“冻结”只调一次 `reports.freeze({ reportKey })`；冻结后展示 contentHash 短摘要与 privacyCheckPassed 状态；未冻结报告不可投递（门控） |
| S6-RED-05 | 投递状态可视化（09-UI §4.9 渠道行 + 06-API §3.8） | `deliveries.list({ reportKey })` 展示每个渠道状态：sent ✅ / failed ✗（重试中）/ retained_locally；未配置渠道显示 ─（未配置）且不可投递 |
| S6-RED-06 | 投递与重试（06-API §3.8） | 对已配置渠道点击“投递”只调一次 `deliveries.deliver({ reportKey, channel })`；失败渠道提供“重试”只调一次 `deliveries.retry`；达上限展示 retained_locally 不可再重试 |
| S6-RED-07 | 渠道配置状态（reportTargets.list） | `reportTargets.list({ semesterId })` 仅用于判断已配置渠道；不展示 credentialKey/真实渠道地址/channelConfigJson 原文；家长不进系统（学生侧只看到脱敏聚合与渠道状态） |
| S6-RED-08 | 竞态/卸载/归档只读/错误净化（08-Test §5/§5.7 + AGENTS.md §9.3） | 旧学期/旧报告异步响应不得覆盖新状态；卸载后不得 setState；archived 学期禁用 generate/freeze/deliver mutation（renderer 侧 isReadOnly + host 侧既有防线——实施时核对 s6 handler 是否具备 assertSemesterWritable，如缺失按 T-M4-015 先例补齐）；错误文案不展示路径、堆栈、完整 UUID、file URI、SQL、真实渠道地址 |

先记录 RED 初次失败证据，再写最小 GREEN 实现；不得用待测实现生成 golden 预期。

## 四、实施步骤

1. 读取当前 ReportTab、AppShell 传参、typed RPC、MistakesTab/PracticeTab/CramTab 既有范式与 `tests/e2e/helpers/` harness，确认不需要 AppShell 状态变更；核对 s6 handler 是否具备 host 侧 archived 防线（对齐 T-M4-011/013/015 assertSemesterWritable 先例）。
2. 先新增 `tests/integration/t-m4-016-report-rpc.test.ts`（S6-RED-01~08 对应用例）并确认预期失败（RED 证据存 `H:\pi-studybuddy-tmp\runs\T-M4-016\red\`）。
3. 仅重写 ReportTab 内部实现：学期上下文报告列表（既有 reports.list 保持）、生成入口（reportType 选择 + 周期默认值 + 防重复 mutation）、查看历史详情（reports.get）、冻结（reports.freeze + 投递门控）、投递状态可视化（deliveries.list）、投递/重试（deliveries.deliver/retry 防重复 + 独立失败隔离）、渠道配置状态（reportTargets.list，不展示敏感字段）、生命周期 guard、错误净化、归档只读。
4. 运行定向 unit/integration；修复至 GREEN，再做最小 REFACTOR。
5. 新增真实 Electron S6 E2E（隔离 fixture：预置学期 + 报告目标 local_export + 已冻结报告 + 投递记录），覆盖启动、进入报告 Tab、报告列表、生成报告、查看历史、冻结门控、投递/重试状态可视化、archived 只读、错误净化、学期切换竞态、隐私断言（不展示完整 UUID/真实地址）；运行根 `H:\pi-studybuddy-tmp\runs\T-M4-016\`。
6. 运行 Node24/pnpm11 完整质量门和 `git diff --check`。
7. 两名独立审查者交叉复核（功能/契约维度 + 治理/安全维度），修复并复验 P0/P1/P2。
8. 按 AGENTS §7 创建 8 章节实施记录并同步 Todo/索引；停止等待用户 Git 收口授权。

## 五、质量门

- `C:\node-v24.14.0-win-x64\node.exe --version` → `v24.14.0`；`pnpm --version` → `11.20.0`
- 定向 unit/integration/E2E
- `pnpm type-check`、`pnpm build`、`pnpm test`、`pnpm smoke`
- `pnpm verify -- --stage=full`（在 master 基线 113 files/1085 tests + 20 files/124 E2E 之上不回归）
- contract coverage、desktop security、UUID leak、docs governance、`git diff --check`

所有运行数据、Electron user-data、SQLite、日志和结果只能写入 `H:\pi-studybuddy-tmp\runs\T-M4-016\`，禁止写 `%LOCALAPPDATA%\PiStudyBuddy`；不连接真实 AI/SMTP/飞书/WPS/whisper.cpp（渠道 mock 仅 local_export 真实导出）。

## 六、明确非目标与停止条件

- 不新增报告/投递/目标 API、handler 或 schema（contract 保持 127/127）
- `reportTargets.create/update/delete` 不纳入本轮 renderer 接线（09-UI §4.9 无渠道管理表单 UI 依据；真实地址在 credential-vault 属设置页能力，留待后续任务/用户裁决）
- 不接入 TTS 控制条/朗读按钮（T-M4-018）、不接入备份恢复面板（T-M4-019）、不接入 S7 采集 Tab（T-M4-017）
- 不做跨 Tab 状态重构；不新增 AppShell 全局状态
- 需要变更报告规则/投递语义、发现 host 侧归档防线缺失（按 T-M4-015 先例补齐）、真实 Electron 无法启动、Node 非 v24.14.0、工作区归属无法区分时立即停止并报告

本计划只允许本地实施与治理证据同步；未经用户另行明确授权不得 `git add`、`git commit`、`git merge`、`git push`，不得混入当前工作区其他 dirty 文件。
