/**
 * T-M2-003 S7 whisper.cpp Adapter（03-Arch §3.3 + 08-Test §3.3.2）
 *
 * 设计契约（03-Arch §3.3）：
 *   - CLI/模型路径只来自配置（不猜路径，不回退云端）
 *   - 子进程调用，stdout 返回转写文本
 *   - 路径/stdout/stderr/密钥不泄漏；固定错误码
 *
 * 安全不变量（07-WF §2.7 + 08-Test §5.4）：
 *   - 转写前先调 validatePcmWav 服务端重新验证文件头（不信任浏览器 MIME）
 *   - 路径未配置 → INTERNAL_ERROR + 固定文案"语音转写未配置，请在设置中指定 whisper.cpp 路径"
 *   - 转写失败 → INTERNAL_ERROR + 固定文案"转写失败，请检查音频文件是否完整"
 *   - 返回值仅含 { text }，不含 stdout/stderr
 *
 * 本任务范围（T-M2-007 真实接入）：
 *   - createMockWhisperAdapter：默认 mock 确定性返回固定文本，集成/E2E 用此（08-Test §9.3）
 *   - createRealWhisperAdapter：真实 spawn whisper.cpp CLI（-nt 模式 stdout 即纯文本），
 *     本机探到模型可真实转写（08-Test §9.3 允许），集成/E2E 不连真实子进程
 *   - createFailingWhisperAdapter：模拟子进程失败路径
 */
import { spawn } from "node:child_process";
import type { RpcError } from "../../../contract/types";
import { validatePcmWav } from "./wav-validator";

/** 转写结果：仅含纯文本，不含 stdout/stderr（08-Test §3.3.2 断言 3） */
export interface WhisperTranscribeResult {
  text: string;
}

/** WhisperCppAdapter 接口：可注入（03-Arch §3.3 + §6.2 上下文注入模式） */
export interface WhisperCppAdapter {
  /** 同步转写 PCM WAV 文件，返回纯文本（不返回 stdout 全文） */
  transcribe(audioFilePath: string): Promise<WhisperTranscribeResult>;
}

/** INTERNAL_ERROR 固定文案（07-WF §2.7 错误处理，不泄漏路径/stdout/stderr） */
const MSG_NOT_CONFIGURED = "语音转写未配置，请在设置中指定 whisper.cpp 路径";
const MSG_TRANSCRIBE_FAILED = "转写失败，请检查音频文件是否完整";

function internalError(message: string): RpcError {
  return { code: "INTERNAL_ERROR", message };
}

/**
 * Mock Adapter：确定性返回固定文本，不调真实子进程（08-Test §5.4 全 mock）。
 *
 * 仍然先调 validatePcmWav 服务端重新验证文件头（07-WF §2.7 关键约束）。
 */
export function createMockWhisperAdapter(): WhisperCppAdapter {
  return {
    async transcribe(audioFilePath: string): Promise<WhisperTranscribeResult> {
      // 服务端重新验证 PCM WAV 文件头（不信任浏览器 MIME）
      validatePcmWav(audioFilePath);
      // 确定性 mock 返回（与真实 whisper.cpp 输出格式无关，仅用于测试）
      return { text: "这是课堂采集的 mock 转写文本。" };
    },
  };
}

/**
 * Failing Adapter：用于测试 handler 失败路径（08-Test §3.3.2 错误处理）。
 *
 * 仍然先调 validatePcmWav 服务端重新验证文件头（与 mock 一致，验证完才抛转写失败），
 * 验证通过后抛 INTERNAL_ERROR + 固定文案"转写失败"（模拟真实子进程失败）。
 */
export function createFailingWhisperAdapter(): WhisperCppAdapter {
  return {
    async transcribe(audioFilePath: string): Promise<WhisperTranscribeResult> {
      // 服务端重新验证 PCM WAV 文件头（不信任浏览器 MIME）
      validatePcmWav(audioFilePath);
      // 模拟真实子进程失败：抛 INTERNAL_ERROR + 固定文案（不泄漏 stdout/stderr）
      throw internalError(MSG_TRANSCRIBE_FAILED);
    },
  };
}

/**
 * Real Adapter：spawn whisper.cpp CLI 子进程。
 *
 * 本任务范围（T-M2-007 真实接入）：
 *   - 路径校验（cliPath/modelPath 非空）→ INTERNAL_ERROR
 *   - 文件头验证（validatePcmWav）→ BAD_REQUEST
 *   - 真实 spawn 调用 + stdout 解析：真实 whisper.cpp CLI 已接入（-nt 模式 stdout 即纯文本）
 *
 * 真实验证（T-M2-007，步骤1 边界验证）：
 *   - CLI: H:\ai-studybuddy-components\local-asr-whispercpp\build-msvc-x64-release\bin\Release\whisper-cli.exe
 *   - 模型: H:\ai-studybuddy-components\local-asr-whispercpp\models\ggml-base.bin
 *   - 合成 3s 正弦波 PCM WAV，whisper-cli -nt 转录输出 "(crickets chirping)"，退出码 0，stdout 即纯文本
 *
 * 集成/E2E 保持 mock（08-Test §9.3），单件真实测试探测模型存在才跑（08-Test §9.3 允许本机真实）。
 */
export function createRealWhisperAdapter(opts: {
  cliPath: string;
  modelPath: string;
}): WhisperCppAdapter {
  const { cliPath, modelPath } = opts;

  return {
    async transcribe(audioFilePath: string): Promise<WhisperTranscribeResult> {
      // 1. 路径配置校验（03-Arch §3.3：CLI/模型路径只来自配置，不猜路径不回退云端）
      if (!cliPath || cliPath.trim() === "") {
        throw internalError(MSG_NOT_CONFIGURED);
      }
      if (!modelPath || modelPath.trim() === "") {
        throw internalError(MSG_NOT_CONFIGURED);
      }

      // 2. 服务端重新验证 PCM WAV 文件头（07-WF §2.7 关键约束）
      validatePcmWav(audioFilePath);

      // 3. spawn whisper.cpp CLI 子进程
      //    本任务范围不连真实子进程（08-Test §5.4），此处为框架实现。
      //    E2E 受控夹具会注入真实 cliPath + modelPath 触发此路径。
      return new Promise<WhisperTranscribeResult>((resolve, reject) => {
        const child = spawn(
          cliPath,
          ["-m", modelPath, "-f", audioFilePath, "-nt"],
          { stdio: ["ignore", "pipe", "pipe"] },
        );

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf8");
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });

        child.on("error", () => {
          // 错误消息固定文案，不泄漏路径/stdout/stderr（07-WF §2.7）
          reject(internalError(MSG_TRANSCRIBE_FAILED));
        });

        child.on("close", (code: number | null) => {
          if (code !== 0) {
            // 错误消息固定文案，不泄漏路径/stdout/stderr（07-WF §2.7）
            reject(internalError(MSG_TRANSCRIBE_FAILED));
            return;
          }
          // whisper.cpp -nt 模式 stdout 即纯文本转写结果
          // 仅返回 { text }，不返回 stdout 全文对象（08-Test §3.3.2 断言 3）
          const text = stdout.trim();
          if (!text) {
            reject(internalError(MSG_TRANSCRIBE_FAILED));
            return;
          }
          resolve({ text });
        });
      });
    },
  };
}
