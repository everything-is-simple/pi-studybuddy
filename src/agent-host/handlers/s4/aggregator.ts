/**
 * T-M1-004 S4 薄弱点归纳器（07-WF §2.5 + 05-ERD §3.4.3）
 *
 * 私有模块：aggregateWeakPointIfEligible
 *
 * 归纳条件：
 *   1. evidence_count≥2（单次错误不形成永久薄弱点）
 *   2. UNIQUE(course_instance_id, knowledge_module_id)（同一课程+模块唯一薄弱点）
 *   3. 已有 weak_point 则更新 evidence_count + last_evidenced_at；无则新建
 *
 * 调用时机：mistakes.redo 重做正确后，若 evidence_count≥2 触发归纳
 */
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "../../../data/sqlite";

function now(): string {
  return new Date().toISOString();
}

/**
 * 若满足归纳条件，则创建或更新 weak_point。
 * @returns 是否触发了薄弱点归纳（新建或更新）
 */
export function aggregateWeakPointIfEligible(
  db: DatabaseSync,
  semesterId: string,
  mistakeRow: Record<string, unknown>,
): boolean {
  const courseId = mistakeRow.course_instance_id as string;
  const moduleId = mistakeRow.knowledge_module_id as string | null;

  // 无 module 无法归纳（weak_points.knowledge_module_id NOT NULL）
  if (!moduleId) return false;

  const mistakeId = mistakeRow.id as string;

  // 统计该 mistake 的 evidence_count
  const evidenceCountRow = db
    .prepare("SELECT COUNT(*) as cnt FROM mistake_evidence WHERE mistake_id = @mid")
    .get({ mid: mistakeId }) as { cnt: number };

  if (evidenceCountRow.cnt < 2) return false;

  const ts = now();

  // 查是否已有同 course+module 的 weak_point
  const existing = db
    .prepare(
      "SELECT * FROM weak_points WHERE course_instance_id = @cid AND knowledge_module_id = @mid",
    )
    .get({ cid: courseId, mid: moduleId }) as Record<string, unknown> | undefined;

  if (existing) {
    // 已有 → 更新 evidence_count + last_evidenced_at + status 回到 active（如已 resolved）
    db.prepare(
      `UPDATE weak_points
       SET evidence_count = evidence_count + 1,
           last_evidenced_at = @ts,
           status = 'active',
           resolved_at = NULL,
           updated_at = @ts
       WHERE id = @id`,
    ).run({ ts, id: existing.id as string });
    return true;
  }

  // 无 → 新建（触发器 T4 校验 module 属于 course；CHECK evidence_count≥2）
  const weakPointId = randomUUID();
  try {
    db.prepare(
      `INSERT INTO weak_points
        (id, course_instance_id, knowledge_module_id, evidence_count,
         status, first_evidenced_at, last_evidenced_at, created_at, updated_at)
       VALUES (@id, @cid, @mid, @cnt, 'active', @ts, @ts, @ts, @ts)`,
    ).run({
      id: weakPointId,
      cid: courseId,
      mid: moduleId,
      cnt: evidenceCountRow.cnt,
      ts,
    });
    return true;
  } catch {
    // 触发器拦截或 UNIQUE 冲突 → 不形成
    return false;
  }
}
