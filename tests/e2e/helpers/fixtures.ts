/**
 * T-M1-010 E2E 测试夹具
 *
 * 提供各 E2E 用例共享的测试数据和验证工具。
 * 外部服务（AI/OCR/WPS）全 mock（08-Test §1.3 第 6 条不连真实外部服务）。
 */

/** E2E-01 学期初始化夹具 */
export const SEMESTER_FIXTURE = {
  label: "2026秋季 E2E",
  startDate: "2026-09-01",
  endDate: "2027-01-31",
  timezone: "Asia/Shanghai",
} as const;

/** E2E-01 课程夹具 */
export const COURSE_FIXTURE = {
  name: "高等数学 E2E",
  code: "MATH101-E2E",
  credits: 4,
  color: "#3B82F6",
} as const;

/** E2E-01 考试夹具 */
export const EXAM_FIXTURE = {
  name: "2026秋季期末考试",
  examType: "final" as const,
  plannedDate: "2027-01-20",
  source: "manual" as const,
} as const;

/** E2E-02 资料夹具 */
export const MATERIAL_FIXTURE = {
  fileName: "chapter1.pdf",
  mime: "application/pdf",
} as const;

/** E2E-03 练习夹具：5 道题（handler 校验 questionCount 5-20） */
export const PRACTICE_FIXTURE = {
  moduleIds: ["mock-module-1"],
  questionCount: 5,
} as const;

/**
 * 防泄露字段清单（08-Test §7.2，优先级最高）
 *
 * 作答前 DTO 不得包含以下字段：
 *   - correct_answer（正确答案）
 *   - acceptable_answers（填空题可接受答案）
 *   - explanation（解析）
 */
export const LEAKAGE_FIELDS = [
  "correct_answer",
  "acceptable_answers",
  "explanation",
] as const;

/**
 * 断言 DTO 不含防泄露字段（08-Test §7.2 铁律）。
 *
 * @param dto 作答前获取的题目 DTO
 * @throws 如果 DTO 含任何防泄露字段
 */
export function assertNoLeakage(dto: unknown): void {
  if (typeof dto !== "object" || dto === null) {
    throw new Error("DTO 不是对象，无法检查防泄露");
  }
  const obj = dto as Record<string, unknown>;
  for (const field of LEAKAGE_FIELDS) {
    if (field in obj) {
      throw new Error(`防泄露铁律违反：DTO 含禁止字段 "${field}"（08-Test §7.2）`);
    }
  }
  // 检查字符串化后是否含"正确答案"字样
  const serialized = JSON.stringify(dto);
  if (serialized.includes("正确答案")) {
    throw new Error('防泄露铁律违反：DTO 序列化后含"正确答案"字样（08-Test §7.2）');
  }
}

/** RPC 错误判定 */
export function isRpcError(e: unknown): e is { code: string; message: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}
