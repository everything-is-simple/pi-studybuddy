/**
 * T-M1-002 S2 学习事件写入工具（07-WF §2.3）
 *
 * materials.upload → material_uploaded 事件
 * materials.generateNote → note_generated 事件（由 Job 状态迁移成功后写入，本任务仅登记 Job 不触发）
 *
 * source_system='S2'（与 S1 区分）
 */
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "../../../data/sqlite";

function now(): string {
  return new Date().toISOString();
}

export function writeMaterialUploadedEvent(
  db: DatabaseSync,
  semesterId: string,
  courseId: string,
  materialId: string,
): void {
  const ts = now();
  db.prepare(
    `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, source_ref_id, occurred_at, created_at)
     VALUES (@id, @sid, @cid, 'material_uploaded', 'S2', @refId, @ts, @ts)`,
  ).run({ id: randomUUID(), sid: semesterId, cid: courseId, refId: materialId, ts });
}
