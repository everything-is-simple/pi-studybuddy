/**
 * T-M1-001 S1 学习事件 handler（06-API §3.3 events.*）
 * 2 方法：list / markReviewed
 * markReviewed 写 practice_reviewed 事件（07-WF TTS 朗读标记"已复习"）
 */
import { randomUUID } from "node:crypto";
import type { StudyEvent } from "../../../contract/types";
import type { S1Context } from "./context";
import { mapEvent } from "./dto";
import { findSemesterByCourseId } from "./lookup";
import { badRequest } from "./errors";
import type { SqlParams } from "../../../data/sqlite";

function now(): string {
  return new Date().toISOString();
}

export function createEventHandlers(ctx: S1Context) {
  return {
    "events.list": (params: unknown): StudyEvent[] => {
      const { semesterId, courseId, eventType, since } = params as {
        semesterId?: string;
        courseId?: string;
        eventType?: string;
        since?: string;
      };

      // 确定查询的学期库
      let targetSemesterId: string | undefined = semesterId;
      if (!targetSemesterId && courseId) {
        const { semesterId: sid } = findSemesterByCourseId(ctx, courseId);
        targetSemesterId = sid;
      }
      if (!targetSemesterId) {
        // 无 semesterId 且无 courseId：返回空（避免无范围查询）
        return [];
      }

      const db = ctx.semesterDb(targetSemesterId);
      const conditions: string[] = [];
      const values: SqlParams = {};
      if (courseId) {
        conditions.push("course_instance_id = @cid");
        values.cid = courseId;
      }
      if (eventType) {
        conditions.push("event_type = @etype");
        values.etype = eventType;
      }
      if (since) {
        conditions.push("occurred_at >= @since");
        values.since = since;
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const rows = db
        .prepare(`SELECT * FROM study_events ${where} ORDER BY occurred_at DESC`)
        .all(values) as Record<string, unknown>[];
      return rows.map(mapEvent);
    },

    "events.markReviewed": (params: unknown): StudyEvent => {
      const { refType, refId } = params as { refType: string; refId: string };
      // 通过 refId 找到所属学期库（refId 可能是 practice_answer / mistake 等的 id）
      // M1 简化：遍历非 archived 学期库查找 refId 所属课程
      const semesters = ctx.globalDb
        .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL ORDER BY created_at DESC")
        .all() as Array<{ id: string }>;

      for (const s of semesters) {
        const db = ctx.semesterDb(s.id);
        // 尝试在 study_events 中找已有的 source_ref_id = refId 的事件
        const existing = db
          .prepare("SELECT * FROM study_events WHERE source_ref_id = @refId ORDER BY occurred_at DESC LIMIT 1")
          .get({ refId }) as Record<string, unknown> | undefined;
        if (existing) {
          const id = randomUUID();
          const ts = now();
          db.prepare(
            `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, source_ref_id, occurred_at, created_at)
             VALUES (@id, @sid, @cid, 'practice_reviewed', 'S1', @refId, @ts, @ts)`,
          ).run({
            id,
            sid: existing.semester_id as string,
            cid: existing.course_instance_id as string,
            refId,
            ts,
          });
          const row = db.prepare("SELECT * FROM study_events WHERE id = @id").get({ id }) as Record<string, unknown>;
          return mapEvent(row);
        }
      }

      // 未找到已有事件：在第一个学期库写 practice_reviewed 事件
      if (semesters.length === 0) {
        throw badRequest("无可用学期库，请先创建学期");
      }
      const db = ctx.semesterDb(semesters[0].id);
      const id = randomUUID();
      const ts = now();
      const sourceRefId = `${refType}:${refId}`;
      db.prepare(
        `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, source_ref_id, occurred_at, created_at)
         VALUES (@id, @sid, NULL, 'practice_reviewed', 'S1', @refId, @ts, @ts)`,
      ).run({ id, sid: semesters[0].id, refId: sourceRefId, ts });
      const row = db.prepare("SELECT * FROM study_events WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapEvent(row);
    },
  };
}
