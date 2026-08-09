/**
 * 左侧栏学期/课程树（T-M4-007，09-UI §3.1/§3.2）。
 * 组件只负责安全展示与事件回调，不保存第二份当前学期/课程状态，也不直接调用 RPC。
 */
import React from "react";
import type { Semester } from "../../contract/types";
import {
  academicLoadErrorText,
  safeAcademicDisplayText,
  semesterStatusText,
  type CourseLoadState,
  type SemesterCourseContext,
  type SemesterLoadState,
} from "../semester-course-state";

interface Props {
  semesters: Semester[];
  semesterLoadState: SemesterLoadState;
  expandedSemesterIds: string[];
  courseStates: Record<string, CourseLoadState>;
  context: SemesterCourseContext;
  onToggleSemester: (semesterId: string) => void;
  onSelectCourse: (semesterId: string, courseId: string) => void;
}

const panelBorder = "1px solid var(--border, #e0e0e0)";

/** 返回设计文档约定的学期状态圆点颜色。 */
function semesterStatusColor(status: Semester["status"]): string {
  switch (status) {
    case "active":
      return "#12b76a";
    case "teaching_ended":
      return "#f79009";
    case "follow_up":
      return "#2e90fa";
    case "archived":
      return "#98a2b3";
  }
}

/** 渲染展开学期的课程分支及 loading、empty、error 状态。 */
function CourseBranch({
  semester,
  courseState,
  context,
  onSelectCourse,
}: {
  semester: Semester;
  courseState: CourseLoadState | undefined;
  context: SemesterCourseContext;
  onSelectCourse: (semesterId: string, courseId: string) => void;
}): React.JSX.Element {
  if (!courseState || courseState.status === "idle" || courseState.status === "loading") {
    return <div style={{ padding: "5px 8px 5px 24px", color: "var(--text-muted, #777)" }}>正在加载课程…</div>;
  }
  if (courseState.status === "error") {
    return <div style={{ padding: "5px 8px 5px 24px", color: "var(--danger, #b42318)" }}>{academicLoadErrorText("courses")}</div>;
  }
  if (courseState.courses.length === 0) {
    return <div style={{ padding: "5px 8px 5px 24px", color: "var(--text-muted, #777)" }}>该学期暂未添加课程。</div>;
  }

  const readOnlyLabel = semester.status === "archived" ? "（已归档，只读浏览）" : "";
  return (
    <div role="group" aria-label={`${safeAcademicDisplayText(semester.label, "未命名学期")}的课程${readOnlyLabel}`}>
      {courseState.courses.map((course) => {
        const selected = context.semesterId === semester.id && context.courseId === course.id;
        return (
          <button
            key={course.id}
            type="button"
            aria-current={selected ? "true" : undefined}
            onClick={() => onSelectCourse(semester.id, course.id)}
            style={{
              display: "block",
              width: "100%",
              padding: "5px 8px 5px 24px",
              border: 0,
              background: selected ? "var(--accent, #e8f0fe)" : "transparent",
              color: "var(--text, #222)",
              cursor: "pointer",
              textAlign: "left",
              borderRadius: 4,
            }}
          >
            {safeAcademicDisplayText(course.courseName, "未命名课程")}
          </button>
        );
      })}
    </div>
  );
}

/** 渲染左栏学期树：展开/收起，课程选择以及归档只读状态。 */
export function SemesterCourseTree({
  semesters,
  semesterLoadState,
  expandedSemesterIds,
  courseStates,
  context,
  onToggleSemester,
  onSelectCourse,
}: Props): React.JSX.Element {
  return (
    <section aria-label="学期和课程" style={{ paddingBottom: 12, borderBottom: panelBorder }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--text, #222)" }}>学期</div>
      {semesterLoadState === "idle" && <div style={{ color: "var(--text-muted, #777)" }}>正在等待本机学习数据连接…</div>}
      {semesterLoadState === "loading" && <div style={{ color: "var(--text-muted, #777)" }}>正在加载学期…</div>}
      {semesterLoadState === "error" && <div style={{ color: "var(--danger, #b42318)" }}>{academicLoadErrorText("semesters")}</div>}
      {semesterLoadState === "ready" && semesters.length === 0 && (
        <div style={{ color: "var(--text-muted, #777)" }}>还没有学期，请先在学习计划中创建。</div>
      )}
      {semesterLoadState === "ready" && semesters.map((semester) => {
        const expanded = expandedSemesterIds.includes(semester.id);
        const selected = context.semesterId === semester.id;
        const title = safeAcademicDisplayText(semester.label, "未命名学期");
        return (
          <div key={semester.id} style={{ marginTop: 3 }}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-current={selected ? "true" : undefined}
              onClick={() => onToggleSemester(semester.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                width: "100%",
                padding: "6px 8px",
                border: 0,
                background: selected ? "var(--accent, #e8f0fe)" : "transparent",
                color: "var(--text, #222)",
                cursor: "pointer",
                textAlign: "left",
                borderRadius: 4,
              }}
            >
              <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
              <span
                aria-hidden="true"
                style={{ width: 8, height: 8, flexShrink: 0, borderRadius: "50%", background: semesterStatusColor(semester.status) }}
              />
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
              <span style={{ marginLeft: "auto", color: "var(--text-muted, #777)", fontSize: 11 }}>{semesterStatusText(semester.status)}</span>
            </button>
            {expanded && (
              <>
                {semester.status === "archived" && (
                  <div style={{ padding: "5px 8px 0 24px", color: "var(--text-muted, #777)", fontSize: 11 }}>
                    归档学期，只读浏览
                  </div>
                )}
                <CourseBranch
                  semester={semester}
                  courseState={courseStates[semester.id]}
                  context={context}
                  onSelectCourse={onSelectCourse}
                />
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
