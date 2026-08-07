/**
 * T-M1-001 S1 任务与每日首页 handler（06-API §3.3 tasks.* + 07-WF §2.2）
 * 4 方法：list / create / complete / dailyBrief
 * dailyBrief 纯规则聚合（非 AI，03-Arch §3.1 studybuddy_daily_brief）
 */
import { randomUUID } from "node:crypto";
import type { StudyTask, DailyBrief } from "../../../contract/types";
import type { S1Context } from "./context";
import { mapTask, mapDailyBrief } from "./dto";
import { notFound } from "./errors";
import { findSemesterByCourseId, findSemesterByEntityId } from "./lookup";
import type { SqlParams } from "../../../data/sqlite";

function now(): string {
  return new Date().toISOString();
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createTaskHandlers(ctx: S1Context) {
  return {
    "tasks.list": (params: unknown): StudyTask[] => {
      const { courseId, status, dueBefore } = params as {
        courseId?: string;
        status?: string;
        dueBefore?: string;
      };

      if (courseId) {
        const { db } = findSemesterByCourseId(ctx, courseId);
        return queryTasks(db, { courseId, status, dueBefore });
      }

      // 无 courseId：遍历所有学期库
      const result: StudyTask[] = [];
      const semesters = ctx.globalDb
        .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL")
        .all() as Array<{ id: string }>;
      for (const s of semesters) {
        const db = ctx.semesterDb(s.id);
        result.push(...queryTasks(db, { status, dueBefore }));
      }
      return result;
    },

    "tasks.create": (params: unknown): StudyTask => {
      const { courseId, title, taskType, dueDate, priority } = params as {
        courseId: string;
        title: string;
        taskType: string;
        dueDate?: string;
        priority?: number;
      };
      const { db, semesterId } = findSemesterByCourseId(ctx, courseId);
      const id = randomUUID();
      const ts = now();
      const prio = priority ?? 3;
      db.prepare(
        `INSERT INTO study_tasks (id, course_instance_id, title, task_type, due_date, priority, status, source_system, created_at, updated_at)
         VALUES (@id, @cid, @title, @taskType, @dueDate, @prio, 'pending', 'S1', @ts, @ts)`,
      ).run({ id, cid: courseId, title, taskType, dueDate: dueDate ?? null, prio, ts });
      const row = db.prepare("SELECT * FROM study_tasks WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapTask(row);
    },

    "tasks.complete": (params: unknown): StudyTask => {
      const { id } = params as { id: string };
      const { db, semesterId } = findSemesterByEntityId(ctx, "study_tasks", id);
      const existing = db.prepare("SELECT * FROM study_tasks WHERE id = @id").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!existing) throw notFound("未找到该任务，请检查是否已删除");

      const ts = now();
      db.prepare(
        "UPDATE study_tasks SET status = 'completed', completed_at = @ts, updated_at = @ts WHERE id = @id",
      ).run({ id, ts });

      // 写 task_completed 事件（07-WF §2.2，source_system='S1'）
      db.prepare(
        `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, source_ref_id, occurred_at, created_at)
         VALUES (@eid, @sid, @cid, 'task_completed', 'S1', @refId, @ts, @ts)`,
      ).run({ eid: randomUUID(), sid: semesterId, cid: existing.course_instance_id as string, refId: id, ts });

      const row = db.prepare("SELECT * FROM study_tasks WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapTask(row);
    },

    "tasks.dailyBrief": (params: unknown): DailyBrief => {
      const { semesterId } = params as { semesterId: string };
      const db = ctx.semesterDb(semesterId);
      const today = todayISO();

      // 到期任务（due_date <= 今天，未完成）
      const tasks = db
        .prepare(
          `SELECT * FROM study_tasks WHERE deleted_at IS NULL AND status IN ('pending', 'in_progress') AND due_date <= @today ORDER BY due_date`,
        )
        .all({ today }) as Record<string, unknown>[];

      const studyTasks = tasks.map(mapTask);
      return mapDailyBrief(today, studyTasks);
    },
  };
}

function queryTasks(
  db: import("../../../data/sqlite").DatabaseSync,
  opts: { courseId?: string; status?: string; dueBefore?: string },
): StudyTask[] {
  const conditions = ["deleted_at IS NULL"];
  const values: SqlParams = {};
  if (opts.courseId) {
    conditions.push("course_instance_id = @cid");
    values.cid = opts.courseId;
  }
  if (opts.status) {
    conditions.push("status = @status");
    values.status = opts.status;
  }
  if (opts.dueBefore) {
    conditions.push("due_date <= @dueBefore");
    values.dueBefore = opts.dueBefore;
  }
  const rows = db
    .prepare(`SELECT * FROM study_tasks WHERE ${conditions.join(" AND ")} ORDER BY due_date, created_at`)
    .all(values) as Record<string, unknown>[];
  return rows.map(mapTask);
}
