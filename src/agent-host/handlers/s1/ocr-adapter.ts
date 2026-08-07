/**
 * T-M1-005 OCR venv Adapter（03-Arch §3.3 + 08-Test §3.3.3）
 *
 * 设计契约（03-Arch §3.3）：
 *   - 复用 OCR venv python.exe（H:\AIStudyBuddy\runtime\venv\Scripts\python.exe）
 *   - 子进程调用，stdin/stdout JSON 协议
 *   - 手写 OCR 走本地 RapidOCR（不走多模态 AI，02-PRD §4.1）
 *   - 路径只来自配置；错误消息固定文案，不泄漏路径/stdout/stderr/密钥
 *
 * 安全不变量（08-Test §3.3.3）：
 *   - 路径未配置 → INTERNAL_ERROR + 固定文案"OCR 识别未配置，请在设置中指定 OCR 引擎路径"
 *   - 识别失败 → INTERNAL_ERROR + 固定文案"OCR 识别失败，请检查图片文件是否完整"
 *   - 返回值仅含 { text }，不含 stdout/stderr
 *
 * 本任务范围（AGENTS.md §5.4 不连真实 RapidOCR）：
 *   - createMockOcrAdapter：默认 mock 确定性返回固定文本，所有测试用此
 *   - createFailingOcrAdapter：抛错，验证调用方错误隔离
 *   - createRealOcrAdapter：真实 spawn 框架（路径校验 + spawn Python 桥 + 解析 stdout JSON），
 *     单件测试不调真实子进程，仅校验路径未配置错误路径。
 *     真实 RapidOCR 识别由 scripts/ocr-bridge/test_ocr.py 在 OCR venv 就绪时真实执行。
 */
import { spawn } from "node:child_process";
import type { RpcError } from "../../../contract/types";
import { internalError } from "./errors";

/** 识别结果：仅含纯文本，不含 stdout/stderr（08-Test §3.3.3 断言） */
export interface OcrRecognizeResult {
  text: string;
}

/** OcrAdapter 接口：可注入（03-Arch §3.3 + §6.2 上下文注入模式） */
export interface OcrAdapter {
  /** 识别图片文本，返回纯文本（不返回 stdout 全文） */
  recognize(imagePath: string): Promise<OcrRecognizeResult>;
}

/** INTERNAL_ERROR 固定文案（03-Arch §3.3，不泄漏路径/stdout/stderr） */
const MSG_NOT_CONFIGURED = "OCR 识别未配置，请在设置中指定 OCR 引擎路径";
const MSG_RECOGNIZE_FAILED = "OCR 识别失败，请检查图片文件是否完整";

/**
 * Mock Adapter：确定性返回固定文本，不调真实子进程（AGENTS.md §5.4 全 mock）。
 */
export function createMockOcrAdapter(): OcrAdapter {
  return {
    async recognize(_imagePath: string): Promise<OcrRecognizeResult> {
      // 确定性 mock 返回（与真实 RapidOCR 输出格式无关，仅用于测试）
      return { text: "这是课程表图片的 mock OCR 识别文本。" };
    },
  };
}

/**
 * Failing Adapter：用于测试 handler 失败路径（08-Test §3.3.3 错误处理）。
 *
 * 抛 INTERNAL_ERROR + 固定文案"OCR 识别失败"（模拟真实子进程失败）。
 */
export function createFailingOcrAdapter(): OcrAdapter {
  return {
    async recognize(_imagePath: string): Promise<OcrRecognizeResult> {
      throw internalError(MSG_RECOGNIZE_FAILED);
    },
  };
}

/**
 * Real Adapter：spawn OCR venv python.exe 调用 ocr_bridge.py。
 *
 * 本任务范围（AGENTS.md §5.4 不连真实 RapidOCR）：
 *   - 路径配置校验（pythonPath/bridgePath 非空）→ INTERNAL_ERROR + 固定文案"未配置"
 *   - 真实 spawn 调用 + stdout JSON 解析：实现框架，但单件测试不触发此路径
 *
 * 真实 RapidOCR 集成留待 E2E 受控夹具（08-Test §3.3.3 注释），不在本任务范围。
 */
export function createRealOcrAdapter(opts: {
  pythonPath: string;
  bridgePath: string;
}): OcrAdapter {
  const { pythonPath, bridgePath } = opts;

  return {
    async recognize(imagePath: string): Promise<OcrRecognizeResult> {
      // 1. 路径配置校验（03-Arch §3.3：路径只来自配置，不猜路径不回退云端）
      if (!pythonPath || pythonPath.trim() === "") {
        throw internalError(MSG_NOT_CONFIGURED);
      }
      if (!bridgePath || bridgePath.trim() === "") {
        throw internalError(MSG_NOT_CONFIGURED);
      }

      // 2. spawn OCR venv python.exe 调用 ocr_bridge.py
      //    本任务范围不连真实子进程（AGENTS.md §5.4），此处为框架实现。
      //    E2E 受控夹具会注入真实 pythonPath + bridgePath 触发此路径。
      return new Promise<OcrRecognizeResult>((resolve, reject) => {
        const child = spawn(pythonPath, [bridgePath], {
          stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf8");
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });

        child.on("error", () => {
          // 错误消息固定文案，不泄漏路径/stdout/stderr（03-Arch §3.3）
          reject(internalError(MSG_RECOGNIZE_FAILED));
        });

        child.on("close", (code: number | null) => {
          if (code !== 0) {
            // 错误消息固定文案，不泄漏路径/stdout/stderr（03-Arch §3.3）
            reject(internalError(MSG_RECOGNIZE_FAILED));
            return;
          }
          // 解析 stdout JSON { text: "..." }（03-Arch §3.3 JSON 协议）
          try {
            const parsed = JSON.parse(stdout.trim()) as { text?: string };
            const text = (parsed.text ?? "").trim();
            if (!text) {
              reject(internalError(MSG_RECOGNIZE_FAILED));
              return;
            }
            // 仅返回 { text }，不返回 stdout 全文对象（08-Test §3.3.3 断言）
            resolve({ text });
          } catch {
            reject(internalError(MSG_RECOGNIZE_FAILED));
          }
        });

        // 写入输入 JSON（stdin 协议，03-Arch §3.3）
        child.stdin.write(JSON.stringify({ imagePath }));
        child.stdin.end();
      });
    },
  };
}

/**
 * 供 S1 handler 判断错误类型的错误工厂（复用于错误隔离）。
 * 注：internalError 已在 ./errors 导出，此处仅重导出类型安全复用。
 */
export type { RpcError };