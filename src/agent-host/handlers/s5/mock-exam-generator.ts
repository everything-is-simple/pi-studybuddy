/**
 * T-M2-001 S5 模拟卷生成接口（06-API §3.7 + 08-Test §5.5 不连真实外部服务）
 *
 * 可注入的 MockExamGenerator 接口：generatePaper 调用此接口生成模拟卷题目。
 * 默认实现 createMockMockExamGenerator() 生成确定性 mock 题目，满足题型分布比例。
 * 真实 LLM 生成待后续任务接入。
 *
 * AI 失败降级（08-Test §5.5）：generate 抛错时 generatePaper 捕获 → 不创建空卷 → INTERNAL_ERROR
 */
import type { QuestionType } from "../../../contract/types";

export interface MockExamQuestion {
  questionIndex: number;
  questionType: QuestionType; // single_choice/multiple_choice/fill_blank（复用 S3 类型）
  questionStem: string;
  options: string[]; // 选择题必填，填空题空数组
  correctAnswer: string;
  acceptableAnswers?: string[];
  explanation: string;
  score: number;
  knowledgeModuleId: string;
}

export interface MockExamGenerator {
  generate(params: {
    courseId: string;
    moduleIds: string[];
    questionCount: number;
    questionTypes: QuestionType[];
  }): MockExamQuestion[];
}

/**
 * Mock 确定性模拟卷生成器
 *
 * 题型分布比例：single_choice 60% / multiple_choice 20% / fill_blank 20%（同 S3）
 * 生成确定性题目（基于序号），满足测试可重复性。
 * 失败模拟：throw Error 时 generatePaper 捕获 → 不创建空卷 → INTERNAL_ERROR
 */
export function createMockMockExamGenerator(): MockExamGenerator {
  return {
    generate(params: {
      courseId: string;
      moduleIds: string[];
      questionCount: number;
      questionTypes: QuestionType[];
    }): MockExamQuestion[] {
      const { questionCount, moduleIds } = params;
      const questions: MockExamQuestion[] = [];

      // 按比例分配题型
      const singleCount = Math.round(questionCount * 0.6);
      const multiCount = Math.round(questionCount * 0.2);
      const fillCount = questionCount - singleCount - multiCount;

      // 确保至少有一个模块可用
      const effectiveModuleIds = moduleIds.length > 0 ? moduleIds : ["default-module"];

      let idx = 0;
      for (let i = 0; i < singleCount; i++) {
        idx++;
        questions.push({
          questionIndex: idx,
          questionType: "single_choice",
          questionStem: `单选题 ${idx}：以下哪个选项是正确的？`,
          options: ["选项A", "选项B", "选项C", "选项D"],
          correctAnswer: "选项A",
          explanation: `解析：选项A 是正确答案（mock 模拟卷题目 ${idx}）`,
          score: 1,
          knowledgeModuleId: effectiveModuleIds[idx % effectiveModuleIds.length],
        });
      }

      for (let i = 0; i < multiCount; i++) {
        idx++;
        questions.push({
          questionIndex: idx,
          questionType: "multiple_choice",
          questionStem: `多选题 ${idx}：以下哪些选项是正确的？（多选）`,
          options: ["选项A", "选项B", "选项C", "选项D"],
          correctAnswer: JSON.stringify(["选项A", "选项B"]),
          explanation: `解析：选项 A 和 B 是正确答案（mock 模拟卷题目 ${idx}）`,
          score: 2,
          knowledgeModuleId: effectiveModuleIds[idx % effectiveModuleIds.length],
        });
      }

      for (let i = 0; i < fillCount; i++) {
        idx++;
        questions.push({
          questionIndex: idx,
          questionType: "fill_blank",
          questionStem: `填空题 ${idx}：请填写答案`,
          options: [],
          correctAnswer: "正确答案",
          acceptableAnswers: ["正确答案", "对的", "right"],
          explanation: `解析：填空答案为"正确答案"（mock 模拟卷题目 ${idx}）`,
          score: 1,
          knowledgeModuleId: effectiveModuleIds[idx % effectiveModuleIds.length],
        });
      }

      return questions;
    },
  };
}

/**
 * 失败模拟卷生成器（测试用）
 *
 * generate 总是抛 Error → generatePaper 捕获 → 不创建空卷 → INTERNAL_ERROR
 */
export function createFailingMockExamGenerator(): MockExamGenerator {
  return {
    generate(): MockExamQuestion[] {
      throw new Error("AI 模拟卷生成不可用");
    },
  };
}
