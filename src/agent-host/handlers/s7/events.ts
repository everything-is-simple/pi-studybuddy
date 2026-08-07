/**
 * T-M2-003 S7 学习事件写入工具（07-WF §2.7 + 05-ERD §3.1.5）
 *
 * classCapture.saveTranscription → class_handoff_saved 事件
 * source_system='S7'（与 S1-S6 区分）
 *
 * study_events 表 schema 已就绪（T-M0-006 schema source_system CHECK 含 'S7'）。
 */
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "../../../data/sqlite";

function now(): string {
  return new Date().toISOString();
}

/**
 * 写入 class_handoff_saved 事件（S7 → S2 handoff 完成）。
 *
 * @param db semester.db 句柄
 * @param semesterId 学期 ID
 * @param courseId 课程实例 ID
 * @param materialId 创建的 material ID（source_ref_id）
 */
export function writeClassHandoffSavedEvent(
  db: DatabaseSync,
  semesterId: string,
  courseId: string,
  materialId: string,
): void {
  const ts = now();
  db.prepare(
    `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, source_ref_id, occurred_at, created_at)
     VALUES (@id, @sid, @cid, 'class_handoff_saved', 'S7', @refId, @ts, @ts)`,
  ).run({ id: randomUUID(), sid: semesterId, cid: courseId, refId: materialId, ts });
}
