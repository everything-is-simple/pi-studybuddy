# 任务计划：T-M0-002 contract 类型化 IPC + RPC 完整接口

**任务 ID**：T-M0-002
**日期**：2026-08-07
**状态**：✅ 已完成（2026-08-07 TDD 实现 + verify 全绿，待用户授权提交）
**关联文档**：03-Arch §6.2-§6.3 + 06-API §1.2-§3 + §4-§5 + 08-Test §5.7
**里程碑**：M0 骨架搭建
**前置**：T-M0-001 ✅ done（RPC 运行时 rpc.ts 已就绪，本任务在其上补全类型契约）

---

## 1. 任务目标

### 做什么

在 T-M0-001 已实现的自研 MessagePort RPC 运行时（`rpc.ts`，五种 wire 消息 + createRpcServer/createRpcClient）之上，**补全 contract 类型化契约面**：`interface Api`（06-API §3 全部 ~100 方法）、DTO 类型（06-API §3 各方法 params/result + §5 DTO 规范）、Streams（06-API §4 九个推送主题）、PiBridge 完整接口。同时落地安全不变量 INV-05（Host RPC 契约化，08-Test §5.7）。

### 为什么

- **壳层稳定先于业务**：AGENTS.md §4.3 + 03-Arch §9.2 明确 contract 是壳层第五件，T-M0-001 只做了运行时 + `system.ping` 占位，完整契约面是 T-M0-002 必交。
- **M0 退出门槛前置**：04-Todo §6.2 退出门槛"contract RPC 可 renderer→main→agent-host 往返"的完整类型面依赖本任务。
- **INV-05 补全**：08-Test §5.7 六条安全不变量中第 5 条（Host RPC 契约化）由 T-M0-002 落地。

### 依据

- 03-Arch §6.2 contract 目录：`api.ts`（interface Api ~50 方法）+ `desktop.ts`（PiBridge）+ `types.ts`
- 03-Arch §6.3 自研 RPC 层（五种 wire 消息，T-M0-001 已实现）
- 06-API §1.2 RPC 层 + §1.3 绑定与安全（Host RPC 契约化）
- 06-API §3 全部方法表（sessions/files/S1-S7/TTS/备份恢复/skills/models/settings/credentials/toolchains）
- 06-API §4 Streams（9 个推送主题）+ §5 DTO 规范（防泄露/脱敏/分页/时间戳）
- 08-Test §5.7 安全不变量之五（Host RPC 契约化）

## 2. 范围与非目标

### 范围

1. **`contract/api.ts` 完整接口**：`interface Api` 按 06-API §3 全部方法表填充（方法名 `namespace.action` 风格，每个方法 `{ params, result }` 类型）。命名空间清单见 §4。
2. **`contract/types.ts` DTO 类型**：新增各命名空间 DTO（Semester/CourseInstance/AssessmentAttempt/ScheduleEntry/StudyTask/StudyEvent/DailyBrief/Material/StructuredNote/MindMap/KnowledgeModule/Job/QuestionDTO/PracticeSession/PracticeResult/Mistake/WeakPoint/MockExam*/CramCard/CramPlanDay/ParentReport/ReportDelivery/ParentReportTarget/BackupRecord/RestoreResult/BackupSchedule/SkillManifest/ModelProvider/ModelConfig/ModelInfo/AppSettings/ToolchainStatus/AgentEvent/FileEntry/Session* 等）+ API 信封（Envelope/ErrorEnvelope）+ 错误码枚举（06-API §2.2 五码 + PARENT_REPORT_PRIVACY_VIOLATION）。
3. **`contract/streams.ts` Streams 接口**：06-API §4 九个推送主题（agent.events / files.changed / jobs.progress / practice.timer / tts.state / backup.progress / delivery.status / toolchains.changed / schedule.reminder）。
4. **`contract/desktop.ts` PiBridge 完整接口**：T-M0-001 仅 connectHost，本任务扩展为 renderer↔main 完整桥面（selectDirectory / showDialog / toolchain query / window 控制等，见 §4.2）。
5. **类型测试**：`tests/unit/contract.test.ts` 用 `expectTypeOf` 断言契约面与 06-API 权威条款对齐（方法全集、DTO 导出、Streams 主题、错误码）。
6. **`check-contract-coverage.mjs` 适配**：将"missing handlers 硬失败"改为警告（contract 声明但 handler 未注册 → M1+ 业务任务补）；保留"unknown/duplicate handlers 硬失败"。
7. **`check-desktop-security.mjs` INV-05 落地**：从占位 → 断言 api.ts 含完整接口（方法数 ≥ 阈值）。

### 非目标（不做什么）

- ❌ 实现各方法 handler（业务逻辑）→ M1+（本任务只声明类型契约，不写 handler）
- ❌ credential-vault（safeStorage）→ T-M0-003
- ❌ toolchain 发现实现 → T-M0-004
- ❌ file-watch 实现 → T-M0-005
- ❌ 数据层 schema → T-M0-006
- ❌ studybuddy-extension 空壳 → T-M0-007
- ❌ 09-UI 三栏布局 → T-M0-008
- ❌ M0 系统冒烟完整 → T-M0-009
- ❌ 业务 DTO 的完整字段级精确定义（以 06-API §3 方法表为准，字段级 DTO 精化在各业务任务 M1+ 展开）

## 3. 文件清单

### 将创建的文件

| 文件路径 | 用途 |
|---|---|
| `src/contract/api.ts`（修改） | interface Api 完整接口（~100 方法） |
| `src/contract/types.ts`（修改） | DTO 类型 + 信封 + 错误码 |
| `src/contract/streams.ts`（新增） | Streams 接口（9 主题） |
| `src/contract/desktop.ts`（修改） | PiBridge 完整接口 |
| `tests/unit/contract.test.ts`（新增） | 类型契约测试（expectTypeOf） |

### 将修改的文件

| 文件路径 | 修改内容 |
|---|---|
| `scripts/check-contract-coverage.mjs` | missing handlers 改警告 + 文档注释同步 |
| `scripts/check-desktop-security.mjs` | INV-05 落地（占位 → 实断言） |
| `docs/04-Todo-List.md` | T-M0-002 任务行状态 → in_progress |
| `.plan/00-当前任务.md` | 指向本计划文件 |
| `docs/00-文档索引-Index.md` | 版本历史登记（如需） |

## 4. 接口设计

### 4.1 contract/api.ts — interface Api 命名空间清单（06-API §3）

| 命名空间 | 方法数 | 来源 |
|---|---|---|
| sessions.* | 7 | §3.1 |
| files.* | 7 | §3.2 |
| semesters.* / courses.* / exams.* / schedule.* / tasks.* / events.* | 6+6+4+4+4+2 | §3.3 S1 |
| materials.* / notes.* / modules.* / jobs.* | 9+3+3+2 | §3.4 S2 |
| practice.* | 5 | §3.5 S3 |
| mistakes.* / weakPoints.* | 6+4 | §3.6 S4 |
| mockExams.* / cramCards.* / cramPlan.* | 6+1+1 | §3.7 S5 |
| reports.* / deliveries.* / reportTargets.* | 4+3+4 | §3.8 S6 |
| classCapture.* | 2 | §3.9 S7 |
| tts.* | 4 | §3.10 |
| backup.* | 7 | §3.11 |
| skills.* | 5 | §3.12 |
| models.* / modelsConfig.* | 2+3 | §3.13 |
| settings.* | 4 | §3.14 |
| credentials.* | 4 | §3.15 |
| toolchains.* | 3 | §3.16 |
| system.ping | 1 | T-M0-001 保留 |

> 合计约 100+ 方法。每个方法类型 `"namespace.action": { params; result }`。

### 4.2 contract/desktop.ts — PiBridge 完整接口

renderer↔main 桥面（06-API §1.3 preload 受控桥接 + 03-Arch §6.2）：

```typescript
export interface PiBridge {
  connectHost(): Promise<AnyMessagePort>;
  selectDirectory(): Promise<string | null>;
  showDialog(options: DialogOptions): Promise<DialogResult>;
  queryToolchains(): Promise<ToolchainStatus[]>;
  getWindowState(): Promise<{ maximized: boolean }>;
  minimizeWindow(): void;
  maximizeWindow(): void;
  closeWindow(): void;
}
```

> 桥面方法不实现 handler（MAIN 侧实现留 T-M0-004/T-M0-008 等依据依赖补全），本任务仅声明类型。

### 4.3 contract/streams.ts — Streams 接口（06-API §4 九主题）

```typescript
export interface Streams {
  "agent.events": AgentEvent;
  "files.changed": { path: string; changeType: "add" | "change" | "unlink" };
  "jobs.progress": Job;
  "practice.timer": { sessionId: string; elapsedMs: number; remainingMs?: number };
  "tts.state": { playbackId: string; state: "playing" | "paused" | "stopped"; position: number; duration: number };
  "backup.progress": { backupRecordId: string; phase: string; progress: number };
  "delivery.status": ReportDelivery;
  "toolchains.changed": ToolchainStatus[];
  "schedule.reminder": { taskType: string; message: string };
}
```

### 4.4 contract/types.ts — 信封 + 错误码 + DTO

```typescript
export type ErrorCode =
  | "NOT_FOUND" | "INVALID_JSON" | "FILE_TOO_LARGE"
  | "BAD_REQUEST" | "INTERNAL_ERROR" | "PARENT_REPORT_PRIVACY_VIOLATION";

export interface Envelope<T> { success: true; data: T; meta?: Meta }
export interface ErrorEnvelope { success: false; error: { code: ErrorCode; message: string } }
```

DTO 类型按 06-API §3 + §5 逐命名空间声明（防泄露 DTO `QuestionDTO` 不含 correct_answer 等，06-API §5.1）。

## 5. 测试策略

### 类型契约测试（阶段 2，`tests/unit/contract.test.ts`）

用 vitest `expectTypeOf` 断言（RED → GREEN）：

- [ ] `Api` 接口含全部命名空间方法（06-API §3 全集）
- [ ] `Streams` 含 9 主题（06-API §4）
- [ ] `ErrorCode` 含 5 通用码 + PARENT_REPORT_PRIVACY_VIOLATION（06-API §2.2）
- [ ] `Envelope`/`ErrorEnvelope` 结构符合 06-API §2.1
- [ ] QuestionDTO 不含泄露字段（06-API §5.1）
- [ ] 关键 DTO（RestoreResult/CramCard/CramPlanDay）结构与 06-API §3 对齐
- [ ] PiBridge 接口含 connectHost + 新增桥面方法

### 集成/冒烟（阶段 3-5）

- host-rpc 集成测试（T-M0-001）保持通过，验证新增类型不破坏 RPC 往返。
- `check-contract-coverage.mjs`：修改后扫描仍识别 `system.ping` handler，Api 方法多数无 handler → 警告不阻塞。
- `check-desktop-security.mjs` INV-05 落地：断言 api.ts 方法数 ≥ 阈值。

### 安全不变量（本任务补 INV-05）

- 08-Test §5.7 六条：INV-05（Host RPC 契约化）从占位 → 实断言。

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | — 不涉及（纯类型契约，无新外部组件） |
| 2. 单件测试 | ⏳ contract.test.ts 类型断言 |
| 3. 集成测试 | 保持 host-rpc 通过 |
| 4. 系统组装 | api.ts/types.ts/streams.ts/desktop.ts 进入 src/contract/ |
| 5. 冒烟 + E2E | check-contract-coverage + check-desktop-security |

## 7. 依赖关系

### 前置任务

- [x] T-M0-001（rpc.ts 运行时 + 最小 contract 骨架）

### 组件依赖

- [x] TypeScript 5+ strict（expectTypeOf 类型测试）
- [x] vitest（单件测试）

### 参考仓库

- `H:\pi-references\pi-desktop\src\contract\{api,desktop,browser,types}.ts`（契约类型范式，03-Arch §6.1 删除 browser）
- `H:\pi-references\pi-desktop\scripts\check-contract-coverage.mjs`（AST 校验范式）

**纪律**：参考范式但独立重实现，不复制代码。

## 8. 预期产物

- `src/contract/api.ts`（~100 方法完整接口）
- `src/contract/types.ts`（DTO + 信封 + 错误码）
- `src/contract/streams.ts`（9 Streams）
- `src/contract/desktop.ts`（PiBridge 完整）
- `tests/unit/contract.test.ts`
- `scripts/check-contract-coverage.mjs`（missing 改警告）
- `scripts/check-desktop-security.mjs`（INV-05 落地）
- `.record/T-M0-002-实施记录.md`（收尾时创建）

## 9. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（已完成：03-Arch §6.2-§6.3 + 06-API §1-§5 + 08-Test §5.7）
- [x] 步骤 2：检查文档门禁（已完成：T-M0-001 done + master 干净 + .plan 无执行中任务）
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [x] 步骤 4：独立审查计划
- [x] 步骤 5：用户批准计划（★ 用户授权，2026-08-07 批准开工）
- [x] 步骤 6：拆分任务、逐项实现
- [x] 步骤 7：TDD 测试（RED → 最小实现 GREEN → REFACTOR）
- [x] 步骤 8：type-check（`pnpm type-check`）
- [x] 步骤 9：build（`pnpm build`）
- [x] 步骤 10：test（`pnpm test`）
- [x] 步骤 11：smoke（`pnpm smoke` + 安全脚本）
- [x] 步骤 12：独立审查并修复
- [x] 步骤 13：更新 04-Todo + 文档
- [x] 步骤 14：文档治理检查（`node scripts/check-docs-governance.mjs`）
- [x] 步骤 15：diff 检查（`git diff --check`）
- [ ] 步骤 16：提交交付（★ 用户授权后执行）

## 10. 证据登记（收尾时填写）

- 测试日志路径：`pnpm verify` 全绿（执行 7，跳过 2）；类型契约测试 25+25 断言通过
- 提交哈希：待用户授权提交后填写
- 推送状态：待用户授权提交后填写
- 实施记录路径：`.record/T-M0-002-实施记录.md`

---

## 审查记录

### 审查项（步骤 4 独立审查）

1. **范围合理性**：T-M0-002 仅补全类型契约面（api/types/streams/desktop + 类型测试），不实现 handler（业务逻辑 M1+），与 03-Arch §9.2 装配顺序一致。
2. **TDD 纪律**：contract.test.ts 用 expectTypeOf 断言 06-API 权威条款（方法全集/Streams/错误码/DTO），先 RED 后 GREEN。
3. **治理脚本适配必要性**：contract-coverage 当前把"missing handlers"硬失败，但 T-M0-002 只声明契约不写 handler → 必须改警告，否则无法通过质量门。此为权威文档（06-API §3）与实现结构（业务 handler M1+）的必然落差。
4. **不复制参考代码**：03-Arch §9.3 明确参考 pi-desktop 但独立重实现。
5. **退出门槛明确**：类型测试全绿 + host-rpc 保持通过 + INV-05 落地 + verify 全绿。

### 待用户审查关注点

- 范围划分是否合理（T-M0-002 仅类型契约，不实现 handler）
- `check-contract-coverage.mjs` 将"missing handlers"从硬失败改为警告是否可接受（业务 handler 在 M1+ 补全，届时可恢复严格校验）
- 是否需要 ESLint + Prettier 并入（T-M0-001 审查建议暂缓，由用户裁决）

## 完成记录

- 完成日期：2026-08-07
- 实施记录：.record/T-M0-002-实施记录.md
- 状态：✅ 已完成（待用户授权提交）