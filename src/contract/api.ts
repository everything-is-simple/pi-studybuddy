/**
 * pi-studybuddy RPC 契约（interface Api，03-Arch §6.3 + 06-API §1）
 *
 * 方法名采用 `namespace.action` 风格。M0 骨架仅含 `system.ping` 占位，
 * 用于验证 renderer→main→agent-host 的 RPC 通道往返。
 * 完整契约（~50 方法：sessions/files/S1-S7/TTS/备份恢复/skills/models/settings/
 * credentials/toolchains）在 T-M0-002 任务填充。
 */
export interface Api {
  /** 心跳占位：验证 RPC 通道往返 */
  "system.ping": {
    params: { message?: string };
    result: { pong: string; timestamp: number };
  };
}