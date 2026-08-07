/**
 * T-M2-005 备份恢复 7 handler 实现（06-API §3.11 + 07-WF §5 + 05-ERD §2.3/§2.4/§8.1-§8.3）
 *
 * 7 方法：
 *   - backup.course：单课程备份为 zip + content_hash + 写 backup_records
 *   - backup.allCourses：全课程备份（遍历 course_instances 逐个 backup.course）
 *   - backup.restore：解压 + content_hash 校验 + 冲突处理 + 导入 + integrity_check
 *   - backup.list：从 backup_records 查询（按 semesterId/courseInstanceId 过滤）
 *   - backup.configureSchedule：写 backup_schedules（cron_expression + timezone）
 *   - backup.listSchedules：查询 backup_schedules
 *   - backup.toggleSchedule：启用/禁用调度
 *
 * 安全（AGENTS.md §9.4 + 07-WF §5.5）：
 *   - 错误消息固定文案，不泄漏路径/SQL/栈
 *   - backup_records 状态机 in_progress→completed/failed
 *   - Streams["backup.progress"] 推送进度
 */
import { randomUUID } from "node:crypto";
import type { BackupRecord, BackupSchedule, RestoreResult, BackupType } from "../../../contract/types";
import type { BackupContext, BackupProgressEvent } from "./context";
import { packCourse } from "./zip-packer";
import { restoreCourse } from "./zip-restorer";
import { findSemesterByCourseId, listCourseIdsBySemester } from "./lookup";
import { mapBackupRecord, mapBackupSchedule } from "./dto";
import { notFound, badRequest, internalError, MSG } from "./errors";

function now(): string {
  return new Date().toISOString();
}

/** 写 backup_records 行（in_progress） */
function insertBackupRecord(
  ctx: BackupContext,
  params: {
    semesterId: string;
    courseInstanceId: string;
    backupType: BackupType;
    targetPath: string;
    zipFilename: string;
    contentHash: string;
    fileSizeBytes: number;
    status: "in_progress" | "completed" | "failed";
    scheduleCron?: string;
    errorCode?: string;
  },
): BackupRecord {
  const id = randomUUID();
  const startedAt = now();
  const completedAt = params.status !== "in_progress" ? now() : undefined;
  const createdAt = now();

  ctx.globalDb
    .prepare(
      `INSERT INTO backup_records (id, semester_id, course_instance_id, backup_type, target_path, zip_filename,
        content_hash, file_size_bytes, status, error_code, schedule_cron, started_at, completed_at, created_at)
       VALUES (@id, @semesterId, @courseInstanceId, @backupType, @targetPath, @zipFilename,
        @contentHash, @fileSizeBytes, @status, @errorCode, @scheduleCron, @startedAt, @completedAt, @createdAt)`,
    )
    .run({
      ...params,
      id,
      completedAt: completedAt ?? null,
      errorCode: params.errorCode ?? null,
      scheduleCron: params.scheduleCron ?? null,
      startedAt,
      createdAt,
    });

  return {
    id,
    semesterId: params.semesterId,
    courseInstanceId: params.courseInstanceId,
    backupType: params.backupType,
    targetPath: params.targetPath,
    zipFilename: params.zipFilename,
    contentHash: params.contentHash,
    fileSizeBytes: params.fileSizeBytes,
    status: params.status,
    errorCode: params.errorCode,
    scheduleCron: params.scheduleCron,
    startedAt,
    completedAt,
    createdAt,
  };
}

/** 更新 backup_records 状态为 completed/failed */
function updateBackupRecordStatus(
  ctx: BackupContext,
  id: string,
  status: "completed" | "failed",
  errorCode?: string,
): void {
  ctx.globalDb
    .prepare("UPDATE backup_records SET status = @status, completed_at = @now, error_code = @errorCode WHERE id = @id")
    .run({ id, status, now: now(), errorCode: errorCode ?? null });
}

/**
 * backup.course handler 工厂。
 * 单课程备份为 zip + content_hash + 写 backup_records(manual)。
 */
export function handleBackupCourse(
  ctx: BackupContext,
): (params: unknown) => Promise<BackupRecord> {
  return async (params: unknown): Promise<BackupRecord> => {
    const p = params as { courseInstanceId: string; targetPath: string };
    if (!p.courseInstanceId || !p.targetPath) throw badRequest("缺少必要参数");

    // 定位 semester
    const { semesterId } = findSemesterByCourseId(ctx, p.courseInstanceId);

    // 先写 in_progress 记录
    const recordId = randomUUID();
    const startedAt = now();
    ctx.globalDb
      .prepare(
        `INSERT INTO backup_records (id, semester_id, course_instance_id, backup_type, target_path, zip_filename,
          content_hash, file_size_bytes, status, started_at, created_at)
         VALUES (@id, @semesterId, @courseInstanceId, 'manual', @targetPath, '', '', 0, 'in_progress', @startedAt, @createdAt)`,
      )
      .run({ id: recordId, semesterId, courseInstanceId: p.courseInstanceId, targetPath: p.targetPath, startedAt, createdAt: startedAt });

    try {
      const emit = ctx.emit
        ? (event: BackupProgressEvent) => ctx.emit!(event)
        : undefined;
      const packResult = packCourse(ctx, p.courseInstanceId, p.targetPath, "manual", emit);

      // 更新记录为 completed
      ctx.globalDb
        .prepare(
          `UPDATE backup_records SET zip_filename = @zipFilename, content_hash = @contentHash,
           file_size_bytes = @fileSizeBytes, status = 'completed', completed_at = @now WHERE id = @id`,
        )
        .run({
          id: recordId,
          zipFilename: packResult.zipFilename,
          contentHash: packResult.contentHash,
          fileSizeBytes: packResult.fileSizeBytes,
          now: now(),
        });

      const row = ctx.globalDb
        .prepare("SELECT * FROM backup_records WHERE id = @id")
        .get({ id: recordId }) as Record<string, unknown>;
      return mapBackupRecord(row);
    } catch (e) {
      updateBackupRecordStatus(ctx, recordId, "failed", "BACKUP_FAILED");
      throw internalError(MSG.BACKUP_FAILED);
    }
  };
}

/**
 * backup.allCourses handler 工厂。
 * 全课程备份（遍历 course_instances 逐个 backup.course）。
 */
export function handleBackupAllCourses(
  ctx: BackupContext,
): (params: unknown) => Promise<BackupRecord[]> {
  return async (params: unknown): Promise<BackupRecord[]> => {
    const p = params as { semesterId: string; targetPath: string };
    if (!p.semesterId || !p.targetPath) throw badRequest("缺少必要参数");

    const courseIds = listCourseIdsBySemester(ctx, p.semesterId);
    const records: BackupRecord[] = [];

    for (const courseId of courseIds) {
      const backupFn = handleBackupCourse(ctx);
      const record = await backupFn({ courseInstanceId: courseId, targetPath: p.targetPath });
      records.push(record);
    }

    return records;
  };
}

/**
 * backup.restore handler 工厂。
 * 解压 + content_hash 校验 + 冲突处理 + 导入 + integrity_check。
 */
export function handleRestore(
  ctx: BackupContext,
): (params: unknown) => Promise<RestoreResult> {
  return async (params: unknown): Promise<RestoreResult> => {
    const p = params as {
      zipPath: string;
      targetSemesterId: string;
      conflictResolution?: "overwrite" | "create_new" | "none";
    };
    if (!p.zipPath || !p.targetSemesterId) throw badRequest("缺少必要参数");

    // 验证目标学期存在
    const sem = ctx.globalDb
      .prepare("SELECT id FROM semesters WHERE id = @id AND deleted_at IS NULL")
      .get({ id: p.targetSemesterId });
    if (!sem) throw notFound(MSG.SEMESTER_NOT_FOUND);

    return restoreCourse(ctx, {
      zipPath: p.zipPath,
      targetSemesterId: p.targetSemesterId,
      conflictResolution: p.conflictResolution,
    });
  };
}

/**
 * backup.list handler 工厂。
 * 从 backup_records 查询（按 semesterId/courseInstanceId 过滤）。
 */
export function handleList(
  ctx: BackupContext,
): (params: unknown) => Promise<BackupRecord[]> {
  return async (params: unknown): Promise<BackupRecord[]> => {
    const p = params as { semesterId?: string; courseInstanceId?: string };

    let sql = "SELECT * FROM backup_records WHERE 1=1";
    const args: Record<string, string> = {};
    if (p.semesterId) {
      sql += " AND semester_id = @semesterId";
      args.semesterId = p.semesterId;
    }
    if (p.courseInstanceId) {
      sql += " AND course_instance_id = @courseInstanceId";
      args.courseInstanceId = p.courseInstanceId;
    }
    sql += " ORDER BY created_at DESC";

    const rows = ctx.globalDb.prepare(sql).all(args) as Record<string, unknown>[];
    return rows.map(mapBackupRecord);
  };
}

/** 简单 cron 表达式校验（5 字段） */
function validateCronExpression(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  // 每个字段必须是数字、* 或含 / ,- 的范围表达式
  const validPattern = /^[\d*/,-]+$/;
  return parts.every((p) => validPattern.test(p));
}

/**
 * backup.configureSchedule handler 工厂。
 * 写 backup_schedules（cron_expression + timezone）。
 */
export function handleConfigureSchedule(
  ctx: BackupContext,
): (params: unknown) => Promise<BackupSchedule> {
  return async (params: unknown): Promise<BackupSchedule> => {
    const p = params as {
      semesterId: string;
      courseInstanceId?: string;
      cronExpression: string;
      timezone: string;
    };
    if (!p.semesterId || !p.cronExpression || !p.timezone) throw badRequest("缺少必要参数");
    if (!validateCronExpression(p.cronExpression)) throw badRequest(MSG.CRON_EXPRESSION_INVALID);

    const id = randomUUID();
    const ts = now();
    ctx.globalDb
      .prepare(
        `INSERT INTO backup_schedules (id, semester_id, course_instance_id, cron_expression, timezone,
          enabled, last_run_at, next_run_at, created_at, updated_at)
         VALUES (@id, @semesterId, @courseInstanceId, @cronExpression, @timezone, 1, NULL, NULL, @createdAt, @updatedAt)`,
      )
      .run({
        id,
        semesterId: p.semesterId,
        courseInstanceId: p.courseInstanceId ?? null,
        cronExpression: p.cronExpression,
        timezone: p.timezone,
        createdAt: ts,
        updatedAt: ts,
      });

    const row = ctx.globalDb
      .prepare("SELECT * FROM backup_schedules WHERE id = @id")
      .get({ id }) as Record<string, unknown>;
    return mapBackupSchedule(row);
  };
}

/**
 * backup.listSchedules handler 工厂。
 * 查询 backup_schedules。
 */
export function handleListSchedules(
  ctx: BackupContext,
): (params: unknown) => Promise<BackupSchedule[]> {
  return async (params: unknown): Promise<BackupSchedule[]> => {
    const p = params as { semesterId: string };
    if (!p.semesterId) throw badRequest("缺少必要参数");

    const rows = ctx.globalDb
      .prepare("SELECT * FROM backup_schedules WHERE semester_id = @semesterId ORDER BY created_at DESC")
      .all({ semesterId: p.semesterId }) as Record<string, unknown>[];
    return rows.map(mapBackupSchedule);
  };
}

/**
 * backup.toggleSchedule handler 工厂。
 * 启用/禁用调度。
 */
export function handleToggleSchedule(
  ctx: BackupContext,
): (params: unknown) => Promise<BackupSchedule> {
  return async (params: unknown): Promise<BackupSchedule> => {
    const p = params as { id: string; enabled: boolean };
    if (!p.id) throw badRequest("缺少必要参数");

    const existing = ctx.globalDb
      .prepare("SELECT 1 FROM backup_schedules WHERE id = @id")
      .get({ id: p.id });
    if (!existing) throw notFound(MSG.SCHEDULE_NOT_FOUND);

    ctx.globalDb
      .prepare("UPDATE backup_schedules SET enabled = @enabled, updated_at = @now WHERE id = @id")
      .run({ id: p.id, enabled: p.enabled ? 1 : 0, now: now() });

    const row = ctx.globalDb
      .prepare("SELECT * FROM backup_schedules WHERE id = @id")
      .get({ id: p.id }) as Record<string, unknown>;
    return mapBackupSchedule(row);
  };
}
