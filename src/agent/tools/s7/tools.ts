/**
 * T-M2-003 S7 registerTool 工具定义（03-Arch §3.1 + §2.2 ToolDefinition 契约）
 *
 * 2 个 studybuddy_* 工具，execute 薄封装调用 S7 handler（06-API §3.9）。
 * 工具名匹配 ^studybuddy_[a-z_]+$；ToolDefinition 必填 name/label/description/parameters/execute。
 *
 * 工具清单：
 *   1. studybuddy_transcribe_class     → classCapture.transcribe（许可确认 + PCM WAV + whisper.cpp + finally 清理）
 *   2. studybuddy_save_transcription   → classCapture.saveTranscription（handoff 到 S2 笔记输入）
 */
import { Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { S7Context } from "../../../agent-host/handlers/s7/context";
import { createS7Handlers } from "../../../agent-host/handlers/s7";

function textContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

function jsonContent(obj: unknown): { type: "text"; text: string } {
  return textContent(JSON.stringify(obj, null, 2));
}

export const S7_TOOL_NAMES = [
  "studybuddy_transcribe_class",
  "studybuddy_save_transcription",
] as const;

export const S7_TOOL_COUNT = S7_TOOL_NAMES.length;

/**
 * 创建 S7 全部 2 个 studybuddy_* 工具。
 * @param ctx S7 上下文（数据层句柄 + WhisperCppAdapter + whisperCliPath/ModelPath + tmpRoot）
 */
export function createS7Tools(ctx: S7Context): ToolDefinition[] {
  const handlers = createS7Handlers(ctx);

  return [
    // 1. studybuddy_transcribe_class → classCapture.transcribe
    {
      name: "studybuddy_transcribe_class",
      label: "课堂采集转写",
      description:
        "本机 whisper.cpp 同步转写受控 PCM WAV（16kHz/单声道/16-bit）。许可确认强制；CLI/模型路径只来自配置；不回退云端；不返回 stdout 全文；原始音频 finally 清理不留存。",
      promptSnippet: "课堂采集转写：许可确认 + PCM WAV 服务端验证 + whisper.cpp 同步 + finally 清理",
      parameters: Type.Object({
        courseId: Type.String({ description: "课程实例 ID" }),
        audioFilePath: Type.String({
          description: "PCM WAV 文件绝对路径（16kHz/单声道/16-bit，服务端重新验证文件头）",
        }),
        permissionConfirmed: Type.Boolean({
          description: "已获老师和相关同学允许（合规要求，false 时拒绝转写）",
        }),
      }),
      async execute(_toolCallId, params) {
        const p = params as {
          courseId: string;
          audioFilePath: string;
          permissionConfirmed: boolean;
        };
        // 薄封装：构造 FileMeta（含 path）调 handler
        const result = await handlers["classCapture.transcribe"]({
          courseId: p.courseId,
          audioFile: {
            name: "class-capture.wav",
            size: 0,
            mime: "audio/wav",
            path: p.audioFilePath,
          },
          permissionConfirmed: p.permissionConfirmed,
        }) as { transcription: string };
        return {
          content: [
            textContent(
              `课堂采集转写完成（${result.transcription.length} 字）。请学生核对后用 studybuddy_save_transcription 保存为笔记输入。`,
            ),
            jsonContent({ transcription: result.transcription }),
          ],
          details: {
            transcription: result.transcription,
            charCount: result.transcription.length,
          },
        };
      },
    },

    // 2. studybuddy_save_transcription → classCapture.saveTranscription
    {
      name: "studybuddy_save_transcription",
      label: "保存课堂转写为笔记输入",
      description:
        "学生修改转写文本后保存为 S2 笔记输入（创建 file_type='text' material，初始 converted）。不自动 generateNote，学生在 S2 自行触发。handoff 写 materials + normalized_texts + study_events(source_system='S7')。",
      promptSnippet: "保存课堂转写：handoff 到 S2（material + normalized_text + study_event）",
      parameters: Type.Object({
        courseId: Type.String({ description: "课程实例 ID" }),
        transcription: Type.String({ description: "学生修改后的转写文本（非空）" }),
        title: Type.String({ description: "笔记标题（非空）" }),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["classCapture.saveTranscription"](params) as {
          id: string;
          fileName: string;
          fileType: string;
          sourceType: string;
          status: string;
        };
        return {
          content: [
            textContent(
              `课堂转写已保存为笔记输入：${result.fileName}（material ${result.id.slice(0, 8)}...，状态 ${result.status}）。可在 S2 资料笔记模块生成结构化笔记。`,
            ),
            jsonContent(result),
          ],
          details: {
            materialId: result.id,
            fileName: result.fileName,
            fileType: result.fileType,
            sourceType: result.sourceType,
            status: result.status,
          },
        };
      },
    },
  ];
}
