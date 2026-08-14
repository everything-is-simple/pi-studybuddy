/**
 * BackupPanel 备份恢复面板（T-M2-008 静态壳，T-M4-019 RPC 接线）
 *
 * 09-UI §6.1-§6.3 + 06-API §3.11 + 07-WF §5：
 *   - 手动备份：backup.course（此课程）/ backup.allCourses（全部）；目标目录经
 *     desktop dialog directory capability 选择（shell 层，完整路径不进入 DOM）
 *   - 调度配置：backup.configureSchedule / listSchedules / toggleSchedule
 *   - 备份历史：backup.list（zipFilename/类型/大小/状态/时间，不显示 targetPath）
 *   - 从备份恢复：backup.restore（zip 选择 dialog rawPath + 冲突策略显式选择 → RestoreResult 摘要）
 *   - 进度：Streams["backup.progress"] 订阅
 * 隐私边界（AGENTS.md §9.3 + 09-UI §11.1）：不渲染 targetPath/zipPath 完整路径、完整 UUID、错误栈。
 * 静态兼容：无 rpc 时直接使用 props（T-M2-008 静态渲染测试）。
 */
import React, { useEffect, useRef, useState } from "react";
import type { TypedRpcClient } from "../rpc-client";
import type { BackupRecord, BackupSchedule, RestoreResult } from "../../contract/types";
import { EmptyState } from "./common/EmptyState";
import { ShortId } from "./common/ShortId";

/** 恢复流程阶段（runtime：idle→restoring→completed/failed；静态兼容：validating/conflict 展示） */
type RestorePhase = "idle" | "validating" | "conflict" | "restoring" | "completed" | "failed";

interface Props {
  /** 静态渲染兼容输入；运行时由既有 RPC 读取 */
  backups?: BackupRecord[];
  /** 静态渲染兼容输入；运行时由既有 RPC 读取 */
  schedules?: BackupSchedule[];
  /** 静态渲染兼容输入 */
  restorePhase?: RestorePhase;
  /** 静态渲染兼容输入 */
  hashValid?: boolean;
  /** 静态渲染兼容输入 */
  schemaCompatible?: boolean;
  /** 静态渲染兼容输入 */
  restoreResult?: RestoreResult;
  /** 静态渲染兼容输入 */
  restoreError?: string;
  /** RPC 客户端（运行时交互用） */
  rpc?: TypedRpcClient;
  /** 当前学期（AppShell 唯一上下文传入） */
  semesterId?: string;
  /** 当前课程（备份此课程门控） */
  courseId?: string;
}

/** 文件大小格式化 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 备份类型中文标签 */
function backupTypeLabel(type: BackupRecord["backupType"]): string {
  switch (type) {
    case "manual":
      return "手动";
    case "scheduled":
      return "调度";
    default:
      return type;
  }
}

/** 备份状态中文标签 */
function backupStatusLabel(status: BackupRecord["status"]): string {
  switch (status) {
    case "completed":
      return "✅ 完成";
    case "failed":
      return "❌ 失败";
    default:
      return "进行中";
  }
}

interface DialogBridge {
  showDialog(options: {
    type: string;
    title?: string;
    rawPath?: boolean;
    directory?: boolean;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<{ canceled: boolean; rawPath?: string; fileName?: string; fileSize?: number }>;
}

/** 受控桌面对话框（S2 importToken / S7 rawPath / 备份 directory + rawPath zip） */
function bridgeDialog(): DialogBridge | undefined {
  return (globalThis as { window?: Window & { piBridge?: DialogBridge } }).window?.piBridge;
}

export function BackupPanel({
  backups: staticBackups,
  schedules: staticSchedules,
  restorePhase: staticRestorePhase = "idle",
  hashValid,
  schemaCompatible,
  restoreResult: staticRestoreResult,
  restoreError: staticRestoreError,
  rpc,
  semesterId,
  courseId,
}: Props): React.JSX.Element {
  const hasRpc = Boolean(rpc);
  const effectiveSemesterId = semesterId;
  // 运行时状态（无 rpc 时保持静态 props，T-M2-008 静态渲染兼容）
  const [backups, setBackups] = useState<BackupRecord[]>(staticBackups ?? []);
  const [schedules, setSchedules] = useState<BackupSchedule[]>(staticSchedules ?? []);
  const [restorePhase, setRestorePhase] = useState<RestorePhase>(staticRestorePhase);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | undefined>(staticRestoreResult);
  const [restoreError, setRestoreError] = useState<string | undefined>(staticRestoreError);
  const [backupBusy, setBackupBusy] = useState<"course" | "all" | undefined>(undefined);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [targetDirChosen, setTargetDirChosen] = useState(false);
  const [zipPicked, setZipPicked] = useState(false);
  const [zipName, setZipName] = useState<string | undefined>(undefined);
  const [conflictChoice, setConflictChoice] = useState<"overwrite" | "create_new">("create_new");
  const [confirmingOverwrite, setConfirmingOverwrite] = useState(false);
  const [cronInput, setCronInput] = useState("0 2 * * *");
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  const [progress, setProgress] = useState<{ phase: string; progress: number } | undefined>(undefined);
  // 完整路径只存 ref，绝不进入 DOM（AGENTS.md §9.3）
  const targetDirRef = useRef("");
  const zipPathRef = useRef("");
  const listRequestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      listRequestRef.current += 1;
    };
  }, []);

  // 历史 + 调度列表加载（06-API §3.11 backup.list / listSchedules；竞态隔离）
  useEffect(() => {
    if (!rpc || !effectiveSemesterId) return;
    const requestId = ++listRequestRef.current;
    void rpc
      .call("backup.list", { semesterId: effectiveSemesterId })
      .then((list) => {
        if (!mountedRef.current || requestId !== listRequestRef.current) return;
        setBackups(list as BackupRecord[]);
      })
      .catch(() => {
        /* 静默失败：历史可空 */
      });
    void rpc
      .call("backup.listSchedules", { semesterId: effectiveSemesterId })
      .then((list) => {
        if (!mountedRef.current || requestId !== listRequestRef.current) return;
        setSchedules(list as BackupSchedule[]);
      })
      .catch(() => {
        /* 静默失败：调度可空 */
      });
  }, [rpc, effectiveSemesterId]);

  // backup.progress 订阅（06-API §4）
  useEffect(() => {
    if (!rpc) return;
    return rpc.subscribe("backup.progress", undefined, (payload) => {
      const event = payload as { phase?: string; progress?: number };
      if (!event || typeof event !== "object") return;
      setProgress({ phase: event.phase ?? "", progress: event.progress ?? 0 });
    });
  }, [rpc]);

  /** 目录选择（desktop dialog directory capability；完整路径不进 DOM；E2E 受控 seam） */
  async function pickBackupDirectory(): Promise<void> {
    // 测试 seam（T-M4-017 先例）：原生对话框不可自动化，E2E 注入受控目录路径
    const fixture = (globalThis as { window?: Window & { __PI_BACKUP_DIR_FIXTURE__?: string } }).window
      ?.__PI_BACKUP_DIR_FIXTURE__;
    if (fixture) {
      targetDirRef.current = fixture;
      setTargetDirChosen(true);
      setActionError(undefined);
      return;
    }
    const bridge = bridgeDialog();
    if (!bridge) return;
    const result = await bridge.showDialog({ type: "open", title: "选择备份目录", directory: true });
    if (!mountedRef.current || result.canceled || !result.rawPath) return;
    targetDirRef.current = result.rawPath;
    setTargetDirChosen(true);
    setActionError(undefined);
  }

  /** zip 选择（desktop dialog rawPath + zip filter；完整路径不进 DOM；E2E 受控 seam） */
  async function pickZipFile(): Promise<void> {
    // 测试 seam（T-M4-017 先例）：E2E 注入受控 zip 路径
    const fixture = (globalThis as { window?: Window & { __PI_BACKUP_ZIP_FIXTURE__?: { path: string; name?: string } } }).window
      ?.__PI_BACKUP_ZIP_FIXTURE__;
    if (fixture?.path) {
      zipPathRef.current = fixture.path;
      setZipPicked(true);
      setZipName(fixture.name);
      setActionError(undefined);
      return;
    }
    const bridge = bridgeDialog();
    if (!bridge) return;
    const result = await bridge.showDialog({
      type: "open",
      title: "选择备份 zip 文件",
      rawPath: true,
      filters: [{ name: "备份压缩包", extensions: ["zip"] }],
    });
    if (!mountedRef.current || result.canceled || !result.rawPath) return;
    zipPathRef.current = result.rawPath;
    setZipPicked(true);
    setZipName(result.fileName);
    setActionError(undefined);
    setConfirmingOverwrite(false);
  }

  /** 备份此课程（07-WF §5.1 + 06-API §3.11） */
  async function backupCourse(): Promise<void> {
    if (!rpc || !courseId || !targetDirRef.current || backupBusy) return;
    setBackupBusy("course");
    setActionError(undefined);
    try {
      await rpc.call("backup.course", { courseInstanceId: courseId, targetPath: targetDirRef.current });
      if (mountedRef.current) {
        await refreshList();
        setProgress(undefined); // 备份完成：清除进行中进度，避免与历史"✅ 完成"矛盾
      }
    } catch {
      if (mountedRef.current) setActionError("备份失败，请稍后重试。");
    } finally {
      if (mountedRef.current) setBackupBusy(undefined);
    }
  }

  /** 备份全部课程（07-WF §5.1） */
  async function backupAll(): Promise<void> {
    if (!rpc || !effectiveSemesterId || !targetDirRef.current || backupBusy) return;
    setBackupBusy("all");
    setActionError(undefined);
    try {
      await rpc.call("backup.allCourses", { semesterId: effectiveSemesterId, targetPath: targetDirRef.current });
      if (mountedRef.current) {
        await refreshList();
        setProgress(undefined); // 备份完成：清除进行中进度
      }
    } catch {
      if (mountedRef.current) setActionError("备份失败，请稍后重试。");
    } finally {
      if (mountedRef.current) setBackupBusy(undefined);
    }
  }

  async function refreshList(): Promise<void> {
    if (!rpc || !effectiveSemesterId) return;
    const list = (await rpc.call("backup.list", { semesterId: effectiveSemesterId })) as BackupRecord[];
    if (mountedRef.current) setBackups(list);
  }

  /** 调度配置（07-WF §5.2） */
  async function configureSchedule(): Promise<void> {
    const cron = cronInput.trim();
    if (!rpc || !effectiveSemesterId || !cron) return;
    setActionError(undefined);
    try {
      await rpc.call("backup.configureSchedule", {
        semesterId: effectiveSemesterId,
        cronExpression: cron,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
      });
      if (mountedRef.current) {
        const list = (await rpc.call("backup.listSchedules", { semesterId: effectiveSemesterId })) as BackupSchedule[];
        if (mountedRef.current) setSchedules(list);
      }
    } catch {
      if (mountedRef.current) setActionError("调度配置失败，请稍后重试。");
    }
  }

  /** 调度启停 */
  async function toggleSchedule(id: string, enabled: boolean): Promise<void> {
    if (!rpc || !effectiveSemesterId) return;
    setActionError(undefined);
    try {
      await rpc.call("backup.toggleSchedule", { id, enabled });
      if (mountedRef.current) {
        const list = (await rpc.call("backup.listSchedules", { semesterId: effectiveSemesterId })) as BackupSchedule[];
        if (mountedRef.current) setSchedules(list);
      }
    } catch {
      if (mountedRef.current) setActionError("调度启停失败，请稍后重试。");
    }
  }

  /** 从备份恢复（07-WF §5.3；覆盖策略需先经可取消确认） */
  async function restore(): Promise<void> {
    if (!rpc || !effectiveSemesterId || !zipPathRef.current || restoreBusy) return;
    if (conflictChoice === "overwrite" && !confirmingOverwrite) {
      setConfirmingOverwrite(true);
      return;
    }
    setConfirmingOverwrite(false);
    setRestoreBusy(true);
    setRestorePhase("restoring");
    setActionError(undefined);
    try {
      const result = (await rpc.call("backup.restore", {
        zipPath: zipPathRef.current,
        targetSemesterId: effectiveSemesterId,
        conflictResolution: conflictChoice,
      })) as RestoreResult;
      if (mountedRef.current) {
        setRestoreResult(result);
        setRestorePhase("completed");
      }
    } catch {
      if (mountedRef.current) {
        setRestorePhase("failed");
        setRestoreError("恢复失败，请检查备份文件后重试。");
      }
    } finally {
      if (mountedRef.current) setRestoreBusy(false);
    }
  }

  const courseBackupDisabled = !hasRpc || !courseId || !targetDirChosen || Boolean(backupBusy);
  const allBackupDisabled = !hasRpc || !effectiveSemesterId || !targetDirChosen || Boolean(backupBusy);
  const restoreDisabled = !hasRpc || !effectiveSemesterId || !zipPicked || restoreBusy;

  return (
    <div style={{ padding: 16, fontSize: 13 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 16px 0" }}>备份恢复</h2>

      {/* §6.1 手动备份 */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>手动备份</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12 }}>备份目录：</span>
          <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>
            {targetDirChosen ? "已选择备份目录（完整路径不显示）" : "未选择"}
          </span>
          <button
            type="button"
            onClick={() => void pickBackupDirectory()}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              cursor: "pointer",
              border: "1px solid var(--border, #e0e0e0)",
              background: "#fff",
              borderRadius: 4,
            }}
          >
            选择备份目录
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            disabled={courseBackupDisabled}
            onClick={() => void backupCourse()}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              cursor: courseBackupDisabled ? "default" : "pointer",
              border: "1px solid var(--border, #e0e0e0)",
              background: "#1976d2",
              color: "#fff",
              borderRadius: 4,
            }}
          >
            {backupBusy === "course" ? "备份中…" : "备份此课程"}
          </button>
          <button
            type="button"
            disabled={allBackupDisabled}
            onClick={() => void backupAll()}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              cursor: allBackupDisabled ? "default" : "pointer",
              border: "1px solid var(--border, #e0e0e0)",
              background: "#1976d2",
              color: "#fff",
              borderRadius: 4,
            }}
          >
            {backupBusy === "all" ? "备份中…" : "备份全部课程"}
          </button>
          {!courseId && hasRpc && (
            <span style={{ fontSize: 11, color: "var(--text-muted, #888)" }}>请先选择课程</span>
          )}
        </div>
        {progress && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted, #888)" }}>
            备份中：{progress.phase} {progress.progress}%
          </div>
        )}
        {actionError && (
          <div role="alert" style={{ marginTop: 8, fontSize: 12, color: "#c62828" }}>
            {actionError}
          </div>
        )}
      </div>

      {/* §6.1 调度配置 */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>调度配置</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12 }}>cron 表达式：</span>
          <input
            type="text"
            name="backup-cron"
            value={cronInput}
            onChange={(event) => setCronInput(event.target.value)}
            style={{
              width: 120,
              padding: "4px 8px",
              fontSize: 12,
              border: "1px solid var(--border, #e0e0e0)",
              borderRadius: 4,
            }}
          />
          <span style={{ fontSize: 11, color: "var(--text-muted, #888)" }}>
            （每天 02:00 自动备份）
          </span>
          <button
            type="button"
            disabled={!hasRpc}
            onClick={() => void configureSchedule()}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              cursor: hasRpc ? "pointer" : "default",
              border: "1px solid var(--border, #e0e0e0)",
              background: "#fff",
              borderRadius: 4,
            }}
          >
            配置调度
          </button>
        </div>
        {schedules.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  padding: "4px 0",
                }}
              >
                <span>
                  <ShortId id={schedule.id} />
                </span>
                <span>{schedule.cronExpression}</span>
                <span style={{ color: schedule.enabled ? "#2e7d32" : "var(--text-muted, #888)" }}>
                  {schedule.enabled ? "已启用" : "已停用"}
                </span>
                {hasRpc && (
                  <button
                    type="button"
                    onClick={() => void toggleSchedule(schedule.id, !schedule.enabled)}
                    style={{
                      padding: "2px 8px",
                      fontSize: 11,
                      cursor: "pointer",
                      border: "1px solid var(--border, #e0e0e0)",
                      background: "#fff",
                      borderRadius: 4,
                    }}
                  >
                    {schedule.enabled ? "停用" : "启用"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* §6.1 备份历史 */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>备份历史</h3>
        {backups.length === 0 ? (
          <EmptyState message="暂无备份历史" />
        ) : (
          backups.map((backup) => (
            <div
              key={backup.id}
              style={{
                padding: "10px 12px",
                border: "1px solid var(--border, #e0e0e0)",
                borderRadius: 4,
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{backup.zipFilename}</strong>
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      padding: "2px 6px",
                      background: "var(--bg-panel, #f5f5f5)",
                      borderRadius: 2,
                    }}
                  >
                    {backupTypeLabel(backup.backupType)}
                  </span>
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      color: backup.status === "failed" ? "#c62828" : "#2e7d32",
                    }}
                  >
                    {backupStatusLabel(backup.status)}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted, #888)" }}>
                  <ShortId id={backup.id} />
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted, #888)",
                  marginTop: 4,
                  display: "flex",
                  gap: 12,
                }}
              >
                <span>大小：{formatFileSize(backup.fileSizeBytes)}</span>
                <span>时间：{backup.startedAt.slice(0, 16).replace("T", " ")}</span>
              </div>
              {/* 恢复入口（决策 3A：触发 zip 选择恢复流程） */}
              <button
                type="button"
                disabled={!hasRpc}
                onClick={() => void pickZipFile()}
                style={{
                  marginTop: 8,
                  padding: "4px 12px",
                  fontSize: 12,
                  cursor: hasRpc ? "pointer" : "default",
                  border: "1px solid var(--border, #e0e0e0)",
                  background: "#fff",
                  borderRadius: 4,
                }}
              >
                恢复
              </button>
            </div>
          ))
        )}
      </div>

      {/* §6.2 从备份恢复 */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>从备份恢复</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12 }}>备份文件：</span>
          <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>
            {zipPicked ? zipName ?? "已选择（完整路径不显示）" : "未选择"}
          </span>
          <button
            type="button"
            disabled={!hasRpc}
            onClick={() => void pickZipFile()}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              cursor: hasRpc ? "pointer" : "default",
              border: "1px solid var(--border, #e0e0e0)",
              background: "#fff",
              borderRadius: 4,
            }}
          >
            选择 zip 文件
          </button>
        </div>

        {/* 冲突策略显式选择（决策 2A；host conflictResolution 参数语义） */}
        {zipPicked && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <div style={{ marginBottom: 6 }}>发现同名课程时的处理方式：</div>
            <label style={{ marginRight: 12 }}>
              <input
                type="radio"
                name="restore-conflict"
                value="overwrite"
                checked={conflictChoice === "overwrite"}
                onChange={() => {
                  setConflictChoice("overwrite");
                  setConfirmingOverwrite(false);
                }}
                style={{ marginRight: 4 }}
              />
              覆盖现有数据
            </label>
            <label>
              <input
                type="radio"
                name="restore-conflict"
                value="create_new"
                checked={conflictChoice === "create_new"}
                onChange={() => {
                  setConflictChoice("create_new");
                  setConfirmingOverwrite(false);
                }}
                style={{ marginRight: 4 }}
              />
              新建课程（保留两份）
            </label>
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                disabled={restoreDisabled}
                onClick={() => void restore()}
                style={{
                  padding: "6px 16px",
                  fontSize: 13,
                  cursor: restoreDisabled ? "default" : "pointer",
                  border: "1px solid var(--border, #e0e0e0)",
                  background: "#1976d2",
                  color: "#fff",
                  borderRadius: 4,
                }}
              >
                {restoreBusy ? "恢复中…" : "开始恢复"}
              </button>
            </div>
            {confirmingOverwrite && (
              <div role="alert" style={{ marginTop: 12, padding: 12, border: "1px solid #c62828", borderRadius: 4, background: "#ffebee" }}>
                <div style={{ fontSize: 12, marginBottom: 8 }}>覆盖会替换现有课程数据。当前恢复接口不会预检同名冲突；请确认后继续。</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" disabled={restoreBusy} onClick={() => void restore()} style={{ padding: "4px 12px", fontSize: 12, cursor: restoreBusy ? "default" : "pointer", border: "1px solid #c62828", background: "#c62828", color: "#fff", borderRadius: 4 }}>确认覆盖</button>
                  <button type="button" disabled={restoreBusy} onClick={() => setConfirmingOverwrite(false)} style={{ padding: "4px 12px", fontSize: 12, cursor: restoreBusy ? "default" : "pointer", border: "1px solid var(--border, #e0e0e0)", background: "#fff", borderRadius: 4 }}>取消</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 恢复流程状态区（runtime：restoring/completed/failed；静态兼容：validating/conflict） */}
        {restorePhase !== "idle" && (
          <div
            style={{
              padding: 12,
              border: "1px solid #1976d2",
              borderRadius: 4,
              marginTop: 12,
              background: "#e3f2fd",
            }}
          >
            <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>恢复流程</h3>

            {restorePhase === "validating" && (
              <div style={{ fontSize: 12 }}>
                <div>校验中…</div>
                {hashValid !== undefined && (
                  <div style={{ marginTop: 4 }}>
                    content_hash 校验：
                    <span style={{ color: hashValid ? "#2e7d32" : "#c62828" }}>
                      {hashValid ? "通过" : "失败"}
                    </span>
                  </div>
                )}
                {schemaCompatible !== undefined && (
                  <div style={{ marginTop: 4 }}>
                    schema_version 校验：
                    <span style={{ color: schemaCompatible ? "#2e7d32" : "#c62828" }}>
                      {schemaCompatible ? "兼容" : "不兼容"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {restorePhase === "conflict" && (
              <div style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>检测到冲突</div>
                <div style={{ marginBottom: 8 }}>目标课程已存在数据，请选择恢复方式：</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    style={{
                      padding: "4px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                      border: "1px solid #c62828",
                      background: "#ffebee",
                      color: "#c62828",
                      borderRadius: 4,
                    }}
                  >
                    覆盖现有数据
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "4px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                      border: "1px solid #1976d2",
                      background: "#e3f2fd",
                      color: "#1976d2",
                      borderRadius: 4,
                    }}
                  >
                    新建课程
                  </button>
                </div>
              </div>
            )}

            {restorePhase === "restoring" && (
              <div style={{ fontSize: 12 }}>恢复中…</div>
            )}

            {restorePhase === "completed" && restoreResult && (
              <div style={{ fontSize: 12 }}>
                <div style={{ color: "#2e7d32", fontWeight: 600, marginBottom: 8 }}>恢复完成</div>
                <div style={{ marginBottom: 4 }}>
                  integrity_check：<strong>{restoreResult.integrityCheck}</strong>
                </div>
                <div style={{ marginBottom: 4 }}>
                  导入表：{restoreResult.tablesImported.join("、")}
                </div>
                <div style={{ marginBottom: 4 }}>
                  恢复文件数：{restoreResult.filesRestored}
                </div>
                {restoreResult.schemaVersion && (
                  <div style={{ marginBottom: 4 }}>schema_version：{restoreResult.schemaVersion}</div>
                )}
                <div>
                  冲突解决方式：
                  {restoreResult.conflictResolved === "none" ? "无冲突" : restoreResult.conflictResolved}
                </div>
              </div>
            )}

            {restorePhase === "failed" && (
              <div style={{ fontSize: 12, color: "#c62828" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>恢复失败</div>
                <div>{restoreError}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
