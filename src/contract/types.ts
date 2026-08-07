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

/** 统一错误码（06-API §2.2：5 通用码 + PARENT_REPORT_PRIVACY_VIOLATION 特殊码） */
export type ErrorCode =
  | "NOT_FOUND"
  | "INVALID_JSON"
  | "FILE_TOO_LARGE"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR"
  | "PARENT_REPORT_PRIVACY_VIOLATION";

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

/* ---- §3.3 S1 学习节奏 ---- */

export interface Semester {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  timezone: string;
  status: "planning" | "active" | "teaching_ended" | "follow_up" | "archived";
  dbRelativePath: string;
}

export interface CourseInstance {
  id: string;
  semesterId: string;
  courseName: string;
  subject: string;
  teacher?: string;
  /** 课程目录缓存路径（OCR/资料归属） */
  courseDirPath?: string;
  createdAt: string;
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

export type AssessmentType = "midterm" | "final" | "quiz" | "mock";

export interface AssessmentAttempt {
  id: string;
  courseId: string;
  examName: string;
  examType: AssessmentType;
  scheduledDate: string;
  source: "manual" | "ocr" | "schedule";
  confidence?: number;
  confirmationStatus: "pending" | "confirmed" | "superseded";
  confirmedAt?: string;
  newAttemptId?: string;
}

export interface ScheduleEntry {
  id: string;
  courseId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  location?: string;
}

export type StudyTaskType =
  | "homework"
  | "review"
  | "practice"
  | "reading"
  | "assignment";

export interface StudyTask {
  id: string;
  courseId: string;
  title: string;
  taskType: StudyTaskType;
  status: "pending" | "done";
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  sourceSystem: string;
}

export interface DailyBrief {
  date: string;
  tasks: StudyTask[];
  pendingItems: number;
}

export interface StudyEvent {
  id: string;
  semesterId?: string;
  courseId?: string;
  eventType: string;
  occurredAt: string;
  /** 已复习标记（TTS 朗读 → practice_reviewed） */
  reviewedAt?: string;
  refType?: string;
  refId?: string;
}

/* ---- §3.4 S2 资料笔记 ---- */

export interface FileMeta {
  name: string;
  size: number;
  mime: string;
}

export interface Material {
  id: string;
  courseId: string;
  fileType: "text" | "pdf" | "docx" | "pptx" | "image" | "audio";
  status: "pending" | "converted" | "failed";
  storageKey: string;
  title: string;
  createdAt: string;
}

export interface StructuredNote {
  materialId: string;
  noteMarkdown: string;
  highlights: Array<{ text: string; color?: string }>;
}

export interface MindMap {
  root: MindMapNode;
}

export interface MindMapNode {
  label: string;
  children?: MindMapNode[];
}

export type LearnStatus = "not_started" | "learning" | "mastered" | "needs_review";

export interface KnowledgeModule {
  id: string;
  courseId: string;
  title: string;
  learnStatus: LearnStatus;
  sourceEvidence: string[];
}

export type JobStatus = "queued" | "running" | "done" | "failed";
export type JobType = "convert" | "generate_note" | "transcribe";

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  attempts: number;
  error?: string;
  createdAt: string;
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
  status: "in_progress" | "submitted" | "expired";
  createdAt: string;
}

export interface PracticeResult {
  sessionId: string;
  totalScore: number;
  correctCount: number;
  elapsedMs: number;
  items: Array<{
    question: QuestionDTO;
    isCorrect: boolean;
    correctAnswer: unknown;
    explanation?: string;
  }>;
}

/* ---- §3.6 S4 错题改错 ---- */

export type ErrorCategory =
  | "knowledge_gap"
  | "careless"
  | "method"
  | "timing"
  | "unknown";

export interface Mistake {
  id: string;
  practiceAnswerId: string;
  questionId: string;
  courseId?: string;
  status: "needs_review" | "mastered" | "archived";
  errorCategory?: ErrorCategory;
  causeNote?: string;
  redoCount: number;
  createdAt: string;
}

export interface RedoResult {
  mistakeId: string;
  correct: boolean;
  updatedAt: string;
}

export interface WeakPoint {
  id: string;
  courseId?: string;
  moduleId: string;
  status: "active" | "resolved" | "regressed";
  evidenceCount: number;
  createdAt: string;
}

/* ---- §3.7 S5 期末冲刺 ---- */

export interface MockExamPaper {
  id: string;
  assessmentAttemptId: string;
  sourceHash: string;
  questions: QuestionDTO[];
  timeLimit?: number;
  createdAt: string;
}

export interface MockExamAttempt {
  id: string;
  paperId: string;
  status: "in_progress" | "submitted";
  startedAt: string;
}

export interface MockExamResult {
  attemptId: string;
  totalScore: number;
  correctRate: number;
  elapsedMs: number;
  moduleAnalyses: MockExamModuleAnalysis[];
}

export interface MockExamModuleAnalysis {
  moduleId: string;
  correctRate: number;
  strength: "strong" | "weak";
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

/* ---- §3.8 S6 家长报告 ---- */

export interface ParentReport {
  reportKey: string;
  semesterId: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  contentJson: unknown;
  contentHash: string;
  frozenAt?: string;
  createdAt: string;
}

export interface ReportDelivery {
  id: string;
  reportKey: string;
  channel: string;
  status: "pending" | "delivered" | "failed" | "retained_locally";
  attempts: number;
  lastError?: string;
  deliveredAt?: string;
}

export interface ParentReportTarget {
  id: string;
  semesterId: string;
  targetName: string;
  channelType: string;
  channelConfig: Record<string, unknown>;
  credentialKey?: string;
}

/* ---- §3.9 S7 课堂采集 ---- */
/* （transcribe 返回 { transcription }，saveTranscription 返回 Material，无独立新 DTO） */

/* ---- §3.11 备份恢复 ---- */

export interface BackupRecord {
  id: string;
  courseInstanceId: string;
  semesterId?: string;
  targetPath: string;
  createdAt: string;
  sizeBytes: number;
}

export interface RestoreResult {
  success: boolean;
  restoredCourseId: string;
  conflictResolved: "overwrite" | "create_new" | "none";
  tablesImported: string[];
  filesRestored: number;
  integrityCheck: "ok" | "warning";
}

export interface BackupSchedule {
  id: string;
  semesterId: string;
  courseInstanceId?: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
}

/* ---- §3.10 TTS ---- */
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

export interface AgentEvent {
  kind: "message_start" | "token" | "tool_call" | "tool_result" | "context_compressed";
  sessionId: string;
  payload: unknown;
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
}

export interface DialogResult {
  canceled: boolean;
  filePath?: string;
  filePaths?: string[];
}