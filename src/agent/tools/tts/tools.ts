/**
 * T-M2-004 TTS registerTool 工具定义（03-Arch §3.1 + §2.2 ToolDefinition 契约）
 *
 * 3 个 studybuddy_* 工具，execute 薄封装调用 TTS handler（06-API §3.10）。
 * 工具名匹配 ^studybuddy_[a-z_]+$；ToolDefinition 必填 name/label/description/parameters/execute。
 *
 * 工具清单（03-Arch §3.1 TTS 工具表 3 个）：
 *   1. studybuddy_tts_speak         → tts.speak（合成并播放：SAPI 默认 + edge-tts 降级）
 *   2. studybuddy_tts_control       → tts.control（播放控制：play/pause/stop）
 *   3. studybuddy_tts_switch_engine → tts.switchEngine（切换引擎 SAPI/edge-tts）
 *
 * 注意：tts.getStatus 是 RPC 不是工具（03-Arch §3.1 工具表只列 3 个）。
 */
import { Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { TtsContext } from "../../../agent-host/handlers/tts/context";
import { createTtsHandlers } from "../../../agent-host/handlers/tts";

function textContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

function jsonContent(obj: unknown): { type: "text"; text: string } {
  return textContent(JSON.stringify(obj, null, 2));
}

export const TTS_TOOL_NAMES = [
  "studybuddy_tts_speak",
  "studybuddy_tts_control",
  "studybuddy_tts_switch_engine",
] as const;

export const TTS_TOOL_COUNT = TTS_TOOL_NAMES.length;

/**
 * 创建 TTS 全部 3 个 studybuddy_* 工具。
 * @param ctx TTS 上下文（双引擎 Adapter + 当前引擎 + Streams 推送回调）
 */
export function createTtsTools(ctx: TtsContext): ToolDefinition[] {
  const handlers = createTtsHandlers(ctx);

  return [
    // 1. studybuddy_tts_speak → tts.speak
    {
      name: "studybuddy_tts_speak",
      label: "朗读文本",
      description:
        "合成并播放文本（SAPI 默认离线；edge-tts 可选需网络，失败自动降级 SAPI）。跨子系统随时可击发：笔记/错题复盘/冲刺要点等均可朗读。返回 playbackId 供后续控制。",
      promptSnippet: "TTS 朗读：SAPI 默认 + edge-tts 降级 + 跨子系统随时可击发",
      parameters: Type.Object({
        text: Type.String({ description: "要朗读的文本（非空）" }),
        engine: Type.Optional(
          Type.Union([Type.Literal("sapi"), Type.Literal("edge-tts")], {
            description: "引擎选择（默认 sapi，可选 edge-tts）",
          }),
        ),
      }),
      async execute(_toolCallId, params) {
        const result = await handlers["tts.speak"](params) as {
          playbackId: string;
          engine: "sapi" | "edge-tts";
          fallbackUsed?: boolean;
        };
        const fallbackNote = result.fallbackUsed ? "（edge-tts 失败已降级 SAPI）" : "";
        return {
          content: [
            textContent(
              `朗读已开始${fallbackNote}（引擎 ${result.engine}，playbackId ${result.playbackId.slice(0, 12)}...）。可用 studybuddy_tts_control 控制播放。`,
            ),
            jsonContent(result),
          ],
          details: {
            playbackId: result.playbackId,
            engine: result.engine,
            fallbackUsed: result.fallbackUsed,
          },
        };
      },
    },

    // 2. studybuddy_tts_control → tts.control
    {
      name: "studybuddy_tts_control",
      label: "朗读控制",
      description:
        "控制朗读播放：play（恢复）/ pause（暂停）/ stop（停止）。需提供 speak 返回的 playbackId。",
      promptSnippet: "TTS 控制：play/pause/stop + playbackId",
      parameters: Type.Object({
        playbackId: Type.String({ description: "speak 返回的 playbackId" }),
        action: Type.Union(
          [Type.Literal("play"), Type.Literal("pause"), Type.Literal("stop")],
          { description: "控制动作：play/pause/stop" },
        ),
        rate: Type.Optional(
          Type.Number({ description: "语速（可选，仅 play 时生效）" }),
        ),
      }),
      async execute(_toolCallId, params) {
        await handlers["tts.control"](params);
        const p = params as { playbackId: string; action: string };
        const actionText = { play: "已恢复朗读", pause: "已暂停朗读", stop: "已停止朗读" }[p.action] ?? "控制完成";
        return {
          content: [
            textContent(`${actionText}（playbackId ${p.playbackId.slice(0, 12)}...）。`),
            jsonContent({ playbackId: p.playbackId, action: p.action }),
          ],
          details: {
            playbackId: p.playbackId,
            action: p.action,
          },
        };
      },
    },

    // 3. studybuddy_tts_switch_engine → tts.switchEngine
    {
      name: "studybuddy_tts_switch_engine",
      label: "切换朗读引擎",
      description:
        "切换默认朗读引擎（sapi 系统自带离线 / edge-tts 需网络）。不影响进行中的播放，下次 speak 生效。",
      promptSnippet: "TTS 切换引擎：SAPI/edge-tts（下次 speak 生效）",
      parameters: Type.Object({
        engine: Type.Union(
          [Type.Literal("sapi"), Type.Literal("edge-tts")],
          { description: "目标引擎：sapi（默认离线）/ edge-tts（需网络）" },
        ),
      }),
      async execute(_toolCallId, params) {
        handlers["tts.switchEngine"](params);
        const p = params as { engine: string };
        const engineText = p.engine === "sapi" ? "SAPI（系统自带离线）" : "edge-tts（需网络）";
        return {
          content: [
            textContent(`默认朗读引擎已切换为 ${engineText}。下次朗读生效。`),
            jsonContent({ engine: p.engine }),
          ],
          details: {
            engine: p.engine,
          },
        };
      },
    },
  ];
}
