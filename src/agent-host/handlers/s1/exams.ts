/**
 * T-M1-001 S1 考试管理 handler（06-API §3.3 exams.* + 07-WF §2.2 步骤 4-5）
 * 4 方法：list / add / confirm / supersede
 * 确认四态：pending/confirmed/rejected/superseded（05-ERD §3.1.2 CHECK）
 */
import { randomUUID } from "node:crypto";
import type { AssessmentAttempt } from "../../../contract/types";
import type { S1Context } from "./context";
import { mapAssessment } from "./dto";
import { notFound, badRequest } from "./errors";
import { findSemesterByCourseId, findSemesterByEntityId } from "./lookup";

function now(): string {
  return new Date().toISOString();
}

export function createExamHandlers(ctx: S1Context) {
  return {
    "exams.list": (params: unknown): AssessmentAttempt[] => {
      const { courseId, confirmationStatus } = params as {
        courseId?: string;
        confirmationStatus?: string;
      };

      if (courseId) {
        const { db } = findSemesterByCourseId(ctx, courseId);
        if (confirmationStatus) {
          const rows = db
            .prepare("SELECT * FROM assessment_attempts WHERE course_instance_id = @cid AND confirmation_status = @status AND deleted_at IS NULL ORDER BY scheduled_date")
            .all({ cid: courseId, status: confirmationStatus }) as Record<string, unknown>[];
          return rows.map(mapAssessment);
        }
        const rows = db
          .prepare("SELECT * FROM assessment_attempts WHERE course_instance_id = @cid AND deleted_at IS NULL ORDER BY scheduled_date")
          .all({ cid: courseId }) as Record<string, unknown>[];
        return rows.map(mapAssessment);
      }

      // 无 courseId：遍历所有学期库
      const result: AssessmentAttempt[] = [];
      const semesters = ctx.globalDb
        .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL")
        .all() as Array<{ id: string }>;
      for (const s of semesters) {
        const db = ctx.semesterDb(s.id);
        if (confirmationStatus) {
          const rows = db
            .prepare("SELECT * FROM assessment_attempts WHERE confirmation_status = @status AND deleted_at IS NULL ORDER BY scheduled_date")
            .all({ status: confirmationStatus }) as Record<string, unknown>[];
          result.push(...rows.map(mapAssessment));
        } else {
          const rows = db
            .prepare("SELECT * FROM assessment_attempts WHERE deleted_at IS NULL ORDER BY scheduled_date")
            .all() as Record<string, unknown>[];
          result.push(...rows.map(mapAssessment));
        }
      }
      return result;
    },

    "exams.add": (params: unknown): AssessmentAttempt => {
      const { courseId, examName, examType, scheduledDate, source, confidence } = params as {
        courseId: string;
        examName: string;
        examType: string;
        scheduledDate: string;
        source: "student_input" | "ocr_schedule" | "ai_extracted";
        confidence?: number;
      };
      const { db, semesterId } = findSemesterByCourseId(ctx, courseId);
      const id = randomUUID();
      const ts = now();

      db.prepare(
        `INSERT INTO assessment_attempts (id, course_instance_id, exam_name, exam_type, scheduled_date, confirmation_status, source, confidence, created_at, updated_at)
         VALUES (@id, @cid, @examName, @examType, @scheduledDate, 'pending', @source, @confidence, @ts, @ts)`,
      ).run({ id, cid: courseId, examName, examType, scheduledDate, source, confidence: confidence ?? null, ts });

      // 写 exam_added 事件（07-WF §2.2 步骤 4）
      db.prepare(
        `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, source_ref_id, occurred_at, created_at)
         VALUES (@eid, @sid, @cid, 'exam_added', 'S1', @refId, @ts, @ts)`,
      ).run({ eid: randomUUID(), sid: semesterId, cid: courseId, refId: id, ts });

      const row = db.prepare("SELECT * FROM assessment_attempts WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapAssessment(row);
    },

    "exams.confirm": (params: unknown): AssessmentAttempt => {
      const { id, confirmed } = params as { id: string; confirmed: boolean };
      const { db, semesterId } = findSemesterByEntityId(ctx, "assessment_attempts", id);
      const existing = db.prepare("SELECT * FROM assessment_attempts WHERE id = @id").get({ id }) as Record<string, unknown>;
      if (!existing) throw notFound("未找到该考试记录");

      const status = confirmed ? "confirmed" : "rejected";
      const ts = now();
      db.prepare(
        "UPDATE assessment_attempts SET confirmation_status = @status, confirmed_at = @ts, confirmed_by = 'student', updated_at = @ts WHERE id = @id",
      ).run({ id, status, ts });

      if (confirmed) {
        // 写 exam_confirmed 事件（07-WF §2.2 步骤 5）
        db.prepare(
          `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, source_ref_id, occurred_at, created_at)
           VALUES (@eid, @sid, @cid, 'exam_confirmed', 'S1', @refId, @ts, @ts)`,
        ).run({ eid: randomUUID(), sid: semesterId, cid: existing.course_instance_id as string, refId: id, ts });

        // 标记学期就绪：该课程下有 confirmed 考试 → semesters.ready = 1（07-WF §2.2 步骤 5）
        ctx.globalDb
          .prepare("UPDATE semesters SET ready = 1, updated_at = @ts WHERE id = @sid")
          .run({ sid: semesterId, ts });
      }

      const row = db.prepare("SELECT * FROM assessment_attempts WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapAssessment(row);
    },

    "exams.supersede": (params: unknown): AssessmentAttempt => {
      const { id, newAttemptId } = params as { id: string; newAttemptId: string };
      const { db } = findSemesterByEntityId(ctx, "assessment_attempts", id);
      const ts = now();
      db.prepare(
        "UPDATE assessment_attempts SET confirmation_status = 'superseded', updated_at = @ts WHERE id = @id",
      ).run({ id, ts });

      // 新 attempt 关联旧 attempt（retake_of）
      db.prepare(
        "UPDATE assessment_attempts SET retake_of = @oldId, updated_at = @ts WHERE id = @newId",
      ).run({ oldId: id, newId: newAttemptId, ts });

      const row = db.prepare("SELECT * FROM assessment_attempts WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapAssessment(row);
    },
  };
}
