/**
 * T-M1-001 S1 学期管理 handler（06-API §3.3 semesters.* + 07-WF §2.2）
 *
 * 6 方法：list / create / get / update / transition / archive
 * create 跨库写：global.db:semesters + 初始化 semester/<id>/sem.db
 * transition 状态机：active→teaching_ended→follow_up→archived
 */
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Semester, SemesterStatus } from "../../../contract/types";
import type { S1Context } from "./context";
import { mapSemester } from "./dto";
import { notFound, badRequest } from "./errors";
import { createSemesterDb } from "../../../data/semester";
import type { SqlParams } from "../../../data/sqlite";

const VALID_TRANSITIONS: Record<string, SemesterStatus> = {
  active: "teaching_ended",
  teaching_ended: "follow_up",
  follow_up: "archived",
};

function now(): string {
  return new Date().toISOString();
}

export function createSemesterHandlers(ctx: S1Context) {
  return {
    "semesters.list": (params: unknown): Semester[] => {
      const { status } = (params ?? {}) as { status?: string };
      const db = ctx.globalDb;
      if (status) {
        const rows = db
          .prepare("SELECT * FROM semesters WHERE status = @status AND deleted_at IS NULL ORDER BY created_at DESC")
          .all({ status }) as Record<string, unknown>[];
        return rows.map(mapSemester);
      }
      const rows = db
        .prepare("SELECT * FROM semesters WHERE deleted_at IS NULL ORDER BY created_at DESC")
        .all() as Record<string, unknown>[];
      return rows.map(mapSemester);
    },

    "semesters.create": (params: unknown): Semester => {
      const { label, startDate, endDate, timezone } = params as {
        label: string;
        startDate: string;
        endDate: string;
        timezone: string;
      };
      const id = randomUUID();
      const ts = now();
      const dbRelativePath = `semester/${id}/sem.db`;

      const db = ctx.globalDb;
      db.prepare(
        `INSERT INTO semesters (id, student_name, semester_label, start_date, end_date, timezone, status, db_relative_path, ready, created_at, updated_at)
         VALUES (@id, @studentName, @label, @startDate, @endDate, @timezone, 'active', @dbRelativePath, 0, @ts, @ts)`,
      ).run({ id, studentName: "学生", label, startDate, endDate, timezone, dbRelativePath, ts });

      // 初始化学期库（05-ERD §1.3）
      createSemesterDb(ctx.dataRootPath, id);

      // 写 semester_initialized 事件（07-WF §2.2 步骤 5）
      const semDb = ctx.semesterDb(id);
      semDb.prepare(
        `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, occurred_at, created_at)
         VALUES (@eid, @sid, NULL, 'semester_initialized', 'S1', @ts, @ts)`,
      ).run({ eid: randomUUID(), sid: id, ts });

      const row = db.prepare("SELECT * FROM semesters WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapSemester(row);
    },

    "semesters.get": (params: unknown): Semester => {
      const { id } = params as { id: string };
      const row = ctx.globalDb.prepare("SELECT * FROM semesters WHERE id = @id AND deleted_at IS NULL").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!row) throw notFound("未找到该学期，请检查是否已删除");
      return mapSemester(row);
    },

    "semesters.update": (params: unknown): Semester => {
      const { id, ...fields } = params as { id: string; [k: string]: unknown };
      const existing = ctx.globalDb.prepare("SELECT * FROM semesters WHERE id = @id AND deleted_at IS NULL").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!existing) throw notFound("未找到该学期，请检查是否已删除");

      // 白名单字段映射（camelCase → snake_case）
      const allowed: Record<string, string> = {
        label: "semester_label",
        startDate: "start_date",
        endDate: "end_date",
        timezone: "timezone",
        ready: "ready",
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
        return mapSemester(existing);
      }
      sets.push("updated_at = @ts");
      ctx.globalDb.prepare(`UPDATE semesters SET ${sets.join(", ")} WHERE id = @id`).run(values);
      const row = ctx.globalDb.prepare("SELECT * FROM semesters WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapSemester(row);
    },

    "semesters.transition": (params: unknown): Semester => {
      const { id, status } = params as { id: string; status: string };
      const row = ctx.globalDb.prepare("SELECT * FROM semesters WHERE id = @id AND deleted_at IS NULL").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!row) throw notFound("未找到该学期，请检查是否已删除");

      const currentStatus = row.status as string;
      const expected = VALID_TRANSITIONS[currentStatus];
      if (!expected || expected !== status) {
        throw badRequest(`学期状态不允许从 ${currentStatus} 迁移到 ${status}，请按 active→teaching_ended→follow_up→archived 顺序操作`);
      }

      const ts = now();
      const sets: string[] = ["status = @status", "updated_at = @ts"];
      const values: SqlParams = { id, status, ts };
      if (status === "archived") {
        sets.push("archived_at = @ts");
        // TODO(T-M2): 归档前后强制触发完整备份（03-Arch §3.1 studybuddy_transition_semester）
      }
      ctx.globalDb.prepare(`UPDATE semesters SET ${sets.join(", ")} WHERE id = @id`).run(values);

      // 写审计事件
      const semDb = ctx.semesterDb(id);
      semDb.prepare(
        `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, occurred_at, created_at)
         VALUES (@eid, @sid, NULL, @etype, 'S1', @ts, @ts)`,
      ).run({ eid: randomUUID(), sid: id, etype: `semester_transitioned:${status}`, ts });

      const updated = ctx.globalDb.prepare("SELECT * FROM semesters WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapSemester(updated);
    },

    "semesters.archive": (params: unknown): Semester => {
      const { id } = params as { id: string };
      const row = ctx.globalDb.prepare("SELECT * FROM semesters WHERE id = @id AND deleted_at IS NULL").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!row) throw notFound("未找到该学期，请检查是否已删除");
      if (row.status === "archived") throw badRequest("该学期已归档，无需重复操作");

      const ts = now();
      // TODO(T-M2): 归档前后强制触发完整备份
      ctx.globalDb
        .prepare("UPDATE semesters SET status = 'archived', archived_at = @ts, updated_at = @ts WHERE id = @id")
        .run({ id, ts });

      const semDb = ctx.semesterDb(id);
      semDb.prepare(
        `INSERT INTO study_events (id, semester_id, course_instance_id, event_type, source_system, occurred_at, created_at)
         VALUES (@eid, @sid, NULL, 'semester_archived', 'S1', @ts, @ts)`,
      ).run({ eid: randomUUID(), sid: id, ts });

      const updated = ctx.globalDb.prepare("SELECT * FROM semesters WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapSemester(updated);
    },
  };
}
