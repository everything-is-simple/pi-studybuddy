# T-M2-009 E2E-04~09（S5-S7+TTS+备份恢复 E2E）

**task-id**：T-M2-009
**里程碑**：M2 完整闭环（退出门槛任务，§7.5 全局执行顺序表第 4 行）
**日期**：2026-08-08
**依据**：08-Test §6.2-§6.4 + 04-Todo §6.4 M2 退出门槛 + 06-API §3.7-§3.10

---

## 1. 任务目标

为 M2 业务闭环（S5 期末冲刺 / S6 家长报告 / S7 课堂采集 / TTS / 备份恢复）编写端到端测试，验证：

- E2E-04：期末冲刺全链（模拟卷生成→作答→批改→弱项分析→速背卡→冲刺计划）
- E2E-05：课堂采集→S2 handoff（PCM WAV→whisper mock→转写→保存为 S2 资料）
- E2E-06：家长报告生成与投递（规则生成→UUID 泄漏检测→渠道隔离）
- E2E-07：TTS 随时可击发（SAPI 默认→引擎切换→朗读不持久化→标记已复习）
- E2E-08：备份与恢复全链（单课程备份→zip+content_hash→损坏 zip 拒绝→恢复→integrity_check）
- E2E-09：定期调度备份（cron 配置→非法 cron 拒绝→enable/disable）

**M2 退出门槛覆盖**（04-Todo §6.4 六项）：
- [ ] E2E-01~09 通过（本任务覆盖 04~09，01~03 已由 T-M1-010 完成）
- [ ] 家长报告 UUID 泄漏检测通过（E2E-06）
- [ ] TTS 跨子系统朗读冒烟通过（E2E-07）
- [ ] 备份恢复 content_hash + integrity_check 通过（E2E-08）
- [ ] 投递渠道独立失败隔离通过（E2E-06）

## 2. 范围与非目标

### 范围
- 6 个 E2E 测试文件（e2e-04~09）
- test-main.js 扩展（注册 S5-S7+TTS+Backup handler）
- helpers 扩展（electron-launcher 数据隔离目录 + fixtures PCM WAV 夹具）
- 必要的源码修复（如 zip-restorer FK 映射、E2E-04 知识模块种子）

### 非目标
- 不修改业务 handler 逻辑（除非 E2E 暴露真实 bug）
- 不新增 RPC 方法（除 test.seedModule 测试专用 seed）
- 不涉及 E2E-01~03（T-M1-010 已完成）
- 不涉及 E2E-10~13（M3 范围）

## 3. 前序会话遗留状态

> **重要**：前序会话在未创建计划、未经用户批准的情况下违规写了部分代码。本计划保留这些已有改动作为初始实现基线，从质量门步骤继续。

**已有改动**（4 修改 + 6 新增，git unstaged）：

| 文件 | 类型 | 状态 |
|---|---|---|
| tests/e2e/test-main.js | 修改 | 注册 S5-S7+TTS+Backup handler + test.seedModule |
| tests/e2e/helpers/electron-launcher.ts | 修改 | E2E_RUN_DIR 改为 T-M2-009 |
| tests/e2e/helpers/fixtures.ts | 修改 | 新增 createPcmWavBuffer |
| tests/e2e/e2e-04-sprint.test.ts | 新增 | 11 测试用例 |
| tests/e2e/e2e-05-class-capture.test.ts | 新增 | 课堂采集全链 |
| tests/e2e/e2e-06-parent-report.test.ts | 新增 | 家长报告+渠道隔离 |
| tests/e2e/e2e-07-tts.test.ts | 新增 | TTS 全链 |
| tests/e2e/e2e-08-backup-restore.test.ts | 新增 | 备份恢复全链 |
| tests/e2e/e2e-09-schedule-backup.test.ts | 新增 | 调度备份 |
| src/agent-host/handlers/backup/zip-restorer.ts | 修改 | FK 映射修复 |

**已知待修复问题**：
1. E2E-04：mock-exam-generator 在无知识模块时用 `default-module` 导致 FK 违规 → 已加 test.seedModule 种子
2. E2E-07：TTS 引擎切换需验证（源码 switchEngine 已正确，需 E2E 确认）
3. E2E-08：zip-restorer FK 映射已修复（子表 course_instance_id 重映射）

## 4. 文件清单

### 新增文件
- tests/e2e/e2e-04-sprint.test.ts
- tests/e2e/e2e-05-class-capture.test.ts
- tests/e2e/e2e-06-parent-report.test.ts
- tests/e2e/e2e-07-tts.test.ts
- tests/e2e/e2e-08-backup-restore.test.ts
- tests/e2e/e2e-09-schedule-backup.test.ts

### 修改文件
- tests/e2e/test-main.js（注册 S5-S7+TTS+Backup handler + test.seedModule）
- tests/e2e/helpers/electron-launcher.ts（E2E_RUN_DIR → T-M2-009）
- tests/e2e/helpers/fixtures.ts（createPcmWavBuffer）
- src/agent-host/handlers/backup/zip-restorer.ts（FK 映射修复）

### 文档更新（收尾阶段）
- docs/04-Todo（T-M2-009 done + M2 退出门槛勾选）
- docs/00-索引（版本同步）
- AGENTS.md（§3.1 版本同步）
- .plan/00-当前任务.md（状态更新）
- .record/T-M2-009-实施记录.md（8 章节）

## 5. 测试策略

### E2E 框架
复用 T-M1-010 的 vitest + child_process.fork + Node.js IPC 框架（非 Playwright，非 Electron _electron.launch()）。

### 关键断言映射（08-Test §7）

| 断言 | E2E | 依据 |
|---|---|---|
| 防泄露（mockExams.getPaper 不含 correctAnswer） | E2E-04 | §7.2 |
| 规则批改可证伪（全对满分/重复提交被拒） | E2E-04 | §7.4 |
| 速背卡/冲刺计划确定性只读 | E2E-04 | §7.4 |
| S7→S2 handoff（转写保存为 materials） | E2E-05 | §7.1 |
| UUID 泄漏检测 | E2E-06 | §7.2 |
| 渠道隔离（SMTP 失败不影响 local_export） | E2E-06 | §7.2 |
| TTS SAPI 默认离线可用 | E2E-07 | §7.1 |
| TTS 朗读不写 study_events | E2E-07 | §3.5 |
| 备份 zip + content_hash 校验 | E2E-08 | §7.6 |
| 损坏 zip → BAD_REQUEST | E2E-08 | §7.6 |
| 恢复后 integrity_check 通过 | E2E-08 | §7.6 |
| cron_expression 校验 | E2E-09 | §7.6 |

### 数据隔离
所有 E2E 写 `H:\pi-studybuddy-tmp\runs\T-M2-009\e2e\e2e-XX\`

### 外部服务全 mock
AI/whisper.cpp/SAPI/edge-tts/SMTP 全 mock，不连真实服务（08-Test §1.3 第 6 条）

## 6. 五阶段治理定位

本任务处于**阶段 5b（系统 E2E）**，是 M2 退出门槛任务。前置：
- 阶段 1-4：S5-S7+TTS+Backup 业务 Adapter 已完成（T-M2-001~005）
- 阶段 5a：系统冒烟已通过（T-M0-009 + 各业务任务内置冒烟）
- 阶段 5b E2E-01~03：T-M1-010 已完成

## 7. 依赖关系

| 依赖 | 状态 |
|---|---|
| T-M2-008（09-UI S5-S7+TTS+备份恢复 UI） | ✅ done |
| T-M1-010（E2E 框架 + E2E-01~03） | ✅ done |
| T-M2-001~005（S5-S7+TTS+Backup 业务 Adapter） | ✅ done |

## 8. 预期产物

- 6 E2E 测试文件（~50-60 测试用例）
- test-main.js 扩展（S5-S7+TTS+Backup handler 注册）
- zip-restorer.ts FK 映射修复
- 质量门全通过（type-check + 722+ 单元/集成测试 + E2E-04~09 + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）
- M2 退出门槛全勾选

---

## 16 步执行跟踪

- [x] 步骤 1：读文档、定边界
- [x] 步骤 2：检查文档门禁
- [x] 步骤 3：编写 .plan/ 计划
- [x] 步骤 4：独立审查计划
- [x] 步骤 5：用户批准计划（★ 用户授权）
- [x] 步骤 6：拆分任务、逐项实现（前序会话已部分完成 + 本会话修复）
- [x] 步骤 7：编写或更新测试（TDD）
- [x] 步骤 8：type-check（零错误零警告）
- [x] 步骤 9：build（无错误）
- [x] 步骤 10：test（722 全绿无 skip）
- [x] 步骤 11：smoke 6/6 + E2E 80/80（铁律不破）
- [x] 步骤 12：独立审查并修复（tts-adapter mock engine 硬编码 bug + zip-restorer FK 映射）
- [x] 步骤 13：更新 04-Todo + 00-索引 + AGENTS.md
- [x] 步骤 14：文档治理检查（通过）
- [ ] 步骤 15：diff 检查
- [ ] 步骤 16：提交交付（★ 用户授权）

## 证据登记

- type-check：✅ 零错误零警告
- build：✅ 无错误
- 单元/集成测试：✅ 722 passed (54 files)
- E2E 测试：✅ 80 passed (9 files, E2E-01~09)
- smoke：✅ 6/6 通过
- 文档治理：✅ 通过（1 条非阻塞警告）
- 契约覆盖：✅ 126 handlers + 8 PiBridge + 34 tools
- 安全不变量：✅ 6/6 通过
- 提交哈希：（待填）
- 推送状态：（待填）
- 实施记录路径：.record/T-M2-009-实施记录.md

---

## 审查记录

**审查日期**：2026-08-08
**审查者**：AI 审查者（独立视角）

### 审查结论：✅ 通过（1 项补充说明）

**检查项**：
1. ✅ 任务目标覆盖完整 — 6 个 E2E（04~09）对应 08-Test §6.2-§6.4 + M2 退出门槛六项
2. ✅ 文件清单完整 — 4 修改 + 6 新增 + 收尾文档
3. ✅ 接口与 06-API 一致 — 复用已有 RPC，test.seedModule 为测试专用 seed（不进生产）
4. ✅ 关键不变量覆盖 — 防泄露/规则批改/UUID 检测/渠道隔离/TTS 不持久化/content_hash/cron
5. ✅ 铁律无违反 — 前序会话违规已如实标注，数据隔离 H:\pi-studybuddy-tmp\runs\T-M2-009\

**补充说明**：
- M2 退出门槛第一项"S1-S7 全链路冒烟通过"由 T-M2-001~005 各任务内置冒烟覆盖（scripts/smoke.mjs 6/6），本任务不重复冒烟，仅 E2E 层验证
- 前序会话遗留代码需在步骤 6-11 质量门中验证通过后才可视为有效实现

**用户批准**：用户已于 2026-08-08 批准开工（"好的，按这个方案开始处理 T-M2-009"）
