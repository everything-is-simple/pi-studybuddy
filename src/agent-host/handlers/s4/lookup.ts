/**
 * T-M1-004 S4 跨库查找（mistake/practiceAnswer/weakPoint → semester.db 定位）
 *
 * 复用 S1/S2/S3 模式：遍历非 archived 学期库定位实体所属 semester.db。
 */
import type { S4Context } from "./context";
import type { DatabaseSync } from "../../../data/sqlite";
import { notFound } from "./errors";

export interface SemDbRef {
  db: DatabaseSync;
  semesterId: string;
}

function activeSemesterIds(ctx: S4Context): string[] {
  return (ctx.globalDb
    .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL ORDER BY created_at DESC")
    .all() as Array<{ id: string }>).map((r) => r.id);
}

/** 通过 mistakeId 定位 semester.db（mistakes 表） */
export function findSemesterByMistakeId(ctx: S4Context, mistakeId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db.prepare("SELECT 1 FROM mistakes WHERE id = @id").get({ id: mistakeId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该错题");
}

/** 通过 practiceAnswerId 定位 semester.db（practice_answers 表） */
export function findSemesterByPracticeAnswerId(ctx: S4Context, practiceAnswerId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare("SELECT 1 FROM practice_answers WHERE id = @id")
      .get({ id: practiceAnswerId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该练习答题记录");
}

/** 通过 weakPointId 定位 semester.db（weak_points 表） */
export function findSemesterByWeakPointId(ctx: S4Context, weakPointId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db.prepare("SELECT 1 FROM weak_points WHERE id = @id").get({ id: weakPointId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该薄弱点");
}

/** 通过 courseId 定位 semester.db（course_instances 表） */
export function findSemesterByCourseId(ctx: S4Context, courseId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare("SELECT 1 FROM course_instances WHERE id = @id AND deleted_at IS NULL")
      .get({ id: courseId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该课程");
}
