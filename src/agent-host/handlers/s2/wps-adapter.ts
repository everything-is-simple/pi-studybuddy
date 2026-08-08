/**
 * T-M1-006 WPS COM Adapter（03-Arch §3.3 + 08-Test §3.3.1）
 *
 * 设计契约（03-Arch §3.3）：
 *   - 复用 OCR venv python.exe（H:\AIStudyBuddy\runtime\venv\Scripts\python.exe）
 *   - 子进程调用 wps_bridge.py，stdin/stdout JSON 协议
 *   - 旧版 doc/ppt/xls → 新版 docx/pptx/xlsx 中间格式，再走现有管道
 *   - 路径只来自配置；错误消息固定文案，不泄漏路径/stdout/stderr/密钥
 *
 * 安全不变量（08-Test §3.3.1）：
 *   - 路径未配置 → INTERNAL_ERROR + 固定文案"WPS 转换未配置，请在设置中指定 WPS 桥引擎路径"
 *   - 转换失败（子进程非 0 / JSON 解析失败）→ INTERNAL_ERROR + 固定文案"旧版办公文件转换失败，请检查文件是否完整或已损坏"
 *   - 返回值仅含 { outPath, outFileName }，不含 stdout/stderr
 *
 * 本任务范围（AGENTS.md §5.4 不连真实 WPS 集成测试）：
 *   - createMockWpsAdapter：默认 mock 确定性返回固定 outPath，所有集成测试用此
 *   - createFailingWpsAdapter：抛错，验证调用方错误隔离
 *   - createRealWpsAdapter：真实 spawn 框架（路径校验 + spawn Python 桥 + 解析 stdout JSON），
 *     单件测试不调真实子进程，仅校验路径未配置错误路径。
 *     真实 WPS 转换由 scripts/wps-bridge/test_wps_convert.py 在 WPS 就绪时真实执行。
 */
import { spawn } from "node:child_process";
import { basename, join } from "node:path";
import { internalError } from "./errors";

/** 转换结果：仅含新文件路径与文件名，不含 stdout/stderr（08-Test §3.3.1 断言） */
export interface WpsConvertResult {
  outPath: string;
  outFileName: string;
}

/** WpsAdapter 接口：可注入（03-Arch §3.3 + §6.2 上下文注入模式） */
export interface WpsAdapter {
  /** 将旧版文件转换为新格式，返回新文件信息 */
  convert(inPath: string, outDir: string): Promise<WpsConvertResult>;
}

/** INTERNAL_ERROR 固定文案（03-Arch §3.3，不泄漏路径/stdout/stderr） */
const MSG_NOT_CONFIGURED = "WPS 转换未配置，请在设置中指定 WPS 桥引擎路径";
const MSG_CONVERT_FAILED = "旧版办公文件转换失败，请检查文件是否完整或已损坏";

/**
 * Mock Adapter：确定性返回固定 outPath，不调真实子进程（AGENTS.md §5.4 全 mock）。
 */
export function createMockWpsAdapter(): WpsAdapter {
  return {
    async convert(inPath: string, outDir: string): Promise<WpsConvertResult> {
      // 由输入文件名推导输出文件名（doc→docx / ppt→pptx / xls→xlsx）
      const base = basename(inPath).replace(/\.\w+$/, "");
      const outFileName = `${base}.docx`;
      return { outPath: join(outDir, outFileName), outFileName };
    },
  };
}

/**
 * Failing Adapter：用于测试 handler 失败路径（08-Test §3.3.1 错误处理）。
 *
 * 抛 INTERNAL_ERROR + 固定文案"旧版办公文件转换失败"（模拟真实子进程失败）。
 */
export function createFailingWpsAdapter(): WpsAdapter {
  return {
    async convert(_inPath: string, _outDir: string): Promise<WpsConvertResult> {
      throw internalError(MSG_CONVERT_FAILED);
    },
  };
}

/**
 * Real Adapter：spawn OCR venv python.exe 调用 wps_bridge.py。
 *
 * 本任务范围（AGENTS.md §5.4 不连真实 WPS 集成测试）：
 *   - 路径配置校验（pythonPath/bridgePath 非空）→ INTERNAL_ERROR + 固定文案"未配置"
 *   - 真实 spawn 调用 + stdout JSON 解析：实现框架，但单件测试不触发此路径
 *
 * 真实 WPS 转换集成留待冒烟受控夹具（08-Test §3.3.1 注释），不在本任务集成测试范围。
 */
export function createRealWpsAdapter(opts: {
  pythonPath: string;
  bridgePath: string;
}): WpsAdapter {
  const { pythonPath, bridgePath } = opts;

  return {
    async convert(inPath: string, outDir: string): Promise<WpsConvertResult> {
      // 1. 路径配置校验（03-Arch §3.3：路径只来自配置，不猜路径不回退云端）
      if (!pythonPath || pythonPath.trim() === "") {
        throw internalError(MSG_NOT_CONFIGURED);
      }
      if (!bridgePath || bridgePath.trim() === "") {
        throw internalError(MSG_NOT_CONFIGURED);
      }

      // 2. spawn wps_bridge.py（CLI 参数契约，与 pytest run_wps_bridge 一致）
      return new Promise<WpsConvertResult>((resolve, reject) => {
        const child = spawn(pythonPath, [bridgePath, "convert", "--in", inPath, "--out", outDir], {
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        });
        // 立即关闭 stdin：本桥走 CLI 参数（非 stdin JSON），避免 Python main() 的 sys.stdin.read() 阻塞
        child.stdin.end();

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
          reject(internalError(MSG_CONVERT_FAILED));
        });

        child.on("close", (code: number | null) => {
          if (code !== 0) {
            // 错误消息固定文案，不泄漏路径/stdout/stderr（03-Arch §3.3）
            reject(internalError(MSG_CONVERT_FAILED));
            return;
          }
          // 解析 stdout JSON { status, outPath, outFileName }（03-Arch §3.3 JSON 协议）
          try {
            const parsed = JSON.parse(stdout.trim()) as {
              status?: string;
              outPath?: string;
              outFileName?: string;
            };
            if (parsed.status !== "ok" || !parsed.outPath || !parsed.outFileName) {
              reject(internalError(MSG_CONVERT_FAILED));
              return;
            }
            // 仅返回 { outPath, outFileName }，不返回 stdout 全文对象（08-Test §3.3.1 断言）
            resolve({ outPath: parsed.outPath, outFileName: parsed.outFileName });
          } catch {
            reject(internalError(MSG_CONVERT_FAILED));
          }
        });
      });
    },
  };
}