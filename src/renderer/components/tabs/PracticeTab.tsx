/**
 * PracticeTab 练习 Tab（T-M1-009 / T-M4-013，09-UI §4.6）
 *
 * S3 限时练习：显式模块选择 → 创建会话 → 作答（防泄露）→ 提交 → 结果展示。
 *
 * T-M4-013 仅复用既有 practice.* / modules.list RPC；不新增 API、handler、schema 或
 * AppShell 跨 Tab 模块状态。作答前绝不将 correct_answer / acceptable_answers /
 * explanation 读入或展示到 renderer DOM；结果阶段才显示已有 PracticeResult 的结果字段。
 */
import React from "react";
import type { TypedRpcClient } from "../../rpc-client";
import type { SemesterCourseContext } from "../../semester-course-state";
import { safeAcademicDisplayText } from "../../semester-course-state";
import { useTabData } from "./useTabData";
import type {
  Answer,
  KnowledgeModule,
  PracticeResult,
  PracticeSession,
  QuestionDTO,
} from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";

interface Props {
  /** 旧静态展示兼容 props。运行时 RPC 接线使用组件内部状态。 */
  session?: PracticeSession;
  questions?: QuestionDTO[];
  result?: PracticeResult;
  phase?: "idle" | "answering" | "result";
  rpc?: TypedRpcClient;
  courseId?: string;
  academicContext?: SemesterCourseContext;
}

type RuntimePhase = "idle" | "creating" | "questions_loading" | "answering" | "submitting" | "result_loading" | "result";

function questionTypeLabel(type: QuestionDTO["questionType"]): string {
  switch (type) {
    case "single_choice": return "单选题";
    case "multiple_choice": return "多选题";
    case "fill_blank": return "填空题";
  }
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const m = Math.floor(safeSeconds / 60);
  const s = safeSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatElapsed(elapsedMs: number): string {
  return formatTime(Math.floor(Math.max(0, elapsedMs) / 1000));
}

function isTimerPayload(value: unknown, sessionId: string): value is { sessionId: string; elapsedMs: number; remainingMs?: number } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { sessionId?: unknown; elapsedMs?: unknown; remainingMs?: unknown };
  return candidate.sessionId === sessionId && typeof candidate.elapsedMs === "number" &&
    (candidate.remainingMs === undefined || typeof candidate.remainingMs === "number");
}

/** 不显示 RPC 原始异常，避免 UUID、绝对路径和堆栈进入 renderer。 */
function practiceErrorText(action: "modules" | "create" | "questions" | "submit" | "result"): string {
  switch (action) {
    case "modules": return "暂时无法加载知识模块，请切换课程后重试。";
    case "create": return "暂时无法创建练习，请检查选择后重试。";
    case "questions": return "暂时无法加载练习题，请重新开始练习。";
    case "submit": return "暂时无法提交答案，请稍后重试。";
    case "result": return "答案已提交，但暂时无法读取练习结果，请稍后重试。";
  }
}

function IdlePhase(): React.JSX.Element {
  return (
    <TabContainer>
      <div style={{ textAlign: "center", padding: "32px 16px" }}>
        <h2 style={{ fontSize: 16, margin: "0 0 16px 0" }}>练习</h2>
        <p style={{ color: "var(--text-muted, #888)", marginBottom: 16 }}>选择课程和知识模块开始练习</p>
      </div>
    </TabContainer>
  );
}

function buttonStyle(disabled = false): React.CSSProperties {
  return {
    padding: "8px 24px",
    fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid var(--border, #e0e0e0)",
    background: disabled ? "#9e9e9e" : "#1976d2",
    color: "#fff",
    borderRadius: 4,
    opacity: disabled ? 0.7 : 1,
  };
}

/** 静态 props 模式仍服务于 T-M1 既有纯渲染测试。 */
function StaticAnsweringPhase({ session, questions }: { session: PracticeSession; questions: QuestionDTO[] }): React.JSX.Element {
  const timeLimitSec = session.timeLimit ?? 0;
  return (
    <TabContainer>
      <div style={timerStyle()}>
        <span style={{ fontSize: 13 }}>题目数：{questions.length}</span>
        <span style={{ fontSize: 13, color: "#d32f2f", fontWeight: 600 }}>剩余：{formatTime(timeLimitSec)}</span>
      </div>
      {questions.map((q, idx) => (
        <div key={q.id} style={questionCardStyle()}>
          <div style={{ marginBottom: 8 }}><strong>{idx + 1}. [{questionTypeLabel(q.questionType)}]</strong> <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>（{q.score} 分）</span></div>
          <div style={{ marginBottom: 8, fontSize: 13 }}>{q.questionStem}</div>
          {q.options?.map((option, optionIndex) => <div key={optionIndex} style={{ fontSize: 13, lineHeight: 1.8 }}>{String.fromCharCode(65 + optionIndex)}. {option}</div>)}
          {q.questionType === "fill_blank" && <input type="text" aria-label={`题目 ${idx + 1} 答案`} />}
        </div>
      ))}
      <div style={{ textAlign: "center", marginTop: 16 }}><button type="button" style={buttonStyle()}>提交</button></div>
    </TabContainer>
  );
}

function StaticResultPhase({ questions, result }: { session: PracticeSession; questions: QuestionDTO[]; result: PracticeResult }): React.JSX.Element {
  return <ResultView questions={questions} result={result} elapsedMs={result.elapsedMs} />;
}

function timerStyle(): React.CSSProperties {
  return {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16,
    padding: "8px 12px", background: "var(--bg-panel, #f5f5f5)", borderRadius: 4,
  };
}

function questionCardStyle(): React.CSSProperties {
  return { padding: 12, border: "1px solid var(--border, #e0e0e0)", borderRadius: 4, marginBottom: 12 };
}

function ResultView({ questions, result, elapsedMs, showSubmittedButton = false, onArchiveMistake }: {
  questions: QuestionDTO[];
  result: PracticeResult;
  elapsedMs: number;
  showSubmittedButton?: boolean;
  /** T-M5-004：结果页错误题目「加入错题」（无 rpc 时按钮禁用，不冒充可点击） */
  onArchiveMistake?: (practiceAnswerId: string) => void;
}): React.JSX.Element {
  return (
    <TabContainer>
      <div style={{ padding: 16, background: "var(--bg-panel, #f5f5f5)", borderRadius: 4, marginBottom: 16, textAlign: "center" }}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>练习结果</h2>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#1976d2" }}>{result.totalScore} / {result.maxScore}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted, #888)", marginTop: 4 }}>正确：{result.correctCount} / {questions.length || result.items.length} 题　用时：{formatElapsed(elapsedMs)}</div>
        {showSubmittedButton && <button type="button" disabled style={{ ...buttonStyle(true), marginTop: 12 }}>已提交</button>}
      </div>
      {result.items.map((item, idx) => (
        <div key={item.question.id} style={{ ...questionCardStyle(), borderLeft: `4px solid ${item.isCorrect ? "#2e7d32" : "#c62828"}` }}>
          <div style={{ marginBottom: 4 }}>
            <strong>{idx + 1}. [{questionTypeLabel(item.question.questionType)}]</strong>
            <span style={{ marginLeft: 8, fontSize: 12, color: item.isCorrect ? "#2e7d32" : "#c62828", fontWeight: 600 }}>{item.isCorrect ? "正确" : "错误"}</span>
          </div>
          <div style={{ marginBottom: 8, fontSize: 13 }}>{item.question.questionStem}</div>
          <div style={{ fontSize: 13, marginBottom: 4 }}><strong>正确答案：</strong>{String(item.correctAnswer)}</div>
          {item.explanation && <div style={{ fontSize: 12, color: "var(--text-muted, #888)" }}><strong>解析：</strong>{item.explanation}</div>}
          {!item.isCorrect && item.practiceAnswerId && (
            <button
              type="button"
              disabled={!onArchiveMistake}
              onClick={() => onArchiveMistake?.(item.practiceAnswerId!)}
              style={{ marginTop: 8, padding: "4px 12px", fontSize: 12, cursor: onArchiveMistake ? "pointer" : "not-allowed" }}
            >
              加入错题
            </button>
          )}
        </div>
      ))}
    </TabContainer>
  );
}

function RuntimePracticeTab({ rpc, courseId, academicContext }: Required<Pick<Props, "rpc">> & Pick<Props, "courseId" | "academicContext">): React.JSX.Element {
  const effectiveCourseId = academicContext?.courseId ?? courseId;
  const isReadOnly = academicContext?.isReadOnly === true;
  const moduleResource = useTabData<KnowledgeModule[]>({
    rpc,
    key: `practice-modules:${effectiveCourseId ?? ""}`,
    enabled: Boolean(effectiveCourseId),
    initialData: [],
    load: (client) => client.call("modules.list", { courseId: effectiveCourseId! }),
  });
  // T-M5-004：重启后的结果读取只复用既有只读 RPC；不新增 API/handler/schema/跨 Tab 状态。
  // 历史读取失败不能阻断新练习入口，故不与模块读取共用阻断状态。
  const completedSessionResource = useTabData<PracticeSession[]>({
    rpc,
    key: `practice-completed-sessions:${effectiveCourseId ?? ""}`,
    enabled: Boolean(effectiveCourseId),
    initialData: [],
    load: (client) => client.call("practice.listSessions", { courseId: effectiveCourseId! }),
  });
  const [selectedModuleIds, setSelectedModuleIds] = React.useState<string[]>([]);
  const [questionCount, setQuestionCount] = React.useState(5);
  const [phase, setPhase] = React.useState<RuntimePhase>("idle");
  const [session, setSession] = React.useState<PracticeSession | undefined>();
  const [questions, setQuestions] = React.useState<QuestionDTO[]>([]);
  const [answersByQuestionId, setAnswersByQuestionId] = React.useState<Record<string, unknown>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [result, setResult] = React.useState<PracticeResult | undefined>();
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [actionError, setActionError] = React.useState<string | undefined>();
  const [archiveResult, setArchiveResult] = React.useState<string | undefined>();
  const [archivingAnswerId, setArchivingAnswerId] = React.useState<string | undefined>();
  const archivingRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const contextVersionRef = React.useRef(0);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      contextVersionRef.current += 1;
    };
  }, []);

  React.useEffect(() => {
    contextVersionRef.current += 1;
    setSelectedModuleIds([]);
    setPhase("idle");
    setSession(undefined);
    setQuestions([]);
    setAnswersByQuestionId({});
    setCurrentQuestionIndex(0);
    setResult(undefined);
    setElapsedMs(0);
    setActionError(undefined);
    setArchiveResult(undefined);
    archivingRef.current = false;
  }, [effectiveCourseId]);

  React.useEffect(() => {
    if (phase !== "answering" || !session) return;
    const startedAt = Date.now() - elapsedMs;
    const timer = window.setInterval(() => {
      if (!mountedRef.current) return;
      setElapsedMs(Math.max(0, Date.now() - startedAt));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [phase, session?.id]);

  React.useEffect(() => {
    if (phase !== "answering" || !session) return;
    return rpc.subscribe("practice.timer", session.id, (payload) => {
      if (!mountedRef.current || !isTimerPayload(payload, session.id)) return;
      setElapsedMs(Math.max(0, payload.elapsedMs));
    });
  }, [rpc, phase, session?.id]);

  const timeLimitMs = (session?.timeLimit ?? 0) * 1_000;
  const remainingSeconds = session?.timeLimit === undefined ? 0 : Math.ceil(Math.max(0, timeLimitMs - elapsedMs) / 1_000);
  const timedOut = session?.timeLimit !== undefined && elapsedMs >= timeLimitMs;

  function updateAnswer(question: QuestionDTO, value: unknown): void {
    setAnswersByQuestionId((current) => ({ ...current, [question.id]: value }));
  }

  function toggleMultipleAnswer(question: QuestionDTO, option: string, checked: boolean): void {
    const current = answersByQuestionId[question.id];
    const selected = Array.isArray(current) ? current.filter((value): value is string => typeof value === "string") : [];
    const next = checked ? [...new Set([...selected, option])] : selected.filter((value) => value !== option);
    updateAnswer(question, next);
  }

  function loadQuestionsForSession(sessionToLoad: PracticeSession, contextVersion: number): void {
    setPhase("questions_loading");
    void rpc.call("practice.getQuestions", { sessionId: sessionToLoad.id })
      .then((loadedQuestions) => {
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setQuestions(loadedQuestions);
        setAnswersByQuestionId({});
        setCurrentQuestionIndex(0);
        setElapsedMs(0);
        setActionError(undefined);
        setPhase("answering");
      })
      .catch(() => {
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setActionError(practiceErrorText("questions"));
        setPhase("questions_loading");
      });
  }

  function loadResultForSession(sessionToLoad: PracticeSession, contextVersion: number): void {
    setSession(sessionToLoad);
    setPhase("result_loading");
    void rpc.call("practice.getResult", { sessionId: sessionToLoad.id })
      .then((loadedResult) => {
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setQuestions(loadedResult.items.map((item) => item.question));
        setElapsedMs(loadedResult.elapsedMs);
        setResult(loadedResult);
        setActionError(undefined);
        setPhase("result");
      })
      .catch(() => {
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setActionError(practiceErrorText("result"));
        setPhase("result_loading");
      });
  }

  function startPractice(): void {
    if (!effectiveCourseId || selectedModuleIds.length === 0 || isReadOnly || phase === "creating" || phase === "questions_loading" || phase === "submitting" || phase === "result_loading") return;
    const contextVersion = contextVersionRef.current;
    setPhase("creating");
    setActionError(undefined);
    void rpc.call("practice.createSession", { courseId: effectiveCourseId, moduleIds: selectedModuleIds, questionCount })
      .then((createdSession) => {
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setSession(createdSession);
        loadQuestionsForSession(createdSession, contextVersion);
      })
      .catch(() => {
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setPhase("idle");
        setActionError(practiceErrorText("create"));
      });
  }

  function submitAnswers(): void {
    if (!session || phase !== "answering" || isReadOnly) return;
    const contextVersion = contextVersionRef.current;
    const answers: Answer[] = questions
      .filter((question) => Object.prototype.hasOwnProperty.call(answersByQuestionId, question.id))
      .map((question) => ({ questionId: question.id, value: answersByQuestionId[question.id] }));
    setPhase("submitting");
    setActionError(undefined);
    void rpc.call("practice.submit", { sessionId: session.id, answers })
      .then(() => {
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        loadResultForSession(session, contextVersion);
      })
      .catch(() => {
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setPhase("answering");
        setActionError(practiceErrorText("submit"));
      });
  }

  function archiveMistake(practiceAnswerId: string): void {
    if (!rpc || !practiceAnswerId || isReadOnly || archivingRef.current) return;
    const contextVersion = contextVersionRef.current;
    archivingRef.current = true;
    setArchivingAnswerId(practiceAnswerId);
    setArchiveResult(undefined);
    void rpc.call("mistakes.archive", { practiceAnswerId })
      .then(() => {
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setArchiveResult("已加入错题，可在错题 Tab 查看。");
      })
      .catch(() => {
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setActionError("加入错题失败，请稍后重试。");
      })
      .finally(() => {
        archivingRef.current = false;
        setArchivingAnswerId(undefined);
      });
  }

  if (!effectiveCourseId) {
    return <TabContainer><div role="status">请先在左侧选择课程，再开始练习。</div></TabContainer>;
  }
  if (moduleResource.status === "loading") {
    return <TabContainer><div role="status">正在加载知识模块…</div></TabContainer>;
  }
  if (moduleResource.status === "error") {
    return <TabContainer><div role="alert">{practiceErrorText("modules")}</div></TabContainer>;
  }

  if (phase === "result") {
    if (!result) return <TabContainer><div role="alert">{practiceErrorText("result")}</div></TabContainer>;
    return (
      <>
        <ResultView questions={questions} result={result} elapsedMs={elapsedMs || result.elapsedMs} showSubmittedButton onArchiveMistake={archiveMistake} />
        {archiveResult && <div role="status" style={{ padding: "8px 12px", fontSize: 13, color: "#2e7d32" }}>{archiveResult}</div>}
        {actionError && <div role="alert" style={{ padding: "8px 12px", fontSize: 13, color: "#c62828" }}>{actionError}</div>}
        {archivingAnswerId && <div role="status" style={{ padding: "4px 12px", fontSize: 12 }}>正在加入错题…</div>}
      </>
    );
  }

  if (phase === "result_loading") {
    return (
      <TabContainer>
        <h2 style={{ fontSize: 16 }}>读取练习结果</h2>
        {actionError ? <p role="alert">{actionError}</p> : <p role="status">正在读取练习结果…</p>}
        {session && actionError && <button type="button" style={buttonStyle(false)} onClick={() => loadResultForSession(session, contextVersionRef.current)}>重试读取结果</button>}
      </TabContainer>
    );
  }

  if (phase === "questions_loading") {
    return (
      <TabContainer>
        <h2 style={{ fontSize: 16 }}>加载练习题</h2>
        {actionError ? <p role="alert">{actionError}</p> : <p role="status">正在加载练习题…</p>}
        {session && actionError && <button type="button" style={buttonStyle(false)} onClick={() => loadQuestionsForSession(session, contextVersionRef.current)}>重试加载题目</button>}
      </TabContainer>
    );
  }

  if (phase === "answering" || phase === "submitting") {
    const currentQuestion = questions[currentQuestionIndex];
    if (!session || !currentQuestion) {
      return <TabContainer><div role="alert">{practiceErrorText("questions")}</div></TabContainer>;
    }
    const currentAnswer = answersByQuestionId[currentQuestion.id];
    const isSubmitting = phase === "submitting";
    const selectedModuleLabels = selectedModuleIds.map((id) => moduleResource.data.find((item) => item.id === id)?.moduleName).filter((value): value is string => Boolean(value)).map((value) => safeAcademicDisplayText(value, "当前模块"));
    return (
      <TabContainer>
        <div style={timerStyle()}>
          <span style={{ fontSize: 13 }}>模块：{selectedModuleLabels.join("、") || "当前模块"}</span>
          <span style={{ fontSize: 13 }}>第 {currentQuestionIndex + 1} / {questions.length} 题</span>
          <span style={{ fontSize: 13, color: timedOut ? "#c62828" : "#d32f2f", fontWeight: 600 }}>{session.timeLimit === undefined ? `用时：${formatElapsed(elapsedMs)}` : `${timedOut ? "已超时" : "剩余"}：${formatTime(remainingSeconds)}`}</span>
        </div>
        {timedOut && <p role="status" style={{ color: "#c62828" }}>已超时，仍可提交当前答案。</p>}
        {actionError && <p role="alert">{actionError}</p>}
        <div style={questionCardStyle()}>
          <div style={{ marginBottom: 8 }}><strong>{currentQuestionIndex + 1}. [{questionTypeLabel(currentQuestion.questionType)}]</strong> <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>（{currentQuestion.score} 分）</span></div>
          <div style={{ marginBottom: 12, fontSize: 13 }}>{currentQuestion.questionStem}</div>
          {currentQuestion.questionType === "single_choice" && currentQuestion.options?.map((option, optionIndex) => (
            <label key={option} style={{ display: "block", fontSize: 13, lineHeight: 1.9 }}>
              <input type="radio" name={`practice-question-${currentQuestionIndex}`} aria-label={`题目 ${currentQuestionIndex + 1} 选项 ${String.fromCharCode(65 + optionIndex)}`} checked={currentAnswer === option} disabled={isSubmitting} onChange={() => updateAnswer(currentQuestion, option)} /> {String.fromCharCode(65 + optionIndex)}. {option}
            </label>
          ))}
          {currentQuestion.questionType === "multiple_choice" && currentQuestion.options?.map((option, optionIndex) => {
            const selected = Array.isArray(currentAnswer) && currentAnswer.includes(option);
            return <label key={option} style={{ display: "block", fontSize: 13, lineHeight: 1.9 }}>
              <input type="checkbox" aria-label={`题目 ${currentQuestionIndex + 1} 选项 ${String.fromCharCode(65 + optionIndex)}`} checked={selected} disabled={isSubmitting} onChange={(event) => toggleMultipleAnswer(currentQuestion, option, event.currentTarget.checked)} /> {String.fromCharCode(65 + optionIndex)}. {option}
            </label>;
          })}
          {currentQuestion.questionType === "fill_blank" && <input type="text" aria-label={`题目 ${currentQuestionIndex + 1} 答案`} value={typeof currentAnswer === "string" ? currentAnswer : ""} disabled={isSubmitting} onChange={(event) => updateAnswer(currentQuestion, event.currentTarget.value)} />}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button type="button" disabled={isSubmitting || currentQuestionIndex === 0} style={buttonStyle(isSubmitting || currentQuestionIndex === 0)} onClick={() => setCurrentQuestionIndex((index) => Math.max(0, index - 1))}>上一题</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" disabled={isSubmitting || currentQuestionIndex >= questions.length - 1} style={buttonStyle(isSubmitting || currentQuestionIndex >= questions.length - 1)} onClick={() => setCurrentQuestionIndex((index) => Math.min(questions.length - 1, index + 1))}>下一题</button>
            <button type="button" disabled={isSubmitting} style={buttonStyle(isSubmitting)} onClick={submitAnswers}>{isSubmitting ? "正在提交…" : "提交"}</button>
          </div>
        </div>
      </TabContainer>
    );
  }

  const cannotStart = isReadOnly || selectedModuleIds.length === 0 || moduleResource.data.length === 0 || phase === "creating";
  return (
    <TabContainer>
      <h2 style={{ fontSize: 16 }}>限时练习</h2>
      {isReadOnly && <p role="status">当前学期已归档，只读查看，不能创建或提交练习。</p>}
      {actionError && <p role="alert">{actionError}</p>}
      {moduleResource.data.length === 0 ? (
        <p role="status">当前课程暂无可练习的知识模块，请先在笔记中生成模块。</p>
      ) : (
        <>
          <label htmlFor="practice-module" style={{ display: "block", marginBottom: 6 }}>选择知识模块（可多选）</label>
          <select id="practice-module" aria-label="选择知识模块" multiple size={Math.min(5, Math.max(2, moduleResource.data.length))} value={selectedModuleIds} disabled={isReadOnly || phase === "creating"} onChange={(event) => setSelectedModuleIds(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>
            {moduleResource.data.map((module) => <option key={module.id} value={module.id}>{safeAcademicDisplayText(module.moduleName, "未命名模块")}</option>)}
          </select>
          <label htmlFor="practice-count" style={{ display: "block", margin: "16px 0 6px" }}>题目数量</label>
          <select id="practice-count" aria-label="题目数量" value={questionCount} disabled={isReadOnly || phase === "creating"} onChange={(event) => setQuestionCount(Number(event.currentTarget.value))}>
            {[5, 10, 15, 20].map((count) => <option key={count} value={count}>{count} 题</option>)}
          </select>
          <div style={{ marginTop: 16 }}><button type="button" disabled={cannotStart} style={buttonStyle(cannotStart)} onClick={startPractice}>{phase === "creating" ? "正在创建…" : "开始练习"}</button></div>
        </>
      )}
      {completedSessionResource.status === "loading" && <p role="status" style={{ marginTop: 20 }}>正在读取已完成练习…</p>}
      {completedSessionResource.status === "error" && <p role="alert" style={{ marginTop: 20 }}>暂时无法读取已完成练习，请稍后重试。</p>}
      {completedSessionResource.status === "ready" && completedSessionResource.data.filter((item) => item.status === "submitted" || item.status === "graded").length > 0 && (
        <section aria-label="已完成练习" style={{ marginTop: 24, borderTop: "1px solid var(--border, #e0e0e0)", paddingTop: 16 }}>
          <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>已完成练习</h3>
          {completedSessionResource.data.filter((item) => item.status === "submitted" || item.status === "graded").map((completedSession, index) => (
            <div key={completedSession.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0" }}>
              <span style={{ fontSize: 13 }}>练习 {index + 1} · 正确：{completedSession.correctCount ?? "—"} / {completedSession.questionCount} 题</span>
              <button type="button" style={buttonStyle(false)} onClick={() => loadResultForSession(completedSession, contextVersionRef.current)}>查看结果</button>
            </div>
          ))}
        </section>
      )}
    </TabContainer>
  );
}
export function PracticeTab({ session, questions, result, phase = "idle", rpc, courseId, academicContext }: Props): React.JSX.Element {
  if (rpc) return <RuntimePracticeTab rpc={rpc} courseId={courseId} academicContext={academicContext} />;
  if (phase === "result" && session && questions && result) return <StaticResultPhase session={session} questions={questions} result={result} />;
  if (phase === "answering" && session && questions) return <StaticAnsweringPhase session={session} questions={questions} />;
  return <IdlePhase />;
}
