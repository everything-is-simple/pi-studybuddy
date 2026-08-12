/**
 * T-M1-001 S1 跨库查找（course/exam/schedule/task → semester.db 定位）
 *
 * semester.db 按学期隔离，06-API §3.3 部分方法参数只有 id（如 courses.get），
 * 需遍历非 archived 学期库定位实体所属 semester.db。n 通常为 1-2，可接受。
 */
import type { S1Context } from "./context";
import type { DatabaseSync } from "../../../data/sqlite";
import { badRequest, notFound } from "./errors";

export interface SemDbRef {
  db: DatabaseSync;
  semesterId: string;
}

function activeSemesterIds(ctx: S1Context): string[] {
  return (ctx.globalDb
    .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL ORDER BY created_at DESC")
    .all() as Array<{ id: string }>).map((r) => r.id);
}

/** 已归档学期只能浏览，所有 S1 写入口均须在写入前调用。 */
export function assertSemesterWritable(ctx: S1Context, semesterId: string): void {
  const row = ctx.globalDb
    .prepare("SELECT status FROM semesters WHERE id = @id AND deleted_at IS NULL")
    .get({ id: semesterId }) as { status?: string } | undefined;
  if (!row) throw notFound("未找到该学期，请检查是否已删除");
  if (row.status === "archived") throw badRequest("学期已归档，仅支持浏览");
}

export function findSemesterByCourseId(ctx: S1Context, courseId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare("SELECT 1 FROM course_instances WHERE id = @id AND deleted_at IS NULL")
      .get({ id: courseId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该课程，请检查是否已删除");
}

export function findSemesterByEntityId(ctx: S1Context, table: string, entityId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare(`SELECT 1 FROM ${table} WHERE id = @id AND deleted_at IS NULL`)
      .get({ id: entityId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该资源，请检查是否已删除");
}
