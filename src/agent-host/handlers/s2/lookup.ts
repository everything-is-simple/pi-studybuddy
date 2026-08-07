/**
 * T-M1-002 S2 跨库查找（material/module/note → semester.db 定位）
 *
 * semester.db 按学期隔离，06-API §3.4 部分方法参数只有 id（如 materials.get），
 * 需遍历非 archived 学期库定位实体所属 semester.db。
 */
import type { S2Context } from "./context";
import type { DatabaseSync } from "../../../data/sqlite";
import { notFound } from "./errors";

export interface SemDbRef {
  db: DatabaseSync;
  semesterId: string;
}

function activeSemesterIds(ctx: S2Context): string[] {
  return (ctx.globalDb
    .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL ORDER BY created_at DESC")
    .all() as Array<{ id: string }>).map((r) => r.id);
}

/** 通过 courseId 定位 semester.db（与 S1 一致） */
export function findSemesterByCourseId(ctx: S2Context, courseId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare("SELECT 1 FROM course_instances WHERE id = @id AND deleted_at IS NULL")
      .get({ id: courseId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该课程，请检查是否已删除");
}

/** 通过 material_id 定位 semester.db（含已软删除的，供 get 查看软删除状态） */
export function findSemesterByMaterialId(ctx: S2Context, materialId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare("SELECT 1 FROM materials WHERE id = @id")
      .get({ id: materialId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该资料，请检查是否已删除");
}

/** 通过 knowledge_module_id 定位 semester.db */
export function findSemesterByModuleId(ctx: S2Context, moduleId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare("SELECT 1 FROM knowledge_modules WHERE id = @id AND deleted_at IS NULL")
      .get({ id: moduleId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该知识模块，请检查是否已删除");
}

/** 通过 job_id 定位 semester.db */
export function findSemesterByJobId(ctx: S2Context, jobId: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db.prepare("SELECT 1 FROM jobs WHERE id = @id").get({ id: jobId });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该作业，请检查是否已删除");
}
