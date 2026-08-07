/**
 * T-M1-001 S1 课表 handler（06-API §3.3 schedule.*）
 * 4 方法：list / create / update / delete（软删除）
 * CHECK end_time > start_time 由 DB schema 保证（05-ERD §3.1.3）
 */
import { randomUUID } from "node:crypto";
import type { ScheduleEntry } from "../../../contract/types";
import type { S1Context } from "./context";
import { mapSchedule } from "./dto";
import { findSemesterByCourseId, findSemesterByEntityId } from "./lookup";
import type { SqlParams } from "../../../data/sqlite";

function now(): string {
  return new Date().toISOString();
}

export function createScheduleHandlers(ctx: S1Context) {
  return {
    "schedule.list": (params: unknown): ScheduleEntry[] => {
      const { courseId } = params as { courseId: string };
      const { db } = findSemesterByCourseId(ctx, courseId);
      const rows = db
        .prepare("SELECT * FROM schedule_entries WHERE course_instance_id = @cid AND deleted_at IS NULL ORDER BY weekday, start_time")
        .all({ cid: courseId }) as Record<string, unknown>[];
      return rows.map(mapSchedule);
    },

    "schedule.create": (params: unknown): ScheduleEntry => {
      const { courseId, weekday, startTime, endTime, location } = params as {
        courseId: string;
        weekday: number;
        startTime: string;
        endTime: string;
        location?: string;
      };
      const { db } = findSemesterByCourseId(ctx, courseId);
      const id = randomUUID();
      const ts = now();
      db.prepare(
        `INSERT INTO schedule_entries (id, course_instance_id, weekday, start_time, end_time, location, created_at, updated_at)
         VALUES (@id, @cid, @weekday, @startTime, @endTime, @location, @ts, @ts)`,
      ).run({ id, cid: courseId, weekday, startTime, endTime, location: location ?? null, ts });
      const row = db.prepare("SELECT * FROM schedule_entries WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapSchedule(row);
    },

    "schedule.update": (params: unknown): ScheduleEntry => {
      const { id, ...fields } = params as { id: string; [k: string]: unknown };
      const { db } = findSemesterByEntityId(ctx, "schedule_entries", id);
      const allowed: Record<string, string> = {
        weekday: "weekday",
        startTime: "start_time",
        endTime: "end_time",
        location: "location",
        weekPattern: "week_pattern",
      };
      const sets: string[] = [];
      const values: SqlParams = { id, ts: now() };
      for (const [camel, snake] of Object.entries(allowed)) {
        if (camel in fields) {
          sets.push(`${snake} = @${camel}`);
          values[camel] = fields[camel] as string | number | null;
        }
      }
      if (sets.length === 0) {
        const row = db.prepare("SELECT * FROM schedule_entries WHERE id = @id").get({ id }) as Record<string, unknown>;
        return mapSchedule(row);
      }
      sets.push("updated_at = @ts");
      db.prepare(`UPDATE schedule_entries SET ${sets.join(", ")} WHERE id = @id`).run(values);
      const row = db.prepare("SELECT * FROM schedule_entries WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapSchedule(row);
    },

    "schedule.delete": (params: unknown): void => {
      const { id } = params as { id: string };
      const { db } = findSemesterByEntityId(ctx, "schedule_entries", id);
      db.prepare("UPDATE schedule_entries SET deleted_at = @ts WHERE id = @id").run({ id, ts: now() });
    },
  };
}
