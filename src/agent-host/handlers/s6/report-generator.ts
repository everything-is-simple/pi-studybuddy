/**
 * T-M2-002 S6 规则报告生成器（07-WF §3.1 + 02-PRD §5.2 脱敏）
 *
 * 聚合 S1 study_events/study_tasks + S2 materials + S3 practice_sessions + S4 mistakes，
 * 生成 6 section 确定性只读脱敏报告：
 *   1. study_rhythm：学习节奏（任务完成数、事件数）
 *   2. materials：资料统计（数量、类型分布，不含原文）
 *   3. practice：练习统计（会话数、正确率，不含题干/答案/作答）
 *   4. mistakes：错题统计（数量、状态分布、六分类，不含错因正文）
 *   5. exam_reminder：考试提醒（已确认考试数、临近考试，不含考试名称原文 → 用相对天数）
 *   6. data_quality：数据完整性（各表记录数，供家长判断数据覆盖度）
 *
 * 全部使用 COUNT/SUM 聚合，不返回任何原始内容字段。
 * materials/knowledge_modules/practice_sessions/mistakes/weak_points/study_tasks/assessment_attempts
 * 通过 course_instance_id 子查询关联到 semester_id（这些表无直接 semester_id 列）。
 */
import type { DatabaseSync } from "../../../data/sqlite";
import type { RuleReport } from "./report-polisher";

/**
 * 生成规则报告（6 section，确定性只读脱敏）
 */
export function generateRuleReport(
  db: DatabaseSync,
  semesterId: string,
  periodStart: string,
  periodEnd: string,
): RuleReport {
  return {
    study_rhythm: buildStudyRhythm(db, semesterId, periodStart, periodEnd),
    materials: buildMaterials(db, semesterId),
    practice: buildPractice(db, semesterId, periodStart, periodEnd),
    mistakes: buildMistakes(db, semesterId),
    exam_reminder: buildExamReminder(db, semesterId, periodEnd),
    data_quality: buildDataQuality(db, semesterId),
  };
}

/** course_instance_id 子查询（关联 semester_id） */
const COURSE_IN_SEMESTER = (sid: string) =>
  `course_instance_id IN (SELECT id FROM course_instances WHERE semester_id = '${sid.replace(/'/g, "''")}' AND deleted_at IS NULL)`;

/** 学习节奏：任务完成数 + 事件数（按 source_system 分组） */
function buildStudyRhythm(
  db: DatabaseSync,
  semesterId: string,
  periodStart: string,
  periodEnd: string,
): Record<string, unknown> {
  const taskCompleted = (
    db
      .prepare(
        `SELECT COUNT(*) as cnt FROM study_events
         WHERE semester_id = @sid AND event_type = 'task_completed'
           AND occurred_at >= @ps AND occurred_at <= @pe`,
      )
      .get({ sid: semesterId, ps: periodStart, pe: periodEnd + "T23:59:59Z" }) as { cnt: number }
  ).cnt;

  const eventBySource = db
    .prepare(
      `SELECT source_system, COUNT(*) as cnt FROM study_events
       WHERE semester_id = @sid AND occurred_at >= @ps AND occurred_at <= @pe
       GROUP BY source_system`,
    )
    .all({ sid: semesterId, ps: periodStart, pe: periodEnd + "T23:59:59Z" }) as Array<{
    source_system: string;
    cnt: number;
  }>;

  return {
    task_completed_count: taskCompleted,
    events_by_source: Object.fromEntries(
      eventBySource.map((r) => [r.source_system, r.cnt]),
    ),
    period_start: periodStart,
    period_end: periodEnd,
  };
}

/** 资料统计：数量 + 类型分布（不含原文） */
function buildMaterials(db: DatabaseSync, semesterId: string): Record<string, unknown> {
  const where = COURSE_IN_SEMESTER(semesterId);
  const total = (
    db.prepare(`SELECT COUNT(*) as cnt FROM materials WHERE ${where}`).get() as { cnt: number }
  ).cnt;

  const byType = db
    .prepare(`SELECT file_type, COUNT(*) as cnt FROM materials WHERE ${where} GROUP BY file_type`)
    .all() as Array<{ file_type: string; cnt: number }>;

  const modulesCount = (
    db
      .prepare(`SELECT COUNT(*) as cnt FROM knowledge_modules WHERE ${where}`)
      .get() as { cnt: number }
  ).cnt;

  return {
    total_count: total,
    by_type: Object.fromEntries(byType.map((r) => [r.file_type, r.cnt])),
    knowledge_modules_count: modulesCount,
  };
}

/** 练习统计：会话数 + 正确率（不含题干/答案/作答） */
function buildPractice(
  db: DatabaseSync,
  semesterId: string,
  periodStart: string,
  periodEnd: string,
): Record<string, unknown> {
  const where = COURSE_IN_SEMESTER(semesterId);
  const sessionCount = (
    db
      .prepare(
        `SELECT COUNT(*) as cnt FROM practice_sessions
         WHERE ${where} AND started_at >= @ps AND started_at <= @pe`,
      )
      .get({ ps: periodStart, pe: periodEnd + "T23:59:59Z" }) as { cnt: number }
  ).cnt;

  const submittedCount = (
    db
      .prepare(
        `SELECT COUNT(*) as cnt FROM practice_sessions
         WHERE ${where} AND status = 'submitted'
           AND started_at >= @ps AND started_at <= @pe`,
      )
      .get({ ps: periodStart, pe: periodEnd + "T23:59:59Z" }) as { cnt: number }
  ).cnt;

  const avgCorrectRate = (
    db
      .prepare(
        `SELECT AVG(CASE WHEN max_score > 0 THEN total_score * 1.0 / max_score ELSE 0 END) as rate
         FROM practice_sessions
         WHERE ${where} AND status = 'graded'
           AND started_at >= @ps AND started_at <= @pe`,
      )
      .get({ ps: periodStart, pe: periodEnd + "T23:59:59Z" }) as { rate: number | null }
  ).rate;

  return {
    session_count: sessionCount,
    submitted_count: submittedCount,
    avg_correct_rate: avgCorrectRate ?? 0,
  };
}

/** 错题统计：数量 + 状态分布 + 六分类（不含错因正文） */
function buildMistakes(db: DatabaseSync, semesterId: string): Record<string, unknown> {
  const where = COURSE_IN_SEMESTER(semesterId);
  const total = (
    db.prepare(`SELECT COUNT(*) as cnt FROM mistakes WHERE ${where}`).get() as { cnt: number }
  ).cnt;

  const byStatus = db
    .prepare(`SELECT status, COUNT(*) as cnt FROM mistakes WHERE ${where} GROUP BY status`)
    .all() as Array<{ status: string; cnt: number }>;

  const byCategory = db
    .prepare(
      `SELECT error_cause_category as category, COUNT(*) as cnt FROM mistakes
       WHERE ${where} AND error_cause_category IS NOT NULL GROUP BY error_cause_category`,
    )
    .all() as Array<{ category: string; cnt: number }>;

  const weakPointCount = (
    db
      .prepare(`SELECT COUNT(*) as cnt FROM weak_points WHERE ${where}`)
      .get() as { cnt: number }
  ).cnt;

  return {
    total_count: total,
    by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.cnt])),
    by_category: Object.fromEntries(byCategory.map((r) => [r.category, r.cnt])),
    weak_point_count: weakPointCount,
  };
}

/** 考试提醒：已确认考试数 + 临近考试（相对天数，不含考试名称原文） */
function buildExamReminder(
  db: DatabaseSync,
  semesterId: string,
  periodEnd: string,
): Record<string, unknown> {
  const where = COURSE_IN_SEMESTER(semesterId);
  const confirmedCount = (
    db
      .prepare(
        `SELECT COUNT(*) as cnt FROM assessment_attempts WHERE ${where} AND confirmation_status = 'confirmed' AND deleted_at IS NULL`,
      )
      .get() as { cnt: number }
  ).cnt;

  const upcoming = db
    .prepare(
      `SELECT scheduled_date FROM assessment_attempts
       WHERE ${where} AND confirmation_status = 'confirmed' AND deleted_at IS NULL
         AND scheduled_date > @pe
         AND scheduled_date <= @pe14
       ORDER BY scheduled_date ASC`,
    )
    .all({ pe: periodEnd, pe14: addDays(periodEnd, 14) }) as Array<{
    scheduled_date: string;
  }>;

  return {
    confirmed_count: confirmedCount,
    upcoming_count: upcoming.length,
    upcoming_relative_days: upcoming.map((r) => daysBetween(periodEnd, r.scheduled_date)),
  };
}

/** 数据完整性：各表记录数（study_events 直接 semester_id，其他用 course_instance_id 子查询） */
function buildDataQuality(db: DatabaseSync, semesterId: string): Record<string, unknown> {
  const where = COURSE_IN_SEMESTER(semesterId);
  const counts: Record<string, number> = {};

  // study_events 有 semester_id 列
  counts.study_events = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM study_events WHERE semester_id = @sid")
      .get({ sid: semesterId }) as { cnt: number }
  ).cnt;

  // 其他表用 course_instance_id 子查询
  const tables = [
    "study_tasks",
    "materials",
    "knowledge_modules",
    "practice_sessions",
    "mistakes",
    "weak_points",
    "assessment_attempts",
  ];
  for (const t of tables) {
    try {
      counts[t] = (
        db.prepare(`SELECT COUNT(*) as cnt FROM ${t} WHERE ${where}`).get() as { cnt: number }
      ).cnt;
    } catch {
      counts[t] = 0;
    }
  }
  return counts;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00Z").getTime();
  const e = new Date(end + "T00:00:00Z").getTime();
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}
