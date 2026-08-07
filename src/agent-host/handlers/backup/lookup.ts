/**
 * T-M2-005 备份恢复跨库查找（courseId → semester.db 定位）
 *
 * 复用 S1-S7 模式：遍历非 archived 学期库定位 course_instances 所属 semester.db。
 */
import type { BackupContext } from "./context";
import type { DatabaseSync } from "../../../data/sqlite";
import { notFound, MSG } from "./errors";

export interface SemDbRef {
  db: DatabaseSync;
  semesterId: string;
}

function activeSemesterIds(ctx: BackupContext): string[] {
  return (ctx.globalDb
    .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL ORDER BY created_at DESC")
    .all() as Array<{ id: string }>).map((r) => r.id);
}

/** 通过 courseId 定位 semester.db（与 S1/S2/S7 一致模式） */
export function findSemesterByCourseId(ctx: BackupContext, courseId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare("SELECT 1 FROM course_instances WHERE id = @id AND deleted_at IS NULL")
      .get({ id: courseId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound(MSG.COURSE_NOT_FOUND);
}

/** 获取学期标签（用于 manifest.semester_label） */
export function getSemesterLabel(ctx: BackupContext, semesterId: string): string {
  const row = ctx.globalDb
    .prepare("SELECT semester_label FROM semesters WHERE id = @id")
    .get({ id: semesterId }) as { semester_label: string } | undefined;
  if (!row) throw notFound(MSG.SEMESTER_NOT_FOUND);
  return row.semester_label;
}

/** 获取课程名（用于 manifest.course_name + zip 文件名） */
export function getCourseName(db: DatabaseSync, courseId: string): string {
  const row = db
    .prepare("SELECT course_name FROM course_instances WHERE id = @id")
    .get({ id: courseId }) as { course_name: string } | undefined;
  if (!row) throw notFound(MSG.COURSE_NOT_FOUND);
  return row.course_name;
}

/** 获取学期下所有课程 ID（backup.allCourses 用） */
export function listCourseIdsBySemester(ctx: BackupContext, semesterId: string): string[] {
  const db = ctx.semesterDb(semesterId);
  return (db
    .prepare("SELECT id FROM course_instances WHERE deleted_at IS NULL ORDER BY created_at")
    .all() as Array<{ id: string }>).map((r) => r.id);
}
