/**
 * T-M2-001 S5 跨库查找（assessment_attempt / course / paper / attempt → semester.db 定位）
 *
 * 复用 S1/S2/S3/S4 模式：遍历非 archived 学期库定位实体所属 semester.db。
 */
import type { S5Context } from "./context";
import type { DatabaseSync } from "../../../data/sqlite";
import { notFound } from "./errors";

export interface SemDbRef {
  db: DatabaseSync;
  semesterId: string;
}

function activeSemesterIds(ctx: S5Context): string[] {
  return (ctx.globalDb
    .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL ORDER BY created_at DESC")
    .all() as Array<{ id: string }>).map((r) => r.id);
}

/** 通过 assessmentAttemptId 定位 semester.db（assessment_attempts 表） */
export function findSemesterByAssessmentAttemptId(
  ctx: S5Context,
  attemptId: string,
): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare("SELECT 1 FROM assessment_attempts WHERE id = @id")
      .get({ id: attemptId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该考试记录");
}

/** 通过 courseId 定位 semester.db（course_instances 表） */
export function findSemesterByCourseId(ctx: S5Context, courseId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare("SELECT 1 FROM course_instances WHERE id = @id AND deleted_at IS NULL")
      .get({ id: courseId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该课程");
}

/** 通过 paperId 定位 semester.db（mock_exam_papers 表） */
export function findSemesterByPaperId(ctx: S5Context, paperId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare("SELECT 1 FROM mock_exam_papers WHERE id = @id")
      .get({ id: paperId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该模拟卷");
}

/** 通过 attemptId 定位 semester.db（mock_exam_attempts 表） */
export function findSemesterByAttemptId(ctx: S5Context, attemptId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare("SELECT 1 FROM mock_exam_attempts WHERE id = @id")
      .get({ id: attemptId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该模拟考作答记录");
}
