/**
 * T-M1-005 S1 OCR handler（03-Arch §3.3 + 08-Test §3.3.3 + 02-PRD §4.1）
 *
 * handleOcrSchedule：课程表图片 OCR 识别预览。
 * 流程：图片路径校验（存在）→ adapter.recognize → 返回 { text }。
 *
 * 安全（08-Test §3.3.3 关键约束）：
 *   - 图片不存在 → BAD_REQUEST + "图片不存在"
 *   - adapter 抛 INTERNAL_ERROR → 统一固定文案"OCR 识别失败"（双重保险，防 stdout/stderr 泄漏）
 *   - 返回值仅含 { text }，不含 imagePath/stdout/stderr
 *   - 错误消息固定文案，不含 imagePath/pythonPath/bridgePath
 *
 * 手写 OCR 走本地 RapidOCR，不走多模态 AI（02-PRD §4.1）。
 */
import { existsSync } from "node:fs";
import type { OcrAdapter } from "./ocr-adapter";
import { badRequest } from "./errors";

/** 识别失败固定文案（08-Test §3.3.3，不泄漏 stdout/stderr） */
const MSG_RECOGNIZE_FAILED = "OCR 识别失败，请检查图片文件是否完整";

export interface OcrHandlerDeps {
  ocrAdapter: OcrAdapter;
}

/**
 * handleOcrSchedule handler 工厂。
 *
 * @param deps 依赖注入（OcrAdapter，可注入 mock/failing/real）
 * @returns (params) => Promise<{ text: string }>
 */
export function handleOcrSchedule(
  deps: OcrHandlerDeps,
): (params: unknown) => Promise<{ text: string }> {
  return async (params: unknown): Promise<{ text: string }> => {
    const p = params as { imagePath?: string };

    // 1. 图片路径校验（必须存在，08-Test §3.3.3）
    const imagePath = p.imagePath;
    if (!imagePath || imagePath.trim() === "") {
      throw badRequest("缺少图片路径");
    }
    if (!existsSync(imagePath)) {
      throw badRequest("图片不存在");
    }

    // 2. 调 OcrAdapter.recognize（本地 RapidOCR，不走多模态 AI）
    try {
      const result = await deps.ocrAdapter.recognize(imagePath);
      // 仅返回 { text }，不返回 imagePath/stdout/stderr（08-Test §3.3.3 断言）
      return { text: result.text };
    } catch (e) {
      // adapter 抛的 BAD_REQUEST（图片路径相关）直接透传
      if (e && typeof e === "object" && "code" in e) {
        const err = e as { code?: string };
        if (err.code === "BAD_REQUEST") {
          throw e;
        }
      }
      // 识别失败：用 handler 层固定文案（双重保险，防止 adapter 实现泄漏 stdout/stderr）
      throw { code: "INTERNAL_ERROR", message: MSG_RECOGNIZE_FAILED };
    }
  };
}