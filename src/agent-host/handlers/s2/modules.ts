/**
 * T-M1-002 S2 知识模块 handler（06-API §3.4 modules.* + 07-WF §2.3）
 *
 * 4 方法：list / create / get / updateLearnStatus
 * modules.get 含 source_evidence_json 回链（02-PRD §3.3 降低幻觉关键约束）
 * updateLearnStatus 状态机：not_started → learning → mastered → needs_review（任意顺序迁移，非严格线性）
 */
import { randomUUID } from "node:crypto";
import type { KnowledgeModule, LearnStatus } from "../../../contract/types";
import type { S2Context } from "./context";
import { mapModule } from "./dto";
import { notFound, badRequest } from "./errors";
import { assertSemesterWritable, findSemesterByCourseId, findSemesterByMaterialId, findSemesterByModuleId } from "./lookup";
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

    "modules.create": (params: unknown): KnowledgeModule => {
      const { courseId, materialId, moduleName, summary, importance, difficulty } = (params ?? {}) as {
        courseId?: string;
        materialId?: string;
        moduleName?: string;
        summary?: string;
        importance?: number;
        difficulty?: number;
      };
      const normalizedCourseId = courseId?.trim();
      const normalizedMaterialId = materialId?.trim();
      const normalizedModuleName = moduleName?.trim();
      if (!normalizedCourseId || !normalizedMaterialId || !normalizedModuleName) {
        throw badRequest("创建知识模块必须提供课程、资料和模块名称");
      }
      if (summary !== undefined && typeof summary !== "string") {
        throw badRequest("知识模块摘要必须是文本");
      }
      for (const [label, value] of [["重要度", importance], ["难度", difficulty]] as const) {
        if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 5)) {
          throw badRequest(`${label}必须是 1 到 5 的整数`);
        }
      }

      const courseRef = findSemesterByCourseId(ctx, normalizedCourseId);
      const materialRef = findSemesterByMaterialId(ctx, normalizedMaterialId);
      if (courseRef.semesterId !== materialRef.semesterId) {
        throw badRequest("资料不属于当前课程，无法创建知识模块");
      }
      assertSemesterWritable(ctx, courseRef.semesterId);
      const material = courseRef.db
        .prepare("SELECT course_instance_id FROM materials WHERE id = @id AND deleted_at IS NULL")
        .get({ id: normalizedMaterialId }) as { course_instance_id: string } | undefined;
      if (!material) throw notFound("未找到该资料，请检查是否已删除");
      if (material.course_instance_id !== normalizedCourseId) {
        throw badRequest("资料不属于当前课程，无法创建知识模块");
      }

      const duplicate = courseRef.db
        .prepare("SELECT id FROM knowledge_modules WHERE material_id = @materialId AND module_name = @moduleName AND deleted_at IS NULL")
        .get({ materialId: normalizedMaterialId, moduleName: normalizedModuleName }) as { id: string } | undefined;
      if (duplicate) {
        throw badRequest("该资料下已存在同名知识模块，请修改模块名称");
      }

      const id = randomUUID();
      const ts = now();
      courseRef.db.prepare(`
        INSERT INTO knowledge_modules (
          id, course_instance_id, material_id, module_name, summary, importance, difficulty,
          learn_status, source_evidence_json, ai_generated, created_at, updated_at
        ) VALUES (
          @id, @courseId, @materialId, @moduleName, @summary, @importance, @difficulty,
          'not_started', @sourceEvidenceJson, 0, @ts, @ts
        )
      `).run({
        id,
        courseId: normalizedCourseId,
        materialId: normalizedMaterialId,
        moduleName: normalizedModuleName,
        summary: summary?.trim() || null,
        importance: importance ?? null,
        difficulty: difficulty ?? null,
        sourceEvidenceJson: JSON.stringify({ materialId: normalizedMaterialId }),
        ts,
      });
      const row = courseRef.db.prepare("SELECT * FROM knowledge_modules WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapModule(row);
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
