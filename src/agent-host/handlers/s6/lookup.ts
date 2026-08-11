/**
 * T-M2-002 S6 跨库查找（reportKey → semester.db 定位）
 *
 * 复用 S1-S5 模式：遍历非 archived 学期库定位 parent_reports 所属 semester.db。
 */
import type { S6Context } from "./context";
import type { DatabaseSync } from "../../../data/sqlite";
import { badRequest, notFound } from "./errors";

export interface SemDbRef {
  db: DatabaseSync;
  semesterId: string;
}

/** 归档学期仍可读，但报告生成/投递/目标写操作必须在 host 侧拒绝（对齐 S3/S5 assertSemesterWritable 模式）。 */
export function assertSemesterWritable(ctx: S6Context, semesterId: string): void {
  const row = ctx.globalDb
    .prepare("SELECT status FROM semesters WHERE id = @id AND deleted_at IS NULL")
    .get({ id: semesterId }) as { status?: string } | undefined;
  if (row?.status === "archived") {
    throw badRequest("归档学期为只读，不能生成或投递报告");
  }
}

function activeSemesterIds(ctx: S6Context): string[] {
  return (ctx.globalDb
    .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL ORDER BY created_at DESC")
    .all() as Array<{ id: string }>).map((r) => r.id);
}

/** 通过 reportKey 定位 semester.db（parent_reports 表） */
export function findSemesterByReportKey(ctx: S6Context, reportKey: string): SemDbRef {
  for (const sid of activeSemesterIds(ctx)) {
    const db = ctx.semesterDb(sid);
    const row = db
      .prepare("SELECT 1 FROM parent_reports WHERE report_key = @rk")
      .get({ rk: reportKey });
    if (row) return { db, semesterId: sid };
  }
  throw notFound("未找到该家长报告");
}

/** 通过 semesterId 校验学期存在（global.db） */
export function assertSemesterExists(ctx: S6Context, semesterId: string): void {
  const row = ctx.globalDb
    .prepare("SELECT 1 FROM semesters WHERE id = @id AND deleted_at IS NULL")
    .get({ id: semesterId });
  if (!row) throw notFound("未找到该学期");
}
