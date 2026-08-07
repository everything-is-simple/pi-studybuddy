/**
 * T-M1-005 S1 OCR registerTool 工具定义（03-Arch §3.1 + §2.2 ToolDefinition 契约 + §5.3 studybuddy-ocr-schedule）
 *
 * 1 个 studybuddy_* 工具，execute 薄封装调用 handleOcrSchedule（S1 内部能力，无独立 RPC 方法）。
 * 工具名匹配 ^studybuddy_[a-z_]+$；ToolDefinition 必填 name/label/description/parameters/execute。
 *
 * 工具清单：
 *   1. studybuddy_ocr_schedule → handleOcrSchedule（课程表 OCR 识别预览，本地 RapidOCR）
 *
 * 手写 OCR 走本地 RapidOCR，不走多模态 AI（02-PRD §4.1）。
 */
import { Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import {
  createMockOcrAdapter,
  type OcrAdapter,
} from "../../../agent-host/handlers/s1/ocr-adapter";
import { handleOcrSchedule } from "../../../agent-host/handlers/s1/ocr";

/** 工具 execute 返回的 content 文本块 */
function textContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

/** 把业务对象序列化为 LLM 可读的 JSON 文本块 */
function jsonContent(obj: unknown): { type: "text"; text: string } {
  return textContent(JSON.stringify(obj, null, 2));
}

/**
 * 创建 S1 OCR 工具（studybuddy_ocr_schedule）。
 * @param adapter OcrAdapter（可注入，默认 mock 确定性，AGENTS.md §5.4 不连真实 RapidOCR）
 */
export function createOcrTools(adapter?: OcrAdapter): ToolDefinition[] {
  const ocrAdapter = adapter ?? createMockOcrAdapter();
  const handler = handleOcrSchedule({ ocrAdapter });

  return [
    {
      name: "studybuddy_ocr_schedule",
      label: "课程表 OCR 识别预览",
      description:
        "本地 RapidOCR 识别课程表图片（jpg/jpeg/png/webp/gif/bmp/tiff），返回识别的原始文本供学生确认。不走多模态 AI；路径只来自配置；不返回 stdout。",
      promptSnippet: "课程表 OCR 识别预览：本地 RapidOCR 返回原始文本供学生确认",
      parameters: Type.Object({
        imagePath: Type.String({ description: "课程表图片文件绝对路径" }),
      }),
      async execute(_toolCallId, params) {
        const result = (await handler(params)) as { text: string };
        return {
          content: [
            textContent(
              `课程表 OCR 识别完成（${result.text.length} 字）。请学生核对识别文本，确认后用 studybuddy_add_exam 补全考试。`,
            ),
            jsonContent(result),
          ],
          details: {
            text: result.text,
            charCount: result.text.length,
          },
        };
      },
    },
  ];
}

/** OCR 工具名清单（用于断言） */
export const OCR_TOOL_NAMES = ["studybuddy_ocr_schedule"] as const;

/** OCR 工具数量 */
export const OCR_TOOL_COUNT = OCR_TOOL_NAMES.length;