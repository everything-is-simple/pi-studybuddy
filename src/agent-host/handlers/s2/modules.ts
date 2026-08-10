/**
 * T-M1-002 S2 知识模块 handler（06-API §3.4 modules.* + 07-WF §2.3）
 *
 * 3 方法：list / get / updateLearnStatus
 * modules.get 含 source_evidence_json 回链（02-PRD §3.3 降低幻觉关键约束）
 * updateLearnStatus 状态机：not_started → learning → mastered → needs_review（任意顺序迁移，非严格线性）
 */
import type { KnowledgeModule, LearnStatus } from "../../../contract/types";
import type { S2Context } from "./context";
import { mapModule } from "./dto";
import { notFound, badRequest } from "./errors";
import { assertSemesterWritable, findSemesterByCourseId, findSemesterByModuleId } from "./lookup";
import type { SqlParams } from "../../../data/sqlite";

const VALID_LEARN_STATUS: LearnStatus[] = ["not_started", "learning", "mastered", "needs_review"];

function now(): string {
  return new Date().toISOString();
}

export function createModuleHandlers(ctx: S2Context) {
  return {
    "modules.list": (params: unknown): KnowledgeModule[] => {
      const { courseId, learnStatus } = (params ?? {}) as { courseId?: string; learnStatus?: string };

      if (courseId) {
        const { db } = findSemesterByCourseId(ctx, courseId);
        return queryModules(db, { courseId, learnStatus });
      }

      // 无 courseId：遍历所有学期库
      const result: KnowledgeModule[] = [];
      const semesters = ctx.globalDb
        .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL")
        .all() as Array<{ id: string }>;
      for (const s of semesters) {
        const db = ctx.semesterDb(s.id);
        result.push(...queryModules(db, { learnStatus }));
      }
      return result;
    },

    "modules.get": (params: unknown): KnowledgeModule => {
      const { id } = params as { id: string };
      const { db } = findSemesterByModuleId(ctx, id);
      const row = db.prepare("SELECT * FROM knowledge_modules WHERE id = @id").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!row) throw notFound("未找到该知识模块，请检查是否已删除");
      return mapModule(row);
    },

    "modules.updateLearnStatus": (params: unknown): KnowledgeModule => {
      const { id, learnStatus } = params as { id: string; learnStatus: string };

      // 校验 learnStatus 合法值
      if (!VALID_LEARN_STATUS.includes(learnStatus as LearnStatus)) {
        throw badRequest(
          `非法学习状态 ${learnStatus}，合法值为 not_started/learning/mastered/needs_review`,
        );
      }

      const { db, semesterId } = findSemesterByModuleId(ctx, id);
      assertSemesterWritable(ctx, semesterId);
      const existing = db
        .prepare("SELECT * FROM knowledge_modules WHERE id = @id AND deleted_at IS NULL")
        .get({ id }) as Record<string, unknown> | undefined;
      if (!existing) throw notFound("未找到该知识模块，请检查是否已删除");

      const ts = now();
      db.prepare("UPDATE knowledge_modules SET learn_status = @status, updated_at = @ts WHERE id = @id").run({
        id,
        status: learnStatus,
        ts,
      });

      const row = db.prepare("SELECT * FROM knowledge_modules WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapModule(row);
    },
  };
}

function queryModules(
  db: import("../../../data/sqlite").DatabaseSync,
  opts: { courseId?: string; learnStatus?: string },
): KnowledgeModule[] {
  const conditions = ["deleted_at IS NULL"];
  const values: SqlParams = {};
  if (opts.courseId) {
    conditions.push("course_instance_id = @cid");
    values.cid = opts.courseId;
  }
  if (opts.learnStatus) {
    conditions.push("learn_status = @status");
    values.status = opts.learnStatus;
  }
  const rows = db
    .prepare(`SELECT * FROM knowledge_modules WHERE ${conditions.join(" AND ")} ORDER BY created_at`)
    .all(values) as Record<string, unknown>[];
  return rows.map(mapModule);
}
