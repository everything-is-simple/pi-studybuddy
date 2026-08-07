/**
 * T-M2-001 S5 handler DTO 映射（05-ERD §3.5 → contract/types.ts DTO）
 *
 * 把 db 行（snake_case）映射为 DTO（camelCase），对齐 05-ERD §3.5 五表 schema 字段。
 * getPaper 防泄露：mapQuestionForStudent 不含 correct_answer/acceptable_answers/explanation。
 */
import type {
  QuestionType,
  QuestionDTO,
  MockExamPaper,
  MockExamAttempt,
  MockExamResult,
  MockExamModuleAnalysis,
} from "../../../contract/types";

type Row = Record<string, unknown>;

/** 作答前 DTO（防泄露）：不含 correct_answer/acceptable_answers/explanation */
export function mapQuestionForStudent(r: Row): QuestionDTO {
  return {
    id: r.id as string,
    questionType: r.question_type as QuestionType,
    questionStem: r.question_stem as string,
    options: parseJsonArray(r.options_json) as string[] | undefined,
    score: r.score as number,
  };
}

/** mapPaper：mock_exam_papers 行 + questions 行数组 → MockExamPaper DTO（questions 防泄露） */
export function mapPaper(paperRow: Row, questionRows: Row[]): MockExamPaper {
  return {
    id: paperRow.id as string,
    courseInstanceId: paperRow.course_instance_id as string,
    assessmentAttemptId: paperRow.assessment_attempt_id as string,
    paperTitle: paperRow.paper_title as string,
    questionCount: paperRow.question_count as number,
    timeLimitMinutes: (paperRow.time_limit_minutes as number) ?? undefined,
    totalScore: paperRow.total_score as number,
    sourceHash: paperRow.source_hash as string,
    aiModel: paperRow.ai_model as string,
    promptVersion: paperRow.prompt_version as string,
    generatedAt: paperRow.generated_at as string,
    createdAt: paperRow.created_at as string,
    questions: questionRows.map(mapQuestionForStudent),
  };
}

/** mapAttempt：mock_exam_attempts 行 → MockExamAttempt DTO */
export function mapAttempt(r: Row): MockExamAttempt {
  return {
    id: r.id as string,
    paperId: r.mock_paper_id as string,
    courseInstanceId: r.course_instance_id as string,
    status: r.status as MockExamAttempt["status"],
    startedAt: r.started_at as string,
    submittedAt: (r.submitted_at as string) ?? undefined,
    gradedAt: (r.graded_at as string) ?? undefined,
    totalScore: (r.total_score as number) ?? undefined,
    maxScore: (r.max_score as number) ?? undefined,
    correctCount: (r.correct_count as number) ?? undefined,
    durationMs: (r.duration_ms as number) ?? undefined,
    createdAt: r.created_at as string,
  };
}

/** mapModuleAnalysis：mock_exam_module_analyses 行 → MockExamModuleAnalysis DTO */
export function mapModuleAnalysis(r: Row): MockExamModuleAnalysis {
  return {
    moduleId: r.knowledge_module_id as string,
    totalQuestions: r.total_questions as number,
    correctCount: r.correct_count as number,
    correctRate: r.accuracy_rate as number,
    strength: r.weakness_level as MockExamModuleAnalysis["strength"],
  };
}

/** mapResult：attempt 行 + module_analyses 行数组 → MockExamResult DTO */
export function mapResult(attemptRow: Row, analysisRows: Row[]): MockExamResult {
  const totalScore = (attemptRow.total_score as number) ?? 0;
  const maxScore = (attemptRow.max_score as number) ?? 0;
  const correctCount = (attemptRow.correct_count as number) ?? 0;
  const durationMs = (attemptRow.duration_ms as number) ?? 0;
  return {
    attemptId: attemptRow.id as string,
    totalScore,
    maxScore,
    correctCount,
    correctRate: maxScore > 0 ? totalScore / maxScore : 0,
    elapsedMs: durationMs,
    moduleAnalyses: analysisRows.map(mapModuleAnalysis),
  };
}

function parseJsonArray(json: unknown): unknown[] | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json as string);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}
