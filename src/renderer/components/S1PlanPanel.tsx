/**
 * T-M5-002 S1 学习计划管理面板。
 * 只消费既有 S1 RPC；不把内部 ID、路径或原始异常写入可见文本。
 */
import React from "react";
import type { AssessmentAttempt, CourseInstance, ScheduleEntry, Semester, StudyTask } from "../../contract/types";
import type { TypedRpcClient } from "../rpc-client";
import type { SemesterCourseContext } from "../semester-course-state";
import { TabContainer } from "./common/TabContainer";

const fixedError = "操作失败，请检查填写内容后重试。";
const loadError = "暂时无法加载学习计划，请稍后重试。";

type PlanProps = {
  rpc: TypedRpcClient;
  semester: Semester;
  course: CourseInstance;
  readOnly: boolean;
  onChanged?: () => void;
  onNavigateBackup?: () => void;
};

type FormState = {
  examName: string;
  examType: "midterm" | "final" | "makeup" | "retake" | "quiz";
  examDate: string;
  weekday: string;
  startTime: string;
  endTime: string;
  location: string;
  taskTitle: string;
  taskType: "review" | "practice" | "note" | "exam_prep" | "other";
  taskDate: string;
  priority: string;
};

const initialForm: FormState = {
  examName: "",
  examType: "final",
  examDate: "",
  weekday: "1",
  startTime: "08:00",
  endTime: "09:30",
  location: "",
  taskTitle: "",
  taskType: "review",
  taskDate: "",
  priority: "3",
};

function safeError(): string {
  return fixedError;
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted, #667085)" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  minHeight: 32,
  boxSizing: "border-box",
  padding: "6px 8px",
  border: "1px solid var(--border, #d0d5dd)",
  borderRadius: 4,
  background: "var(--bg, #fff)",
  color: "var(--text, #222)",
};

const buttonStyle: React.CSSProperties = {
  minHeight: 32,
  padding: "6px 10px",
  border: "1px solid var(--border, #d0d5dd)",
  borderRadius: 4,
  background: "var(--bg-panel, #f5f5f5)",
  color: "var(--text, #222)",
  cursor: "pointer",
};

function ActionButton({ children, disabled, onClick, kind = "default" }: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  kind?: "default" | "primary" | "danger";
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...buttonStyle,
        background: kind === "primary" ? "var(--accent, #e8f0fe)" : kind === "danger" ? "#fff1f0" : buttonStyle.background,
        color: kind === "danger" ? "#b42318" : buttonStyle.color,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }): React.JSX.Element {
  return (
    <section style={{ padding: 14, border: "1px solid var(--border, #e0e0e0)", borderRadius: 6, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function S1PlanPanel({ rpc, semester, course, readOnly, onChanged, onNavigateBackup }: PlanProps): React.JSX.Element {
  const [exams, setExams] = React.useState<AssessmentAttempt[]>([]);
  const [schedule, setSchedule] = React.useState<ScheduleEntry[]>([]);
  const [tasks, setTasks] = React.useState<StudyTask[]>([]);
  const [form, setForm] = React.useState<FormState>(initialForm);
  const [openForm, setOpenForm] = React.useState<"exam" | "schedule" | "task" | null>(null);
  const [editingScheduleId, setEditingScheduleId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<"semester" | "course" | null>(null);
  const [semesterLabel, setSemesterLabel] = React.useState(semester.label);
  const [courseName, setCourseName] = React.useState(course.courseName);
  const [subject, setSubject] = React.useState(course.subject);
  const [backupConfirmed, setBackupConfirmed] = React.useState(false);
  const retryActionRef = React.useRef<(() => void) | undefined>(undefined);

  React.useEffect(() => {
    setSemesterLabel(semester.label);
    setCourseName(course.courseName);
    setSubject(course.subject);
    setBackupConfirmed(false);
  }, [semester.id, semester.label, course.id, course.courseName, course.subject]);

  const loadData = React.useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [nextExams, nextSchedule, nextTasks] = await Promise.all([
        rpc.call("exams.list", { courseId: course.id }),
        rpc.call("schedule.list", { courseId: course.id }),
        rpc.call("tasks.list", { courseId: course.id }),
      ]);
      setExams(nextExams);
      setSchedule(nextSchedule);
      setTasks(nextTasks);
      setLoaded(true);
    } catch {
      setError(loadError);
    }
  }, [course.id, rpc]);

  React.useEffect(() => {
    setLoaded(false);
    void loadData();
  }, [loadData]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function mutate(key: string, operation: () => Promise<void>): Promise<void> {
    setBusy(key);
    setError(null);
    try {
      await operation();
      retryActionRef.current = undefined;
      await loadData();
      onChanged?.();
    } catch {
      retryActionRef.current = () => { void mutate(key, operation); };
      setError(safeError());
    } finally {
      setBusy(null);
    }
  }

  function closeForm(): void {
    setOpenForm(null);
    setEditingScheduleId(null);
    setForm(initialForm);
    setError(null);
  }

  function beginScheduleEdit(entry: ScheduleEntry): void {
    setForm((current) => ({ ...current, weekday: String(entry.weekday), startTime: entry.startTime, endTime: entry.endTime, location: entry.location ?? "" }));
    setEditingScheduleId(entry.id);
    setOpenForm("schedule");
    setError(null);
  }

  function saveExam(): void {
    if (!form.examName.trim() || !form.examDate) {
      setError("请填写考试名称和考试日期。");
      return;
    }
    void mutate("exam", async () => {
      await rpc.call("exams.add", {
        courseId: course.id,
        examName: form.examName.trim(),
        examType: form.examType,
        scheduledDate: form.examDate,
        source: "student_input",
      });
      closeForm();
    });
  }

  function saveSchedule(): void {
    if (!form.startTime || !form.endTime || form.startTime >= form.endTime) {
      setError("结束时间必须晚于开始时间。");
      return;
    }
    void mutate(editingScheduleId ? `schedule-update-${editingScheduleId}` : "schedule", async () => {
      if (editingScheduleId) {
        await rpc.call("schedule.update", {
          id: editingScheduleId,
          weekday: Number(form.weekday),
          startTime: form.startTime,
          endTime: form.endTime,
          location: form.location.trim() || undefined,
        });
      } else {
        await rpc.call("schedule.create", {
          courseId: course.id,
          weekday: Number(form.weekday),
          startTime: form.startTime,
          endTime: form.endTime,
          location: form.location.trim() || undefined,
        });
      }
      closeForm();
    });
  }

  function saveTask(): void {
    if (!form.taskTitle.trim()) {
      setError("请填写任务名称。");
      return;
    }
    void mutate("task", async () => {
      await rpc.call("tasks.create", {
        courseId: course.id,
        title: form.taskTitle.trim(),
        taskType: form.taskType,
        dueDate: form.taskDate || undefined,
        priority: Number(form.priority),
      });
      closeForm();
    });
  }

  const nextSemesterStatus: Record<Semester["status"], { status: Semester["status"]; label: string } | undefined> = {
    active: { status: "teaching_ended", label: "标记教学结束" },
    teaching_ended: { status: "follow_up", label: "进入跟进阶段" },
    follow_up: { status: "archived", label: "归档学期" },
    archived: undefined,
  };
  const transition = nextSemesterStatus[semester.status];
  const writeDisabled = readOnly || busy !== null;
  return (
    <TabContainer>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17 }}>学习计划管理</h2>
          <div style={{ marginTop: 4, color: "var(--text-muted, #667085)", fontSize: 12 }}>{semester.label} / {course.courseName}</div>
        </div>
        {readOnly && <span role="status" style={{ color: "var(--text-muted, #667085)", fontSize: 12 }}>当前学期已归档，仅支持浏览。</span>}
      </div>
      {error && <div role="alert" style={{ padding: 10, marginBottom: 12, color: "#b42318", background: "#fff1f0", borderRadius: 4 }}>{error} <ActionButton onClick={() => retryActionRef.current ? retryActionRef.current() : void loadData()}>重试</ActionButton></div>}
      {!loaded && !error && <div role="status" style={{ padding: 10 }}>正在加载学习计划…</div>}

      <Section title="学期与课程">
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><strong>{semester.label}</strong><span style={{ color: "var(--text-muted, #667085)", fontSize: 12 }}>状态：{semester.status === "active" ? "进行中" : semester.status === "teaching_ended" ? "教学结束" : semester.status === "follow_up" ? "跟进中" : "已归档"}</span><ActionButton disabled={writeDisabled} onClick={() => setEditTarget(editTarget === "semester" ? null : "semester")}>编辑学期</ActionButton></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><strong>{course.courseName}</strong><span style={{ color: "var(--text-muted, #667085)", fontSize: 12 }}>{course.subject}</span><ActionButton disabled={writeDisabled} onClick={() => setEditTarget(editTarget === "course" ? null : "course")}>编辑课程</ActionButton></div>
          {editTarget === "semester" && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Field label="学期名称"><input aria-label="编辑学期名称" style={inputStyle} value={semesterLabel} onChange={(event) => setSemesterLabel(event.target.value)} /></Field><ActionButton disabled={writeDisabled} onClick={() => { if (!semesterLabel.trim()) { setError("请填写学期名称。"); return; } void mutate("semester-update", async () => { await rpc.call("semesters.update", { id: semester.id, label: semesterLabel.trim() }); setEditTarget(null); }); }} kind="primary">保存学期</ActionButton><ActionButton disabled={busy !== null} onClick={() => setEditTarget(null)}>取消</ActionButton></div>}
          {editTarget === "course" && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Field label="课程名称"><input aria-label="编辑课程名称" style={inputStyle} value={courseName} onChange={(event) => setCourseName(event.target.value)} /></Field><Field label="课程学科"><input aria-label="编辑课程学科" style={inputStyle} value={subject} onChange={(event) => setSubject(event.target.value)} /></Field><ActionButton disabled={writeDisabled} onClick={() => { if (!courseName.trim() || !subject.trim()) { setError("请填写课程名称和学科。"); return; } void mutate("course-update", async () => { await rpc.call("courses.update", { id: course.id, courseName: courseName.trim(), subject: subject.trim() }); setEditTarget(null); }); }} kind="primary">保存课程</ActionButton><ActionButton disabled={busy !== null} onClick={() => setEditTarget(null)}>取消</ActionButton></div>}
          {transition && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{transition.status === "archived" && <label style={{ fontSize: 12 }}><input type="checkbox" checked={backupConfirmed} onChange={(event) => setBackupConfirmed(event.target.checked)} /> 已在备份中心完成备份</label>}<ActionButton disabled={writeDisabled || (transition.status === "archived" && !backupConfirmed)} onClick={() => void mutate("semester-transition", async () => { await rpc.call("semesters.transition", { id: semester.id, status: transition.status }); })} kind={transition.status === "archived" ? "danger" : "default"}>{transition.label}</ActionButton>{transition.status === "archived" && <ActionButton disabled={busy !== null} onClick={onNavigateBackup}>前往备份中心</ActionButton>}</div>}
        </div>
      </Section>

      <Section title="考试" action={<ActionButton disabled={writeDisabled} onClick={() => setOpenForm(openForm === "exam" ? null : "exam")} kind="primary">新增考试</ActionButton>}>
        {exams.length === 0 && <div style={{ color: "var(--text-muted, #667085)", fontSize: 12 }}>暂无考试，可稍后添加。</div>}
        {exams.map((exam) => (
          <div key={exam.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border, #f0f0f0)" }}>
            <span>{exam.examName} · {exam.scheduledDate}</span>
            <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
              {exam.confirmationStatus === "confirmed" ? "已确认" : exam.confirmationStatus === "rejected" ? "已拒绝" : "待确认"}
              {exam.confirmationStatus === "pending" && <ActionButton disabled={writeDisabled} onClick={() => void mutate(`exam-confirm-${exam.id}`, async () => { await rpc.call("exams.confirm", { id: exam.id, confirmed: true }); })}>确认</ActionButton>}
            </span>
          </div>
        ))}
        {openForm === "exam" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, paddingTop: 12 }}>
            <Field label="考试名称"><input aria-label="考试名称" style={inputStyle} value={form.examName} onChange={(event) => updateForm("examName", event.target.value)} /></Field>
            <Field label="考试类型"><select aria-label="考试类型" style={inputStyle} value={form.examType} onChange={(event) => updateForm("examType", event.target.value as FormState["examType"])}><option value="midterm">期中</option><option value="final">期末</option><option value="quiz">小测</option><option value="makeup">补考</option><option value="retake">重修</option></select></Field>
            <Field label="考试日期"><input aria-label="考试日期" type="date" style={inputStyle} value={form.examDate} onChange={(event) => updateForm("examDate", event.target.value)} /></Field>
            <div style={{ display: "flex", gap: 8, alignItems: "end" }}><ActionButton disabled={writeDisabled} onClick={saveExam} kind="primary">保存考试</ActionButton><ActionButton disabled={busy !== null} onClick={closeForm}>取消</ActionButton></div>
          </div>
        )}
      </Section>

      <Section title="手工课表" action={<ActionButton disabled={writeDisabled} onClick={() => { if (openForm === "schedule") closeForm(); else { setEditingScheduleId(null); setOpenForm("schedule"); } }} kind="primary">新增课表</ActionButton>}>
        {schedule.length === 0 && <div style={{ color: "var(--text-muted, #667085)", fontSize: 12 }}>暂无课表，可手工添加。</div>}
        {schedule.map((entry) => (
          <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0" }}>
            <span>周{entry.weekday} {entry.startTime}-{entry.endTime}{entry.location ? ` · ${entry.location}` : ""}</span>
            <span style={{ display: "flex", gap: 6 }}><ActionButton disabled={writeDisabled} onClick={() => beginScheduleEdit(entry)}>编辑</ActionButton><ActionButton kind="danger" disabled={writeDisabled} onClick={() => void mutate(`schedule-delete-${entry.id}`, async () => { await rpc.call("schedule.delete", { id: entry.id }); })}>删除</ActionButton></span>
          </div>
        ))}
        {openForm === "schedule" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, paddingTop: 12 }}>
            <Field label="星期"><select aria-label="星期" style={inputStyle} value={form.weekday} onChange={(event) => updateForm("weekday", event.target.value)}>{[1, 2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>周{day}</option>)}</select></Field>
            <Field label="开始时间"><input aria-label="开始时间" type="time" style={inputStyle} value={form.startTime} onChange={(event) => updateForm("startTime", event.target.value)} /></Field>
            <Field label="结束时间"><input aria-label="结束时间" type="time" style={inputStyle} value={form.endTime} onChange={(event) => updateForm("endTime", event.target.value)} /></Field>
            <Field label="地点"><input aria-label="地点" style={inputStyle} value={form.location} onChange={(event) => updateForm("location", event.target.value)} /></Field>
            <div style={{ display: "flex", gap: 8, alignItems: "end" }}><ActionButton disabled={writeDisabled} onClick={saveSchedule} kind="primary">{editingScheduleId ? "保存修改" : "保存课表"}</ActionButton><ActionButton disabled={busy !== null} onClick={closeForm}>取消</ActionButton></div>
          </div>
        )}
      </Section>

      <Section title="学习任务" action={<ActionButton disabled={writeDisabled} onClick={() => setOpenForm(openForm === "task" ? null : "task")} kind="primary">新增任务</ActionButton>}>
        {tasks.length === 0 && <div style={{ color: "var(--text-muted, #667085)", fontSize: 12 }}>暂无任务，可添加今天要做的事。</div>}
        {tasks.map((task) => (
          <div key={task.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0" }}>
            <span>{task.title} · {task.status === "completed" ? "已完成" : "待办"}</span>
            {task.status !== "completed" && <ActionButton disabled={writeDisabled} onClick={() => void mutate(`task-complete-${task.id}`, async () => { await rpc.call("tasks.complete", { id: task.id }); })}>完成</ActionButton>}
          </div>
        ))}
        {openForm === "task" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, paddingTop: 12 }}>
            <Field label="任务名称"><input aria-label="任务名称" style={inputStyle} value={form.taskTitle} onChange={(event) => updateForm("taskTitle", event.target.value)} /></Field>
            <Field label="任务类型"><select aria-label="任务类型" style={inputStyle} value={form.taskType} onChange={(event) => updateForm("taskType", event.target.value as FormState["taskType"])}><option value="review">复习</option><option value="practice">练习</option><option value="note">笔记</option><option value="exam_prep">考试准备</option><option value="other">其他</option></select></Field>
            <Field label="截止日期"><input aria-label="截止日期" type="date" style={inputStyle} value={form.taskDate} onChange={(event) => updateForm("taskDate", event.target.value)} /></Field>
            <Field label="优先级"><select aria-label="优先级" style={inputStyle} value={form.priority} onChange={(event) => updateForm("priority", event.target.value)}>{[1, 2, 3, 4, 5].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></Field>
            <div style={{ display: "flex", gap: 8, alignItems: "end" }}><ActionButton disabled={writeDisabled} onClick={saveTask} kind="primary">保存任务</ActionButton><ActionButton disabled={busy !== null} onClick={closeForm}>取消</ActionButton></div>
          </div>
        )}
      </Section>
    </TabContainer>
  );
}

export function FirstRunWizard({ rpc, onCancel, onComplete }: {
  rpc: TypedRpcClient;
  onCancel: () => void;
  onComplete: (semester: Semester, course: CourseInstance) => void;
}): React.JSX.Element {
  const [step, setStep] = React.useState<"semester" | "course">("semester");
  const [semester, setSemester] = React.useState<Semester | null>(null);
  const [label, setLabel] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [courseName, setCourseName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function createSemester(): Promise<void> {
    if (!label.trim() || !startDate || !endDate || startDate >= endDate) {
      setError("请填写学期名称，并确保结束日期晚于开始日期。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await rpc.call("semesters.create", { label: label.trim(), startDate, endDate, timezone: "Asia/Shanghai" });
      setSemester(created);
      setStep("course");
    } catch {
      setError("学期创建失败，请检查填写内容后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function createCourse(): Promise<void> {
    if (!semester || !courseName.trim() || !subject.trim()) {
      setError("请填写课程名称和学科。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await rpc.call("courses.create", { semesterId: semester.id, courseName: courseName.trim(), subject: subject.trim() });
      onComplete(semester, created);
    } catch {
      setError("课程创建失败，请检查填写内容后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TabContainer>
      <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>开始建立学习计划</h2>
        <p style={{ color: "var(--text-muted, #667085)", fontSize: 13 }}>先创建一个学期和一门课程，之后可以在首页继续添加考试、课表和任务。</p>
        <div style={{ display: "flex", gap: 8, margin: "16px 0" }}><span aria-current={step === "semester" ? "step" : undefined}>1. 学期</span><span>→</span><span aria-current={step === "course" ? "step" : undefined}>2. 课程</span></div>
        {error && <div role="alert" style={{ padding: 10, marginBottom: 12, color: "#b42318", background: "#fff1f0", borderRadius: 4 }}>{error}</div>}
        {step === "semester" ? (
          <form onSubmit={(event) => { event.preventDefault(); void createSemester(); }} style={{ display: "grid", gap: 12 }}>
            <Field label="学期名称"><input aria-label="学期名称" autoFocus style={inputStyle} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="例如：2026 秋季学期" /></Field>
            <Field label="开始日期"><input aria-label="学期开始日期" type="date" style={inputStyle} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field>
            <Field label="结束日期"><input aria-label="学期结束日期" type="date" style={inputStyle} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field>
            <div style={{ display: "flex", gap: 8 }}><ActionButton disabled={busy} onClick={() => void createSemester()} kind="primary">下一步</ActionButton><ActionButton disabled={busy} onClick={onCancel}>取消</ActionButton></div>
          </form>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); void createCourse(); }} style={{ display: "grid", gap: 12 }}>
            <Field label="课程名称"><input aria-label="课程名称" autoFocus style={inputStyle} value={courseName} onChange={(event) => setCourseName(event.target.value)} placeholder="例如：高等数学" /></Field>
            <Field label="学科"><input aria-label="课程学科" style={inputStyle} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="例如：数学" /></Field>
            <div style={{ display: "flex", gap: 8 }}><ActionButton disabled={busy} onClick={() => void createCourse()} kind="primary">完成创建</ActionButton><ActionButton disabled={busy} onClick={onCancel}>取消</ActionButton></div>
          </form>
        )}
      </div>
    </TabContainer>
  );
}

export function CreateCourseForm({ rpc, semester, onCancel, onCreated }: {
  rpc: TypedRpcClient;
  semester: Semester;
  onCancel: () => void;
  onCreated: (course: CourseInstance) => void;
}): React.JSX.Element {
  const [courseName, setCourseName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  async function save(): Promise<void> {
    if (!courseName.trim() || !subject.trim()) { setError("请填写课程名称和学科。"); return; }
    setBusy(true); setError(null);
    try { onCreated(await rpc.call("courses.create", { semesterId: semester.id, courseName: courseName.trim(), subject: subject.trim() })); }
    catch { setError("课程创建失败，请检查填写内容后重试。"); }
    finally { setBusy(false); }
  }
  return (
    <TabContainer>
      <div style={{ maxWidth: 520, margin: "20px auto", display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>添加课程</h2>
        <div style={{ color: "var(--text-muted, #667085)", fontSize: 12 }}>{semester.label}</div>
        {error && <div role="alert" style={{ color: "#b42318" }}>{error}</div>}
        <Field label="课程名称"><input aria-label="课程名称" autoFocus style={inputStyle} value={courseName} onChange={(event) => setCourseName(event.target.value)} /></Field>
        <Field label="学科"><input aria-label="课程学科" style={inputStyle} value={subject} onChange={(event) => setSubject(event.target.value)} /></Field>
        <div style={{ display: "flex", gap: 8 }}><ActionButton disabled={busy} onClick={() => void save()} kind="primary">保存课程</ActionButton><ActionButton disabled={busy} onClick={onCancel}>取消</ActionButton></div>
      </div>
    </TabContainer>
  );
}
