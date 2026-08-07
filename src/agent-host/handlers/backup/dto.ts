/**
 * T-M2-005 备份恢复 handler DTO 映射（05-ERD §2.3/§2.4 → contract/types.ts）
 *
 * backup_records 行 → BackupRecord DTO（14 字段对齐 05-ERD §2.3）
 * backup_schedules 行 → BackupSchedule DTO（10 字段对齐 05-ERD §2.4）
 */
import type { BackupRecord, BackupSchedule, BackupType, BackupStatus } from "../../../contract/types";

type Row = Record<string, unknown>;

/** mapBackupRecord：backup_records 行 → BackupRecord DTO（05-ERD §2.3 14 字段） */
export function mapBackupRecord(r: Row): BackupRecord {
  return {
    id: r.id as string,
    semesterId: r.semester_id as string,
    courseInstanceId: r.course_instance_id as string,
    backupType: r.backup_type as BackupType,
    targetPath: r.target_path as string,
    zipFilename: r.zip_filename as string,
    contentHash: r.content_hash as string,
    fileSizeBytes: r.file_size_bytes as number,
    status: r.status as BackupStatus,
    errorCode: (r.error_code as string) ?? undefined,
    scheduleCron: (r.schedule_cron as string) ?? undefined,
    startedAt: r.started_at as string,
    completedAt: (r.completed_at as string) ?? undefined,
    createdAt: r.created_at as string,
  };
}

/** mapBackupSchedule：backup_schedules 行 → BackupSchedule DTO（05-ERD §2.4 10 字段） */
export function mapBackupSchedule(r: Row): BackupSchedule {
  return {
    id: r.id as string,
    semesterId: r.semester_id as string,
    courseInstanceId: (r.course_instance_id as string) ?? undefined,
    cronExpression: r.cron_expression as string,
    timezone: r.timezone as string,
    enabled: Boolean(r.enabled),
    lastRunAt: (r.last_run_at as string) ?? undefined,
    nextRunAt: (r.next_run_at as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
