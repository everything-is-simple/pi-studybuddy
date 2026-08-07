/**
 * T-M1-003 S3 规则批改引擎（08-Test §7.4 可证伪 + 06-API §3.5）
 *
 * 纯确定性规则，不调 LLM。三策略：
 *   - 单选：精确匹配（studentAnswer === correctAnswer）
 *   - 多选：deepEquals（排序后 JSON 比较）
 *   - 填空：normalize（trim + 全角转半角 + 统一小写 + 去多余空格）+ 多等价答案 OR
 */
import type { QuestionType } from "../../../contract/types";

export interface GradeResult {
  isCorrect: boolean;
  correctAnswer: unknown;
}

/** 批改单题 */
export function gradeAnswer(
  questionType: QuestionType,
  studentAnswer: unknown,
  correctAnswer: string,
  acceptableAnswers?: string[],
): GradeResult {
  switch (questionType) {
    case "single_choice":
      return gradeSingleChoice(studentAnswer, correctAnswer);
    case "multiple_choice":
      return gradeMultipleChoice(studentAnswer, correctAnswer);
    case "fill_blank":
      return gradeFillBlank(studentAnswer, correctAnswer, acceptableAnswers);
    default:
      return { isCorrect: false, correctAnswer };
  }
}

/** 单选：精确匹配 */
function gradeSingleChoice(studentAnswer: unknown, correctAnswer: string): GradeResult {
  const isCorrect = studentAnswer === correctAnswer;
  return { isCorrect, correctAnswer };
}

/** 多选：排序后 deepEquals */
function gradeMultipleChoice(studentAnswer: unknown, correctAnswer: string): GradeResult {
  let correctParsed: string[];
  try {
    correctParsed = JSON.parse(correctAnswer) as string[];
  } catch {
    correctParsed = [correctAnswer];
  }

  let studentArr: string[];
  if (Array.isArray(studentAnswer)) {
    studentArr = [...(studentAnswer as string[])];
  } else {
    studentArr = [String(studentAnswer)];
  }

  // 排序后比较
  const sortedStudent = studentArr.sort();
  const sortedCorrect = [...correctParsed].sort();
  const isCorrect = JSON.stringify(sortedStudent) === JSON.stringify(sortedCorrect);
  return { isCorrect, correctAnswer: correctParsed };
}

/** 填空：normalize + 多等价答案 OR */
function gradeFillBlank(
  studentAnswer: unknown,
  correctAnswer: string,
  acceptableAnswers?: string[],
): GradeResult {
  const normalizedStudent = normalizeText(String(studentAnswer));
  const normalizedCorrect = normalizeText(correctAnswer);

  // 正确答案 OR 任一可接受答案匹配即正确
  const acceptedSet = [normalizedCorrect];
  if (acceptableAnswers) {
    for (const ans of acceptableAnswers) {
      acceptedSet.push(normalizeText(ans));
    }
  }

  const isCorrect = acceptedSet.includes(normalizedStudent);
  return {
    isCorrect,
    correctAnswer: acceptableAnswers?.length ? [correctAnswer, ...acceptableAnswers] : correctAnswer,
  };
}

/**
 * 填空答案 normalize（08-Test §7.4）：
 * 1. trim
 * 2. 全角转半角
 * 3. 统一小写
 * 4. 去多余空格（连续空格→单空格）
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)) // 全角→半角
    .replace(/\u3000/g, " ") // 全角空格
    .toLowerCase()
    .replace(/\s+/g, " ");
}
