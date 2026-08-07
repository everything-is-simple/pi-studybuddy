/**
 * T-M1-003 S3 跨库查找（course/session → semester.db 定位）
 *
 * 复用 S1/S2 模式：遍历非 archived 学期库定位实体所属 semester.db。
 */
import type { S3Context } from "./context";
import type { DatabaseSync } from "../../../data/sqlite";
import { notFound } from "./errors";

export interface SemDbRef {
  db: DatabaseSync;
  semesterId: string;
}

function activeSemesterIds(ctx: S3Context): string[] {
  return (ctx.globalDb
    .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL ORDER BY created_at DESC")
    .all() as Array<{ id: string }>).map((r) => r.id);
}

/** 通过 courseId 定位 semester.db */
export function findSemesterByCourseId(ctx: S3Context, courseId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare("SELECT 1 FROM course_instances WHERE id = @id AND deleted_at IS NULL")
      .get({ id: courseId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该课程，请检查是否已删除");
}

/** 通过 practice_session_id 定位 semester.db */
export function findSemesterBySessionId(ctx: S3Context, sessionId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db.prepare("SELECT 1 FROM practice_sessions WHERE id = @id").get({ id: sessionId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该练习会话，请检查是否已删除");
}
