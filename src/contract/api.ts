/**
 * pi-studybuddy RPC 契约（interface Api，03-Arch §6.3 + 06-API §1-§3）
 *
 * 方法名采用 `namespace.action` 风格。本接口声明 06-API §3 全部方法的
 * `params` / `result` 类型契约；各方法 handler（业务逻辑）在 M1+ 业务任务实现。
 *
 * 权威依据：docs/06-API契约-API-Contracts.md §3 方法表。
 */
import type {
  AppSettings,
  AssessmentAttempt,
  BackupRecord,
  BackupSchedule,
  CourseInstance,
  CramCard,
  CramPlanDay,
  DailyBrief,
  ErrorCategory,
  FileEntry,
  FileMeta,
  Job,
  KnowledgeModule,
  Material,
  MindMap,
  Mistake,
  MistakeWithEvidence,
  MockExamAttempt,
  MockExamModuleAnalysis,
  MockExamPaper,
  MockExamResult,
  ModelConfig,
  ModelInfo,
  ModelProvider,
  ParentReport,
  ParentReportTarget,
  PracticeResult,
  PracticeSession,
  QuestionDTO,
  RedoResult,
  ReportDelivery,
  RestoreResult,
  ScheduleEntry,
  SchedulePreview,
  Semester,
  Session,
  SessionSummary,
  SessionContext,
  SkillManifest,
  StructuredNote,
  StudyEvent,
  StudyTask,
  ToolchainStatus,
  WeakPoint,
} from "./types";

export interface Api {
  /* ---- §3.1 会话管理（sessions.*，💬 对话 Tab 承载） ---- */
  "sessions.list": {
    params: { limit?: number; cursor?: string };
    result: SessionSummary[];
  };
  "sessions.get": { params: { id: string }; result: Session };
  "sessions.context": { params: { id: string }; result: SessionContext };
  "sessions.rename": { params: { id: string; name: string }; result: Session };
  "sessions.delete": { params: { id: string }; result: void };
  "sessions.export": {
    params: { id: string; format: "md" | "json" };
    result: { path: string };
  };
  "sessions.search": { params: { query: string }; result: SessionSummary[] };

  /* ---- §3.1.1 对话发送（agent.*，💬 对话 Tab 承载，T-M3-001） ---- */
  /** 发送用户消息 → agent-host 触发 Streams["agent.events"] 受控序列 */
  "agent.send": {
    params: { sessionId: string; text: string; sessionMeta?: { subject?: string; goal?: string; mistakeIds?: string[] } };
    result: { eventCount: number; fallbackUsed?: boolean; attempts?: number };
  };

  /* ---- §3.2 文件体验（files.*） ---- */
  "files.selectDirectory": { params: {}; result: { path: string } };
  "files.list": { params: { dir: string }; result: FileEntry[] };
  "files.read": { params: { path: string }; result: { content: string; encoding: string } };
  "files.previewMarkdown": { params: { path: string }; result: { html: string } };
  "files.previewDocx": { params: { path: string }; result: { html: string } };
  "files.watch": { params: { path: string }; result: undefined };
  "files.unwatch": { params: { path: string }; result: void };

  /* ---- §3.3 S1 学习节奏：学期 ---- */
  "semesters.list": { params: { status?: string }; result: Semester[] };
  "semesters.create": {
    params: { label: string; startDate: string; endDate: string; timezone: string };
    result: Semester;
  };
  "semesters.get": { params: { id: string }; result: Semester };
  "semesters.update": { params: { id: string; [k: string]: unknown }; result: Semester };
  "semesters.transition": { params: { id: string; status: string }; result: Semester };
  "semesters.archive": { params: { id: string }; result: Semester };

  /* ---- §3.3 S1：课程 ---- */
  "courses.list": { params: { semesterId: string }; result: CourseInstance[] };
  "courses.create": {
    params: { semesterId: string; courseName: string; subject: string; [k: string]: unknown };
    result: CourseInstance;
  };
  "courses.get": { params: { id: string }; result: CourseInstance };
  "courses.update": { params: { id: string; [k: string]: unknown }; result: CourseInstance };
  "courses.importSchedule": {
    params: { courseId: string; imageFile: FileMeta };
    result: { preview: SchedulePreview };
  };

  /* ---- §3.3 S1：考试 ---- */
  "exams.list": {
    params: { courseId?: string; confirmationStatus?: string };
    result: AssessmentAttempt[];
  };
  "exams.add": {
    params: {
      courseId: string;
      examName: string;
      examType: string;
      scheduledDate: string;
      source: "student_input" | "ocr_schedule" | "ai_extracted";
      confidence?: number;
    };
    result: AssessmentAttempt;
  };
  "exams.confirm": { params: { id: string; confirmed: boolean }; result: AssessmentAttempt };
  "exams.supersede": { params: { id: string; newAttemptId: string }; result: AssessmentAttempt };

  /* ---- §3.3 S1：课表 ---- */
  "schedule.list": { params: { courseId: string }; result: ScheduleEntry[] };
  "schedule.create": {
    params: {
      courseId: string;
      weekday: number;
      startTime: string;
      endTime: string;
      location?: string;
    };
    result: ScheduleEntry;
  };
  "schedule.update": { params: { id: string; [k: string]: unknown }; result: ScheduleEntry };
  "schedule.delete": { params: { id: string }; result: void };

  /* ---- §3.3 S1：任务与每日首页 ---- */
  "tasks.list": {
    params: { courseId?: string; status?: string; dueBefore?: string };
    result: StudyTask[];
  };
  "tasks.create": {
    params: {
      courseId: string;
      title: string;
      taskType: string;
      dueDate?: string;
      priority?: number;
    };
    result: StudyTask;
  };
  "tasks.complete": { params: { id: string }; result: StudyTask };
  "tasks.dailyBrief": { params: { semesterId: string }; result: DailyBrief };

  /* ---- §3.3 S1：学习事件 ---- */
  "events.list": {
    params: { semesterId?: string; courseId?: string; eventType?: string; since?: string };
    result: StudyEvent[];
  };
  "events.markReviewed": { params: { refType: string; refId: string }; result: StudyEvent };

  /* ---- §3.4 S2 资料笔记：资料 ---- */
  "materials.list": { params: { courseId?: string; status?: string }; result: Material[] };
  "materials.upload": {
    params: { courseId: string; file: FileMeta };
    result: Material;
  };
  "materials.get": { params: { id: string }; result: Material };
  "materials.convert": { params: { id: string }; result: Job };
  "materials.retryConversion": { params: { id: string }; result: Job };
  "materials.replaceText": { params: { id: string; text: string }; result: Material };
  "materials.generateNote": { params: { id: string }; result: Job };
  "materials.retryAiGeneration": { params: { id: string }; result: Job };
  "materials.delete": { params: { id: string }; result: void };

  /* ---- §3.4 S2：笔记 ---- */
  "notes.get": { params: { materialId: string }; result: StructuredNote };
  "notes.update": {
    params: { materialId: string; noteMarkdown: string; highlights?: unknown[] };
    result: StructuredNote;
  };
  "notes.getMindMap": { params: { materialId: string }; result: MindMap };

  /* ---- §3.4 S2：知识模块 ---- */
  "modules.list": { params: { courseId?: string; learnStatus?: string }; result: KnowledgeModule[] };
  "modules.create": {
    params: { courseId: string; materialId: string; moduleName: string; summary?: string; importance?: number; difficulty?: number };
    result: KnowledgeModule;
  };
  "modules.get": { params: { id: string }; result: KnowledgeModule };
  "modules.updateLearnStatus": { params: { id: string; learnStatus: string }; result: KnowledgeModule };

  /* ---- §3.4 S2：作业 ---- */
  "jobs.get": { params: { id: string }; result: Job };
  "jobs.list": { params: { materialId?: string; status?: string }; result: Job[] };

  /* ---- §3.5 S3 限时练习 ---- */
  "practice.createSession": {
    params: {
      courseId: string;
      moduleIds: string[];
      questionCount: number;
      timeLimit?: number;
      difficulty?: number;
      questionTypes?: string[];
    };
    result: PracticeSession;
  };
  "practice.getQuestions": { params: { sessionId: string }; result: QuestionDTO[] };
  "practice.submit": { params: { sessionId: string; answers: unknown[] }; result: PracticeResult };
  "practice.getResult": { params: { sessionId: string }; result: PracticeResult };
  "practice.listSessions": { params: { courseId?: string }; result: PracticeSession[] };

  /* ---- §3.6 S4 错题改错：错题 ---- */
  "mistakes.list": { params: { courseId?: string; status?: string }; result: Mistake[] };
  "mistakes.get": { params: { id: string }; result: MistakeWithEvidence };
  "mistakes.confirmErrorCause": {
    params: { id: string; category: ErrorCategory; causeNote?: string };
    result: Mistake;
  };
  "mistakes.suggestErrorCause": {
    params: { id: string };
    result: { suggestion: string; confidence: "low" | "medium" | "high" };
  };
  "mistakes.redo": { params: { id: string; correct?: boolean }; result: RedoResult };
  "mistakes.archive": { params: { practiceAnswerId: string }; result: Mistake };

  /* ---- §3.6 S4：薄弱点 ---- */
  "weakPoints.list": { params: { courseId?: string; status?: string }; result: WeakPoint[] };
  "weakPoints.get": { params: { id: string }; result: WeakPoint };
  "weakPoints.resolve": { params: { id: string }; result: WeakPoint };
  "weakPoints.regress": { params: { id: string }; result: WeakPoint };

  /* ---- §3.7 S5 期末冲刺：模拟考 ---- */
  "mockExams.generatePaper": {
    params: { assessmentAttemptId: string; questionCount: number; timeLimit?: number };
    result: MockExamPaper;
  };
  "mockExams.getPaper": { params: { paperId: string }; result: MockExamPaper };
  "mockExams.startAttempt": { params: { paperId: string }; result: MockExamAttempt };
  "mockExams.submitAttempt": { params: { attemptId: string; answers: unknown[] }; result: MockExamResult };
  "mockExams.getResult": { params: { attemptId: string }; result: MockExamResult };
  "mockExams.getModuleAnalyses": {
    params: { attemptId: string };
    result: MockExamModuleAnalysis[];
  };

  /* ---- §3.7 S5：临考速背 / 冲刺计划 ---- */
  "cramCards.get": { params: { assessmentAttemptId: string }; result: CramCard[] };
  "cramPlan.get": { params: { assessmentAttemptId: string }; result: CramPlanDay[] };

  /* ---- §3.8 S6 家长报告：报告 ---- */
  "reports.generate": {
    params: {
      semesterId: string;
      reportType: ParentReport["reportType"];
      periodStart: string;
      periodEnd: string;
    };
    result: ParentReport;
  };
  "reports.freeze": { params: { reportKey: string }; result: ParentReport };
  "reports.get": { params: { reportKey: string }; result: ParentReport };
  "reports.list": {
    params: { semesterId?: string; reportType?: ParentReport["reportType"] };
    result: ParentReport[];
  };

  /* ---- §3.8 S6：投递 ---- */
  "deliveries.deliver": {
    params: { reportKey: string; channel: ReportDelivery["channel"] };
    result: ReportDelivery;
  };
  "deliveries.retry": {
    params: { reportKey: string; channel: ReportDelivery["channel"] };
    result: ReportDelivery;
  };
  "deliveries.list": { params: { reportKey?: string }; result: ReportDelivery[] };

  /* ---- §3.8 S6：报告目标 ---- */
  "reportTargets.list": { params: { semesterId: string }; result: ParentReportTarget[] };
  "reportTargets.create": {
    params: {
      semesterId: string;
      targetName: string;
      channelType: ParentReportTarget["channelType"];
      channelConfigJson: string;
      credentialKey?: string;
    };
    result: ParentReportTarget;
  };
  "reportTargets.update": { params: { id: string; [k: string]: unknown }; result: ParentReportTarget };
  "reportTargets.delete": { params: { id: string }; result: void };

  /* ---- §3.9 S7 课堂采集 ---- */
  "classCapture.transcribe": {
    params: { courseId: string; audioFile: FileMeta; permissionConfirmed: boolean };
    result: { transcription: string };
  };
  "classCapture.saveTranscription": {
    params: { courseId: string; transcription: string; title: string };
    result: Material;
  };

  /* ---- §3.10 TTS 朗读 ---- */
  "tts.speak": {
    params: { text: string; engine?: "sapi" | "edge-tts" };
    result: { playbackId: string; engine: "sapi" | "edge-tts"; fallbackUsed?: boolean };
  };
  "tts.control": {
    params: { playbackId: string; action: "play" | "pause" | "stop"; rate?: number };
    result: void;
  };
  "tts.switchEngine": { params: { engine: "sapi" | "edge-tts" }; result: void };
  "tts.getStatus": {
    params: { playbackId: string };
    result: { state: "playing" | "paused" | "stopped"; position: number; duration: number };
  };

  /* ---- §3.11 备份恢复 ---- */
  "backup.course": {
    params: { courseInstanceId: string; targetPath: string };
    result: BackupRecord;
  };
  "backup.allCourses": {
    params: { semesterId: string; targetPath: string };
    result: BackupRecord;
  };
  "backup.restore": {
    params: { zipPath: string; targetSemesterId: string; conflictResolution?: "overwrite" | "create_new" };
    result: RestoreResult;
  };
  "backup.list": {
    params: { semesterId?: string; courseInstanceId?: string };
    result: BackupRecord[];
  };
  "backup.configureSchedule": {
    params: { semesterId: string; courseInstanceId?: string; cronExpression: string; timezone: string };
    result: BackupSchedule;
  };
  "backup.listSchedules": { params: { semesterId: string }; result: BackupSchedule[] };
  "backup.toggleSchedule": { params: { id: string; enabled: boolean }; result: BackupSchedule };

  /* ---- §3.12 技能管理 ---- */
  "skills.list": { params: {}; result: SkillManifest[] };
  "skills.search": { params: { query: string }; result: SkillManifest[] };
  "skills.install": {
    params: { source: "github"; hub: string; name: string };
    result: SkillManifest;
  };
  "skills.getContent": { params: { name: string }; result: { skillMd: string; helpers: string[] } };
  "skills.uninstall": { params: { name: string }; result: void };

  /* ---- §3.13 模型配置 ---- */
  "models.list": { params: {}; result: ModelProvider[] };
  "models.addProvider": { params: { providerConfig: Omit<ModelProvider, "models"> }; result: ModelProvider };
  "models.probe": {
    params: { provider: string };
    result: ModelInfo[];
  };
  "modelsConfig.get": { params: {}; result: ModelConfig };
  "modelsConfig.set": { params: { provider: string; model: string; fallbacks?: Array<{ provider: string; model: string; label?: string }> }; result: ModelConfig };
  "modelsConfig.test": {
    params: { provider: string; model: string; apiKey?: string };
    result: { ok: boolean; latencyMs: number; error?: string };
  };

  /* ---- §3.14 设置 ---- */
  "settings.get": { params: {}; result: AppSettings };
  "settings.update": { params: { [k: string]: unknown }; result: AppSettings };
  "settings.getSimpleMode": { params: {}; result: boolean };
  "settings.setSimpleMode": { params: { enabled: boolean }; result: void };

  /* ---- §3.15 密钥管理 ---- */
  "credentials.set": { params: { key: string; value: string }; result: void };
  "credentials.get": { params: { key: string }; result: { value: string } };
  "credentials.delete": { params: { key: string }; result: void };
  "credentials.listKeys": { params: { prefix?: string }; result: string[] };

  /* ---- §3.16 工具发现 ---- */
  "toolchains.list": { params: {}; result: ToolchainStatus[] };
  "toolchains.install": { params: { capabilityId: string }; result: ToolchainStatus };
  "toolchains.rescan": { params: {}; result: ToolchainStatus[] };

  /* ---- T-M0-001 心跳占位（验证 RPC 通道往返） ---- */
  "system.ping": {
    params: { message?: string };
    result: { pong: string; timestamp: number };
  };
}