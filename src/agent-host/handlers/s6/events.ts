/**
 * T-M2-002 S6 学习事件写入工具（07-WF §3）
 *
 * reports.generate → report_generated 事件
 * deliveries.deliver/retry → report_delivered 事件
 * source_system='S6'（与 S1-S5 区分）
 */
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "../../../data/sqlite";

function now(): string {
  return new Date().toISOString();
}

export function writeReportGeneratedEvent(
  db: DatabaseSync,
  semesterId: string,
  reportKey: string,
): void {
  const ts = now();
  db.prepare(
    `INSERT INTO study_events (id, semester_id, event_type, source_system, source_ref_id, occurred_at, created_at)
     VALUES (@id, @sid, 'report_generated', 'S6', @refId, @ts, @ts)`,
  ).run({ id: randomUUID(), sid: semesterId, refId: reportKey, ts });
}

export function writeReportDeliveredEvent(
  db: DatabaseSync,
  semesterId: string,
  reportKey: string,
  channel: string,
  status: string,
): void {
  const ts = now();
  db.prepare(
    `INSERT INTO study_events (id, semester_id, event_type, source_system, source_ref_id, event_data_json, occurred_at, created_at)
     VALUES (@id, @sid, 'report_delivered', 'S6', @refId, @meta, @ts, @ts)`,
  ).run({
    id: randomUUID(),
    sid: semesterId,
    refId: reportKey,
    meta: JSON.stringify({ channel, status }),
    ts,
  });
}
