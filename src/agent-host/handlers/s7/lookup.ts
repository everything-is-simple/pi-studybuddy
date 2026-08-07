/**
 * T-M2-003 S7 跨库查找（courseId → semester.db 定位）
 *
 * 复用 S1-S6 模式：遍历非 archived 学期库定位 course_instances 所属 semester.db。
 * S7 RPC 方法参数只有 courseId（06-API §3.9），需通过 courseId 解析 semesterId。
 */
import type { S7Context } from "./context";
import type { DatabaseSync } from "../../../data/sqlite";
import { notFound } from "./errors";

export interface SemDbRef {
  db: DatabaseSync;
  semesterId: string;
}

function activeSemesterIds(ctx: S7Context): string[] {
  return (ctx.globalDb
    .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL ORDER BY created_at DESC")
    .all() as Array<{ id: string }>).map((r) => r.id);
}

/** 通过 courseId 定位 semester.db（与 S1/S2 一致模式） */
export function findSemesterByCourseId(ctx: S7Context, courseId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare("SELECT 1 FROM course_instances WHERE id = @id AND deleted_at IS NULL")
      .get({ id: courseId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该课程，请检查是否已删除");
}
