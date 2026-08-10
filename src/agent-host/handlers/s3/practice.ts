/**
 * T-M1-003 S3 限时练习 handler（06-API §3.5 practice.* + 07-WF §2.4）
 *
 * 5 方法：createSession / getQuestions / submit / getResult / listSessions
 *
 * 状态机（07-WF §8.5）：in_progress → submitted → graded
 *   submit 时 in_progress→submitted→graded 一次完成；已 graded 重复 submit 拒绝（BAD_REQUEST）
 *
 * 关键约束：
 *   - createSession：校验 questionCount 5-20 + moduleIds 1-10 + AI 生成题目（可注入 QuestionGenerator）
 *   - AI 失败不创建空 session → INTERNAL_ERROR
 *   - getQuestions：作答前 DTO 不含 correct_answer/acceptable_answers/explanation（防泄露）
 *   - submit：规则批改三策略 + 写 practice_answers + session→graded + study_events
 */
import { randomUUID } from "node:crypto";
import type {
  PracticeSession,
  PracticeResult,
  QuestionDTO,
  QuestionType,
  Answer,
} from "../../../contract/types";
import type { S3Context } from "./context";
import { mapQuestionForStudent, mapQuestionWithAnswer, mapSession, mapResult } from "./dto";
import { notFound, badRequest, internalError } from "./errors";
import { assertModulesBelongToCourse, assertSemesterWritable, findSemesterByCourseId, findSemesterBySessionId } from "./lookup";
import { writePracticeSubmittedEvent, writePracticeGradedEvent } from "./events";
import { gradeAnswer } from "./grader";
import type { GeneratedQuestion } from "./question-generator";

function now(): string {
  return new Date().toISOString();
}

const DEFAULT_QUESTION_TYPES: QuestionType[] = ["single_choice", "multiple_choice", "fill_blank"];

export function createPracticeHandlers(ctx: S3Context) {
  return {
    "practice.createSession": (params: unknown): PracticeSession => {
      const {
        courseId,
        moduleIds,
        questionCount,
        timeLimit,
        difficulty,
        questionTypes,
      } = params as {
        courseId: string;
        moduleIds: string[];
        questionCount: number;
        timeLimit?: number;
        difficulty?: number;
        questionTypes?: string[];
      };

      // 校验 questionCount 5-20（05-ERD §3.3.2 CHECK）
      if (questionCount < 5 || questionCount > 20) {
        throw badRequest("题目数量必须在 5-20 之间");
      }
      // 校验 moduleIds 1-10（07-WF §2.4）
      if (!moduleIds || moduleIds.length < 1 || moduleIds.length > 10) {
        throw badRequest("知识模块数量必须在 1-10 之间");
      }

      const { db, semesterId } = findSemesterByCourseId(ctx, courseId);
      assertSemesterWritable(ctx, semesterId);
      assertModulesBelongToCourse(db, courseId, moduleIds);

      // 调用 QuestionGenerator 生成题目（可注入，默认 mock）
      let generated: GeneratedQuestion[];
      try {
        generated = ctx.questionGenerator.generate({
          courseId,
          moduleIds,
          questionCount,
          questionTypes: (questionTypes as QuestionType[]) ?? DEFAULT_QUESTION_TYPES,
          difficulty,
        });
      } catch {
        // AI 失败不创建空 session → INTERNAL_ERROR
        throw internalError("题目生成失败，请稍后重试或检查模型配置");
      }

      if (!generated || generated.length === 0) {
        throw internalError("题目生成失败，请稍后重试或检查模型配置");
      }

      const sessionId = randomUUID();
      const ts = now();
      const qTypesJson = JSON.stringify(
        (questionTypes as QuestionType[]) ?? DEFAULT_QUESTION_TYPES,
      );
      const moduleIdsJson = JSON.stringify(moduleIds);
      const maxScore = generated.reduce((sum, q) => sum + q.score, 0);

      // 写 practice_sessions（status=in_progress）
      db.prepare(
        `INSERT INTO practice_sessions
          (id, course_instance_id, question_count, time_limit_minutes, difficulty,
           question_types_json, module_ids_json, status, started_at, max_score, created_at)
         VALUES (@id, @cid, @qCount, @timeLimit, @difficulty, @qTypesJson, @moduleIdsJson,
                 'in_progress', @startedAt, @maxScore, @createdAt)`,
      ).run({
        id: sessionId,
        cid: courseId,
        qCount: questionCount,
        timeLimit: timeLimit ?? null,
        difficulty: difficulty ?? null,
        qTypesJson: qTypesJson,
        moduleIdsJson: moduleIdsJson,
        startedAt: ts,
        maxScore,
        createdAt: ts,
      });

      // 写 questions（触发器 T1 校验 question.course === session.course）
      // knowledge_module_id 设 NULL（moduleIds 传给 QuestionGenerator 用于出题，不直接做 FK）
      for (const q of generated) {
        db.prepare(
          `INSERT INTO questions
            (id, practice_session_id, course_instance_id, knowledge_module_id, question_type,
             question_stem, options_json, correct_answer, acceptable_answers_json, explanation,
             score, difficulty, created_at)
           VALUES (@id, @psid, @cid, NULL, @qType, @stem, @optionsJson, @correctAns,
                   @acceptJson, @explanation, @score, @difficulty, @createdAt)`,
        ).run({
          id: q.id,
          psid: sessionId,
          cid: courseId,
          qType: q.questionType,
          stem: q.questionStem,
          optionsJson: JSON.stringify(q.options),
          correctAns: q.correctAnswer,
          acceptJson: q.acceptableAnswers ? JSON.stringify(q.acceptableAnswers) : null,
          explanation: q.explanation,
          score: q.score,
          difficulty: q.difficulty ?? null,
          createdAt: ts,
        });
      }

      const row = db.prepare("SELECT * FROM practice_sessions WHERE id = @id").get({ id: sessionId }) as Record<string, unknown>;
      void semesterId;
      return mapSession(row);
    },

    "practice.getQuestions": (params: unknown): QuestionDTO[] => {
      const { sessionId } = params as { sessionId: string };
      const { db } = findSemesterBySessionId(ctx, sessionId);

      const session = db.prepare("SELECT * FROM practice_sessions WHERE id = @id").get({ id: sessionId }) as
        | Record<string, unknown>
        | undefined;
      if (!session) throw notFound("未找到该练习会话");

      const rows = db
        .prepare("SELECT * FROM questions WHERE practice_session_id = @id AND deleted_at IS NULL ORDER BY created_at")
        .all({ id: sessionId }) as Record<string, unknown>[];

      // 作答前 DTO 防泄露：不含 correct_answer/acceptable_answers/explanation
      return rows.map(mapQuestionForStudent);
    },

    "practice.submit": (params: unknown): PracticeResult => {
      const { sessionId, answers } = params as { sessionId: string; answers: Answer[] };
      const { db, semesterId } = findSemesterBySessionId(ctx, sessionId);
      assertSemesterWritable(ctx, semesterId);

      const session = db.prepare("SELECT * FROM practice_sessions WHERE id = @id").get({ id: sessionId }) as
        | Record<string, unknown>
        | undefined;
      if (!session) throw notFound("未找到该练习会话");

      // 状态机校验：已 graded 重复 submit 拒绝
      const status = session.status as string;
      if (status === "graded") {
        throw badRequest("该练习已批改完成，无法重复提交");
      }
      if (status !== "in_progress") {
        throw badRequest(`练习当前状态 ${status} 不允许提交，仅 in_progress 可提交`);
      }

      const ts = now();
      const startedAt = new Date(session.started_at as string).getTime();
      const elapsedMs = Date.now() - startedAt;

      // 查询所有题目
      const questionRows = db
        .prepare("SELECT * FROM questions WHERE practice_session_id = @id AND deleted_at IS NULL")
        .all({ id: sessionId }) as Record<string, unknown>[];

      // 写 practice_submitted 事件（07-WF §2.4）
      writePracticeSubmittedEvent(db, semesterId, session.course_instance_id as string, sessionId);

      // 批改每题 + 写 practice_answers
      const items: PracticeResult["items"] = [];
      let totalScore = 0;
      let correctCount = 0;

      for (const qRow of questionRows) {
        const qId = qRow.id as string;
        const qType = qRow.question_type as QuestionType;
        const correctAnswer = qRow.correct_answer as string;
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
        const studentAnswerObj = answers.find((a) => a.questionId === qId);
        const studentAnswer = studentAnswerObj?.value ?? null;

        // 规则批改
        const grade = gradeAnswer(qType, studentAnswer, correctAnswer, acceptableAnswers);

        // 写 practice_answers（触发器 T5 校验 question 属于 session）
        const answerId = randomUUID();
        db.prepare(
          `INSERT INTO practice_answers
            (id, practice_session_id, question_id, course_instance_id, student_answer,
             is_correct, graded_at, time_spent_ms, created_at)
           VALUES (@id, @psid, @qid, @cid, @ans, @isCorrect, @gradedAt, @timeSpent, @createdAt)`,
        ).run({
          id: answerId,
          psid: sessionId,
          qid: qId,
          cid: session.course_instance_id as string,
          ans: studentAnswer === null ? null : JSON.stringify(studentAnswer),
          isCorrect: grade.isCorrect ? 1 : 0,
          gradedAt: ts,
          timeSpent: Math.round(elapsedMs / questionRows.length),
          createdAt: ts,
        });

        if (grade.isCorrect) {
          correctCount++;
          totalScore += (qRow.score as number) ?? 0;
        }

        items.push({
          question: mapQuestionForStudent(qRow),
          isCorrect: grade.isCorrect,
          correctAnswer: grade.correctAnswer,
          explanation: (qRow.explanation as string) ?? undefined,
          practiceAnswerId: answerId,
        });
      }

      const maxScore = (session.max_score as number) ?? questionRows.reduce((s, r) => s + ((r.score as number) ?? 0), 0);

      // session → submitted → graded（一次完成）
      db.prepare(
        `UPDATE practice_sessions
         SET status = 'graded', submitted_at = @submittedAt, graded_at = @gradedAt,
             total_score = @totalScore, correct_count = @correctCount
         WHERE id = @id`,
      ).run({
        id: sessionId,
        submittedAt: ts,
        gradedAt: ts,
        totalScore,
        correctCount,
      });

      // 写 practice_graded 事件
      writePracticeGradedEvent(db, semesterId, session.course_instance_id as string, sessionId);

      // 读回 session 行构造 result
      const updatedSession = db.prepare("SELECT * FROM practice_sessions WHERE id = @id").get({ id: sessionId }) as Record<string, unknown>;
      return mapResult(updatedSession, items, elapsedMs);
    },

    "practice.getResult": (params: unknown): PracticeResult => {
      const { sessionId } = params as { sessionId: string };
      const { db } = findSemesterBySessionId(ctx, sessionId);

      const session = db.prepare("SELECT * FROM practice_sessions WHERE id = @id").get({ id: sessionId }) as
        | Record<string, unknown>
        | undefined;
      if (!session) throw notFound("未找到该练习会话");

      // 仅 graded 状态可查看结果
      if (session.status !== "graded") {
        throw badRequest("该练习尚未批改完成，无法查看结果");
      }

      const questionRows = db
        .prepare("SELECT * FROM questions WHERE practice_session_id = @id AND deleted_at IS NULL")
        .all({ id: sessionId }) as Record<string, unknown>[];

      const answerRows = db
        .prepare("SELECT * FROM practice_answers WHERE practice_session_id = @id")
        .all({ id: sessionId }) as Record<string, unknown>[];

      const items: PracticeResult["items"] = questionRows.map((qRow) => {
        const qId = qRow.id as string;
        const answerRow = answerRows.find((a) => a.question_id === qId);
        const qWithAnswer = mapQuestionWithAnswer(qRow);
        return {
          question: {
            id: qWithAnswer.id,
            questionType: qWithAnswer.questionType,
            questionStem: qWithAnswer.questionStem,
            options: qWithAnswer.options,
            score: qWithAnswer.score,
          },
          isCorrect: answerRow ? (answerRow.is_correct as number) === 1 : false,
          correctAnswer: qWithAnswer.correctAnswer,
          explanation: qWithAnswer.explanation,
          practiceAnswerId: answerRow?.id as string | undefined,
        };
      });

      const startedAt = new Date(session.started_at as string).getTime();
      const submittedAt = session.submitted_at ? new Date(session.submitted_at as string).getTime() : Date.now();
      const elapsedMs = submittedAt - startedAt;

      return mapResult(session, items, elapsedMs);
    },

    "practice.listSessions": (params: unknown): PracticeSession[] => {
      const { courseId } = (params ?? {}) as { courseId?: string };

      if (courseId) {
        const { db } = findSemesterByCourseId(ctx, courseId);
        const rows = db
          .prepare("SELECT * FROM practice_sessions WHERE course_instance_id = @cid ORDER BY created_at DESC")
          .all({ cid: courseId }) as Record<string, unknown>[];
        return rows.map(mapSession);
      }

      // 无 courseId：遍历所有学期库
      const result: PracticeSession[] = [];
      const semesters = ctx.globalDb
        .prepare("SELECT id FROM semesters WHERE deleted_at IS NULL")
        .all() as Array<{ id: string }>;
      for (const s of semesters) {
        const db = ctx.semesterDb(s.id);
        const rows = db
          .prepare("SELECT * FROM practice_sessions ORDER BY created_at DESC")
          .all() as Record<string, unknown>[];
        result.push(...rows.map(mapSession));
      }
      return result;
    },
  };
}
