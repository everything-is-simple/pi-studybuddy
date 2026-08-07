/**
 * T-M1-004 S4 错题 handler（06-API §3.6 mistakes.* + 07-WF §2.5）
 *
 * 6 方法：list / get / confirmErrorCause / suggestErrorCause / redo / archive
 *
 * 状态机（07-WF §8.6）：needs_review ↔ mastered
 *   - archive：新建 mistake(status=needs_review)
 *   - redo 正确 → mastered（evidence_count≥2 可能归纳 weak_point）
 *   - redo 错误 → 保持 needs_review（mastered 状态回退）
 *
 * 关键约束：
 *   - archive：幂等归档（UNIQUE question_id + UNIQUE source_practice_answer_id）
 *     先查 question_id 是否已有 mistake；有则追加 evidence；无则新建 mistake
 *   - archive：S4 只读 S3 事实（通过 practiceAnswerId 查 practice_answers.is_correct=0），不反写 S3
 *   - confirmErrorCause：六分类 + error_cause_confirmed_by='student' + 写 study_events
 *   - suggestErrorCause：可注入 ErrorCauseAdvisor（默认 mock 带"不确定"标记）；AI 失败→INTERNAL_ERROR 降级
 *   - redo：重做正确→evidence(initial_wrong=null)+redo_count+++last_redo_correct=1+归纳weak_point+mastered；
 *           重做错误→evidence(redo_wrong)+保持needs_review
 */
import { randomUUID } from "node:crypto";
import type {
  Mistake,
  MistakeWithEvidence,
  RedoResult,
  ErrorCategory,
} from "../../../contract/types";
import type { SqlParams } from "../../../data/sqlite";
import type { S4Context } from "./context";
import type { ErrorCauseContext } from "./error-cause-advisor";
import { mapMistake, mapMistakeWithEvidence } from "./dto";
import { notFound, badRequest, internalError } from "./errors";
import {
  findSemesterByMistakeId,
  findSemesterByPracticeAnswerId,
} from "./lookup";
import {
  writeMistakeArchivedEvent,
  writeErrorCauseConfirmedEvent,
  writePracticeReviewedEvent,
} from "./events";
import { aggregateWeakPointIfEligible } from "./aggregator";

function now(): string {
  return new Date().toISOString();
}

const VALID_CATEGORIES: ErrorCategory[] = [
  "concept_unclear",
  "misread",
  "formula_error",
  "step_missing",
  "time_pressure",
  "other",
];

export function createMistakeHandlers(ctx: S4Context) {
  return {
    "mistakes.list": (params: unknown): Mistake[] => {
      const { courseId, status } = (params ?? {}) as {
        courseId?: string;
        status?: string;
      };

      const collect = (db: ReturnType<typeof ctx.semesterDb>): Mistake[] => {
        let sql = "SELECT * FROM mistakes";
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
        sql += " ORDER BY created_at DESC";
        const rows = db.prepare(sql).all(args) as Record<string, unknown>[];
        return rows.map(mapMistake);
      };

      if (courseId) {
        // 通过 courseId 定位 semester.db（course_instances 表）
        for (const sid of (
          ctx.globalDb
            .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL")
            .all() as Array<{ id: string }>
        )) {
          const db = ctx.semesterDb(sid.id);
          const row = db
            .prepare("SELECT 1 FROM course_instances WHERE id = @id AND deleted_at IS NULL")
            .get({ id: courseId }) as Record<string, unknown> | undefined;
          if (row) return collect(db);
        }
        throw notFound("未找到该课程");
      }

      // 无 courseId：遍历所有学期库
      const result: Mistake[] = [];
      const semesters = ctx.globalDb
        .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL")
        .all() as Array<{ id: string }>;
      for (const s of semesters) {
        const db = ctx.semesterDb(s.id);
        result.push(...collect(db));
      }
      return result;
    },

    "mistakes.get": (params: unknown): MistakeWithEvidence => {
      const { id } = params as { id: string };
      const { db } = findSemesterByMistakeId(ctx, id);

      const mistakeRow = db.prepare("SELECT * FROM mistakes WHERE id = @id").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!mistakeRow) throw notFound("未找到该错题");

      const evidenceRows = db
        .prepare("SELECT * FROM mistake_evidence WHERE mistake_id = @id ORDER BY recorded_at")
        .all({ id }) as Record<string, unknown>[];

      return mapMistakeWithEvidence(mistakeRow, evidenceRows);
    },

    "mistakes.archive": (params: unknown): Mistake => {
      const { practiceAnswerId } = params as { practiceAnswerId: string };
      const { db, semesterId } = findSemesterByPracticeAnswerId(ctx, practiceAnswerId);

      // S4 只读 S3 事实：查 practice_answers（必须 is_correct=0）
      const answerRow = db
        .prepare("SELECT * FROM practice_answers WHERE id = @id")
        .get({ id: practiceAnswerId }) as Record<string, unknown> | undefined;
      if (!answerRow) throw notFound("未找到该练习答题记录");

      if ((answerRow.is_correct as number) !== 0) {
        throw badRequest("该答题正确，无需归档为错题");
      }

      const questionId = answerRow.question_id as string;
      const courseId = answerRow.course_instance_id as string;
      const ts = now();

      // 幂等归档：先查 question_id 是否已有 mistake
      const existing = db
        .prepare("SELECT * FROM mistakes WHERE question_id = @qid")
        .get({ qid: questionId }) as Record<string, unknown> | undefined;

      let mistakeId: string;

      if (existing) {
        // 已有 mistake → 追加 mistake_evidence（UNIQUE source_practice_answer_id 防重复）
        mistakeId = existing.id as string;
        const evidenceId = randomUUID();
        try {
          db.prepare(
            `INSERT INTO mistake_evidence
              (id, mistake_id, source_practice_answer_id, evidence_type, recorded_at, created_at)
             VALUES (@id, @mid, @paid, 'initial_wrong', @ts, @ts)`,
          ).run({
            id: evidenceId,
            mid: mistakeId,
            paid: practiceAnswerId,
            ts,
          });
        } catch {
          // UNIQUE(source_practice_answer_id) 冲突 → 重复归档同一答题，幂等返回已有 mistake
          return mapMistake(existing);
        }
      } else {
        // 没有 mistake → 新建（触发器 T2/T6 校验 question.course/module 一致）
        mistakeId = randomUUID();
        const questionRow = db
          .prepare("SELECT * FROM questions WHERE id = @qid")
          .get({ qid: questionId }) as Record<string, unknown> | undefined;
        const moduleId = questionRow?.knowledge_module_id as string | null;

        // 注意：trg_mistake_idempotent_archive 会在 question_id 已存在时 ABORT
        // 因此先查后插的模式是安全的（不会触发 ABORT）
        db.prepare(
          `INSERT INTO mistakes
            (id, question_id, course_instance_id, knowledge_module_id,
             status, redo_count, created_at, updated_at)
           VALUES (@id, @qid, @cid, @mid, 'needs_review', 0, @ts, @ts)`,
        ).run({
          id: mistakeId,
          qid: questionId,
          cid: courseId,
          mid: moduleId ?? null,
          ts,
        });

        // 写首条 evidence（initial_wrong）
        const evidenceId = randomUUID();
        db.prepare(
          `INSERT INTO mistake_evidence
            (id, mistake_id, source_practice_answer_id, evidence_type, recorded_at, created_at)
           VALUES (@id, @mid, @paid, 'initial_wrong', @ts, @ts)`,
        ).run({
          id: evidenceId,
          mid: mistakeId,
          paid: practiceAnswerId,
          ts,
        });
      }

      // 写 study_events（mistake_archived, source_system='S4'）
      writeMistakeArchivedEvent(db, semesterId, courseId, mistakeId);

      const row = db.prepare("SELECT * FROM mistakes WHERE id = @id").get({ id: mistakeId }) as Record<string, unknown>;
      return mapMistake(row);
    },

    "mistakes.suggestErrorCause": (params: unknown): {
      suggestion: string;
      confidence: "low" | "medium" | "high";
    } => {
      const { id } = params as { id: string };
      const { db } = findSemesterByMistakeId(ctx, id);

      const mistakeRow = db.prepare("SELECT * FROM mistakes WHERE id = @id").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!mistakeRow) throw notFound("未找到该错题");

      const questionId = mistakeRow.question_id as string;
      const questionRow = db
        .prepare("SELECT * FROM questions WHERE id = @qid")
        .get({ qid: questionId }) as Record<string, unknown> | undefined;
      if (!questionRow) throw notFound("错题关联的题目不存在");

      // 查学生答案（从 evidence 的 source_practice_answer_id 取最近一条）
      const evidenceRows = db
        .prepare(
          "SELECT * FROM mistake_evidence WHERE mistake_id = @id ORDER BY recorded_at DESC LIMIT 1",
        )
        .all({ id }) as Record<string, unknown>[];
      const latestEvidence = evidenceRows[0];
      let studentAnswer: unknown = null;
      const correctAnswer: unknown = questionRow.correct_answer;
      let acceptableAnswers: string[] | undefined;
      if (latestEvidence) {
        const answerRow = db
          .prepare("SELECT * FROM practice_answers WHERE id = @aid")
          .get({ aid: latestEvidence.source_practice_answer_id as string }) as
          | Record<string, unknown>
          | undefined;
        if (answerRow) {
          const ansStr = answerRow.student_answer as string | null;
          if (ansStr) {
            try {
              studentAnswer = JSON.parse(ansStr);
            } catch {
              studentAnswer = ansStr;
            }
          }
        }
      }
      const acceptRaw = questionRow.acceptable_answers_json as string | null;
      if (acceptRaw) {
        try {
          acceptableAnswers = JSON.parse(acceptRaw) as string[];
        } catch {
          acceptableAnswers = undefined;
        }
      }

      const advisorCtx: ErrorCauseContext = {
        mistakeId: id,
        questionStem: questionRow.question_stem as string,
        questionType: questionRow.question_type as string,
        studentAnswer,
        correctAnswer,
        acceptableAnswers,
        explanation: (questionRow.explanation as string) ?? undefined,
      };

      // 调用 ErrorCauseAdvisor（可注入，默认 mock）
      try {
        const suggestion = ctx.errorCauseAdvisor.suggest(advisorCtx);
        // 把 AI 建议写入 mistakes.error_cause_ai_suggestion（带"不确定"标记）
        db.prepare("UPDATE mistakes SET error_cause_ai_suggestion = @sug, updated_at = @ts WHERE id = @id").run({
          sug: suggestion.suggestion,
          ts: now(),
          id,
        });
        return {
          suggestion: suggestion.suggestion,
          confidence: suggestion.confidence,
        };
      } catch {
        // AI 失败降级：返回 INTERNAL_ERROR + 提示手动选择，不阻塞学生手动确认
        throw internalError("AI 建议暂时不可用，请手动选择错因");
      }
    },

    "mistakes.confirmErrorCause": (params: unknown): Mistake => {
      const { id, category, causeNote } = params as {
        id: string;
        category: ErrorCategory;
        causeNote?: string;
      };

      // 六分类校验（05-ERD §3.4.1 CHECK）
      if (!VALID_CATEGORIES.includes(category)) {
        throw badRequest(`错因分类无效，必须为六分类之一：${VALID_CATEGORIES.join("/")}`);
      }

      const { db, semesterId } = findSemesterByMistakeId(ctx, id);
      const mistakeRow = db.prepare("SELECT * FROM mistakes WHERE id = @id").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!mistakeRow) throw notFound("未找到该错题");

      const ts = now();
      // error_cause_confirmed_by='student'（学生必须确认）
      // causeNote 映射到 error_cause 列（错因正文）
      db.prepare(
        `UPDATE mistakes
         SET error_cause_category = @cat,
             error_cause = @cause,
             error_cause_confirmed_by = 'student',
             updated_at = @ts
         WHERE id = @id`,
      ).run({
        cat: category,
        cause: causeNote ?? null,
        ts,
        id,
      });

      // 写 study_events（error_cause_confirmed, source_system='S4'）
      writeErrorCauseConfirmedEvent(
        db,
        semesterId,
        mistakeRow.course_instance_id as string,
        id,
      );

      const row = db.prepare("SELECT * FROM mistakes WHERE id = @id").get({ id }) as Record<string, unknown>;
      return mapMistake(row);
    },

    "mistakes.redo": (params: unknown): RedoResult => {
      const { id } = params as { id: string };
      const { db, semesterId } = findSemesterByMistakeId(ctx, id);

      const mistakeRow = db.prepare("SELECT * FROM mistakes WHERE id = @id").get({ id }) as
        | Record<string, unknown>
        | undefined;
      if (!mistakeRow) throw notFound("未找到该错题");

      const courseId = mistakeRow.course_instance_id as string;
      const ts = now();

      // MVP 原题重做：支持 params.correct?: boolean 注入重做结果
      // 实际应由 UI 传入学生重做答案 + 规则批改，MVP 简化为 mock
      const { correct } = params as { id: string; correct?: boolean };
      const isCorrect = correct ?? false;

      // 当前 evidence_count（重做前）
      let evidenceCount = (db
        .prepare("SELECT COUNT(*) as cnt FROM mistake_evidence WHERE mistake_id = @mid")
        .get({ mid: id }) as { cnt: number }).cnt;

      if (!isCorrect) {
        // 重做错误 → 追加 redo_wrong evidence（source_practice_answer_id=NULL，不依赖新答题）
        // + 保持 needs_review（mastered 回退）
        const evidenceId = randomUUID();
        db.prepare(
          `INSERT INTO mistake_evidence
            (id, mistake_id, source_practice_answer_id, evidence_type, recorded_at, created_at)
           VALUES (@id, @mid, NULL, 'redo_wrong', @ts, @ts)`,
        ).run({
          id: evidenceId,
          mid: id,
          ts,
        });
        evidenceCount = (db
          .prepare("SELECT COUNT(*) as cnt FROM mistake_evidence WHERE mistake_id = @mid")
          .get({ mid: id }) as { cnt: number }).cnt;

        // mastered → needs_review 回退（"已掌握"非终态）
        db.prepare(
          `UPDATE mistakes
           SET status = 'needs_review',
               last_redo_correct = 0,
               mastered_at = NULL,
               redo_count = redo_count + 1,
               updated_at = @ts
           WHERE id = @id`,
        ).run({ ts, id });
      } else {
        // 重做正确 → redo_count++ + last_redo_correct=1 + 若 evidence_count≥2 归纳 weak_point + mastered
        db.prepare(
          `UPDATE mistakes
           SET redo_count = redo_count + 1,
               last_redo_correct = 1,
               updated_at = @ts
           WHERE id = @id`,
        ).run({ ts, id });
      }

      // 薄弱点归纳：evidence_count≥2 才形成
      let weakPointFormed = false;
      if (isCorrect && evidenceCount >= 2) {
        weakPointFormed = aggregateWeakPointIfEligible(db, semesterId, mistakeRow);
      }

      // 重做正确 → status=mastered + mastered_at
      if (isCorrect) {
        db.prepare(
          `UPDATE mistakes SET status = 'mastered', mastered_at = @ts, updated_at = @ts WHERE id = @id`,
        ).run({ ts, id });
      }

      // 写 study_events（practice_reviewed, source_system='S4'）
      writePracticeReviewedEvent(db, semesterId, courseId, id);

      return {
        mistakeId: id,
        correct: isCorrect,
        evidenceCount,
        weakPointFormed,
        updatedAt: ts,
      };
    },
  };
}
