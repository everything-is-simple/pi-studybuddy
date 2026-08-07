/**
 * T-M2-002 S6 handler DTO 映射（05-ERD §2.2/§3.6 → contract/types.ts DTO）
 *
 * 把 db 行（snake_case）映射为 DTO（camelCase），对齐 05-ERD §2.2/§3.6 三表 schema 字段。
 * 真实渠道地址（邮箱/Webhook URL）在 credential-vault，DTO 只含 credentialKey 别名。
 */
import type {
  ParentReport,
  ReportDelivery,
  ParentReportTarget,
} from "../../../contract/types";

type Row = Record<string, unknown>;

/** mapReport：parent_reports 行 → ParentReport DTO */
export function mapReport(r: Row): ParentReport {
  return {
    reportKey: r.report_key as string,
    semesterId: r.semester_id as string,
    reportType: r.report_type as ParentReport["reportType"],
    periodStart: r.period_start as string,
    periodEnd: r.period_end as string,
    contentJson: JSON.parse(r.content_json as string),
    contentHash: r.content_hash as string,
    ruleGenerated: r.rule_generated as number,
    aiPolished: r.ai_polished as number,
    aiModel: (r.ai_model as string) ?? undefined,
    promptVersion: (r.prompt_version as string) ?? undefined,
    privacyCheckPassed: r.privacy_check_passed as number,
    generatedAt: r.generated_at as string,
    createdAt: r.created_at as string,
  };
}

/** mapDelivery：report_deliveries 行 → ReportDelivery DTO */
export function mapDelivery(r: Row): ReportDelivery {
  return {
    reportKey: r.report_key as string,
    channel: r.channel as ReportDelivery["channel"],
    status: r.status as ReportDelivery["status"],
    retryCount: r.retry_count as number,
    maxRetries: r.max_retries as number,
    errorCode: (r.error_code as string) ?? undefined,
    sentAt: (r.sent_at as string) ?? undefined,
    lastAttemptAt: (r.last_attempt_at as string) ?? undefined,
    createdAt: r.created_at as string,
  };
}

/** mapTarget：parent_report_targets 行 → ParentReportTarget DTO */
export function mapTarget(r: Row): ParentReportTarget {
  return {
    id: r.id as string,
    semesterId: r.semester_id as string,
    targetName: r.target_name as string,
    channelType: r.channel_type as ParentReportTarget["channelType"],
    channelConfigJson: r.channel_config_json as string,
    credentialKey: (r.credential_key as string) ?? undefined,
    enabled: r.enabled as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    deletedAt: (r.deleted_at as string) ?? undefined,
  };
}
