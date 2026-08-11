/**
 * T-M4-015 RED：S5 host 侧 archived 写保护（对齐 S3 assertSemesterWritable 模式）。
 * 归档学期：generatePaper / startAttempt / submitAttempt 必须被 host 直接 RPC 拒绝；
 * cramCards.get / cramPlan.get 只读 DTO 在归档学期仍可读。
 * @vitest-environment node
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import { S5Context, createS5Handlers } from "../../src/agent-host/handlers/s5";
import { createGlobalDb } from "../../src/data/global";
import type { RpcError } from "../../src/contract/types";

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M4-015\\host-boundaries";

function isRpcError(error: unknown): error is RpcError {
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

function expectBadRequest(action: () => unknown): void {
  try {
    action();
    expect.fail("应抛出 BAD_REQUEST");
  } catch (error) {
    expect(isRpcError(error)).toBe(true);
    expect((error as RpcError).code).toBe("BAD_REQUEST");
  }
}

describe("T-M4-015 S5 host archived write boundaries", () => {
  let s1: S1Context;
  let s5: S5Context;
  let s1Handlers: ReturnType<typeof createS1Handlers>;
  let handlers: ReturnType<typeof createS5Handlers>;
  let semesterId: string;
  let courseId: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    s1 = new S1Context(ISOLATION_DIR);
    s5 = new S5Context(ISOLATION_DIR);
    s1Handlers = createS1Handlers(s1);
    handlers = createS5Handlers(s5);
    const semester = s1Handlers["semesters.create"]({ label: "T-M4-015 host boundaries", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" }) as { id: string };
    semesterId = semester.id;
    courseId = (s1Handlers["courses.create"]({ semesterId, courseName: "课程一", subject: "数学" }) as { id: string }).id;
  });

  afterAll(() => {
    s5?.dispose();
    s1?.dispose();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        rmSync(ISOLATION_DIR, { recursive: true, force: true });
        break;
      } catch {
        // Windows may release SQLite handles shortly after dispose.
      }
    }
  });

  it("归档前：已确认考试可生成模拟卷并开始作答", () => {
    const db = s5.semesterDb(semesterId);
    const now = new Date().toISOString();
    db.prepare("INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at) VALUES ('material-s5', @courseId, 'source.pdf', 'pdf', 1, 'application/pdf', 's5.pdf', 'upload', 'completed', 1, @now, @now, @now)").run({ courseId, now });
    db.prepare("INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name, importance, learn_status, source_evidence_json, ai_generated, created_at, updated_at) VALUES ('module-s5', @courseId, 'material-s5', '导数', 3, 'not_started', '[]', 1, @now, @now)").run({ courseId, now });
    const exam = s1Handlers["exams.add"]({ courseId, examName: "期中考试", examType: "midterm", scheduledDate: "2026-08-19", source: "student_input", confidence: 0.9 }) as { id: string };
    s1Handlers["exams.confirm"]({ id: exam.id, confirmed: true });
    const paper = handlers["mockExams.generatePaper"]({ assessmentAttemptId: exam.id, questionCount: 5 }) as { id: string };
    const attempt = handlers["mockExams.startAttempt"]({ paperId: paper.id }) as { id: string };
    expect(attempt.id).toBeTruthy();
  });

  it("归档后：generatePaper / startAttempt / submitAttempt 全部被 host 拒绝", () => {
    const exam = s1Handlers["exams.add"]({ courseId, examName: "期末考试", examType: "final", scheduledDate: "2026-09-10", source: "student_input" }) as { id: string };
    s1Handlers["exams.confirm"]({ id: exam.id, confirmed: true });
    const paper = handlers["mockExams.generatePaper"]({ assessmentAttemptId: exam.id, questionCount: 5 }) as { id: string };
    const attempt = handlers["mockExams.startAttempt"]({ paperId: paper.id }) as { id: string };

    s1Handlers["semesters.transition"]({ id: semesterId, status: "teaching_ended" });
    s1Handlers["semesters.transition"]({ id: semesterId, status: "follow_up" });
    s1Handlers["semesters.transition"]({ id: semesterId, status: "archived" });

    expectBadRequest(() => handlers["mockExams.generatePaper"]({ assessmentAttemptId: exam.id, questionCount: 5 }));
    expectBadRequest(() => handlers["mockExams.startAttempt"]({ paperId: paper.id }));
    expectBadRequest(() => handlers["mockExams.submitAttempt"]({ attemptId: attempt.id, answers: [] }));
    // 只读 DTO 在归档学期仍可读
    expect(Array.isArray(handlers["cramCards.get"]({ assessmentAttemptId: exam.id }))).toBe(true);
    expect(Array.isArray(handlers["cramPlan.get"]({ assessmentAttemptId: exam.id }))).toBe(true);
  });
});
