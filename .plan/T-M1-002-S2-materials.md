# T-M1-002 S2 资料/笔记/知识模块 工具注册 + API

**状态**：✅ 完成（TDD 实施完成，295 测试全绿，verify 7+2 全通过，待用户授权提交推送）
**日期**：2026-08-07
**里程碑**：M1 核心闭环 MVP（第 2 项）
**治理阶段**：阶段2-4（单件→集成→装配→冒烟）

## 权威依据

- [04-Todo §7.2 行 416 + §7.2.1](../docs/04-任务清单-Todo-List.md)：T-M1-002 = S2 资料/笔记/知识模块 工具注册 + API
- [07-WF §2.3](../docs/07-工作流-Workflow.md)：S2 资料笔记流程（7 步 + 状态机 + 错误处理）
- [07-WF §8.3/§8.4/§8.10](../docs/07-工作流-Workflow.md)：Material / Job / KnowledgeModule 三状态机
- [06-API §3.4](../docs/06-API契约-API-Contracts.md)：S2 资料笔记 17 方法（4 命名空间）+ §5 Streams `jobs.progress`
- [03-Arch §3.1](../docs/03-架构设计-Architecture-Design.md)：studybuddy_* registerTool 工具 + §2.2 ToolDefinition 契约
- [05-ERD §3.2.1-3.2.7](../docs/05-数据模型-ERD-Data-Model.md)：materials / normalized_texts / structured_notes / mind_maps / knowledge_modules / material_chunks / jobs 七表 schema（已建库 T-M0-006）
- [08-Test §3.1/§3.2](../docs/08-测试验收-Test-Plan.md)：registerTool 工具 4 断言 + CHECK 约束断言

## 前置：DTO 对齐 schema（types.ts 偏离 ERD，须先修正）

T-M1-001 计划 §"前置"已标注"S2-S7 DTO 留待各自 M1 任务对齐"。核实 [src/contract/types.ts](../src/contract/types.ts) 行 218-272，发现 S2 五 DTO + JobStatus/JobType 共 6 处与 05-ERD §3.2 不一致。按权威链 05-ERD（优先级4）> types.ts（优先级7）修正：

| DTO / 类型 | 偏离点 | 修正方向（对齐 ERD） |
|---|---|---|
| `Material` | `fileType` 值域 `text\|pdf\|docx\|pptx\|image\|audio` | 改 `pdf\|docx\|pptx\|xlsx\|txt\|md\|image\|text\|doc\|ppt\|xls`（§3.2.1 CHECK）；移除 audio（S7 用 file_type='text'，非 audio） |
| `Material` | `status` 值域 `pending\|converted\|failed` | 改 `pending\|converting\|converted\|note_generating\|completed\|conversion_failed\|pending_quality_check`（§3.2.1 + §8.3 状态机） |
| `Material` | 缺 9 字段 | 补 `fileName` / `fileSizeBytes` / `mimeType` / `sourceType` / `permissionConfirmed` / `convertedAt` / `noteGeneratedAt` / `updatedAt` / `deletedAt`；`title`→`fileName`；`createdAt` 保留对应 `uploaded_at` |
| `StructuredNote` | 缺 7 字段 | 补 `id` / `courseId` / `promptVersion` / `model` / `tokenCount` / `aiGenerated` / `createdAt` / `updatedAt`；`highlights` 由数组改保留（ERD `highlights_json` 存 JSON 字符串，DTO 暴露数组，映射层互转） |
| `MindMap` | 当前为树形对象 `root: MindMapNode` | 改 `{ id, materialId, courseId, markmapJson, createdAt }`（ERD `markmap_json` 字符串权威）；`MindMapNode` 类型移除 |
| `KnowledgeModule` | `title` / `sourceEvidence: string[]` 偏离 | `title`→`moduleName`；`sourceEvidence`→`sourceEvidenceJson`（字符串）；补 `materialId` / `summary` / `importance` / `difficulty` / `aiGenerated` / `createdAt` / `updatedAt` / `deletedAt` |
| `JobStatus` | `queued\|running\|done\|failed` | 改 `pending\|running\|completed\|failed`（§3.2.7 CHECK + §8.4 状态机） |
| `JobType` | `convert\|generate_note\|transcribe` | 改 `convert_pdf\|convert_docx\|convert_pptx\|convert_xlsx\|ocr_image\|wps_convert\|generate_note`（§3.2.7 CHECK）；移除 `transcribe`（S7 未定案，本任务对齐 ERD 七类，S7 任务再加） |
| `Job` | `progress` / `attempts` / `error` 偏离 | 移除 `progress`（ERD 无）；`attempts`→`retryCount`；`error`→`errorCode`+`errorMessage`；补 `materialId` / `jobType` / `maxRetries` / `startedAt` / `completedAt` / `timeoutMs` / `updatedAt`；`type`→`jobType` |
| `FileMeta` | 当前 `{ name, size, mime }` | 保留（与 ERD `file_name`/`file_size_bytes`/`mime_type` 对应，映射层转换） |

**api.ts 影响**：`materials.upload` 入参 `file: FileMeta` 不变；`Material` / `StructuredNote` / `MindMap` / `KnowledgeModule` / `Job` 返回类型字段变化（已在 api.ts 行 163-191 声明签名，类型引用 types.ts，types.ts 修正后 api.ts 自动对齐，无需改 api.ts 方法签名）。

**核查项**：修正后跑 `pnpm type-check` + `pnpm test`（现有 237 测试）确认无回归。S3-S7 DTO 不动。

## 现状核实（已读源码确认）

- semester.db S2 七表已建（T-M0-006）：materials / normalized_texts / structured_notes / mind_maps / knowledge_modules / material_chunks / jobs
- [contract/api.ts](../src/contract/api.ts) 已声明全部 17 方法签名（行 163-191），无需新增方法
- [contract/types.ts](../src/contract/types.ts) S2 五 DTO + JobStatus/JobType 偏离 ERD（见上节）
- S1 handler 模式可复用：[context.ts](../src/agent-host/handlers/s1/context.ts)（S1Context 句柄缓存）/ [dto.ts](../src/agent-host/handlers/s1/dto.ts)（mapXxx 行→DTO）/ [errors.ts](../src/agent-host/handlers/s1/errors.ts)（notFound/badRequest）/ [lookup.ts](../src/agent-host/handlers/s1/lookup.ts)（findSemesterByCourseId / findSemesterByEntityId）/ [events.ts](../src/agent-host/handlers/s1/events.ts)（跨库查 study_events）/ [index.ts](../src/agent-host/handlers/s1/index.ts)（createS1Handlers 装配出口）
- [studybuddy-extension.ts](../src/agent/studybuddy-extension.ts) 已接入 S1 工具注册范式（S1Context + createS1Tools → pi.registerTool × 6）
- [src/agent/tools/s1/tools.ts](../src/agent/tools/s1/tools.ts) 工具模式：TypeBox schema + execute 薄封装调用 handler
- **T-M1-001 §8 未解决事项 3**：S1 handler 未接入 Host RPC（agent-host/index.ts 未注册），S2 保持一致——通过 registerTool 暴露给 AI，Host RPC 接入留待壳层 UI 任务统一补全
- ERD §3.2.1 materials 触发器：storage_key 路径拒绝 `..` / `:\` / `:/`（路径逃逸防护）
- 06-API §2.1 信封 + §2.2 五错误码 + §2.3 中文可操作消息（永不暴露 SQL/路径/完整 UUID/栈）

## 任务范围

### 交付物

**1. DTO 对齐** — 修正 [src/contract/types.ts](../src/contract/types.ts) S2 五 DTO + JobStatus + JobType + Job（见前置差异表）

**2. RPC handlers（7 文件 + 共享 4 文件，17 方法）** — `src/agent-host/handlers/s2/` 下新建：

| 文件 | 方法 | 关键约束 |
|---|---|---|
| `materials.ts` | list / upload / get / delete / replaceText / convert / retryConversion / generateNote / retryAiGeneration | upload：MIME 服务端验证 + storage_key 路径安全检查（拒绝 `..`/`:\`/`:/`）+ 写 study_events(material_uploaded, source_system='S2')；convert/retry/generate/retryAi 为 **Job 登记入口**：写 jobs(status=pending) + 触发 Material 状态迁移，返回 Job，**不执行转换器/AI**；replaceText 写 normalized_texts + status=converted（跳过转换）；delete 软删除 |
| `notes.ts` | get / update / getMindMap | update 写 structured_notes（note_markdown + highlights_json）+ 更新 updated_at；getMindMap 读 mind_maps |
| `modules.ts` | list / get / updateLearnStatus | get 含 source_evidence_json 回链；updateLearnStatus 状态机校验 not_started→learning→mastered→needs_review |
| `jobs.ts` | get / list | 状态机查询 |
| `context.ts` | S2Context | 复用 S1Context 模式（globalDb + semesterDbs 缓存）|
| `dto.ts` | mapMaterial / mapNote / mapMindMap / mapModule / mapJob | 行→DTO 映射，对齐 ERD 字段 |
| `errors.ts` | notFound / badRequest | 复用 S1 模式 |
| `lookup.ts` | findSemesterByMaterialId / findSemesterByModuleId | 复用 S1 findSemesterByEntityId 模式（遍历非 archived 学期库）|
| `events.ts` | writeS2Event | 写 study_events（material_uploaded / note_generated，source_system='S2'）|
| `index.ts` | createS2Handlers(ctx) | 装配 4 组 handler 出口 |

- 所有 handler 遵循 06-API §2.1 信封；错误码用 §2.2 五码 + §2.3 中文消息
- retry 次数上限校验：retry_count < max_retries（默认 3），超限拒绝

**3. registerTool 工具（6 个）** — `src/agent/tools/s2/tools.ts`，在 studybuddy-extension.ts setup 内 pi.registerTool：

`studybuddy_upload_material` / `studybuddy_convert_material` / `studybuddy_generate_note` / `studybuddy_replace_material_text` / `studybuddy_update_note` / `studybuddy_update_learn_status`

- 工具名匹配 `^studybuddy_[a-z_]+$`；ToolDefinition 必填 name/label/description/parameters/execute
- execute 薄封装调用同一 handler 函数（复用 S1 tools.ts 模式）

**4. studybuddy-extension 集成** — 在 [studybuddy-extension.ts](../src/agent/studybuddy-extension.ts) setup 内追加 createS2Tools + pi.registerTool × 6（与 S1 工具并列）

### 不做

- ❌ OCR venv Adapter（课表图片识别，行 415 独立任务）
- ❌ WPS COM 桥（行 417 独立任务）
- ❌ 资料转换管道真实解析（PDF/DOCX/PPTX/图片 OCR，行 418 独立任务）
- ❌ AI 笔记真实生成（materials.generateNote 仅登记 Job，不调 LLM）
- ❌ 接入 agent-host Host RPC（与 S1 一致，T-M1-001 §8 已记录留待壳层 UI 任务）
- ❌ 09-UI S2 标签页业务 UI（壳层任务）
- ❌ 备份恢复 / TTS / 对话（各自的 M1/M3 任务）
- ❌ 改 api.ts 方法签名（17 方法已声明，仅 types.ts DTO 对齐）
- ❌ 改 semester.db 表结构（T-M0-006 已定，七表 + 触发器）
- ❌ S3-S7 DTO 对齐（各 M1 任务）

## 状态机约束（必须实现校验）

- **Material**（§8.3）：`pending → converting → converted → note_generating → completed`；失败分支 `conversion_failed` / `pending_quality_check`
  - convert：pending→converting；retryConversion：conversion_failed→converting
  - generateNote：converted→note_generating；retryAiGeneration：pending_quality_check→note_generating
  - replaceText：任意→converted（跳过转换）
- **Job**（§8.4 + §3.2.7）：`pending → running → completed` / `failed`；retry_count < max_retries（默认 3）可重试
  - 本任务 Job 仅登记为 pending，不进入 running（转换器/AI 未实现）；状态机校验仍须实现（为后续任务预留）
- **KnowledgeModule learn_status**（§8.10）：`not_started → learning → mastered → needs_review`（任意顺序迁移，非严格线性）
- 非法状态迁移必须拒绝并返回 BAD_REQUEST + 中文消息

## TDD 纪律

- RED（先写与权威条款对应的失败测试）→ GREEN（最小实现）→ REFACTOR
- 测试数据隔离：写入 `H:\pi-studybuddy-tmp\runs\T-M1-002\`，设 `PI_STUDYBUDDY_DATA_ROOT`
- 不连真实外部服务（不调 LLM / OCR / WPS，全部 mock 或仅登记不执行）
- 单件测试：6 工具每个 ≥4 条契约断言（08-Test §3.1）+ CHECK 约束断言（§3.2）
- 集成测试：handler 与既有 semester.db schema 真实读写 + 三状态机迁移 + storage_key 路径逃逸拒绝 + retry 上限

## 完成门槛

- [ ] DTO 对齐 types.ts（前置）+ type-check 全绿 + 现有 237 测试无回归
- [ ] 全部新增单件 + 集成测试通过
- [ ] pnpm type-check / pnpm test / pnpm contract-coverage（基线不退化）/ pnpm desktop-security / pnpm build / pnpm smoke / pnpm verify 全绿
- [ ] node scripts/check-docs-governance.mjs 全绿
- [ ] git diff --check 无空白错误
- [ ] 更新 docs/04-Todo（T-M1-002 done + 证据 + M1 统计）+ 00-索引 + AGENTS.md §3.1 版本号
- [ ] 创建 .record/T-M1-002-实施记录.md（8 章节）
- [ ] 记录未解决事项：S2 handler 未接 Host RPC（与 S1 一致，壳层任务补全）
- [ ] 不提交：真实密钥 / .env.local / 资料原文 / 完整 UUID / node_modules / 运行数据

## 分支与提交

- 分支：`agent/T-M1-002-s2-materials-tools`
- 提交（待用户授权）：`feat(m1): S2 资料/笔记/知识模块 17 RPC handler + 6 studybuddy_* 工具注册 + DTO 对齐 ERD`
