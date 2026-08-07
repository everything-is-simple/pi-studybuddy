/**
 * T-M1-004 S4 薄弱点 handler（06-API §3.6 weakPoints.* + 07-WF §2.5）
 *
 * 4 方法：list / get / resolve / regress
 *
 * 状态机（07-WF §8.7）：active → resolved → regressed
 *   - resolve：active→resolved（可回退）
 *   - regress：resolved→regressed（"已掌握"非终态）
 *
 * 关键约束：
 *   - resolve：仅 active 可 resolve；resolved 重复 resolve 拒绝
 *   - regress：仅 resolved 可 regress；active 直接 regress 拒绝
 */
import type { WeakPoint } from "../../../contract/types";
import type { SqlParams } from "../../../data/sqlite";
import type { S4Context } from "./context";
import { mapWeakPoint } from "./dto";
import { notFound, badRequest } from "./errors";
import { findSemesterByWeakPointId } from "./lookup";

function now(): string {
  return new Date().toISOString();
}

export function createWeakPointHandlers(ctx: S4Context) {
  return {
    "weakPoints.list": (params: unknown): WeakPoint[] => {
      const { courseId, status } = (params ?? {}) as {
        courseId?: string;
        status?: string;
      };

      const collect = (db: ReturnType<typeof ctx.semesterDb>): WeakPoint[] => {
        let sql = "SELECT * FROM weak_points";
        const conditions: string[] = [];
        const args: SqlParams = {};
        if (courseId) {
          conditions.push("course_instance_id = @cid");
          args.cid = courseId;
        }
        if (status) {
          conditions.push("status = @status");
          args.status = status;
        }
        if (conditions.length > 0) {
          sql += " WHERE " + conditions.join(" AND ");
        }
        sql += " ORDER BY last_evidenced_at DESC";
        const rows = db.prepare(sql).all(args) as Record<string, unknown>[];
        return rows.map(mapWeakPoint);
      };

      if (courseId) {
        // 通过 courseId 定位 semester.db
        for (const sid of (
          ctx.globalDb
            .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL")
            .all() as Array<{ id: string }>
        )) {
          const db = ctx.semesterDb(sid.id);
          const row = db
            .prepare("SELECT 1 FROM course_instances WHERE id = @id AND deleted_at IS NULL")
            .get({ id: courseId });
          if (row) return collect(db);
        }
        throw notFound("未找到该课程");
      }

      // 无 courseId：遍历所有学期库
      const result: WeakPoint[] = [];
      const semesters = ctx.globalDb
        .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL")
        .all() as Array<{ id: string }>;
      for (const s of semesters) {
        const db = ctx.semesterDb(s.id);
        result.push(...collect(db));
      }
      return result;
    },

    "weakPoints.get": (params: unknown): WeakPoint => {
      const { id } = params as { id: string };
      const { db } = findSemesterByWeakPointId(ctx, id);

      const row = db.prepare("SELECT * FROM weak_points WHERE id = @id").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!row) throw notFound("未找到该薄弱点");

      return mapWeakPoint(row);
    },

    "weakPoints.resolve": (params: unknown): WeakPoint => {
      const { id } = params as { id: string };
      const { db } = findSemesterByWeakPointId(ctx, id);

      const row = db.prepare("SELECT * FROM weak_points WHERE id = @id").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!row) throw notFound("未找到该薄弱点");

      const status = row.status as string;
      // 状态机：仅 active 可 resolve
      if (status !== "active") {
        throw badRequest(`薄弱点当前状态 ${status} 不允许 resolve，仅 active 可 resolve`);
      }

      const ts = now();
      db.prepare(
        `UPDATE weak_points SET status = 'resolved', resolved_at = @ts, updated_at = @ts WHERE id = @id`,
      ).run({ ts, id });

      const updated = db.prepare("SELECT * FROM weak_points WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapWeakPoint(updated);
    },

    "weakPoints.regress": (params: unknown): WeakPoint => {
      const { id } = params as { id: string };
      const { db } = findSemesterByWeakPointId(ctx, id);

      const row = db.prepare("SELECT * FROM weak_points WHERE id = @id").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!row) throw notFound("未找到该薄弱点");

      const status = row.status as string;
      // 状态机：仅 resolved 可 regress（"已掌握"非终态，可回退）
      if (status !== "resolved") {
        throw badRequest(`薄弱点当前状态 ${status} 不允许 regress，仅 resolved 可 regress`);
      }

      const ts = now();
      db.prepare(
        `UPDATE weak_points SET status = 'regressed', updated_at = @ts WHERE id = @id`,
      ).run({ ts, id });

      const updated = db.prepare("SELECT * FROM weak_points WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapWeakPoint(updated);
    },
  };
}
