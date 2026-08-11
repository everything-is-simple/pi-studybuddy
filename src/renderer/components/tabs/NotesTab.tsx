/**
 * NotesTab 笔记 Tab（T-M1-009，09-UI §4.5；T-M4-012 RPC 接线）
 *
 * S2 笔记预览与知识模块：资料必须在本 Tab 内由学生显式选择，
 * 然后按 materialId 读取/保存笔记；不默认选择第一条资料，不引入 AppShell 全局资料状态。
 */
import React, { useEffect, useRef, useState } from "react";
import type { TypedRpcClient } from "../../rpc-client";
import type { SemesterCourseContext } from "../../semester-course-state";
import { useTabData } from "./useTabData";
import type { Material, StructuredNote, KnowledgeModule, LearnStatus } from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";

interface Props {
  note?: StructuredNote;
  modules?: KnowledgeModule[];
  rpc?: TypedRpcClient;
  courseId?: string;
  academicContext?: SemesterCourseContext;
  /** T-M4-018：内嵌朗读入口（09-UI §5.2 S2 笔记预览 → tts.speak） */
  onSpeakText?: (text: string, target?: { title?: string; refType?: string; refId?: string }) => void;
}

function learnStatusLabel(status: LearnStatus): string {
  switch (status) {
    case "not_started": return "未开始";
    case "learning": return "学习中";
    case "mastered": return "已掌握";
    case "needs_review": return "待复习";
    default: return status;
  }
}

function learnStatusColor(status: LearnStatus): string {
  switch (status) {
    case "mastered": return "#2e7d32";
    case "learning": return "#1976d2";
    case "needs_review": return "#f57c00";
    default: return "var(--text-muted, #888)";
  }
}

function nextLearnStatus(status: LearnStatus): LearnStatus {
  switch (status) {
    case "not_started": return "learning";
    case "learning": return "mastered";
    case "mastered": return "needs_review";
    case "needs_review": return "mastered";
  }
}

function nextLearnStatusLabel(status: LearnStatus): string {
  switch (nextLearnStatus(status)) {
    case "learning": return "标记学习中";
    case "mastered": return "标记已掌握";
    case "needs_review": return "标记待复习";
    default: return "更新状态";
  }
}

function rpcErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function containsSensitiveRendererText(text: string): boolean {
  return /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(text) ||
    /\b[a-z]:[\\/][^\s]*/i.test(text) ||
    /\\\\[^\s]+/.test(text) ||
    /\bfile:(?:\/{1,3})?/i.test(text) ||
    /\/(?:[^\s/]+\/)+[^\s/]+/.test(text) ||
    /(?:^|\n)\s*(?:[A-Za-z]*Error|Exception)\s*:/m.test(text) ||
    /(?:^|\n)\s*at\s+\S+/m.test(text);
}

function safeRendererText(value: string | undefined, fallback: string, maxLength = 20_000): string {
  const text = value?.trim() ?? "";
  if (!text || containsSensitiveRendererText(text)) return fallback;
  return text.slice(0, maxLength);
}

function materialLabel(material: Material): string {
  return safeRendererText(material.fileName, "未命名资料", 80) + "（" + material.status + "）";
}

export function NotesTab({ note, modules, rpc, courseId, academicContext, onSpeakText }: Props): React.JSX.Element {
  const effectiveCourseId = academicContext?.courseId ?? courseId;
  const isReadOnly = academicContext?.isReadOnly === true;
  const materials = useTabData<Material[]>({
    rpc,
    key: `notes-materials:${effectiveCourseId ?? ""}`,
    enabled: Boolean(rpc && effectiveCourseId),
    initialData: [],
    load: (client) => client.call("materials.list", { courseId: effectiveCourseId }),
  });
  const moduleResource = useTabData<KnowledgeModule[]>({
    rpc,
    key: `notes-modules:${effectiveCourseId ?? ""}`,
    enabled: Boolean(rpc && effectiveCourseId),
    initialData: [],
    load: (client) => client.call("modules.list", { courseId: effectiveCourseId }),
  });
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [selectedNote, setSelectedNote] = useState<StructuredNote | undefined>(note);
  const [noteStatus, setNoteStatus] = useState<"idle" | "loading" | "ready" | "notFound" | "error">(note ? "ready" : "idle");
  const [draftMarkdown, setDraftMarkdown] = useState(safeRendererText(note?.noteMarkdown, "笔记内容因包含敏感内部信息已隐藏。"));
  const [editing, setEditing] = useState(false);
  const [actionKey, setActionKey] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const [moduleOverrides, setModuleOverrides] = useState<Record<string, KnowledgeModule>>({});
  const noteRequestRef = useRef(0);
  const viewContextRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      viewContextRef.current += 1;
      noteRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!rpc) {
      setSelectedNote(note);
      setDraftMarkdown(safeRendererText(note?.noteMarkdown, "笔记内容因包含敏感内部信息已隐藏。"));
      setNoteStatus(note ? "ready" : "idle");
    }
  }, [rpc, note]);

  useEffect(() => {
    if (!rpc) return;
    viewContextRef.current += 1;
    noteRequestRef.current += 1;
    setSelectedMaterialId("");
    setSelectedNote(undefined);
    setDraftMarkdown("");
    setEditing(false);
    setNoteStatus("idle");
    setActionError(undefined);
    setModuleOverrides({});
    return () => {
      viewContextRef.current += 1;
      noteRequestRef.current += 1;
    };
  }, [rpc, effectiveCourseId]);

  const effectiveNote = rpc ? selectedNote : note;
  const displayedNoteMarkdown = effectiveNote ? safeRendererText(effectiveNote.noteMarkdown, "笔记内容因包含敏感内部信息已隐藏。") : "";
  const allModules = rpc ? moduleResource.data : modules ?? [];
  const visibleModules = rpc
    ? allModules.filter((module) => module.materialId === selectedMaterialId)
    : allModules;

  function selectMaterial(materialId: string): void {
    const contextVersion = ++viewContextRef.current;
    const requestId = ++noteRequestRef.current;
    setSelectedMaterialId(materialId);
    setSelectedNote(undefined);
    setDraftMarkdown("");
    setEditing(false);
    setActionError(undefined);
    if (!rpc || !materialId) {
      setNoteStatus("idle");
      return;
    }
    setNoteStatus("loading");
    void rpc.call("notes.get", { materialId })
      .then((loadedNote) => {
        if (!mountedRef.current || contextVersion !== viewContextRef.current || requestId !== noteRequestRef.current) return;
        setSelectedNote(loadedNote);
        setDraftMarkdown(safeRendererText(loadedNote.noteMarkdown, "笔记内容因包含敏感内部信息已隐藏。"));
        setNoteStatus("ready");
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || contextVersion !== viewContextRef.current || requestId !== noteRequestRef.current) return;
        setNoteStatus(rpcErrorCode(error) === "NOT_FOUND" ? "notFound" : "error");
      });
  }

  async function saveNote(): Promise<void> {
    if (!rpc || !selectedMaterialId || isReadOnly) return;
    const materialId = selectedMaterialId;
    const contextVersion = viewContextRef.current;
    const action = "note:" + materialId + ":" + contextVersion;
    const highlights = effectiveNote?.highlights ?? [];
    setActionKey(action);
    setActionError(undefined);
    try {
      const saved = await rpc.call("notes.update", { materialId, noteMarkdown: draftMarkdown, highlights });
      if (!mountedRef.current || contextVersion !== viewContextRef.current || selectedMaterialId !== materialId) return;
      setSelectedNote(saved);
      setDraftMarkdown(safeRendererText(saved.noteMarkdown, "笔记内容因包含敏感内部信息已隐藏。"));
      setEditing(false);
      setNoteStatus("ready");
    } catch {
      if (mountedRef.current && contextVersion === viewContextRef.current && selectedMaterialId === materialId) {
        setActionError("笔记保存失败，请稍后重试。");
      }
    } finally {
      if (mountedRef.current && contextVersion === viewContextRef.current) {
        setActionKey((current) => current === action ? undefined : current);
      }
    }
  }

  async function updateModule(module: KnowledgeModule): Promise<void> {
    if (!rpc || isReadOnly) return;
    const learnStatus = nextLearnStatus(module.learnStatus);
    const contextVersion = viewContextRef.current;
    const action = "module:" + module.id + ":" + contextVersion;
    setActionKey(action);
    setActionError(undefined);
    try {
      const updated = await rpc.call("modules.updateLearnStatus", { id: module.id, learnStatus });
      if (!mountedRef.current || contextVersion !== viewContextRef.current) return;
      setModuleOverrides((current) => ({ ...current, [updated.id]: updated }));
    } catch {
      if (mountedRef.current && contextVersion === viewContextRef.current) {
        setActionError("学习状态更新失败，请稍后重试。");
      }
    } finally {
      if (mountedRef.current && contextVersion === viewContextRef.current) {
        setActionKey((current) => current === action ? undefined : current);
      }
    }
  }

  if (!rpc && !effectiveNote) {
    return <TabContainer><EmptyState message="暂无笔记，请先上传资料并生成笔记" /></TabContainer>;
  }
  if (rpc && !effectiveCourseId) {
    return <TabContainer><EmptyState message="暂无笔记，请先选择课程后查看" /></TabContainer>;
  }
  if (rpc && (materials.status === "loading" || moduleResource.status === "loading")) {
    return <TabContainer><div role="status">正在加载笔记…</div></TabContainer>;
  }
  if (rpc && (materials.status === "error" || moduleResource.status === "error")) {
    return <TabContainer><div role="alert">暂时无法加载笔记，请稍后重试。</div></TabContainer>;
  }

  const materialChoices = materials.data.map((material, index) => ({ material, token: `material-${index + 1}` }));
  const selectedMaterialToken = materialChoices.find((choice) => choice.material.id === selectedMaterialId)?.token ?? "";
  const selector = rpc ? (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor="notes-material-select" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>选择资料</label>
      <select id="notes-material-select" aria-label="选择资料" value={selectedMaterialToken} onChange={(event) => {
        const choice = materialChoices.find((candidate) => candidate.token === event.target.value);
        selectMaterial(choice?.material.id ?? "");
      }} style={{ minWidth: 260, padding: "6px 8px" }}>
        <option value="">请选择资料</option>
        {materialChoices.map(({ material, token }) => <option key={material.id} value={token}>{materialLabel(material)}</option>)}
      </select>
    </div>
  ) : null;

  if (rpc && materials.data.length === 0) {
    return <TabContainer>{selector}<EmptyState message="暂无资料，请先在资料 Tab 上传或选择资料" /></TabContainer>;
  }
  if (rpc && !selectedMaterialId) {
    return <TabContainer>{selector}<EmptyState message="请选择资料查看笔记" /></TabContainer>;
  }
  if (rpc && noteStatus === "loading") {
    return <TabContainer>{selector}<div role="status">正在加载笔记…</div></TabContainer>;
  }
  if (rpc && noteStatus === "error") {
    return <TabContainer>{selector}<div role="alert">暂时无法加载该资料的笔记，请稍后重试。</div></TabContainer>;
  }
  if (!effectiveNote && !editing) {
    return <TabContainer>{selector}<EmptyState message={noteStatus === "notFound" ? "该资料暂无笔记" : "暂无笔记，请先生成笔记"} />{rpc && noteStatus === "notFound" ? <button type="button" disabled={isReadOnly} onClick={() => { setDraftMarkdown(""); setEditing(true); }}>新建笔记</button> : null}</TabContainer>;
  }

  const noteActionBusy = actionKey?.startsWith("note:" + selectedMaterialId + ":") === true;
  return (
    <TabContainer>
      {selector}
      {actionError ? <div role="alert">{actionError}</div> : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>笔记预览</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" disabled={!displayedNoteMarkdown || editing} onClick={() => onSpeakText?.(displayedNoteMarkdown, { title: "笔记", refType: "note", refId: effectiveNote?.materialId ?? selectedMaterialId })} style={{ padding: "4px 12px", fontSize: 12 }}>朗读</button>
          {rpc && !editing ? <button type="button" disabled={isReadOnly} onClick={() => setEditing(true)}>编辑</button> : null}
          {rpc && editing ? <button type="button" disabled={noteActionBusy || isReadOnly} onClick={() => void saveNote()}>保存笔记</button> : null}
          {rpc && editing ? <button type="button" disabled={noteActionBusy} onClick={() => { setDraftMarkdown(effectiveNote?.noteMarkdown ?? ""); setEditing(false); }}>取消编辑</button> : null}
        </div>
      </div>
      {editing ? (
        <textarea aria-label="笔记内容" value={draftMarkdown} onChange={(event) => setDraftMarkdown(event.target.value)} disabled={isReadOnly || noteActionBusy} style={{ width: "100%", minHeight: 220, padding: 12, boxSizing: "border-box", marginBottom: 16 }} />
      ) : (
        <div style={{ padding: 12, background: "var(--bg-panel, #f5f5f5)", borderRadius: 4, marginBottom: 16, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6 }}>{displayedNoteMarkdown}</div>
      )}
      {visibleModules.length > 0 ? <div>
        <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>知识模块</h3>
        {visibleModules.map((baseModule) => {
          const module = moduleOverrides[baseModule.id] ?? baseModule;
          const moduleBusy = actionKey?.startsWith("module:" + module.id + ":") === true;
          return <div key={module.id} style={{ padding: "10px 12px", border: "1px solid var(--border, #e0e0e0)", borderRadius: 4, marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{safeRendererText(module.moduleName, "知识模块", 80)}</strong>
              <span style={{ fontSize: 12, color: learnStatusColor(module.learnStatus), fontWeight: 600 }}>{learnStatusLabel(module.learnStatus)}</span>
            </div>
            {module.summary ? <div style={{ fontSize: 12, color: "var(--text-muted, #888)", marginTop: 4 }}>{safeRendererText(module.summary, "", 400)}</div> : null}
            {module.sourceEvidenceJson ? <div style={{ fontSize: 11, color: "var(--text-muted, #888)", marginTop: 4 }}>来源：资料回链</div> : null}
            {rpc ? <button type="button" disabled={isReadOnly || moduleBusy} onClick={() => void updateModule(module)} style={{ marginTop: 8 }}>{nextLearnStatusLabel(module.learnStatus)}</button> : null}
          </div>;
        })}
      </div> : null}
    </TabContainer>
  );
}
