/**
 * T-M2-001 S5 模拟考 handler（06-API §3.7 mockExams.* + 07-WF §2.6 + §8.8）
 *
 * 6 方法：generatePaper / getPaper / startAttempt / submitAttempt / getResult / getModuleAnalyses
 *
 * 状态机（07-WF §8.8）：in_progress → submitted → graded
 *   submit 时 in_progress→submitted→graded 一次完成；已 graded 重复 submit 拒绝（BAD_REQUEST）
 *
 * 关键约束：
 *   - generatePaper：触发器校验 assessment_attempt 必须 confirmed（05-ERD §6.3）
 *   - generatePaper：source_hash 防重复生成（同参数返回已有 paper）
 *   - generatePaper：AI 失败不创建空卷 → INTERNAL_ERROR（08-Test §5.5）
 *   - getPaper：questions 不含 correctAnswer/acceptableAnswers/explanation（防泄露，06-API §471）
 *   - submitAttempt：规则批改三策略（复用 S3 grader）
 *   - submitAttempt：写 mock_exam_module_analyses（weakness_level strong/medium/weak）
 *   - submitAttempt：写 study_events（mock_exam_completed, source_system='S5'）
 */
import { randomUUID, createHash } from "node:crypto";
import type {
  MockExamPaper,
  MockExamAttempt,
  MockExamResult,
  MockExamModuleAnalysis,
  QuestionType,
  Answer,
} from "../../../contract/types";
import type { S5Context } from "./context";
import type { MockExamQuestion } from "./mock-exam-generator";
import { mapPaper, mapAttempt, mapResult, mapModuleAnalysis } from "./dto";
import { notFound, badRequest, internalError } from "./errors";
import {
  findSemesterByAssessmentAttemptId,
  findSemesterByPaperId,
  findSemesterByAttemptId,
  assertSemesterWritable,
} from "./lookup";
import { writeMockExamCompletedEvent } from "./events";
import { gradeAnswer } from "../s3/grader";

function now(): string {
  return new Date().toISOString();
}

const DEFAULT_QUESTION_TYPES: QuestionType[] = ["single_choice", "multiple_choice", "fill_blank"];
const PROMPT_VERSION = "v1";
const AI_MODEL = "mock";

export function createMockExamHandlers(ctx: S5Context) {
  return {
    "mockExams.generatePaper": (params: unknown): MockExamPaper => {
      const { assessmentAttemptId, questionCount, timeLimit } = params as {
        assessmentAttemptId: string;
        questionCount: number;
        timeLimit?: number;
      };

      // 校验 questionCount 5-20（参考 S3 边界）
      if (questionCount < 5 || questionCount > 20) {
        throw badRequest("题目数量必须在 5-20 之间");
      }

      const { db, semesterId } = findSemesterByAssessmentAttemptId(ctx, assessmentAttemptId);

      // host 侧归档写防线：归档学期禁止生成模拟卷（renderer 已禁用，host 双层拒绝）
      assertSemesterWritable(ctx, semesterId);

      // 查 assessment_attempt（必须 confirmed）
      const attemptRow = db
        .prepare("SELECT * FROM assessment_attempts WHERE id = @id")
        .get({ id: assessmentAttemptId }) as Record<string, unknown> | undefined;
      if (!attemptRow) throw notFound("未找到该考试记录");

      if ((attemptRow.confirmation_status as string) !== "confirmed") {
        throw badRequest("该考试未确认，无法生成模拟卷");
      }

      const courseId = attemptRow.course_instance_id as string;

      // 查课程的知识模块
      const moduleRows = db
        .prepare("SELECT id FROM knowledge_modules WHERE course_instance_id = @cid")
        .all({ cid: courseId }) as Array<{ id: string }>;
      const moduleIds = moduleRows.map((r) => r.id);

      // 调用 MockExamGenerator 生成题目（可注入，默认 mock）
      // 先调用 generator 再检查 source_hash，确保 AI 失败时一定抛 INTERNAL_ERROR
      let generated: MockExamQuestion[];
      try {
        generated = ctx.mockExamGenerator.generate({
          courseId,
          moduleIds,
          questionCount,
          questionTypes: DEFAULT_QUESTION_TYPES,
        });
      } catch {
        // AI 失败不创建空卷 → INTERNAL_ERROR（08-Test §5.5）
        throw internalError("模拟卷生成失败，请稍后重试");
      }

      if (!generated || generated.length === 0) {
        throw internalError("模拟卷生成失败，请稍后重试");
      }

      // 计算 source_hash（防重复生成同一套卷）
      const sortedModuleIds = [...moduleIds].sort();
      const sourceHash = createHash("sha256")
        .update(`${assessmentAttemptId}|${questionCount}|${sortedModuleIds.join(",")}|${PROMPT_VERSION}`)
        .digest("hex");

      // 检查是否已有同 source_hash 的 paper（幂等返回）
      const existing = db
        .prepare(
          "SELECT * FROM mock_exam_papers WHERE assessment_attempt_id = @aid AND source_hash = @hash",
        )
        .get({ aid: assessmentAttemptId, hash: sourceHash }) as
        | Record<string, unknown>
        | undefined;

      if (existing) {
        // 返回已有 paper（幂等）
        const existingQuestions = db
          .prepare("SELECT * FROM mock_exam_questions WHERE mock_paper_id = @pid ORDER BY question_index")
          .all({ pid: existing.id as string }) as Record<string, unknown>[];
        return mapPaper(existing, existingQuestions);
      }

      // 计算总分
      const totalScore = generated.reduce((sum, q) => sum + q.score, 0);
      const paperId = randomUUID();
      const ts = now();
      const paperTitle = `模拟卷-${attemptRow.exam_name as string ?? "期末考试"}-${questionCount}题`;

      // 写 mock_exam_papers（触发器 trg_mockpaper_attempt_confirmed 校验 confirmed）
      db.prepare(
        `INSERT INTO mock_exam_papers
          (id, course_instance_id, assessment_attempt_id, paper_title, question_count,
           time_limit_minutes, total_score, source_hash, ai_model, prompt_version,
           generated_at, created_at)
         VALUES (@id, @cid, @aid, @title, @qCount, @timeLimit, @totalScore, @hash,
                 @aiModel, @promptVersion, @generatedAt, @createdAt)`,
      ).run({
        id: paperId,
        cid: courseId,
        aid: assessmentAttemptId,
        title: paperTitle,
        qCount: questionCount,
        timeLimit: timeLimit ?? null,
        totalScore,
        hash: sourceHash,
        aiModel: AI_MODEL,
        promptVersion: PROMPT_VERSION,
        generatedAt: ts,
        createdAt: ts,
      });

      // 写 mock_exam_questions（CHECK 选择题/填空题字段互斥）
      for (const q of generated) {
        const optionsJson =
          q.questionType === "fill_blank" ? null : JSON.stringify(q.options);
        const acceptableJson =
          q.questionType === "fill_blank" && q.acceptableAnswers
            ? JSON.stringify(q.acceptableAnswers)
            : null;

        db.prepare(
          `INSERT INTO mock_exam_questions
            (id, mock_paper_id, question_index, question_type, question_stem,
             options_json, correct_answer, acceptable_answers_json, explanation,
             score, knowledge_module_id, created_at)
           VALUES (@id, @pid, @qIdx, @qType, @stem, @optionsJson, @correctAns,
                   @acceptJson, @explanation, @score, @moduleId, @createdAt)`,
        ).run({
          id: randomUUID(),
          pid: paperId,
          qIdx: q.questionIndex,
          qType: q.questionType,
          stem: q.questionStem,
          optionsJson,
          correctAns: q.correctAnswer,
          acceptJson: acceptableJson,
          explanation: q.explanation,
          score: q.score,
          moduleId: q.knowledgeModuleId,
          createdAt: ts,
        });
      }

      void semesterId;
      // 读回 paper + questions 构造 DTO（questions 防泄露）
      const paperRow = db
        .prepare("SELECT * FROM mock_exam_papers WHERE id = @id")
        .get({ id: paperId }) as Record<string, unknown>;
      const questionRows = db
        .prepare("SELECT * FROM mock_exam_questions WHERE mock_paper_id = @pid ORDER BY question_index")
        .all({ pid: paperId }) as Record<string, unknown>[];
      return mapPaper(paperRow, questionRows);
    },

    "mockExams.getPaper": (params: unknown): MockExamPaper => {
      const { paperId } = params as { paperId: string };
      const { db } = findSemesterByPaperId(ctx, paperId);

      const paperRow = db
        .prepare("SELECT * FROM mock_exam_papers WHERE id = @id")
        .get({ id: paperId }) as Record<string, unknown> | undefined;
      if (!paperRow) throw notFound("未找到该模拟卷");

      // questions 防泄露：不含 correctAnswer/acceptableAnswers/explanation
      const questionRows = db
        .prepare("SELECT * FROM mock_exam_questions WHERE mock_paper_id = @pid ORDER BY question_index")
        .all({ pid: paperId }) as Record<string, unknown>[];
      return mapPaper(paperRow, questionRows);
    },

    "mockExams.startAttempt": (params: unknown): MockExamAttempt => {
      const { paperId } = params as { paperId: string };
      const { db, semesterId } = findSemesterByPaperId(ctx, paperId);

      // host 侧归档写防线：归档学期禁止开始模拟考
      assertSemesterWritable(ctx, semesterId);

      const paperRow = db
        .prepare("SELECT * FROM mock_exam_papers WHERE id = @id")
        .get({ id: paperId }) as Record<string, unknown> | undefined;
      if (!paperRow) throw notFound("未找到该模拟卷");

      const attemptId = randomUUID();
      const ts = now();

      db.prepare(
        `INSERT INTO mock_exam_attempts
          (id, mock_paper_id, course_instance_id, status, started_at, created_at)
         VALUES (@id, @pid, @cid, 'in_progress', @startedAt, @createdAt)`,
      ).run({
        id: attemptId,
        pid: paperId,
        cid: paperRow.course_instance_id as string,
        startedAt: ts,
        createdAt: ts,
      });

      const row = db
        .prepare("SELECT * FROM mock_exam_attempts WHERE id = @id")
        .get({ id: attemptId }) as Record<string, unknown>;
      return mapAttempt(row);
    },

    "mockExams.submitAttempt": (params: unknown): MockExamResult => {
      const { attemptId, answers } = params as {
        attemptId: string;
        answers: Answer[];
      };
      const { db, semesterId } = findSemesterByAttemptId(ctx, attemptId);

      // host 侧归档写防线：归档学期禁止提交模拟考
      assertSemesterWritable(ctx, semesterId);

      const attemptRow = db
        .prepare("SELECT * FROM mock_exam_attempts WHERE id = @id")
        .get({ id: attemptId }) as Record<string, unknown> | undefined;
      if (!attemptRow) throw notFound("未找到该模拟考作答记录");

      // 状态机校验：已 graded 重复 submit 拒绝
      const status = attemptRow.status as string;
      if (status === "graded") {
        throw badRequest("该模拟考已批改完成，无法重复提交");
      }
      if (status !== "in_progress") {
        throw badRequest(`模拟考当前状态 ${status} 不允许提交，仅 in_progress 可提交`);
      }

      const paperId = attemptRow.mock_paper_id as string;
      const courseId = attemptRow.course_instance_id as string;
      const ts = now();
      const startedAt = new Date(attemptRow.started_at as string).getTime();
      const elapsedMs = Date.now() - startedAt;

      // 查询所有题目
      const questionRows = db
        .prepare("SELECT * FROM mock_exam_questions WHERE mock_paper_id = @pid ORDER BY question_index")
        .all({ pid: paperId }) as Record<string, unknown>[];

      // 批改每题 + 写 mock_exam_answers
      let totalScore = 0;
      let correctCount = 0;
      const moduleStats = new Map<
        string,
        { total: number; correct: number }
      >();

      for (const qRow of questionRows) {
        const qId = qRow.id as string;
        const qType = qRow.question_type as QuestionType;
        const correctAnswer = qRow.correct_answer as string;
        const moduleId = (qRow.knowledge_module_id as string) ?? null;
        const acceptableRaw = qRow.acceptable_answers_json as string | null;
        let acceptableAnswers: string[] | undefined;
        if (acceptableRaw) {
          try {
            acceptableAnswers = JSON.parse(acceptableRaw) as string[];
          } catch {
            acceptableAnswers = undefined;
          }
        }

        // 查找学生答案
        const studentAnswerObj = (answers as Answer[]).find((a) => a.questionId === qId);
        const studentAnswer = studentAnswerObj?.value ?? null;

        // 规则批改（复用 S3 grader 三策略）
        const grade = gradeAnswer(qType, studentAnswer, correctAnswer, acceptableAnswers);

        // 写 mock_exam_answers（UNIQUE(mock_attempt_id, mock_question_id)）
        db.prepare(
          `INSERT INTO mock_exam_answers
            (id, mock_attempt_id, mock_question_id, student_answer, is_correct, created_at)
           VALUES (@id, @aid, @qid, @ans, @isCorrect, @createdAt)`,
        ).run({
          id: randomUUID(),
          aid: attemptId,
          qid: qId,
          ans: studentAnswer === null ? null : JSON.stringify(studentAnswer),
          isCorrect: grade.isCorrect ? 1 : 0,
          createdAt: ts,
        });

        if (grade.isCorrect) {
          correctCount++;
          totalScore += (qRow.score as number) ?? 0;
        }

        // 模块统计
        const stat = moduleStats.get(moduleId) ?? { total: 0, correct: 0 };
        stat.total++;
        if (grade.isCorrect) stat.correct++;
        moduleStats.set(moduleId, stat);
      }

      const maxScore = questionRows.reduce((s, r) => s + ((r.score as number) ?? 0), 0);

      // 更新 mock_exam_attempts：in_progress→graded（一次完成）
      db.prepare(
        `UPDATE mock_exam_attempts
         SET status = 'graded', submitted_at = @submittedAt, graded_at = @gradedAt,
             total_score = @totalScore, max_score = @maxScore,
             correct_count = @correctCount, duration_ms = @durationMs
         WHERE id = @id`,
      ).run({
        id: attemptId,
        submittedAt: ts,
        gradedAt: ts,
        totalScore,
        maxScore,
        correctCount,
        durationMs: elapsedMs,
      });

      // 写 mock_exam_module_analyses（weakness_level strong/medium/weak + UNIQUE）
      // T-M5-004：空课程无知识模块时跳过（mock_exam_module_analyses.knowledge_module_id NOT NULL FK，
      // 无真实模块可引用则不应写分析行；结果总分/正确率仍完整返回）
      const hasRealModules = moduleStats.size > 0 && Array.from(moduleStats.keys()).some((id) => id !== null && id !== "unknown");
      for (const [moduleId, stat] of moduleStats) {
        if (!hasRealModules || moduleId === null || moduleId === "unknown") continue;
        const accuracyRate = stat.total > 0 ? stat.correct / stat.total : 0;
        let weaknessLevel: string;
        if (accuracyRate >= 0.8) {
          weaknessLevel = "strong";
        } else if (accuracyRate >= 0.5) {
          weaknessLevel = "medium";
        } else {
          weaknessLevel = "weak";
        }

        db.prepare(
          `INSERT INTO mock_exam_module_analyses
            (id, mock_attempt_id, knowledge_module_id, total_questions,
             correct_count, accuracy_rate, weakness_level, created_at)
           VALUES (@id, @aid, @mid, @total, @correct, @rate, @level, @createdAt)`,
        ).run({
          id: randomUUID(),
          aid: attemptId,
          mid: moduleId,
          total: stat.total,
          correct: stat.correct,
          rate: accuracyRate,
          level: weaknessLevel,
          createdAt: ts,
        });
      }

      // 写 study_events（mock_exam_completed, source_system='S5'）
      writeMockExamCompletedEvent(db, semesterId, courseId, attemptId);

      // 读回 attempt + module_analyses 构造 result
      const updatedAttempt = db
        .prepare("SELECT * FROM mock_exam_attempts WHERE id = @id")
        .get({ id: attemptId }) as Record<string, unknown>;
      const analysisRows = db
        .prepare("SELECT * FROM mock_exam_module_analyses WHERE mock_attempt_id = @aid")
        .all({ aid: attemptId }) as Record<string, unknown>[];
      return mapResult(updatedAttempt, analysisRows);
    },

    "mockExams.getResult": (params: unknown): MockExamResult => {
      const { attemptId } = params as { attemptId: string };
      const { db } = findSemesterByAttemptId(ctx, attemptId);

      const attemptRow = db
        .prepare("SELECT * FROM mock_exam_attempts WHERE id = @id")
        .get({ id: attemptId }) as Record<string, unknown> | undefined;
      if (!attemptRow) throw notFound("未找到该模拟考作答记录");

      const analysisRows = db
        .prepare("SELECT * FROM mock_exam_module_analyses WHERE mock_attempt_id = @aid")
        .all({ aid: attemptId }) as Record<string, unknown>[];
      return mapResult(attemptRow, analysisRows);
    },

    "mockExams.getModuleAnalyses": (params: unknown): MockExamModuleAnalysis[] => {
      const { attemptId } = params as { attemptId: string };
      const { db } = findSemesterByAttemptId(ctx, attemptId);

      const attemptRow = db
        .prepare("SELECT 1 FROM mock_exam_attempts WHERE id = @id")
        .get({ id: attemptId });
      if (!attemptRow) throw notFound("未找到该模拟考作答记录");

      const rows = db
        .prepare("SELECT * FROM mock_exam_module_analyses WHERE mock_attempt_id = @aid")
        .all({ aid: attemptId }) as Record<string, unknown>[];
      return rows.map(mapModuleAnalysis);
    },
  };
}
