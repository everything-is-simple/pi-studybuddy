/**
 * T-M1-004 S4 handler DTO 映射（05-ERD §3.4 → contract/types.ts DTO）
 *
 * 把 db 行（snake_case）映射为 DTO（camelCase），对齐 05-ERD §3.4 三表 schema 字段。
 */
import type {
  ErrorCategory,
  Mistake,
  MistakeEvidence,
  MistakeWithEvidence,
  WeakPoint,
} from "../../../contract/types";

type Row = Record<string, unknown>;

/** 映射 mistakes 行 → Mistake DTO（不含 evidence） */
export function mapMistake(r: Row): Mistake {
  return {
    id: r.id as string,
    questionId: r.question_id as string,
    courseId: r.course_instance_id as string,
    knowledgeModuleId: (r.knowledge_module_id as string) ?? undefined,
    practiceAnswerId: undefined, // 便利字段，需从 evidence 派生；list 不带
    status: r.status as Mistake["status"],
    errorCategory: (r.error_cause_category as ErrorCategory) ?? undefined,
    errorCause: (r.error_cause as string) ?? undefined,
    errorCauseConfirmedBy: (r.error_cause_confirmed_by as string) ?? undefined,
    errorCauseAiSuggestion: (r.error_cause_ai_suggestion as string) ?? undefined,
    redoCount: r.redo_count as number,
    lastRedoCorrect: (r.last_redo_correct as number | null) ?? undefined,
    masteredAt: (r.mastered_at as string | null) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

/** 映射 mistake_evidence 行 → MistakeEvidence DTO */
export function mapEvidence(r: Row): MistakeEvidence {
  return {
    id: r.id as string,
    mistakeId: r.mistake_id as string,
    sourcePracticeAnswerId: r.source_practice_answer_id as string,
    evidenceType: r.evidence_type as MistakeEvidence["evidenceType"],
    recordedAt: r.recorded_at as string,
    createdAt: r.created_at as string,
  };
}

/** 映射 mistakes 行 + evidence 行列表 → MistakeWithEvidence DTO */
export function mapMistakeWithEvidence(mistakeRow: Row, evidenceRows: Row[]): MistakeWithEvidence {
  const mistake = mapMistake(mistakeRow);
  const evidence = evidenceRows.map(mapEvidence);
  // 便利字段：取首条 initial_wrong evidence 的 source_practice_answer_id
  const firstInitial = evidence.find((e) => e.evidenceType === "initial_wrong");
  return {
    ...mistake,
    practiceAnswerId: firstInitial?.sourcePracticeAnswerId,
    evidence,
  };
}

/** 映射 weak_points 行 → WeakPoint DTO */
export function mapWeakPoint(r: Row): WeakPoint {
  return {
    id: r.id as string,
    courseId: r.course_instance_id as string,
    moduleId: r.knowledge_module_id as string,
    status: r.status as WeakPoint["status"],
    evidenceCount: r.evidence_count as number,
    firstEvidencedAt: r.first_evidenced_at as string,
    lastEvidencedAt: r.last_evidenced_at as string,
    resolvedAt: (r.resolved_at as string | null) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
