import { describe, it, expectTypeOf } from "vitest";
import type { Api } from "../../src/contract/api";
import type { Streams } from "../../src/contract/streams";
import type {
  ErrorCode,
  Envelope,
  ErrorEnvelope,
  QuestionDTO,
  RestoreResult,
  CramCard,
  CramPlanDay,
} from "../../src/contract/types";
import type { PiBridge } from "../../src/contract/desktop";

/**
 * T-M0-002 类型契约测试（03-Arch §6.2-§6.3 + 06-API §1-§5）
 *
 * 用 expectTypeOf 断言契约面与权威条款对齐：
 *   - Api 接口方法全集（06-API §3 各命名空间方法表）
 *   - Streams 九主题（06-API §4）
 *   - ErrorCode 六码（06-API §2.2 五通用码 + PARENT_REPORT_PRIVACY_VIOLATION）
 *   - Envelope/ErrorEnvelope 信封结构（06-API §2.1）
 *   - 防泄露 DTO QuestionDTO（06-API §5.1）
 *   - 关键 DTO 结构（RestoreResult/CramCard/CramPlanDay，06-API §3）
 *   - PiBridge 桥面（06-API §1.3）
 *
 * TDD：先写本测试（RED），再实现 contract 类型（GREEN）。
 */

/** 类型级断言：A 必须包含 Keys 中全部方法（任一缺失即非 true）。元组字面量在调用点为具体类型 */
type HasAllKeys<A, Keys extends readonly string[]> = Keys[number] extends Extract<
  keyof A,
  Keys[number]
>
  ? true
  : false;

describe("interface Api 方法全集（06-API §3）", () => {
  it("sessions.* 七方法（§3.1）", () => {
    expectTypeOf<
      HasAllKeys<
        Api,
        [
          "sessions.list",
          "sessions.get",
          "sessions.context",
          "sessions.rename",
          "sessions.delete",
          "sessions.export",
          "sessions.search",
        ]
      >
    >().toEqualTypeOf<true>();
  });

  it("files.* 七方法（§3.2）", () => {
    expectTypeOf<
      HasAllKeys<
        Api,
        [
          "files.selectDirectory",
          "files.list",
          "files.read",
          "files.previewMarkdown",
          "files.previewDocx",
          "files.watch",
          "files.unwatch",
        ]
      >
    >().toEqualTypeOf<true>();
  });

  it("S1 semesters/courses/exams/schedule/tasks/events（§3.3）", () => {
    expectTypeOf<
      HasAllKeys<
        Api,
        [
          "semesters.list",
          "semesters.create",
          "semesters.get",
          "semesters.update",
          "semesters.transition",
          "semesters.archive",
          "courses.list",
          "courses.create",
          "courses.get",
          "courses.update",
          "courses.importSchedule",
          "exams.list",
          "exams.add",
          "exams.confirm",
          "exams.supersede",
          "schedule.list",
          "schedule.create",
          "schedule.update",
          "schedule.delete",
          "tasks.list",
          "tasks.create",
          "tasks.complete",
          "tasks.dailyBrief",
          "events.list",
          "events.markReviewed",
        ]
      >
    >().toEqualTypeOf<true>();
  });

  it("S2 materials/notes/modules/jobs（§3.4）", () => {
    expectTypeOf<
      HasAllKeys<
        Api,
        [
          "materials.list",
          "materials.upload",
          "materials.get",
          "materials.convert",
          "materials.retryConversion",
          "materials.replaceText",
          "materials.generateNote",
          "materials.retryAiGeneration",
          "materials.delete",
          "notes.get",
          "notes.update",
          "notes.getMindMap",
          "modules.list",
          "modules.get",
          "modules.updateLearnStatus",
          "jobs.get",
          "jobs.list",
        ]
      >
    >().toEqualTypeOf<true>();
  });

  it("S3 practice.* 五方法（§3.5）", () => {
    expectTypeOf<
      HasAllKeys<
        Api,
        [
          "practice.createSession",
          "practice.getQuestions",
          "practice.submit",
          "practice.getResult",
          "practice.listSessions",
        ]
      >
    >().toEqualTypeOf<true>();
  });

  it("S4 mistakes/weakPoints（§3.6）", () => {
    expectTypeOf<
      HasAllKeys<
        Api,
        [
          "mistakes.list",
          "mistakes.get",
          "mistakes.confirmErrorCause",
          "mistakes.suggestErrorCause",
          "mistakes.redo",
          "mistakes.archive",
          "weakPoints.list",
          "weakPoints.get",
          "weakPoints.resolve",
          "weakPoints.regress",
        ]
      >
    >().toEqualTypeOf<true>();
  });

  it("S5 mockExams/cramCards/cramPlan（§3.7）", () => {
    expectTypeOf<
      HasAllKeys<
        Api,
        [
          "mockExams.generatePaper",
          "mockExams.getPaper",
          "mockExams.startAttempt",
          "mockExams.submitAttempt",
          "mockExams.getResult",
          "mockExams.getModuleAnalyses",
          "cramCards.get",
          "cramPlan.get",
        ]
      >
    >().toEqualTypeOf<true>();
  });

  it("S6 reports/deliveries/reportTargets（§3.8）", () => {
    expectTypeOf<
      HasAllKeys<
        Api,
        [
          "reports.generate",
          "reports.freeze",
          "reports.get",
          "reports.list",
          "deliveries.deliver",
          "deliveries.retry",
          "deliveries.list",
          "reportTargets.list",
          "reportTargets.create",
          "reportTargets.update",
          "reportTargets.delete",
        ]
      >
    >().toEqualTypeOf<true>();
  });

  it("S7 classCapture.* 两方法（§3.9）", () => {
    expectTypeOf<
      HasAllKeys<Api, ["classCapture.transcribe", "classCapture.saveTranscription"]>
    >().toEqualTypeOf<true>();
  });

  it("tts.* 四方法（§3.10）", () => {
    expectTypeOf<
      HasAllKeys<Api, ["tts.speak", "tts.control", "tts.switchEngine", "tts.getStatus"]>
    >().toEqualTypeOf<true>();
  });

  it("backup.* 七方法（§3.11）", () => {
    expectTypeOf<
      HasAllKeys<
        Api,
        [
          "backup.course",
          "backup.allCourses",
          "backup.restore",
          "backup.list",
          "backup.configureSchedule",
          "backup.listSchedules",
          "backup.toggleSchedule",
        ]
      >
    >().toEqualTypeOf<true>();
  });

  it("skills.* 五方法（§3.12）", () => {
    expectTypeOf<
      HasAllKeys<
        Api,
        [
          "skills.list",
          "skills.search",
          "skills.install",
          "skills.getContent",
          "skills.uninstall",
        ]
      >
    >().toEqualTypeOf<true>();
  });

  it("models/modelsConfig（§3.13）", () => {
    expectTypeOf<
      HasAllKeys<
        Api,
        [
          "models.list",
          "models.addProvider",
          "models.probe",
          "modelsConfig.get",
          "modelsConfig.set",
          "modelsConfig.test",
        ]
      >
    >().toEqualTypeOf<true>();
  });

  it("settings.* 四方法（§3.14）", () => {
    expectTypeOf<
      HasAllKeys<Api, ["settings.get", "settings.update", "settings.getSimpleMode", "settings.setSimpleMode"]>
    >().toEqualTypeOf<true>();
  });

  it("credentials.* 四方法（§3.15）", () => {
    expectTypeOf<
      HasAllKeys<Api, ["credentials.set", "credentials.get", "credentials.delete", "credentials.listKeys"]>
    >().toEqualTypeOf<true>();
  });

  it("toolchains.* 三方法（§3.16）+ system.ping", () => {
    expectTypeOf<
      HasAllKeys<
        Api,
        ["toolchains.list", "toolchains.install", "toolchains.rescan", "system.ping"]
      >
    >().toEqualTypeOf<true>();
  });
});

describe("Streams 九主题（06-API §4）", () => {
  it("Streams 接口含九个推送主题", () => {
    type StreamKeys = keyof Streams;
    expectTypeOf<StreamKeys>().toEqualTypeOf<
      | "agent.events"
      | "files.changed"
      | "jobs.progress"
      | "practice.timer"
      | "tts.state"
      | "backup.progress"
      | "delivery.status"
      | "toolchains.changed"
      | "schedule.reminder"
    >();
  });
});

describe("错误码与信封（06-API §2.1-§2.2）", () => {
  it("ErrorCode 含 5 通用码 + MODEL_NOT_CONFIGURED + PARENT_REPORT_PRIVACY_VIOLATION", () => {
    expectTypeOf<ErrorCode>().toEqualTypeOf<
      | "NOT_FOUND"
      | "INVALID_JSON"
      | "FILE_TOO_LARGE"
      | "BAD_REQUEST"
      | "INTERNAL_ERROR"
      | "MODEL_NOT_CONFIGURED"
      | "PARENT_REPORT_PRIVACY_VIOLATION"
    >();
  });

  it("Envelope 成功结构 { success:true, data:T, meta? }", () => {
    expectTypeOf<Envelope<string>>().toEqualTypeOf<{
      success: true;
      data: string;
      meta?: { total?: number; page?: number; pageSize?: number; timestamp: string };
    }>();
  });

  it("ErrorEnvelope 失败结构 { success:false, error }", () => {
    expectTypeOf<ErrorEnvelope>().toEqualTypeOf<{
      success: false;
      error: { code: ErrorCode; message: string };
    }>();
  });
});

describe("防泄露与关键 DTO（06-API §5.1 + §3）", () => {
  it("QuestionDTO 作答前不含 correct_answer/acceptable_answers/explanation", () => {
    expectTypeOf<QuestionDTO>().toEqualTypeOf<{
      id: string;
      questionType: "single_choice" | "multiple_choice" | "fill_blank";
      questionStem: string;
      options?: string[];
      score: number;
    }>();
  });

  it("RestoreResult 结构与 §3.11 对齐（含 schemaVersion，05-ERD §8.1 manifest）", () => {
    expectTypeOf<RestoreResult>().toEqualTypeOf<{
      success: boolean;
      restoredCourseId: string;
      conflictResolved: "overwrite" | "create_new" | "none";
      tablesImported: string[];
      filesRestored: number;
      integrityCheck: "ok" | "warning";
      schemaVersion?: string;
    }>();
  });

  it("CramCard 结构与 §3.7 对齐（确定性只读 DTO）", () => {
    expectTypeOf<CramCard>().toEqualTypeOf<{
      moduleId: string;
      moduleName: string;
      coreConcept: string;
      keyPoints: string[];
      mnemonic?: string;
      commonExamPattern?: string;
      easyMistake?: string;
      importance: number;
    }>();
  });

  it("CramPlanDay 结构与 §3.7 对齐", () => {
    expectTypeOf<CramPlanDay>().toEqualTypeOf<{
      date: string;
      dayOffset: number;
      tasks: {
        reviewModules: string[];
        redoMistakes: string[];
        practiceCount: number;
        notes: string;
      };
    }>();
  });
});

describe("PiBridge 桥面（06-API §1.3）", () => {
  it("含 connectHost + 新增桥面方法", () => {
    type BridgeKeys = keyof PiBridge;
    expectTypeOf<BridgeKeys>().toExtend<
      | "connectHost"
      | "selectDirectory"
      | "showDialog"
      | "queryToolchains"
      | "getWindowState"
      | "minimizeWindow"
      | "maximizeWindow"
      | "closeWindow"
    >();
  });
});