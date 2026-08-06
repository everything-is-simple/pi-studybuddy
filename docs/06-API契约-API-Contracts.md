# 06 API 契约

**版本**：v0.1.1
**日期**：2026-08-07
**状态**：✅ 已审查批准（用户 2026-08-07 批准）
**上游**：[02-PRD v0.1.2 §5](./02-PRD-产品需求-Product-Requirements.md)、[03-Architecture v0.1.0 §3/§6](./03-架构设计-Architecture-Design.md)、[05-ERD v0.1.0](./05-数据模型-ERD-Data-Model.md)
**下游**：07-Workflow、08-Test、09-UI
**架构依据**：pi-desktop contract 类型化 IPC + 自研 MessagePort RPC（非 HTTP REST）

---

## 1. API 总览

### 1.1 架构定位

pi-studybuddy 是**桌面应用**，不是 Web 服务。API 是 **renderer↔main↔agent-host 的 MessagePort RPC 契约**（借鉴 pi-desktop `contract/api.ts`），非 HTTP REST。

```
renderer (React)  ←PiBridge→  main (Electron)  ←RPC→  agent-host (utilityProcess)
     │                              │                          │
     └ contextBridge 受控桥接       └ MessageChannelMain        └ createRpcServer()
                                                                   │
                                                                   ├ pi 扩展层（registerTool 工具）
                                                                   └ 业务 Adapter
```

### 1.2 RPC 层（借鉴 pi-desktop，03-Architecture §6.3）

**五种 wire 消息**：`request` / `response` / `subscribe` / `unsubscribe` / `event`

**API**：
- `createRpcServer()` 在 agent-host 内 `attachPort(MessagePort)`
- `createRpcClient(port)` 在 renderer 提供 `call(method, ...args)` 和 `subscribe(topic, key, on)`
- `AnyMessagePort` 兼容 DOM MessagePort / utilityProcess / Node worker_threads

### 1.3 绑定与安全

- **仅 127.0.0.1**：无公网入口；loopback Origin 策略
- **sandbox:true + 严格 CSP**：renderer 沙箱化
- **preload 受控桥接**：仅 `contextBridge.exposeInMainWorld("piBridge", bridge)`，PiBridge 白名单接口
- **Host RPC 契约化**：`contract/{api,rpc}.ts` 类型约束

### 1.4 双层 API 体系

| 层 | 调用者 | 入口 | 用途 |
|---|---|---|---|
| **RPC 方法**（本文件主体） | renderer UI | `contract/api.ts` 的 `interface Api` | 学生操作（上传/练习/查看等） |
| **registerTool 工具** | AI agent | `pi.registerTool(tool)` | AI 受约束调用业务能力（03-Architecture §3） |

> 两者关系：部分 RPC 方法内部调用 registerTool 工具（如 `practice.submit` 调用 `studybuddy_submit_practice`）；部分是纯 UI 操作（如 `files.list`）。

---

## 2. API 信封规范

### 2.1 统一信封（02-PRD §5.4）

```typescript
// 成功
{
  success: true,
  data: T,
  meta?: {                          // 可选元信息
    total?: number,                  // 分页总数
    page?: number,
    pageSize?: number,
    timestamp: string               // ISO 8601 UTC
  }
}

// 失败
{
  success: false,
  error: {
    code: ErrorCode,                // 错误码枚举（见 §2.2）
    message: string                 // 中文可操作消息（永不暴露内部错误栈）
  }
}
```

### 2.2 统一错误码（5 个，02-PRD §5.4）

| 错误码 | HTTP 类比 | 含义 | 中文消息示例 |
|---|---|---|---|
| `NOT_FOUND` | 404 | 资源不存在 | "未找到该课程，请检查是否已删除" |
| `INVALID_JSON` | 400 | 请求体 JSON 格式错误 | "请求数据格式错误，请刷新后重试" |
| `FILE_TOO_LARGE` | 413 | 文件超过大小限制 | "文件过大，请压缩或分段上传" |
| `BAD_REQUEST` | 400 | 业务校验失败（状态机/权限/约束） | "该考试未确认，无法生成模拟卷" |
| `INTERNAL_ERROR` | 500 | 内部错误（脱敏后返回） | "操作失败，请稍后重试；如持续发生请重启应用" |

**特殊错误码**（非通用，特定场景）：
- `PARENT_REPORT_PRIVACY_VIOLATION`（500）：UUID 泄漏检测失败（02-PRD §5.2）

**错误码格式约束**：`errorCode` 必须匹配 `^[A-Z][A-Z0-9_]{1,63}$`（02-PRD §5.3）

### 2.3 中文可操作消息原则

- 永不暴露：内部错误栈、SQL 语句、文件路径、完整 UUID、API Key
- 面向学生：中文、可操作、告诉学生"怎么办"
- 失败可重试：提示重试方式
- 失败不可重试：提示具体操作（如"重启应用"/"检查文件格式"）

---

## 3. RPC 方法表（contract/api.ts 的 interface Api）

> 借鉴 pi-desktop `contract/api.ts`（~50 方法），pi-studybuddy 业务化扩展。方法名采用 `namespace.action` 风格。

### 3.1 会话管理（sessions.*，借鉴 pi-desktop）

> **对话 Tab 承载**（02-PRD §3.11 + 03-Architecture §6.7 + 09-UI §4.2）：sessions.* 是"💬 对话"标签页（默认主入口）的会话管理基础——应用启动即默认打开对话 Tab，左侧栏 SessionSidebar 选中会话，主内容区加载该会话；流式回复走 `Streams["agent.events"]`（见 §4），AI 自主调用 registerTool 工具的过程通过工具调用视图展示。**会话即对话 Tab 的内容**，是 pi 原生 AI 对话能力的承载层，不废弃、不降级。

| 方法 | 参数 | 返回 | 说明 |
|---|---|---|---|
| `sessions.list` | `{ limit?: number, cursor?: string }` | `SessionSummary[]` + meta | 按 dev+ino+birthtimeMs 哈希分页防陈旧 |
| `sessions.get` | `{ id: string }` | `Session` | 含上下文 |
| `sessions.context` | `{ id: string }` | `SessionContext` | 上下文压缩状态 |
| `sessions.rename` | `{ id: string, name: string }` | `Session` | 重命名 |
| `sessions.delete` | `{ id: string }` | `void` | 删除 |
| `sessions.export` | `{ id: string, format: 'md'\|'json' }` | `{ path: string }` | 导出 |
| `sessions.search` | `{ query: string }` | `SessionSummary[]` | 模糊搜索 |

### 3.2 文件体验（files.*，借鉴 pi-desktop）

| 方法 | 参数 | 返回 | 说明 |
|---|---|---|---|
| `files.selectDirectory` | `{}` | `{ path: string }` | dialog.showOpenDialog，记录 recentCwds（最多 12） |
| `files.list` | `{ dir: string }` | `FileEntry[]` | lazy 加载 |
| `files.read` | `{ path: string }` | `{ content: string, encoding: string }` | 受 allowed-roots 校验 |
| `files.previewMarkdown` | `{ path: string }` | `{ html: string }` | react-markdown + KaTeX + Mermaid |
| `files.previewDocx` | `{ path: string }` | `{ html: string }` | mammoth，DOCX_PREVIEW_MAX_BYTES 限制 |
| `files.watch` | `{ path: string }` | `subscribe` | fs.watch recursive，100ms 防抖→Streams["files.changed"] |
| `files.unwatch` | `{ path: string }` | `void` | 取消监听 |

### 3.3 S1 学习节奏

#### 学期管理（semesters.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `semesters.list` | `{ status?: string }` | `Semester[]` | 按状态过滤 |
| `semesters.create` | `{ label, startDate, endDate, timezone }` | `Semester` | 初始化学期库（db_relative_path） |
| `semesters.get` | `{ id }` | `Semester` | |
| `semesters.update` | `{ id, ...fields }` | `Semester` | |
| `semesters.transition` | `{ id, status }` | `Semester` | 状态机 active→teaching_ended→follow_up→archived；归档前后强制触发完整备份 |
| `semesters.archive` | `{ id }` | `Semester` | 归档，只读，留审计痕迹 |

#### 课程管理（courses.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `courses.list` | `{ semesterId }` | `CourseInstance[]` | |
| `courses.create` | `{ semesterId, courseName, subject, ... }` | `CourseInstance` | |
| `courses.get` | `{ id }` | `CourseInstance` | |
| `courses.update` | `{ id, ...fields }` | `CourseInstance` | |
| `courses.importSchedule` | `{ courseId, imageFile }` | `{ preview: SchedulePreview }` | OCR 识别预览，学生确认后原子化建条目 |

#### 考试管理（exams.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `exams.list` | `{ courseId?, confirmationStatus? }` | `AssessmentAttempt[]` | |
| `exams.add` | `{ courseId, examName, examType, scheduledDate, source, confidence? }` | `AssessmentAttempt` | confirmation_status=pending |
| `exams.confirm` | `{ id, confirmed: boolean }` | `AssessmentAttempt` | 写 confirmation_status/confirmed_at；未确认不驱动冲刺 |
| `exams.supersede` | `{ id, newAttemptId }` | `AssessmentAttempt` | superseded 状态 |

#### 课表（schedule.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `schedule.list` | `{ courseId }` | `ScheduleEntry[]` | |
| `schedule.create` | `{ courseId, weekday, startTime, endTime, location? }` | `ScheduleEntry` | CHECK end_time > start_time |
| `schedule.update` | `{ id, ...fields }` | `ScheduleEntry` | |
| `schedule.delete` | `{ id }` | `void` | 软删除 |

#### 任务与每日首页（tasks.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `tasks.list` | `{ courseId?, status?, dueBefore? }` | `StudyTask[]` | |
| `tasks.create` | `{ courseId, title, taskType, dueDate?, priority? }` | `StudyTask` | source_system |
| `tasks.complete` | `{ id }` | `StudyTask` | 写 StudyEvent（source_system='S1'） |
| `tasks.dailyBrief` | `{ semesterId }` | `DailyBrief` | 规则聚合（非 AI），少量待闭合项 |

#### 学习事件（events.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `events.list` | `{ semesterId?, courseId?, eventType?, since? }` | `StudyEvent[]` | 时间线 |
| `events.markReviewed` | `{ refType, refId }` | `StudyEvent` | TTS 朗读标记"已复习"→practice_reviewed 事件 |

### 3.4 S2 资料笔记

#### 资料管理（materials.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `materials.list` | `{ courseId?, status? }` | `Material[]` | |
| `materials.upload` | `{ courseId, file: FileMeta }` | `Material` | storage_key 相对路径；触发器拒绝 `..`/`:\`/`:/`；MIME 服务端验证 |
| `materials.get` | `{ id }` | `Material` | |
| `materials.convert` | `{ id }` | `Job` | 触发转换 Job（PDF/OCR/DOCX/PPTX 各有超时） |
| `materials.retryConversion` | `{ id }` | `Job` | 最多 3 次 |
| `materials.replaceText` | `{ id, text }` | `Material` | 手动粘贴纯文本跳过转换 |
| `materials.generateNote` | `{ id }` | `Job` | AI 笔记生成 Job |
| `materials.retryAiGeneration` | `{ id }` | `Job` | 最多 3 次 |
| `materials.delete` | `{ id }` | `void` | 软删除 |

#### 笔记（notes.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `notes.get` | `{ materialId }` | `StructuredNote` | 含 Markdown + highlights |
| `notes.update` | `{ materialId, noteMarkdown, highlights? }` | `StructuredNote` | 学生手动编辑 |
| `notes.getMindMap` | `{ materialId }` | `MindMap` | Markmap JSON |

#### 知识模块（modules.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `modules.list` | `{ courseId?, learnStatus? }` | `KnowledgeModule[]` | |
| `modules.get` | `{ id }` | `KnowledgeModule` | 含 source_evidence 回链 |
| `modules.updateLearnStatus` | `{ id, learnStatus }` | `KnowledgeModule` | 状态机 not_started→learning→mastered→needs_review |

#### 作业（jobs.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `jobs.get` | `{ id }` | `Job` | 状态机 |
| `jobs.list` | `{ materialId?, status? }` | `Job[]` | |

### 3.5 S3 限时练习

#### 练习会话（practice.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `practice.createSession` | `{ courseId, moduleIds, questionCount, timeLimit?, difficulty?, questionTypes? }` | `PracticeSession` | questionCount 5-20；题型分布 single 60%/multiple 20%/fill 20% |
| `practice.getQuestions` | `{ sessionId }` | `QuestionDTO[]` | **作答前 DTO 不含 correct_answer/acceptable_answers/explanation**（防泄露） |
| `practice.submit` | `{ sessionId, answers: Answer[] }` | `PracticeResult` | 触发规则批改（非 AI）；三策略 |
| `practice.getResult` | `{ sessionId }` | `PracticeResult` | 含逐题结果；is_correct=false 只读输出给 S4 |
| `practice.listSessions` | `{ courseId? }` | `PracticeSession[]` | |

**QuestionDTO（作答前）**：
```typescript
{
  id: string,
  questionType: 'single_choice' | 'multiple_choice' | 'fill_blank',
  questionStem: string,
  options?: string[],            // 选择题选项
  score: number
  // 不含：correct_answer / acceptable_answers / explanation
}
```

### 3.6 S4 错题改错

#### 错题（mistakes.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `mistakes.list` | `{ courseId?, status? }` | `Mistake[]` | |
| `mistakes.get` | `{ id }` | `Mistake` | 含错因、重做历史 |
| `mistakes.confirmErrorCause` | `{ id, category, causeNote? }` | `Mistake` | AI 只提建议带"不确定"标记，学生必须确认 |
| `mistakes.suggestErrorCause` | `{ id }` | `{ suggestion: string, confidence: 'low'\|'medium'\|'high' }` | AI 建议（带"不确定"标记） |
| `mistakes.redo` | `{ id }` | `RedoResult` | MVP 原题重做；正确增加掌握证据，错误保持 needs_review |
| `mistakes.archive` | `{ practiceAnswerId }` | `Mistake` | 幂等归档（UNIQUE question_id）；重复扫描不重复建 |

#### 薄弱点（weakPoints.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `weakPoints.list` | `{ courseId?, status? }` | `WeakPoint[]` | |
| `weakPoints.get` | `{ id }` | `WeakPoint` | 含 evidence_count |
| `weakPoints.resolve` | `{ id }` | `WeakPoint` | status=resolved（可回退） |
| `weakPoints.regress` | `{ id }` | `WeakPoint` | status=regressed（"已掌握"非终态） |

### 3.7 S5 期末冲刺

#### 模拟考（mockExams.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `mockExams.generatePaper` | `{ assessmentAttemptId, questionCount, timeLimit? }` | `MockExamPaper` | 触发器校验 assessment_attempt 必须 confirmed；source_hash 防重复 |
| `mockExams.getPaper` | `{ paperId }` | `MockExamPaper` | |
| `mockExams.startAttempt` | `{ paperId }` | `MockExamAttempt` | status=in_progress |
| `mockExams.submitAttempt` | `{ attemptId, answers }` | `MockExamResult` | 规则批改客观题；展示总分/正确率/耗时/模块分析 |
| `mockExams.getResult` | `{ attemptId }` | `MockExamResult` | |
| `mockExams.getModuleAnalyses` | `{ attemptId }` | `MockExamModuleAnalysis[]` | 强弱项分析 |

#### 临考速背（cramCards.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `cramCards.get` | `{ assessmentAttemptId }` | `CramCard[]` | **确定性只读 DTO**；不持久化、不依赖 AI、不暴露题干/答案/作答 |

**CramCard DTO**：
```typescript
{
  moduleId: string,
  moduleName: string,
  coreConcept: string,          // 核心概念
  keyPoints: string[],          // 必背要点
  mnemonic?: string,           // 记忆口诀
  commonExamPattern?: string,  // 常见考法
  easyMistake?: string,        // 易错提醒
  importance: number           // 1-5
}
```

#### 冲刺计划（cramPlan.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `cramPlan.get` | `{ assessmentAttemptId }` | `CramPlanDay[]` | **确定性即时只读 7 天 DTO**；不持久化、不替学生改写事实 |

**CramPlanDay DTO**：
```typescript
{
  date: string,
  dayOffset: number,            // 距考天数
  tasks: {
    reviewModules: string[],   // 复习模块
    redoMistakes: string[],    // 重做错题
    practiceCount: number,    // 建议练习题数
    notes: string              // 建议说明
  }
}
```

### 3.8 S6 家长报告

#### 报告（reports.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `reports.generate` | `{ semesterId, reportType, periodStart, periodEnd }` | `ParentReport` | 规则优先 + AI 仅润色；AI 失败保留规则报告 |
| `reports.freeze` | `{ reportKey }` | `ParentReport` | 冻结快照 content_json + content_hash；assertNoSensitiveLeak |
| `reports.get` | `{ reportKey }` | `ParentReport` | |
| `reports.list` | `{ semesterId?, reportType? }` | `ParentReport[]` | |

#### 投递（deliveries.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `deliveries.deliver` | `{ reportKey, channel }` | `ReportDelivery` | 按 report_key+channel 去重；渠道独立失败隔离 |
| `deliveries.retry` | `{ reportKey, channel }` | `ReportDelivery` | 最多重试 3 次；达上限 retained_locally |
| `deliveries.list` | `{ reportKey? }` | `ReportDelivery[]` | |

#### 报告目标（reportTargets.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `reportTargets.list` | `{ semesterId }` | `ParentReportTarget[]` | |
| `reportTargets.create` | `{ semesterId, targetName, channelType, channelConfig, credentialKey? }` | `ParentReportTarget` | 真实地址在 credential-vault |
| `reportTargets.update` | `{ id, ...fields }` | `ParentReportTarget` | |
| `reportTargets.delete` | `{ id }` | `void` | 软删除 |

### 3.9 S7 课堂采集

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `classCapture.transcribe` | `{ courseId, audioFile, permissionConfirmed }` | `{ transcription: string }` | 受控 PCM WAV（服务端重新验证文件头）；本机 whisper.cpp 同步转写；许可确认强制 |
| `classCapture.saveTranscription` | `{ courseId, transcription, title }` | `Material` | 创建 file_type='text' material，初始 converted |

### 3.10 TTS 朗读（跨子系统，02-PRD §3.9）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `tts.speak` | `{ text: string, engine?: 'sapi'\|'edge-tts' }` | `{ playbackId: string }` | 任意 Markdown/纯文本；SAPI 默认（离线） |
| `tts.control` | `{ playbackId, action: 'play'\|'pause'\|'stop', rate?: number }` | `void` | 播放/暂停/停止/语速调节 |
| `tts.switchEngine` | `{ engine: 'sapi'\|'edge-tts' }` | `void` | 切换引擎 |
| `tts.getStatus` | `{ playbackId }` | `{ state: 'playing'\|'paused'\|'stopped', position: number, duration: number }` | 朗读状态 |

### 3.11 备份恢复（02-PRD §3.10）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `backup.course` | `{ courseInstanceId, targetPath }` | `BackupRecord` | 单课程备份为 zip；写 backup_records |
| `backup.allCourses` | `{ semesterId, targetPath }` | `BackupRecord[]` | 全课程备份（归档前后强制） |
| `backup.restore` | `{ zipPath, targetSemesterId, conflictResolution?: 'overwrite'\|'create_new' }` | `RestoreResult` | content_hash 校验完整性；同名冲突学生确认 |
| `backup.list` | `{ semesterId?, courseInstanceId? }` | `BackupRecord[]` | 从 backup_records 读取 |
| `backup.configureSchedule` | `{ semesterId, courseInstanceId?, cronExpression, timezone }` | `BackupSchedule` | 配置定期调度（每周一/每月一） |
| `backup.listSchedules` | `{ semesterId }` | `BackupSchedule[]` | |
| `backup.toggleSchedule` | `{ id, enabled }` | `BackupSchedule` | 启用/禁用调度 |

**RestoreResult DTO**：
```typescript
{
  success: boolean,
  restoredCourseId: string,
  conflictResolved: 'overwrite' | 'create_new' | 'none',
  tablesImported: string[],
  filesRestored: number,
  integrityCheck: 'ok' | 'warning'
}
```

### 3.12 技能管理（skills.*，借鉴 pi-desktop）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `skills.list` | `{}` | `SkillManifest[]` | 目录扫描 + skills.manifest.json |
| `skills.search` | `{ query }` | `SkillManifest[]` | 模糊搜索 |
| `skills.install` | `{ source: 'github', hub, name }` | `SkillManifest` | content-source GitHub hub（03-Architecture §5.4） |
| `skills.getContent` | `{ name }` | `{ skillMd: string, helpers: string[] }` | SKILL.md 正文 + helper 脚本 |
| `skills.uninstall` | `{ name }` | `void` | |

### 3.13 模型配置（models.*，借鉴 pi-desktop）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `models.list` | `{}` | `ModelProvider[]` | 从 ~/.pi/agent/models.json |
| `modelsConfig.get` | `{}` | `ModelConfig` | 默认 provider/model |
| `modelsConfig.set` | `{ provider, model }` | `ModelConfig` | 持久化（__studybuddy_managed 标记） |
| `modelsConfig.test` | `{ provider, model, apiKey? }` | `{ ok: boolean, latencyMs: number, error? }` | 一键测试连通性 |
| `models.addProvider` | `{ providerConfig }` | `ModelProvider` | 添加自定义 provider |
| `models.probe` | `{ baseUrl, apiKey, providerType }` | `ModelInfo[]` | model-probe 探测模型列表（03-Architecture §2.4） |

### 3.14 设置（settings.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `settings.get` | `{}` | `AppSettings` | 含 simpleMode/backupSchedule 等 |
| `settings.update` | `{ ...fields }` | `AppSettings` | |
| `settings.getSimpleMode` | `{}` | `boolean` | Simple Mode 总开关（03-Architecture §2.5） |
| `settings.setSimpleMode` | `{ enabled }` | `void` | 切换 L2 知识库开关 |

### 3.15 密钥管理（credentials.*）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `credentials.set` | `{ key: string, value: string }` | `void` | DPAPI 加密；键名匹配 modelProvider:xxx/parentContact:xxx |
| `credentials.get` | `{ key: string }` | `{ value: string }` | DPAPI 解密 |
| `credentials.delete` | `{ key: string }` | `void` | |
| `credentials.listKeys` | `{ prefix?: string }` | `string[]` | 仅返回键名，不返回值 |

### 3.16 工具发现（toolchains.*，借鉴 pi-desktop）

| 方法 | 参数 | 返回 | 约束 |
|---|---|---|---|
| `toolchains.list` | `{}` | `ToolchainStatus[]` | 发现-探测结果（health: unsupported/unverified/healthy） |
| `toolchains.install` | `{ capabilityId }` | `ToolchainStatus` | 安装到 userData，不改系统 PATH |
| `toolchains.rescan` | `{}` | `ToolchainStatus[]` | 窗口 focus 时 60s TTL 重扫 |

---

## 4. Streams（服务端推送主题）

> 借鉴 pi-desktop `contract/api.ts` 的 `interface Streams`。renderer 通过 `subscribe(topic, key, on)` 订阅。

| Stream 主题 | 触发条件 | 推送数据 | 说明 |
|---|---|---|---|
| `agent.events` | pi agent 事件 | `AgentEvent` | 流式回复、工具调用视图、上下文压缩状态 |
| `files.changed` | file-watch 检测 | `{ path: string, changeType: 'add'\|'change'\|'unlink' }` | 100ms 防抖 |
| `jobs.progress` | Job 状态变更 | `Job` | 转换/生成进度 |
| `practice.timer` | 练习计时 | `{ sessionId, elapsedMs, remainingMs? }` | 前端计时，限时可超时标记 |
| `tts.state` | TTS 播放状态 | `{ playbackId, state, position, duration }` | 朗读状态由前端管理 |
| `backup.progress` | 备份进度 | `{ backupRecordId, phase, progress }` | 备份/恢复进度 |
| `delivery.status` | 投递状态变更 | `ReportDelivery` | 投递成功/失败/重试 |
| `toolchains.changed` | 工具发现变更 | `ToolchainStatus[]` | 窗口 focus 重扫后 |
| `schedule.reminder` | 调度提醒 | `{ taskType, message }` | 桌面通知 + 应用内消息中心 |

---

## 5. DTO 规范

### 5.1 防泄露原则（02-PRD §3.4）

**作答前 DTO 不含敏感字段**：
- `practice.getQuestions` 返回的 `QuestionDTO` **不含** `correct_answer` / `acceptable_answers` / `explanation`
- `mockExams.getPaper`（未提交时）同样不含
- 提交后 `getResult` 才返回完整信息

### 5.2 脱敏原则（02-PRD §5.2）

**家长报告 DTO 不含**：
- 资料原文、笔记正文
- 完整题干、完整答案、学生作答
- 错因正文（error_cause_note）
- 聊天内容
- 真实渠道地址（邮箱/Webhook URL）
- 完整 UUID

**UUID 泄漏检测**（`assertNoSensitiveLeak`）：
- 序列化整个 ParentReportResult
- UUID 正则 `/[0-9a-f]{8}-...-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i` 检测
- 发现任何完整 UUID → 抛 `PARENT_REPORT_PRIVACY_VIOLATION`(500)

### 5.3 分页规范

```typescript
{
  success: true,
  data: T[],
  meta: {
    total: number,
    page: number,
    pageSize: number,
    timestamp: string
  }
}
```

- 默认 pageSize=20，最大 100
- cursor 分页（session 列表用 dev+ino+birthtimeMs 哈希防陈旧）

### 5.4 时间戳规范

- 所有时间戳：ISO 8601 UTC（如 `2026-08-07T12:00:00Z`）
- 日期（无时间）：ISO 日期（如 `2026-08-07`）
- 时区： Asia/Shanghai（学生本地时区）

---

## 6. 路由分组与权限

### 6.1 方法命名空间

| 命名空间 | 子系统 | 说明 |
|---|---|---|
| `sessions.*` / `files.*` / `toolchains.*` | 桌面壳 | 借鉴 pi-desktop |
| `semesters.*` / `courses.*` / `exams.*` / `schedule.*` / `tasks.*` / `events.*` | S1 | 学习节奏 |
| `materials.*` / `notes.*` / `modules.*` / `jobs.*` | S2 | 资料笔记 |
| `practice.*` | S3 | 限时练习 |
| `mistakes.*` / `weakPoints.*` | S4 | 错题改错 |
| `mockExams.*` / `cramCards.*` / `cramPlan.*` | S5 | 期末冲刺 |
| `reports.*` / `deliveries.*` / `reportTargets.*` | S6 | 家长报告 |
| `classCapture.*` | S7 | 课堂采集 |
| `tts.*` | 横切 | TTS 朗读 |
| `backup.*` | 横切 | 备份恢复 |
| `skills.*` / `models.*` / `settings.*` / `credentials.*` | 系统 | 技能/模型/设置/密钥 |

### 6.2 权限模型

- **单用户单机**：学生拥有全部读写权限，无需 RBAC
- **家长不进系统**：家长无任何 API 端点；报告是"推"不是"拉"
- **workspace-path-guard**：write/edit 类操作受路径守卫拦截（03-Architecture §3.4）
- **credential-vault**：密钥读写经 DPAPI 加密

---

## 7. 版本历史

| 版本 | 日期 | 变更 |
|---|---|---|
| v0.1.1 | 2026-08-07 | §3.1 sessions 方法表补"对话 Tab 承载"注解——sessions.* 是"💬 对话"标签页（默认主入口）的会话管理基础，会话即对话 Tab 内容，承载 pi 原生 AI 对话能力（02-PRD §3.11 + 03-Architecture §6.7 + 09-UI §4.2 贯通） |
| v0.1.0 | 2026-08-07 | 初始草案：API 总览（RPC 架构非 REST）；API 信封（{success,data,error} + 5 错误码）；RPC 方法表（sessions/files/S1-S7/TTS/备份恢复/skills/models/settings/credentials/toolchains 共 100+ 方法）；Streams（9 个推送主题）；DTO 规范（防泄露/脱敏/分页/时间戳）；路由分组与权限。输入：03-Architecture §3/§6 + 02-PRD §5 + 05-ERD |
