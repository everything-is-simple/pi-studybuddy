/**
 * T-M1-001 S1 handler DTO 映射（05-ERD §2.1 + §3.1 → contract/types.ts DTO）
 *
 * 把 db 行（snake_case）映射为 DTO（camelCase），对齐 05-ERD schema 字段。
 */
import type {
  Semester,
  CourseInstance,
  AssessmentAttempt,
  ScheduleEntry,
  StudyTask,
  StudyEvent,
  DailyBrief,
} from "../../../contract/types";

type Row = Record<string, unknown>;

export function mapSemester(r: Row): Semester {
  return {
    id: r.id as string,
    studentName: r.student_name as string,
    label: r.semester_label as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    timezone: r.timezone as string,
    status: r.status as Semester["status"],
    dbRelativePath: r.db_relative_path as string,
    ready: r.ready as number,
    archivedAt: (r.archived_at as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function mapCourse(r: Row): CourseInstance {
  return {
    id: r.id as string,
    semesterId: r.semester_id as string,
    courseName: r.course_name as string,
    subject: r.subject as string,
    teacher: (r.teacher as string) ?? undefined,
    dailyMinutesTarget: (r.daily_minutes_target as number) ?? undefined,
    availableTimeJson: (r.available_time_json as string) ?? undefined,
    targetScoreJson: (r.target_score_json as string) ?? undefined,
    retakeOf: (r.retake_of as string) ?? undefined,
    status: r.status as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function mapAssessment(r: Row): AssessmentAttempt {
  return {
    id: r.id as string,
    courseId: r.course_instance_id as string,
    examName: r.exam_name as string,
    examType: r.exam_type as AssessmentAttempt["examType"],
    scheduledDate: (r.scheduled_date as string) ?? "",
    actualDate: (r.actual_date as string) ?? undefined,
    source: r.source as AssessmentAttempt["source"],
    confidence: (r.confidence as number) ?? undefined,
    confirmationStatus: r.confirmation_status as AssessmentAttempt["confirmationStatus"],
    confirmedAt: (r.confirmed_at as string) ?? undefined,
    confirmedBy: (r.confirmed_by as string) ?? undefined,
    changeHistoryJson: (r.change_history_json as string) ?? undefined,
    retakeOf: (r.retake_of as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function mapSchedule(r: Row): ScheduleEntry {
  return {
    id: r.id as string,
    courseId: r.course_instance_id as string,
    weekday: r.weekday as number,
    startTime: r.start_time as string,
    endTime: r.end_time as string,
    location: (r.location as string) ?? undefined,
    weekPattern: (r.week_pattern as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function mapTask(r: Row): StudyTask {
  return {
    id: r.id as string,
    courseId: r.course_instance_id as string,
    title: r.title as string,
    description: (r.description as string) ?? undefined,
    taskType: r.task_type as StudyTask["taskType"],
    status: r.status as StudyTask["status"],
    dueDate: (r.due_date as string) ?? undefined,
    priority: r.priority as number,
    sourceSystem: r.source_system as string,
    sourceRefId: (r.source_ref_id as string) ?? undefined,
    completedAt: (r.completed_at as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function mapEvent(r: Row): StudyEvent {
  return {
    id: r.id as string,
    semesterId: r.semester_id as string,
    courseId: (r.course_instance_id as string) ?? undefined,
    eventType: r.event_type as string,
    sourceSystem: r.source_system as StudyEvent["sourceSystem"],
    sourceRefId: (r.source_ref_id as string) ?? undefined,
    eventDataJson: (r.event_data_json as string) ?? undefined,
    occurredAt: r.occurred_at as string,
    createdAt: r.created_at as string,
  };
}

export function mapDailyBrief(date: string, tasks: StudyTask[]): DailyBrief {
  return {
    date,
    tasks,
    pendingItems: tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length,
  };
}
