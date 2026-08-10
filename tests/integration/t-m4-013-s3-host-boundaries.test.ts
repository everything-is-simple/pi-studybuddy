/**
 * T-M4-013 RED：S3 host 侧 archived 写保护与 module/course 归属边界。
 * @vitest-environment node
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import { S3Context, createS3Handlers } from "../../src/agent-host/handlers/s3";
import { createGlobalDb } from "../../src/data/global";
import type { RpcError } from "../../src/contract/types";

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M4-013\\host-boundaries";

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

describe("T-M4-013 S3 host boundary remediation", () => {
  let s1: S1Context;
  let s3: S3Context;
  let s1Handlers: ReturnType<typeof createS1Handlers>;
  let handlers: ReturnType<typeof createS3Handlers>;
  let semesterId: string;
  let courseId: string;
  let otherCourseId: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    s1 = new S1Context(ISOLATION_DIR);
    s3 = new S3Context(ISOLATION_DIR);
    s1Handlers = createS1Handlers(s1);
    handlers = createS3Handlers(s3);
    const semester = s1Handlers["semesters.create"]({ label: "T-M4-013 host boundaries", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" }) as { id: string };
    semesterId = semester.id;
    courseId = (s1Handlers["courses.create"]({ semesterId, courseName: "课程一", subject: "数学" }) as { id: string }).id;
    otherCourseId = (s1Handlers["courses.create"]({ semesterId, courseName: "课程二", subject: "物理" }) as { id: string }).id;
  });

  afterAll(() => {
    s3?.dispose();
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

  it("拒绝不属于 courseId 的 moduleId", () => {
    const db = s3.semesterDb(semesterId);
    const now = new Date().toISOString();
    db.prepare("INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at) VALUES ('material-other', @courseId, 'other.pdf', 'pdf', 1, 'application/pdf', 'other.pdf', 'upload', 'completed', 1, @now, @now, @now)").run({ courseId: otherCourseId, now });
    db.prepare("INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name, importance, learn_status, source_evidence_json, ai_generated, created_at, updated_at) VALUES ('module-other-course', @courseId, 'material-other', '跨课程模块', 3, 'not_started', '[]', 0, @now, @now)").run({ courseId: otherCourseId, now });
    expectBadRequest(() => handlers["practice.createSession"]({ courseId, moduleIds: ["module-other-course"], questionCount: 5 }));
  });

  it("archived 学期拒绝 createSession 与 submit 写操作", () => {
    const db = s3.semesterDb(semesterId);
    const now = new Date().toISOString();
    db.prepare("INSERT INTO materials (id, course_instance_id, file_name, file_type, file_size_bytes, mime_type, storage_key, source_type, status, permission_confirmed, uploaded_at, created_at, updated_at) VALUES ('material-before-archive', @courseId, 'before.pdf', 'pdf', 1, 'application/pdf', 'before.pdf', 'upload', 'completed', 1, @now, @now, @now)").run({ courseId, now });
    db.prepare("INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name, importance, learn_status, source_evidence_json, ai_generated, created_at, updated_at) VALUES ('module-before-archive', @courseId, 'material-before-archive', '归档前模块', 3, 'not_started', '[]', 0, @now, @now)").run({ courseId, now });
    const session = handlers["practice.createSession"]({ courseId, moduleIds: ["module-before-archive"], questionCount: 5 }) as { id: string };
    s1Handlers["semesters.transition"]({ id: semesterId, status: "teaching_ended" });
    s1Handlers["semesters.transition"]({ id: semesterId, status: "follow_up" });
    s1Handlers["semesters.transition"]({ id: semesterId, status: "archived" });
    expectBadRequest(() => handlers["practice.createSession"]({ courseId, moduleIds: ["module-after-archive"], questionCount: 5 }));
    expectBadRequest(() => handlers["practice.submit"]({ sessionId: session.id, answers: [] }));
  });
});
