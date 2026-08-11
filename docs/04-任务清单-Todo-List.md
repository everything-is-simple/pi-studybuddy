# 04 任务清单
**版本**：v0.1.139
**日期**：2026-08-11
**状态**：✅ 已审查批准（v0.1.139 T-M4-019 Git 收口完成：功能提交 `1bc68e2`（feat(m4) 备份恢复面板 RPC 接线与备份 Tab 入口）与治理登记提交已由 `agent/T-M4-019-backup-restore-rpc` 快进合并进入 `master`；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit/integration 118 files/1130 tests、真实 Electron E2E 24 files/130 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；`git push origin master` 成功并核验 `master=origin/master`（远端 refs/heads/master 一致；具体哈希于推送后 Git 证据登记）；§7.6.1 状态 in_progress→done，§9 统计 M4 2 pending/1 in_progress/21 done→2 pending/0 in_progress/22 done，合计 2/1/57→2/0/58；无 API/handler/schema 方法变化；不启动 T-M4-020/021；v0.1.138 登记 T-M4-019 本地实施与验收证据同步：BackupPanel 静态壳 → 受控 RPC 接线（backup.course/allCourses/restore/list/configureSchedule/listSchedules/toggleSchedule + backup.progress 订阅）；TabBar 新增"备份"Tab（决策 1A，09-UI v0.1.5 §4.1 同步）；dialog directory capability（shell 层，contract 127/127 不变）；agent-host 生产接入 Streams["backup.progress"] 推送；恢复冲突策略显式选择（决策 2A）+ 历史行恢复按钮（决策 3A）+ 目标目录选择（决策 4A）；RED 初次失败后 GREEN；定向 integration 11 tests + unit 17 tests、真实 Electron E2E t-m4-019-backup-renderer 1 test；全量 unit/integration 118 files/1130 tests、真实 Electron E2E 24 files/130 tests、verify --stage=full 通过（contract 127/127 + 8 PiBridge + 35 tools、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；任务保持 in_progress，Git 收口待用户单独授权；不启动 T-M4-020/021；v0.1.137 登记 T-M4-019 开工：用户明确选择 T-M4-019~021 序列继续（2026-08-11“下一个任务 T-M4-019~021 开始了 先做prompt 做plan”；T-M4-019 prompt 资产已就绪 v0.1.96，序列下一项为备份恢复面板 RPC 接线 + TabBar 入口，执行序 38）；§7.6.1 状态 pending→in_progress；§9 统计口径修正后 M4 3 pending/0 in_progress/21 done→2 pending/1 in_progress/21 done，合计 3/0/57→2/1/57（修正：待办应为 T-M4-019~021 三项，与 §7.6.1 登记表一致；v0.1.131 起 pending 计数漂移已修正）；唯一计划 `.plan/T-M4-019-backup-restore-rpc.md` 已建立（📝 待审查），隔离分支待计划批准后建立；范围仅既有 backup.* RPC 接线 + TabBar 入口 + dialog directory capability（shell 层）+ backup.progress 生产推送，不新增 API/handler/schema（contract 保持 127/127）；不启动 T-M4-020/021，Git 收口另需授权；v0.1.136 T-M4-018 Git 收口完成：网络恢复后 `git push origin master` 成功并核验 `master=origin/master=3dfef67`（远端 refs/heads/master 一致；功能提交 `dd4b909` + 治理登记提交 `e92c567` + 中间事实提交 `3dfef67` 一并推送）；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 复验通过（unit/integration 117 files/1119 tests、真实 Electron E2E 23 files/129 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；§7.6.1 状态 in_progress→done，§9 统计 M4 1 pending/1 in_progress/21 done→1 pending/0 in_progress/22 done，合计 1/1/57→1/0/58；无 API/handler/schema 方法变化；不启动 T-M4-019~021；v0.1.135 修正 T-M4-018 远端收口中间事实：功能提交 `dd4b909`（feat(tts)）与治理登记提交 `e92c567`（docs(m4)）已由 `agent/T-M4-018-tts-control-rpc` 快进合并进入本地 `master`，Node24.14.0 master 完整 `verify --stage=full` 复验通过（unit/integration 117 files/1119 tests、真实 Electron E2E 23 files/129 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；但 3 次 `git push origin master` 均因 GitHub 连接不可达（443 超时）失败，`origin/master` 尚未核验到新提交（仍为 dfd2894），按 §8.4 任务保持 in_progress，待网络恢复后推送；不启动 T-M4-019~021；v0.1.134 登记 T-M4-018 Git 收口事实（本地 master 完成 + 推送结果见 v0.1.135 修正）：TtsControlBar 静态壳 → 受控 RPC 接线（tts.speak/control/switchEngine/getStatus + tts.state 订阅）；AppShell 局部持有 TTS 播放态（useTtsPlayback，不进入学术上下文）；NotesTab/MistakesTab 既有内嵌朗读按钮接线；agent-host 生产接入 Streams["tts.state"] 推送（TtsContext.emit → server.pushEvent，06-API §4，contract 保持 127/127）；RED 初次失败后 GREEN；定向 integration 10 tests + unit 17 tests、真实 Electron E2E t-m4-018-tts-renderer 1 test；全量 unit/integration 117 files/1119 tests、真实 Electron E2E 23 files/129 tests、verify --stage=full 通过（contract 127/127 + 8 PiBridge + 35 tools、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；任务保持 in_progress，Git 收口待用户单独授权；不启动 T-M4-019~021；v0.1.132 登记 T-M4-018 开工：用户明确选择并批准 TTS 控制条 RPC 接线（tts.speak/control/switchEngine/getStatus + tts.state 订阅 + 既有内嵌朗读按钮 NotesTab/MistakesTab）；§7.6.1 状态 pending→in_progress；§9 统计 M4 2 pending/0 in_progress/21 done→1 pending/1 in_progress/21 done，合计 2/0/57→1/1/57；唯一计划 `.plan/T-M4-018-tts-control-rpc.md` 已建立（📝 待审查），隔离分支待计划批准后建立；范围仅既有 TTS RPC 接线，不新增 API/handler/schema（contract 保持 127/127）；不启动 T-M4-019~021，Git 收口另需授权；v0.1.131 T-M4-017 Git 收口完成：功能提交 `c059571` 与治理登记提交 `c7a6c92`（及中间事实 `130f8e5`/`87afbe0`）已由 `agent/T-M4-017-s7-capture-rpc` 快进合并进入 `master`，Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit/integration 116 files/1105 tests、真实 Electron E2E 22 files/128 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；`git push origin master` 成功并核验 `master=origin/master=87afbe0`（远端 refs/heads/master 一致）；§7.6.1 状态 in_progress→done，§9 统计 M4 3 pending/1 in_progress/20 done→2 pending/0 in_progress/21 done，合计 3/1/56→2/0/57；无 API/handler/schema 方法变化；不启动 T-M4-018~021；v0.1.130 修正 T-M4-017 远端收口中间事实：功能提交 `c059571`（feat(s7)）与治理登记提交 `c7a6c92`（docs(m4)）已在本地 `master` 快进合并，Node24 master 完整 `verify --stage=full` 复验通过（unit/integration 116 files/1105 tests、真实 Electron E2E 22 files/128 tests、contract 127/127、安全 6/6、smoke 6/6）；但 3 次 `git push origin master` 均因 GitHub 连接不可达失败，`origin/master` 尚未核验到新提交，按 §8.4 任务保持 in_progress；不启动 T-M4-018~021；v0.1.129 T-M4-017 本地实施与验收证据同步：CaptureTab 接通既有 `classCapture.transcribe/saveTranscription`，desktop dialog 新增 rawPath capability（shell 层，contract 保持 127/127）；RED 初次 8/9 失败后 GREEN 9/9，unit 12/12，全量 unit/integration/security 116 files/1105 tests、真实 Electron E2E 22 files/128 tests、`verify --stage=full` 通过（contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；`.record/T-M4-017-实施记录.md` 已创建；任务保持 in_progress，Git 收口待用户单独授权；不启动 T-M4-018~021；v0.1.128 登记 T-M4-017 开工：用户明确选择并批准 S7 采集 Tab RPC 接线（classCapture.transcribe + saveTranscription）；唯一计划 `.plan/T-M4-017-s7-capture-rpc.md` 已建立（📝 待审查），任务 pending→in_progress；范围仅既有 RPC 接线 + desktop dialog rawPath capability（shell 层，contract 保持 127/127）；不启动 T-M4-018~021，Git 收口另需授权；v0.1.127 T-M4-016 Git 收口完成：功能提交 `eb4becb` 与治理登记提交 `62fa21d` 已快进进入 `master`，Node24 master 完整 `verify --stage=full` 通过，`git push origin master` 成功并核验 `master=origin/master=62fa21d`，任务登记为 done，不启动 T-M4-017~021；v0.1.126 T-M4-016 本地实施与验收证据同步：ReportTab 接通既有 S6 RPC（reports + deliveries + reportTargets），S6 host 补齐 archived 写防线（assertSemesterWritable 六写入口），RED→GREEN、定向与完整质量门、双维度独立审查通过，任务保持 in_progress，Git 收口待单独授权；v0.1.125 登记 T-M4-016 开工：用户明确批准 S6 报告 Tab RPC 接线（reports + deliveries + reportTargets）；唯一计划 `.plan/T-M4-016-s6-report-rpc.md` 与隔离分支 `agent/T-M4-016-s6-report-rpc` 已建立，测试运行根 `H:\pi-studybuddy-tmp\runs\T-M4-016\`；不新增 API/handler/schema（contract 保持 127/127），不启动 T-M4-017~021；v0.1.124 T-M4-024 模型 provider 接入与凭证委托修复完成：用户提供 agnes-2.5-flash（baseUrl `https://apihub.agnes-ai.com/v1`），真实数据根 `%LOCALAPPDATA%\PiStudyBuddy` 已写入 `config/models.json`（业务别名）+ `config/pi-models.json`（运行时 provider 定义）+ `config/credentials.json`（DPAPI 加密 key）；修复 2 个生产缺陷：① loader 未把 `modelRuntime` 注入 `createAgentSessionServices` 致 API key 不生效 ② agent-host（utilityProcess）无 electron `safeStorage` 致 DPAPI vault 不可用；新增 `credential-client.ts` parentPort 委托 main 主进程 vault（main `ipc.ts` forkAgent 响应）；完整应用链路真实验证通过（agent.send 17 事件/32 token，回复真实 agnes 内容）；Node24.14.0 `verify --stage=full` 通过（unit/integration 113 files/1085 tests、真实 Electron E2E 20 files/124 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；无 API/handler/schema 方法变化（credentials.* 仅内部改 async）；不启动 T-M4-016~021；v0.1.123 T-M4-015 Git 收口完成：功能提交 `7974423` 与治理登记提交 `2d63bf5` 已由 `agent/T-M4-015-s5-cram-rpc` 快进合并进入 `master`；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit/integration 112 files/1079 tests、真实 Electron E2E 20 files/124 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check 通过）；`git push origin master` 成功并核验 `master=origin/master=2d63bf5`；§7.6.1 状态 in_progress→done，§9 统计 M4 6 pending/1 in_progress/16 done→6 pending/0 in_progress/17 done，合计 6/1/52→6/0/53；无 API/handler/schema 变化，不启动 T-M4-016~021；v0.1.122 T-M4-015 双维度独立审查闭环：审查者 A 发现 S5 写 handler 缺 host 侧 archived 防线（对比 S3 assertSemesterWritable），按 T-M4-011/013 先例补齐 `s5/lookup.ts:assertSemesterWritable` 并在 generatePaper/startAttempt/submitAttempt 三写入口调用（方法签名不变，不新增 API/handler/schema，contract 保持 127/127）；新增 host-boundaries 2 tests；完整质量门复验通过：unit/integration 112 files/1079 tests、真实 Electron E2E 20 files/124 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check；`.record/T-M4-015-实施记录.md` 已创建；任务保持 in_progress，Git 收口待用户单独授权；不启动 T-M4-016~021；v0.1.121 T-M4-015 本地实施与验收证据同步：CramTab 接通既有 S5 RPC——已确认考试局部显式选择门控（复用既有 `exams.list({ courseId, confirmationStatus: "confirmed" })`）、模拟卷生成/作答/提交/结果/模块分析、速背卡只读翻页、冲刺计划 DTO 只读展示；RED 初次 8/8 失败后 GREEN；定向 renderer 14 tests + integration 8 tests、真实 Electron E2E 2 tests、Node24 `verify --stage=full` 通过（unit/integration 111 files/1077 tests、真实 Electron E2E 20 files/124 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；任务保持 in_progress，Git 收口待用户单独授权；不启动 T-M4-016~021；v0.1.120 登记 T-M4-015 开工：用户明确选择并批准 S5 冲刺 Tab RPC 接线（mockExams + cramCards + cramPlan）；§7.6.1 状态 pending→in_progress；§9 统计 M4 7 pending/0 in_progress/16 done→6 pending/1 in_progress/16 done，合计 7 pending/0 in_progress/52 done→6 pending/1 in_progress/52 done；唯一计划 `.plan/T-M4-015-s5-cram-rpc.md` 与隔离分支 `agent/T-M4-015-s5-cram-rpc` 已建立；测试运行根 `H:\pi-studybuddy-tmp\runs\T-M4-015\`；范围仅 S5 冲刺 Tab 的 mockExams.generatePaper/getPaper/startAttempt/submitAttempt/getResult/getModuleAnalyses + cramCards.get + cramPlan.get 接线与已确认考试局部显式选择门控（复用既有 `exams.list`）；不新增 API/handler/schema，不启动 T-M4-016~021，Git 收口另需授权；v0.1.119 T-M4-014 验收缺口补做完成：用户裁决将 09-UI §4.7 的[全部/需复习/已掌握]状态筛选纳入 T-M4-014；MistakesTab 新增局部 `statusFilter` 与三档筛选控件，前端过滤不新增 RPC；RED 初次失败后 GREEN，integration 12 tests + renderer 14 tests + 真实 Electron E2E 2 tests 通过；同步更新 `.pi/prompts/task-execution/`（00-标准提示词新增工程进度基线 §2.5 与标准验收清单 §2.6）；v0.1.118 T-M4-014 Git 收口完成：功能提交 `cb7d62d` 已由 `agent/T-M4-014-s4-mistakes-rpc` 快进合并进入 `master`；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit/integration 110 files/1068 tests、真实 Electron E2E 19 files/122 tests、contract 127/127、安全 6/6、smoke 6/6、docs 治理通过）；`git push origin master` 成功并核验 `master=origin/master=cb7d62d`；任务登记为 done，不启动 T-M4-015~021；v0.1.117 T-M4-014 本地实施、定向验收、真实 Electron E2E、完整质量门与双维度独立审查已完成；任务保持 in_progress，Git 收口待用户单独授权；不启动 T-M4-015~021；v0.1.114 T-M4-013 两名独立审查者 A/B 已完成交叉复核；审查覆盖 RPC 参数、模块/课程范围、防泄露、竞态/卸载、归档只读、真实 Electron E2E、隐私展示与未授权改动边界；P1/P2 已修复并复验；实施记录 `.record/T-M4-013-实施记录.md` 已创建；Node24.14.0/pnpm11.20.0 `verify --stage=full` 通过（unit/integration 109 files/1057 tests、真实 Electron E2E 18 files/120 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、文档治理与 diff-check 通过）；T-M4-013 已完成 Git 收口：提交 `7d93560` 已进入 master，master=origin/master 已核验；任务登记为 done；`practice.listSessions` 保留为历史契约能力但不纳入本轮 renderer 接线；该范围裁决 supersedes v0.1.112 中的“listSessions 接线”描述，历史记录保留；不启动 T-M4-014~021；v0.1.112 登记 T-M4-013 开工：用户明确批准 S3 练习 Tab RPC 接线（createSession + getQuestions + submit + getResult）；任务 pending→in_progress；唯一计划 `.plan/T-M4-013-s3-practice-rpc.md` 与隔离分支 `agent/T-M4-013-s3-practice-rpc` 已建立；测试运行根 `H:\pi-studybuddy-tmp\runs\T-M4-013\`；§9 统计同步 T-M4-012 done 与 T-M4-013 in_progress（M4 9 pending/1 in_progress/13 done→8 pending/1 in_progress/14 done，合计 9/1/49→8/1/50）；不新增 API/handler/schema，不启动 T-M4-014~021，Git 收口另需授权；v0.1.111 T-M4-012 Git 收口完成：功能提交 `2e1e7f6` 已快进进入 master，Node24 master 完整质量门通过，origin/master 已推送并核验，任务登记为 done；不启动 T-M4-013~021（本行历史摘要，T-M4-013 已由 v0.1.112 批准开工）；v0.1.110 T-M4-012 当前实现与证据同步：Node24 `verify --stage=full` 通过（unit 107 files/1047 tests，真实 Electron E2E 17 files/119 tests），两名独立审查复核无 P0/P1；任务仍 in_progress，未执行 Git 收口；v0.1.109 T-M4-012 开工登记：用户批准 NotesTab 局部显式资料选择；任务 pending→in_progress；唯一计划与隔离分支已建立；不启动 T-M4-013~021；v0.1.108 T-M4-011 全部验收完成并获用户最终 Git 收口授权，任务登记为 done；v0.1.107 T-M4-011 target-machine acceptance 已通过，治理 Git 同步待授权，任务继续 in_progress；v0.1.104 T-M4-011 renderer capability transport 修复与 Node24 全量复验，任务继续 in_progress；v0.1.103 T-M4-011 文件导入/storage 与 host 归档写防线修复，任务继续 in_progress；v0.1.102 T-M4-011 Node24.14.0/pnpm11.20.0 基线安装与完整质量门复验，任务继续 in_progress；v0.1.101 T-M4-011 本地实施与交叉审查证据同步，任务继续 in_progress；T-M4-011 pending→in_progress；v0.1.99 T-M4-023 Git 收口完成：功能提交 `92e0bcb` 已快进进入 master，Node 24.14.0 master 完整质量门复验通过，治理同步随后推送并核验 origin/master；v0.1.98 完成 T-M4-023 本地实施与完整验证；v0.1.97 登记 T-M4-023 独立交叉审查问题修订 in_progress；v0.1.0 里程碑划分/任务大纲粒度/task-id 规范/完成门槛四项通过；v0.1.1 追加 §1.4 治理体系就绪状态；v0.1.2 纠正 T-M0-009 跳号笔误；v0.1.3 登记 T-M0-001 完成；v0.1.4 登记 T-M0-002 完成；v0.1.5 登记 T-M0-006 完成；v0.1.6 登记 T-M0-003 完成；v0.1.7 登记 T-M0-004 完成；v0.1.8 登记 T-M0-005 开工；v0.1.9 登记 T-M0-005 完成；v0.1.10 登记 T-M0-007 开工 + §4.1 看板 pi 修正；v0.1.11 登记 T-M0-007 完成 + §4.1 看板 pi 标记阶段1/3 ✅；v0.1.12 登记 T-M0-008 开工；v0.1.13 登记 T-M0-008 完成；v0.1.14 登记 T-M0-009 开工；v0.1.15 登记 T-M0-009 完成 + §6.0 M0 完成与版本演进说明 + 头部版本号滞后修正；v0.1.16 登记 T-M1-001 开工 + 前置 DTO 对齐 schema + §7.2.1 M1 任务登记表；v0.1.17 登记 T-M1-001 完成 + §9 统计 M1 1 done；v0.1.18 登记 T-M1-002 开工 + 前置 DTO 对齐 schema；v0.1.19 登记 T-M1-002 完成 + §9 统计 M1 2 done；v0.1.20 登记 T-M1-003 开工 + §7.2.1 M1 任务登记表；v0.1.21 登记 T-M1-003 完成 + §9 统计 M1 3 done；v0.1.22 登记 T-M1-004 开工 + §7.2.1 M1 任务登记表；v0.1.23 登记 T-M1-004 完成 + §9 统计 M1 4 done；v0.1.24 登记 T-M2-001 完成 + §7.3.1 M2 任务登记表 + §9 统计 M2 1 done；v0.1.25 登记 T-M2-002 完成 + §7.3.1 M2 任务登记表 T-M2-002 done + §9 统计 M2 2 done；v0.1.26 登记 T-M2-003 完成 + §7.3.1 M2 任务登记表 T-M2-003 done + §9 统计 M2 3 done；v0.1.27 登记 T-M2-004 开工 + §7.3.1 M2 任务登记表 T-M2-004 in_progress + §9 统计 M2 3 done + 1 in_progress；v0.1.28 登记 T-M2-004 完成 + §7.3.1 M2 任务登记表 T-M2-004 done + §9 统计 M2 4 done；v0.1.29 登记 T-M2-005 完成 + §7.3.1 M2 任务登记表 T-M2-005 done + §9 统计 M2 5 done；v0.1.30 §9 统计修正 M1 pending 5→6 合计 17→18；v0.1.31 登记待做项 task-id：M1 追加 T-M1-005~010（OCR/WPS COM/资料转换管道/跨切钩子/UI/E2E）+ M2 追加 T-M2-006~009（UUID 泄漏检测/whisper.cpp 真实 Adapter/UI/E2E）全部 pending；v0.1.32 登记 M3 task-id T-M3-001~008 + 新增 §7.5 全局执行顺序表 18 行统一排序 M1/M2/M3 pending；v0.1.33 登记 T-M1-009 开工：§7.2.1 T-M1-009 pending→in_progress + §9 统计 M1 pending 6→5 + in_progress 0→1；v0.1.34 登记 T-M1-009 完成：§7.2.1 T-M1-009 in_progress→done + §9 统计 M1 in_progress 1→0 + done 4→5；v0.1.35 登记 T-M2-008 开工：§7.3.1 T-M2-008 pending→in_progress + §9 统计 M2 pending 4→3 + in_progress 0→1；v0.1.36 登记 T-M2-008 完成：§7.3.1 T-M2-008 in_progress→done + §9 统计 M2 in_progress 1→0 + done 5→6；v0.1.37 登记 T-M1-010 完成：§7.2.1 T-M1-010 pending→done + §6.3 M1 退出门槛全勾选 + §9 统计 M1 done 5→6；v0.1.38 登记 T-M2-009 完成：§7.3.1 T-M2-009 pending→done + §6.4 M2 退出门槛全勾选 + §9 统计 M2 done 6→7；v0.1.39 登记 T-M1-005 开工：§7.2.1 T-M1-005 pending→in_progress + §9 统计 M1 pending 4→3 + in_progress 0→1；v0.1.40 登记 T-M1-005 完成：§7.2.1 T-M1-005 in_progress→done + §9 统计 M1 in_progress 1→0 + done 6→7（合计 in_progress 1→0 + done 22→23）；v0.1.41 登记 T-M1-006 开工：§7.2.1 T-M1-006 pending→in_progress + §9 统计 M1 pending 3→2 + in_progress 0→1（合计 pending 13→12 + in_progress 0→1）；v0.1.42 登记 T-M1-006 完成：§7.2.1 T-M1-006 in_progress→done + §9 统计 M1 in_progress 1→0 + done 7→8（合计 in_progress 1→0 + done 23→24）；v0.1.43 登记 T-M1-007 开工：§7.2.1 T-M1-007 pending→in_progress + §9 统计 M1 pending 2→1 + in_progress 0→1（合计 pending 12→11 + in_progress 0→1））；v0.1.44 登记 T-M1-007 完成：§7.2.1 T-M1-007 in_progress→done + §9 统计 M1 pending 1→0 + in_progress 1→0 + done 8→9（合计 pending 11→10 + in_progress 1→0 + done 24→25）；v0.1.45 登记 T-M1-008 完成：§7.2.1 T-M1-008 pending→done + §9 统计 M1 done 9→10（M1 全部 10 任务完成，pending 0）；v0.1.46 登记 T-M2-006 开工：§7.3.1 T-M2-006 pending→in_progress + §9 统计 M2 pending 2→1 + in_progress 0→1）；v0.1.47 登记 T-M2-006 完成：§7.3.1 T-M2-006 in_progress→done + §9 统计 M2 pending 1→0 + in_progress 1→0 + done 7→8（合计 pending 9→8 + in_progress 1→0 + done 26→27）；v0.1.56 登记 T-M3-004 开工：§7.4.1 T-M3-004 pending→in_progress + §9 统计 M3 pending 5→4 + in_progress 0→1（合计 pending 5→4 + in_progress 0→1）+ 头部版本号滞后修正（v0.1.52→v0.1.56）；v0.1.57 登记 T-M3-004 完成：§7.4.1 T-M3-004 in_progress→done + §9 统计 M3 in_progress 1→0 + done 3→4（合计 in_progress 1→0 + done 31→32）；v0.1.58 登记 T-M3-005 开工：§7.4.1 T-M3-005 pending→in_progress + §9 统计 M3 pending 4→3 + in_progress 0→1；v0.1.59 登记 T-M3-005 完成：§7.4.1 T-M3-005 in_progress→done + §9 统计 M3 in_progress 1→0 + done 4→5（合计 in_progress 1→0 + done 32→33）；v0.1.60 登记 T-M3-006 开工：§7.4.1 T-M3-006 pending→in_progress + §9 统计 M3 pending 3→2 + in_progress 0→1（合计 pending 3→2 + in_progress 0→1）；v0.1.61 登记 T-M3-006 完成：§7.4.1 T-M3-006 in_progress→done + §9 统计 M3 in_progress 1→0 + done 5→6（合计 in_progress 1→0 + done 33→34）；v0.1.62 登记 T-M3-007 开工：§7.4.1 T-M3-007 pending→in_progress + §9 统计 M3 pending 2→1 + in_progress 0→1（合计 pending 2→1 + in_progress 0→1）；v0.1.63 登记 T-M3-007 完成：§7.4.1 T-M3-007 in_progress→done + §9 统计 M3 in_progress 1→0 + done 6→7（合计 in_progress 1→0 + done 34→35）；v0.1.64 登记 T-M3-008 开工：§7.4.1 T-M3-008 pending→in_progress + §9 统计 M3 pending 1→0 + in_progress 0→1（合计 pending 1→0 + in_progress 0→1）；v0.1.65 登记 T-M3-008 完成：§7.4.1 登记表 T-M3-008 in_progress→done + §6.5 M3 退出门槛六项全勾选 + §9 统计 M3 in_progress 1→0 + done 7→8（合计 in_progress 1→0 + done 35→36）；v0.1.66 新增 M4 里程碑（业务接线 + 打包部署）+ §6.6 M4 退出门槛 + §7.6 M4 任务大纲 + §7.6.1 M4 任务登记表 18 任务 + §7.5 全局执行顺序表追加 M4 行 + §9 统计加 M4 行 + 01-TRD v0.2.3 决策 6 修订（打包能力常态化）；v0.1.68 M4 重新规划：重新读系统设计对比代码发现后端 5 处断裂（E2E 全绿但生产不可用）→ M4 任务 18→21（新增 5 个 P0 后端断裂修复 T-M4-001~005）+ §6.6 退出门槛增后端断裂修复项 + §7.6/§7.6.1 大纲与登记表重写 + §7.5 执行顺序表 M4 行 19-36→19-39 重排 + §9 统计 M4 18→21 合计 54→57）
**上游**：[01-TRD v0.2.3](./01-TRD-技术需求-Technical-Requirements.md)、[02-PRD v0.1.3](./02-PRD-产品需求-Product-Requirements.md)、[03-Architecture v0.1.1 §9](./03-架构设计-Architecture-Design.md)、[05-ERD v0.1.1](./05-数据模型-ERD-Data-Model.md)、[06-API v0.1.1](./06-API契约-API-Contracts.md)、[07-Workflow v0.1.1](./07-工作流-Workflow.md)、[08-Test v0.1.2 §11](./08-测试验收-Test-Plan.md)、[09-UI v0.1.2](./09-使用者介面-UI-Design.md)
**用途**：从设计文档到实现代码的执行桥梁——任务登记、组件治理状态跟踪、完成门槛门禁、修复证据记录；v0.1.74 登记 T-M4-022 完成（Electron 生产运行时 / SQLite 兼容修复 + 真实桌面启动验证，前置于 T-M4-006；commit 0ec4163 已推送 origin/master）；v0.1.75 登记 T-M4-006 设置页 UI in_progress（计划待用户审查）；v0.1.78 同步 T-M4-006 双独立复审最终 PASS 与 diff 检查通过，Git 收口未授权故保持 in_progress；v0.1.91 登记 T-M4-009 Git 收口完成

---

## 1. 概述

### 1.1 文档定位

04-Todo 是 pi-studybuddy 从"设计定案"走向"代码实现"的执行操作文档。它不重复设计文档的内容，而是：

- **登记**：每个开发任务有唯一 task-id，记录其分类、优先级、状态、关联文档
- **跟踪**：每个组件在五阶段组件治理中的当前位置（下载储存→单件→集成→组装→冒烟E2E）
- **门禁**：定义每个阶段的进入/退出条件和合并到 master 的门槛
- **取证**：冒烟失败修复记录写本文件作为证据（08-Test §11.3）

### 1.2 与其他文档的关系

```
设计定案层                    执行操作层                   代码实现层
┌─────────────┐              ┌───────────┐              ┌──────────┐
│ 01-TRD 定案  │              │           │              │ src/     │
│ 02-PRD       │ ──推导任务──→ │ 04-Todo   │ ──指导开发──→ │ tests/   │
│ 03-Arch      │              │           │              │ scripts/ │
│ 05-ERD       │              │           │              └──────────┘
│ 06-API       │              └───────────┘
│ 07-Workflow  │                   ↑
│ 08-Test      │              修复证据回写（§8）
│ 09-UI 定案   │              （08-Test §11.3）
└─────────────┘
```

### 1.3 任务铁律

1. **五阶段不可跳越**：任何组件必须走完下载储存→单件→集成→组装→冒烟E2E 五阶段（00 索引 §四）
2. **任一阶段失败退回上一阶段**：不进 master（08-Test §11.2）
3. **task-id 全局唯一**：运行数据隔离 `H:\pi-studybuddy-tmp\runs\<task-id>` 依赖此 id（00 索引 §五）
4. **壳层先于业务**：装配顺序 main+preload+renderer+agent-host+contract → 公用零件 → 业务模块（03-Architecture §9.2）
5. **修复留证据**：冒烟失败修复记录写 §8，可审计可追溯
6. **任务状态实时更新**：任务状态变更同步到本文件，不另立跟踪系统

### 1.4 治理体系就绪状态（M0 启动前置）

> 截至 2026-08-07，pi-studybuddy 治理体系已全部就绪，可启动 M0 骨架开发。

| 类别 | 资产 | 状态 |
|---|---|---|
| 仓库宪章 | [AGENTS.md](../AGENTS.md) v0.1.0 | ✅ 已审查批准 |
| 项目总览 | [README.md](../README.md) v0.1.0 | ✅ 已审查批准 |
| 开发规范 | [docs/10-开发规范](../docs/10-开发规范-Dev-Rules.md) v0.1.0 | ✅ 已审查批准 |
| 组件装配 | [docs/11-组件装配](../docs/11-组件装配-Component-Assembly.md) v0.1.0 | ✅ 已审查批准 |
| 目录治理 | [docs/12-目录治理](../docs/12-目录治理-Directory-Governance.md) v0.1.0 | ✅ 已审查批准 |
| 治理 Skills | [.pi/skills/studybuddy-task-complete](../.pi/skills/studybuddy-task-complete/SKILL.md) + [studybuddy-component-assembly](../.pi/skills/studybuddy-component-assembly/SKILL.md) | ✅ 已创建 |
| 工作流模板 | [.pi/prompts/wr.md](../.pi/prompts/wr.md) + [plan.md](../.pi/prompts/plan.md) | ✅ 已创建 |
| 治理脚本 | [scripts/verify.mjs](../scripts/verify.mjs) + [check-docs-governance.mjs](../scripts/check-docs-governance.mjs) + [check-contract-coverage.mjs](../scripts/check-contract-coverage.mjs) | ✅ 已创建并试运行通过（design 阶段） |
| 任务计划目录 | [.plan/](../.plan/) | ✅ 已就绪（无执行中任务） |
| 实施记录目录 | [.record/](../.record/) | ✅ 已就绪（空，待 M0 首任务收尾写入） |

**启动 M0 的前置条件已全部满足**：
- 设计阶段 10 文档全部 ✅ 已审查批准（详见 [00-索引 §七](../docs/00-文档索引-Index.md)）
- 治理体系 5 类资产全部就绪
- 用户已批准治理体系（分五批推进，全部审查通过）

**下一步**：等待用户明确选择 M0 首个任务（建议 `T-M0-001 Electron 四进程骨架`）并批准开工。

---

## 2. 任务登记规范

### 2.1 task-id 命名规则

```
T-<里程碑>-<序号>

里程碑：M0（骨架）/ M1（核心闭环）/ M2（完整闭环）/ M3（对话与打磨）
序号：三位数字，按里程碑内登记顺序递增

示例：T-M0-001、T-M1-042、T-M3-103
```

### 2.2 任务字段

每个任务登记以下字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `task-id` | string | 唯一标识（§2.1 规则） |
| `标题` | string | 中文简述，一行内说清做什么 |
| `分类` | enum | 壳层 / 扩展层 / 业务Adapter / 数据层 / 测试 / 文档 |
| `子系统` | enum | S1-S7 / TTS / 备份恢复 / 对话 / 壳 / 跨切 |
| `优先级` | enum | P0（阻塞）/ P1（必须）/ P2（应该）/ P3（可选） |
| `状态` | enum | pending / in_progress / testing / done / blocked |
| `治理阶段` | enum | 阶段1-5（当前所处五阶段位置） |
| `关联文档` | string | 依据的设计文档章节（如 03-Arch §6.1） |
| `产物` | string | 完成后产出的文件/模块 |
| `证据` | string | 测试通过截图/日志链接、修复记录（§8 引用） |
| `备注` | string | 阻塞原因、依赖关系等 |

### 2.3 任务状态机

```
pending → in_progress → testing → done
              ↑              │
              │              ↓
              └──── blocked ──┘
                  （修复后回 in_progress）
```

| 状态 | 含义 | 进入条件 |
|---|---|---|
| `pending` | 未开始 | 任务登记后默认 |
| `in_progress` | 开发中 | 开始编码 |
| `testing` | 测试中 | 代码完成，进入五阶段测试 |
| `done` | 已完成 | 五阶段全通过 + 合并门槛满足（§5） |
| `blocked` | 阻塞 | 依赖未就绪 / 测试失败退回修复 |

---

## 3. 任务分类体系

### 3.1 按架构层分类（03-Architecture §1 四层架构）

| 分类 | 范围 | 装配顺序 |
|---|---|---|
| **壳层** | main + preload + renderer + agent-host + contract + 安全沙箱 + toolchain + credential-vault + file-watch | 第 1 位（03-Arch §9.2） |
| **扩展层** | studybuddy-extension（registerTool + pi.on 钩子 + pi-ai provider） | 第 2 位 |
| **业务 Adapter** | S1-S7 工具 + TTS + 备份恢复 + WPS COM/whisper.cpp/OCR 桥 + workspace-path-guard | 第 3 位 |
| **数据层** | global.db + semester.db + 三层记忆 + credential-vault 存储 + 备份 zip | 与壳层并行 |

### 3.2 按子系统分类（02-PRD §3 业务闭环）

| 子系统 | 业务 | 关键文档 |
|---|---|---|
| **S1** | 学习节奏（学期/课程/考试/课表/任务/每日首页） | 07-Workflow §2.2 |
| **S2** | 资料笔记（上传/转换/AI笔记/知识模块/导图） | 07-Workflow §2.3 |
| **S3** | 限时练习（出题/作答/规则批改/结果） | 07-Workflow §2.4 |
| **S4** | 错题改错（幂等归档/错因/重做/薄弱点） | 07-Workflow §2.5 |
| **S5** | 期末冲刺（模拟考/速背卡/冲刺计划） | 07-Workflow §2.6 |
| **S6** | 家长报告（规则生成/冻结/脱敏/投递） | 07-Workflow §3 |
| **S7** | 课堂采集（许可确认/PCM WAV/whisper.cpp/handoff） | 07-Workflow §2.7 |
| **TTS** | 跨子系统朗读（SAPI/edge-tts/控制条/已复习标记） | 07-Workflow §4 |
| **备份恢复** | 手动/定期/归档备份 + 恢复 | 07-Workflow §5 |
| **对话** | 💬 对话 Tab（pi 原生 AI 对话默认主入口） | 07-Workflow §2.8 |
| **壳** | Electron 壳 + 五件骨架 | 03-Arch §6 |
| **跨切** | 安全不变量 / observability / 调度层 | 03-Arch §7-§8 |

### 3.3 按装配阶段分类（03-Architecture §9.1 五阶段）

| 阶段 | 内容 | 产物 |
|---|---|---|
| **1. 下载储存** | pi / pi-skills / pi-desktop / inno-agent / OCR venv / whisper.cpp | `H:\pi-references\*` + `node_modules` + venv |
| **2. 单件测试** | 每个工具契约断言 / 每个引入技能夹具 / 外部桥 Adapter | 独立冒烟 + 合成夹具 |
| **3. 集成测试** | extension×pi 底座 / 工具×pi.on 钩子 / createAgentSession | 契约验证 |
| **4. 系统配件组装** | 进入主仓 src/ + ~/.pi/agent/skills/ | Adapter/扩展代码 |
| **5. 冒烟 + E2E** | S1-S7 全链路 / TTS / 备份恢复 / 脱敏 / 安全不变量 | 全链回归 |

---

## 4. 组件治理状态看板

### 4.1 看板格式

每个组件跟踪其在五阶段中的当前位置：

| 组件 | 阶段1 下载 | 阶段2 单件 | 阶段3 集成 | 阶段4 组装 | 阶段5 冒烟E2E | 状态 |
|---|---|---|---|---|---|---|
| `pi`（npm dependencies） | ✅ | — | ✅ | — | — | T-M0-007 已安装 + 集成契约验证 |
| `pi-skills`（git clone） | ✅ | — | — | — | — | 已下载 |
| `pi-desktop` 骨架 | ✅ | — | — | — | — | 已下载 |
| `inno-agent` 范本 | ✅ | — | — | — | — | 已下载 |
| OCR venv | ✅ | — | — | — | — | 已下载 |
| whisper.cpp | ✅ | — | — | — | — | 已下载 |
| WPS COM 桥 | — | — | — | — | — | 待启动 |
| ... | | | | | | |

> 阶段标记：✅ 通过 / ⏳ 进行中 / ❌ 失败待修复 / — 未进入 / ⏭️ 跳过（不适用）

### 4.2 组件清单（初始，随开发推进动态更新）

**参考仓库组件**（阶段1 已完成）：
- `pi`（`@earendil-works/pi-coding-agent`）—— AI 底座
- `pi-skills`（badlogic）—— transcribe / browser-tools / youtube-transcript
- `pi-desktop`（DLYZZT）—— 五件骨架范本
- `inno-agent`（hhyqhh）—— 架构范本

**自建组件**（需走五阶段）：
- 桌面壳五件：contract / host-manager / credential-vault / toolchain / file-watch
- pi 扩展层：studybuddy-extension（registerTool + pi.on 钩子）
- 业务工具：S1-S7 全量 registerTool 工具（约 30 个）
- TTS skill：SAPI + edge-tts
- 备份恢复：zip 打包 + 恢复 + 调度
- 外部桥：WPS COM（pywin32）/ whisper.cpp / OCR venv
- 安全脚本：check-desktop-security.mjs（六条不变量）

---

## 5. 完成门槛（门禁）

### 5.1 五阶段进入/退出条件（03-Arch §9.1 + 08-Test §11.2）

| 阶段 | 进入条件 | 退出条件（门槛） |
|---|---|---|
| **1. 下载储存** | 组件已识别 | 组件在 `H:\pi-references\*` 或 `node_modules` / venv 中可用 |
| **2. 单件测试** | 阶段1 完成 | 独立冒烟通过 + 合成夹具断言全过（08-Test §3） |
| **3. 集成测试** | 阶段2 完成 | extension×pi 底座契约验证通过 + 钩子协作断言全过（08-Test §4） |
| **4. 系统组装** | 阶段3 完成 | 代码进入主仓 src/ + 类型检查通过 + lint 通过 |
| **5. 冒烟+E2E** | 阶段4 完成 | 系统冒烟通过 + 受影响 E2E 通过 + 安全不变量六条全过（08-Test §5） |

### 5.2 合并到 master 的门槛（08-Test §11.1）

- [ ] 全部单件测试通过（vitest + pytest）
- [ ] 全部集成测试通过
- [ ] 系统冒烟全部通过
- [ ] 安全不变量校验脚本六条断言全过
- [ ] 受影响子系统的 E2E 通过
- [ ] `git diff --check` 无空白错误
- [ ] 不提交：真实密钥/.env.local/资料原文/完整 UUID/node_modules

### 5.3 退回机制（08-Test §11.2）

```
阶段2 单件失败 → 修复组件 → 重跑单件（不退回阶段1）
阶段3 集成失败 → 退回单件 → 重跑集成
阶段5 冒烟/E2E 失败 → 退回集成 → 重跑冒烟
```

**退回时**：
- 任务状态改为 `blocked`
- 修复记录写入 §8
- 修复后状态改回 `in_progress`，重走当前阶段

---

## 6. 里程碑规划

> 依据 03-Architecture §9.2 装配顺序（壳层→公用零件→业务模块）+ ai-studybuddy 已验证 S1-S7 业务认知。

### 6.0 M0 完成与版本演进说明（01-TRD §7 决策 6 约定）

**M0 骨架搭建已于 2026-08-07 完成**（T-M0-001 ~ T-M0-009 全部 done）。

**退出门槛六项全部通过**（§6.2 + 08-Test §5）：
- ✅ Electron 应用可启动（build 产物齐全 + main 入口可加载，`pnpm dev` 人工验证）
- ✅ contract RPC 可 renderer→main→agent-host 往返（`system.ping` 冒烟通过）
- ✅ global.db + semester.db 可建库（4 表 + 25 表 + integrity_check 通过）
- ✅ credential-vault 可加密/解密往返（safeStorage set→get 一致 + 磁盘无明文 + 键名校验）
- ✅ 安全不变量校验脚本六条全过（INV-01~06 硬断言，T-M0-009 补全 INV-06）
- ✅ M0 系统冒烟通过（`pnpm smoke` 六项全过，退出码 0）

**版本演进**（01-TRD §7 决策 6 v0.2.3：源码形态可运行 + 打包能力常态化，supersedes v0.2.2 "不打包 .exe"）：
- v0.1 交付：源码形态运行（`pnpm install && pnpm dev`）用于开发审计，**同时必须具备可打包为 x64 setup 安装包的能力**
- 依据：用户 2026-08-08 明确指令"系统不管什么时候，只要功能正常，就要能够被打包"。AGENTS.md §1.2"禁用运行级使用"指 AI 运行级使用，不阻止系统打包部署
- 打包工具链（electron-builder）纳入 M4 里程碑（T-M4-016/017），实际打包动作按需执行

**M0 交付的九个任务**（详见 §7.1.1 登记表）：
| task-id | 标题 | commit |
|---|---|---|
| T-M0-001 | Electron 四进程骨架 + 自研 RPC + 最小 contract | 37e85e6 |
| T-M0-002 | contract 类型化契约面（api 126 方法 + types + streams + PiBridge） | 53942d8 |
| T-M0-003 | credential-vault（safeStorage/DPAPI 密钥库） | fb76ecf |
| T-M0-004 | toolchain 发现-探测-安装-绝对路径执行框架 | edb181b |
| T-M0-005 | file-watch（fs.watch recursive + 100ms 防抖） | 47a2357 |
| T-M0-006 | 数据层 schema（global.db + semester.db + L3 三层记忆） | de70670 |
| T-M0-007 | studybuddy-extension 空壳 | b0d7d55 |
| T-M0-008 | 09-UI 三栏布局 + 标签页骨架 | 034969c |
| T-M0-009 | M0 系统冒烟完整 | （本任务） |

### 6.1 里程碑总览

```
M0 骨架搭建          M1 核心闭环 MVP      M2 完整闭环          M3 对话与打磨
┌──────────┐        ┌──────────┐        ┌──────────┐        ┌──────────┐
│ Electron │        │ S1 学期   │        │ S5 冲刺   │        │ 💬 对话   │
│ 四进程   │ ──→   │ S2 笔记   │ ──→   │ S6 报告   │ ──→   │ 安全不变量│
│ 五件骨架 │        │ S3 练习   │        │ S7 采集   │        │ E2E 全链  │
│ 数据层   │        │ S4 错题   │        │ TTS/备份  │        │ 优化打磨  │
└──────────┘        └──────────┘        └──────────┘        └──────────┘
```

### 6.2 M0：骨架搭建

**目标**：Electron 桌面壳可启动，数据层 schema 可建库，contract RPC 可通

**范围**：
- Electron 四进程骨架（main + preload + renderer + agent-host）
- contract 类型化 IPC + RPC 层
- 安全沙箱（sandbox:true + 严格 CSP + preload 受控桥接）
- toolchain 发现（Node/Python/uv/Git/WPS/whisper.cpp）
- credential-vault（safeStorage/DPAPI）
- file-watch（fs.watch recursive + 100ms 防抖）
- 数据层基础（global.db schema + semester.db schema + 三层记忆 schema + PRAGMA）
- pi 扩展层空壳（createStudyBuddyExtension 可 setup 但无业务工具）
- 09-UI 三栏布局 + 标签页骨架（无业务内容）

**退出门槛**：
- [ ] Electron 应用可启动
- [ ] contract RPC 可 renderer→main→agent-host 往返
- [ ] global.db + semester.db 可建库
- [ ] credential-vault 可加密/解密往返
- [ ] 安全不变量校验脚本六条全过
- [ ] M0 系统冒烟通过

### 6.3 M1：核心闭环 MVP

**目标**：S1→S2→S3→S4 最小可用学习闭环可走通

**范围**：
- S1 学期初始化（建学期/课程/课表 OCR/考试确认/每日首页）
- S2 资料笔记（上传/转换/AI 笔记生成/知识模块/导图）
- S3 限时练习（出题/作答/规则批改/结果展示）
- S4 错题改错（幂等归档/错因建议/学生确认/重做/薄弱点）
- WPS COM 桥（doc/ppt/xls 转换）
- OCR venv Adapter
- studybuddy-extension 业务工具注册（S1-S4 工具）
- 09-UI S1-S4 标签页业务 UI

**退出门槛**：
- [x] S1-S4 全链路冒烟通过
- [x] E2E-01~03 通过
- [x] 作答前 DTO 防泄露断言通过
- [x] 幂等归档断言通过
- [x] AI 失败降级规则输出断言通过

### 6.4 M2：完整闭环

**目标**：S1-S7 + TTS + 备份恢复全链路可走通

**范围**：
- S5 期末冲刺（模拟考/速背卡/冲刺计划）
- S6 家长报告（规则生成/冻结/脱敏/投递）
- S7 课堂采集（许可确认/PCM WAV/whisper.cpp/handoff）
- TTS 跨子系统（SAPI + edge-tts + 控制条 + 已复习标记）
- 备份恢复（手动/定期/归档/恢复 + content_hash + integrity_check）
- whisper.cpp Adapter
- studybuddy-extension 业务工具注册（S5-S7 + TTS + 备份恢复工具）
- 09-UI S5-S7 + TTS + 备份恢复 UI

**退出门槛**：
- [x] S1-S7 全链路冒烟通过
- [x] E2E-01~09 通过
- [x] 家长报告 UUID 泄漏检测通过
- [x] TTS 跨子系统朗读冒烟通过
- [x] 备份恢复 content_hash + integrity_check 通过
- [x] 投递渠道独立失败隔离通过

### 6.5 M3：对话与打磨

**目标**：💬 对话 Tab 默认主入口可用，安全/性能/体验打磨完成

**范围**：
- 💬 对话 Tab（pi 原生 AI 对话默认主入口）
- pi 原生能力承载（流式回复/工具调用视图/上下文压缩/@文件引用/多模型切换）
- 学习场景业务化（学科标签/学习目标/错题关联/L1 画像注入/L3 会话检索）
- AI 自主调用工具（S1-S7 + TTS + 备份恢复全部工具）
- 工具调用跳转（对话→结构化 Tab）
- 安全不变量校验脚本完善
- E2E 全链回归（E2E-01~13）
- 性能优化 / 体验打磨

**退出门槛**：
- [x] E2E-10~13 对话 Tab 全通过（T-M3-007 交付，T-M3-008 回归确认 110 E2E 全绿）
- [x] 应用启动默认打开对话 Tab（T-M3-001 交付，T-M3-008 回归确认）
- [x] AI 自主调用工具 + 跳转结构化 Tab（T-M3-004 交付，T-M3-008 回归确认）
- [x] @文件引用 + TTS 朗读 + L3 会话检索（T-M3-002~005 交付，T-M3-008 回归确认）
- [x] 全部 E2E-01~13 通过（T-M3-008 本任务：14 文件 110 用例全绿）
- [x] v0.1 发布候选（T-M3-008 全链回归 + 安全不变量 6/6 + UUID 泄漏 7/7 最终校验通过，§11.4 交叉审查无阻塞性洞）

### 6.6 M4：后端断裂修复 + 业务接线 + 打包部署

**目标**：修复后端 5 处断裂（E2E 全绿但生产不可用）+ 前端业务 Tab 全面接线 + 设置页/学期切换 UI 补齐 + 系统具备打包为 x64 setup 安装包能力

**背景**：M3 收官后重新读系统设计（03-Arch/06-API/09-UI）对比代码，发现后端存在 5 处断裂——E2E 全绿但生产不可用：
1. agent-host 生产入口只装配 6 类 handler（system/toolchains/files/models/sessions/agent），S1-S7/TTS/Backup 9 类 handler 工厂存在但未 import/装配（test-main.js 装配了全部，导致 E2E 绿但生产报 method not found）
2. studybuddy-extension.ts 定义了 35 工具 + 6 钩子但无生产调用，03-Arch §6.2 设计的 extension-loader 不存在
3. agent.send 是受控夹具发射（假 TOKEN_FRAGMENTS），没接真实 pi createAgentSession
4. main.ts 未初始化 global.db（首次启动不建库）
5. credentials.*/settings.* handler 完全不存在（contract/api.ts 定义了 8 个方法但无实现）

前端缺失：设置页 UI + 学期/课程切换 UI + S1-S7 业务 Tab RPC 接线 + TTS/备份恢复面板接线。打包缺失：electron-builder 未配置（01-TRD §7 决策 6 v0.2.3 要求打包能力常态化）。

**范围**：
- P0 后端断裂修复（5 任务）：数据根初始化 + handler 装配 + credentials/settings handler + extension 接入 pi 内核 + agent.send 接真实 pi
- P0 基础 UI（3 任务）：设置页 + 学期/课程切换 + AppShell 数据流重构
- P0.5 打包链路验证（1 任务）：electron-builder 配置 + 首次 x64 setup 产出
- P1 核心闭环接线（5 任务）：S1 首页 + S2 资料 + S2 笔记 + S3 练习 + S4 错题
- P2 完整闭环接线（3 任务）：S5 冲刺 + S6 报告 + S7 采集
- P3 辅助（2 任务）：TTS 控制条 + 备份恢复面板
- P4 收尾（2 任务）：E2E 全链回归 + M4 收官验收

**退出门槛**：
- [ ] 后端 5 处断裂全部修复（生产入口装配全部 handler + extension 接入 pi 内核 + agent.send 真实流式 + global.db 初始化 + credentials/settings handler）
- [ ] 设置页可用（AI provider 配置 + 密钥 vault + 工具链检查 + 学习偏好）
- [ ] 学期/课程切换 UI 可用（左侧栏学期树 + 标题栏动态绑定 + AppShell 传递 semesterId/courseId）
- [ ] S1-S7 全部业务 Tab 前端 RPC 接通
- [ ] TTS 控制条 + 备份恢复面板 RPC 接通 + BackupPanel 可达
- [ ] 全链 E2E 回归通过（E2E-01~13 + 新增后端断裂修复/设置页/学期切换 E2E）
- [ ] electron-builder x64 setup 安装包产出 + 安装冒烟通过
- [ ] 安全不变量 6/6 + UUID 泄漏 7/7 最终校验通过

---

## 7. 任务登记表

> 任务在实际开发中动态登记。以下为各里程碑的任务大纲（基于 03-Architecture §9.1 五阶段×架构组件推导），细化到 task-id 在开发启动时补全。

### 7.1 M0 骨架搭建任务大纲

| 分类 | 任务大纲 | 关联文档 | 治理阶段 |
|---|---|---|---|
| 壳层 | Electron 项目初始化（main + preload + renderer + agent-host） | 03-Arch §6.1 | 阶段4 |
| 壳层 | contract 类型化 IPC + RPC 层（createRpcServer/createRpcClient） | 03-Arch §6.3 + 06-API §1.2 | 阶段3-4 |
| 壳层 | 安全沙箱（sandbox:true + CSP + preload 受控桥接） | 03-Arch §6.4 + 08-Test §5.7 | 阶段4-5 |
| 壳层 | toolchain 发现（Node/Python/uv/Git/WPS/whisper.cpp 探测） | 03-Arch §6.5 | 阶段2-4 |
| 壳层 | credential-vault（safeStorage/DPAPI 加密存储） | 03-Arch §6.4 + 08-Test §5.6 | 阶段2-5 |
| 壳层 | file-watch（fs.watch recursive + 防抖） | 03-Arch §6.6 | 阶段2-4 |
| 数据层 | global.db schema 建库（semesters/parent_report_targets/backup_records/backup_schedules） | 05-ERD §2 | 阶段2-4 |
| 数据层 | semester.db schema 建库（S1-S7 全量表 + 触发器 + CHECK + 索引） | 05-ERD §3 + §6 | 阶段2-4 |
| 数据层 | 三层记忆 schema（L1 JSON / L2 BM25+图谱 / L3 FTS5） | 05-ERD §4 + 03-Arch §4 | 阶段2-4 |
| 扩展层 | studybuddy-extension 空壳（createStudyBuddyExtension 可 setup 无工具） | 03-Arch §2.1 | 阶段3 |
| 壳层 | 09-UI 三栏布局 + 标签页骨架（AppShell + TabBar 空壳） | 09-UI §2-§4 | 阶段4 |
| 测试 | M0 系统冒烟（应用启动 + RPC 往返 + 建库 + 安全不变量六条） | 08-Test §5 | 阶段5 |

### 7.1.1 M0 任务登记表（随开发动态更新）

| task-id | 标题 | 分类 | 优先级 | 状态 | 治理阶段 | 关联文档 | 证据 |
|---|---|---|---|---|---|---|---|
| T-M0-001 | Electron 四进程骨架 + 自研 RPC + 最小 contract | 壳层 | P1 | done | 阶段5 | 03-Arch §6 + §9.2 + 08-Test §5.7 | [.record/T-M0-001 实施记录](../.record/T-M0-001-实施记录.md) |
| T-M0-002 | contract 类型化 IPC + RPC 完整接口 | 壳层 | P1 | done | 阶段5 | 03-Arch §6.3 + 06-API §1.2-§5 | [.record/T-M0-002 实施记录](../.record/T-M0-002-实施记录.md) |
| T-M0-003 | credential-vault（safeStorage/DPAPI 密钥库） | 壳层 | P1 | done | 阶段5 | 03-Arch §4.5 + 06-API §3.15 + 01-TRD §9.2 + 08-Test §5.6-§5.7 | [.record/T-M0-003 实施记录](../.record/T-M0-003-实施记录.md) |
| T-M0-006 | 数据层 schema（global.db + semester.db + 三层记忆） | 数据层 | P1 | done | 阶段5 | 05-ERD §1-§10 + 03-Arch §4 + 08-Test §3.2 + §5.4 | [.record/T-M0-006 实施记录](../.record/T-M0-006-实施记录.md) |
| T-M0-004 | toolchain 发现-探测-安装-绝对路径执行框架 | 壳层 | P1 | done | 阶段5 | 03-Arch §6.5 + 06-API §3.16 + 01-TRD §7 决策 1 | [.record/T-M0-004 实施记录](../.record/T-M0-004-实施记录.md) |
| T-M0-005 | file-watch（fs.watch recursive + 100ms 防抖 → Streams["files.changed"]） | 壳层 | P1 | done | 阶段5 | 03-Arch §6.5/§6.6 + 06-API §3.2/§4 | [.record/T-M0-005 实施记录](../.record/T-M0-005-实施记录.md) |
| T-M0-007 | studybuddy-extension 空壳（createStudyBuddyExtension 可 setup 无工具） | 扩展层 | P1 | done | 阶段3 | 03-Arch §2.1/§2.2 + pi ExtensionFactory 契约 | [.record/T-M0-007 实施记录](../.record/T-M0-007-实施记录.md) |
| T-M0-008 | 09-UI 三栏布局 + 标签页骨架（AppShell + TabBar 空壳） | 壳层 | P1 | done | 阶段4 | 09-UI §2-§4 | [.record/T-M0-008 实施记录](../.record/T-M0-008-实施记录.md) |
| T-M0-009 | M0 系统冒烟完整（应用启动 + RPC 往返 + 建库 + 安全不变量六条） | 测试 | P1 | done | 阶段5 | 08-Test §5 + §5.7 + 04-Todo §6.2 | [.record/T-M0-009 实施记录](../.record/T-M0-009-实施记录.md) |

### 7.2 M1 核心闭环 MVP 任务大纲

| 分类 | 子系统 | 任务大纲 | 关联文档 | 治理阶段 |
|---|---|---|---|---|
| 业务Adapter | S1 | 学期/课程/考试/课表/任务 工具注册 + API | 07-WF §2.2 + 06-API §3.3 | 阶段2-4 |
| 业务Adapter | S1 | OCR venv Adapter（课表图片识别） | 03-Arch §3.3 + 08-Test §3.3 | 阶段2-3 |
| 业务Adapter | S2 | 资料/笔记/知识模块 工具注册 + API | 07-WF §2.3 + 06-API §3.4 | 阶段2-4 |
| 业务Adapter | S2 | WPS COM 桥（doc/ppt/xls 转换） | 03-Arch §3.3 + 08-Test §3.3.1 | 阶段2-3 |
| 业务Adapter | S2 | 资料转换管道（PDF/DOCX/PPTX/图片 OCR） | 07-WF §2.3 | 阶段2-4 |
| 业务Adapter | S3 | 练习会话/出题/作答/批改 工具注册 + API | 07-WF §2.4 + 06-API §3.5 | 阶段2-4 |
| 业务Adapter | S4 | 错题/薄弱点 工具注册 + API | 07-WF §2.5 + 06-API §3.6 | 阶段2-4 |
| 扩展层 | 跨切 | before_agent_start / session_start / tool_call / tool_result 钩子 | 03-Arch §2.3 + 08-Test §4.2 | 阶段3 |
| 壳层 | S1-S4 | 09-UI S1-S4 标签页业务 UI | 09-UI §4.3-§4.7 | 阶段4 |
| 测试 | S1-S4 | E2E-01~03（学期初始化/资料笔记/练习→错题→薄弱点） | 08-Test §6.1 | 阶段5 |

### 7.2.1 M1 任务登记表（随开发动态更新）

| task-id | 标题 | 分类 | 优先级 | 状态 | 治理阶段 | 关联文档 | 证据 |
|---|---|---|---|---|---|---|---|
| T-M1-001 | S1 学期/课程/考试/课表/任务 工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §2.2 + 06-API §3.3 + 03-Arch §3.1 + 05-ERD §3.1 + 08-Test §3.1/§3.2 | [.record/T-M1-001 实施记录](../.record/T-M1-001-实施记录.md) |
| T-M1-002 | S2 资料/笔记/知识模块 工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §2.3 + 06-API §3.4 + 03-Arch §3.1 + 05-ERD §3.2 + 08-Test §3.1/§3.2 | [.record/T-M1-002 实施记录](../.record/T-M1-002-实施记录.md) |
| T-M1-003 | S3 限时练习 工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §2.4 + 06-API §3.5 + 03-Arch §3.1 + 05-ERD §3.3 + 08-Test §3.1/§3.2 | [.record/T-M1-003 实施记录](../.record/T-M1-003-实施记录.md) |
| T-M1-004 | S4 错题/薄弱点 工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §2.5 + 06-API §3.6 + 03-Arch §3.1 + 05-ERD §3.4 + 08-Test §3.1/§3.2 | [.record/T-M1-004 实施记录](../.record/T-M1-004-实施记录.md) |
| T-M1-005 | OCR venv Adapter（课表图片识别） | 业务Adapter | P1 | done | 阶段2-5 | 03-Arch §3.3 + 08-Test §3.3 | [.record/T-M1-005 实施记录](../.record/T-M1-005-实施记录.md) — OCR venv Adapter：Python 桥 ocr_bridge.py（RapidOCR stdin/stdout JSON 协议）+ pytest 7 图格式参数化真实识别 + OcrAdapter 可注入三态（mock/failing/real）+ handleOcrSchedule 路径校验 + studybuddy_ocr_schedule 工具注册（工具数 34→35）+ 错误固定文案不泄漏路径/stdout/stderr |
| T-M1-006 | WPS COM 桥（doc/ppt/xls 转换） | 业务Adapter | P1 | done | 阶段2-5 | 03-Arch §3.3 + 08-Test §3.3.1 | [.record/T-M1-006 实施记录](../.record/T-M1-006-实施记录.md) — WPS COM 桥：pywin32 子进程经 WPS COM（KWPS/KET/KWPP.Application）doc→docx/ppt→pptx/xls→xlsx 中间格式 + pytest 5 用例（三格式真实转换归一化 JSON + 崩溃隔离 + JSON 协议）+ WpsAdapter 可注入三态（mock/failing/real）+ 接入 materials.convert/retryConversion 的 wps_convert 真实转换（成功 Material→converted + Job→completed；失败 conversion_failed + Job→failed；不写 normalized_texts 属 T-M1-007）+ 错误固定文案不泄漏路径/stdout/stderr + 数据隔离 runs/T-M1-006 |
| T-M1-007 | 资料转换管道（PDF/DOCX/PPTX/图片 OCR） | 业务Adapter | P1 | done | 阶段1-5 | 07-WF §2.3 + 03-Arch §5.3 + 05-ERD §3.2.2 + 08-Test §3.3.2 | [.record/T-M1-007 实施记录](../.record/T-M1-007-实施记录.md) — TextExtractor 三态（mock/failing/real）+ Node 库 pdf-parse/jszip/mammoth 真实提取（pdf/docx/pptx/xlsx）+ OcrAdapter 复用接入 ocr_image + materials.convert/retryConversion 按 job_type 分派提取/OCR + 成功写 normalized_texts（content_hash/char_count/source_type/先删后插幂等）+ Material→converted + 失败 conversion_failed + Job→failed（error_message 固定文案）+ wps_convert 补齐中间格式文本提取 + 合成夹具单件（jszip 构建 OOXML + 受控 pdf）+ 错误固定文案不泄漏路径/stdout/stderr + 数据隔离 runs/T-M1-007 |
| T-M1-008 | 跨切钩子（before_agent_start/session_start/tool_call/tool_result 业务级逻辑） | 扩展层 | P1 | done | 阶段3 | 03-Arch §2.3 + 08-Test §4.2 | [.record/T-M1-008 实施记录](../.record/T-M1-008-实施记录.md) — 4 个 pi.on 生命周期钩子：workspace-path-guard（normalizeToolPath + checkWorkspaceMutationPath，realpath 符号链接逃逸拦截）+ before_agent_start 多源上下文注入（L1 画像/激活学期课程/最近事件）+ session_start 初始化学期库/L1 目录 + tool_result 集中错误日志（observability 脱敏，errorCode 提取 + UNKNOWN_TOOL_ERROR 回退）+ 符号链接逃逸拦截（08-Test §4.2）+ 35 测试全绿（799 单元/集成 + 80 E2E）+ M1 退出门槛全通过 |
| T-M1-009 | 09-UI S1-S4 标签页业务 UI | 壳层 | P1 | done | 阶段4 | 09-UI §4.3-§4.7 | 5 Tab + 5 公共组件 + rpc-client + AppShell 路由 + 58 测试（防泄露+隐私边界+六分类+AI 不确定标记）|
| T-M1-010 | E2E-01~03（学期初始化/资料笔记/练习→错题→薄弱点） | 测试 | P1 | done | 阶段5 | 08-Test §6.1 | [.record/T-M1-010 实施记录](../.record/T-M1-010-实施记录.md) — 3 E2E 文件 36 测试 + child_process.fork + Node.js IPC + 防泄露铁律 + 幂等归档 + 薄弱点 evidence_count≥2 + 规则批改可证伪 + M1 退出门槛全通过 |

### 7.3 M2 完整闭环任务大纲

| 分类 | 子系统 | 任务大纲 | 关联文档 | 治理阶段 |
|---|---|---|---|---|
| 业务Adapter | S5 | 模拟考/速背卡/冲刺计划 工具注册 + API | 07-WF §2.6 + 06-API §3.7 | 阶段2-4 |
| 业务Adapter | S6 | 家长报告/投递/报告目标 工具注册 + API | 07-WF §3 + 06-API §3.8 | 阶段2-4 |
| 业务Adapter | S6 | assertNoSensitiveLeak UUID 泄漏检测 | 03-Arch §8.2 + 08-Test §5.4 | 阶段2-5 |
| 业务Adapter | S7 | 课堂采集/whisper.cpp Adapter 工具注册 + API | 07-WF §2.7 + 06-API §3.9 | 阶段2-4 |
| 业务Adapter | S7 | whisper.cpp Adapter（PCM WAV 转写） | 03-Arch §3.3 + 08-Test §3.3.2 | 阶段2-3 |
| 业务Adapter | TTS | TTS skill（SAPI + edge-tts + 降级） | 07-WF §4 + 06-API §3.10 | 阶段2-4 |
| 业务Adapter | 备份 | 备份恢复（zip + content_hash + 恢复 + 调度） | 07-WF §5 + 06-API §3.11 | 阶段2-4 |
| 壳层 | S5-S7 | 09-UI S5-S7 + TTS + 备份恢复 UI | 09-UI §4.8-§4.10 + §5-§6 | 阶段4 |
| 测试 | 全 | E2E-04~09（冲刺/报告/采集/TTS/备份恢复） | 08-Test §6.2-§6.4 | 阶段5 |

### 7.3.1 M2 任务登记表（随开发动态更新）

| task-id | 标题 | 分类 | 优先级 | 状态 | 治理阶段 | 关联文档 | 证据 |
|---|---|---|---|---|---|---|---|
| T-M2-001 | S5 期末冲刺（模拟考/速背卡/冲刺计划）工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §2.6 + 06-API §3.7 + 03-Arch §3.1 + 05-ERD §3.5 + 08-Test §3.1/§3.2/§5.5/§6.2 | [.record/T-M2-001 实施记录](../.record/T-M2-001-实施记录.md) |
| T-M2-002 | S6 家长报告（规则生成/冻结/脱敏/投递）工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §3 + 06-API §3.8 + 03-Arch §3.1 + 05-ERD §2.2/§3.6 + 02-PRD §5.2 + 08-Test §3.1/§3.2/§5.4/§5.5 | [.record/T-M2-002 实施记录](../.record/T-M2-002-实施记录.md) |
| T-M2-003 | S7 课堂采集（许可确认/PCM WAV/whisper.cpp/handoff）工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §2.7 + 06-API §3.9 + 03-Arch §3.1/§3.3 + 05-ERD §3.2.1/§3.2.2/§3.1.5 + 08-Test §3.3.2/§5.4 | [.record/T-M2-003 实施记录](../.record/T-M2-003-实施记录.md) |
| T-M2-004 | TTS skill（SAPI + edge-tts 降级 + 跨子系统朗读 + 状态机）工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §4 + 06-API §3.10 + 03-Arch §3.1/§3.3 + 08-Test §3.5/§5.4 + 02-PRD §3.9 + 09-UI §5 | [.record/T-M2-004 实施记录](../.record/T-M2-004-实施记录.md) |
| T-M2-005 | 备份恢复（zip 打包/解包 + content_hash + 恢复 + 调度）工具注册 + API | 业务Adapter | P1 | done | 阶段2-4 | 07-WF §5 + 06-API §3.11 + 03-Arch §3.1 + 05-ERD §2.3/§2.4/§8.1-§8.3 + 02-PRD §3.10 + 08-Test §3.1/§5.3/§5.4/§7.6 + 09-UI §6 | [.record/T-M2-005 实施记录](../.record/T-M2-005-实施记录.md) |
| T-M2-006 | S6 assertNoSensitiveLeak UUID 泄漏检测（独立校验脚本） | 业务Adapter | P1 | done | 阶段2-5 | 03-Arch §8.2 + 08-Test §5.4 | [.record/T-M2-006 实施记录](../.record/T-M2-006-实施记录.md) — 独立静态审计脚本 scripts/check-uuid-leak.mjs（7 条硬断言 UUID-01~07，仿 check-desktop-security.mjs 范式） |
| T-M2-007 | whisper.cpp Adapter（真实 PCM WAV 转写 CLI 接入，替换 mock） | 业务Adapter | P1 | done | 阶段2-3 | 03-Arch §3.3 + 08-Test §3.3.2 | [.record/T-M2-007 实施记录](../.record/T-M2-007-实施记录.md) — createStudyBuddyExtension 增加可选 whisper 配置（调用参数 > 环境变量 PI_STUDYBUDDY_WHISPER_CLI/MODEL > 空默认 mock）；有 cliPath+modelPath 装配 createRealWhisperAdapter 接入 S7Context；真实转写单件测试（合成 3s 正弦波 PCM WAV + 真实 whisper-cli -nt，探测存在才跑）+ 装配测试；802 单元/集成 + 83 E2E 测试全绿 |
| T-M2-008 | 09-UI S5-S7 + TTS + 备份恢复 UI | 壳层 | P1 | done | 阶段4 | 09-UI §4.8-§4.10 + §5-§6 | 3 Tab + TtsControlBar + BackupPanel + 66 测试（确定性只读+隐私边界+合规确认+引擎降级+标记已复习+备份恢复校验）|
| T-M2-009 | E2E-04~09（冲刺/报告/采集/TTS/备份恢复） | 测试 | P1 | done | 阶段5 | 08-Test §6.2-§6.4 | [.record/T-M2-009 实施记录](../.record/T-M2-009-实施记录.md) |

### 7.4 M3 对话与打磨任务大纲

| 分类 | 子系统 | 任务大纲 | 关联文档 | 治理阶段 |
|---|---|---|---|---|
| 扩展层 | 对话 | 💬 对话 Tab（pi 原生 AI 对话默认主入口） | 09-UI §4.2 + 07-WF §2.8 | 阶段3-4 |
| 扩展层 | 对话 | pi 原生能力承载（流式/工具调用视图/上下文压缩/@引用/多模型） | 09-UI §4.2 + 03-Arch §6.7 | 阶段3-4 |
| 扩展层 | 对话 | 学习场景业务化（学科标签/学习目标/错题关联/L1注入/L3检索） | 09-UI §4.2 + 03-Arch §6.7 | 阶段3-4 |
| 扩展层 | 对话 | AI 自主调用工具 + 跳转结构化 Tab | 07-WF §2.8 + 09-UI §4.2 | 阶段3-4 |
| 扩展层 | 跨切 | model_select / turn_end 钩子（多模型持久化 + L3 增量索引） | 03-Arch §2.3 + 08-Test §4.2 | 阶段3 |
| 壳层 | 对话 | 09-UI 对话 Tab 业务 UI + 会话管理 UI | 09-UI §4.2 + §7 | 阶段4 |
| 测试 | 对话 | E2E-10~13（对话默认主入口/工具调用/@引用/TTS+L3检索） | 08-Test §6.5 | 阶段5 |
| 测试 | 全 | E2E-01~13 全链回归 + 安全不变量最终校验 | 08-Test §6 + §5.7 | 阶段5 |

### 7.4.1 M3 任务登记表

| task-id | 标题 | 分类 | 优先级 | 状态 | 治理阶段 | 关联文档 | 证据 |
|---|---|---|---|---|---|---|---|
| T-M3-001 | 💬 对话 Tab（pi 原生 AI 对话默认主入口） | 扩展层 | P1 | done | 阶段3-4 | 09-UI §4.2 + 07-WF §2.8 | 计划 .plan/T-M3-001-chat-tab.md — 823 单元/集成测试全绿 + 83 E2E + smoke 6/6 + 安全不变量 6/6；06-API v0.1.2 新增 agent.send |
| T-M3-002 | pi 原生能力承载（流式回复/工具调用视图/上下文压缩/@文件引用/多模型切换） | 扩展层 | P1 | done | 阶段3-4 | 09-UI §4.2 + 03-Arch §6.7 | 计划 .plan/T-M3-002-pi-native-capabilities.md — 856 单元/集成测试全绿 + 83 E2E + smoke 6/6 + 安全不变量 6/6；06-API v0.1.3 §4 payload 结构化 + §3.2 files.read 落地注解 |
| T-M3-003 | 学习场景业务化（学科标签/学习目标/错题关联/L1 画像注入/L3 会话检索） | 扩展层 | P1 | done | 阶段3-4 | 09-UI §4.2 + 03-Arch §6.7 | 计划 .plan/T-M3-003-study-context.md — 892 单元/集成测试全绿（+36）+ 83 E2E + smoke 6/6 + 安全不变量 6/6 + UUID 泄漏 7/7；06-API v0.1.4 §3.1/§3.1.1 落地注解；.record/T-M3-003-实施记录.md |
| T-M3-004 | AI 自主调用工具（S1-S7+TTS+备份恢复全部工具）+ 跳转结构化 Tab | 扩展层 | P1 | done | 阶段3-4 | 07-WF §2.8 + 09-UI §4.2 | 计划 .plan/T-M3-004-ai-tools-jump.md — 925 单元/集成测试全绿（+33）+ 83 E2E + smoke 6/6 + 安全不变量 6/6 + UUID 泄漏 7/7；07-WF v0.1.2 §2.8 映射表条款；.record/T-M3-004-实施记录.md |
| T-M3-005 | model_select / turn_end 钩子（多模型持久化 + L3 增量索引） | 扩展层 | P1 | done | 阶段3-4 | 03-Arch §2.3 + 08-Test §4.2 | 计划 .plan/T-M3-005-model-select-turn-end.md — 939 单元/集成测试全绿（+14）+ 83 E2E + smoke 6/6 + 安全不变量 6/6 + UUID 泄漏 7/7；四文档 supersedes（03-Arch v0.1.2/08-Test v0.1.3/06-API v0.1.5/09-UI v0.1.3 落点改业务数据根）；.record/T-M3-005-实施记录.md |
| T-M3-006 | 09-UI 对话 Tab 业务 UI + 会话管理 UI | 壳层 | P1 | done | 阶段4 | 09-UI §4.2 + §7 | 计划 .plan/T-M3-006-chat-session-ui.md — 966 单元/集成测试全绿（+27）+ 83 E2E + smoke 6/6 + 安全不变量 6/6 + UUID 泄漏 7/7；06-API §3.1 rename/export handler 落地；.record/T-M3-006-实施记录.md |
| T-M3-007 | E2E-10~13（对话默认主入口/工具调用/@引用/TTS+L3检索） | 测试 | P1 | done | 阶段5 | 08-Test §6.5 | 计划 .plan/T-M3-007-e2e-chat.md — 110 E2E 全部通过（+27）+ 966 单元/集成测试 + smoke 6/6 + 安全不变量 6/6 + UUID 泄漏 7/7；.record/T-M3-007-实施记录.md |
| T-M3-008 | E2E-01~13 全链回归 + 安全不变量最终校验 | 测试 | P0 | done | 阶段5 | 08-Test §6 + §5.7 | 计划 .plan/T-M3-008-e2e-regression.md — 回归+校验型（M3 收官）：E2E_RUN_DIR 切换 runs\T-M3-008\ + pnpm test:e2e 110 全绿（14 文件）+ 966 单元/集成 + smoke 6/6 + verify full + check-desktop-security.mjs 6/6 + check-uuid-leak.mjs 7/7 + §11.4 交叉审查（2 审查者无 blocker，W1 注释残留已修正）+ §6.5 M3 退出门槛六项全勾选；.record/T-M3-008-实施记录.md |

### 7.6 M4 后端断裂修复 + 业务接线 + 打包部署任务大纲

> v0.1.66 新增，v0.1.68 重新规划。依据：重新读系统设计（03-Arch/06-API/09-UI）对比代码，发现后端 5 处断裂（E2E 全绿但生产不可用）+ 前端大面积"有壳无接线" + 设置页/学期切换完全缺失 + 01-TRD §7 决策 6 v0.2.3 修订（打包能力常态化）。

| 分类 | 子系统 | 任务大纲 | 关联文档 | 治理阶段 | 优先级 |
|---|---|---|---|---|---|
| 壳层 | 数据层 | main.ts 数据根初始化（global.db 建库 + 目录创建） | 03-Arch §4.3 + 05-ERD §2 | 阶段4 | P0 |
| 壳层 | 跨切 | agent-host 生产入口装配 S1-S7/TTS/Backup handler | 03-Arch §6.2 + 06-API §3.3-§3.11 | 阶段4 | P0 |
| 壳层 | 设置 | credentials.*/settings.* handler 实现 + 装配 | 06-API §3.14/§3.15 + 03-Arch §4.5 | 阶段4 | P0 |
| 扩展层 | 跨切 | studybuddy-extension 接入 pi 内核 + extension-loader | 03-Arch §2.1/§6.2 | 阶段3-4 | P0 |
| 扩展层 | 对话 | agent.send 接真实 pi 内核流式回复（替换受控夹具） | 03-Arch §6.7 + 06-API §3.1.1 | 阶段3-4 | P0 |
| 壳层 | 设置 | 设置页 UI（AI provider 配置 + 密钥 vault + 工具链检查 + 学习偏好） | 09-UI §10 + 03-Arch §6.4 | 阶段4 | P0 |
| 壳层 | S1 | 学期/课程切换 UI（左侧栏学期树 + 标题栏动态绑定） | 09-UI §3 + 03-Arch §6.7 | 阶段4 | P0 |
| 壳层 | 跨切 | AppShell 数据流重构（semesterId/courseId 全局状态 + 各 Tab 自动拉数据） | 03-Arch §6.7 + 09-UI §3 | 阶段4 | P0 |
| 壳层 | 打包 | electron-builder 配置 + x64 setup 首次验证 | 01-TRD §7 决策 6 v0.2.3 | 阶段4 | P0.5 |
| 壳层 | S1 | 首页 Tab RPC 接线（dailyBrief + tasks + exams） | 09-UI §4.3 + 06-API §3.3 | 阶段4 | P1 |
| 壳层 | S2 | 资料 Tab RPC 接线（upload + convert + generateNote + list） | 09-UI §4.4 + 06-API §3.4 | 阶段4 | P1 |
| 壳层 | S2 | 笔记 Tab RPC 接线（notes.get/update + modules.list/update） | 09-UI §4.5 + 06-API §3.4 | 阶段4 | P1 |
| 壳层 | S3 | 练习 Tab RPC 接线（createSession + getQuestions + submit + getResult） | 09-UI §4.6 + 06-API §3.5 | 阶段4 | P1 |
| 壳层 | S4 | 错题 Tab RPC 接线（list + confirmErrorCause + redo + weakPoints） | 09-UI §4.7 + 06-API §3.6 | 阶段4 | P1 |
| 壳层 | S5 | 冲刺 Tab RPC 接线（mockExams + cramCards + cramPlan） | 09-UI §4.8 + 06-API §3.7 | 阶段4 | P2 |
| 壳层 | S6 | 报告 Tab RPC 接线（reports + deliveries + reportTargets） | 09-UI §4.9 + 06-API §3.8 | 阶段4 | P2 |
| 壳层 | S7 | 采集 Tab RPC 接线（classCapture.transcribe + saveTranscription） | 09-UI §4.10 + 06-API §3.9 | 阶段4 | P2 |
| 壳层 | TTS | TTS 控制条 RPC 接线（speak + control + switchEngine + getStatus） | 09-UI §5 + 06-API §3.10 | 阶段4 | P3 |
| 壳层 | 备份 | 备份恢复面板 RPC 接线 + TabBar 入口 | 09-UI §6 + 06-API §3.11 | 阶段4 | P3 |
| 测试 | 全 | E2E 全链回归（后端断裂修复 + 设置页/学期切换 + S1-S7 接线） | 08-Test §6 + §5.7 | 阶段5 | P4 |
| 测试 | 打包 | M4 收官验收 + 打包冒烟（安装 + 启动 + RPC 往返 + 安全不变量） | 08-Test §5 + §5.7 | 阶段5 | P4 |

### 7.6.1 M4 任务登记表（随开发动态更新）

> v0.1.73 追加并完成实施证据登记 T-M4-022：原 T-M4-001~021（21 任务）→ T-M4-001~022（22 任务）。原因：事实调查 Prompt 指出 Electron 33 的 Node 20 生产运行时与测试使用的 Node 22/24 + node:sqlite 不一致，真实桌面启动为 P0 阻塞；T-M4-022 前置于 T-M4-006，先做运行时兼容与真实 Electron 验证；后续审计又将业务 E2E harness 从 Node fork 迁移为 Electron 36.9.5 + 127.0.0.1 TCP JSON-lines，消除“Node 子进程冒充 Electron E2E”残留。

| task-id | 标题 | 分类 | 优先级 | 状态 | 治理阶段 | 关联文档 | 证据 |
|---|---|---|---|---|---|---|---|
| T-M4-001 | main.ts 数据根初始化（global.db 建库 + 目录创建 + 业务数据根就绪） | 壳层 | P0 | done | 阶段4 | 03-Arch §4.3 + 05-ERD §2 | src/main/data-root-init.ts + main.ts 装配 + tests/unit/data-root-init.test.ts 4 断言 |
| T-M4-002 | agent-host 生产入口装配 S1-S7/TTS/Backup handler（断裂 1 修复） | 壳层 | P0 | done | 阶段4 | 03-Arch §6.2 + 06-API §3.3-§3.11 | src/agent-host/index.ts createBusinessHandlers 装配 S1-S7/TTS/Backup 9 类 handler |
| T-M4-003 | credentials.*/settings.* handler 实现 + 装配（断裂 5 修复） | 壳层 | P0 | done | 阶段4 | 06-API §3.14/§3.15 + 03-Arch §4.5 | src/agent-host/handlers/credentials.ts + settings.ts + src/agent/settings-config.ts + tests/unit/credentials-settings-handlers.test.ts |
| T-M4-004 | studybuddy-extension 接入 pi 内核 + extension-loader（断裂 2 修复） | 扩展层 | P0 | done | 阶段3-4 | 03-Arch §2.1/§6.2 | src/agent-host/studybuddy-extension-loader.ts createStudyBuddySession() + tests/integration/studybuddy-extension-loader.test.ts 5 断言（缺配置拒绝、display name→runtime model id、35 studybuddy_* 工具 + PI_CODING_AGENT_DIR 隔离）；T-M4-023 补验 models.json/vault 真实装配 |
| T-M4-005 | agent.send 接真实 pi 内核流式回复（断裂 3 修复，替换受控夹具） | 扩展层 | P0 | done | 阶段3-4 | 03-Arch §6.7 + 06-API §3.1.1 | src/agent-host/handlers/agent.ts 生产路径仅真实 pi 内核 prompt() 或固定 MODEL_NOT_CONFIGURED；runMockFixture 仅显式 VITEST 夹具 + studybuddy-extension-loader.ts 动态 import() + tests/integration/agent-real-pi-kernel.test.ts 11 断言（事件映射、脱敏、UUID 过滤、无模型边界）；原历史记录中的 fallback 事实由 T-M4-023 修订生产边界 |
| T-M4-022 | Electron 生产运行时 / SQLite 兼容修复 + 真实桌面启动验证 | 壳层/数据层/测试 | P0 | done | 阶段1-5 | 01-TRD §7 决策6 + 03-Arch §4.3/§6.2 + 05-ERD §2 + 08-Test §5/§6 | 实施与质量门已通过；业务 E2E 真实 Electron 16 files/117 tests；两名独立审查最终 PASS；master 复验通过；commit 0ec4163 已推送 origin/master |
| T-M4-023 | 独立交叉审查问题修订（生产 agent.send、契约覆盖、真实 Electron 代表性路由、治理证据与文档元数据） | 跨切/测试/文档 | P0 | done | 阶段1-5 | 03-Arch §6.7 + 06-API §3.1.1 + 08-Test §5/§6 + AGENTS.md §11.4 | `.plan/T-M4-023-cross-review-remediation.md`；A/B 独立审查问题已修订；功能提交 `92e0bcb` 已快进进入 master；Node 24.14.0 master 完整质量门复验与 origin/master 核验通过 |
| T-M4-006 | 设置页 UI（AI/Email/飞书密钥管理 + 工具链检查 + 学习偏好） | 壳层 | P0 | done | 阶段2-4 | 09-UI §10 + 03-Arch §6.4 + 06-API §3.13/§3.14/§3.15/§3.16 | 设置页/AppShell、RED→GREEN、两名独立审查最终 PASS（Epicurus 发现的 `AppShell.tsx` EOF 空白行已删除，`git diff --check` 通过）、Node 24.14.0 完整 verify full（smoke 6/6、真实 Electron E2E 16 files/117 tests）和实施记录已完成；功能提交 `0e378c0` 已在 master 快进复验并推送 origin/master；无 API 变化，T-M4-007~021 不启动 |
| T-M4-007 | 学期/课程切换 UI（左侧栏学期树 + 标题栏动态绑定） | 壳层 | P0 | done | 阶段4 | 09-UI §3 + 03-Arch §6.7 + 06-API §3.3 | 左栏学期/课程树、唯一上下文、标题、归档只读浏览、按学期隔离的竞态/卸载保护和安全展示已交付；新增记录型 RPC 与 happy-dom AppShell 实挂载测试，完整质量门、UUID、文档治理、diff 检查均通过，Mill/Erdos 两名独立审查最终 PASS；功能提交 `9e5116f` 与 master 复验证据提交 `9493f99` 已推送 `origin/master`；不新增 API，T-M4-008~021 保持 pending |
| T-M4-008 | AppShell 数据流重构（semesterId/courseId 全局状态 + 各 Tab useEffect 拉数据） | 壳层 | P0 | done | 阶段4 | 03-Arch §6.7 + 09-UI §3 | `.plan/T-M4-008-appshell-dataflow.md` + `.record/T-M4-008-实施记录.md`；`useTabData` 统一 idle/loading/error/empty/ready 生命周期；Home/Materials/Notes/Practice/Mistakes/Report 只读列表加载；旧响应/卸载保护；新增 renderer-tab-dataflow 集成测试；Node 24.14.0 master verify full、UUID 7/7、文档治理和 diff 检查通过；功能提交 `76bef58` 已快进合并并推送 `origin/master`；无 API/handler/schema 变化；T-M4-009~021 保持 pending |
| T-M4-009 | electron-builder 配置 + x64 setup 首次验证 | 壳层 | P0.5 | done | 阶段1-5 | 01-TRD §7 决策 6 v0.2.3 | electron-builder 26.15.3 精确锁定；x64 NSIS setup 已构建/静默安装；真实安装目录两次启动的 renderer/preload/system.ping/global.db 通过；Node 24.14.0 master verify full、UUID 7/7、文档治理与 diff 检查通过；`.record/T-M4-009-实施记录.md`；功能提交 `36202b0` 已快进合并并推送 `origin/master` |
| T-M4-010 | S1 首页 Tab RPC 接线（dailyBrief + tasks + exams） | 壳层 | P1 | done | 阶段4 | 09-UI §4.3 + 06-API §3.3 | 功能提交 `a06d8a5` 已快进合并进入 `master`，Node 24.14.0 master 完整质量门与独立检查通过；网络恢复后本地、`origin/master` 与远端引用已核验同为 `b9a3c49`，最终治理同步随后推送并复验；无 API/handler/schema 变化，不启动 T-M4-011~021 |
| T-M4-011 | S2 资料 Tab RPC 接线（upload + convert + generateNote + list） | 壳层 | P1 | done | 阶段4 | 09-UI §4.4 + 06-API §3.4 | `.plan/T-M4-011-s2-materials-rpc.md` + `.record/T-M4-011-实施记录.md`；MaterialsTab 已接通 list/upload/convert/retryConversion/generateNote、课程/归档只读门控、dialog/action 竞态隔离与动态刷新；main dialog 返回一次性 `importToken/fileName/fileSize`，renderer 不再把源路径交给 host；S2 host 消费 capability、以 stat 真实大小原子复制至 `<dataRoot>/<storageKey>`、转换读取 storage，并在 materials/notes/modules 写操作拒绝 archived 学期直接 RPC；Node24.14.0/pnpm11.20.0 下定向 6 files/79 tests、资料 E2E 1 file/10 tests、全量 unit/integration 106 files/1037 tests、完整 verify full（真实 Electron E2E 16 files/118 tests）及静态质量门通过；功能提交 `516675b` 已快进进入 master，Node24 master verify full（106 files/1037 tests、真实 Electron E2E 16 files/118 tests）通过；target-machine acceptance 已通过：新 x64 NSIS setup（SHA-256 `C3D098698A9DC9A2572518184FBC04BEF9039DD834651AEC300B71550424E339`）静默安装 exit 0，已安装应用两次启动通过 renderer/preload `piBridge`、`system.ping` 与隔离 `global.db`；当前 master 已具备功能、完整质量门与已安装应用验收；用户已明确授权最终治理证据 commit/push，推送核验后完成收官；不启动 T-M4-012~021 |
| T-M4-012 | S2 笔记 Tab RPC 接线（notes.get/update + modules.list/update） | 壳层 | P1 | done | 阶段4 | 09-UI §4.5 + 06-API §3.4 | `.plan/T-M4-012-s2-notes-rpc.md`；NotesTab 局部显式资料选择已接通 `materials.list({ courseId })`、`notes.get/update`、`modules.list/updateLearnStatus`，不默认第一条、不写死 `materialId`；资料/课程竞态、NOT_FOUND 新建、归档 renderer/host 双层写防线、UUID/Windows/POSIX/file URI/错误栈展示净化已通过定向测试；Node24 `verify --stage=full` 当前通过（unit 107 files/1047 tests，真实 Electron E2E 17 files/119 tests），两名独立审查复核无 P0/P1；Git 收口已完成，不启动 T-M4-013~021；`.record/T-M4-012-实施记录.md`；功能提交 `2e1e7f6` 已快进进入 master；Node24 master `verify --stage=full` 通过（unit 107 files/1047 tests，真实 Electron E2E 17 files/119 tests）；`origin/master` 已推送并核验；不启动 T-M4-013~021 |
| T-M4-013 | S3 练习 Tab RPC 接线（createSession + getQuestions + submit + getResult） | 壳层 | P1 | done | 阶段4 | 09-UI §4.6 + 06-API §3.5 | `.plan/T-M4-013-s3-practice-rpc.md` + `.record/T-M4-013-实施记录.md`；PracticeTab 接通 `modules.list` + `practice.createSession/getQuestions/submit/getResult`，显式多模块选择、作答前防泄露、前端计时与 timer 接收、结果加载重试不重复 submit、课程/会话竞态与卸载保护、归档 renderer/host 双层只读、固定错误净化；审查者 A/B 独立交叉复核无遗留 P0/P1，P1/P2 已修复并复验；Node24 `verify --stage=full` 通过（unit/integration 109 files/1057 tests、真实 Electron E2E 18 files/120 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、文档治理与 diff-check 通过）；`practice.listSessions` 为历史契约能力，本轮不纳入 renderer 接线；范围裁决 supersedes v0.1.112 中的“listSessions 接线”描述，历史记录保留；功能提交 `7d93560` 已进入 `master`，`git ls-remote origin refs/heads/master` 核验为同一提交；不启动 T-M4-015~021 |
| T-M4-014 | S4 错题 Tab RPC 接线（list + confirmErrorCause + redo + weakPoints） | 壳层 | P1 | done | 阶段4 | 09-UI §4.7 + 06-API §3.6 | `.plan/T-M4-014-s4-mistakes-rpc.md` + `.record/T-M4-014-实施记录.md`；MistakesTab 已接通 `mistakes.list/get/suggestErrorCause/confirmErrorCause/redo` 与 `weakPoints.list`，局部详情选择、AI“仅供参考”、六分类确认、重做刷新、全部/需复习/已掌握筛选（v0.1.119 补做）、课程/错题竞态、卸载保护、重复 mutation、归档只读和错误/隐私净化已覆盖；RED 初次 5/5 失败后 GREEN；定向 renderer 14 tests + integration 12 tests、真实 Electron E2E 2 tests、Node24 `verify --stage=full` 通过；无 API/handler/schema/AppShell 全局状态变化；功能提交 `cb7d62d` 已快进进入 master，Node24 master 完整 `verify --stage=full` 复验通过（unit/integration 110 files/1068 tests、真实 Electron E2E 19 files/122 tests），origin/master 已推送并核验；不启动 T-M4-015~021 |
| T-M4-015 | S5 冲刺 Tab RPC 接线（mockExams + cramCards + cramPlan） | 壳层 | P2 | done | 阶段4 | 09-UI §4.8 + 06-API §3.7 | `.plan/T-M4-015-s5-cram-rpc.md` + `.record/T-M4-015-实施记录.md`；CramTab 已接通 `exams.list({ courseId, confirmationStatus: "confirmed" })` 门控 + `mockExams.generatePaper/getPaper/startAttempt/submitAttempt/getResult/getModuleAnalyses` + `cramCards.get` + `cramPlan.get`；已确认考试局部显式选择、模拟卷生成幂等、作答计时提交防重复（in-flight ref）、结果/模块分析展示、速背卡翻页只读、计划 DTO 只读展示、课程/考试切换竞态、卸载保护、错误/隐私净化已覆盖；S5 写 handler 补齐 host 侧 archived 防线（assertSemesterWritable，对齐 S3）；RED 初次 8/8 失败后 GREEN；定向 renderer 14 tests + integration 10 tests、真实 Electron E2E 2 tests、Node24 `verify --stage=full` 通过（unit/integration 112 files/1079 tests、真实 Electron E2E 20 files/124 tests）；双维度独立审查无遗留 P0/P1/P2；无 API/handler/schema/AppShell 全局状态变化；功能提交 `7974423` 与治理登记提交 `2d63bf5` 已快进进入 `master`，Node24 master 完整 `verify --stage=full` 复验通过，origin/master 已推送并核验；不启动 T-M4-016~021 |
| T-M4-024 | agnes 模型 provider 接入 + utilityProcess 凭证委托修复（T-M4-015 收口后真实对话验证暴露 2 个生产缺陷） | 扩展层/壳层 | P0 | done | 阶段1-5 | 03-Arch §4.5/§6.7 + 06-API §3.15 + 01-TRD §7 决策 1/2 | 用户提供 agnes-2.5-flash（baseUrl `https://apihub.agnes-ai.com/v1`）；真实数据根 `%LOCALAPPDATA%\PiStudyBuddy\config\` 已写入 `models.json`（业务别名）+ `pi-models.json`（运行时 provider 定义，loader `ensureRuntimeProviderConfig` 原子生成）+ `credentials.json`（DPAPI 加密 key）；修复 ① loader 注入 `modelRuntime` 到 `createAgentSessionServices`（key 此前不生效）② 新增 `credential-client.ts`——agent-host（utilityProcess 无 electron safeStorage）经 `process.parentPort` 委托 main 主进程 DPAPI vault，`main/ipc.ts` forkAgent 响应 `credential-request`；credentials.* handler 改 async CredentialService；完整应用链路真实验证通过（agent.send 17 事件/32 token，回复真实 agnes 内容）；unit/integration 113 files/1085 tests、真实 Electron E2E 20 files/124 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check 通过；无 API/handler/schema 方法变化（credentials.* 仅内部 async）；功能提交与治理提交已进入 master，Node24 master 完整 `verify --stage=full` 复验通过，origin/master 已推送并核验；不启动 T-M4-016~021 |
| T-M4-016 | S6 报告 Tab RPC 接线（reports + deliveries + reportTargets） | 壳层 | P2 | done | 阶段4 | 09-UI §4.9 + 06-API §3.8 | `.plan/T-M4-016-s6-report-rpc.md` + `.record/T-M4-016-实施记录.md`；ReportTab 已接通 `reports.list/generate/freeze/get` + `deliveries.list/deliver/retry` + `reportTargets.list`（生成类型/周期选择、冻结门控、投递状态可视化 sent ✅/failed ✗ 重试/retained_locally/未配置 ─、投递/重试防重复、脱敏展示）；S6 host 补齐 archived 写防线（`s6/lookup.ts:assertSemesterWritable` 对齐 S5，接入 generate/deliver/retry/create/update/delete 六写入口，方法签名不变）；RED 初次 9/9 失败后 GREEN；定向 integration 11 tests + 既有 unit 10 tests、真实 Electron E2E 2 tests、Node24 `verify --stage=full` 通过（unit/integration 115 files/1096 tests、真实 Electron E2E 21 files/126 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；双维度独立审查无遗留 P0/P1；无 API/handler/schema 方法变化；`reportTargets.create/update/delete` 不纳入 renderer 接线（无 09-UI §4.9 表单 UI 依据，host 防线已就绪）；功能提交 `eb4becb` 与治理登记提交 `62fa21d` 已快进进入 `master`，Node24 master 完整 `verify --stage=full` 复验通过，origin/master 已推送并核验；不启动 T-M4-017~021 |
| T-M4-017 | S7 采集 Tab RPC 接线（classCapture.transcribe + saveTranscription） | 壳层 | P2 | done | 阶段4 | 09-UI §4.10 + 06-API §3.9 | `.plan/T-M4-017-s7-capture-rpc.md` + `.record/T-M4-017-实施记录.md`；CaptureTab 接通既有 `classCapture.transcribe/saveTranscription`（合规确认受控 + desktop dialog rawPath 文件选择 + in-flight 防重复 + 课程/归档门控 + 竞态/卸载保护 + 可编辑转写 + 标题可编辑保存 + 错误净化）；desktop dialog 新增 rawPath capability（shell 层扩展，对齐 T-M4-011 importToken 先例，contract 保持 127/127）；RED 初次 8/9 失败后 GREEN 9/9；unit 12/12、全量 unit/integration/security 116 files/1105 tests、真实 Electron E2E 22 files/128 tests、`verify --stage=full` 通过；功能提交 `c059571` + 治理登记提交 `c7a6c92` 已快进进入 master，Node24 master 完整 `verify --stage=full` 复验通过，origin/master 已推送并核验 `master=origin/master=87afbe0`；不启动 T-M4-018~021 |
| T-M4-018 | TTS 控制条 RPC 接线（speak + control + switchEngine + getStatus） | 壳层 | P3 | done | 阶段4 | 09-UI §5 + 06-API §3.10 | `.plan/T-M4-018-tts-control-rpc.md` + `.record/T-M4-018-实施记录.md`；TtsControlBar 受控 RPC 接线（useTtsPlayback + tts.state 订阅 + NotesTab/MistakesTab 内嵌朗读 + events.markReviewed）；agent-host 生产接入 Streams["tts.state"] 推送（contract 127/127 不变）；RED→GREEN，定向 27/27、真实 Electron E2E 1/1、全量 117 files/1119 tests + 23 files/129 tests、verify full 通过；功能 `dd4b909` + 治理 `e92c567`（+中间事实 `3dfef67`）已推送 origin/master 并核验 master=origin/master=3dfef67；不启动 T-M4-019~021 |
| T-M4-019 | 备份恢复面板 RPC 接线 + TabBar 入口 | 壳层 | P3 | done | 阶段4 | 09-UI §6 + 06-API §3.11 | `.plan/T-M4-019-backup-restore-rpc.md` + `.record/T-M4-019-实施记录.md`；BackupPanel 受控 RPC 接线（backup.* 7 方法 + backup.progress 订阅）+ 备份 Tab 入口（10th）+ dialog directory capability + 生产 backup.progress 推送（contract 127/127 不变）；RED→GREEN 28/28、真实 Electron E2E 1/1（真实 zip 产出 + 恢复 integrity_check）、全量 118 files/1130 tests + 24 files/130 tests、verify full 通过；功能提交 `1bc68e2` 已快进进入 master，origin/master 已推送并核验；不启动 T-M4-020/021 |
| T-M4-020 | E2E 全链回归（后端断裂修复 + 设置页/学期切换 + S1-S7 接线） | 测试 | P4 | pending | 阶段5 | 08-Test §6 + §5.7 | — |
| T-M4-021 | M4 收官验收 + 打包冒烟（安装 + 启动 + RPC 往返 + 安全不变量） | 测试 | P4 | pending | 阶段5 | 08-Test §5 + §5.7 | — |

### 7.5 全局执行顺序（M1/M2/M3/M4 统一排序）

> v0.1.32 新增。依据：里程碑退出门槛依赖（§6.3/§6.4/§6.5/§6.6）+ 装配顺序（03-Arch §9.2）+ 价值优先（学生可见介面优先）。
>
> **原则**：UI 先于 E2E（E2E 需 UI 可交互）；mock 先于真实 Adapter（v0.1 §5.4 全 mock，真实 Adapter 代码写但测试不连真实服务）；M3 最后（对话 Tab 依赖 S1-S7 工具就绪 + E2E-01~09 通过）；M4 P0 阻塞先行（设置页+学期切换是所有业务 Tab 接线的前置）。

| 执行序 | task-id | 里程碑 | 标题 | 前置依赖 | 理由 |
|---|---|---|---|---|---|
| 1 | T-M1-009 | M1 | 09-UI S1-S4 标签页业务 UI | M0 壳层 done | 学生可见介面优先；M0 骨架已有三栏布局，加业务内容风险低 |
| 2 | T-M2-008 | M2 | 09-UI S5-S7+TTS+备份恢复 UI | T-M1-009（复用 UI 模式） | 与 T-M1-009 同批，复用 UI 组件模式 |
| 3 | T-M1-010 | M1 | E2E-01~03 | T-M1-009 | M1 退出门槛：S1-S4 全链路 + 防泄露 + 幂等 + 降级 |
| 4 | T-M2-009 | M2 | E2E-04~09 | T-M2-008 + T-M1-010（E2E 框架） | M2 退出门槛：S5-S7+TTS+备份恢复全链路 |
| 5 | T-M1-005 | M1 | OCR venv Adapter | venv 就绪 | 课表图片识别真实组件，v0.1 代码写但测试用 mock |
| 6 | T-M1-006 | M1 | WPS COM 桥 | Windows WPS COM | doc/ppt/xls 转换真实组件，同上 |
| 7 | T-M1-007 | M1 | 资料转换管道 | T-M1-005 + T-M1-006 | PDF/DOCX/PPTX/图片 OCR 转换，依赖 OCR + WPS COM |
| 8 | T-M2-007 | M2 | whisper.cpp 真实 Adapter | whisper.cpp CLI 就绪 | 替换 T-M2-003 的 mock，真实 PCM WAV 转写 |
| 9 | T-M1-008 | M1 | 跨切钩子业务级逻辑 | M0 钩子空壳就绪 | M0 有空壳，补 before_agent_start/session_start 等业务逻辑 |
| 10 | T-M2-006 | M2 | S6 UUID 泄漏检测独立脚本 | T-M2-002 done | 测试层已有覆盖，独立校验脚本化 |
| 11 | T-M3-001 | M3 | 💬 对话 Tab 默认主入口 | M1+M2 E2E 通过 | M3 起点：对话 Tab 作为默认入口 |
| 12 | T-M3-002 | M3 | pi 原生能力承载 | T-M3-001 | 流式/工具调用/上下文压缩/@引用/多模型 |
| 13 | T-M3-003 | M3 | 学习场景业务化 | T-M3-001 + T-M3-002 | 学科标签/学习目标/错题关联/L1/L3 |
| 14 | T-M3-004 | M3 | AI 自主调用工具+跳转 | T-M3-002 + S1-S7 工具 done | 对话中调用 S1-S7+TTS+备份恢复全部工具 |
| 15 | T-M3-005 | M3 | model_select/turn_end 钩子 | T-M3-001 | 多模型持久化 + L3 增量索引 |
| 16 | T-M3-006 | M3 | 09-UI 对话 Tab 业务 UI | T-M3-001 + T-M1-009 模式 | 对话 Tab + 会话管理 UI |
| 17 | T-M3-007 | M3 | E2E-10~13 | T-M3-001~006 | M3 退出门槛：对话 Tab E2E |
| 18 | T-M3-008 | M3 | E2E-01~13 全链回归 | T-M1-010 + T-M2-009 + T-M3-007 | 最终门槛：全链回归 + 安全不变量 |
| 19 | T-M4-001 | M4 | main.ts 数据根初始化 | M3 done | P0 基础：所有功能依赖 global.db + 业务数据根就绪（断裂4 修复） |
| 20 | T-M4-002 | M4 | agent-host 装配全部 handler | T-M4-001 | P0 基础：断裂1 修复，S1-S7/TTS/Backup 9类handler装配 |
| 21 | T-M4-003 | M4 | credentials/settings handler | T-M4-001 | P0 基础：断裂5 修复，设置页依赖 |
| 22 | T-M4-004 | M4 | studybuddy-extension 接入 pi 内核 | T-M4-002 | P0 基础：断裂2 修复，35工具+6钩子生效 |
| 23 | T-M4-005 | M4 | agent.send 接真实 pi 流式 | T-M4-004 | P0 基础：断裂3 修复，受控夹具→真实pi createAgentSession |
| 24 | T-M4-022 | M4 | Electron 生产运行时 / SQLite 兼容修复 + 真实桌面启动验证 | T-M4-005 | P0 阻塞：生产 Electron 必须真实启动并完成 global.db、BrowserWindow、preload、renderer、system.ping 全链路；不启动 T-M4-006 |
| 25 | T-M4-006 | M4 | 设置页 UI | T-M4-003 | P0：AI provider/密钥vault/工具链/学习偏好 |
| 26 | T-M4-007 | M4 | 学期/课程切换 UI | T-M4-001 | P0：所有业务Tab依赖 semesterId/courseId |
| 27 | T-M4-008 | M4 | AppShell 数据流重构 | T-M4-007 | P0：各Tab useEffect 拉数据 |
| 28 | T-M4-009 | M4 | electron-builder 配置 + x64 setup | T-M4-008 | P0.5：尽早验证打包链路（01-TRD §7 决策6 v0.2.3"随时能打包"） |
| 29 | T-M4-010 | M4 | S1 首页 Tab RPC 接线 | T-M4-008 | P1 核心：每日学习首页（"打开即看到今天该做什么"） |
| 30 | T-M4-011 | M4 | S2 资料 Tab RPC 接线 | T-M4-008 | P1 核心：资料上传/转换 |
| 31 | T-M4-012 | M4 | S2 笔记 Tab RPC 接线 | T-M4-008 | P1 核心：笔记/知识模块 |
| 32 | T-M4-013 | M4 | S3 练习 Tab RPC 接线 | T-M4-008 | P1 核心：出题/作答/批改 |
| 33 | T-M4-014 | M4 | S4 错题 Tab RPC 接线 | T-M4-008 | P1 核心：错题/薄弱点 |
| 34 | T-M4-015 | M4 | S5 冲刺 Tab RPC 接线 | T-M4-008 | P2 完整：模拟考/速背卡 |
| 35 | T-M4-016 | M4 | S6 报告 Tab RPC 接线 | T-M4-008 | P2 完整：家长报告 |
| 36 | T-M4-017 | M4 | S7 采集 Tab RPC 接线 | T-M4-008 | P2 完整：课堂采集 |
| 37 | T-M4-018 | M4 | TTS 控制条 RPC 接线 | T-M4-008 | P3 辅助：跨子系统朗读 |
| 38 | T-M4-019 | M4 | 备份恢复面板 RPC 接线 | T-M4-008 | P3 辅助：数据安全 |
| 39 | T-M4-020 | M4 | E2E 全链回归 | T-M4-005 + T-M4-006~019 | P4：后端断裂修复+设置页/学期切换+S1-S7接线全链回归 |
| 40 | T-M4-021 | M4 | M4 收官验收 + 打包冒烟 | T-M4-020 + T-M4-009 | P4：安装包冒烟+安全不变量最终校验 |

---

## 8. 修复记录区（08-Test §11.3 证据）

> 冒烟失败修复记录写此区域作为可审计证据。格式：

```
### FR-<序号> <task-id> <日期>
- 失败阶段：阶段X（单件/集成/冒烟/E2E）
- 失败用例：<E2E-XX / 冒烟用例名>
- 失败原因：<中文简述，脱敏不含路径/SQL/UUID>
- 修复措施：<改了什么文件/逻辑>
- 重跑结果：✅ 通过 / ❌ 再次失败（继续记录 FR-<序号+1>）
- 退回阶段：阶段X-1（如有退回）
```

<!-- 修复记录在开发阶段动态追加 -->

---

## 9. 任务统计（随开发动态更新）

| 里程碑 | 总任务数 | pending | in_progress | testing | done | blocked |
|---|---|---|---|---|---|---|
| M0 | 9 | 0 | 0 | 0 | 9 | 0 |
| M1 | 10 | 0 | 0 | 0 | 10 | 0 |
| M2 | 9 | 0 | 0 | 0 | 9 | 0 |
| M3 | 8 | 0 | 0 | 0 | 8 | 0 |
| M4 | 24 | 2 | 0 | 0 | 22 | 0 |
| **合计** | **60** | **2** | **0** | **0** | **58** | **0** |

> 注（v0.1.137）：M4 pending 口径修正为与 §7.6.1 登记表一致——待办为 T-M4-019~021 三项；此前 v0.1.131 起 §9 pending 计数与登记表存在 2 项漂移，本版本修正（v0.1.136 曾记 1 pending/22 done 不成立，实际 3 pending/21 done）。

> 注：M0 总任务数按实际 task-id 计为 9（§7.1 大纲 12 项中，安全沙箱合并入 T-M0-001，数据层 global/semester/三层记忆 3 项合并为 T-M0-006）。v0.1.15 修正口径。
>
> 注（v0.1.31）：总任务数 = 已登记 task-id 数（与 §7.x.1 登记表行数一致）。M1/M2 的 pending 行已登记 task-id（T-M1-005~010 / T-M2-006~009），涵盖 OCR/WPS COM/资料转换管道/跨切钩子/UI/E2E/UUID 泄漏检测/whisper.cpp 真实 Adapter。里程碑退出门槛（§6.3/§6.4）未全部勾选前，里程碑不算完成。
>
> 注（v0.1.32）：M3 task-id 已登记（T-M3-001~008），§7.5 全局执行顺序表统一排序 18 个 pending task。执行顺序原则：UI 先于 E2E，mock 先于真实 Adapter，M3 最后。

---

## 10. 版本历史

| 版本 | 日期 | 变更 |
| v0.1.139 | 2026-08-11 | T-M4-019 Git 收口完成：功能提交 `1bc68e2`（feat(m4) 备份恢复面板 RPC 接线与备份 Tab 入口）与治理登记提交已由 `agent/T-M4-019-backup-restore-rpc` 快进合并进入 `master`；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit/integration 118 files/1130 tests、真实 Electron E2E 24 files/130 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；`git push origin master` 成功并核验 `master=origin/master`（远端 refs/heads/master 一致；具体哈希于推送后 Git 证据登记）；§7.6.1 T-M4-019 in_progress→done，§9 统计 M4 2 pending/1 in_progress/21 done→2 pending/0 in_progress/22 done，合计 2/1/57→2/0/58；无 API/handler/schema 方法变化；不启动 T-M4-020/021。依据：用户明确 Git 收口授权（2026-08-11）+ AGENTS.md §4.5、§7、§8.2、§8.3、§8.4、§11.1、§11.2。 |
| v0.1.138 | 2026-08-11 | 登记 T-M4-019 本地实施与验收证据同步：BackupPanel 静态壳 → 受控 RPC 接线（09-UI §6.1-§6.3 + 06-API §3.11/§4 + 07-WF §5，裁决 1A TabBar 入口 / 2A 冲突策略显式选择 / 3A 历史恢复按钮 / 4A dialog directory capability）；TabBar 新增"备份"Tab（10th，09-UI v0.1.5 §4.1 同步）；agent-host 生产接入 Streams["backup.progress"] 推送（BackupContext emit → server.pushEvent，contract 127/127 不变）；RED 初次失败（4 项）后 GREEN；定向 integration 11 tests + unit 17 tests、真实 Electron E2E 1 test（备份→真实 zip→恢复 integrity_check + 隐私断言）；全量 unit/integration 118 files/1130 tests（基线 117/1119 +11）、真实 Electron E2E 24 files/130 tests（基线 23/129 +1）、`verify --stage=full` 通过（contract 127/127 + 8 PiBridge + 35 tools、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；既有 renderer-layout Tab 断言同步 9→10；任务保持 in_progress，Git 收口待用户单独授权；不启动 T-M4-020/021。依据：用户批准计划（2026-08-11“批准”）+ AGENTS.md §4.5、§5、§7、§8.4、§11.1、§11.2。 |
| v0.1.137 | 2026-08-11 | 登记 T-M4-019 开工：用户明确选择 T-M4-019~021 序列继续（2026-08-11“下一个任务 T-M4-019~021 开始了 先做prompt 做plan”；T-M4-019 prompt 资产已就绪 v0.1.96）；§7.6.1 T-M4-019 pending→in_progress；§9 统计口径修正后 M4 3 pending/0 in_progress/21 done→2 pending/1 in_progress/21 done，合计 3/0/57→2/1/57（修正：待办为 T-M4-019~021 三项，与 §7.6.1 一致；v0.1.136 曾记 1 pending/22 done 不成立）；唯一计划 `.plan/T-M4-019-backup-restore-rpc.md` 已建立（📝 待审查），隔离分支待计划批准后建立；范围仅既有 backup.* RPC 接线（course/allCourses/restore/list/configureSchedule/listSchedules/toggleSchedule + backup.progress 订阅）+ TabBar 入口 + dialog directory capability（shell 层，contract 127/127 不变）；不启动 T-M4-020/021，Git 收口另需授权。依据：用户明确选择 + AGENTS.md §4.4/§4.5/§11.1/§11.2。 |
| v0.1.136 | 2026-08-11 | T-M4-018 Git 收口完成：网络恢复后 `git push origin master` 成功并核验 `master=origin/master=3dfef67`（远端 refs/heads/master 一致；功能 `dd4b909` + 治理 `e92c567` + 中间事实 `3dfef67` 一并推送）；Node24.14.0 master 完整 `verify --stage=full` 复验通过（unit/integration 117 files/1119 tests、真实 Electron E2E 23 files/129 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；§7.6.1 T-M4-018 in_progress→done，§9 统计 M4 1 pending/1 in_progress/21 done→1 pending/0 in_progress/22 done，合计 1/1/57→1/0/58；无 API/handler/schema 方法变化；不启动 T-M4-019~021。依据：用户明确 Git 收口授权（2026-08-11）+ 网络恢复后继续执行 + AGENTS.md §4.5、§7、§8.2、§8.4。 |
| v0.1.135 | 2026-08-11 | 修正 T-M4-018 远端收口中间事实：功能提交 `dd4b909`（feat(tts)）与治理登记提交 `e92c567`（docs(m4)）已由 `agent/T-M4-018-tts-control-rpc` 快进合并进入本地 `master`；Node24.14.0 master 完整 `verify --stage=full` 复验通过（unit/integration 117 files/1119 tests、真实 Electron E2E 23 files/129 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；但 3 次 `git push origin master` 均因 GitHub 连接不可达（443 超时）失败，`origin/master` 尚未核验到新提交（仍为 dfd2894），按 §8.4 任务保持 in_progress，待网络恢复后推送；不启动 T-M4-019~021。依据：用户明确 Git 收口授权（2026-08-11）+ AGENTS.md §4.5、§7、§8.4 + 远端网络错误证据。 |
| v0.1.134 | 2026-08-11 | 登记 T-M4-018 Git 收口本地完成事实：功能提交 `dd4b909`（feat(tts) TTS 控制条 RPC 接线与 tts.state 生产推送）与治理登记提交 `e92c567`（docs(m4)）已快进合并进入本地 `master`；Node24 master 完整 `verify --stage=full` 通过（unit/integration 117 files/1119 tests、真实 Electron E2E 23 files/129 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；§9 统计曾更新为 M4 1/0/22（合计 1/0/58），推送失败后由 v0.1.135 修正回 1/1/21（合计 1/1/57）；origin/master 推送结果见 v0.1.135。依据：用户明确 Git 收口授权（2026-08-11）+ AGENTS.md §4.5、§7、§8.2、§8.3、§8.4、§11.1、§11.2。 |
| v0.1.133 | 2026-08-11 | 登记 T-M4-018 本地实施与验收证据同步：TtsControlBar 静态壳 → 受控 RPC 接线（09-UI §5.1-§5.5 + 06-API §3.10/§4 + 07-WF §4）；AppShell 局部持有 TTS 播放态（useTtsPlayback hook，裁决 1A tts.state stream 订阅 + 2A 最近朗读短标题 + 3A 仅 NotesTab/MistakesTab 内嵌按钮 + 4A events.markReviewed）；NotesTab/MistakesTab 内嵌朗读按钮接线（onSpeakText → tts.speak + refType/refId）；agent-host 生产接入 Streams["tts.state"] 推送（TtsContext.emit → server.pushEvent，仅接线不改 handler/adapter/状态机/stream 契约，contract 保持 127/127）；RED 初次失败（4 项：esbuild JSX 解析 + 静态渲染 refId/busy 文案/暂停快照）后 GREEN；定向 integration t-m4-018-tts-rpc 10 tests（C-RED-01~10）+ unit renderer-tts-control-bar 17 tests、真实 Electron E2E t-m4-018-tts-renderer 1 test（朗读→播放→暂停→停止→标记已复习→引擎切换 + 隐私断言）；全量 unit/integration 117 files/1119 tests（基线 116/1105 +14）、真实 Electron E2E 23 files/129 tests（基线 22/128 +1）、`verify --stage=full` 通过（contract 127/127 + 8 PiBridge + 35 tools、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；任务保持 in_progress，Git 收口待用户单独授权；不启动 T-M4-019~021。依据：用户批准计划（2026-08-11“批准”）+ AGENTS.md §4.5、§5、§7、§8.4、§11.2。 |
| v0.1.132 | 2026-08-11 | 登记 T-M4-018 开工：用户明确选择并批准 TTS 控制条 RPC 接线（09-UI §5.1-§5.5 + 06-API §3.10/§4 + 07-WF §4 + 03-Arch §6.7）；§7.6.1 T-M4-018 pending→in_progress；§9 统计 M4 2 pending/0 in_progress/21 done→1 pending/1 in_progress/21 done，合计 2/0/57→1/1/57；唯一计划 `.plan/T-M4-018-tts-control-rpc.md` 已建立（📝 待审查），隔离分支待计划批准后建立；范围仅既有 TTS RPC 接线（tts.speak/control/switchEngine/getStatus + tts.state 订阅 + 既有内嵌朗读按钮 NotesTab/MistakesTab），不新增 API/handler/schema（contract 127/127），不启动 T-M4-019~021，Git 收口另需授权。依据：用户明确选择 + AGENTS.md §4.4/§4.5/§11.1/§11.2。 |
| v0.1.131 | 2026-08-11 | T-M4-017 Git 收口完成：功能提交 `c059571`（feat(s7) 采集 Tab RPC 接线与 desktop dialog rawPath capability）与治理登记提交 `c7a6c92`（docs(m4) 实施登记与验收证据同步）已由 `agent/T-M4-017-s7-capture-rpc` 快进合并进入 `master`；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit/integration 116 files/1105 tests、真实 Electron E2E 22 files/128 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；`git push origin master` 成功并核验 `master=origin/master=87afbe0`（远端 refs/heads/master 一致，中间事实提交 `130f8e5`/`87afbe0` 一并推送）；§7.6.1 状态 in_progress→done，§9 统计 M4 3 pending/1 in_progress/20 done→2 pending/0 in_progress/21 done，合计 3/1/56→2/0/57；无 API/handler/schema 方法变化；不启动 T-M4-018~021。依据：用户明确 Git 收口授权（2026-08-11）+ AGENTS.md §4.5、§7、§8.2、§8.3、§8.4、§11.1、§11.2。 |
| v0.1.130 | 2026-08-11 | 修正 T-M4-017 远端收口中间事实：功能提交 `c059571`（feat(s7)）与治理登记提交 `c7a6c92`（docs(m4)）已由 `agent/T-M4-017-s7-capture-rpc` 快进合并进入本地 `master`；Node24.14.0 master 完整 `verify --stage=full` 复验通过（unit/integration 116 files/1105 tests、真实 Electron E2E 22 files/128 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；但 3 次 `git push origin master` 均因 GitHub 连接不可达（443 超时）失败，`origin/master` 尚未核验到新提交（仍为 8daa20e），按 §8.4 任务保持 in_progress，待网络恢复后推送；不启动 T-M4-018~021。依据：用户明确 Git 收口授权（2026-08-11）+ AGENTS.md §4.5、§7、§8.2、§8.4 + 远端网络错误证据。 |
| v0.1.129 | 2026-08-11 | T-M4-017 本地实施与验收证据同步：CaptureTab 接通既有 S7 RPC（classCapture.transcribe/saveTranscription）；desktop dialog 新增 rawPath capability（shell 层，对齐 T-M4-011 importToken 先例，contract 保持 127/127）；RED 初次 8/9 失败后 GREEN 9/9（C-RED-01~09）；unit 12/12；全量 unit/integration/security 116 files/1105 tests、真实 Electron E2E 22 files/128 tests（含 t-m4-017-capture-renderer 2 用例）、`pnpm verify -- --stage=full` 通过（contract 127/127 + 8 PiBridge + 35 tools、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；`.record/T-M4-017-实施记录.md` 已创建；任务保持 in_progress，Git 收口待用户单独授权；不启动 T-M4-018~021。依据：用户明确批准计划（2026-08-11“批准计划”）+ AGENTS.md §4.5、§5、§7、§8.4、§11.2。 |
| v0.1.128 | 2026-08-11 | 登记 T-M4-017 开工：用户明确选择并批准 S7 采集 Tab RPC 接线（classCapture.transcribe + saveTranscription）；§7.6.1 状态 pending→in_progress；§9 统计 M4 4 pending/0 in_progress/20 done→3 pending/1 in_progress/20 done，合计 4/0/56→3/1/56；唯一计划 `.plan/T-M4-017-s7-capture-rpc.md` 已建立（状态 📝 待审查），隔离分支 `agent/T-M4-017-s7-capture-rpc` 待用户批准计划后建立；测试运行根 `H:\pi-studybuddy-tmp\runs\T-M4-017\`；范围仅 S7 采集 Tab 既有 RPC 接线（transcribe + saveTranscription）+ desktop dialog rawPath capability（shell 层扩展，对齐 T-M4-011 importToken 先例，非 RPC 契约变更）；不新增 API/handler/schema（contract 保持 127/127），不启动 T-M4-018~021，Git 收口另需授权；待用户裁决：文件获取方式（dialog rawPath / webUtils 拖拽）、E2E 文件选择测试 seam、保存标题来源。依据：用户明确选择（2026-08-11“计划 T-M4-017”）+ AGENTS.md §4.4、§4.5、§5、§8、§11.2。 |
| v0.1.127 | 2026-08-11 | T-M4-016 Git 收口完成：功能提交 `eb4becb`（feat(s6) 报告 Tab RPC 接线与 host archived 写防线）与治理登记提交 `62fa21d`（docs(m4) 实施登记与验收证据同步）已由 `agent/T-M4-016-s6-report-rpc` 快进合并进入 `master`；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit/integration 115 files/1096 tests、真实 Electron E2E 21 files/126 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；`git push origin master` 成功并核验 `master=origin/master=62fa21d`（远端 refs/heads/master 一致）；§7.6.1 状态 in_progress→done，§9 统计 M4 5 pending/1 in_progress/18 done→4 pending/0 in_progress/20 done，合计 5/1/54→4/0/56；无 API/handler/schema 方法变化；不启动 T-M4-017~021。依据：用户明确 Git 收口授权（2026-08-11“提交 推送 到远端 然后 合并”）+ AGENTS.md §4.5、§7、§8.2、§8.3、§8.4、§11.1、§11.2。 |
| v0.1.126 | 2026-08-11 | T-M4-016 本地实施与验收证据同步：ReportTab 接通既有 S6 RPC（reports.list/generate/freeze/get + deliveries.list/deliver/retry + reportTargets.list）；S6 host 补齐 archived 写防线（`assertSemesterWritable` 接入 generate/deliver/retry/create/update/delete 六写入口，对齐 T-M4-015 S5 先例，方法签名不变，contract 保持 127/127）；RED 初次 9/9 失败后 GREEN；定向 integration 11 tests + 既有 unit 回归 10 tests、真实 Electron E2E 2 tests、Node24 `verify --stage=full` 通过（unit/integration 115 files/1096 tests、真实 Electron E2E 21 files/126 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；双维度独立审查无遗留 P0/P1；`.record/T-M4-016-实施记录.md` 已创建；任务保持 in_progress，Git 收口待用户单独授权；不启动 T-M4-017~021。依据：用户明确批准（2026-08-11）+ AGENTS.md §4.5、§5、§7、§8.4、§11.2。 |
| v0.1.125 | 2026-08-11 | 登记 T-M4-016 开工：用户明确选择并批准 S6 报告 Tab RPC 接线（reports + deliveries + reportTargets）；§7.6.1 状态 pending→in_progress；§9 统计 M4 6 pending/0 in_progress/18 done→5 pending/1 in_progress/18 done，合计 6/0/54→5/1/54；唯一计划 `.plan/T-M4-016-s6-report-rpc.md` 与隔离分支 `agent/T-M4-016-s6-report-rpc` 已建立；测试运行根 `H:\pi-studybuddy-tmp\runs\T-M4-016\`；范围仅 S6 报告 Tab 既有 RPC 接线（reports.list/generate/freeze/get + deliveries.list/deliver/retry + reportTargets.list），`reportTargets.create/update/delete` 不纳入本轮（无 09-UI §4.9 表单 UI 依据，真实地址在 credential-vault 属设置页能力）；不新增 API/handler/schema（contract 保持 127/127），不启动 T-M4-017~021，Git 收口另需授权。依据：用户明确批准（2026-08-11“开始 T-M4-016”）+ AGENTS.md §4.4、§4.5、§5、§8、§11.2。 |
| v0.1.124 | 2026-08-11 | 登记 T-M4-024 完成（模型 provider 接入 + utilityProcess 凭证委托修复）：用户提供 agnes-2.5-flash 并授权配置，真实数据根写入 models.json/pi-models.json/credentials.json（DPAPI）；修复 loader 未注入 modelRuntime 致 key 不生效 + agent-host 无 safeStorage 致 vault 不可用两个生产缺陷（新增 credential-client.ts parentPort 委托 main，credentials.* 改 async CredentialService）；完整应用链路真实验证通过（agent.send 真实 agnes 回复）；§7.6.1 新增 T-M4-024 行 done，§9 统计 M4 总任务 23→24、done 17→18，合计 59→60、53→54；不启动 T-M4-016~021。依据：用户明确指令（2026-08-11“登记 T-M4-024 并提交推送”）+ AGENTS.md §4.5、§7、§8.2、§8.4、§11.1、§11.2。 |
|---|---|---|
| v0.1.123 | 2026-08-11 | T-M4-015 Git 收口完成：功能提交 `7974423` 与治理登记提交 `2d63bf5` 已由 `agent/T-M4-015-s5-cram-rpc` 快进合并进入 `master`；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit/integration 112 files/1079 tests、真实 Electron E2E 20 files/124 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；`git push origin master` 成功并核验 `master=origin/master=2d63bf5`；§7.6.1 状态 in_progress→done，§9 统计 M4 6 pending/1 in_progress/16 done→6 pending/0 in_progress/17 done，合计 6/1/52→6/0/53；无 API/handler/schema 变化，不启动 T-M4-016~021。依据：用户明确 Git 收口授权（2026-08-11“提交 推送 到 远端 然后 合并”）+ AGENTS.md §4.5、§7、§8.2、§8.4、§11.1、§11.2。 |
| v0.1.122 | 2026-08-11 | T-M4-015 双维度独立审查闭环：审查者 A 发现 S5 写 handler 缺 host 侧 archived 防线，补齐 `s5/lookup.ts:assertSemesterWritable` + generatePaper/startAttempt/submitAttempt 三写入口（方法签名不变）；新增 host-boundaries 2 tests；完整质量门复验 unit/integration 112 files/1079 tests、真实 Electron E2E 20 files/124 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check；`.record/T-M4-015-实施记录.md` 已创建；任务保持 in_progress，Git 收口待用户单独授权，不启动 T-M4-016~021。依据：AGENTS.md §4.5、§5、§7、§8.4、§11.2、§11.4。 |
| v0.1.121 | 2026-08-11 | T-M4-015 本地实施与验收证据同步：CramTab 接通既有 S5 RPC（已确认考试门控 + mockExams.* 6 方法 + cramCards.get + cramPlan.get）；RED 初次 8/8 失败后 GREEN；定向 renderer 14 tests + integration 8 tests、真实 Electron E2E 2 tests、Node24 `verify --stage=full` 通过（unit/integration 111 files/1077 tests、真实 Electron E2E 20 files/124 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）；任务保持 in_progress，Git 收口待用户单独授权，不启动 T-M4-016~021。依据：用户明确批准（2026-08-11）+ AGENTS.md §4.5、§5、§7、§8.4、§11.2。 |
| v0.1.120 | 2026-08-11 | 登记 T-M4-015 开工：用户明确选择并批准 S5 冲刺 Tab RPC 接线；§7.6.1 状态 pending→in_progress；§9 统计 M4 7 pending/0 in_progress/16 done→6 pending/1 in_progress/16 done，合计 7/0/52→6/1/52；唯一计划 `.plan/T-M4-015-s5-cram-rpc.md` 与隔离分支 `agent/T-M4-015-s5-cram-rpc` 已建立；测试运行根 `H:\pi-studybuddy-tmp\runs\T-M4-015\`；范围仅 S5 冲刺 Tab 既有 RPC 接线与已确认考试局部显式选择门控（复用既有 `exams.list`）；不新增 API/handler/schema，不启动 T-M4-016~021，Git 收口另需授权。依据：用户明确批准（2026-08-11）+ AGENTS.md §4.4、§4.5、§5、§8、§11.2。 |
| v0.1.119 | 2026-08-11 | T-M4-014 验收缺口补做：用户裁决将 09-UI §4.7 状态筛选纳入；MistakesTab 新增全部/需复习/已掌握三档前端筛选（局部 statusFilter，不新增 RPC/handler/schema）；integration 新增筛选用例，RED 初次失败后 GREEN，定向 26 tests + 真实 Electron E2E 2 tests 通过；同步 `.pi/prompts/task-execution/00-标准任务执行提示词.md` 新增 §2.5 工程进度基线与 §2.6 标准验收清单。依据：用户明确裁决（2026-08-11）+ AGENTS.md §4.5、§5、§11.1、§11.2。 |
| v0.1.118 | 2026-08-11 | T-M4-014 Git 收口完成：功能提交 `cb7d62d` 已由 `agent/T-M4-014-s4-mistakes-rpc` 快进合并进入 `master`；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit/integration 110 files/1068 tests、真实 Electron E2E 19 files/122 tests、contract 127/127、安全 6/6、smoke、docs 治理通过）；`git push origin master` 成功并核验 `master=origin/master=cb7d62d`。T-M4-014 由 in_progress 更新为 done，M4 由 7 pending/1 in_progress/15 done 更新为 7 pending/0 in_progress/16 done，合计由 7/1/51 更新为 7/0/52；无 API/handler/schema 变化，不启动 T-M4-015~021。依据：用户明确 Git 收口授权（2026-08-11“提交 推送”）+ AGENTS.md §4.5、§7、§8.2、§8.4、§11.1、§11.2。 |
| v0.1.117 | 2026-08-11 | T-M4-014 本地实施与验收证据同步：完成 S4 错题 Tab 六个既有 RPC 的 renderer 接线；RED 初次 5/5 失败，GREEN 后定向 renderer 14 tests + integration 6 tests、真实 Electron E2E 1 file/1 test、Node24.14.0/pnpm11.20.0 `verify --stage=full` 通过；双维度独立审查无遗留 P0/P1；创建 `.record/T-M4-014-实施记录.md`；任务保持 in_progress，Git 收口待用户单独授权，不启动 T-M4-015~021。依据：用户明确选择 T-M4-014 + AGENTS.md §4.4、§5、§7、§8.4、§9、§11.2、§11.4。 |
| v0.1.116 | 2026-08-10 | T-M4-013 Git 收口事实同步：功能提交 `7d93560` 已在当前 `master`，`git ls-remote origin refs/heads/master` 核验为同一提交；Node24.14.0/pnpm11.20.0 下 master `pnpm verify -- --stage=full` 返回成功。依据：用户明确选择 T-M4-014 并要求先核对上一任务 + AGENTS.md §4.5、§7、§8.4、§11.1、§11.2。随后登记 T-M4-014 为 in_progress，创建唯一计划 `.plan/T-M4-014-s4-mistakes-rpc.md` 与隔离分支 `agent/T-M4-014-s4-mistakes-rpc`；不改 API/handler/schema，不启动 T-M4-015~021。 |
| v0.1.114 | 2026-08-10 | T-M4-013 独立交叉审查与本地收尾证据同步：审查者 A/B 独立复核覆盖范围、RPC 参数、模块/课程归属、防泄露、竞态/卸载、归档只读、真实 Electron E2E、隐私展示与未授权改动边界；发现的 P1（archived 学期写保护、getResult 失败不可重复 submit、模块归属校验）及 P2（多模块选择、计时/超时、敏感字段实际值、分阶段错误、课程切换/卸载竞态、真实 Electron E2E、归档双层边界）均已修复并复验，无遗留 P0/P1。已创建 `.record/T-M4-013-实施记录.md`（8 章节）。Node24.14.0/pnpm11.20.0 `verify --stage=full` 通过：unit/integration 109 files/1057 tests，真实 Electron E2E 18 files/120 tests，contract 127/127，security 6/6，smoke 6/6，UUID 7/7，docs governance 与 diff-check 通过。T-M4-013 保持 in_progress；Git 收口仍待用户单独授权；`practice.listSessions` 保留为历史契约能力但不纳入本轮 renderer 接线；该范围裁决 supersedes v0.1.112 中的“listSessions 接线”描述，历史记录保留；不启动 T-M4-014~021。依据：AGENTS.md §4.5、§5、§7、§8.4、§9、§11.1、§11.2、§11.4 + 用户明确指令。 |
| v0.1.113 | 2026-08-10 | T-M4-013 本地实现与质量门证据同步：PracticeTab 复用既有 `modules.list` 与 `practice.createSession/getQuestions/submit/getResult`，实现局部显式模块选择、questionCount 5-20、作答前 DTO 防泄露、答案状态/上一题下一题/提交、前端计时与 `practice.timer` 接收、提交后 `getResult`、归档只读、课程切换与卸载竞态保护、固定错误净化；新增 mounted renderer integration 5 tests 和真实 Electron renderer E2E 1 test。RED 初次 3/3 失败已记录。Node24.14.0/pnpm11.20.0 `verify --stage=full` 通过（unit/integration 108 files/1052 tests、真实 Electron E2E 18 files/120 tests、contract 127 handlers/8 PiBridge/35 tools、安全 6/6、smoke 6/6、UUID 7/7、文档治理、diff-check）；任务保持 in_progress，待两名独立审查、实施记录与 Git 收口授权；不启动 T-M4-014~021。原因：用户批准从计划阶段进入业务实施。影响：仅 S3 renderer/UI 与测试/治理证据，不改 API/handler/schema/AppShell 全局状态。依据：用户明确指令 + AGENTS.md §4.4、§4.5、§5、§7、§8、§9、§11.1、§11.2。 |
| v0.1.112 | 2026-08-10 | 登记 T-M4-013 开工：用户明确批准 S3 练习 Tab RPC 接线（createSession + getQuestions + submit + getResult）；§7.6.1 状态 pending→in_progress；§9 统计同步 T-M4-012 done（M4 9 pending/1 in_progress/13 done→9 pending/0 in_progress/14 done）与 T-M4-013 in_progress（→8 pending/1 in_progress/14 done），合计 9 pending/1 in_progress/49 done→8 pending/1 in_progress/50 done；唯一计划 `.plan/T-M4-013-s3-practice-rpc.md` 与隔离分支 `agent/T-M4-013-s3-practice-rpc` 已建立；测试运行根 `H:\pi-studybuddy-tmp\runs\T-M4-013\`；范围仅 S3 练习 Tab 的 createSession/getQuestions/submit/getResult/listSessions/timer 接线与防泄露测试；不新增 API/handler/schema，不启动 T-M4-014~021，Git 收口另需授权。依据：AGENTS.md §4.4、§4.5、§5、§8、§11.2 + 用户明确批准（2026-08-10）。 |
| v0.1.111 | 2026-08-10 | T-M4-012 Git 收口完成：功能提交 `2e1e7f6` 已由 `agent/T-M4-012-s2-notes-rpc` 快进合并进入 `master`；Node24.14.0/pnpm11.20.0 master 完整 `verify --stage=full` 通过（unit 107 files/1047 tests、真实 Electron E2E 17 files/119 tests、contract coverage、desktop security 6/6、smoke、UUID 与文档治理均通过）；`git push origin master` 成功并核验 `master=origin/master=2e1e7f6`。T-M4-012 由 in_progress 更新为 done，不启动 T-M4-013~021。依据：用户明确 Git 收口授权 + AGENTS.md §4.5、§7、§8.2、§8.4、§11.1、§11.2。 |
| v0.1.110 | 2026-08-10 | T-M4-012 证据同步：真实 Electron renderer E2E fixture 改为应用启动前隔离预置，补齐显式选资料→NOT_FOUND→新建保存笔记→模块状态更新路径及 UUID/Windows/POSIX/file URI/错误栈可见文本断言；Node24.14.0/pnpm11.20.0 `verify --stage=full` 通过（unit 107 files/1047 tests、真实 Electron E2E 17 files/119 tests）；两名独立审查复核无 P0/P1。任务保持 in_progress，未执行 commit/merge/push，不启动 T-M4-013~021。依据：用户明确授权继续执行 + AGENTS.md §4.5、§5、§7、§8.4、§9、§11.1、§11.2、§11.4。 |
| v0.1.109 | 2026-08-10 | T-M4-012 开工登记：用户批准 NotesTab 局部显式资料选择；任务 pending→in_progress；唯一计划 `.plan/T-M4-012-s2-notes-rpc.md` 与隔离分支 `agent/T-M4-012-s2-notes-rpc` 已建立；不新增 API/handler/schema，不启动 T-M4-013~021；Git 收口另需授权。 |
| v0.1.108 | 2026-08-10 | T-M4-011 收官登记：Node24 完整质量门（unit/integration 106 files/1037 tests、真实 Electron E2E 16 files/118 tests）、受控文件导入/storage、host archived 写防线、x64 NSIS 新安装目录 target-machine acceptance 均通过；用户明确授权最终治理 commit/push。§7.6.1 状态 in_progress→done，§9 统计 M4 10 pending / 1 in_progress / 12 done→10 pending / 0 in_progress / 13 done，合计 10 pending / 1 in_progress / 48 done→10 pending / 0 in_progress / 49 done；不启动 T-M4-012~021。 |
| v0.1.107 | 2026-08-10 | T-M4-011 target-machine acceptance 已通过：以当前 master 重新构建 x64 NSIS setup，静默安装 exit 0，`package-smoke` 两次已安装应用启动通过真实 Electron、renderer/preload `piBridge`、`system.ping` 与隔离 `global.db`；安装包 SHA-256 `C3D098698A9DC9A2572518184FBC04BEF9039DD834651AEC300B71550424E339`。当前 `master=origin/master=91e92f8`；任务暂保持 in_progress，等待本轮治理证据 commit/push 授权，不启动 T-M4-012~021。 |
| v0.1.106 | 2026-08-10 | T-M4-011 Git 收口已完成：功能提交 `516675b` 快进进入 master，治理同步提交 `73a95ad` 已推送并核验 `master=origin/master=73a95ad`；任务仍 in_progress，仅因 target-machine acceptance pending，不启动 T-M4-012~021。 |
| v0.1.105 | 2026-08-10 | T-M4-011 功能提交 `516675b` 已快进合并进入 master；Node24 master `verify --stage=full` 通过（unit/integration 106 files/1037 tests、真实 Electron E2E 16 files/118 tests）；origin/master push 与 target-machine acceptance 仍待完成，任务保持 in_progress，不启动 T-M4-012~021。 |
| v0.1.104 | 2026-08-10 | T-M4-011 文件导入闭环再校正：main/renderer 传递一次性 `importToken/fileName/fileSize`，S2 生产上传不再向 host 传递源路径；同步 6 files/79 tests 定向复验、106 files/1037 tests 全量 unit/integration 与 verify full 16 files/118 tests。Git 收口已获用户授权，target-machine acceptance 仍 pending，不启动 T-M4-012~021。 |
| v0.1.103 | 2026-08-10 | 用户明确授权解决 P1 后，S2 host 已完成 source file 普通文件校验、真实 stat 大小、原子复制到 `<dataRoot>/<storageKey>`、DB 失败清理；资料转换从 storage 读取已由 handler fixture 和真实 Electron E2E 证明。materials/notes/modules 写 handler 统一拒绝 archived 学期直接 RPC。Node24 定向 5 files/55 tests、资料 E2E 1 file/10 tests、全量 105 files/1036 tests 和 verify full（E2E 16 files/118 tests）均通过；任务仍 in_progress，进入两名最终审查与 Git 收口，不启动 T-M4-012~021。依据：AGENTS.md §5、§7、§8.4、§11.1、§11.4 + 用户明确授权。 |
| v0.1.102 | 2026-08-10 | 用户明确授权环境适配后，Node.js 官方 v24.14.0 已经 SHA-256 校验并安装到用户工具目录，pnpm 11.20.0 经 Corepack 验证；在该基线下 `pnpm test` 105 files/1036 tests、`verify --stage=full`（真实 Electron E2E 16 files/118 tests）均通过。任务仍 in_progress：真实文件导入/storage、host 侧归档写入防线、target-machine acceptance 与 Git 收口未完成，不启动 T-M4-012~021。依据：AGENTS.md §5.3、§7、§8.4、§11.1、§11.2 + 用户明确授权。 |
| v0.1.101 | 2026-08-10 | T-M4-011 本地实施与验收证据同步：MaterialsTab S2 RPC 接线、课程/归档只读门控、dialog/action 竞态隔离、动态刷新测试与 `openFile` 选择限制已完成；定向 3 files/18 tests、资料真实 Electron RPC E2E 1 file/10 tests、type-check/build/smoke/contract/security/UUID/docs/diff 通过。Node25 全量仍有 2 个既有 toolchain `unverified` 失败，真实文件导入/storage、Node24.14.0、target-machine acceptance 与 Git 收口待后续授权/验证；任务保持 in_progress，不启动 T-M4-012~021。依据：AGENTS.md §4.5、§5、§7、§8.4、§11.4 + 用户明确授权。 |
| v0.1.100 | 2026-08-09 | 登记 T-M4-011 开工：T-M4-011 pending→in_progress；创建唯一计划 `.plan/T-M4-011-s2-materials-rpc.md`，切换隔离分支 `agent/T-M4-011-s2-materials-rpc`；范围仅限 S2 资料 Tab 的 list/upload/convert/generateNote、刷新、状态、课程门控与测试，不启动 T-M4-012~021，不执行 Git 收口。依据：AGENTS.md §4.4、§4.5、§5、§8、§11.2 + 用户明确授权。 |
| v0.1.99 | 2026-08-09 | T-M4-023 Git 收口完成：功能提交 `92e0bcb` 已由 `agent/T-M4-023-cross-review-remediation` 快进合并进入 `master`；Node 24.14.0 master 完整 verify full 通过（unit/integration 104 files/1028 tests、真实 Electron E2E 16 files/118 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、文档治理与 `git diff --check` 通过）；治理同步已推送并核验 `master=origin/master`。任务由 in_progress 更新为 done，不启动 T-M4-011~021。依据：AGENTS.md §4.5、§7、§8.2、§8.4、§11.2 + 用户明确授权。 |
| v0.1.98 | 2026-08-09 | T-M4-023 本地修订与验收完成：生产 agent.send 仅真实模型路径或固定 MODEL_NOT_CONFIGURED，测试夹具改为 E2E harness 显式注入；契约覆盖 127/127 + 35 tools + 8 IPC，Node 24.14.0 完整 verify full 通过（unit/integration 104 files/1028 tests、真实 Electron E2E 16 files/118 tests、security 6/6、smoke 6/6、UUID 7/7、文档治理、git diff --check）；任务仍 in_progress，未执行 commit/merge/push，不启动 T-M4-011~021。 |
| v0.1.97 | 2026-08-09 | 登记 T-M4-023 独立交叉审查问题修订：用户明确要求完成审查者 A（架构/契约）与审查者 B（治理/任务）确认的 P0/P1/P2 问题；创建唯一计划 `.plan/T-M4-023-cross-review-remediation.md`，任务状态 pending→in_progress，切换隔离分支 `agent/T-M4-023-cross-review-remediation`。范围仅限生产 agent.send 模型路径、契约覆盖阻塞校验、真实 Electron 代表性路由、历史审计恢复、默认 Tab/credential-vault/文档元数据同步；不启动 T-M4-011~021，未授权 Git 收口。依据：AGENTS.md §4.4、§4.5、§5、§8、§11.2、§11.4 + 用户明确授权。 |
| v0.1.96 | 2026-08-09 | T-M4-010 Git 收口完成：功能提交 `a06d8a5` 已快进合并进入 `master`，Node 24.14.0 master 完整质量门复验通过（contract 127/127、安全 6/6、UUID 7/7、文档治理与 `git diff --check` 通过）；网络恢复后T-M4-010 历史关闭点为 `b9a3c49`；当前仓库基线为 `6cd1e903`，最终治理同步随后推送并复验。§7.6.1 状态 in_progress→done，§9 统计 M4 9 pending / 1 in_progress / 10 done→9 pending / 0 in_progress / 11 done，合计 9 pending / 1 in_progress / 46 done→9 pending / 0 in_progress / 47 done。无 API/handler/schema 变化，不启动 T-M4-011~021。依据：AGENTS.md §4.5、§7、§8.2、§8.4、§11.2 + 用户明确授权。 |
| v0.1.95 | 2026-08-09 | 修正 T-M4-010 远端收口事实：本地 `master` 已快进至 `3aa51a7`，Node 24.14.0 master 完整质量门、contract 127/127、安全 6/6、UUID 7/7、文档治理与 `git diff --check` 通过；两次 `git push origin master` 因 GitHub 连接重置失败，任务继续 in_progress，M4 统计恢复为 9 pending / 1 in_progress / 10 done，合计 9 pending / 1 in_progress / 46 done。无 API/handler/schema 变化，不启动 T-M4-011~021。依据：AGENTS.md §4.5、§7、§8.4、§11.2 + 远端网络错误证据。 |
| v0.1.92 | 2026-08-09 | 登记 T-M4-010 开工：前置 T-M4-008 与 T-M4-009 已完成并推送；用户明确授权实施，创建唯一计划 `.plan/T-M4-010-s1-home-rpc.md` 并切换 `agent/T-M4-010-s1-home-rpc`。§7.6.1 状态 pending→in_progress，§9 统计 M4 10 pending / 0 in_progress / 10 done→9 pending / 1 in_progress / 10 done，合计 10 pending / 0 in_progress / 46 done→9 pending / 1 in_progress / 46 done。范围仅首页按当前学期/课程加载 `tasks.dailyBrief`、`tasks.list`、`exams.list` 的真实 RPC 与异步状态；不新增 API/handler/schema，不启动 T-M4-011~021，Git commit/merge/push 未获授权。依据：AGENTS.md §4.4、§4.5、§5、§8、§11.2 + 用户明确授权。 |
| v0.1.91 | 2026-08-09 | T-M4-009 Git 收口完成：用户明确授权后，功能提交 `36202b0` 已由 `agent/T-M4-009-electron-builder` 快进合并进入 `master`；Node 24.14.0 完整 `pnpm verify --stage=full` 在 master 复验通过（unit/integration 103 files/1022 tests、真实 Electron E2E 16 files/117 tests、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7、文档治理与 `git diff --check` 通过），治理提交随后推送 `origin/master`。§7.6.1 状态 in_progress→done，§9 统计 M4 11 pending / 1 in_progress / 9 done→10 pending / 0 in_progress / 10 done，合计 10 pending / 0 in_progress / 46 done。无 API/handler/schema 变化，T-M4-010~021 保持 pending，不自动启动。依据：AGENTS.md §4.5、§7、§8.2、§8.4、§11.2 + 用户明确授权。 |
| v0.1.90 | 2026-08-09 | T-M4-009 本地实施与验收完成，任务保持 in_progress：electron-builder `26.15.3` 精确锁定，新增 `package:win` / `package:smoke` 与 x64 NSIS 配置；Windows x64 setup 已在任务隔离目录构建并静默安装，安装目录两次真实 Electron 启动完成 app renderer、preload piBridge、`system.ping` 和隔离 `global.db` 验证；setup SHA-256 见实施记录。Node 24.14.0 下 unit/integration 103 files/1022 tests、真实 Electron E2E 16 files/117 tests、verify full、contract 127/127、security 6/6、smoke 6/6、UUID 7/7、文档治理与 diff 检查通过。无 API/handler/schema 变更，不启动 T-M4-010~021；未获用户 Git 收口授权，未 commit/merge/push。依据：AGENTS.md §4.5、§5、§7、§8、§11.2。 |
| v0.1.89 | 2026-08-09 | 登记 T-M4-009 开工：前置 T-M4-008 已完成并推送；用户已明确批准唯一计划 `.plan/T-M4-009-electron-builder.md`，§7.6.1 状态由 pending→in_progress，§9 统计 M4 11 pending / 1 in_progress / 9 done、合计 11 pending / 1 in_progress / 45 done。范围仅含 electron-builder、Windows x64 NSIS setup 和真实安装启动验证；不启动 T-M4-010~021，不新增 API/handler/schema，不执行 Git 收口。依据：AGENTS.md §4.4、§4.5、§5、§8、§11.2。 |
| v0.1.88 | 2026-08-09 | T-M4-008 收口完成：AppShell→Tab 统一学术上下文、只读数据生命周期与竞态/卸载保护已交付；Node 24.14.0 在 master 复验通过（unit/integration 102 files/1017 tests、真实 Electron E2E 16 files/117 tests、contract 127/127、security 6/6、smoke 6/6、UUID 7/7、文档治理与 diff 检查通过）；功能提交 `76bef58` 已快进合并并推送 `origin/master`。T-M4-008 状态 in_progress→done；M4 统计为 12 pending / 0 in_progress / 9 done，总计 12 pending / 0 in_progress / 45 done；无 API/handler/schema 变化，不启动 T-M4-009~021。 |
| v0.1.85 | 2026-08-09 | T-M4-007 学期/课程切换 UI 收尾：功能提交 `9e5116f` 已快进合并至 master，Node 24.14.0 完整 `pnpm verify -- --stage=full` 在 master 复验通过；中间治理提交 `9493f99` 已与功能提交成功推送 `origin/master`。§7.6.1 状态 in_progress→done，§9 统计 M4 14 pending / 0 in_progress / 8 done、全局 14 pending / 0 in_progress / 44 done。无 API/handler/schema 变更，T-M4-008~021 未启动。依据：AGENTS.md §4.5、§7、§8.2、§8.4、§11.2 + 用户明确授权。 |
| v0.1.84 | 2026-08-09 | 用户明确授权 Git 收口后，T-M4-007 功能提交 `9e5116f` 已创建并经 `git merge --ff-only agent/T-M4-007-semester-course-ui` 快进进入 `master`；Node 24.14.0 下 `pnpm verify -- --stage=full` 在 master 复验通过（unit/integration 101 files/1015 tests、真实 Electron E2E 16 files/117 tests），日志为 `H:\pi-studybuddy-tmp\runs\T-M4-007\verify-full-master.log`。原因：落实 AGENTS.md §7、§8.2、§8.4 的 Git 收口顺序。影响：首次 `origin/master` 推送前任务仍为 in_progress，统计不提前变更；无 API/handler/schema 变更，T-M4-008 未启动。依据：AGENTS.md §4.5、§7、§8.2、§8.4、§11.2 + 用户明确授权。 |
| v0.1.83 | 2026-08-09 | 同步 T-M4-007 最终本地验证与复审证据：Node 24.14.0 `verify --stage=full` 退出码 0（unit/integration 101 files/1015 tests、真实 Electron E2E 16 files/117 tests）、UUID 7/7、文档治理和 `git diff --check` 通过；Mill、Erdos 两名独立审查最终 PASS，实施记录测试证据已回填。原因：完成 §7 受控收尾中的本地复验与 §11.4 交叉审查闭环。影响：任务仍为 in_progress，Git 未获授权；无 API/handler/schema 变更，不启动 T-M4-008。依据：AGENTS.md §4.5、§7、§8.4、§11.1/§11.2/§11.4 + 用户明确授权。 |
| v0.1.82 | 2026-08-09 | 同步 T-M4-007 本地收尾证据：左栏学期/课程树、AppShell 唯一上下文与标题、archived 只读浏览、按学期隔离的课程请求竞态/卸载保护、安全化错误显示已完成；新增记录型 RPC 测试和 happy-dom 实际挂载 AppShell 的 deferred-RPC 测试，`.record/T-M4-007-实施记录.md` 已建立。原因：补齐任务状态和审计证据，并修复 AGENTS/索引/计划漂移。影响：T-M4-007 仍为 in_progress，最终质量门和两名独立审查收口中，Git 未获授权；无 API/handler/schema 变化，T-M4-008 未启动。依据：AGENTS.md §4.5、§5、§7、§8.4、§11.1/§11.2/§11.4 + 用户明确授权。 |
| v0.1.81 | 2026-08-09 | 登记 T-M4-007 开工：用户在本次唯一 Prompt 中明确批准计划并授权实施；建立 `.plan/T-M4-007-semester-course-ui.md`，任务由 pending→in_progress。范围为左侧学期/课程树、标题栏动态绑定、AppShell 最小当前上下文、请求竞态和安全化错误显示；不新增 API、不实施 T-M4-008、不执行 Git commit / merge / push。§9 统计同步为 M4 14 pending / 1 in_progress / 7 done、全局 14 pending / 1 in_progress / 43 done。依据：AGENTS.md §4.4、§4.5、§5、§9、§11.2 + 用户明确授权。 |
| v0.1.80 | 2026-08-09 | T-M4-006 设置页 UI 收尾：用户明确授权 Git 收口后，功能提交 `0e378c0` 已在 `agent/T-M4-006-settings-ui` 创建、`master` 快进合并并复验，且已推送 `origin/master`；§7.6.1 状态 in_progress→done，§9 统计 M4 15 pending / 0 in_progress / 7 done、全局 15 pending / 0 in_progress / 43 done。Node 24.14.0 `scripts/verify.mjs --stage=full` 已通过（contract 127 handlers、smoke 6/6、真实 Electron E2E 16 files/117 tests）；不新增 API，不启动 T-M4-007。依据：AGENTS.md §4.5、§7、§8.3、§8.4、§11.2 + 用户明确授权。 |
| v0.1.79 | 2026-08-09 | 同步 T-M4-006 质量门运行时一致性修复：`scripts/verify.mjs` 以其 `process.execPath` 的目录前置子进程 PATH，使显式 Node 24.14.0 启动的质量门中 npm/npx/node 也使用 Node 24，而不被 PATH 的 Node 25.4.0 覆盖；完整 verify full 复验通过（含 unit/integration、contract 127 handlers、安全不变量、build、smoke 6/6、真实 Electron E2E 16 files/117 tests）。原因：原全量 RED 显示 Node 25 被探测为 unverified，与 Node 24 验证基线不一致。影响：仅质量门一致性和任务证据；无 API 变化，T-M4-006 依 Git 门槛仍为 in_progress，T-M4-007~021 不启动。依据：AGENTS.md §4.5、§5.1、§7、§8.4、§10、§11.1/§11.2 + 用户 2026-08-09 授权。 |
| v0.1.78 | 2026-08-09 | 同步 T-M4-006 最终交叉审查与 diff 证据：Heisenberg/Epicurus 两名独立审查最终 PASS；Epicurus 发现的 `AppShell.tsx` EOF 空白行已删除，`git diff --check` 复验通过。任务仍为 in_progress，因 Git 提交、master 复验与 origin/master 推送未经用户授权，尚未满足 AGENTS.md §8.4。原因：受控收尾与 §11.4 交叉审查要求治理 SoT 反映最终事实。影响：仅审查/质量证据与版本登记；无 API 变更、无后续任务启动。依据：AGENTS.md §4.5、§7、§8.4、§11.1/§11.2/§11.4 + 用户 2026-08-09 授权 |
| v0.1.77 | 2026-08-09 | 同步 T-M4-006 实施与质量门事实：设置页/AppShell、精确 RPC/导航 TDD、局部慢探测测试时限、实施记录和 Node 24.14.0 `verify --stage=full` 已完成（smoke 6/6、真实 Electron E2E 16 files/117 tests）；任务保持 in_progress，因用户未授权提交/推送，未满足 AGENTS.md §8.4 完成判据。原因：受控收尾要求任务状态与证据一致。影响：仅任务事实、测试稳定性与治理证据；无 API 变更、无后续任务启动。依据：AGENTS.md §4.5、§5、§7、§8.4、§11.1/§11.2 + 用户 2026-08-09 授权 |
| v0.1.76 | 2026-08-09 | 同步 T-M4-006 真实施工状态：用户已明确批准计划，任务已进入 RED→GREEN、设置页/AppShell 组装与定向 type-check 阶段，仍为 in_progress。原因：独立审查发现登记“待用户审查；尚未写业务代码”与实际实施冲突。影响：仅状态事实、治理阶段与证据描述同步；不提前标记 done，不变更 API 或启动后续任务。依据：AGENTS.md §4.5、§11.1/§11.2 + 用户 2026-08-09 授权 |
| v0.1.75 | 2026-08-09 | 登记 T-M4-006 开工：pending→in_progress；唯一执行计划 `.plan/T-M4-006-settings-ui.md` 已创建，状态为待用户审查，尚未写业务代码。计划裁决为左侧“⚙ 设置”入口 + `Ctrl+,` 打开独立页面，不新增第 10 个 Tab 或 Api 方法；密钥仅 `listKeys/set/delete`，绝不回显；数据根仅显示脱敏状态，不显示绝对路径或伪造磁盘容量。原因：用户明确选择 M4 执行顺序第 25 项，T-M4-003/T-M4-022 已 done。影响：仅任务状态、统计、唯一计划和治理登记同步；M4 pending 16→15、in_progress 0→1、done 6 不变；代码/契约未变。依据：AGENTS.md §4.4/§4.5/§5/§9/§11.2 + 用户 T-M4-006 Prompt |
| v0.1.74 | 2026-08-09 | 登记 T-M4-022 完成：in_progress→done；master 复验通过，提交 `0ec4163`，并已推送 `origin/master`。质量门使用 Node 24.14.0 的 `pnpm verify` exit 0，真实 Electron E2E 16 files/117 tests 全通过；M4 统计 pending 16 + in_progress 0 + done 6，合计 pending 16 + done 42。原因：用户明确授权执行提交与推送。影响：仅状态、统计和 Git 证据同步；T-M4-006~021 仍 pending。依据：AGENTS.md §7/§8.3/§8.4 + 用户明确授权 |
| v0.1.73 | 2026-08-08 | T-M4-022 真实 Electron E2E 证据补强：旧业务 harness 的 Node `fork(test-main.js)` 路径已删除，`electron-launcher.ts` 直接启动 Electron 36.9.5，`test-main.js` 通过仅监听 `127.0.0.1` 的 TCP JSON-lines 收发 RPC；新增 runtime sentinel，完整 E2E 由真实 Electron 通过（16 files / 117 tests）。原因：用户 Prompt 明确禁止 Node 子进程冒充真实 Electron E2E；实测 Electron 主进程不可靠接收 stdin pipe，故采用回环 TCP。影响：仅测试边界/注释/证据同步，无生产 API 或业务范围变化；T-M4-022 仍因未获 Git 收口授权保持 in_progress。依据：AGENTS.md §4.5/§5.3/§9.1/§11.2 + 用户 T-M4-022 Prompt + `.record/T-M4-022-实施记录.md` |
| v0.1.72 | 2026-08-08 | T-M4-022 实施与质量门证据登记：Electron 从 33.4.11 升级并精确锁定 36.9.5（实测内嵌 Node 22.19.0，`node:sqlite` 可用），修复 sandbox preload、utility process ready/MessagePort 接线与 host port 复用，新增真实 Electron 黑盒测试与桌面双启动 smoke。质量门通过：真实运行时 6/6、完整 E2E 15 files/116 tests、Node 24.14.0 `pnpm test`、Node 22 `pnpm verify`、type-check/build/smoke/contract/security/UUID/docs/diff-check 全通过；两名独立审查完成，无未处置阻塞洞。默认 Node25 仅触发既有 toolchain unverified 政策测试，未改阈值，已用 Node24.14.0 复验。影响：仅运行时修复、测试与证据同步，无契约方法新增，不修改设置页、Provider UI、S1-S7 Tab、TTS 或备份恢复业务。因尚未获用户 Git 收口授权，未 commit/push，任务继续保持 in_progress。依据：AGENTS.md §4.5/§7/§8.4/§11.2/§11.4 + 01-TRD §7 决策6 + 03-Arch §4.3/§6.2 + 05-ERD §2 + 08-Test §5/§6 + `.record/T-M4-022-实施记录.md` |
| v0.1.71 | 2026-08-08 | 登记 T-M4-022 in_progress：Electron 生产运行时 / SQLite 兼容修复 + 真实桌面启动验证。新增原因：当前 Electron 33.4.11 内嵌 Node 20 与数据层 `process.getBuiltinModule("node:sqlite")` / `DatabaseSync` 的生产路径不一致，既有 E2E 使用系统 Node 子进程绕过真实 Electron，必须先解决 P0 启动阻塞。影响：M4 任务 21→22，T-M4-022 插入 T-M4-005 后、T-M4-006 前；M4 pending 16、in_progress 1、done 5；合计 58。无契约方法新增，不修改设置页、Provider UI、S1-S7 Tab、TTS 或备份恢复业务。当前仅完成治理登记与唯一计划，代码实施待用户批准计划。依据：AGENTS.md §4.4/§4.5/§7 + 01-TRD §7 决策6 + 03-Arch §4.3/§6.2 + 08-Test §5/§6 + 用户明确提供的 T-M4-022 Prompt |
| v0.1.70 | 2026-08-08 | 登记 T-M4-004 + T-M4-005 完成（后端断裂修复批次 2——断裂 2+3 修复，后端 5 处断裂全部修复）：§7.6.1 登记表 T-M4-004 done + T-M4-005 pending→done + §9 统计 M4 pending 17→16 + done 3→5（合计 pending 17→16 + done 39→41）。原因：T-M4-004 studybuddy-extension 接入 pi 内核（src/agent-host/studybuddy-extension-loader.ts createStudyBuddySession 动态 import() 加载 pi 内核 + createAgentSessionServices + createAgentSessionFromServices + 35 studybuddy_* 工具注册验证）+ T-M4-005 agent.send 接真实 pi 内核流式回复（src/agent-host/handlers/agent.ts 双路径：真实 pi 内核 prompt() + 受控夹具 fallback，事件映射 agent_start→message_start / text_delta→token / tool_execution_start→tool_call / tool_execution_end→tool_result / compaction_end→context_compressed，toolCallId 本地 call-<n> 脱敏 + inputSummary/resultSummary UUID 过滤截断 + index.ts fire-and-forget 异步初始化 + VITEST 环境保护）。关键技术决策：pi-coding-agent 是 ESM-only 包（package.json exports 仅 import 无 require），CJS 编译产物用 new Function("return import(s)") 阻止 tsc 降级 + VITEST 环境直接 import() 双路径。质量门全通过：type-check + 991 单元/集成测试 + 110 E2E 测试（14 文件全绿）+ build + smoke 6/6 + verify full 全绿 + 契约覆盖 127 handlers + 安全不变量 6/6。影响：版本号同步 + 状态登记 + 后端断裂 2/3 修复（无契约方法新增，Api 方法总数仍 127）。后端 5 处断裂全部修复，M4 剩余 pending：T-M4-006~021（设置页/学期切换/AppShell/打包/S1-S7 接线/E2E/收官）。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 + §8.4 完成判据 |
| v0.1.69 | 2026-08-08 | 登记 T-M4-001/002/003 三任务完成（后端断裂修复批次 1）：§7.6.1 登记表 T-M4-001 in_progress→done + T-M4-002 pending→done + T-M4-003 pending→done + §9 统计 M4 pending 20→17 + in_progress 1→0 + done 0→3（合计 pending 20→17 + in_progress 1→0 + done 36→39）。原因：T-M4-001 main.ts 数据根初始化（src/main/data-root-init.ts initializeDataRoot 建 global.db + 6 子目录 + main.ts whenReady 装配）+ T-M4-002 agent-host 生产入口装配 S1-S7/TTS/Backup 9 类 handler（src/agent-host/index.ts createBusinessHandlers 复用 studybuddy-extension 上下文创建模式）+ T-M4-003 credentials.*/settings.* handler（src/agent-host/handlers/credentials.ts 4 方法封装 CredentialVault + settings.ts 4 方法 + src/agent/settings-config.ts 原子写 config/settings.json）。质量门全通过：type-check + 979 单元/集成测试 + build + smoke 6/6 + 安全不变量 6/6。影响：仅版本号同步 + 状态登记 + 后端断裂 1/4/5 修复，无权威条款变更（无契约方法新增，Api 方法总数仍 127）。M4 剩余 pending：T-M4-004/005（后端断裂 2/3 修复）+ T-M4-006~021。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 + §8.4 完成判据 |
| v0.1.68 | 2026-08-08 | M4 重新规划（后端断裂修复前置）：① 重新读系统设计（03-Arch/06-API/09-UI）对比代码发现 5 处后端断裂（E2E 全绿但生产不可用）：断裂1 agent-host 生产入口只装 6 类 handler（S1-S7/TTS/Backup 9 类未装配）+ 断裂2 studybuddy-extension 35 工具 6 钩子无生产调用（extension-loader 不存在）+ 断裂3 agent.send 是受控夹具（假 TOKEN_FRAGMENTS）+ 断裂4 main.ts 未初始化 global.db + 断裂5 credentials/settings handler 完全不存在 ② M4 任务 18→21：新增 5 个 P0 后端断裂修复 T-M4-001~005（数据根初始化/handler 装配/credentials+settings/extension 接入 pi/agent.send 接真实 pi）③ 原 T-M4-001~018 重编号为 T-M4-006~021（设置页→006/学期切换→007/AppShell→008/打包→009/S1-S7 接线→010~017/TTS→018/备份→019/E2E→020/收官→021）④ §6.6 退出门槛增"后端 5 处断裂全部修复"项 ⑤ §7.6/§7.6.1 大纲与登记表重写（21 任务）⑥ §7.5 执行顺序表 M4 行 19-36→19-39 重排（P0 后端修复 19-23 → P0 基础 UI 24-26 → P0.5 打包 27 → P1 接线 28-32 → P2 接线 33-35 → P3 辅助 36-37 → P4 收尾 38-39）⑦ §9 统计 M4 18→21 + 合计 54→57。原因：用户"重新读系统设计重新安排任务力争按系统设计完成系统直到系统如期运行"。影响：M4 任务结构重排 + 后端断裂修复前置，无权威条款变更（无契约方法新增，Api 方法总数仍 127）。M4 全部 21 任务 pending。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §11.2 修订纪律 + 03-Arch §6.2 生产入口装配要求 + 用户明确指令 |
| v0.1.66 | 2026-08-08 | 新增 M4 里程碑（业务接线 + 打包部署）：§6.6 M4 退出门槛 7 项 + §7.6 M4 任务大纲 18 任务（P0 设置页/学期切换/AppShell 数据流 + P1 S1-S4 接线 + P2 S5-S7 接线 + P3 TTS/备份 + P4 打包/E2E）+ §7.6.1 M4 任务登记表 T-M4-001~018 全 pending + §7.5 全局执行顺序表追加 M4 行 19-36 + §9 统计加 M4 行（18 pending）+ 合计 36→54 + §6.0 版本演进说明同步 01-TRD v0.2.3（打包能力常态化，supersedes v0.2.2 "不打包 .exe"）。原因：M3 收官后人工检验发现前端 127 RPC handler 仅接通约 12 个（AI 对话线），S1-S7 业务 Tab + TTS + 备份恢复 UI 均"有壳无接线"，设置页/学期切换 UI 完全缺失；用户 2026-08-08 明确指令"系统不管什么时候，只要功能正常，就要能够被打包"。影响：01-TRD v0.2.3 决策 6 修订（权威条款变更，打包能力常态化）+ 04-Todo M4 里程碑登记（无契约方法新增，Api 方法总数仍 127）。M4 全部 18 任务 pending。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §11.2 修订纪律 + 01-TRD §7 决策 6 v0.2.3 |
| v0.1.65 | 2026-08-08 | 登记 T-M3-008 完成：§7.4.1 登记表 T-M3-008 in_progress→done + §6.5 M3 退出门槛六项全勾选 + §9 统计 M3 in_progress 1→0 + done 7→8（合计 in_progress 1→0 + done 35→36，M3 全部 8 任务完成，v0.1 开发收官）。原因：T-M3-008 E2E-01~13 全链回归 + 安全不变量最终校验实施完成，质量门全通过（type-check + 966 单元/集成测试 + 110 E2E 测试（14 文件全绿）+ build + smoke 6/6 + verify full 全绿 + 文档治理（1 条非阻塞警告）+ 契约覆盖 127 handlers + 安全不变量 6/6 + UUID 泄漏 7/7 + git diff --check 无空白错误）。核心动作：E2E_RUN_DIR 切换 runs\T-M3-007 → runs\T-M3-008（electron-launcher.ts:5+20 + e2e-10~13 头部注释 5 处）+ §11.4 交叉审查（2 独立审查者：子代理审查 4 PASS + 2 WARNING + 0 FAIL，W1 注释残留已修正；主会话第二轮审查确认 6 项全 PASS，无阻塞性洞）。影响：仅状态登记 + 统计数字 + §6.5 退出门槛全勾选 + 5 处注释路径切换（无契约方法新增，Api 方法总数仍 127）。M3 收官，v0.1 开发收官。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 + §8.4 完成判据 + §11.4 交叉审查元纪律 |
| v0.1.64 | 2026-08-08 | 登记 T-M3-008 开工：§7.4.1 登记表 T-M3-008 pending→in_progress（E2E-01~13 全链回归 + 安全不变量最终校验，M3 收官，P0，测试，阶段5）+ §9 统计 M3 pending 1→0 + in_progress 0→1（合计 pending 1→0 + in_progress 0→1）。原因：用户批准 T-M3-008 开工（§7.5 全局执行顺序表第 18 行，前置依赖 T-M1-010 + T-M2-009 + T-M3-007 三者均 done，T-M3-007 已收尾 master `0e350be` + origin/master 推送）。任务性质：回归 + 校验型（非新功能开发），核心动作 E2E_RUN_DIR 切换 runs\T-M3-007 → runs\T-M3-008 + pnpm test:e2e 110 全绿 + check-desktop-security.mjs 6/6 + check-uuid-leak.mjs 7/7 + §11.4 交叉审查 + §6.5 M3 退出门槛六项全勾选。开工 Prompt 落盘 H:\pi-studybuddy-tmp\prompts\T-M3-008-start-prompt.md（仓库外，不进 Git）。影响：仅版本号同步 + 状态登记，无权威条款变更（无契约方法新增，Api 方法总数仍 127）。M3 收官任务，完成后 M3 done 8/8 + v0.1 开发收官。依据：AGENTS.md §4.4 单一执行任务门禁 + §4.5 任务状态不得只存在于聊天 + §11.2 修订纪律 |
| v0.1.63 | 2026-08-08 | 登记 T-M3-007 完成：§7.4.1 登记表 T-M3-007 in_progress→done（E2E-10~13 对话默认主入口/工具调用/@引用/TTS+L3 检索：① test-main.js 装配 createAgentHandlers/createSessionHandlers/createModelHandlers/createFileHandlers（files.read @引用白名单）+ test.turnEndIndex 直调生产 indexTurnEndChunks ② agent.events 事件推送承载（IPC {"type":"event","topic","payload"} + eventForwardServer shim）③ RpcDriver waitForEvent 订阅辅助（事件缓冲回溯 + 谓词匹配）④ electron-launcher E2E_RUN_DIR → runs\T-M3-007\ + reuseDataRoot 二次 launch 重启语义（L3 跨进程持久化）⑤ 4 个 E2E 文件：E2E-10 对话默认主入口+流式事件序列（message_start→token→context_compressed）+防泄露 / E2E-11 触发词→tool_call/tool_result 事件对+toolJumpTarget 映射（出题→练习 Tab）+sessionMeta 写回 / E2E-12 @引用 allowed-roots 白名单通过+越权拒绝+相对路径解析+TTS 朗读+标记已复习 / E2E-13 turn_end 增量索引幂等+跨进程持久化（二次 launch sessions.search 命中）+search 无 UUID ⑥ 三处根因修复：global.sql.ts 建表/索引幂等 IF NOT EXISTS（复用 dataRoot 二次启动不报 already exists）+ indexer.ts openConversationDb 建父目录（memory/l3/ 不存在报 unable to open） + turn-end.ts indexTurnEndChunks 幂等计数修正（seq 推进 + RETURNING id 判定实际新增，修 seq0 重复 chunk 与 written 虚增））+ §9 统计 M3 in_progress 1→0 + done 6→7（合计 in_progress 1→0 + done 34→35）。原因：T-M3-007 实施完成，质量门全通过（type-check + 966 单元/集成测试 + 110 E2E 测试（+27）+ build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6 + UUID 泄漏 7/7）。影响：状态登记 + 统计数字 + 三处承载层幂等/目录/计数修复（无契约方法新增，Api 方法总数仍 127）。M3 剩余 pending：T-M3-008。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 + §8.4 完成判据 |
| v0.1.62 | 2026-08-08 | 登记 T-M3-007 开工：§7.4.1 登记表 T-M3-007 pending→in_progress（E2E-10~13 对话默认主入口/工具调用/@引用/TTS+L3检索：① test-main.js 装配 agent.send + sessions.* + modelsConfig.get/set handler（复用 dist createAgentHandlers/createSessionHandlers/createModelHandlers）② agent.events 事件推送承载（IPC {"type":"event","topic":"agent.events",...}）③ RpcDriver waitForEvent 订阅辅助 ④ E2E-10~13 四个测试文件 ⑤ electron-launcher E2E_RUN_DIR → runs\T-M3-007\ + 二次 launch 复用 dataRoot，测试，阶段5）+ §9 统计 M3 pending 2→1 + in_progress 0→1（合计 pending 2→1 + in_progress 0→1）。原因：用户批准 T-M3-007 开工（§7.5 全局执行顺序表第 17 行，前置依赖 T-M3-001~006 done，T-M3-006 已收尾 master 68d7352 + origin/master 推送）。Prompt 工程现状核实通过（test-main.js 缺 agent/sessions/modelsConfig handler 为核心增量；RpcDriver 走 Node IPC 非 stdin/stdout 一处非阻塞描述偏差）。影响：仅状态登记 + 统计数字，无权威条款变更（无契约方法新增，Api 方法总数仍 127）。M3 剩余 pending：T-M3-008。依据：AGENTS.md §4.4 单一执行任务门禁 + §4.5 任务状态不得只存在于聊天 + §11.2 修订纪律 |
| v0.1.58 | 2026-08-08 | 登记 T-M3-005 开工：§7.4.1 登记表 T-M3-005 pending→in_progress（model_select / turn_end 钩子：多模型持久化 + L3 增量索引，扩展层，阶段3）+ §9 统计 M3 pending 4→3 + in_progress 0→1（合计 pending 4→3 + in_progress 0→1）。原因：用户批准 T-M3-005 开工（§7.5 全局执行顺序表第 15 行，前置依赖 T-M3-001 done）。五裁决：① 落点=业务数据根 config/models.json（managed 标记 + 原子写 + 测试隔离，同步修订 03-Arch §2.3/08-Test §4.2/06-API §3.13/09-UI §9.2 加 supersedes，解决 4 文档 ~/.pi/agent/models.json vs AGENTS.md §9.5 物理隔离冲突）② turn_end 源=assistant + tool 不读 ~/.pi（复合键 sessionId:turnIndex:role:seq 幂等 + max(last_offset) 增量）③ handler 范围=modelsConfig.get/set 两个（test/addProvider/probe 留后续）④ 写文件分工=扩展层钩子 + agent-host 共用 model-config 模块（单写进程无并发）⑤ 真实模型配置（用户提供 agnes 多媒体 + deepseek 文字）仅纳 provider/model 别名入 config + key 入 credential-vault（modelProvider:<provider>，DPAPI，不含明文）。影响：仅状态登记 + 统计数字，无权威条款变更（4 文档 supersedes 收尾时经批准修订）。M3 剩余 pending：T-M3-006~008。依据：AGENTS.md §4.4 单一执行任务门禁 + §4.5 任务状态不得只存在于聊天 + §11.2 修订纪律 |
| v0.1.61 | 2026-08-08 | 登记 T-M3-006 完成：§7.4.1 登记表 T-M3-006 in_progress→done（09-UI 对话 Tab 业务 UI + 会话管理 UI：① SessionStore 扩展（rename 更新名称+updatedAt/空名拒绝 + export md|json→{path} 写 <dataRoot>/exports/ 脱敏 UUID/sk-* + makeContext 提取）② SessionSummary.unread? 可选字段 ③ sessions.rename/export handler 补齐（exportDir 注入，集成测试 PI_STUDYBUDDY_DATA_ROOT 隔离）④ SessionSidebar 组件（日期分组今天/昨天/本周 groupLabel + 搜索框 + subjectColor 学科颜色 + unread 徽标 + 新建会话 Ctrl+N + 选中高亮 + 重命名/删除/导出操作）⑤ AppShell 接线（activeSessionId/sidebarSessions/searchQuery 状态提升，sessions.search L3 未建库降级内存过滤）⑥ ChatTab 受控业务态（activeSessionId 标题栏/无匹配提示 + sessionLoadError 错误态重试）⑦ renderer-layout 左侧栏断言随权威变更更新 + 27 新增测试）+ §9 统计 M3 in_progress 1→0 + done 5→6（合计 in_progress 1→0 + done 33→34）。原因：T-M3-006 实施完成，质量门全通过（type-check + 966 单元/集成测试（+27）+ 83 E2E 测试 + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 127 handlers + 安全不变量 6/6 + UUID 泄漏 7/7）。影响：状态登记 + 统计数字 + 06-API §3.1 rename/export 落地（无契约方法新增，Api 方法总数仍 127，仅 SessionSummary.unread? 可选字段向后兼容）。M3 剩余 pending：T-M3-007~008。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 + §8.4 完成判据 |
| v0.1.60 | 2026-08-08 | 登记 T-M3-006 开工：§7.4.1 登记表 T-M3-006 pending→in_progress（09-UI 对话 Tab 业务 UI + 会话管理 UI：SessionSidebar 日期分组/模糊搜索/unread/学科标签颜色/新建 + sessions.rename/export handler 补齐 + 会话切换/重命名/删除/导出 + ChatTab 业务态补全，壳层，阶段4）+ §9 统计 M3 pending 3→2 + in_progress 0→1（合计 pending 3→2 + in_progress 0→1）。原因：用户批准 T-M3-006 开工（§7.5 全局执行顺序表第 16 行，前置依赖 T-M3-001 + T-M1-009 模式，T-M3-005 已收尾 master a7b5db7 + origin/master 推送）。五裁决：① export 落点=runs 测试隔离目录（H:\pi-studybuddy-tmp\runs\T-M3-006\exports\，不污染业务数据根）② 新建会话=内存仓库空白会话 + 立即成为当前会话（Ctrl+N）③ unread=SessionSummary 加可选字段 + fixture 演示值（无后台事件源仅展示）④ backup_* 无目标 Tab（T-M3-004 裁决 1a 遗留）确认维持不渲染跳转按钮，留 T-M3-008 最终评估 ⑤ 选中会话状态=AppShell 提升（跨 Tab 保持）。影响：仅状态登记 + 统计数字，无权威条款变更。M3 剩余 pending：T-M3-007~008。依据：AGENTS.md §4.4 单一执行任务门禁 + §4.5 任务状态不得只存在于聊天 + §11.2 修订纪律 |
| v0.1.59 | 2026-08-08 | 登记 T-M3-005 完成：§7.4.1 登记表 T-M3-005 in_progress→done（model_select / turn_end 钩子：① model-config 模块（src/agent/model-config.ts readModelConfig/writeModelConfig 原子写 + __studybuddy_managed 标记 + <dataRoot>/config/models.json）② 扩展层 2 钩子注册（model_select 持久化默认模型 + turn_end L3 增量索引 assistant+tool → chunks/chunks_fts，复合键 sessionId:turnIndex:role:seq 幂等 + max(last_offset) 门控 + closeDatabase 释放文件锁）③ agent-host 2 handler（modelsConfig.get/set 共用 module）④ ChatTab 模型选择器落库（挂载 modelsConfig.get 回填 + onChange modelsConfig.set）⑤ 四文档 supersedes（03-Arch v0.1.2/08-Test v0.1.3/06-API v0.1.5/09-UI v0.1.3 落点改业务数据根，~/.pi → <dataRoot>/config/models.json）+ 14 新增测试）+ §9 统计 M3 in_progress 1→0 + done 4→5（合计 in_progress 1→0 + done 32→33）。原因：T-M3-005 实施完成，质量门全通过（type-check + 939 单元/集成测试（+14）+ 83 E2E 测试 + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 127 handlers + 安全不变量 6/6 + UUID 泄漏 7/7）。影响：状态登记 + 统计数字 + 四文档 supersedes 落点修订（无契约方法新增，Api 方法总数仍 127）。M3 剩余 pending：T-M3-006~008。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 + §8.4 完成判据 |
| v0.1.57 | 2026-08-08 | 登记 T-M3-004 完成：§7.4.1 登记表 T-M3-004 in_progress→done（AI 自主调用工具 + 跳转结构化 Tab：① 工具→Tab 映射纯函数（src/renderer/tool-tab-map.ts，35 工具全覆盖 + tts/backup 域无目标白名单）② 受控发射触发词扩展 3→10 组按域分组覆盖 35 工具域（速背卡/转写/备份/薄弱点/家长报告/上传资料/初始化学期 + 既有 3 触发词无回归）③ ChatTab 跳转承载（onNavigateTab prop + done 卡片 [去<Tab名>] 按钮 data-tab 属性，running/error 不渲染，tts/backup 域不渲染）④ AppShell 接线（renderTab 参数注入 setActiveTabId）⑤ 07-WF v0.1.2 §2.8 衔接段映射表条款（裁决 1b 升格权威）+ 33 新增测试（14 单件 + 11 集成 + 8 静态渲染））+ §9 统计 M3 in_progress 1→0 + done 3→4（合计 in_progress 1→0 + done 31→32）。原因：T-M3-004 实施完成，质量门全通过（type-check + 925 单元/集成测试（+33）+ 83 E2E 测试 + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 127 handlers + 安全不变量 6/6 + UUID 泄漏 7/7），master 280e642 + origin/master 推送成功（§8.4 三者齐全）。影响：仅状态登记 + 统计数字，无权威条款变更（07-WF v0.1.2 映射表条款已登记）。M3 剩余 pending：T-M3-005~008。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 + §8.4 完成判据 |
| v0.1.56 | 2026-08-08 | 登记 T-M3-004 开工：§7.4.1 登记表 T-M3-004 pending→in_progress（AI 自主调用工具 + 跳转结构化 Tab：受控发射触发词扩展 3→全域 + 工具→Tab 映射纯函数 + ChatTab 跳转承载 + AppShell 接线 + 单件/集成测试，扩展层，阶段3-4）+ §9 统计 M3 pending 5→4 + in_progress 0→1（合计 pending 5→4 + in_progress 0→1）+ 头部版本号滞后修正（v0.1.52→v0.1.56）。原因：用户批准 T-M3-004 开工（§7.5 全局执行顺序表第 14 行，前置依赖 T-M3-002 + S1-S7 工具 done）。五裁决：① 工具→Tab 映射表——35 工具全覆盖（S3→practice/S2 笔记→notes/S2 资料→materials/S2 update_learn_status→notes/S4→mistakes/S5→cram/S6→report/S7→capture/S1+ocr→home/TTS 无跳转）；1a backup_* 无目标 Tab（TabBar 仅 9 Tab 无 backup，AppShell case backup→BackupPanel 存在但无 TabBar 入口），不渲染跳转按钮，留 T-M3-006；1b 映射表条款补 07-WF §2.8 衔接段（非 09-UI §4.1）② 触发词按域分组覆盖（每域 1-2 触发词 + 保留既有 3 触发词无回归）③ 跳转按钮统一文案 [去<Tab名>]，无目标 Tab 不渲染 ④ 跳转 context { tabId, sessionId?, courseId? }，脱敏不含学生资料原文/完整 UUID ⑤ 受控发射扩展测试确定性。影响：仅状态登记 + 统计数字 + 头部版本号修正，无权威条款变更（映射表条款收尾时经用户批准后补 07-WF）。M3 剩余 pending：T-M3-005~008。依据：AGENTS.md §4.4 单一执行任务门禁 + §4.5 任务状态不得只存在于聊天 + §11.2 修订纪律 |
| v0.1.55 | 2026-08-08 | 登记 T-M3-003 完成：§7.4.1 登记表 T-M3-003 in_progress→done（学习场景业务化：① L3 承载层（src/data/l3/ bigram.ts 分词器 CJK bigram + ASCII 整词 + 完整 UUID 剥离 + indexer.ts 幂等建表/写入 + search.ts OR-combined MATCH）② L1 画像写回（src/data/l1-profile.ts 原子写 tmp+rename，version 1.0 不变）③ context-pack 扩展（学科/目标/错题段注入，错题只含错因摘要白名单不含题干/答案/证据 §9.3+S4）④ 会话级元数据（SessionSummary subject/goal/mistakeIds 可选字段 + session-store updateMeta，不新增 RPC 方法）⑤ sessions.search handler（L3 检索 + 内存仓库映射，库缺失空数组不阻塞）⑥ agent.send sessionMeta 参数扩展（[学习上下文] token 同步注入 + 元数据写回）⑦ ChatTab 学习场景元数据条 UI（📐 学科/目标/错题 #chip）+ 06-API v0.1.4（§3.1 sessions.search 落地 + SessionSummary 扩展 + §3.1.1 agent.send 扩展注解））+ §9 统计 M3 in_progress 1→0 + done 2→3（合计 in_progress 1→0 + done 30→31）。原因：T-M3-003 实施完成，质量门全通过（type-check + 892 单元/集成测试（+36）+ 83 E2E 测试 + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 127 handlers + 安全不变量 6/6 + UUID 泄漏 7/7）。影响：仅状态登记 + 统计数字 + 06-API 说明性增补（SessionSummary 可选字段向后兼容，Api 方法总数仍 127）。M3 剩余 pending：T-M3-004~008。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.54 | 2026-08-08 | 登记 T-M3-003 开工：§7.4.1 登记表 T-M3-003 pending→in_progress（学习场景业务化：学科标签/学习目标/错题关联/L1 画像注入扩展/L3 会话检索承载层，扩展层，阶段3-4）+ §9 统计 M3 pending 6→5 + in_progress 0→1（合计 pending 6→5 + in_progress 0→1）+ 头部版本号滞后修正（v0.1.52→v0.1.54）。原因：用户批准 T-M3-003 开工（§7.5 全局执行顺序表第 13 行，前置依赖 T-M3-001 + T-M3-002 done）。五裁决：① L3 边界——承载层（bigram 分词/写入/检索/sessions.search handler）归本任务，turn_end 钩子接线归 T-M3-005（05-ERD §4.3 触发点 vs 承载能力不同交付物，无 supersedes）② sessions.search 落 L3 检索库；rename/export 留 T-M3-006 ③ L1 写回：preferred_subjects/goals 现成字段，version 1.0 不变，原子写 ④ 错题关联：会话级元数据（session-store 扩展），不新增表 ⑤ bigram：CJK bigram + ASCII 整词小写，完整 UUID 不索引。影响：仅状态登记 + 统计数字 + 头部版本号修正，无权威条款变更。M3 剩余 pending：T-M3-004~008。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.53 | 2026-08-08 | 登记 T-M3-002 完成：§7.4.1 登记表 T-M3-002 in_progress→done（pi 原生能力承载：① AgentEvent payload 结构化子集（types.ts §4：tool_call/tool_result 脱敏载荷字段子集对齐 pi 底座 ToolCallEvent/ToolResultEvent）② agent-host 受控发射扩展（触发词「出题/笔记/朗读」→ tool_call/tool_result 事件对，toolCallId 短 id）③ ChatTab 工具调用卡片视图 + 上下文压缩提示条 + 模型选择器 + @文件引用选择器（materials.list 数据源 + files.read allowed-roots 门禁 + 渲染前 UUID 二次脱敏）④ allowed-roots.ts 白名单纯函数（realpath 防符号链接逃逸，AGENTS.md §9.4）⑤ files.read handler 实现（现成契约 + 1MB 截断，06-API §3.2 落地注解）⑥ models.list handler（受控 fixture 数据源，不读真实 ~/.pi/agent，§9.5 物理隔离）+ 06-API v0.1.3（§4 payload 结构化 + §3.2 注解 + §3.1.1 agent.send 扩展注解））+ §9 统计 M3 in_progress 1→0 + done 1→2（合计 in_progress 1→0 + done 29→30）。原因：T-M3-002 实施完成，质量门全通过（type-check + 856 单元/集成测试 + 83 E2E 测试 + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6 + UUID 泄漏 7/7）。影响：仅状态登记 + 统计数字 + 06-API v0.1.3 说明性增补，无权威条款变更，无契约方法新增（Api 方法总数仍 127）。M3 剩余 pending：T-M3-003~008。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.52 | 2026-08-08 | 登记 T-M3-002 开工：§7.4.1 登记表 T-M3-002 pending→in_progress（pi 原生能力承载：流式回复/工具调用视图/上下文压缩/@文件引用/多模型切换，扩展层，阶段3-4）+ §9 统计 M3 pending 7→6 + in_progress 0→1（合计 pending 7→6 + in_progress 0→1）。原因：用户批准 T-M3-002 开工（§7.5 全局执行顺序表第 12 行，前置依赖 T-M3-001 done）。四项设计裁决：① AgentEvent payload 结构化子集（types.ts + 06-API §4 增补）② files.read 走现成契约 + allowed-roots 门禁（不新增契约方法）③ 候选草案确认 ④ in_progress 登记确认。影响：仅状态登记 + 统计数字，无权威条款变更。M3 剩余 pending：T-M3-003~008。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.51 | 2026-08-08 | 登记 T-M3-001 完成：§7.4.1 登记表 T-M3-001 in_progress→done（💬 对话 Tab 默认主入口：ChatTab 组件替换 EmptyState——欢迎语/消息输入/消息列表/会话列表 + agent.send 新契约（renderer→agent-host→Streams["agent.events"] 受控序列 message_start→token×N→context_compressed）+ sessions.* 最小 handler（list/get/delete/context，内存仓库不读真实 ~/.pi/agent 物理隔离）+ AppShell chat 分支接线）+ §9 统计 M3 in_progress 1→0 + done 0→1（合计 in_progress 1→0 + done 28→29）。原因：T-M3-001 实施完成，质量门全通过（type-check + 823 单元/集成测试 + 83 E2E 测试 + build + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅状态登记 + 统计数字 + 06-API v0.1.2 新增 agent.send 契约，无权威条款变更。M3 剩余 pending：T-M3-002~008。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |§7.4.1 登记表 T-M3-001 pending→in_progress（💬 对话 Tab 默认主入口，扩展层，阶段3-4）+ §9 统计 M3 pending 8→7 + in_progress 0→1（合计 pending 8→7 + in_progress 0→1）。原因：用户批准 T-M3-001 开工（§7.5 全局执行顺序表第 11 行，M3 起点，前置依赖 M1+M2 E2E 通过）。影响：仅状态登记 + 统计数字，无权威条款变更。M3 剩余 pending：T-M3-002~008。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.49 | 2026-08-08 | 登记 T-M2-007 完成：§7.3.1 登记表 T-M2-007 in_progress→done（whisper.cpp 真实 Adapter 替换 mock：createStudyBuddyExtension 增加可选 whisper 配置 StudyBuddyExtensionOptions.whisperCliPath/whisperModelPath，优先级调用参数 > 环境变量 PI_STUDYBUDDY_WHISPER_CLI/MODEL > 空默认 mock；有 cliPath+modelPath 装配 createRealWhisperAdapter 接入 S7Context，无则默认 mock 08-Test §5.4；whisper-adapter.ts 头注释更新为真实已接入；true 转写单件测试——合成 3s 正弦波 PCM WAV + 真实 whisper-cli -nt（stdout 即纯文本），探测 whisper-cli+ggml-base.bin 存在才跑，只断言 text 非空+无泄漏字段；装配测试——带 whisper 路径 setup 不抛错+工具数仍 35；集成/E2E 保持 mock 08-Test §9.3）+ §9 统计 M2 in_progress 1→0 + done 8→9（合计 in_progress 1→0 + done 27→28）。原因：T-M2-007 实施完成，质量门全通过（type-check + build + 802 单元/集成测试 + 83 E2E 测试 + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅状态登记 + 统计数字，无权威条款变更。M2 全部 9 任务完成（业务 Adapter 层 S5-S7+TTS+备份恢复 + UI + E2E + UUID 检测 + whisper 真实 Adapter）。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.48 登记 T-M2-007 开工：§7.3.1 登记表 T-M2-007 pending→in_progress（whisper.cpp 真实 Adapter 替换 mock，业务Adapter，阶段2-3）+ §9 统计 M2 pending 1→0 + in_progress 0→1（合计 pending 9→8 + in_progress 0→1）。原因：用户批准 T-M2-007 开工（§7.5 全局执行顺序表第 8 行，前置依赖 whisper.cpp CLI 就绪，阶段1 done）。影响：仅状态登记 + 统计数字，无权威条款变更。M2 剩余 pending：无（M2 仅剩 T-M2-007 执行中）。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.47 | 2026-08-08 | 登记 T-M2-006 完成：§7.3.1 登记表 T-M2-006 in_progress→done（S6 assertNoSensitiveLeak UUID 泄漏检测独立校验脚本 scripts/check-uuid-leak.mjs，7 条硬断言 UUID-01~07，仿 check-desktop-security.mjs 范式，审计 leak-detector/reports/errors/types 布线；新增 tests/e2e/check-uuid-leak.script.test.ts 脚本冒烟 3 用例）+ §9 统计 M2 in_progress 1→0 + done 7→8（合计 in_progress 1→0 + done 26→27 + pending 9→不变 9）。原因：T-M2-006 实施完成，质量门全通过（type-check + build + 799 单元/集成测试 + 83 E2E 测试 + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅状态登记 + 统计数字，无权威条款变更。M2 剩余 pending：T-M2-007。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.46 | 2026-08-08 | 登记 T-M2-006 开工：§7.3.1 登记表 T-M2-006 pending→in_progress（S6 assertNoSensitiveLeak UUID 泄漏检测独立校验脚本 scripts/check-uuid-leak.mjs，业务Adapter，阶段2-5）+ §9 统计 M2 pending 2→1 + in_progress 0→1（合计 pending 9→8 + in_progress 0→1）。原因：用户批准 T-M2-006 开工（§7.5 全局执行顺序表第 10 行，前置依赖 T-M2-002 done，leak-detector.ts 已实现，只需固化独立静态审计脚本）。影响：仅状态登记 + 统计数字，无权威条款变更。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.44 | 2026-08-08 | 登记 T-M1-007 完成：§7.2.1 登记表 T-M1-007 in_progress→done（资料转换管道 PDF/DOCX/PPTX/XLSX 文本提取 + image OCR 编排 + normalized_texts 写入，业务Adapter，阶段1-5）+ §9 统计 M1 pending 1→0 + in_progress 1→0 + done 8→9（合计 pending 11→10 + in_progress 1→0 + done 24→25）。原因：T-M1-007 实施完成，质量门全通过（type-check + build + 773 单元/集成测试 + 80 E2E 测试 + smoke 6/6 + verify 全绿 + 文档治理 + 安全不变量 6/6）。影响：仅状态登记 + 统计数字，无权威条款变更。M1 剩余 pending：T-M1-008。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.45 | 2026-08-08 | 登记 T-M1-008 完成：§7.2.1 登记表 T-M1-008 pending→done（跨切钩子：before_agent_start/session_start/tool_call/tool_result 业务级逻辑，扩展层，阶段3）+ 新增 .record/T-M1-008-实施记录.md。M1 全部 10 任务完成（M1 退出门槛全通过）。原因：T-M1-008 实施完成，质量门全通过（type-check + build + 799 单元/集成测试 + 80 E2E 测试 + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅状态登记，无权威条款变更。M1 0 pending。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.43 | 2026-08-08 | 登记 T-M1-007 开工：§7.2.1 登记表 T-M1-007 pending→in_progress（资料转换管道 PDF/DOCX/PPTX/图片 OCR 编排 + normalized_texts 写入，业务Adapter，阶段2-4）+ §9 统计 M1 pending 2→1 + in_progress 0→1（合计 pending 12→11 + in_progress 0→1）。原因：用户批准 T-M1-007 开工（§7.5 全局执行顺序表第 7 行，前置依赖 T-M1-005 OCR 桥 + T-M1-006 WPS 桥均 done）。影响：仅状态登记 + 统计数字，无权威条款变更。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.42 | 2026-08-08 | 登记 T-M1-006 完成：§7.2.1 登记表 T-M1-006 in_progress→done（WPS COM 桥 doc/ppt/xls 转换：pywin32 子进程经 WPS COM KWPS/KET/KWPP.Application 转 docx/pptx/xlsx 中间格式 + pytest 5 用例三格式真实转换 + WpsAdapter 三态 + 接入 materials.convert/retryConversion 的 wps_convert + 错误固定文案不泄漏）+ §9 统计 M1 in_progress 1→0 + done 7→8（合计 in_progress 1→0 + done 23→24）。原因：T-M1-006 实施完成，质量门全通过（type-check + build + 754 单元/集成测试 + pytest 5 用例真实 WPS 转换 + smoke 6/6 + 文档治理 + 安全不变量 6/6）。影响：仅状态登记 + 统计数字，无权威条款变更。M1 剩余 pending：T-M1-007 / T-M1-008。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.41 | 2026-08-08 | 登记 T-M1-006 开工：§7.2.1 登记表 T-M1-006 pending→in_progress（WPS COM 桥 doc/ppt/xls 转换，业务Adapter，阶段2-3）+ §4.1 看板 WPS COM 行标记阶段1 ✅ + §9 统计 M1 pending 3→2 + in_progress 0→1（合计 pending 13→12 + in_progress 0→1）。原因：用户批准 T-M1-006 开工（§7.5 全局执行顺序表第 6 行，WPS COM ProgID KWPS/KET/KWPP.Application 已探测注册 + pywin32 已安装到 OCR venv）。影响：仅状态登记 + 统计数字，无权威条款变更。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.39 | 2026-08-08 | 登记 T-M1-005 开工：§7.2.1 登记表 T-M1-005 pending→in_progress（OCR venv Adapter 课表图片识别，业务Adapter，阶段2-3）+ §9 统计 M1 pending 4→3 + in_progress 0→1（合计 pending 14→13 + in_progress 0→1）。原因：用户批准 T-M1-005 开工（§7.5 全局执行顺序表第 5 行，venv 就绪，OCR 组件阶段1 已下载）。影响：仅状态登记 + 统计数字，无权威条款变更。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.38 | 2026-08-08 | 登记 T-M2-009 完成：§7.3.1 登记表 T-M2-009 pending→done（E2E-04~09：S5 期末冲刺全链 11 用例 + S6 家长报告+UUID 泄漏检测+渠道隔离 6 用例 + S7 课堂采集→S2 handoff 8 用例 + TTS 跨子系统+引擎切换+不持久化 8 用例 + 备份恢复 content_hash+integrity_check 5 用例 + 定期调度备份 cron 校验 6 用例 = 44 新增 E2E 用例；复用 T-M1-010 vitest+child_process.fork+IPC 框架；test-main.js 扩展注册 S5-S7+TTS+Backup handler + test.seedModule 测试专用种子；tts-adapter mock 修复 engine 硬编码 bug；zip-restorer FK 映射修复子表 course_instance_id 重映射；E2E-01~09 全 80 用例通过）+ §6.4 M2 退出门槛全勾选 + §9 统计 M2 pending 3→2 + done 6→7。原因：T-M2-009 实施完成，质量门全通过（type-check + 722 单元/集成测试 + 80 E2E 测试 + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：M2 退出门槛六项全勾选，M2 完整闭环达成。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 + §5.1 TDD 纪律 |
| v0.1.35 | 2026-08-08 | 登记 T-M2-008 开工：§7.3.1 登记表 T-M2-008 pending→in_progress（09-UI S5-S7+TTS+备份恢复 UI，3 Tab 组件 CramTab/ReportTab/CaptureTab + TtsControlBar 全局控制条 + BackupPanel 备份恢复面板 + 5 测试文件）+ §9 统计 M2 pending 4→3 + in_progress 0→1。原因：用户批准 T-M2-008 开工（§7.5 全局执行顺序表第 2 行，与 T-M1-009 同批复用 UI 模式）。影响：仅状态登记 + 统计数字，无权威条款变更。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.34 | 2026-08-08 | 登记 T-M1-009 完成：§7.2.1 登记表 T-M1-009 in_progress→done（09-UI S1-S4 标签页业务 UI：5 Tab 组件 HomeTab/MaterialsTab/NotesTab/PracticeTab/MistakesTab + 5 公共组件 EmptyState/LoadingState/ErrorState/ShortId/TabContainer + rpc-client 类型化封装 + AppShell 路由 + App.tsx 注入 + 58 新增测试覆盖防泄露铁律/隐私边界/六分类/AI 不确定标记）+ §9 统计 M1 in_progress 1→0 + done 4→5。原因：T-M1-009 实施完成，质量门全通过（type-check + 656 测试 + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）。影响：仅状态登记 + 统计数字，无权威条款变更。依据：AGENTS.md §4.5 任务状态不得只存在于聊天 + §7 受控收尾流程 |
| v0.1.33 | 2026-08-08 | 登记 T-M1-009 开工：§7.2.1 登记表 T-M1-009 pending→in_progress（09-UI S1-S4 标签页业务 UI，5 Tab 组件 + 公共组件 + RPC 客户端注入 + 静态渲染测试）+ §9 统计 M1 pending 6→5 + in_progress 0→1。原因：用户批准 T-M1-009 开工（§7.5 全局执行顺序表第 1 行）。影响：仅状态登记 + 统计数字，无权威条款变更。依据：AGENTS.md §4.4 单一执行任务门禁 + §11.2 修订纪律 |
| v0.1.32 | 2026-08-08 | 登记 M3 task-id（§7.4.1 T-M3-001~008 全部 pending）+ 新增 §7.5 全局执行顺序表（18 行统一排序 M1/M2/M3 pending，明确前置依赖和执行理由）。原因：用户要求把 M3 和 M1/M2 的 pending 放一起明确先后顺序。影响：M3 登记表 +8 行，全局执行顺序表 +18 行，§9 统计数字不变（M3 8/8/0/0/0/0 已正确）。依据：AGENTS.md §11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 |
| v0.1.31 | 2026-08-08 | 登记待做项 task-id（建议 B）：§7.2.1 M1 追加 T-M1-005~010（OCR venv Adapter / WPS COM 桥 / 资料转换管道 / 跨切钩子 / 09-UI S1-S4 / E2E-01~03，全部 pending）+ §7.3.1 M2 追加 T-M2-006~009（S6 UUID 泄漏检测 / whisper.cpp 真实 Adapter / 09-UI S5-S7+TTS+备份恢复 / E2E-04~09，全部 pending）。原因：用户核对发现 §6.3/§6.4 范围项与已登记 task 数量对不上，待做项未登记导致统计无法反映真实待办。影响：登记表行数增加 10 行，§9 统计数字不变（M1 10/6/4、M2 9/4/5 已正确），但含义清晰化——总任务数=已登记 task-id 数，里程碑退出门槛未全勾选前不算完成。依据：AGENTS.md §11.2 修订纪律 + §4.5 任务状态不得只存在于聊天 |
| v0.1.30 | 2026-08-08 | §9 统计修正：M1 pending 5→6（大纲 10 行 - done 4 = 6，原写 5 为计数错误），合计 pending 17→18。原因：用户核对发现计划任务与实现任务数量对不上。影响：仅统计数字修正，无权威条款变更。依据：AGENTS.md §11.2 修订纪律 |
| v0.1.29 | 2026-08-08 | 登记 T-M2-005 完成：§7.3.1 登记表 T-M2-005 done（备份恢复 7 RPC handler + 5 studybuddy_* 工具注册：backup.course 单课程 zip 打包 manifest.json+data/*.jsonl+storage/ + content_hash=SHA-256 + 写 backup_records(manual)；backup.allCourses 遍历 course_instances 逐个备份；backup.restore 解压+content_hash 校验+schema_version 兼容+冲突 overwrite/create_new/none+jsonl 导入+storage 复制+PRAGMA integrity_check；backup.list 按 semesterId/courseInstanceId 过滤；backup.configureSchedule 写 backup_schedules cron_expression+timezone；backup.listSchedules 查询；backup.toggleSchedule 启用/禁用；zip 打包用 Node 内置 zlib/fs 无外部依赖；zip 炸弹防护条目数+解压比限制 AGENTS.md §9.4；符号链接逃逸防护；错误码固定文案不泄漏路径/stdout/stderr；backup_records 状态机 in_progress→completed/failed；Streams["backup.progress"] 推送；DTO 对齐 05-ERD §2.3/§2.4 BackupRecord 15 字段+BackupSchedule 10 字段+RestoreResult 补 schemaVersion；studybuddy-extension 接入备份恢复共 34 工具；扩展装配测试同步更新 29→34），§9 统计 M2 5 done。598 测试全绿（43 test files），type-check + build + smoke 6 项全通过 + 文档治理检查通过。依据：AGENTS.md §7 受控收尾流程 + §5.1 TDD 纪律 + §5.4 不连真实外部服务 + §9.4 组件安全 |
| v0.1.28 | 2026-08-07 | 登记 T-M2-004 完成：§7.3.1 登记表 T-M2-004 done（TTS skill 4 RPC handler + 3 studybuddy_* 工具注册：tts.speak SAPI 默认 + edge-tts 降级 fallbackUsed=true + tts.control play/pause/stop 状态机 + tts.switchEngine 切换引擎 + tts.getStatus 查询 + TtsAdapter 双引擎可注入 sapiAdapter/edgeTtsAdapter mock/failing/real 三实现参照 WhisperCppAdapter 范式 + 朗读状态机 idle→playing→paused→stopped + Streams["tts.state"] 推送 + 无独立 TTS 表朗读不持久化（03-Arch §3.1）+ 朗读不写 StudyEvent（08-Test §3.5 断言 3）+ 不连真实 SAPI/edge-tts 全 mock 08-Test §5.4 + 契约微调 api.ts tts.speak result 扩展 engine/fallbackUsed 对齐 08-Test §3.5 断言 + types.ts 补 TtsSpeakResult + studybuddy-extension 接入 TTS 共 29 工具），§9 统计 M2 4 done。562 测试全绿（38 test files），type-check + build + smoke 6 项全通过。依据：AGENTS.md §7 受控收尾流程 + §5.1 TDD 纪律 + §5.4 不连真实外部服务 |
| v0.1.27 | 2026-08-07 | 登记 T-M2-004 开工：§7.3.1 登记表新增 T-M2-004 in_progress（TTS skill 4 RPC handler + 3 studybuddy_* 工具注册：tts.speak SAPI 默认 + edge-tts 降级 fallbackUsed + 朗读状态机 idle→playing→paused→stopped + Streams["tts.state"] 推送 + TtsAdapter 可注入 mock/failing/real 三实现参照 WhisperCppAdapter 范式 + 无独立 TTS 表朗读不持久化 + 不连真实 SAPI/edge-tts 全 mock 08-Test §5.4 + 契约微调 api.ts tts.speak result 扩展 engine/fallbackUsed 对齐 08-Test §3.5 断言；studybuddy-extension 接入 TTS 共 29 工具），§9 统计 M2 3 done + 1 in_progress。计划文件 .plan/T-M2-004-tts.md 已创建待用户审查批准。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 |
| v0.1.26 | 2026-08-07 | 登记 T-M2-003 完成：§7.3.1 登记表 T-M2-003 done（S7 课堂采集 2 RPC handler + 2 studybuddy_* 工具注册：classCapture.transcribe 许可确认强制 permissionConfirmed=false→BAD_REQUEST + PCM WAV 文件头服务端字节级验证（RIFF/WAVE/PCM/16kHz/单声道/16-bit 44 字节头部 8 项校验）+ WhisperCppAdapter 可注入（mock/failing/real 三实现，真实 spawn 框架不连真实子进程 08-Test §5.4 全 mock）+ 错误消息固定文案不泄漏路径/stdout/stderr/密钥 + 原始音频 tmp/class-capture/<request-id>/ finally 清理不留存；classCapture.saveTranscription handoff 到 S2 materials+normalized_texts+study_events（source_type='class_audio_transcription' / status='converted' / permission_confirmed=1 / content_hash=SHA-256 / event_type='class_handoff_saved' source_system='S7'）；前置 DTO/schema 已就绪无需修改；studybuddy-extension 接入 S7 共 26 工具；扩展装配测试同步更新 24→26），§9 统计 M2 3 done。509 测试全绿（34 test files），type-check + build + smoke 6 项全通过。依据：AGENTS.md §7 受控收尾流程 + §5.1 TDD 纪律 + §5.4 不连真实外部服务 |
| v0.1.24 | 2026-08-07 | 登记 T-M2-001 完成：新增 §7.3.1 M2 任务登记表 T-M2-001 done（S5 期末冲刺 8 RPC handler + 2 studybuddy_* 工具注册：mockExams.generatePaper 触发器校验 confirmed + source_hash 防重复 + MockExamGenerator 可注入默认 mock + AI 失败不创建空卷→INTERNAL_ERROR、getPaper 未提交不含 correct_answer 防泄露、startAttempt 状态机 in_progress、submitAttempt 复用 S3 grader 三策略批改 + in_progress→graded + 模块分析 weakness_level strong/medium/weak + study_events 写入、getResult/getModuleAnalyses 只读查询；cramCards.get 确定性只读 DTO 不暴露题干/答案/作答 + 未确认考试 BAD_REQUEST；cramPlan.get 7 天 DTO 确定性只读不替学生改写事实 + 按剩余天数排序；studybuddy-extension 接入 S5 共 21 工具），§9 统计 M2 1 done。420 测试全绿（27 test files），verify 7+2 全通过。依据：AGENTS.md §7 受控收尾流程 + §5.1 TDD 纪律 |
| v0.1.23 | 2026-08-07 | 登记 T-M1-004 完成：§7.2.1 登记表 T-M1-004 done（S4 错题/薄弱点 10 RPC handler + 4 studybuddy_* 工具注册：mistakes.archive 幂等归档 UNIQUE(question_id)+UNIQUE(source_practice_answer_id)、confirmErrorCause 六分类学生确认、suggestErrorCause 可注入 ErrorCauseAdvisor 默认 mock + AI 失败降级、redo 状态机 needs_review↔mastered + evidence_count≥2 归纳 weak_point；weakPoints.resolve/regress 状态机 active→resolved→regressed；schema 修复 mistake_evidence.source_practice_answer_id 改为可空以支持 redo 证据不依赖新 practice_answer；studybuddy-extension 接入 S4 共 19 工具），§9 统计 M1 4 done。383 测试全绿（25 test files），verify 7+2 全通过。依据：AGENTS.md §7 受控收尾流程 + §5.1 TDD 纪律 |
| v0.1.22 | 2026-08-07 | 登记 T-M1-004 开工：§7.2.1 登记表新增 T-M1-004 in_progress（S4 错题/薄弱点 10 RPC handler + 4 studybuddy_* 工具注册：mistakes.archive 幂等归档 UNIQUE(question_id)+UNIQUE(source_practice_answer_id)、confirmErrorCause 六分类学生确认、suggestErrorCause 可注入 ErrorCauseAdvisor 默认 mock 带"不确定"标记 + AI 失败降级 INTERNAL_ERROR、redo 重做正确→evidence_count≥2 归纳 weak_point+mastered/错误→保持 needs_review；weakPoints.resolve/regress 状态机；aggregator 私有 evidence_count≥2 才形成 + UNIQUE(course_instance_id, knowledge_module_id)；S4Context 复用 S1/S2/S3 模式 + ErrorCauseAdvisor 注入；DTO 对齐 ERD §3.4 三表 mistakes/mistake_evidence/weak_points：ErrorCategory 六分类全修正、Mistake 补 7 字段 + 移除 archived、MistakeEvidence 新增类型、RedoResult 补 2 字段、WeakPoint 补 4 字段；错题状态机 needs_review↔mastered、薄弱点状态机 active→resolved→regressed；studybuddy-extension 接入 S4 工具注册共 19 工具），更新 §9 统计（M1 5 pending + 1 in_progress + 3 done）。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 |
| v0.1.21 | 2026-08-07 | 登记 T-M1-003 完成：§7.2.1 登记表 T-M1-003 done（S3 限时练习 5 RPC handler + 3 studybuddy_* 工具注册：practice.createSession 校验 questionCount 5-20 + 可注入 QuestionGenerator mock 生成题、getQuestions 作答前 DTO 防泄露、submit 规则批改三策略（单选精确/多选 deepEquals/填空 normalize+多等价答案）、getResult 含逐题正确答案解析、listSessions；S3Context 复用 S1/S2 模式 + QuestionGenerator 注入；grader.ts 纯确定性规则不调 LLM；DTO 对齐 ERD §3.3 三表 PracticeSession/PracticeResult 补字段 + status 改 in_progress/submitted/graded；AI 失败不创建空 session→INTERNAL_ERROR；studybuddy-extension 接入 S3 工具注册共 15 工具），§9 统计 M1 3 done + 6 pending。336 测试全绿，verify 7+2 全通过。依据：AGENTS.md §7 受控收尾流程 + §5.1 TDD 纪律 |
| v0.1.20 | 2026-08-07 | 登记 T-M1-003 开工：§7.2.1 登记表新增 T-M1-003 in_progress（S3 限时练习 5 RPC handler + 3 studybuddy_* 工具注册：practice.createSession 校验 questionCount 5-20 + 同步调 AI 生成题、getQuestions 作答前 DTO 防泄露、submit 规则批改三策略（单选精确/多选 deepEquals/填空 normalize）、getResult 含正确答案解析、listSessions；S3Context 复用 S1/S2 模式 + lookup 跨库；DTO 对齐 ERD §3.3 questions/practice_sessions/practice_answers 三表），更新 §9 统计（M1 7 pending + 1 in_progress + 2 done）。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 |
| v0.1.19 | 2026-08-07 | 登记 T-M1-002 完成：§7.2.1 登记表 T-M1-002 done（S2 资料/笔记/知识模块 17 RPC handler + 6 studybuddy_* 工具注册：materials 9 方法含状态机+Job 登记、notes 3 方法、modules 3 方法含学习状态机、jobs 2 方法；S2Context 复用 S1 模式 + lookup 跨库查找；DTO 对齐 ERD §3.2 七表 5 DTO + JobStatus/JobType；6 工具 TypeBox schema + execute 薄封装；studybuddy-extension 接入 S2 工具注册），§9 统计 M1 2 done + 8 pending。295 测试全绿，verify 7+2 全通过。依据：AGENTS.md §7 受控收尾流程 + §5.1 TDD 纪律 |
| v0.1.18 | 2026-08-07 | 登记 T-M1-002 开工：§7.2.1 登记表新增 T-M1-002 in_progress（S2 资料/笔记/知识模块 17 RPC handler + studybuddy_* 工具注册：materials 9 方法含状态机+Job 登记、notes 3 方法、modules 3 方法含学习状态机、jobs 2 方法；S2Context 复用 S1 模式 + lookup 跨库；DTO 对齐 ERD §3.2 七表），更新 §9 统计（M1 8 pending + 1 in_progress + 1 done）。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 |
| v0.1.17 | 2026-08-07 | 登记 T-M1-001 完成：§7.2.1 登记表 T-M1-001 done（S1 学习节奏 25 RPC handler + 6 studybuddy_* 工具注册：semesters 6 方法含跨库写+状态机、courses 5 方法、exams 4 方法含四态确认、schedule 4 方法、tasks 4 方法含 dailyBrief 规则聚合、events 2 方法；S1Context 管理全局/学期库句柄；lookup 跨库查找；6 工具 TypeBox schema + execute 薄封装；studybuddy-extension 接入 S1 工具注册；SqlParams 类型对齐 node:sqlite SQLInputValue），§9 统计 M1 1 done + 9 pending。237 测试全绿，verify 7+2 全通过。依据：AGENTS.md §7 受控收尾流程 + §5.1 TDD 纪律 |
| v0.1.16 | 2026-08-07 | 登记 T-M1-001 开工 + 前置 DTO 对齐 schema：新增 §7.2.1 M1 任务登记表（T-M1-001 in_progress），§9 统计 M1 9 pending + 1 in_progress。前置：核实发现 contract/types.ts DTO（T-M0-002）与 05-ERD schema（T-M0-006）10 处字段/值域不一致，按权威链 05-ERD（优先级4）> types.ts（优先级7）修正 7 个 S1 DTO + api.ts source 值域对齐 05-ERD，type-check + 171 测试全绿。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 + §11.2 修订纪律 |
| v0.1.15 | 2026-08-07 | 登记 T-M0-009 完成 + §6.0 M0 完成与版本演进说明 + 头部版本号滞后修正（v0.1.11→v0.1.15）+ §9 统计口径修正（M0 总任务数 12→9，按实际 task-id，3 项大纲合并）：§7.1.1 登记表 T-M0-009 done（M0 系统冒烟完整：smoke.mjs 扩展覆盖 §6.2 退出门槛六项 build+RPC+建库+vault+六不变量+汇总；补全 INV-06 HTML_PREVIEW_CSP form-action 'none' + protocol.ts 接入；check-desktop-security.mjs 六条转硬断言移除占位宽松；verify.mjs desktop-security 改硬阻塞；invariants.test.ts 加 INV-04/05/06 三断言），§6.0 补 M0 完成说明 + 版本演进（01-TRD §7 决策 6 约定），§9 统计 M0 9 done（M0 收官）。依据：AGENTS.md §7 受控收尾流程 + §11.2 修订纪律（口径修正显式记录） |
| v0.1.14 | 2026-08-07 | 登记 T-M0-009 开工：§7.1.1 登记表新增 T-M0-009 in_progress（M0 系统冒烟完整：应用启动 + RPC 往返 + 建库 + 安全不变量六条），更新 §9 统计。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 |
| v0.1.13 | 2026-08-07 | 登记 T-M0-008 完成：§7.1.1 登记表 T-M0-008 done（09-UI 三栏布局 + 标签页骨架：tabs.ts 9 Tab 纯数据 + AppShell.tsx 三栏布局壳 + TabBar.tsx 标签页栏 + App.tsx 组装 + renderer-layout.test.ts 14 断言；对话默认 Tab + 内联样式 + renderToStaticMarkup 静态渲染测试；vitest.config.ts 加 react 插件解析 tsx），§9 统计 M0 3 pending + 8 done。依据：AGENTS.md §7 受控收尾流程 |
| v0.1.12 | 2026-08-07 | 登记 T-M0-008 开工：§7.1.1 登记表新增 T-M0-008 in_progress（09-UI 三栏布局 + 标签页骨架：AppShell + TabBar 空壳，对话默认 Tab），更新 §9 统计（M0 3 pending + 1 in_progress + 7 done）。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 |
| v0.1.11 | 2026-08-07 | 登记 T-M0-007 完成：§7.1.1 登记表 T-M0-007 done（studybuddy-extension 空壳：createStudyBuddyExtension 工厂返回 pi ExtensionFactory 空 setup，零工具/零钩子/零 provider；pi 底座 @earendil-works/pi-coding-agent@0.80.10 + pi-ai@0.80.10 安装为 dependencies；7 单件 + 4 集成测试全绿），§4.1 看板 pi 行阶段1/3 标记 ✅（已安装 + 集成契约验证），§9 统计 M0 4 pending + 7 done。依据：AGENTS.md §7 受控收尾流程 + §6.2 组件化装配流程 |
| v0.1.10 | 2026-08-07 | 登记 T-M0-007 开工 + §4.1 看板 pi 修正：§7.1.1 登记表新增 T-M0-007 in_progress（studybuddy-extension 空壳：createStudyBuddyExtension 工厂 + pi ExtensionFactory 类型化契约 + 空 setup 无工具）；§4.1 看板 pi 行修正——"✅ 已下载"为自指断言（实际 node_modules 无 @earendil-works，阶段1 未完成）→ 改 ⏳ T-M0-007 安装中，"peerDeps"→"dependencies"（跟随 pi-desktop 权威范式 [pi-desktop package.json:47-48] 固定版本 dependencies）；§9 统计 M0 5 pending + 1 in_progress + 6 done。依据：AGENTS.md §11.1 治理基线修改 + §3.2 pi-desktop 参考范式 + §11.2 修订纪律（自指断言修正） |
| v0.1.9 | 2026-08-07 | 登记 T-M0-005 完成：§7.1.1 登记表 T-M0-005 done（file-watch：fs.watch recursive + 100ms 防抖 → Streams["files.changed"]，per-target lastExists 推断 changeType 规避 Windows eventType 不可靠），§9 统计 M0 6 done。前序 v0.1.8 收尾时遗漏版本历史条目与 §9 同步，本次补登。依据：AGENTS.md §7 受控收尾流程 + §11.2 修订纪律 |
| v0.1.8 | 2026-08-07 | 登记 T-M0-005 开工：§7.1.1 登记表新增 T-M0-005 in_progress（file-watch：fs.watch recursive + 100ms 防抖 → Streams["files.changed"]），更新 §9 统计（M0 6 pending + 1 in_progress + 5 done）。依据：AGENTS.md §4.4 单一执行任务门禁 + §5.1 TDD 纪律 |
| v0.1.7 | 2026-08-07 | 登记 T-M0-004 完成：§7.1.1 登记表 T-M0-004 done（toolchain 发现-探测-安装-绝对路径执行框架：11 文件 discovery→probe→install→prependPath + 三 handler 注册 + 14 种 capability 全保留），更新 §9 统计（M0 7 pending + 5 done）。依据：AGENTS.md §7 受控收尾流程 |
| v0.1.6 | 2026-08-07 | 登记 T-M0-003 完成：§7.1.1 登记表 T-M0-003 done（credential-vault：safeStorage/DPAPI 密钥库 + 原子写 0o600 + 键名校验），更新 §9 统计（M0 8 pending + 4 done）。同时补全 scripts/check-desktop-security.mjs INV-04 占位为真实断言（已实现 5 条全绿）。依据：AGENTS.md §7 受控收尾流程 |
| v0.1.5 | 2026-08-07 | 登记 T-M0-006 完成：§7.1.1 登记表 T-M0-006 done（数据层 schema：global.db 4 表 + semester.db 25 表 9 触发器 + 三层记忆 L1/L2/L3 + PRAGMA + integrity 断言；node:sqlite 经 process.getBuiltinModule 动态加载规避 esbuild 剥离 node: 前缀），更新 §9 统计（M0 9 pending + 3 done）。依据：AGENTS.md §7 受控收尾流程 |
| v0.1.4 | 2026-08-07 | 登记 T-M0-002 完成：§7.1.1 登记表 T-M0-002 done（contract 类型化契约面：api ~126 方法 + types DTO + streams 9 主题 + PiBridge 8 桥面），更新 §9 统计（M0 10 pending + 2 done）。依据：AGENTS.md §7 受控收尾流程 |
| v0.1.3 | 2026-08-07 | 登记 T-M0-001 完成：新增 §7.1.1 M0 任务登记表（T-M0-001 done），更新 §9 任务统计（M0 12→11 pending + 1 done）。依据：AGENTS.md §7 受控收尾流程 |
| v0.1.2 | 2026-08-07 | 纠正 T-M0-009 跳号笔误：原候选表 008→010 跳号，T-M0-010（M0 系统冒烟完整）重编号为 T-M0-009，恢复 001-009 连续编号。依据：AGENTS.md §11.2（冲突通过显式记录解决，不得静默删除） |
| v0.1.1 | 2026-08-07 | 追加 §1.4 治理体系就绪状态（M0 启动前置）：10 类治理资产清单 + 启动 M0 前置条件确认 + 下一步指引。治理体系五批资产全部就绪，可启动 M0 骨架开发 |
| v0.1.0 | 2026-08-07 | 初始草案：文档定位（设计→实现桥梁）+ 任务登记规范（task-id 命名/字段/状态机）+ 任务分类体系（架构层/子系统/装配阶段三维度）+ 组件治理状态看板（五阶段跟踪）+ 完成门槛（五阶段进入退出条件 + 合并master门槛 + 退回机制）+ 里程碑规划（M0骨架/M1核心闭环/M2完整闭环/M3对话打磨）+ 任务登记表大纲（39 任务大纲基于 03-Arch §9.1 推导）+ 修复记录区（08-Test §11.3 证据）+ 任务统计。输入：01-TRD + 02-PRD + 03-Arch §9 + 05-ERD + 06-API + 07-Workflow + 08-Test §11 + 09-UI |
