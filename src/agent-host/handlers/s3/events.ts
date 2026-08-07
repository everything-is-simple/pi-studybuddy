/**
 * T-M1-003 S3 学习事件写入工具（07-WF §2.4）
 *
 * practice.submit → practice_submitted / practice_graded 事件
 * source_system='S3'（与 S1/S2 区分）
 */
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "../../../data/sqlite";

function now(): string {
  return new Date().toISOString();
}

export function writePracticeSubmittedEvent(
  db: DatabaseSync,
  semesterId: string,
  courseId: string,
  sessionId: string,
): void {
  const ts = now();
  db.prepare(
    `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, source_ref_id, occurred_at, created_at)
     VALUES (@id, @sid, @cid, 'practice_submitted', 'S3', @refId, @ts, @ts)`,
  ).run({ id: randomUUID(), sid: semesterId, cid: courseId, refId: sessionId, ts });
}

export function writePracticeGradedEvent(
  db: DatabaseSync,
  semesterId: string,
  courseId: string,
  sessionId: string,
): void {
  const ts = now();
  db.prepare(
    `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, source_ref_id, occurred_at, created_at)
     VALUES (@id, @sid, @cid, 'practice_graded', 'S3', @refId, @ts, @ts)`,
  ).run({ id: randomUUID(), sid: semesterId, cid: courseId, refId: sessionId, ts });
}
