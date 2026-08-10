/**
 * T-M1-003 S3 跨库查找（course/session → semester.db 定位）
 *
 * 复用 S1/S2 模式：遍历非 archived 学期库定位实体所属 semester.db。
 */
import type { S3Context } from "./context";
import type { DatabaseSync } from "../../../data/sqlite";
import { badRequest, notFound } from "./errors";

export interface SemDbRef {
  db: DatabaseSync;
  semesterId: string;
}

/** 归档学期仍可读，但 S3 创建/提交等写操作必须在 host 侧拒绝。 */
export function assertSemesterWritable(ctx: S3Context, semesterId: string): void {
  const row = ctx.globalDb
    .prepare("SELECT status FROM semesters WHERE id = @id AND deleted_at IS NULL")
    .get({ id: semesterId }) as { status?: string } | undefined;
  if (row?.status === "archived") {
    throw badRequest("归档学期为只读，不能创建或提交练习");
  }
}

/** 所有 moduleIds 必须属于当前 courseId，避免跨课程事实写入。 */
export function assertModulesBelongToCourse(db: DatabaseSync, courseId: string, moduleIds: string[]): void {
  for (const moduleId of moduleIds) {
    const row = db
      .prepare("SELECT 1 FROM knowledge_modules WHERE id = @moduleId AND course_instance_id = @courseId AND deleted_at IS NULL")
      .get({ moduleId, courseId });
    if (!row) {
      throw badRequest("知识模块不属于当前课程，无法创建练习");
    }
  }
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
