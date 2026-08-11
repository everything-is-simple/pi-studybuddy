/**
 * CramTab 冲刺 Tab（T-M2-008 静态壳，T-M4-015 S5 RPC 接线；09-UI §4.8）
 *
 * S5 期末冲刺：模拟考入口 + 速背卡浏览 + 冲刺计划展示（三选一子切换）。
 *
 * T-M4-015 仅复用既有 S5 RPC（mockExams.* / cramCards.get / cramPlan.get）与
 * S1 既有 exams.list({ courseId, confirmationStatus: "confirmed" }) 构造已确认考试门控；
 * 不新增 API、handler、schema 或 AppShell 跨 Tab 模块状态。
 *
 * §7.4 确定性只读：速背卡/冲刺计划是确定性只读 DTO，不调 LLM、不持久化。
 *   速背卡/计划界面不提供任何写按钮；"标记已掌握"等 mutation 不在 S5 契约内。
 * §7.4 规则优先：模拟卷生成前 assessmentAttempt 必须 confirmed（后端触发器判定），
 *   renderer 不自行推导后端事实，只展示后端返回状态。
 * §11.1 隐私边界：所有 ID 走 ShortId 组件（不展示完整 UUID）；错误固定中文净化。
 */
import React from "react";
import type { TypedRpcClient } from "../../rpc-client";
import type { SemesterCourseContext } from "../../semester-course-state";
import { safeAcademicDisplayText } from "../../semester-course-state";
import { useTabData } from "./useTabData";
import type {
  AssessmentAttempt,
  CramCard,
  CramPlanDay,
  MockExamAttempt,
  MockExamPaper,
  MockExamResult,
  QuestionDTO,
} from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";
import { ShortId } from "../common/ShortId";

/** 冲刺子 Tab 类型 */
type CramSubTab = "mockExam" | "speedCards" | "plan";
/** 模拟考运行时阶段 */
type MockExamPhase =
  | "idle"
  | "generating"
  | "paper"
  | "starting"
  | "answering"
  | "submitting"
  | "result_loading"
  | "result";

interface Props {
  /** 当前子 Tab（默认 speedCards） */
  subTab?: CramSubTab;
  /** 速背卡列表（确定性只读 DTO；静态渲染兼容） */
  cards?: CramCard[];
  /** 冲刺计划（确定性只读 DTO；静态渲染兼容） */
  plan?: CramPlanDay[];
  /** RPC 客户端（运行时交互用） */
  rpc?: TypedRpcClient;
  /** 课程 ID */
  courseId?: string;
  /** AppShell 唯一学术上下文；本 Tab 不新增跨 Tab 状态。 */
  academicContext?: SemesterCourseContext;
}

/** 重要性星级 */
function importanceLabel(importance: number): string {
  const clamped = Math.min(5, Math.max(0, importance));
  return "★".repeat(clamped) + "☆".repeat(5 - clamped);
}

/**
 * 业务正文也可能来自模型或异常数据，不能把路径、完整 UUID、栈或 token 带进 DOM。
 * 只保留简短、正常的学生可见文本；调用错误始终使用固定文案。
 */
function safeRendererText(value: string | undefined, fallback: string, maxLength = 300): string {
  const text = value?.trim() ?? "";
  const hasUuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(text);
  const hasPath =
    /[a-z]:[\\/]/i.test(text) ||
    /\\\\/.test(text) ||
    /\bfile:\s*\/{1,3}/i.test(text) ||
    /\/(?:[^\s/]+\/)+[^\s/]+/.test(text) ||
    /\bhttps?:\/\//i.test(text);
  const hasStackOrSecret =
    /\bbearer\b/i.test(text) ||
    /\b(?:[A-Za-z]*Error|Exception)\s*:/i.test(text) ||
    /\bat\s+\S+/i.test(text) ||
    /\b(?:api[_ -]?key|token|secret)\s*[:=]/i.test(text);
  if (!text || hasUuid || hasPath || hasStackOrSecret) return fallback;
  return text.slice(0, maxLength);
}

/** 不显示 RPC 原始异常，避免 UUID、绝对路径和堆栈进入 renderer。 */
function cramErrorText(action: "exams" | "generate" | "start" | "submit" | "result" | "cards" | "plan"): string {
  switch (action) {
    case "exams": return "暂时无法加载已确认考试，请切换课程后重试。";
    case "generate": return "暂时无法生成模拟卷，请稍后重试。";
    case "start": return "暂时无法开始模拟考，请稍后重试。";
    case "submit": return "暂时无法提交答案，请稍后重试。";
    case "result": return "答案已提交，但暂时无法读取模拟考结果，请稍后重试。";
    case "cards": return "暂时无法加载速背卡，请切换课程后重试。";
    case "plan": return "暂时无法加载冲刺计划，请切换课程后重试。";
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

function questionTypeLabel(type: QuestionDTO["questionType"]): string {
  switch (type) {
    case "single_choice": return "单选题";
    case "multiple_choice": return "多选题";
    case "fill_blank": return "填空题";
  }
}

function subTabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 14px",
    fontSize: 13,
    cursor: "pointer",
    border: "1px solid var(--border, #e0e0e0)",
    borderRadius: 4,
    background: active ? "#1976d2" : "transparent",
    color: active ? "#fff" : "var(--text, #333)",
  };
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

function timerStyle(): React.CSSProperties {
  return {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16,
    padding: "8px 12px", background: "var(--bg-panel, #f5f5f5)", borderRadius: 4,
  };
}

function questionCardStyle(): React.CSSProperties {
  return { padding: 12, border: "1px solid var(--border, #e0e0e0)", borderRadius: 4, marginBottom: 12 };
}

/** 模拟考入口子组件（静态兼容） */
function MockExamPhase(): React.JSX.Element {
  return (
    <div>
      <h3 style={{ fontSize: 14, margin: "0 0 12px 0" }}>模拟考</h3>
      <div
        style={{
          padding: 16,
          border: "1px solid var(--border, #e0e0e0)",
          borderRadius: 4,
          textAlign: "center",
        }}
      >
        <p style={{ color: "var(--text-muted, #888)", marginBottom: 12, fontSize: 13 }}>
          基于错题和薄弱点生成模拟试卷
        </p>
        <button type="button" style={buttonStyle(false)}>生成试卷</button>
      </div>
    </div>
  );
}

/** 速背卡子组件（确定性只读，不调 LLM；静态兼容） */
function SpeedCardsPhase({ cards }: { cards: CramCard[] }): React.JSX.Element {
  if (!cards || cards.length === 0) {
    return <EmptyState message="暂无速背卡，请先完善知识模块" />;
  }

  return (
    <div>
      <h3 style={{ fontSize: 14, margin: "0 0 12px 0" }}>速背卡</h3>
      {cards.map((card) => (
        <div
          key={card.moduleId}
          style={{
            padding: 12,
            border: "1px solid var(--border, #e0e0e0)",
            borderRadius: 4,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <strong>{safeRendererText(card.moduleName, "当前模块")}</strong>
            <span style={{ fontSize: 12, color: "#f57c00" }}>
              {importanceLabel(card.importance)}
            </span>
          </div>

          <div style={{ marginBottom: 6, fontSize: 13 }}>
            <strong>核心概念：</strong>
            {safeRendererText(card.coreConcept, "内容已隐藏。")}
          </div>

          {card.keyPoints && card.keyPoints.length > 0 && (
            <div style={{ marginBottom: 6, fontSize: 12 }}>
              <strong>关键点：</strong>
              {card.keyPoints.map((point) => safeRendererText(point, "内容已隐藏。")).join("、")}
            </div>
          )}

          {card.mnemonic && (
            <div style={{ marginBottom: 4, fontSize: 12, color: "#1976d2" }}>
              <strong>记忆口诀：</strong>
              {safeRendererText(card.mnemonic, "内容已隐藏。")}
            </div>
          )}

          {card.commonExamPattern && (
            <div style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>
              <strong>常考题型：</strong>
              {safeRendererText(card.commonExamPattern, "内容已隐藏。")}
            </div>
          )}

          {card.easyMistake && (
            <div style={{ fontSize: 12, color: "#c62828" }}>
              <strong>易错点：</strong>
              {safeRendererText(card.easyMistake, "内容已隐藏。")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** 冲刺计划子组件（确定性只读，不调 LLM；静态兼容） */
function PlanPhase({ plan }: { plan: CramPlanDay[] }): React.JSX.Element {
  if (!plan || plan.length === 0) {
    return <EmptyState message="暂无冲刺计划" />;
  }

  return (
    <div>
      <h3 style={{ fontSize: 14, margin: "0 0 12px 0" }}>冲刺计划（7 天）</h3>
      {plan.map((day) => (
        <div
          key={day.date}
          style={{
            padding: 12,
            border: "1px solid var(--border, #e0e0e0)",
            borderRadius: 4,
            marginBottom: 8,
            borderLeft: "3px solid #1976d2",
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <strong>Day {day.dayOffset + 1}</strong>{" "}
            <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>{day.date}</span>
          </div>

          {day.tasks.reviewModules && day.tasks.reviewModules.length > 0 && (
            <div style={{ fontSize: 12, marginBottom: 4 }}>
              <strong>复习模块：</strong>
              {day.tasks.reviewModules.map((value) => safeRendererText(value, "当前模块")).join("、")}
            </div>
          )}

          {day.tasks.redoMistakes && day.tasks.redoMistakes.length > 0 && (
            <div style={{ fontSize: 12, marginBottom: 4 }}>
              <strong>重做错题：</strong>
              {day.tasks.redoMistakes.length} 道
            </div>
          )}

          <div style={{ fontSize: 12, marginBottom: 4 }}>
            <strong>练习数量：</strong>
            {day.tasks.practiceCount} 套
          </div>

          {day.tasks.notes && (
            <div style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>{safeRendererText(day.tasks.notes, "内容已隐藏。")}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/** 模拟考结果视图（总分/正确率/耗时/模块分析） */
function MockExamResultView({ result, paper }: { result: MockExamResult; paper: MockExamPaper }): React.JSX.Element {
  return (
    <div>
      <div
        style={{
          padding: 16,
          background: "var(--bg-panel, #f5f5f5)",
          borderRadius: 4,
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        <h3 style={{ fontSize: 16, margin: "0 0 8px 0" }}>模拟考结果</h3>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#1976d2" }}>
          {result.totalScore} / {result.maxScore}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted, #888)", marginTop: 4 }}>
          正确：{result.correctCount} / {paper.questionCount} 题　正确率：{Math.round(result.correctRate * 100)}%　用时：{formatElapsed(result.elapsedMs)}
        </div>
      </div>
      {result.moduleAnalyses && result.moduleAnalyses.length > 0 && (
        <div>
          <h4 style={{ fontSize: 13, margin: "0 0 8px 0" }}>模块分析（强弱项）</h4>
          {result.moduleAnalyses.map((analysis) => (
            <div key={analysis.moduleId} style={{ ...questionCardStyle(), borderLeft: `4px solid ${analysis.strength === "strong" ? "#2e7d32" : analysis.strength === "weak" ? "#c62828" : "#f9a825"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>模块 <ShortId id={analysis.moduleId} /></span>
                <span style={{ fontWeight: 600, color: analysis.strength === "strong" ? "#2e7d32" : analysis.strength === "weak" ? "#c62828" : "#f9a825" }}>
                  {analysis.strength === "strong" ? "强" : analysis.strength === "weak" ? "弱" : "中"}（{Math.round(analysis.correctRate * 100)}%）
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RuntimeCramTab({ rpc, courseId, academicContext, initialSubTab }: {
  rpc: TypedRpcClient;
  courseId?: string;
  academicContext?: SemesterCourseContext;
  initialSubTab?: CramSubTab;
}): React.JSX.Element {
  const effectiveCourseId = academicContext?.courseId ?? courseId;
  const isReadOnly = academicContext?.isReadOnly === true;
  const [activeSubTab, setActiveSubTab] = React.useState<CramSubTab>(initialSubTab ?? "speedCards");
  const [selectedAssessmentId, setSelectedAssessmentId] = React.useState<string | undefined>();
  const [cardIndex, setCardIndex] = React.useState(0);
  const [questionCount, setQuestionCount] = React.useState(10);
  const [timeLimit, setTimeLimit] = React.useState(30);
  const [mockPhase, setMockPhase] = React.useState<MockExamPhase>("idle");
  const [paper, setPaper] = React.useState<MockExamPaper | undefined>();
  const [attempt, setAttempt] = React.useState<MockExamAttempt | undefined>();
  const [result, setResult] = React.useState<MockExamResult | undefined>();
  const [answersByQuestionId, setAnswersByQuestionId] = React.useState<Record<string, unknown>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [actionError, setActionError] = React.useState<string | undefined>();
  const mountedRef = React.useRef(true);
  const contextVersionRef = React.useRef(0);
  const generateInFlightRef = React.useRef(false);
  const submitInFlightRef = React.useRef(false);

  const examsResource = useTabData<AssessmentAttempt[]>({
    rpc,
    key: `cram-exams:${effectiveCourseId ?? ""}`,
    enabled: Boolean(effectiveCourseId),
    initialData: [],
    load: (client) => client.call("exams.list", { courseId: effectiveCourseId!, confirmationStatus: "confirmed" }),
  });
  const cardsResource = useTabData<CramCard[]>({
    rpc,
    key: `cram-cards:${effectiveCourseId ?? ""}:${selectedAssessmentId ?? ""}`,
    enabled: Boolean(effectiveCourseId && selectedAssessmentId && activeSubTab === "speedCards"),
    initialData: [],
    load: (client) => client.call("cramCards.get", { assessmentAttemptId: selectedAssessmentId! }),
  });
  const planResource = useTabData<CramPlanDay[]>({
    rpc,
    key: `cram-plan:${effectiveCourseId ?? ""}:${selectedAssessmentId ?? ""}`,
    enabled: Boolean(effectiveCourseId && selectedAssessmentId && activeSubTab === "plan"),
    initialData: [],
    load: (client) => client.call("cramPlan.get", { assessmentAttemptId: selectedAssessmentId! }),
  });

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      contextVersionRef.current += 1;
    };
  }, []);

  React.useEffect(() => {
    contextVersionRef.current += 1;
    setSelectedAssessmentId(undefined);
    setCardIndex(0);
    setMockPhase("idle");
    setPaper(undefined);
    setAttempt(undefined);
    setResult(undefined);
    setAnswersByQuestionId({});
    setCurrentQuestionIndex(0);
    setElapsedMs(0);
    setActionError(undefined);
  }, [effectiveCourseId]);

  // 前端计时（模拟考限时作答）
  React.useEffect(() => {
    if (mockPhase !== "answering" || !paper) return;
    const startedAt = Date.now() - elapsedMs;
    const timer = window.setInterval(() => {
      if (!mountedRef.current) return;
      setElapsedMs(Math.max(0, Date.now() - startedAt));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [mockPhase, paper?.id]);

  const selectedExam = examsResource.data.find((exam) => exam.id === selectedAssessmentId);
  const timeLimitMs = (paper?.timeLimitMinutes ?? 0) * 60 * 1_000;
  const remainingSeconds = paper?.timeLimitMinutes === undefined ? 0 : Math.ceil(Math.max(0, timeLimitMs - elapsedMs) / 1_000);
  const timedOut = paper?.timeLimitMinutes !== undefined && elapsedMs >= timeLimitMs;

  function selectAssessment(id: string): void {
    contextVersionRef.current += 1;
    generateInFlightRef.current = false;
    submitInFlightRef.current = false;
    setSelectedAssessmentId(id);
    setCardIndex(0);
    setMockPhase("idle");
    setPaper(undefined);
    setAttempt(undefined);
    setResult(undefined);
    setAnswersByQuestionId({});
    setCurrentQuestionIndex(0);
    setElapsedMs(0);
    setActionError(undefined);
  }

  function generateMockPaper(): void {
    if (!selectedAssessmentId || isReadOnly || mockPhase === "generating" || mockPhase === "starting" || mockPhase === "submitting" || mockPhase === "result_loading" || generateInFlightRef.current) return;
    generateInFlightRef.current = true;
    const contextVersion = contextVersionRef.current;
    setMockPhase("generating");
    setActionError(undefined);
    void rpc.call("mockExams.generatePaper", { assessmentAttemptId: selectedAssessmentId, questionCount, timeLimit })
      .then((loadedPaper) => {
        generateInFlightRef.current = false;
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setPaper(loadedPaper);
        setAnswersByQuestionId({});
        setCurrentQuestionIndex(0);
        setElapsedMs(0);
        setActionError(undefined);
        setMockPhase("paper");
      })
      .catch(() => {
        generateInFlightRef.current = false;
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setMockPhase("idle");
        setActionError(cramErrorText("generate"));
      });
  }

  function startMockExam(): void {
    if (!paper || isReadOnly || mockPhase !== "paper") return;
    const contextVersion = contextVersionRef.current;
    setMockPhase("starting");
    setActionError(undefined);
    void rpc.call("mockExams.startAttempt", { paperId: paper.id })
      .then((startedAttempt) => {
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setAttempt(startedAttempt);
        setElapsedMs(0);
        setActionError(undefined);
        setMockPhase("answering");
      })
      .catch(() => {
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setMockPhase("paper");
        setActionError(cramErrorText("start"));
      });
  }

  function loadResult(attemptToLoad: MockExamAttempt, contextVersion: number): void {
    setMockPhase("result_loading");
    void rpc.call("mockExams.getResult", { attemptId: attemptToLoad.id })
      .then((loadedResult) => {
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        // 07-WF §2.6 2e：getResult + getModuleAnalyses 分别调用，模块分析合并展示
        void rpc.call("mockExams.getModuleAnalyses", { attemptId: attemptToLoad.id })
          .then((analyses) => {
            if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
            setResult({ ...loadedResult, moduleAnalyses: analyses });
            setActionError(undefined);
            setMockPhase("result");
          })
          .catch(() => {
            if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
            // 模块分析失败仍展示基础结果，不阻塞复盘
            setResult(loadedResult);
            setActionError(undefined);
            setMockPhase("result");
          });
      })
      .catch(() => {
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setActionError(cramErrorText("result"));
        setMockPhase("result_loading");
      });
  }

  function submitMockAnswers(): void {
    if (!attempt || !paper || mockPhase !== "answering" || isReadOnly || submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    const contextVersion = contextVersionRef.current;
    const answers = paper.questions
      .filter((question) => Object.prototype.hasOwnProperty.call(answersByQuestionId, question.id))
      .map((question) => ({ questionId: question.id, value: answersByQuestionId[question.id] }));
    setMockPhase("submitting");
    setActionError(undefined);
    void rpc.call("mockExams.submitAttempt", { attemptId: attempt.id, answers })
      .then(() => {
        submitInFlightRef.current = false;
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        loadResult(attempt, contextVersion);
      })
      .catch(() => {
        submitInFlightRef.current = false;
        if (!mountedRef.current || contextVersion !== contextVersionRef.current) return;
        setMockPhase("answering");
        setActionError(cramErrorText("submit"));
      });
  }

  function updateAnswer(question: QuestionDTO, value: unknown): void {
    setAnswersByQuestionId((current) => ({ ...current, [question.id]: value }));
  }

  function toggleMultipleAnswer(question: QuestionDTO, option: string, checked: boolean): void {
    const current = answersByQuestionId[question.id];
    const selected = Array.isArray(current) ? current.filter((value): value is string => typeof value === "string") : [];
    const next = checked ? [...new Set([...selected, option])] : selected.filter((value) => value !== option);
    updateAnswer(question, next);
  }

  if (!effectiveCourseId) {
    return <TabContainer><div role="status">请先在左侧选择课程，再进入冲刺练习。</div></TabContainer>;
  }
  if (examsResource.status === "loading") {
    return <TabContainer><div role="status">正在加载已确认考试…</div></TabContainer>;
  }
  if (examsResource.status === "error") {
    return <TabContainer><div role="alert">{cramErrorText("exams")}</div></TabContainer>;
  }
  if (examsResource.data.length === 0) {
    return <TabContainer><div role="status">当前课程暂无可用的已确认考试，请先在首页确认考试后再冲刺。</div></TabContainer>;
  }

  return (
    <TabContainer>
      {/* 已确认考试局部显式选择（不新增 AppShell 跨 Tab 状态） */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <label htmlFor="cram-assessment" style={{ fontSize: 13 }}>冲刺考试</label>
        <select
          id="cram-assessment"
          name="cram-assessment"
          aria-label="选择已确认考试"
          style={{ fontSize: 13, padding: "4px 8px" }}
          value={selectedAssessmentId ?? ""}
          onChange={(event) => selectAssessment(event.currentTarget.value)}
        >
          <option value="">请选择考试</option>
          {examsResource.data.map((exam) => (
            <option key={exam.id} value={exam.id}>{safeAcademicDisplayText(exam.examName, "未命名考试")}</option>
          ))}
        </select>
        {selectedExam && (
          <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>
            距 {safeAcademicDisplayText(selectedExam.examName, "考试")}：<ShortId id={selectedExam.id} />　已确认 ✅
          </span>
        )}
        {isReadOnly && <span role="status" style={{ fontSize: 12, color: "#c62828" }}>当前学期已归档，只读查看。</span>}
      </div>

      {/* 子 Tab 切换 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border, #e0e0e0)", paddingBottom: 8 }}>
        <button type="button" style={subTabStyle(activeSubTab === "mockExam")} onClick={() => setActiveSubTab("mockExam")}>模拟考</button>
        <button type="button" style={subTabStyle(activeSubTab === "speedCards")} onClick={() => { setActiveSubTab("speedCards"); setCardIndex(0); }}>速背卡</button>
        <button type="button" style={subTabStyle(activeSubTab === "plan")} onClick={() => setActiveSubTab("plan")}>冲刺计划</button>
      </div>

      {/* 无已选考试：子内容区提示 */}
      {!selectedAssessmentId && (
        <EmptyState message="请先在上方选择一场已确认考试，再使用模拟考、速背卡与冲刺计划。" />
      )}

      {/* 模拟考 */}
      {selectedAssessmentId && activeSubTab === "mockExam" && (
        <div>
          {actionError && <p role="alert" style={{ color: "#c62828", fontSize: 13 }}>{actionError}</p>}
          {isReadOnly && mockPhase === "idle" && <p role="status" style={{ fontSize: 13, color: "#c62828" }}>当前学期已归档，不能生成或提交模拟卷。</p>}

          {mockPhase === "idle" && (
            <div>
              <h3 style={{ fontSize: 14, margin: "0 0 12px 0" }}>模拟考</h3>
              <div style={{ padding: 16, border: "1px solid var(--border, #e0e0e0)", borderRadius: 4 }}>
                <p style={{ color: "var(--text-muted, #888)", marginBottom: 12, fontSize: 13 }}>基于错题和薄弱点生成限时模拟试卷（题数 5-20）</p>
                <label htmlFor="mock-question-count" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>题目数量</label>
                <select id="mock-question-count" name="mock-question-count" aria-label="模拟卷题目数量" value={questionCount} disabled={isReadOnly} onChange={(event) => setQuestionCount(Number(event.currentTarget.value))}>
                  {[5, 10, 15, 20].map((count) => <option key={count} value={count}>{count} 题</option>)}
                </select>
                <label htmlFor="mock-time-limit" style={{ display: "block", margin: "12px 0 6px", fontSize: 13 }}>时间限制</label>
                <select id="mock-time-limit" name="mock-time-limit" aria-label="模拟卷时间限制" value={timeLimit} disabled={isReadOnly} onChange={(event) => setTimeLimit(Number(event.currentTarget.value))}>
                  {[15, 30, 60, 90].map((minutes) => <option key={minutes} value={minutes}>{minutes} 分钟</option>)}
                </select>
                <div style={{ marginTop: 16 }}>
                  <button type="button" disabled={isReadOnly} style={buttonStyle(isReadOnly)} onClick={generateMockPaper}>
                    生成试卷
                  </button>
                </div>
              </div>
            </div>
          )}

          {mockPhase === "generating" && (
            <div>
              <h3 style={{ fontSize: 14 }}>生成模拟卷</h3>
              <p role="status" style={{ fontSize: 13 }}>正在基于错题和薄弱点生成模拟卷…</p>
            </div>
          )}

          {mockPhase === "paper" && paper && (
            <div>
              <h3 style={{ fontSize: 14, margin: "0 0 12px 0" }}>{safeRendererText(paper.paperTitle, "模拟试卷")}</h3>
              <div style={timerStyle()}>
                <span style={{ fontSize: 13 }}>题数：{paper.questionCount}　总分：{paper.totalScore}</span>
                <span style={{ fontSize: 13, color: "var(--text-muted, #888)" }}>{paper.timeLimitMinutes !== undefined ? `限时 ${paper.timeLimitMinutes} 分钟` : "不限时"}</span>
              </div>
              <button type="button" disabled={isReadOnly} style={buttonStyle(isReadOnly)} onClick={startMockExam}>
                开始考试
              </button>
            </div>
          )}

          {mockPhase === "starting" && (
            <div>
              <h3 style={{ fontSize: 14 }}>开始模拟考</h3>
              <p role="status" style={{ fontSize: 13 }}>正在准备试卷…</p>
            </div>
          )}

          {(mockPhase === "answering" || mockPhase === "submitting") && paper && attempt && (
            <div>
              <div style={timerStyle()}>
                <span style={{ fontSize: 13 }}>第 {currentQuestionIndex + 1} / {paper.questions.length} 题</span>
                <span style={{ fontSize: 13, color: timedOut ? "#c62828" : "#d32f2f", fontWeight: 600 }}>
                  {paper.timeLimitMinutes === undefined ? `用时：${formatElapsed(elapsedMs)}` : `${timedOut ? "已超时" : "剩余"}：${formatTime(remainingSeconds)}`}
                </span>
              </div>
              {timedOut && <p role="status" style={{ color: "#c62828", fontSize: 13 }}>已超时，仍可提交当前答案。</p>}
              {actionError && <p role="alert" style={{ color: "#c62828", fontSize: 13 }}>{actionError}</p>}
              {(() => {
                const currentQuestion = paper.questions[currentQuestionIndex];
                if (!currentQuestion) return <p role="alert" style={{ fontSize: 13 }}>{cramErrorText("result")}</p>;
                const currentAnswer = answersByQuestionId[currentQuestion.id];
                const isSubmitting = mockPhase === "submitting";
                return (
                  <div>
                    <div style={questionCardStyle()}>
                      <div style={{ marginBottom: 8 }}>
                        <strong>{currentQuestionIndex + 1}. [{questionTypeLabel(currentQuestion.questionType)}]</strong>{" "}
                        <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>（{currentQuestion.score} 分）</span>
                      </div>
                      <div style={{ marginBottom: 12, fontSize: 13 }}>{safeRendererText(currentQuestion.questionStem, "题目内容已隐藏。")}</div>
                      {currentQuestion.questionType === "single_choice" && currentQuestion.options?.map((option, optionIndex) => (
                        <label key={option} style={{ display: "block", fontSize: 13, lineHeight: 1.9 }}>
                          <input type="radio" name={`mock-question-${currentQuestionIndex}`} aria-label={`题目 ${currentQuestionIndex + 1} 选项 ${String.fromCharCode(65 + optionIndex)}`} value={option} checked={currentAnswer === option} disabled={isSubmitting} onChange={() => updateAnswer(currentQuestion, option)} /> {String.fromCharCode(65 + optionIndex)}. {safeRendererText(option, "选项内容已隐藏。")}
                        </label>
                      ))}
                      {currentQuestion.questionType === "multiple_choice" && currentQuestion.options?.map((option, optionIndex) => {
                        const selected = Array.isArray(currentAnswer) && currentAnswer.includes(option);
                        return (
                          <label key={option} style={{ display: "block", fontSize: 13, lineHeight: 1.9 }}>
                            <input type="checkbox" aria-label={`题目 ${currentQuestionIndex + 1} 选项 ${String.fromCharCode(65 + optionIndex)}`} checked={selected} disabled={isSubmitting} onChange={(event) => toggleMultipleAnswer(currentQuestion, option, event.currentTarget.checked)} /> {String.fromCharCode(65 + optionIndex)}. {safeRendererText(option, "选项内容已隐藏。")}
                          </label>
                        );
                      })}
                      {currentQuestion.questionType === "fill_blank" && (
                        <input type="text" aria-label={`题目 ${currentQuestionIndex + 1} 答案`} value={typeof currentAnswer === "string" ? currentAnswer : ""} disabled={isSubmitting} onChange={(event) => updateAnswer(currentQuestion, event.currentTarget.value)} />
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <button type="button" disabled={isSubmitting || currentQuestionIndex === 0} style={buttonStyle(isSubmitting || currentQuestionIndex === 0)} onClick={() => setCurrentQuestionIndex((index) => Math.max(0, index - 1))}>上一题</button>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" disabled={isSubmitting || currentQuestionIndex >= paper.questions.length - 1} style={buttonStyle(isSubmitting || currentQuestionIndex >= paper.questions.length - 1)} onClick={() => setCurrentQuestionIndex((index) => Math.min(paper.questions.length - 1, index + 1))}>下一题</button>
                        <button type="button" disabled={isSubmitting || isReadOnly} style={buttonStyle(isSubmitting || isReadOnly)} onClick={submitMockAnswers}>{isSubmitting ? "正在提交…" : "提交"}</button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {mockPhase === "result_loading" && (
            <div>
              <h3 style={{ fontSize: 14 }}>读取模拟考结果</h3>
              {actionError ? <p role="alert" style={{ color: "#c62828", fontSize: 13 }}>{actionError}</p> : <p role="status" style={{ fontSize: 13 }}>正在读取模拟考结果…</p>}
              {attempt && actionError && (
                <button type="button" style={buttonStyle(false)} onClick={() => loadResult(attempt, contextVersionRef.current)}>重试读取结果</button>
              )}
            </div>
          )}

          {mockPhase === "result" && result && paper && <MockExamResultView result={result} paper={paper} />}
          {mockPhase === "result" && !result && <p role="alert" style={{ fontSize: 13 }}>{cramErrorText("result")}</p>}
        </div>
      )}

      {/* 速背卡（确定性只读 + 翻页） */}
      {selectedAssessmentId && activeSubTab === "speedCards" && (
        <div>
          {cardsResource.status === "loading" && <p role="status" style={{ fontSize: 13 }}>正在加载速背卡…</p>}
          {cardsResource.status === "error" && <p role="alert" style={{ color: "#c62828", fontSize: 13 }}>{cramErrorText("cards")}</p>}
          {cardsResource.status === "ready" && cardsResource.data.length === 0 && <EmptyState message="暂无速背卡，请先完善知识模块" />}
          {cardsResource.status === "ready" && cardsResource.data.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, margin: "0 0 12px 0" }}>速背卡（确定性只读）</h3>
              {(() => {
                const card = cardsResource.data[Math.min(cardIndex, cardsResource.data.length - 1)];
                return (
                  <div style={{ padding: 16, border: "1px solid var(--border, #e0e0e0)", borderRadius: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>卡片 {Math.min(cardIndex, cardsResource.data.length - 1) + 1}/{cardsResource.data.length}</span>
                      <span style={{ fontSize: 12, color: "#f57c00" }}>{importanceLabel(card.importance)}</span>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <strong style={{ fontSize: 14 }}>{safeRendererText(card.moduleName, "当前模块")}</strong>
                    </div>
                    <div style={{ marginBottom: 6, fontSize: 13 }}>
                      <strong>核心概念：</strong>{safeRendererText(card.coreConcept, "内容已隐藏。")}
                    </div>
                    {card.keyPoints && card.keyPoints.length > 0 && (
                      <div style={{ marginBottom: 6, fontSize: 12 }}>
                        <strong>关键点：</strong>{card.keyPoints.map((point) => safeRendererText(point, "内容已隐藏。")).join("、")}
                      </div>
                    )}
                    {card.mnemonic && (
                      <div style={{ marginBottom: 4, fontSize: 12, color: "#1976d2" }}>
                        <strong>记忆口诀：</strong>{safeRendererText(card.mnemonic, "内容已隐藏。")}
                      </div>
                    )}
                    {card.commonExamPattern && (
                      <div style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>
                        <strong>常考题型：</strong>{safeRendererText(card.commonExamPattern, "内容已隐藏。")}
                      </div>
                    )}
                    {card.easyMistake && (
                      <div style={{ fontSize: 12, color: "#c62828" }}>
                        <strong>易错点：</strong>{safeRendererText(card.easyMistake, "内容已隐藏。")}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button type="button" disabled={cardIndex <= 0} style={buttonStyle(cardIndex <= 0)} onClick={() => setCardIndex((index) => Math.max(0, index - 1))}>上一张</button>
                      <button type="button" disabled={cardIndex >= cardsResource.data.length - 1} style={buttonStyle(cardIndex >= cardsResource.data.length - 1)} onClick={() => setCardIndex((index) => Math.min(cardsResource.data.length - 1, index + 1))}>下一张</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* 冲刺计划（确定性只读展示） */}
      {selectedAssessmentId && activeSubTab === "plan" && (
        <div>
          {planResource.status === "loading" && <p role="status" style={{ fontSize: 13 }}>正在加载冲刺计划…</p>}
          {planResource.status === "error" && <p role="alert" style={{ color: "#c62828", fontSize: 13 }}>{cramErrorText("plan")}</p>}
          {planResource.status === "ready" && planResource.data.length === 0 && <EmptyState message="暂无冲刺计划" />}
          {planResource.status === "ready" && planResource.data.length > 0 && <PlanPhase plan={planResource.data} />}
        </div>
      )}
    </TabContainer>
  );
}

export function CramTab({ subTab = "speedCards", cards, plan, rpc, courseId, academicContext }: Props): React.JSX.Element {
  if (rpc) return <RuntimeCramTab rpc={rpc} courseId={courseId} academicContext={academicContext} initialSubTab={subTab} />;

  return (
    <TabContainer>
      {/* 子 Tab 切换按钮 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          borderBottom: "1px solid var(--border, #e0e0e0)",
          paddingBottom: 8,
        }}
      >
        <span style={{ fontSize: 13, padding: "4px 8px", fontWeight: 600 }}>冲刺</span>
      </div>

      {/* 根据子 Tab 渲染对应内容 */}
      {subTab === "mockExam" && <MockExamPhase />}
      {subTab === "speedCards" && <SpeedCardsPhase cards={cards ?? []} />}
      {subTab === "plan" && <PlanPhase plan={plan ?? []} />}
    </TabContainer>
  );
}
