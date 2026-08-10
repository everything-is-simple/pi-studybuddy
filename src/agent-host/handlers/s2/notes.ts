/**
 * T-M1-002 S2 笔记与导图 handler（06-API §3.4 notes.* + 07-WF §2.3）
 *
 * 3 方法：get / update / getMindMap
 * notes.update 写 structured_notes（note_markdown + highlights_json）+ 更新 updated_at
 * notes.getMindMap 读 mind_maps（markmap_json 字符串）
 */
import { randomUUID } from "node:crypto";
import type { StructuredNote, MindMap } from "../../../contract/types";
import type { S2Context } from "./context";
import { mapNote, mapMindMap } from "./dto";
import { notFound } from "./errors";
import { assertSemesterWritable, findSemesterByMaterialId } from "./lookup";

function now(): string {
  return new Date().toISOString();
}

export function createNoteHandlers(ctx: S2Context) {
  return {
    "notes.get": (params: unknown): StructuredNote => {
      const { materialId } = params as { materialId: string };
      const { db } = findSemesterByMaterialId(ctx, materialId);
      const row = db
        .prepare("SELECT * FROM structured_notes WHERE material_id = @id")
        .get({ id: materialId }) as Record<string, unknown> | undefined;
      if (!row) throw notFound("未找到该资料的笔记，请先上传并转换资料");
      return mapNote(row);
    },

    "notes.update": (params: unknown): StructuredNote => {
      const { materialId, noteMarkdown, highlights } = params as {
        materialId: string;
        noteMarkdown: string;
        highlights?: Array<{ text: string; color?: string }>;
      };
      const { db, semesterId } = findSemesterByMaterialId(ctx, materialId);
      assertSemesterWritable(ctx, semesterId);

      const existing = db
        .prepare("SELECT * FROM structured_notes WHERE material_id = @id")
        .get({ id: materialId }) as Record<string, unknown> | undefined;
      const ts = now();
      const highlightsJson = JSON.stringify(highlights ?? []);

      if (existing) {
        db.prepare(
          `UPDATE structured_notes SET note_markdown = @md, highlights_json = @hj, updated_at = @ts WHERE material_id = @id`,
        ).run({ id: materialId, md: noteMarkdown, hj: highlightsJson, ts });
      } else {
        // 不存在则创建（学生手动新建笔记）—— 从 materials 表取 course_instance_id
        const materialRow = db
          .prepare("SELECT course_instance_id FROM materials WHERE id = @id")
          .get({ id: materialId }) as { course_instance_id: string } | undefined;
        if (!materialRow) throw notFound("未找到该资料，请检查是否已删除");
        db.prepare(
          `INSERT INTO structured_notes (id, material_id, course_instance_id, note_markdown, highlights_json, prompt_version, model, ai_generated, created_at, updated_at)
           VALUES (@id, @mid, @cid, @md, @hj, 'manual', 'student', 0, @ts, @ts)`,
        ).run({
          id: randomUUID(),
          mid: materialId,
          cid: materialRow.course_instance_id,
          md: noteMarkdown,
          hj: highlightsJson,
          ts,
        });
      }

      const row = db
        .prepare("SELECT * FROM structured_notes WHERE material_id = @id")
        .get({ id: materialId }) as Record<string, unknown>;
      return mapNote(row);
    },

    "notes.getMindMap": (params: unknown): MindMap => {
      const { materialId } = params as { materialId: string };
      const { db } = findSemesterByMaterialId(ctx, materialId);
      const row = db
        .prepare("SELECT * FROM mind_maps WHERE material_id = @id")
        .get({ id: materialId }) as Record<string, unknown> | undefined;
      if (!row) throw notFound("未找到该资料的思维导图，请先生成笔记");
      return mapMindMap(row);
    },
  };
}
