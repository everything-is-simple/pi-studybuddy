/**
 * T-M1-003 S3 题目生成接口（06-API §3.5 + 08-Test §5.4 不连真实外部服务）
 *
 * 可注入的 QuestionGenerator 接口：createSession 调用此接口生成客观题。
 * 默认实现 createMockQuestionGenerator() 生成确定性 mock 题目，满足题型分布比例。
 * 真实 LLM 生成待后续任务接入。
 */
import { randomUUID } from "node:crypto";
import type { QuestionType } from "../../../contract/types";

export interface GeneratedQuestion {
  id: string;
  questionType: QuestionType;
  questionStem: string;
  options: string[];
  correctAnswer: string;
  acceptableAnswers?: string[];
  explanation: string;
  score: number;
  difficulty?: number;
}

export interface QuestionGenerator {
  generate(params: {
    courseId: string;
    moduleIds: string[];
    questionCount: number;
    questionTypes: QuestionType[];
    difficulty?: number;
  }): GeneratedQuestion[];
}

/**
 * Mock 确定性题目生成器
 *
 * 题型分布比例：single_choice 60% / multiple_choice 20% / fill_blank 20%（06-API §3.5）
 * 生成确定性题目（基于序号），满足测试可重复性。
 * 失败模拟：throw Error 时 createSession 捕获 → 不创建空 session → INTERNAL_ERROR
 */
export function createMockQuestionGenerator(): QuestionGenerator {
  return {
    generate(params: {
      courseId: string;
      moduleIds: string[];
      questionCount: number;
      questionTypes: QuestionType[];
      difficulty?: number;
    }): GeneratedQuestion[] {
      const { questionCount, questionTypes } = params;
      const questions: GeneratedQuestion[] = [];

      // 按比例分配题型
      const singleCount = Math.round(questionCount * 0.6);
      const multiCount = Math.round(questionCount * 0.2);
      const fillCount = questionCount - singleCount - multiCount;

      let idx = 0;
      for (let i = 0; i < singleCount; i++) {
        idx++;
        questions.push({
          id: randomUUID(),
          questionType: "single_choice",
          questionStem: `单选题 ${idx}：以下哪个选项是正确的？`,
          options: ["选项A", "选项B", "选项C", "选项D"],
          correctAnswer: "选项A",
          explanation: `解析：选项A 是正确答案（mock 题目 ${idx}）`,
          score: 1,
          difficulty: params.difficulty,
        });
      }

      for (let i = 0; i < multiCount; i++) {
        idx++;
        questions.push({
          id: randomUUID(),
          questionType: "multiple_choice",
          questionStem: `多选题 ${idx}：以下哪些选项是正确的？（多选）`,
          options: ["选项A", "选项B", "选项C", "选项D"],
          correctAnswer: JSON.stringify(["选项A", "选项B"]),
          explanation: `解析：选项 A 和 B 是正确答案（mock 题目 ${idx}）`,
          score: 2,
          difficulty: params.difficulty,
        });
      }

      for (let i = 0; i < fillCount; i++) {
        idx++;
        questions.push({
          id: randomUUID(),
          questionType: "fill_blank",
          questionStem: `填空题 ${idx}：请填写答案`,
          options: [],
          correctAnswer: "正确答案",
          acceptableAnswers: ["正确答案", "对的", "right"],
          explanation: `解析：填空答案为"正确答案"（mock 题目 ${idx}）`,
          score: 1,
          difficulty: params.difficulty,
        });
      }

      // 确保 questionTypes 参数被引用（用于接口一致性）
      void questionTypes;
      return questions;
    },
  };
}
