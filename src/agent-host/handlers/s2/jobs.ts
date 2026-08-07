/**
 * T-M1-002 S2 作业查询 handler（06-API §3.4 jobs.*）
 *
 * 2 方法：get / list
 * 状态机：pending → running → completed / failed（本任务 Job 仅登记为 pending，转换器/AI 未实现）
 */
import type { Job } from "../../../contract/types";
import type { S2Context } from "./context";
import { mapJob } from "./dto";
import { notFound } from "./errors";
import { findSemesterByJobId } from "./lookup";
import type { SqlParams } from "../../../data/sqlite";

export function createJobHandlers(ctx: S2Context) {
  return {
    "jobs.get": (params: unknown): Job => {
      const { id } = params as { id: string };
      const { db } = findSemesterByJobId(ctx, id);
      const row = db.prepare("SELECT * FROM jobs WHERE id = @id").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!row) throw notFound("未找到该作业，请检查是否已删除");
      return mapJob(row);
    },

    "jobs.list": (params: unknown): Job[] => {
      const { materialId, status } = (params ?? {}) as { materialId?: string; status?: string };

      if (materialId) {
        // 通过 materialId 定位 semester.db
        const semesters = ctx.globalDb
          .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL")
          .all() as Array<{ id: string }>;
        for (const s of semesters) {
          const db = ctx.semesterDb(s.id);
          const materialRow = db.prepare("SELECT 1 FROM materials WHERE id = @id").get({ id: materialId });
          if (materialRow) {
            return queryJobs(db, { materialId, status });
          }
        }
        return [];
      }

      // 无 materialId：遍历所有学期库
      const result: Job[] = [];
      const semesters = ctx.globalDb
        .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL")
        .all() as Array<{ id: string }>;
      for (const s of semesters) {
        const db = ctx.semesterDb(s.id);
        result.push(...queryJobs(db, { status }));
      }
      return result;
    },
  };
}

function queryJobs(
  db: import("../../../data/sqlite").DatabaseSync,
  opts: { materialId?: string; status?: string },
): Job[] {
  const conditions: string[] = [];
  const values: SqlParams = {};
  if (opts.materialId) {
    conditions.push("material_id = @mid");
    values.mid = opts.materialId;
  }
  if (opts.status) {
    conditions.push("status = @status");
    values.status = opts.status;
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM jobs ${where} ORDER BY created_at DESC`)
    .all(values) as Record<string, unknown>[];
  return rows.map(mapJob);
}
