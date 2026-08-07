/**
 * pi-studybuddy Streams 服务端推送主题（06-API §4）
 *
 * renderer 通过 `subscribe(topic, key, on)` 订阅（03-Arch §6.3 RPC 层）。
 * 九个推送主题，与 06-API §4 逐一对应。
 */
import type {
  AgentEvent,
  Job,
  ReportDelivery,
  ToolchainStatus,
} from "./types";

export interface Streams {
  /** pi agent 事件：流式回复、工具调用视图、上下文压缩状态 */
  "agent.events": AgentEvent;
  /** file-watch 检测（100ms 防抖） */
  "files.changed": { path: string; changeType: "add" | "change" | "unlink" };
  /** Job 状态变更（转换/生成进度） */
  "jobs.progress": Job;
  /** 练习计时（限时可超时标记） */
  "practice.timer": { sessionId: string; elapsedMs: number; remainingMs?: number };
  /** TTS 播放状态 */
  "tts.state": {
    playbackId: string;
    state: "playing" | "paused" | "stopped";
    position: number;
    duration: number;
  };
  /** 备份/恢复进度 */
  "backup.progress": { backupRecordId: string; phase: string; progress: number };
  /** 投递状态变更 */
  "delivery.status": ReportDelivery;
  /** 工具发现变更（窗口 focus 重扫后） */
  "toolchains.changed": ToolchainStatus[];
  /** 调度提醒（桌面通知 + 应用内消息中心） */
  "schedule.reminder": { taskType: string; message: string };
}