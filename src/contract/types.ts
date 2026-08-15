/**
 * pi-studybuddy 共享类型（03-Arch §6.3 自研 RPC 层，五种 wire 消息）
 *
 * 本文件仅含类型与常量，无运行逻辑，可被 renderer（Vite/ESM）与
 * main/agent-host（tsc/CommonJS）双向引用，保持环境无关。
 *
 * 本文件同时承载 06-API 的共享 DTO 类型 + API 信封 + 错误码枚举
 * （06-API §2 信封 + §3 各方法 DTO + §5 DTO 规范）。
 */

/** 自研 MessagePort RPC 的五种 wire 消息（03-Arch §6.3） */
export type WireMessage =
  | { kind: "request"; id: string; method: string; args: unknown[] }
  | { kind: "response"; id: string; result?: unknown; error?: RpcError }
  | { kind: "subscribe"; id: string; topic: string; key?: string }
  | { kind: "unsubscribe"; id: string }
  | { kind: "event"; topic: string; key?: string; payload: unknown };

/** RPC 传输层错误（与 06-API §2.2 业务错误码对齐；UNKNOWN_METHOD 为传输层新增码） */
export interface RpcError {
  code: string;
  message: string;
}

/* ------------------------------------------------------------------ */
/* 06-API §2 统一信封 + 错误码                                         */
/* ------------------------------------------------------------------ */

/** 统一错误码（06-API §2.2：5 通用码 + 2 个业务特殊码） */
export type ErrorCode =
  | "NOT_FOUND"
  | "INVALID_JSON"
  | "FILE_TOO_LARGE"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR"
  | "PARENT_REPORT_PRIVACY_VIOLATION"
  | "MODEL_NOT_CONFIGURED";

/** 分页元信息（06-API §2.1 / §5.3） */
export interface Meta {
  total?: number;
  page?: number;
  pageSize?: number;
  timestamp: string; // ISO 8601 UTC
}

/** 成功信封（06-API §2.1） */
export interface Envelope<T> {
  success: true;
  data: T;
  meta?: Meta;
}

/** 失败信封（06-API §2.1） */
export interface ErrorEnvelope {
  success: false;
  error: { code: ErrorCode; message: string };
}

/* ------------------------------------------------------------------ */
/* 06-API §3 RPC 方法 DTO 类型                                         */
/* ------------------------------------------------------------------ */

/* ---- §3.1-§3.2 桌面壳：会话 / 文件 ---- */

export interface SessionSummary {
  id: string;
  name: string;
  updatedAt: string;
  preview?: string;
  /** 会话级学习场景元数据（09-UI §4.2：学科标签/学习目标/错题关联，T-M3-003） */
  subject?: string;
  goal?: string;
  mistakeIds?: string[];
  /** 未读消息计数（09-UI §3.3 SessionSidebar unread 徽标，T-M3-006；无后台事件源时仅展示） */
  unread?: number;
}

export interface Session extends SessionSummary {
  context: SessionContext;
}

export interface SessionContext {
  systemPrompt: string;
  messages: number;
  tokens: number;
  compressed: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  mtime?: string;
}

/* ---- §3.3 S1 学习节奏（值域对齐 05-ERD §2.1 + §3.1） ---- */

/** 学期状态机（05-ERD §2.1 CHECK，07-WF §2.2 四态） */
export type SemesterStatus = "active" | "teaching_ended" | "follow_up" | "archived";

export interface Semester {
  id: string;
  studentName: string;
  label: string;
  startDate: string;
  endDate: string;
  timezone: string;
  status: SemesterStatus;
  dbRelativePath: string;
  ready: number; // 0=未就绪 1=就绪（学期库已初始化）
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseInstance {
  id: string;
  semesterId: string;
  courseName: string;
  subject: string;
  teacher?: string;
  dailyMinutesTarget?: number;
  availableTimeJson?: string;
  targetScoreJson?: string;
  retakeOf?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulePreview {
  entries: Array<{
    weekday: number;
    startTime: string;
    endTime: string;
    courseName: string;
    location?: string;
  }>;
  confidence: number;
}

/** 考试类型（05-ERD §3.1.2 CHECK） */
export type AssessmentType = "midterm" | "final" | "makeup" | "retake" | "quiz";

/** 考试来源（05-ERD §3.1.2 source 列） */
export type AssessmentSource = "student_input" | "ocr_schedule" | "ai_extracted";

/** 考试确认状态（05-ERD §3.1.2 CHECK 四态，07-WF §2.2） */
export type ConfirmationStatus = "pending" | "confirmed" | "rejected" | "superseded";

export interface AssessmentAttempt {
  id: string;
  courseId: string;
  examName: string;
  examType: AssessmentType;
  scheduledDate: string;
  actualDate?: string;
  source: AssessmentSource;
  confidence?: number;
  confirmationStatus: ConfirmationStatus;
  confirmedAt?: string;
  confirmedBy?: string;
  changeHistoryJson?: string;
  retakeOf?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleEntry {
  id: string;
  courseId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  location?: string;
  weekPattern?: string;
  createdAt: string;
  updatedAt: string;
}

/** 学习任务类型（05-ERD §3.1.4 CHECK） */
export type StudyTaskType = "review" | "practice" | "note" | "exam_prep" | "other";

/** 学习任务状态（05-ERD §3.1.4 CHECK 四态） */
export type StudyTaskStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface StudyTask {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  taskType: StudyTaskType;
  status: StudyTaskStatus;
  dueDate?: string;
  priority: number; // 1-5（05-ERD §3.1.4 CHECK BETWEEN 1 AND 5，08-Test §3.2.5）
  sourceSystem: string; // S1-S7
  sourceRefId?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyBrief {
  date: string;
  tasks: StudyTask[];
  pendingItems: number;
}

/** 学习事件来源系统（05-ERD §3.1.5 CHECK S1-S7） */
export type EventSourceSystem = "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7";

export interface StudyEvent {
  id: string;
  semesterId: string; // 05-ERD §3.1.5 NOT NULL
  courseId?: string;
  eventType: string;
  sourceSystem: EventSourceSystem;
  sourceRefId?: string;
  eventDataJson?: string;
  occurredAt: string;
  createdAt: string;
}

/* ---- §3.4 S2 资料笔记 ---- */

export interface FileMeta {
  name: string;
  size: number;
  mime: string;
  /**
   * 文件系统绝对路径（S7 课堂采集读取 PCM WAV 头部用）。
   * S2 上传场景不把源路径交给 agent-host，而是使用 main 进程签发的一次性导入凭据。
   */
  path?: string;
  /** main 进程为 S2 文件导入签发的一次性 capability。 */
  importToken?: string;
}

/** Material.status（05-ERD §3.2.1 CHECK + §8.3 状态机） */
export type MaterialStatus =
  | "pending"
  | "converting"
  | "converted"
  | "note_generating"
  | "completed"
  | "conversion_failed"
  | "pending_quality_check";

/** Material.file_type（05-ERD §3.2.1 CHECK） */
export type MaterialFileType =
  | "pdf"
  | "docx"
  | "pptx"
  | "xlsx"
  | "txt"
  | "md"
  | "image"
  | "text"
  | "doc"
  | "ppt"
  | "xls";

export interface Material {
  id: string;
  courseId: string;
  fileName: string;
  fileType: MaterialFileType;
  fileSizeBytes: number;
  mimeType: string;
  storageKey: string;
  sourceType: "upload" | "class_audio_transcription";
  status: MaterialStatus;
  permissionConfirmed: number;
  uploadedAt: string;
  convertedAt?: string;
  noteGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface StructuredNote {
  id: string;
  materialId: string;
  courseId: string;
  noteMarkdown: string;
  highlights: Array<{ text: string; color?: string }>;
  promptVersion: string;
  model: string;
  tokenCount?: number;
  aiGenerated: number;
  createdAt: string;
  updatedAt: string;
}

export interface MindMap {
  id: string;
  materialId: string;
  courseId: string;
  markmapJson: string;
  createdAt: string;
}

export type LearnStatus = "not_started" | "learning" | "mastered" | "needs_review";

export interface KnowledgeModule {
  id: string;
  courseId: string;
  materialId: string;
  moduleName: string;
  summary?: string;
  importance?: number;
  difficulty?: number;
  learnStatus: LearnStatus;
  sourceEvidenceJson: string;
  aiGenerated: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** Job.status（05-ERD §3.2.7 CHECK + §8.4 状态机） */
export type JobStatus = "pending" | "running" | "completed" | "failed";

/** Job.job_type（05-ERD §3.2.7 CHECK） */
export type JobType =
  | "convert_pdf"
  | "convert_docx"
  | "convert_pptx"
  | "convert_xlsx"
  | "ocr_image"
  | "wps_convert"
  | "generate_note";

export interface Job {
  id: string;
  materialId: string;
  jobType: JobType;
  status: JobStatus;
  retryCount: number;
  maxRetries: number;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  timeoutMs?: number;
  createdAt: string;
  updatedAt: string;
}

/* ---- §3.5 S3 限时练习 ---- */

export type QuestionType = "single_choice" | "multiple_choice" | "fill_blank";

/** 作答前 DTO，防泄露（06-API §5.1）：不含 correct_answer/acceptable_answers/explanation */
export interface QuestionDTO {
  id: string;
  questionType: QuestionType;
  questionStem: string;
  options?: string[];
  score: number;
}

export interface Answer {
  questionId: string;
  /** 单选/填空为 string；多选为 string[]。统一用 unknown 由运行时校验 */
  value: unknown;
}

export interface PracticeSession {
  id: string;
  courseId: string;
  moduleIds: string[];
  questionCount: number;
  timeLimit?: number;
  difficulty?: number;
  questionTypes?: QuestionType[];
  status: "in_progress" | "submitted" | "graded";
  maxScore?: number;
  totalScore?: number;
  correctCount?: number;
  startedAt: string;
  submittedAt?: string;
  gradedAt?: string;
  createdAt: string;
}

export interface PracticeResult {
  sessionId: string;
  totalScore: number;
  maxScore: number;
  correctCount: number;
  elapsedMs: number;
  submittedAt?: string;
  gradedAt?: string;
  items: Array<{
    question: QuestionDTO;
    isCorrect: boolean;
    correctAnswer: unknown;
    explanation?: string;
    /** 该题的 practice_answer 行 ID（mistakes.archive 需要此 ID 归档错题） */
    practiceAnswerId?: string;
  }>;
}

/* ---- §3.6 S4 错题改错 ---- */

/**
 * 错因六分类（05-ERD §3.4.1 CHECK 约束）
 * concept_unclear 概念不清 / misread 看错题 / formula_error 公式错 / step_missing 步骤缺 / time_pressure 时间紧 / other 其他
 */
export type ErrorCategory =
  | "concept_unclear"
  | "misread"
  | "formula_error"
  | "step_missing"
  | "time_pressure"
  | "other";

/**
 * 错题（05-ERD §3.4.1 mistakes 表）
 *
 * status 状态机（07-WF §8.6）：needs_review ↔ mastered
 *   - needs_review：待复习
 *   - mastered：已掌握（重做正确）；非终态，再次答错回退 needs_review
 *
 * practiceAnswerId：DTO 便利字段（ERD 无此列；首条证据来源 practice_answer_id，
 *   可从 mistake_evidence 派生），可选
 */
export interface Mistake {
  id: string;
  questionId: string;
  courseId: string;
  knowledgeModuleId?: string;
  /** DTO 便利字段：首条证据来源 practice_answer_id（ERD 无此列，从 mistake_evidence 派生） */
  practiceAnswerId?: string;
  status: "needs_review" | "mastered";
  errorCategory?: ErrorCategory;
  /** 错因正文（学生确认，不进 S6 家长报告） */
  errorCause?: string;
  /** 'student' / undefined（未确认） */
  errorCauseConfirmedBy?: string;
  /** AI 建议（带"不确定"标记，仅作参考） */
  errorCauseAiSuggestion?: string;
  redoCount: number;
  /** 最近一次重做是否正确（0/1/undefined） */
  lastRedoCorrect?: number;
  /** 掌握时间（可回退到 needs_review，回退时清空） */
  masteredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 错题证据（05-ERD §3.4.2 mistake_evidence 表）
 *
 * evidence_type：
 *   - initial_wrong：首次错误归档
 *   - redo_wrong：重做再次错误
 */
export interface MistakeEvidence {
  id: string;
  mistakeId: string;
  sourcePracticeAnswerId: string;
  evidenceType: "initial_wrong" | "redo_wrong";
  recordedAt: string;
  createdAt: string;
}

/** mistakes.get 返回（含错因、重做历史证据、题目摘要；question 摘要 T-M5-004 方案 A 裁决） */
export interface MistakeWithEvidence extends Mistake {
  evidence: MistakeEvidence[];
  /** 题干摘要（mistakes.get 附带，S4 完整复盘；可选，向后兼容） */
  questionStem?: string;
  /** 题型（single_choice / multiple_choice / fill_blank） */
  questionType?: QuestionType;
  /** 最近一次作答的学生答案（JSON 解析后，脱敏由 renderer 处理） */
  studentAnswer?: unknown;
  /** 正确答案（S4 复盘阶段由 handler 返回；作答前不暴露的防线在 S3 保持） */
  correctAnswer?: unknown;
  /** 可接受答案列表 */
  acceptableAnswers?: string[];
  /** 题目解析 */
  explanation?: string;
}

/**
 * 重做结果（mistakes.redo 返回）
 *
 * - correct=true：重做正确 → evidence_count≥2 可能形成 weak_point
 * - correct=false：重做错误 → status 保持 needs_review
 */
export interface RedoResult {
  mistakeId: string;
  correct: boolean;
  /** 当前 mistake 累计证据数（含本次重做） */
  evidenceCount: number;
  /** 本次重做是否触发了薄弱点归纳（仅 correct=true 时可能为 true） */
  weakPointFormed: boolean;
  updatedAt: string;
}

/**
 * 薄弱点（05-ERD §3.4.3 weak_points 表）
 *
 * status 状态机（07-WF §8.7）：active → resolved → regressed
 *   - active：活跃薄弱点
 *   - resolved：已解决（可回退 regressed）
 *   - regressed：已回退（"已掌握"非终态）
 *
 * 形成条件：evidence_count≥2 + UNIQUE(course_instance_id, knowledge_module_id)
 */
export interface WeakPoint {
  id: string;
  courseId: string;
  moduleId: string;
  status: "active" | "resolved" | "regressed";
  evidenceCount: number;
  firstEvidencedAt: string;
  lastEvidencedAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---- §3.7 S5 期末冲刺 ---- */

/**
 * 模拟卷 DTO（05-ERD §3.5.1 mock_exam_papers + §3.5.2 mock_exam_questions 聚合视图）
 * questions 始终防泄露（QuestionDTO 不含 correct_answer/acceptable_answers/explanation），
 * 复盘用 mockExams.getResult 返回 MockExamResult（含 moduleAnalyses）。
 */
export interface MockExamPaper {
  id: string;
  courseInstanceId: string;
  assessmentAttemptId: string;
  paperTitle: string;
  questionCount: number;
  timeLimitMinutes?: number;
  totalScore: number;
  sourceHash: string;
  aiModel: string;
  promptVersion: string;
  generatedAt: string;
  createdAt: string;
  questions: QuestionDTO[];
}

/** 模拟考作答 DTO（05-ERD §3.5.3 mock_exam_attempts） */
export interface MockExamAttempt {
  id: string;
  paperId: string;
  courseInstanceId: string;
  status: "in_progress" | "submitted" | "graded";
  startedAt: string;
  submittedAt?: string;
  gradedAt?: string;
  totalScore?: number;
  maxScore?: number;
  correctCount?: number;
  durationMs?: number;
  createdAt: string;
}

/** 模拟考结果 DTO（06-API §3.7：展示总分/正确率/耗时/模块分析） */
export interface MockExamResult {
  attemptId: string;
  totalScore: number;
  maxScore: number;
  correctCount: number;
  correctRate: number;
  elapsedMs: number;
  moduleAnalyses: MockExamModuleAnalysis[];
}

/** 模拟考模块分析 DTO（05-ERD §3.5.5 mock_exam_module_analyses） */
export interface MockExamModuleAnalysis {
  moduleId: string;
  totalQuestions: number;
  correctCount: number;
  correctRate: number;
  strength: "strong" | "medium" | "weak";
}

/** 临考速背 DTO（确定性只读，06-API §3.7）：不暴露题干/答案/作答 */
export interface CramCard {
  moduleId: string;
  moduleName: string;
  coreConcept: string;
  keyPoints: string[];
  mnemonic?: string;
  commonExamPattern?: string;
  easyMistake?: string;
  importance: number; // 1-5
}

/** 冲刺计划 DTO（确定性即时只读 7 天，06-API §3.7） */
export interface CramPlanDay {
  date: string;
  dayOffset: number;
  tasks: {
    reviewModules: string[];
    redoMistakes: string[];
    practiceCount: number;
    notes: string;
  };
}

/* ---- §3.8 S6 家长报告（DTO 对齐 05-ERD §2.2/§3.6） ---- */

/** 报告类型（05-ERD §3.6.1 CHECK） */
export type ParentReportType = "daily" | "weekly" | "monthly" | "exam_reminder";

/** 投递渠道（05-ERD §2.2/§3.6.2 CHECK） */
export type ReportChannel = "local_export" | "smtp" | "feishu_webhook" | "print";

/** 投递状态（05-ERD §3.6.2 CHECK：delivered→sent 对齐 ERD） */
export type ReportDeliveryStatus = "pending" | "sent" | "failed" | "retained_locally";

/**
 * 家长报告 DTO（05-ERD §3.6.1 parent_reports 表）
 *
 * 冻结快照：content_json + content_hash（SHA-256），保证投递内容一致。
 * ruleGenerated/aiPolished/privacyCheckPassed 为 0/1 整数（对齐 ERD INTEGER 列）。
 */
export interface ParentReport {
  reportKey: string;
  semesterId: string;
  reportType: ParentReportType;
  periodStart: string;
  periodEnd: string;
  contentJson: unknown; // 冻结脱敏快照（6 section + data_quality）
  contentHash: string; // SHA-256
  ruleGenerated: number; // 0=AI 润色 1=规则生成（ERD 列 rule_generated）
  aiPolished: number; // 0/1（ERD 列 ai_polished）
  aiModel?: string;
  promptVersion?: string;
  privacyCheckPassed: number; // 0/1（ERD 列 privacy_check_passed，assertNoSensitiveLeak 结果）
  generatedAt: string;
  createdAt: string;
}

/**
 * 报告投递 DTO（05-ERD §3.6.2 report_deliveries 表）
 *
 * PK(report_key, channel)：按 report_key+channel 去重。
 * 至少一次投递语义；最多重试 maxRetries 次，达上限 retained_locally。
 */
export interface ReportDelivery {
  reportKey: string;
  channel: ReportChannel;
  status: ReportDeliveryStatus;
  retryCount: number;
  maxRetries: number;
  errorCode?: string;
  sentAt?: string;
  lastAttemptAt?: string;
  createdAt: string;
}

/**
 * 家长报告目标 DTO（05-ERD §2.2 parent_report_targets 表，全局库）
 *
 * 真实渠道地址（邮箱/Webhook URL）在 credential-vault，channelConfigJson 仅存别名。
 */
export interface ParentReportTarget {
  id: string;
  semesterId: string;
  targetName: string;
  channelType: ReportChannel;
  channelConfigJson: string; // 别名配置 JSON（真实地址在 credential-vault）
  credentialKey?: string; // credential-vault 键名（如 parentContact:mom_email）
  enabled: number; // 0/1
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/* ---- §3.9 S7 课堂采集 ---- */
/* （transcribe 返回 { transcription }，saveTranscription 返回 Material，无独立新 DTO） */

/* ---- §3.11 备份恢复（05-ERD §2.3/§2.4 对齐） ---- */

/** 备份类型（05-ERD §2.3 CHECK 约束） */
export type BackupType = "manual" | "scheduled" | "pre_archive" | "post_archive" | "semester";
/** 备份状态（05-ERD §2.3 CHECK 约束，状态机 in_progress→completed/failed） */
export type BackupStatus = "in_progress" | "completed" | "failed";

/**
 * 备份记录（05-ERD §2.3 backup_records 表）
 * 字段对齐 schema：14 字段 + 4 索引
 */
export interface BackupRecord {
  id: string;
  semesterId: string;
  courseInstanceId: string;
  backupType: BackupType;
  targetPath: string;
  zipFilename: string;
  contentHash: string;
  fileSizeBytes: number;
  status: BackupStatus;
  errorCode?: string;
  scheduleCron?: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
}

/**
 * 恢复结果（06-API §3.11）
 * schemaVersion 来自 manifest.json（05-ERD §8.1）
 */
export interface RestoreResult {
  success: boolean;
  restoredCourseId: string;
  conflictResolved: "overwrite" | "create_new" | "none";
  tablesImported: string[];
  filesRestored: number;
  integrityCheck: "ok" | "warning";
  schemaVersion?: string;
}

/**
 * 备份调度配置（05-ERD §2.4 backup_schedules 表）
 * 字段对齐 schema：10 字段 + 索引
 */
export interface BackupSchedule {
  id: string;
  semesterId: string;
  courseInstanceId?: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---- §3.10 TTS ---- */
export interface TtsSpeakResult {
  playbackId: string;
  engine: "sapi" | "edge-tts";
  fallbackUsed?: boolean;
}

export interface TtsStatus {
  state: "playing" | "paused" | "stopped";
  position: number;
  duration: number;
}

/* ---- §3.12 技能管理 ---- */

export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  source: "github" | "local";
  hub?: string;
}

/* ---- §3.13 模型配置 ---- */

export interface ModelProvider {
  id: string;
  name: string;
  providerType: string;
  baseUrl?: string;
  models: ModelInfo[];
}

export interface ModelInfo {
  id: string;
  name: string;
  /** 模型输入能力：text-only 或可接收 image。 */
  input?: Array<"text" | "image">;
  /** 能力分类：chat 可用于对话；image/video 是生成模型，不能伪装成聊天模型。 */
  modality?: "chat" | "image" | "video";
  contextWindow?: number;
}

export interface ModelConfig {
  provider: string;
  model: string;
  managed?: boolean;
}

/* ---- §3.14 设置 ---- */

export interface AppSettings {
  simpleMode: boolean;
  backupSchedule?: BackupSchedule;
  [key: string]: unknown;
}

/* ---- §3.16 工具发现 ---- */

export type ToolchainHealth = "unsupported" | "unverified" | "healthy";

export interface ToolchainStatus {
  capabilityId: string;
  name: string;
  health: ToolchainHealth;
  version?: string;
  path?: string;
}

/* ---- §4 Streams 推送主题 ---- */

/**
 * tool_call 事件脱敏载荷（T-M3-002，06-API §4 增补）
 *
 * 字段子集对齐 pi 底座 ExtensionAPI ToolCallEvent（types.d.ts:638-680）：
 * toolCallId/toolName 字段同名；input 仅保留脱敏摘要 inputSummary。
 *
 * 安全（AGENTS.md §9.3）：inputSummary 只含截断后展示文本（≤120 字符），
 * 不含完整输入/密钥/完整 UUID/文件路径；toolCallId 用短 id（call-<n>），非 UUID。
 */
export interface AgentEventToolCallPayload {
  toolCallId: string;
  toolName: string;
  inputSummary: string;
}

/**
 * tool_result 事件脱敏载荷（T-M3-002，06-API §4 增补）
 *
 * 字段子集对齐 pi 底座 ExtensionAPI ToolResultEvent（types.d.ts:681-721）：
 * toolCallId/toolName/isError 字段同名；content 仅保留脱敏摘要 resultSummary。
 *
 * 安全（AGENTS.md §9.3）：resultSummary 只含截断后展示文本（≤160 字符），
 * 不含完整输出/密钥/完整 UUID/文件路径。
 */
export interface AgentEventToolResultPayload {
  toolCallId: string;
  toolName: string;
  isError: boolean;
  resultSummary: string;
}

/**
 * AgentEvent.payload 结构化联合（T-M3-002 类型化）
 *
 * 按 kind 区分：
 *   - message_start       → {}（空对象）
 *   - token               → { text }
 *   - tool_call           → AgentEventToolCallPayload
 *   - tool_result         → AgentEventToolResultPayload
 *   - context_compressed  → { compressed: true }
 */
export type AgentEventPayload =
  | Record<string, never>
  | { text: string }
  | AgentEventToolCallPayload
  | AgentEventToolResultPayload
  | { compressed: boolean };

export interface AgentEvent {
  kind: "message_start" | "token" | "tool_call" | "tool_result" | "context_compressed";
  sessionId: string;
  payload: AgentEventPayload;
}

/* ------------------------------------------------------------------ */
/* PiBridge 对话框类型（06-API §1.3 + 桌面壳壳层）                      */
/* ------------------------------------------------------------------ */

export interface DialogOptions {
  type: "open" | "save" | "message";
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  message?: string;
  /**
   * S7 课堂采集：true 时 open 对话框返回本地文件原始绝对路径（rawPath），
   * whisper.cpp 直接读取该文件（FileMeta.path 注释见 §3.4）。
   * S2 上传场景不传此字段，仍走 main 签发的一次性导入 capability（importToken）。
   */
  rawPath?: boolean;
  /**
   * T-M4-019 备份：true 时 open 对话框以目录模式（openDirectory）返回本地目录路径（备份目标目录）。
   * 返回值复用 rawPath 字段；S2/S7 场景不传此字段。
   */
  directory?: boolean;
}

export interface DialogResult {
  canceled: boolean;
  filePath?: string;
  filePaths?: string[];
  /** S2 open-file 选择成功后由 main 进程返回的一次性导入 capability。 */
  importToken?: string;
  fileName?: string;
  fileSize?: number;
  /** S7 课堂采集（DialogOptions.rawPath）模式下 main 返回的本地文件绝对路径。 */
  rawPath?: string;
}