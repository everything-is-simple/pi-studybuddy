/**
 * T-M1-001 S1 课程管理 handler（06-API §3.3 courses.*）
 * 5 方法：list / create / get / update / importSchedule（占位）
 */
import { randomUUID } from "node:crypto";
import type { CourseInstance } from "../../../contract/types";
import type { S1Context } from "./context";
import { mapCourse } from "./dto";
import { notFound, badRequest } from "./errors";
import { assertSemesterWritable, findSemesterByCourseId } from "./lookup";
import type { SqlParams } from "../../../data/sqlite";

function now(): string {
  return new Date().toISOString();
}

export function createCourseHandlers(ctx: S1Context) {
  return {
    "courses.list": (params: unknown): CourseInstance[] => {
      const { semesterId } = params as { semesterId: string };
      const db = ctx.semesterDb(semesterId);
      const rows = db
        .prepare("SELECT * FROM course_instances WHERE semester_id = @sid AND deleted_at IS NULL ORDER BY created_at")
        .all({ sid: semesterId }) as Record<string, unknown>[];
      return rows.map(mapCourse);
    },

    "courses.create": (params: unknown): CourseInstance => {
      const { semesterId, courseName, subject, ...rest } = params as {
        semesterId: string;
        courseName: string;
        subject: string;
        [k: string]: unknown;
      };
      assertSemesterWritable(ctx, semesterId);
      const id = randomUUID();
      const ts = now();
      const db = ctx.semesterDb(semesterId);

      const allowed: Record<string, string> = {
        teacher: "teacher",
        dailyMinutesTarget: "daily_minutes_target",
        availableTimeJson: "available_time_json",
        targetScoreJson: "target_score_json",
        retakeOf: "retake_of",
      };
      const extraCols: string[] = [];
      const extraVals: string[] = [];
      const extraParams: Record<string, unknown> = {};
      for (const [camel, snake] of Object.entries(allowed)) {
        if (camel in rest) {
          extraCols.push(snake);
          extraVals.push(`@${camel}`);
          extraParams[camel] = rest[camel];
        }
      }

      const cols = ["id", "semester_id", "course_name", "subject", "status", "created_at", "updated_at", ...extraCols];
      const vals = ["@id", "@sid", "@courseName", "@subject", "'active'", "@ts", "@ts", ...extraVals];
      db.prepare(`INSERT INTO course_instances (${cols.join(", ")}) VALUES (${vals.join(", ")})`).run({
        id,
        sid: semesterId,
        courseName,
        subject,
        ts,
        ...extraParams,
      });

      const row = db.prepare("SELECT * FROM course_instances WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapCourse(row);
    },

    "courses.get": (params: unknown): CourseInstance => {
      const { id } = params as { id: string };
      const { db } = findSemesterByCourseId(ctx, id);
      const row = db.prepare("SELECT * FROM course_instances WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapCourse(row);
    },

    "courses.update": (params: unknown): CourseInstance => {
      const { id, ...fields } = params as { id: string; [k: string]: unknown };
      const { db, semesterId } = findSemesterByCourseId(ctx, id);
      assertSemesterWritable(ctx, semesterId);

      const allowed: Record<string, string> = {
        courseName: "course_name",
        subject: "subject",
        teacher: "teacher",
        dailyMinutesTarget: "daily_minutes_target",
        availableTimeJson: "available_time_json",
        targetScoreJson: "target_score_json",
        status: "status",
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
        const row = db.prepare("SELECT * FROM course_instances WHERE id = @id").get({ id }) as Record<string, unknown>;
        return mapCourse(row);
      }
      sets.push("updated_at = @ts");
      db.prepare(`UPDATE course_instances SET ${sets.join(", ")} WHERE id = @id`).run(values);
      const row = db.prepare("SELECT * FROM course_instances WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapCourse(row);
    },

    "courses.importSchedule": (_params: unknown): never => {
      // OCR venv Adapter 是独立后续任务（04-Todo §7.2 行415）
      throw badRequest("课表识别功能待接入，请手动录入课表");
    },
  };
}
