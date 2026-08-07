/**
 * T-M2-002 S6 assertNoSensitiveLeak UUID 泄漏检测（07-WF §3.1 + 08-Test §5.4）
 *
 * 冻结前对 content_json 序列化字符串扫描完整 UUID。
 * 发现完整 UUID → 抛 PARENT_REPORT_PRIVACY_VIOLATION（降级为规则报告）。
 *
 * UUID 正则：标准 8-4-4-4-12 格式（v1/v4/v5），覆盖 report_key/source_ref_id/student_id 等。
 */
import { privacyViolation } from "./errors";

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * 检测 content 是否含完整 UUID。
 * @param content 报告内容对象（将 JSON.stringify 后扫描）
 * @throws PARENT_REPORT_PRIVACY_VIOLATION 当检测到 UUID
 */
export function assertNoSensitiveLeak(content: unknown): void {
  const serialized = JSON.stringify(content);
  if (UUID_PATTERN.test(serialized)) {
    throw privacyViolation(
      "报告内容检测到完整 UUID，可能泄漏学生隐私。已降级为规则报告。",
    );
  }
}
