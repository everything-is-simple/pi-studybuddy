# 任务计划：T-M2-002 S6 家长报告

**任务 ID**：T-M2-002
**日期**：2026-08-07
**状态**：📝 待审查
**关联文档**：07-WF §3 + 06-API §3.8 + 05-ERD §2.2/§3.6 + 02-PRD §5.2 + 08-Test §5.4/§6.2
**里程碑**：M2 完整闭环（第 2 任务）
**分类**：业务 Adapter / 子系统 S6
**治理阶段**：阶段 2-4（单件 → 集成 → 组装）

---

## 1. 任务目标

### 做什么

实现 S6 家长报告子系统：11 RPC handler + 3 studybuddy_* 工具注册，覆盖规则报告生成 → AI 仅润色 → 冻结快照 → UUID 泄漏检测 → 渠道投递（独立失败隔离）→ 报告目标管理全链路。

### 为什么

- M2 退出门槛要求"家长报告 UUID 泄漏检测通过"+"投递渠道独立失败隔离通过"（04-Todo §6.4）
- 家长报告是学习闭环对家长侧的唯一异步脱敏出口（02-PRD §3.7），守住隐私边界是核心价值
- S6 是 T-M2-001 S5 之后的下一个 P1 业务任务，复用 S1-S5 已验证的 Context/lookup/dto/events 模式

### 依据

- **07-Workflow §3**：报告生成流程（规则优先 + AI 仅润色 + 冻结快照 + assertNoSensitiveLeak）+ 报告投递流程（渠道独立失败隔离 + 至少一次投递 + 最多重试 3 次 + retained_locally）
- **06-API §3.8**：11 RPC 方法（reports.generate/freeze/get/list + deliveries.deliver/retry/list + reportTargets.list/create/update/delete）
- **05-ERD §2.2**：parent_report_targets（全局库）
- **05-ERD §3.6**：parent_reports + report_deliveries（学期库）
- **02-PRD §5.2**：家长报告脱敏边界
- **08-Test §5.4**：assertNoSensitiveLeak UUID 泄漏检测冒烟
- **08-Test §6.2**：E2E-06 家长报告生成与投递

## 2. 范围与非目标

### 范围

- 11 RPC handler 实现（reports 4 + deliveries 3 + reportTargets 4）
- 3 studybuddy_* 工具注册（generate_report / deliver_report / manage_report_targets）
- 规则报告生成器（聚合 S1/S2/S3/S4 数据，6 section：study_rhythm / materials / practice / mistakes / exam_reminder / data_quality）
- AI 仅润色接口（可注入 mock，失败保留规则报告，不阻塞）
- assertNoSensitiveLeak UUID 泄漏检测（PARENT_REPORT_PRIVACY_VIOLATION + 降级规则报告）
- 冻结快照（content_json + content_hash SHA-256）
- 投递渠道独立失败隔离（local_export / smtp / feishu_webhook / print）
- credential-vault 集成（家长联系方式解密失败 → INTERNAL_ERROR）
- study_events 写入（report_generated / report_delivered，source_system='S6'）
- DTO 对齐 ERD §2.2 + §3.6（修正 types.ts 现有 S6 DTO 与 ERD 的字段不一致）
- studybuddy-extension 接入 S6 工具注册

### 非目标（不做什么）

- 不实现真实 SMTP/飞书 Webhook/AI 润色（全部 mock，08-Test §5.4 不连真实外部服务）
- 不实现 09-UI S6 标签页（属 M2 后续 UI 任务）
- 不实现 E2E-06（属 M2 后续 E2E 任务 T-M2-008）
- 不实现定期调度自动生成（daily/weekly/monthly/exam_reminder 自动触发属调度层，本任务仅支持手动触发生成）
- 不实现 print 渠道的真实打印（mock 返回成功）

## 3. 文件清单

### 将创建的文件

| 文件路径 | 用途 |
|---|---|
| `src/agent-host/handlers/s6/context.ts` | S6Context（复用 S5 模式：global.db/semester.db 句柄 + 注入 ReportPolisher/DeliveryChannel） |
| `src/agent-host/handlers/s6/dto.ts` | DTO 映射（db row → camelCase DTO，对齐 ERD §2.2/§3.6） |
| `src/agent-host/handlers/s6/errors.ts` | 共享错误工具（复用 S5 模式 + privacyViolation） |
| `src/agent-host/handlers/s6/events.ts` | study_events 写入（report_generated / report_delivered，source_system='S6'） |
| `src/agent-host/handlers/s6/lookup.ts` | 跨库查找（reportKey → semester.db 定位） |
| `src/agent-host/handlers/s6/index.ts` | handler 装配出口（createS6Handlers） |
| `src/agent-host/handlers/s6/reports.ts` | reports.generate/freeze/get/list（4 方法） |
| `src/agent-host/handlers/s6/deliveries.ts` | deliveries.deliver/retry/list（3 方法） |
| `src/agent-host/handlers/s6/report-targets.ts` | reportTargets.list/create/update/delete（4 方法） |
| `src/agent-host/handlers/s6/report-generator.ts` | 规则报告生成器（聚合 S1/S2/S3/S4，6 section，确定性只读） |
| `src/agent-host/handlers/s6/report-polisher.ts` | 可注入 AI 润色接口（默认 mock 确定性润色 + 失败模拟） |
| `src/agent-host/handlers/s6/leak-detector.ts` | assertNoSensitiveLeak UUID 正则检测 |
| `src/agent-host/handlers/s6/delivery-channels.ts` | 投递渠道独立失败隔离 + credential-vault 集成（4 渠道 mock） |
| `src/agent/tools/s6/tools.ts` | 3 studybuddy_* 工具定义（TypeBox schema + execute 薄封装） |
| `tests/unit/s6-tools.test.ts` | 单件测试（工具契约 + 工具名/数量断言） |
| `tests/integration/s6-handlers.test.ts` | 集成测试（11 handler 全链路 + 安全不变量） |

### 将修改的文件

| 文件路径 | 修改内容 |
|---|---|
| `src/contract/types.ts` | DTO 对齐 ERD §2.2/§3.6：ParentReport 补 6 字段 + ReportDelivery status `delivered`→`sent` + 字段名对齐 + ParentReportTarget 补 enabled/channelConfigJson |
| `src/agent/studybuddy-extension.ts` | 接入 S6Context + createS6Tools（3 工具注册，累计 24 工具） |

## 4. 接口设计

### RPC 方法（06-API §3.8，11 方法已存在于 api.ts，无需改 api.ts）

```typescript
// reports.* (4)
"reports.generate": { params: { semesterId, reportType, periodStart, periodEnd }; result: ParentReport }
"reports.freeze": { params: { reportKey }; result: ParentReport }
"reports.get": { params: { reportKey }; result: ParentReport }
"reports.list": { params: { semesterId?, reportType? }; result: ParentReport[] }

// deliveries.* (3)
"deliveries.deliver": { params: { reportKey, channel }; result: ReportDelivery }
"deliveries.retry": { params: { reportKey, channel }; result: ReportDelivery }
"deliveries.list": { params: { reportKey? }; result: ReportDelivery[] }

// reportTargets.* (4)
"reportTargets.list": { params: { semesterId }; result: ParentReportTarget[] }
"reportTargets.create": { params: { semesterId, targetName, channelType, channelConfig, credentialKey? }; result: ParentReportTarget }
"reportTargets.update": { params: { id, ...fields }; result: ParentReportTarget }
"reportTargets.delete": { params: { id }; result: void }
```

### registerTool 工具（3 个）

```typescript
// 1. studybuddy_generate_parent_report → reports.generate + reports.freeze（生成即冻结）
pi.registerTool({
  name: "studybuddy_generate_parent_report",
  label: "生成家长报告",
  description: "规则优先聚合 S1-S4 数据生成家长报告（6 section）+ AI 仅润色（失败保留规则报告）+ 冻结快照 + UUID 泄漏检测。不含原文/题干/答案/作答/错因/UUID/真实渠道地址。",
  parameters: Type.Object({
    semesterId: Type.String(),
    reportType: Type.Union([Type.Literal("daily"), Type.Literal("weekly"), Type.Literal("monthly"), Type.Literal("exam_reminder")]),
    periodStart: Type.String(),
    periodEnd: Type.String(),
  }),
  execute: async (_id, params) => { /* reports.generate + 内部 freeze */ }
});

// 2. studybuddy_deliver_parent_report → deliveries.deliver + deliveries.retry
pi.registerTool({
  name: "studybuddy_deliver_parent_report",
  label: "投递家长报告",
  description: "投递冻结报告到指定渠道（local_export/smtp/feishu_webhook/print），渠道独立失败隔离，最多重试 3 次达上限 retained_locally。真实渠道地址在 credential-vault。",
  parameters: Type.Object({
    reportKey: Type.String(),
    channel: Type.Union([Type.Literal("local_export"), Type.Literal("smtp"), Type.Literal("feishu_webhook"), Type.Literal("print")]),
    retry: Type.Optional(Type.Boolean({ description: "true=重试已有投递，false=新建投递" })),
  }),
  execute: async (_id, params) => { /* retry=true→deliveries.retry, false→deliveries.deliver */ }
});

// 3. studybuddy_manage_report_targets → reportTargets.create/update/delete
pi.registerTool({
  name: "studybuddy_manage_report_targets",
  label: "管理报告目标",
  description: "管理家长报告投递目标（创建/更新/软删除）。真实邮箱/Webhook URL 存 credential-vault，channelConfig 仅存别名。",
  parameters: Type.Object({
    action: Type.Union([Type.Literal("create"), Type.Literal("update"), Type.Literal("delete")]),
    // create: semesterId + targetName + channelType + channelConfig + credentialKey?
    // update: id + ...fields
    // delete: id
  }),
  execute: async (_id, params) => { /* 按 action 分发 */ }
});
```

### 数据表（05-ERD §2.2 + §3.6，已存在于 schema，无需改 schema）

```sql
-- 全局库 global.db §2.2
parent_report_targets (id, semester_id, target_name, channel_type, channel_config_json, credential_key, enabled, created_at, updated_at, deleted_at)

-- 学期库 semester.db §3.6
parent_reports (report_key PK, semester_id, report_type, period_start, period_end, content_json, content_hash, rule_generated, ai_polished, ai_model, prompt_version, privacy_check_passed, generated_at, created_at)
report_deliveries (report_key FK, channel, status, retry_count, max_retries, error_code, sent_at, last_attempt_at, created_at, PK(report_key, channel))
```

### DTO 对齐修正（types.ts → ERD §2.2/§3.6）

```typescript
// 修正前（types.ts 现状）
interface ParentReport { reportKey, semesterId, reportType, periodStart, periodEnd, contentJson, contentHash, frozenAt?, createdAt }
interface ReportDelivery { id, reportKey, channel, status: "pending"|"delivered"|"failed"|"retained_locally", attempts, lastError?, deliveredAt? }
interface ParentReportTarget { id, semesterId, targetName, channelType, channelConfig, credentialKey? }

// 修正后（对齐 ERD §2.2/§3.6）
interface ParentReport {
  reportKey, semesterId, reportType: "daily"|"weekly"|"monthly"|"exam_reminder",
  periodStart, periodEnd, contentJson, contentHash,
  ruleGenerated: number, aiPolished: number, aiModel?: string, promptVersion?: string,
  privacyCheckPassed: number, generatedAt, createdAt
}
interface ReportDelivery {
  reportKey, channel,
  status: "pending"|"sent"|"failed"|"retained_locally",  // delivered→sent 对齐 ERD CHECK
  retryCount, maxRetries, errorCode?: string, sentAt?: string, lastAttemptAt?: string, createdAt
}
interface ParentReportTarget {
  id, semesterId, targetName, channelType: "local_export"|"smtp"|"feishu_webhook"|"print",
  channelConfigJson: string, credentialKey?: string, enabled: number, createdAt, updatedAt, deletedAt?: string
}
```

## 5. 测试策略

### 单件测试（阶段 2，tests/unit/s6-tools.test.ts）

- [ ] 3 工具名匹配 `^studybuddy_[a-z_]+$` + 数量 = 3
- [ ] generate_parent_report：TypeBox schema 必填字段校验 + execute 返回 content+details
- [ ] deliver_parent_report：retry=true/false 分发逻辑 + execute 返回投递状态
- [ ] manage_report_targets：action=create/update/delete 三分支分发
- [ ] assertNoSensitiveLeak：注入完整 UUID → 抛 PARENT_REPORT_PRIVACY_VIOLATION（08-Test §5.4）
- [ ] assertNoSensitiveLeak：无 UUID 的报告 → 通过
- [ ] 规则报告生成器：6 section 全部生成（study_rhythm/materials/practice/mistakes/exam_reminder/data_quality）
- [ ] 规则报告生成器：不含原文/题干/答案/作答/错因（脱敏断言）
- [ ] AI 润色 mock：成功润色返回 aiPolished=1；失败模拟返回规则报告 aiPolished=0（降级不阻塞）
- [ ] 投递渠道独立失败隔离：smtp 失败不影响 feishu_webhook（08-Test §5.4 渠道隔离）

### 集成测试（阶段 3，tests/integration/s6-handlers.test.ts）

- [ ] reportTargets.create → list → update → delete 软删除全链路
- [ ] reports.generate：规则聚合 6 section + 写 parent_reports + 写 study_events(report_generated, S6)
- [ ] reports.generate：AI 润色失败 → 保留规则报告（aiPolished=0）+ 不阻塞
- [ ] reports.freeze：冻结快照 content_json + content_hash SHA-256 + assertNoSensitiveLeak 通过
- [ ] reports.freeze：注入 UUID 到 content_json → 抛 PARENT_REPORT_PRIVACY_VIOLATION + 降级规则报告
- [ ] reports.get / reports.list：查询返回 DTO（不含敏感字段）
- [ ] deliveries.deliver：按 report_key+channel 去重（PK 冲突拒绝重复投递）
- [ ] deliveries.deliver：local_export 成功 → status=sent；smtp mock 失败 → status=failed
- [ ] deliveries.deliver：credential-vault 解密失败 → INTERNAL_ERROR + "家长联系方式解密失败，请重新配置"
- [ ] deliveries.retry：retry_count < max_retries → 重试；达上限 → retained_locally
- [ ] deliveries.retry：写 study_events(report_delivered, S6)
- [ ] deliveries.list：按 reportKey 查询投递记录
- [ ] 渠道独立失败隔离：smtp 失败 + feishu_webhook 成功 → 两条记录独立 status
- [ ] DTO 对齐 ERD：ParentReport 含 ruleGenerated/aiPolished/privacyCheckPassed 等字段
- [ ] DTO 对齐 ERD：ReportDelivery.status 值域 sent（非 delivered）

### 系统冒烟（阶段 5a，暂不在本任务范围，E2E-06 属 T-M2-008）

- [ ] （后续任务）S6 全链路冒烟：generate → freeze → deliver → retry

### 安全不变量（08-Test §5.4）

- [ ] assertNoSensitiveLeak UUID 正则检测：注入完整 UUID → PARENT_REPORT_PRIVACY_VIOLATION
- [ ] 家长报告不含原文/题干/答案/作答/错因/UUID/真实渠道地址（序列化正则扫描禁用词）
- [ ] 真实渠道地址只在 credential-vault，DTO 只含别名

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | ⏭️ 跳过（无新外部组件，复用 credential-vault + SQLite） |
| 2. 单件测试 | ✅ 涉及（s6-tools.test.ts：工具契约 + leak-detector + generator + polisher + channels） |
| 3. 集成测试 | ✅ 涉及（s6-handlers.test.ts：11 handler 全链路 + 安全不变量） |
| 4. 系统组装 | ✅ 涉及（studybuddy-extension 接入 S6 工具注册） |
| 5. 冒烟 + E2E | ⏭️ 跳过（E2E-06 属 T-M2-008，本任务仅单件+集成） |

## 7. 依赖关系

### 前置任务

- [x] T-M2-001 S5 期末冲刺（已完成，master 9ddcaec + origin/master 推送）
- [x] T-M0-003 credential-vault（已完成，S6 投递需读取家长联系方式）
- [x] T-M0-006 数据层 schema（已完成，parent_reports/report_deliveries/parent_report_targets 表已建）
- [x] T-M1-001~004 S1-S4（已完成，S6 规则报告聚合 S1-S4 数据）

### 组件依赖

- [x] credential-vault（T-M0-003，投递渠道读取家长联系方式）
- [x] global.db + semester.db schema（T-M0-006，S6 三表已建）
- [x] S1/S2/S3/S4 数据（规则报告聚合来源）

## 8. 预期产物

### 代码

- `src/agent-host/handlers/s6/` 13 文件（context/dto/errors/events/lookup/index/reports/deliveries/report-targets/report-generator/report-polisher/leak-detector/delivery-channels）
- `src/agent/tools/s6/tools.ts`（3 工具）
- `tests/unit/s6-tools.test.ts` + `tests/integration/s6-handlers.test.ts`

### 文档更新

- `src/contract/types.ts`（DTO 对齐 ERD）
- `src/agent/studybuddy-extension.ts`（接入 S6）
- 收尾时：`docs/04-Todo` v0.1.25（§7.3.1 登记 T-M2-002 done + §9 统计 M2 2 done）
- 收尾时：`docs/00-索引` v0.1.33 + `AGENTS.md` v0.1.13（§3.1 版本同步）

### 实施记录

- `.record/T-M2-002-实施记录.md`（收尾时创建，8 章节）

## 9. 16 步执行跟踪

- [ ] 步骤 1：读文档、定边界（已完成：07-WF §3 + 06-API §3.8 + 05-ERD §2.2/§3.6 + 08-Test §5.4）
- [ ] 步骤 2：检查文档门禁（已完成：T-M2-001 done + master 干净 + origin/master 推送）
- [ ] 步骤 3：编写 .plan/ 计划（本文件）
- [ ] 步骤 4：独立审查计划（待用户审查）
- [ ] 步骤 5：用户批准计划（★ 用户授权，待批准）
- [ ] 步骤 6：拆分任务、逐项实现（DTO 对齐 → leak-detector → report-generator → report-polisher → delivery-channels → reports handler → deliveries handler → report-targets handler → tools → extension 接入）
- [ ] 步骤 7：编写或更新测试（TDD：RED 先写失败测试 → GREEN 最小实现 → REFACTOR）
- [ ] 步骤 8：type-check（pnpm type-check）
- [ ] 步骤 9：build（pnpm build）
- [ ] 步骤 10：test（pnpm test，预期 420+ 测试全绿）
- [ ] 步骤 11：smoke / E2E（pnpm smoke + pnpm verify，本任务无 E2E）
- [ ] 步骤 12：独立审查并修复
- [ ] 步骤 13：更新 04-Todo + 文档（v0.1.25 + 00-索引 v0.1.33 + AGENTS.md v0.1.13）
- [ ] 步骤 14：文档治理检查（node scripts/check-docs-governance.mjs）
- [ ] 步骤 15：diff 检查（git diff --check）
- [ ] 步骤 16：提交交付（★ 用户授权，分支 agent/T-M2-002-s6-parent-report + commit feat(s6): 家长报告工具注册 + API）

## 10. 证据登记（收尾时填写）

- 测试日志路径：
- 提交哈希：
- 推送状态：
- 实施记录路径：.record/T-M2-002-实施记录.md

---

## 关键技术决策

### 决策 1：generate 即 freeze（工具层合并，RPC 层分离）

**选择**：studybuddy_generate_parent_report 工具内部调用 reports.generate 后自动调 reports.freeze；RPC 层 reports.generate 和 reports.freeze 保持分离。

**依据**：07-WF §3.1 流程"生成→冻结"是连续步骤，AI 工具调用应一步到位；但 RPC 层分离支持未来"生成草稿→人工审核→冻结"扩展。S5 generatePaper 也是一步生成完整 paper。

### 决策 2：AI 润色可注入接口（ReportPolisher，默认 mock 确定性润色）

**选择**：ReportPolisher 接口 `polish(report: RuleReport): Promise<PolishedReport>`，默认 createMockReportPolisher() 返回确定性润色（加摘要句），createFailingReportPolisher() 抛错测试降级。

**依据**：复用 S5 MockExamGenerator 可注入模式（T-M2-001 已验证）；08-Test §5.5 AI 失败降级不阻塞。

### 决策 3：投递渠道独立失败隔离（DeliveryChannel 接口 + 4 实现）

**选择**：DeliveryChannel 接口 `deliver(report, target): Promise<DeliveryResult>`，4 实现：LocalExportChannel（写文件成功）/ SmtpChannel（mock 可控成功失败）/ FeishuWebhookChannel（mock）/ PrintChannel（mock 成功）。deliver 遍历目标渠道，每个独立 try-catch，互不影响。

**依据**：07-WF §3.2"渠道独立失败隔离：SMTP 失败不影响飞书"；08-Test §5.4 渠道隔离断言。

### 决策 4：credential-vault 集成（解密失败 INTERNAL_ERROR）

**选择**：deliveries.deliver 读取 parent_report_targets.credential_key → 调 credential-vault.get(key) → 解密失败抛 INTERNAL_ERROR + "家长联系方式解密失败，请重新配置"。

**依据**：07-WF §3.2 错误处理"credential-vault 解密失败 → 返回 INTERNAL_ERROR"；06-API §3.15 credentials.get。本任务不直接调真实 credential-vault（测试用 mock 注入），但 handler 逻辑预留集成点。

### 决策 5：DTO 对齐 ERD（types.ts 修正 3 处不一致）

**选择**：按权威链 05-ERD（优先级 4）> types.ts（优先级 7）修正：
- ReportDelivery.status：`"delivered"` → `"sent"`（对齐 ERD CHECK）
- ReportDelivery 字段名：`attempts/lastError/deliveredAt` → `retryCount/maxRetries/errorCode/sentAt/lastAttemptAt/createdAt`（对齐 ERD 列名 camelCase）
- ParentReport 补 6 字段：`ruleGenerated/aiPolished/aiModel/promptVersion/privacyCheckPassed/generatedAt`（对齐 ERD §3.6.1）
- ParentReportTarget 补 `enabled/channelConfigJson`（对齐 ERD §2.2，`channelConfig`→`channelConfigJson`）

**依据**：AGENTS.md §11.2 修订纪律 + 权威链 05-ERD > types.ts（T-M1-001 前置 DTO 对齐已建立此先例）。

---

## 审查记录

（步骤 4 独立审查时填写）

## 完成记录

（步骤 5 收尾时填写）
- 完成日期：
- 实施记录：.record/T-M2-002-实施记录.md
- 状态：✅ 已完成
