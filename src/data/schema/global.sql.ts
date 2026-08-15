/**
 * T-M0-006 global.db schema DDL（05-ERD §2 + §7.1）
 *
 * 全局库：学期注册表 + 家长报告目标 + 备份记录 + 备份调度。
 * 所有表 id TEXT PRIMARY KEY（UUID v4，应用层生成），时间戳 ISO 8601 UTC。
 */

/** global.db 4 表 DDL + 索引（05-ERD §2） */
export const GLOBAL_SCHEMA_SQL = `
-- 2.1 semesters（学期索引）
-- 幂等（IF NOT EXISTS）：复用 dataRoot 二次启动（E2E-13 跨进程持久化）不报 already exists
CREATE TABLE IF NOT EXISTS semesters (
  id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  semester_label TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'teaching_ended', 'follow_up', 'archived')),
  db_relative_path TEXT NOT NULL,
  ready INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_semesters_status ON semesters(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_semesters_label ON semesters(semester_label);

-- 2.2 parent_report_targets（家长报告目标配置）
CREATE TABLE IF NOT EXISTS parent_report_targets (
  id TEXT PRIMARY KEY,
  semester_id TEXT NOT NULL REFERENCES semesters(id),
  target_name TEXT NOT NULL,
  channel_type TEXT NOT NULL
    CHECK (channel_type IN ('local_export', 'smtp', 'feishu_webhook', 'print')),
  channel_config_json TEXT NOT NULL,
  credential_key TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_report_targets_semester ON parent_report_targets(semester_id) WHERE deleted_at IS NULL;

-- 2.3 backup_records（备份历史）
CREATE TABLE IF NOT EXISTS backup_records (
  id TEXT PRIMARY KEY,
  semester_id TEXT NOT NULL REFERENCES semesters(id),
  course_instance_id TEXT NOT NULL,
  backup_type TEXT NOT NULL
    CHECK (backup_type IN ('manual', 'scheduled', 'pre_archive', 'post_archive', 'semester')),
  target_path TEXT NOT NULL,
  zip_filename TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('in_progress', 'completed', 'failed')),
  error_code TEXT,
  schedule_cron TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_backup_semester ON backup_records(semester_id);
CREATE INDEX IF NOT EXISTS idx_backup_course ON backup_records(course_instance_id);
CREATE INDEX IF NOT EXISTS idx_backup_type ON backup_records(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_created ON backup_records(created_at DESC);

-- 2.4 backup_schedules（备份调度配置）
CREATE TABLE IF NOT EXISTS backup_schedules (
  id TEXT PRIMARY KEY,
  semester_id TEXT NOT NULL REFERENCES semesters(id),
  course_instance_id TEXT,
  cron_expression TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_backup_sched_enabled ON backup_schedules(enabled) WHERE enabled = 1;
`;

/** global.db 表名清单（供测试断言） */
export const GLOBAL_TABLES = [
  "semesters",
  "parent_report_targets",
  "backup_records",
  "backup_schedules",
];

/** global.db 索引名清单（供测试断言，05-ERD §7.1） */
export const GLOBAL_INDEXES = [
  "idx_semesters_status",
  "idx_semesters_label",
  "idx_report_targets_semester",
  "idx_backup_semester",
  "idx_backup_course",
  "idx_backup_type",
  "idx_backup_created",
  "idx_backup_sched_enabled",
];