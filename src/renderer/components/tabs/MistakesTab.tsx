/**
 * MistakesTab 错题 Tab（T-M1-009，T-M4-014，09-UI §4.7）
 *
 * S4 错题改错与薄弱点：错题列表 + 局部详情 + 六分类确认 + AI 建议（不确定标记）+ 重做 + 薄弱点列表。
 *
 * 状态机（07-Workflow §8.6/§8.7）：
 *   - mistake.status: needs_review ↔ mastered
 *   - weakPoint.status: active → resolved → regressed
 */
import React, { useEffect, useRef, useState } from "react";
import type { TypedRpcClient } from "../../rpc-client";
import type { SemesterCourseContext } from "../../semester-course-state";
import { useTabData } from "./useTabData";
import type { ErrorCategory, Mistake, MistakeWithEvidence, WeakPoint } from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";
import { ShortId } from "../common/ShortId";

interface Props {
  /** 静态渲染兼容输入；运行时由既有 RPC 读取。 */
  mistakes?: Mistake[];
  /** 静态渲染兼容输入；运行时由局部选择状态读取。 */
  selectedMistake?: MistakeWithEvidence;
  /** 静态渲染兼容输入；运行时由既有 RPC 读取。 */
  weakPoints?: WeakPoint[];
  rpc?: TypedRpcClient;
  courseId?: string;
  /** AppShell 唯一学术上下文；本 Tab 不新增跨 Tab 状态。 */
  academicContext?: SemesterCourseContext;
  /** T-M4-018：内嵌朗读入口（09-UI §5.2 S4 错题详情 → tts.speak） */
  onSpeakText?: (text: string, target?: { title?: string; refType?: string; refId?: string }) => void;
}

const ERROR_CATEGORIES: Array<{ value: ErrorCategory; label: string }> = [
  { value: "concept_unclear", label: "概念不清" },
  { value: "misread", label: "看错题" },
  { value: "formula_error", label: "公式错" },
  { value: "step_missing", label: "步骤缺" },
  { value: "time_pressure", label: "时间紧" },
  { value: "other", label: "其他" },
];

function mistakeStatusLabel(status: Mistake["status"]): string {
  return status === "mastered" ? "已掌握" : "待复习";
}

function weakPointStatusLabel(status: WeakPoint["status"]): string {
  switch (status) {
    case "active": return "活跃";
    case "resolved": return "已解决";
    case "regressed": return "已回退";
  }
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

export function MistakesTab({ mistakes, selectedMistake, weakPoints, rpc, courseId, academicContext, onSpeakText }: Props): React.JSX.Element {
  const effectiveCourseId = academicContext?.courseId ?? courseId;
  const isReadOnly = academicContext?.isReadOnly === true;
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selection, setSelection] = useState<{ id: string; courseId: string }>();
  const [statusFilter, setStatusFilter] = useState<"all" | Mistake["status"]>("all");
  const [detail, setDetail] = useState<MistakeWithEvidence | undefined>(rpc ? undefined : selectedMistake);
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "ready" | "error">(selectedMistake ? "ready" : "idle");
  const [selectedCategory, setSelectedCategory] = useState<ErrorCategory | undefined>(selectedMistake?.errorCategory);
  const [actionKey, setActionKey] = useState<"confirm" | "redo" | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const [detailVersion, setDetailVersion] = useState(0);
  const detailRequestRef = useRef(0);
  const actionRef = useRef<"confirm" | "redo" | undefined>(undefined);
  const mutationRequestRef = useRef(0);
  const mountedRef = useRef(true);

  const resource = useTabData<{ mistakes: Mistake[]; weakPoints: WeakPoint[] }>({
    rpc,
    key: `mistakes:${effectiveCourseId ?? ""}:${refreshVersion}`,
    enabled: Boolean(rpc && effectiveCourseId),
    initialData: { mistakes: [], weakPoints: [] },
    load: async (client) => {
      const [loadedMistakes, loadedWeakPoints] = await Promise.all([
        client.call("mistakes.list", { courseId: effectiveCourseId }),
        client.call("weakPoints.list", { courseId: effectiveCourseId }),
      ]);
      return { mistakes: loadedMistakes, weakPoints: loadedWeakPoints };
    },
    isEmpty: (value) => value.mistakes.length === 0,
  });
  const visibleMistakes = rpc ? resource.data.mistakes : mistakes;
  const filteredMistakes = (visibleMistakes ?? []).filter((mistake) => statusFilter === "all" || mistake.status === statusFilter);
  const visibleWeakPoints = rpc ? resource.data.weakPoints : weakPoints;
  const selectedId = selection && selection.courseId === effectiveCourseId ? selection.id : undefined;
  const visibleDetail = rpc ? detail : selectedMistake;
  // T-M4-018：朗读内容 = 错因 + AI 建议（09-UI §5.2 S4 错题详情）
  const mistakeSpeakText = visibleDetail
    ? [visibleDetail.errorCause, visibleDetail.errorCauseAiSuggestion].filter(Boolean).join("。")
    : "";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      detailRequestRef.current += 1;
      mutationRequestRef.current += 1;
    };
  }, []);

  // 课程或 RPC 客户端切换时，旧错题详情和 mutation 状态立即失效。
  useEffect(() => {
    detailRequestRef.current += 1;
    mutationRequestRef.current += 1;
    setSelection(undefined);
    setStatusFilter("all");
    setDetail(undefined);
    setDetailStatus("idle");
    setSelectedCategory(undefined);
    actionRef.current = undefined;
    setActionKey(undefined);
    setActionError(undefined);
  }, [rpc, effectiveCourseId]);

  useEffect(() => {
    if (!rpc) setSelectedCategory(selectedMistake?.errorCategory);
  }, [rpc, selectedMistake?.id, selectedMistake?.errorCategory]);

  useEffect(() => {
    if (!rpc || !selectedId) return;
    const requestId = ++detailRequestRef.current;
    let cancelled = false;
    setDetailStatus("loading");
    setActionError(undefined);
    void Promise.all([
      rpc.call("mistakes.get", { id: selectedId }),
      rpc.call("mistakes.suggestErrorCause", { id: selectedId }).catch(() => undefined),
    ])
      .then(([loadedDetail, suggestion]) => {
        if (cancelled || !mountedRef.current || requestId !== detailRequestRef.current) return;
        setDetail(suggestion ? { ...loadedDetail, errorCauseAiSuggestion: suggestion.suggestion } : loadedDetail);
        setSelectedCategory(loadedDetail.errorCategory);
        setDetailStatus("ready");
      })
      .catch(() => {
        if (cancelled || !mountedRef.current || requestId !== detailRequestRef.current) return;
        setDetail(undefined);
        setDetailStatus("error");
      });
    return () => {
      cancelled = true;
      if (requestId === detailRequestRef.current) detailRequestRef.current += 1;
    };
  }, [rpc, selectedId, detailVersion]);

  const selectMistake = (mistake: Mistake): void => {
    if (!rpc || !effectiveCourseId || actionRef.current) return;
    setSelection({ id: mistake.id, courseId: effectiveCourseId });
    setDetail(undefined);
    setSelectedCategory(undefined);
    setActionError(undefined);
  };

  const refreshCurrentCourse = (): void => {
    setRefreshVersion((value) => value + 1);
    setDetailVersion((value) => value + 1);
  };

  const confirmErrorCause = async (): Promise<void> => {
    if (!rpc || !visibleDetail || !selectedCategory || isReadOnly || actionRef.current) return;
    const mutationId = visibleDetail.id;
    const requestId = ++mutationRequestRef.current;
    actionRef.current = "confirm";
    setActionKey("confirm");
    setActionError(undefined);
    try {
      const confirmed = await rpc.call("mistakes.confirmErrorCause", { id: mutationId, category: selectedCategory });
      if (mutationRequestRef.current !== requestId || !mountedRef.current || selection?.id !== mutationId || selection.courseId !== effectiveCourseId) return;
      setDetail((current) => current && current.id === mutationId ? { ...current, ...confirmed } : current);
      setRefreshVersion((value) => value + 1);
    } catch {
      if (mutationRequestRef.current === requestId && mountedRef.current && selection?.id === mutationId && selection.courseId === effectiveCourseId) {
        setActionError("确认错因失败，请稍后重试。");
      }
    } finally {
      if (mutationRequestRef.current === requestId && actionRef.current === "confirm") actionRef.current = undefined;
      if (mutationRequestRef.current === requestId && mountedRef.current && selection?.id === mutationId && selection.courseId === effectiveCourseId) setActionKey(undefined);
    }
  };

  const redoMistake = async (): Promise<void> => {
    if (!rpc || !visibleDetail || isReadOnly || actionRef.current) return;
    const mutationId = visibleDetail.id;
    const requestId = ++mutationRequestRef.current;
    actionRef.current = "redo";
    setActionKey("redo");
    setActionError(undefined);
    try {
      await rpc.call("mistakes.redo", { id: mutationId });
      if (mutationRequestRef.current !== requestId || !mountedRef.current || selection?.id !== mutationId || selection.courseId !== effectiveCourseId) return;
      refreshCurrentCourse();
    } catch {
      if (mutationRequestRef.current === requestId && mountedRef.current && selection?.id === mutationId && selection.courseId === effectiveCourseId) {
        setActionError("重做提交失败，请稍后重试。");
      }
    } finally {
      if (mutationRequestRef.current === requestId && actionRef.current === "redo") actionRef.current = undefined;
      if (mutationRequestRef.current === requestId && mountedRef.current && selection?.id === mutationId && selection.courseId === effectiveCourseId) setActionKey(undefined);
    }
  };

  if (rpc && resource.status === "loading") return <TabContainer><div role="status">正在加载错题…</div></TabContainer>;
  if (rpc && resource.status === "error") return <TabContainer><div role="alert">暂时无法加载错题，请稍后重试。</div></TabContainer>;
  if (!visibleMistakes || visibleMistakes.length === 0) return <TabContainer><EmptyState message="暂无错题，继续加油" /></TabContainer>;

  return (
    <TabContainer>
      {isReadOnly && <div role="status" style={{ marginBottom: 12 }}>当前学期已归档，只读浏览，不能确认错因或重做。</div>}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>错题列表</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {(["all", "needs_review", "mastered"] as const).map((value) => (
            <button key={value} type="button" disabled={statusFilter === value} onClick={() => setStatusFilter(value)} style={{ padding: "4px 12px", fontSize: 12, cursor: "pointer", border: "1px solid var(--border, #e0e0e0)", background: statusFilter === value ? "#e3f2fd" : "transparent", borderRadius: 4 }}>
              {value === "all" ? "全部" : value === "needs_review" ? "需复习" : "已掌握"}
            </button>
          ))}
        </div>
        {filteredMistakes.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted, #888)", padding: "8px 0" }}>当前筛选下暂无错题</div>
        ) : (
          filteredMistakes.map((mistake) => (
            <div key={mistake.id} style={{ padding: "8px 12px", border: "1px solid var(--border, #e0e0e0)", borderRadius: 4, marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12 }}>#<ShortId id={mistake.id} /></span>
                <span style={{ fontSize: 12, color: mistake.status === "mastered" ? "#2e7d32" : "#f57c00", fontWeight: 600 }}>{mistakeStatusLabel(mistake.status)}</span>
              </div>
              {mistake.errorCause && <div style={{ fontSize: 12, color: "var(--text-muted, #888)", marginTop: 4 }}>错因：{safeRendererText(mistake.errorCause, "错因内容已隐藏。")}</div>}
              {rpc && <button type="button" onClick={() => selectMistake(mistake)} style={{ marginTop: 8 }}>查看详情</button>}
            </div>
          ))
        )}
      </div>

      {detailStatus === "loading" && <div role="status">正在加载错题详情…</div>}
      {detailStatus === "error" && <div role="alert">暂时无法加载错题详情，请重新选择错题。</div>}
      {visibleDetail && detailStatus !== "loading" && (
        <div style={{ padding: 12, border: "1px solid var(--border, #e0e0e0)", borderRadius: 4, marginBottom: 16, background: "var(--bg-panel, #f5f5f5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, margin: 0 }}>错题详情：题目 #<ShortId id={visibleDetail.questionId} /></h3>
            <button type="button" disabled={!mistakeSpeakText} onClick={() => onSpeakText?.(mistakeSpeakText, { title: "错题", refType: "mistake", refId: visibleDetail.id })} style={{ padding: "4px 12px", fontSize: 12 }}>朗读</button>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, marginBottom: 6 }}>错因分类：</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ERROR_CATEGORIES.map((category) => (
                <label key={category.value} style={{ padding: "4px 10px", border: selectedCategory === category.value ? "1px solid #1976d2" : "1px solid var(--border, #e0e0e0)", borderRadius: 4, fontSize: 12, cursor: isReadOnly ? "not-allowed" : "pointer", background: selectedCategory === category.value ? "#e3f2fd" : "#fff" }}>
                  <input type="radio" name="error-category" value={category.value} checked={selectedCategory === category.value} disabled={isReadOnly || Boolean(actionKey)} onChange={() => setSelectedCategory(category.value)} style={{ marginRight: 4 }} />
                  {category.label}
                </label>
              ))}
            </div>
            {rpc && <button type="button" disabled={isReadOnly || !selectedCategory || Boolean(actionKey)} onClick={() => void confirmErrorCause()} style={{ marginTop: 8 }}>确认错因</button>}
          </div>
          {visibleDetail.errorCauseConfirmedBy === "student" && <div style={{ marginBottom: 8, fontSize: 13 }}><strong>已确认错因</strong>{visibleDetail.errorCause ? <>：{safeRendererText(visibleDetail.errorCause, "错因内容已隐藏。")}</> : null}</div>}
          {visibleDetail.errorCauseAiSuggestion && <div style={{ padding: 8, background: "#fffde7", border: "1px solid #fff9c4", borderRadius: 4, marginBottom: 8, fontSize: 12 }}><strong>AI 建议（仅供参考）：</strong>{safeRendererText(visibleDetail.errorCauseAiSuggestion, "建议内容已隐藏。")}</div>}
          {actionError && <div role="alert" style={{ marginBottom: 8 }}>{actionError}</div>}
          {rpc ? <button type="button" disabled={isReadOnly || Boolean(actionKey)} onClick={() => void redoMistake()} style={{ padding: "6px 16px", fontSize: 13, cursor: isReadOnly ? "not-allowed" : "pointer", border: "1px solid var(--border, #e0e0e0)", background: "#1976d2", color: "#fff", borderRadius: 4 }}>{actionKey === "redo" ? "正在提交…" : "重做"}</button> : <button type="button" style={{ padding: "6px 16px", fontSize: 13 }}>重做</button>}
        </div>
      )}

      {visibleWeakPoints && visibleWeakPoints.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>薄弱点</h3>
          {visibleWeakPoints.map((weakPoint) => (
            <div key={weakPoint.id} style={{ padding: "8px 12px", border: "1px solid var(--border, #e0e0e0)", borderRadius: 4, marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12 }}>#<ShortId id={weakPoint.id} /></span>
                <span style={{ fontSize: 12, color: weakPoint.status === "active" ? "#c62828" : "#2e7d32", fontWeight: 600 }}>{weakPointStatusLabel(weakPoint.status)}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted, #888)", marginTop: 4 }}>证据数：{weakPoint.evidenceCount}</div>
            </div>
          ))}
        </div>
      )}
    </TabContainer>
  );
}
