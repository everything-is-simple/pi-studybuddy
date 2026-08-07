/**
 * T-M1-003 S3 handler DTO 映射（05-ERD §3.3 → contract/types.ts DTO）
 *
 * 把 db 行（snake_case）映射为 DTO（camelCase），对齐 05-ERD §3.3 三表 schema 字段。
 * 作答前 DTO 防泄露：mapQuestionForStudent 不含 correct_answer/acceptable_answers/explanation。
 */
import type {
  QuestionType,
  QuestionDTO,
  PracticeSession,
  PracticeResult,
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

/** 作答后 DTO（含正确答案+解析）：getResult 用 */
export function mapQuestionWithAnswer(r: Row): QuestionDTO & {
  correctAnswer: unknown;
  acceptableAnswers?: string[];
  explanation?: string;
} {
  return {
    id: r.id as string,
    questionType: r.question_type as QuestionType,
    questionStem: r.question_stem as string,
    options: parseJsonArray(r.options_json) as string[] | undefined,
    score: r.score as number,
    correctAnswer: r.correct_answer as string,
    acceptableAnswers: parseJsonArray(r.acceptable_answers_json) as string[] | undefined,
    explanation: (r.explanation as string) ?? undefined,
  };
}

export function mapSession(r: Row): PracticeSession {
  return {
    id: r.id as string,
    courseId: r.course_instance_id as string,
    moduleIds: parseJsonArray(r.module_ids_json) as string[],
    questionCount: r.question_count as number,
    timeLimit: (r.time_limit_minutes as number) ?? undefined,
    difficulty: (r.difficulty as number) ?? undefined,
    questionTypes: parseJsonArray(r.question_types_json) as QuestionType[],
    status: r.status as PracticeSession["status"],
    maxScore: (r.max_score as number) ?? undefined,
    totalScore: (r.total_score as number) ?? undefined,
    correctCount: (r.correct_count as number) ?? undefined,
    startedAt: r.started_at as string,
    submittedAt: (r.submitted_at as string) ?? undefined,
    gradedAt: (r.graded_at as string) ?? undefined,
    createdAt: r.created_at as string,
  };
}

export function mapResult(
  sessionRow: Row,
  items: PracticeResult["items"],
  elapsedMs: number,
): PracticeResult {
  return {
    sessionId: sessionRow.id as string,
    totalScore: (sessionRow.total_score as number) ?? 0,
    maxScore: (sessionRow.max_score as number) ?? 0,
    correctCount: (sessionRow.correct_count as number) ?? 0,
    elapsedMs,
    submittedAt: (sessionRow.submitted_at as string) ?? undefined,
    gradedAt: (sessionRow.graded_at as string) ?? undefined,
    items,
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
