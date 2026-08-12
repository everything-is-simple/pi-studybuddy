/**
 * MaterialsTab 资料 Tab（T-M1-009，T-M4-011，09-UI §4.4）
 *
 * S2 资料上传与管理：资料列表 + 状态标识 + 上传入口 + 转换/生成笔记操作。
 * Material 状态机（05-ERD §8.3）：pending→converting→converted→note_generating→completed
 *   转换失败：conversion_failed
 *
 * §11.1 隐私边界：不渲染完整 ID、敏感路径或 RPC 内部错误。
 */
import React from "react";
import type { TypedRpcClient } from "../../rpc-client";
import type { SemesterCourseContext } from "../../semester-course-state";
import { useTabData } from "./useTabData";
import type { DialogResult, FileMeta, Material, MaterialStatus } from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";

interface Props {
  /** 资料列表（仅兼容无 RPC 的静态渲染/旧测试夹具） */
  materials?: Material[];
  /** RPC 客户端（运行时交互用） */
  rpc?: TypedRpcClient;
  /** 课程 ID */
  courseId?: string;
  /** AppShell 唯一学术上下文（兼容旧的扁平 props） */
  academicContext?: SemesterCourseContext;
}

type ActionKind = "upload" | "convert" | "generateNote" | "retryAiGeneration";

interface ContextToken {
  courseId?: string;
  rpc?: TypedRpcClient;
  isReadOnly: boolean;
}

interface ActiveAction {
  id: number;
  key: string;
  kind: ActionKind;
  context: ContextToken;
}

const ACTION_ERROR_MESSAGE: Record<ActionKind, string> = {
  upload: "上传资料失败，请稍后重试。",
  convert: "转换资料失败，请稍后重试。",
  generateNote: "生成笔记失败，请稍后重试。",
  retryAiGeneration: "重试生成笔记失败，请稍后重试。",
};

const ACTION_SUCCESS_MESSAGE: Record<ActionKind, string> = {
  upload: "资料上传成功，资料列表已刷新。",
  convert: "转换任务已提交，资料列表已刷新。",
  generateNote: "笔记生成任务已提交，资料列表已刷新。",
  retryAiGeneration: "重试生成笔记任务已提交，资料列表已刷新。",
};

const BUTTON_STYLE: React.CSSProperties = {
  padding: "6px 16px",
  fontSize: 13,
  cursor: "pointer",
  border: "1px solid var(--border, #e0e0e0)",
  background: "var(--bg-panel, #f5f5f5)",
  borderRadius: 4,
};

const FILE_FILTERS = [
  { name: "课程资料", extensions: ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "md"] },
  { name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "bmp", "webp"] },
];

function materialStatusLabel(status: MaterialStatus): string {
  switch (status) {
    case "pending":
      return "待处理";
    case "converting":
      return "转换中";
    case "converted":
      return "已转换";
    case "note_generating":
      return "笔记生成中";
    case "completed":
      return "已完成";
    case "conversion_failed":
      return "转换失败";
    case "pending_quality_check":
      return "待质检";
    default:
      return status;
  }
}

function materialStatusColor(status: MaterialStatus): string {
  switch (status) {
    case "completed":
      return "#2e7d32";
    case "converting":
    case "note_generating":
      return "#f57c00";
    case "conversion_failed":
      return "#c62828";
    default:
      return "var(--text-muted, #888)";
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileNameFromPath(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1) || "未命名资料";
}

function mimeFromFileName(fileName: string): string {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  const mimeByExtension: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain",
    md: "text/markdown",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp",
  };
  return mimeByExtension[extension] ?? "application/octet-stream";
}

function fileMetaFromDialog(selected: DialogResult): FileMeta {
  const name = selected.fileName ?? (selected.filePath ? fileNameFromPath(selected.filePath) : "未命名资料");
  if (!selected.importToken) throw new Error("资料导入凭据缺失或已过期");
  return {
    name,
    size: selected.fileSize ?? 0,
    mime: mimeFromFileName(name),
    importToken: selected.importToken,
  };
}

function actionLabel(kind: ActionKind): string {
  switch (kind) {
    case "upload":
      return "上传中…";
    case "convert":
      return "转换中…";
    case "generateNote":
      return "生成中…";
    case "retryAiGeneration":
      return "重试中…";
  }
}

export function MaterialsTab({ materials, rpc, courseId, academicContext }: Props): React.JSX.Element {
  const effectiveCourseId = academicContext?.courseId ?? courseId;
  const isReadOnly = academicContext?.isReadOnly === true;
  const contextToken = React.useMemo<ContextToken>(
    () => ({ courseId: effectiveCourseId, rpc, isReadOnly }),
    [effectiveCourseId, rpc, isReadOnly],
  );
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [activeAction, setActiveAction] = React.useState<ActiveAction | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionNotice, setActionNotice] = React.useState<string | null>(null);
  const [previewState, setPreviewState] = React.useState<{ materialId: string; html?: string; status: "loading" | "ready" | "error" } | undefined>();
  const previewRequestRef = React.useRef(0);
  const activeActionRef = React.useRef<ActiveAction | null>(null);
  const nextActionIdRef = React.useRef(0);
  const contextRef = React.useRef(contextToken);
  contextRef.current = contextToken;

  const resource = useTabData<Material[]>({
    rpc,
    key: `materials:${effectiveCourseId ?? ""}:${refreshToken}`,
    enabled: Boolean(rpc && effectiveCourseId),
    initialData: [],
    load: (client) => client.call("materials.list", { courseId: effectiveCourseId }),
  });
  const visibleMaterials = rpc ? resource.data : materials;
  const actionsEnabled = Boolean(rpc && effectiveCourseId && !isReadOnly);

  React.useEffect(() => {
    setActionError(null);
    setActionNotice(null);
    activeActionRef.current = null;
    setActiveAction(null);
    setPreviewState(undefined);
    previewRequestRef.current += 1;
  }, [contextToken]);

  async function runAction(
    kind: ActionKind,
    key: string,
    action: () => Promise<unknown>,
    expectedContext: ContextToken = contextToken,
  ): Promise<void> {
    if (!actionsEnabled || expectedContext.isReadOnly || contextRef.current !== expectedContext || activeActionRef.current) return;
    const active = { id: ++nextActionIdRef.current, key, kind, context: expectedContext };
    activeActionRef.current = active;
    setActiveAction(active);
    setActionError(null);
    setActionNotice(null);
    try {
      await action();
      if (contextRef.current !== active.context || activeActionRef.current?.id !== active.id) return;
      setRefreshToken((token) => token + 1);
      setActionNotice(ACTION_SUCCESS_MESSAGE[kind]);
    } catch {
      if (contextRef.current === active.context && activeActionRef.current?.id === active.id) {
        setActionError(ACTION_ERROR_MESSAGE[kind]);
      }
    } finally {
      if (activeActionRef.current?.id === active.id) {
        activeActionRef.current = null;
        setActiveAction(null);
      }
    }
  }

  async function uploadMaterial(): Promise<void> {
    const dialogContext = contextToken;
    if (!actionsEnabled || !rpc || !effectiveCourseId || contextRef.current !== dialogContext) return;
    try {
      const bridge = typeof window === "undefined" ? undefined : window.piBridge;
      if (!bridge) throw new Error("bridge unavailable");
      const selected = await bridge.showDialog({
        type: "open",
        title: "选择课程资料",
        filters: FILE_FILTERS,
      });
      if (selected.canceled) return;
      const filePath = selected.filePath ?? selected.filePaths?.[0];
      const uploadCourseId = dialogContext.courseId;
      if ((!filePath && !selected.importToken) || !uploadCourseId || contextRef.current !== dialogContext || dialogContext.isReadOnly) return;
      const file = fileMetaFromDialog({ ...selected, filePath });
      await runAction(
        "upload",
        "upload",
        () => rpc.call("materials.upload", { courseId: uploadCourseId, file }),
        dialogContext,
      );
    } catch {
      if (contextRef.current === dialogContext && !dialogContext.isReadOnly) {
        setActionError(ACTION_ERROR_MESSAGE.upload);
      }
    }
  }

  function convertMaterial(mat: Material): void {
    if (!actionsEnabled || !rpc) return;
    const kind: ActionKind = "convert";
    const method = mat.status === "conversion_failed" ? "materials.retryConversion" : "materials.convert";
    void runAction(kind, `${kind}:${mat.id}`, () => rpc.call(method, { id: mat.id }));
  }

  function generateNote(mat: Material): void {
    if (!actionsEnabled || !rpc) return;
    void runAction("generateNote", `generateNote:${mat.id}`, () =>
      rpc.call("materials.generateNote", { id: mat.id }),
    );
  }

  function retryAiGeneration(mat: Material): void {
    if (!actionsEnabled || !rpc) return;
    void runAction("retryAiGeneration", `retryAiGeneration:${mat.id}`, () =>
      rpc.call("materials.retryAiGeneration", { id: mat.id }),
    );
  }

  function previewMaterial(mat: Material): void {
    if (!rpc || !mat || !effectiveCourseId) return;
    const requestId = ++previewRequestRef.current;
    const materialId = mat.id;
    const isMarkdown = mat.fileName.toLowerCase().endsWith(".md");
    setPreviewState({ materialId, status: "loading" });
    const call = isMarkdown
      ? rpc.call("files.previewMarkdown", { path: mat.storageKey })
      : rpc.call("files.read", { path: mat.storageKey });
    void call
      .then((result) => {
        if (previewRequestRef.current !== requestId) return;
        const html = isMarkdown
          ? (result as { html: string }).html
          : `<pre>${(result as { content: string }).content.slice(0, 20_000)}</pre>`;
        setPreviewState({ materialId, html, status: "ready" });
      })
      .catch(() => {
        if (previewRequestRef.current !== requestId) return;
        setPreviewState({ materialId, status: "error" });
      });
  }

  function renderActionButton(mat: Material): React.JSX.Element | null {
    const active = activeAction?.key === `convert:${mat.id}`;
    if (mat.status === "pending" || mat.status === "conversion_failed") {
      return (
        <button style={BUTTON_STYLE} type="button" onClick={() => convertMaterial(mat)} disabled={!actionsEnabled || Boolean(activeAction)}>
          {active ? actionLabel("convert") : mat.status === "conversion_failed" ? "重试转换" : "开始转换"}
        </button>
      );
    }
    if (mat.status === "converted" || mat.status === "note_generating") {
      const noteActive = activeAction?.key === `generateNote:${mat.id}` || activeAction?.key === `retryAiGeneration:${mat.id}`;
      return (
        <button style={BUTTON_STYLE} type="button" onClick={() => (mat.status === "note_generating" ? retryAiGeneration(mat) : generateNote(mat))} disabled={!actionsEnabled || Boolean(activeAction)}>
          {noteActive
            ? activeAction?.key === `retryAiGeneration:${mat.id}`
              ? actionLabel("retryAiGeneration")
              : actionLabel("generateNote")
            : mat.status === "note_generating"
              ? "重试生成笔记"
              : "生成笔记"}
        </button>
      );
    }
    return null;
  }

  const uploadActive = activeAction?.key === "upload";
  const uploadButton = (
    <button style={BUTTON_STYLE} type="button" onClick={() => void uploadMaterial()} disabled={!actionsEnabled || Boolean(activeAction)}>
      {uploadActive ? actionLabel("upload") : "上传资料"}
    </button>
  );

  if (rpc && resource.status === "loading") {
    return <TabContainer><div role="status">正在加载资料…</div></TabContainer>;
  }
  if (rpc && resource.status === "error") {
    return (
      <TabContainer>
        <div role="alert">暂时无法加载资料，请稍后重试。</div>
        <button style={{ ...BUTTON_STYLE, marginTop: 8 }} type="button" onClick={() => setRefreshToken((token) => token + 1)}>重试</button>
      </TabContainer>
    );
  }

  if (!visibleMaterials || visibleMaterials.length === 0) {
    return (
      <TabContainer>
        <div style={{ marginBottom: 16 }}>{uploadButton}</div>
        {actionError ? <div role="alert">{actionError}</div> : null}
        {actionNotice ? <div role="status">{actionNotice}</div> : null}
        <EmptyState message={effectiveCourseId ? "暂无资料，请上传课程资料" : "暂无资料，请先选择课程后查看资料"} />
      </TabContainer>
    );
  }

  return (
    <TabContainer>
      <div style={{ marginBottom: 16 }}>{uploadButton}</div>
      {actionError ? <div role="alert">{actionError}</div> : null}
      {actionNotice ? <div role="status">{actionNotice}</div> : null}
      <div>
        <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>资料列表</h3>
        {visibleMaterials.map((mat) => (
          <div key={mat.id} style={{ padding: "10px 12px", border: "1px solid var(--border, #e0e0e0)", borderRadius: 4, marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{mat.fileName}</strong>
              <span style={{ fontSize: 12, color: materialStatusColor(mat.status), fontWeight: 600 }}>
                {activeAction?.key === `convert:${mat.id}` ? "转换中" : activeAction?.key === `generateNote:${mat.id}` ? "笔记生成中" : materialStatusLabel(mat.status)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted, #888)", marginTop: 4, display: "flex", gap: 12 }}>
              <span>类型：{mat.fileType}</span>
              <span>大小：{formatFileSize(mat.fileSizeBytes)}</span>
              <span>上传：{mat.uploadedAt.slice(0, 10)}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {renderActionButton(mat)}
              {rpc && mat.status !== "pending" && mat.status !== "conversion_failed" && (
                <button style={BUTTON_STYLE} type="button" onClick={() => previewMaterial(mat)} disabled={Boolean(previewState) && previewState?.status === "loading"}>
                  {previewState?.materialId === mat.id && previewState?.status === "loading" ? "预览中…" : "预览"}
                </button>
              )}
            </div>
            {previewState?.materialId === mat.id && previewState.status === "ready" && previewState.html && (
              <div style={{ marginTop: 8, padding: 12, background: "var(--bg-panel, #fafafa)", border: "1px solid var(--border, #e0e0e0)", borderRadius: 4, fontSize: 12, maxHeight: 320, overflow: "auto" }}>
                {/* 预览内容为 host 端转义后的安全 HTML（files.previewMarkdown 已 escapeHtml） */}
                <div dangerouslySetInnerHTML={{ __html: previewState.html }} />
                <button style={{ ...BUTTON_STYLE, marginTop: 8 }} type="button" onClick={() => setPreviewState(undefined)}>关闭预览</button>
              </div>
            )}
            {previewState?.materialId === mat.id && previewState.status === "error" && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <div role="alert">预览失败，请稍后重试。</div>
                <button style={{ ...BUTTON_STYLE, marginTop: 8 }} type="button" onClick={() => previewMaterial(mat)}>重试预览</button>
                <button style={{ ...BUTTON_STYLE, marginTop: 8, marginLeft: 8 }} type="button" onClick={() => setPreviewState(undefined)}>关闭</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </TabContainer>
  );
}
