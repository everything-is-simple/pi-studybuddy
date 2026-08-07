/**
 * T-M2-001 S5 学习事件写入工具（07-WF §2.6）
 *
 * mockExams.submitAttempt → mock_exam_completed 事件
 * source_system='S5'（与 S1/S2/S3/S4 区分）
 */
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "../../../data/sqlite";

function now(): string {
  return new Date().toISOString();
}

export function writeMockExamCompletedEvent(
  db: DatabaseSync,
  semesterId: string,
  courseId: string,
  attemptId: string,
): void {
  const ts = now();
  db.prepare(
    `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, source_ref_id, occurred_at, created_at)
     VALUES (@id, @sid, @cid, 'mock_exam_completed', 'S5', @refId, @ts, @ts)`,
  ).run({ id: randomUUID(), sid: semesterId, cid: courseId, refId: attemptId, ts });
}
