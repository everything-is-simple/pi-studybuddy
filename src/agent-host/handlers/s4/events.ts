/**
 * T-M1-004 S4 学习事件写入工具（07-WF §2.5）
 *
 * mistakes.archive → mistake_archived 事件
 * mistakes.confirmErrorCause → error_cause_confirmed 事件
 * mistakes.redo → practice_reviewed 事件
 * source_system='S4'（与 S1/S2/S3 区分）
 */
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "../../../data/sqlite";

function now(): string {
  return new Date().toISOString();
}

export function writeMistakeArchivedEvent(
  db: DatabaseSync,
  semesterId: string,
  courseId: string,
  mistakeId: string,
): void {
  const ts = now();
  db.prepare(
    `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, source_ref_id, occurred_at, created_at)
     VALUES (@id, @sid, @cid, 'mistake_archived', 'S4', @refId, @ts, @ts)`,
  ).run({ id: randomUUID(), sid: semesterId, cid: courseId, refId: mistakeId, ts });
}

export function writeErrorCauseConfirmedEvent(
  db: DatabaseSync,
  semesterId: string,
  courseId: string,
  mistakeId: string,
): void {
  const ts = now();
  db.prepare(
    `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, source_ref_id, occurred_at, created_at)
     VALUES (@id, @sid, @cid, 'error_cause_confirmed', 'S4', @refId, @ts, @ts)`,
  ).run({ id: randomUUID(), sid: semesterId, cid: courseId, refId: mistakeId, ts });
}

export function writePracticeReviewedEvent(
  db: DatabaseSync,
  semesterId: string,
  courseId: string,
  mistakeId: string,
): void {
  const ts = now();
  db.prepare(
    `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, source_ref_id, occurred_at, created_at)
     VALUES (@id, @sid, @cid, 'practice_reviewed', 'S4', @refId, @ts, @ts)`,
  ).run({ id: randomUUID(), sid: semesterId, cid: courseId, refId: mistakeId, ts });
}
