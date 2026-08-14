/**
 * CaptureTab 采集 Tab（T-M4-017 RPC 接线，09-UI §4.10 + 06-API §3.9 + 07-WF §2.7）
 *
 * S7 课堂采集：合规确认（受控）→ 选择受控 PCM WAV（desktop dialog rawPath）→
 * classCapture.transcribe → 可编辑转写文本 → classCapture.saveTranscription（S7→S2 handoff）。
 *
 * 安全（07-WF §2.7 + AGENTS.md §9.3）：
 *   - 许可确认强制（未勾选不可转写）
 *   - 错误固定文案净化：不展示路径/UUID/file URI/错误栈/密钥
 *   - 音频路径不展示、不写日志；host 侧服务端重验证文件头 + tmp finally 清理
 *   - 归档学期只读（renderer 禁用 + host 结构性防线核验）
 *   - 竞态/卸载保护 + in-flight 防重复 mutation
 */
import React from "react";
import type { TypedRpcClient } from "../../rpc-client";
import type { SemesterCourseContext } from "../../semester-course-state";
import type { FileMeta } from "../../../contract/types";
import { TabContainer } from "../common/TabContainer";
import { EmptyState } from "../common/EmptyState";

interface Props {
  /** 初始合规确认状态（静态渲染/测试兼容；运行时受控） */
  permissionConfirmed?: boolean;
  /** 初始选中文件（静态渲染/测试兼容） */
  selectedFile?: FileMeta;
  /** 初始转写结果（静态渲染/测试兼容） */
  transcription?: string;
  /** RPC 客户端（运行时交互用） */
  rpc?: TypedRpcClient;
  /** 课程 ID */
  courseId?: string;
  /** AppShell 唯一学术上下文 */
  academicContext?: SemesterCourseContext;
  /** 复用 AppShell 已有 TTS 播放态，不另建跨 Tab 状态。 */
  onSpeakText?: (text: string, target?: { title?: string }) => void;
}

/** 文件大小格式化 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 默认保存标题：文件名去扩展名 */
function defaultTitleFromName(name: string | undefined): string {
  if (!name) return "课堂转写";
  const base = name.replace(/\.[^.]+$/, "").trim();
  return base || "课堂转写";
}

/** S7 host 固定错误码文案白名单（07-WF §2.7 错误处理）；其余一律降级为通用文案，不泄漏内部值 */
const KNOWN_ERROR_MESSAGES = [
  "需要课堂采集许可确认",
  "仅支持 PCM WAV 格式（16kHz/单声道/16-bit）",
  "语音转写未配置，请在设置中指定 whisper.cpp 路径",
  "转写失败，请检查音频文件是否完整",
  "转写文本不能为空",
  "笔记标题不能为空",
];

/** 错误净化：只透传 S7 固定文案；任何路径/UUID/file URI/栈/密钥都不进入展示（AGENTS.md §9.3）。
 * 未知错误一律降级为操作级固定 fallback 文案（07-WF §2.7 不泄漏内部值）。 */
function cleanError(e: unknown, fallback: string): string {
  const message =
    e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
      ? (e as { message: string }).message
      : "";
  const known = KNOWN_ERROR_MESSAGES.find((item) => message.includes(item));
  return known ?? fallback;
}

export function CaptureTab({
  permissionConfirmed = false,
  selectedFile,
  transcription,
  rpc,
  courseId,
  academicContext,
  onSpeakText,
}: Props): React.JSX.Element {
  const readOnly = academicContext?.isReadOnly === true;
  const [permission, setPermission] = React.useState<boolean>(permissionConfirmed);
  const [file, setFile] = React.useState<FileMeta | undefined>(selectedFile);
  const [transcript, setTranscript] = React.useState<string>(transcription ?? "");
  const [hasTranscription, setHasTranscription] = React.useState<boolean>(!!(transcription ?? ""));
  const [title, setTitle] = React.useState<string>(defaultTitleFromName(selectedFile?.name));
  const [transcribing, setTranscribing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [savedOk, setSavedOk] = React.useState(false);

  const mountedRef = React.useRef(true);
  const courseRef = React.useRef<string | undefined>(courseId);
  const transcribingRef = React.useRef(false);
  const savingRef = React.useRef(false);

  React.useEffect(() => {
    mountedRef.current = true;
    courseRef.current = courseId;
    return () => {
      mountedRef.current = false;
    };
  }, [courseId]);

  const busy = transcribing || saving;

  /** 选择受控 PCM WAV：desktop dialog rawPath capability（06-API §1.3 + §3.9 audioFile.path） */
  const selectFile = React.useCallback(async (): Promise<void> => {
    if (readOnly || !courseId || busy) return;
    // renderer E2E 测试 seam：受控夹具注入（原生对话框不可自动化；页面 JS 本已完全可信，无权限升级）。
    // 仅在真实 Electron E2E 的 executeJavaScript 中设置，生产用户无注入路径。
    const fixture = (globalThis as { __PI_CAPTURE_FIXTURE__?: FileMeta }).__PI_CAPTURE_FIXTURE__;
    if (fixture) {
      setFile(fixture);
      setTitle(defaultTitleFromName(fixture.name));
      setSavedOk(false);
      return;
    }
    const bridge = typeof window === "undefined" ? undefined : window.piBridge;
    if (!bridge) {
      setError("桌面文件选择不可用");
      return;
    }
    try {
      const selected = await bridge.showDialog({
        type: "open",
        rawPath: true,
        title: "选择课堂录音（PCM WAV）",
        filters: [{ name: "WAV 音频", extensions: ["wav"] }],
      });
      if (!mountedRef.current) return;
      if (selected.canceled || !selected.rawPath) return;
      setFile({
        name: selected.fileName ?? defaultTitleFromName(undefined) + ".wav",
        size: selected.fileSize ?? 0,
        mime: "audio/wav",
        path: selected.rawPath,
      });
      setTitle(defaultTitleFromName(selected.fileName));
      setSavedOk(false);
    } catch {
      // 不向用户暴露底层对话框错误（AGENTS.md §9.3）
      if (mountedRef.current) setError("文件选择失败，请重试");
    }
  }, [readOnly, courseId, busy]);

  /** 转写（06-API §3.9 classCapture.transcribe；in-flight 防重复 + 课程竞态丢弃） */
  const startTranscribe = React.useCallback(async (): Promise<void> => {
    if (!rpc || !courseId || !permission || !file || readOnly || busy) return;
    if (transcribingRef.current) return;
    transcribingRef.current = true;
    setTranscribing(true);
    setError(undefined);
    setSavedOk(false);
    const capturedCourseId = courseRef.current;
    try {
      const result = await rpc.call("classCapture.transcribe", {
        courseId,
        audioFile: file,
        permissionConfirmed: permission,
      });
      if (!mountedRef.current) return;
      if (courseRef.current !== capturedCourseId) return; // 课程已切换：丢弃旧响应
      setTranscript(result.transcription);
      setHasTranscription(true);
    } catch (e) {
      if (!mountedRef.current) return;
      if (courseRef.current !== capturedCourseId) return;
      setError(cleanError(e, "转写失败，请检查音频文件是否完整"));
    } finally {
      transcribingRef.current = false;
      if (mountedRef.current) setTranscribing(false);
    }
  }, [rpc, courseId, permission, file, readOnly, busy]);

  /** 保存为 S2 笔记输入（06-API §3.9 classCapture.saveTranscription；in-flight 防重复） */
  const saveTranscription = React.useCallback(async (): Promise<void> => {
    if (!rpc || !courseId || !file || readOnly || busy) return;
    const trimmed = transcript.trim();
    if (!trimmed) return;
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(undefined);
    setSavedOk(false);
    const capturedCourseId = courseRef.current;
    try {
      await rpc.call("classCapture.saveTranscription", {
        courseId,
        transcription: trimmed,
        title: title.trim() || defaultTitleFromName(file.name),
      });
      if (!mountedRef.current) return;
      if (courseRef.current !== capturedCourseId) return;
      setSavedOk(true);
    } catch (e) {
      if (!mountedRef.current) return;
      if (courseRef.current !== capturedCourseId) return;
      setError(cleanError(e, "保存失败，请重试"));
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }, [rpc, courseId, file, readOnly, busy, transcript, title]);

  const canTranscribe = !readOnly && !!courseId && permission && !!file && !busy;
  const canSave = !readOnly && !!courseId && !!file && transcript.trim().length > 0 && !busy;

  return (
    <TabContainer>
      <h2 style={{ fontSize: 16, margin: "0 0 16px 0" }}>课堂采集</h2>

      {/* 课程门控（T-M4-008 学术上下文） */}
      {!courseId && (
        <div style={{ padding: 12, background: "#fff3e0", border: "1px solid #ffe0b2", borderRadius: 4, marginBottom: 16, fontSize: 13 }}>
          请先选择课程
        </div>
      )}

      {/* 归档只读提示 */}
      {readOnly && (
        <div style={{ padding: 12, background: "#eceff1", border: "1px solid #cfd8dc", borderRadius: 4, marginBottom: 16, fontSize: 13 }}>
          当前学期已归档，仅可浏览
        </div>
      )}

      {/* §7.2 合规确认（强制） */}
      <div
        style={{
          padding: 12,
          background: "#fffde7",
          border: "1px solid #fff9c4",
          borderRadius: 4,
          marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>合规确认</div>
        <label style={{ display: "flex", alignItems: "center", fontSize: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={permission}
            disabled={readOnly || !courseId}
            onChange={(event) => setPermission(event.target.checked)}
            style={{ marginRight: 8 }}
          />
          <span>
            我确认此录音已获得授课教师授权，或为本人自主录音，可用于学习转写。
            <strong>未授权录音禁止转写。</strong>
          </span>
        </label>
      </div>

      {/* §4.10 文件选择（PCM WAV 单一输入，desktop dialog rawPath） */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, marginBottom: 8 }}>选择录音文件（仅支持 WAV 格式）</div>
        <button
          type="button"
          disabled={readOnly || !courseId || busy}
          onClick={() => {
            void selectFile();
          }}
          style={{
            padding: "6px 16px",
            fontSize: 13,
            cursor: readOnly || !courseId || busy ? "not-allowed" : "pointer",
            border: "1px solid var(--border, #e0e0e0)",
            background: readOnly || !courseId || busy ? "var(--bg-panel, #f5f5f5)" : "var(--bg-panel, #f5f5f5)",
            borderRadius: 4,
          }}
        >
          选择文件
        </button>
        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted, #888)" }}>
          PCM WAV 单一输入
        </span>
      </div>

      {/* 选中文件展示（不展示路径，仅名称/类型/大小，§11.1 隐私边界） */}
      {file && (
        <div
          style={{
            padding: 12,
            border: "1px solid var(--border, #e0e0e0)",
            borderRadius: 4,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{file.name}</strong>
              <div style={{ fontSize: 11, color: "var(--text-muted, #888)", marginTop: 4 }}>
                {file.mime} · {formatFileSize(file.size)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 转写按钮（合规确认未通过时禁用） */}
      <div style={{ marginBottom: 16, textAlign: "center" }}>
        <button
          type="button"
          disabled={!canTranscribe}
          onClick={() => {
            void startTranscribe();
          }}
          style={{
            padding: "8px 24px",
            fontSize: 13,
            cursor: canTranscribe ? "pointer" : "not-allowed",
            border: "1px solid var(--border, #e0e0e0)",
            background: canTranscribe ? "#1976d2" : "var(--bg-panel, #f5f5f5)",
            color: canTranscribe ? "#fff" : "var(--text-muted, #888)",
            borderRadius: 4,
            opacity: canTranscribe ? 1 : 0.6,
          }}
        >
          {transcribing ? "转写中…" : "开始转写"}
        </button>
        {!permission && courseId && (
          <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>
            请先勾选合规确认
          </div>
        )}
      </div>

      {/* 错误净化展示（固定文案，AGENTS.md §9.3） */}
      {error && (
        <div
          style={{
            padding: 10,
            background: "#fdecea",
            border: "1px solid #f5c6cb",
            borderRadius: 4,
            marginBottom: 16,
            fontSize: 12,
            color: "#c62828",
          }}
        >
          {error}
        </div>
      )}

      {/* 转写结果（可编辑） + 保存（区块在首次转写后常驻，清空文本仍可继续编辑/补写） */}
      {hasTranscription && (
        <div>
          <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>转写结果</h3>
          <textarea
            value={transcript}
            onChange={(event) => {
              setTranscript(event.target.value);
              setSavedOk(false);
            }}
            disabled={readOnly || !courseId}
            style={{
              width: "100%",
              minHeight: 140,
              padding: 12,
              background: "var(--bg-panel, #f5f5f5)",
              border: "1px solid var(--border, #e0e0e0)",
              borderRadius: 4,
              marginBottom: 12,
              whiteSpace: "pre-wrap",
              fontSize: 13,
              lineHeight: 1.6,
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
          <button type="button" disabled={!onSpeakText || !transcript.trim()} onClick={() => onSpeakText?.(transcript.trim(), { title: "课堂转写" })} style={{ marginBottom: 12, padding: "4px 12px", fontSize: 12 }}>朗读转写结果</button>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, marginBottom: 4, color: "var(--text-muted, #888)" }}>保存标题</div>
            <input
              name="capture-title"
              type="text"
              value={title}
              disabled={readOnly || !courseId || busy}
              onChange={(event) => {
                setTitle(event.target.value);
                setSavedOk(false);
              }}
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: 13,
                border: "1px solid var(--border, #e0e0e0)",
                borderRadius: 4,
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                void saveTranscription();
              }}
              style={{
                padding: "6px 16px",
                fontSize: 13,
                cursor: canSave ? "pointer" : "not-allowed",
                border: "1px solid var(--border, #e0e0e0)",
                background: canSave ? "#2e7d32" : "var(--bg-panel, #f5f5f5)",
                color: canSave ? "#fff" : "var(--text-muted, #888)",
                borderRadius: 4,
                opacity: canSave ? 1 : 0.6,
              }}
            >
              {saving ? "保存中…" : "保存为笔记"}
            </button>
            {savedOk && (
              <div style={{ fontSize: 12, color: "#2e7d32", marginTop: 6 }}>
                已保存为 S2 笔记输入，可在 📝 笔记 中继续生成笔记
              </div>
            )}
          </div>
        </div>
      )}

      {!hasTranscription && !file && (
        <EmptyState message="请选择录音文件开始转写" />
      )}
    </TabContainer>
  );
}
