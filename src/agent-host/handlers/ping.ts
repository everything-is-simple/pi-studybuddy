/**
 * pi-studybuddy agent-host ping handler（03-Arch §6.3）
 *
 * 最小 RPC handler：验证 renderer→main→agent-host 通道往返。
 * 返回 { pong, timestamp }，timestamp 由 agent-host 本地时钟生成。
 */
import type { Api } from "../../contract/api";

export function ping(params: Api["system.ping"]["params"]): Api["system.ping"]["result"] {
  return { pong: params?.message ?? "pong", timestamp: Date.now() };
}