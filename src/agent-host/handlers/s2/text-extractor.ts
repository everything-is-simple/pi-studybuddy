/**
 * T-M1-007 文档文本提取器（03-Arch §3.3 + 07-WF §2.3 + 08-Test §3.3.2）
 *
 * 设计契约（03-Arch §3.3 + 07-WF §2.3）：
 *   - 文本提取在进程内用 Node 库完成（jszip / mammoth / pdf-parse），非外部子进程
 *   - 分派矩阵（07-WF §2.3 + 03-Arch §5.3）：
 *       pdf   → pdf-parse（PDF 正文文本）
 *       docx  → jszip + mammoth（word/document.xml → 文本）
 *       pptx  → jszip（ppt/slides/slide*.xml → 文本）
 *       xlsx  → jszip（xl/sharedStrings.xml → 文本）
 *       image → 由 OcrAdapter 处理（本组件不接管）
 *   - 错误消息固定文案，不泄漏路径/stdout/stderr/密钥（AGENTS.md §9.3）
 *
 * 安全不变量（08-Test §3.3.2）：
 *   - 未映射格式 → INTERNAL_ERROR + 固定文案"文档文本提取未配置，请在设置中指定提取引擎路径"
 *   - 提取失败 / 文件不可读 → INTERNAL_ERROR + 固定文案"文档文本提取失败，请检查文件是否完整或已损坏"
 *   - 返回值仅含 { text }，不含 stdout/stderr
 *
 * 本任务范围（AGENTS.md §5.4 不连真实库做集成/E2E）：
 *   - createMockTextExtractor：默认 mock 确定性返回固定文本，所有集成测试用此
 *   - createFailingTextExtractor：抛错，验证调用方错误隔离
 *   - createRealTextExtractor：真实进程内提取框架（jszip/pdf-parse/mammoth），
 *     单件测试用合成夹具（jszip 构建最小 docx/pptx/xlsx）+ 受控 pdf 夹具驱动。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { internalError } from "./errors";

/** 提取结果：仅含纯文本，不含 stdout/stderr（08-Test §3.3.2 断言） */
export interface TextExtractResult {
  text: string;
}

/** TextExtractor 接口：可注入（03-Arch §3.3 + §6.2 上下文注入模式） */
export interface TextExtractor {
  /** 提取文档文本，返回纯文本（不返回 stdout 全文） */
  extract(filePath: string, fileType: string): Promise<TextExtractResult>;
}

/** INTERNAL_ERROR 固定文案（03-Arch §3.3，不泄漏路径/stdout/stderr） */
const MSG_NOT_CONFIGURED = "文档文本提取未配置，请在设置中指定提取引擎路径";
const MSG_EXTRACT_FAILED = "文档文本提取失败，请检查文件是否完整或已损坏";

/** 支持提取的 file_type（07-WF §2.3 分派矩阵；image 走 OcrAdapter） */
const SUPPORTED_TYPES = ["pdf", "docx", "pptx", "xlsx"] as const;

/**
 * Mock Adapter：确定性返回固定文本，不调真实库（AGENTS.md §5.4 全 mock）。
 */
export function createMockTextExtractor(): TextExtractor {
  return {
    async extract(_filePath: string, fileType: string): Promise<TextExtractResult> {
      // 确定性 mock 返回（与真实提取结果无关，仅用于测试）
      return { text: `这是 ${fileType} 文档的 mock 文本提取结果。` };
    },
  };
}

/**
 * Failing Adapter：用于测试 handler 失败路径（08-Test §3.3.2 错误处理）。
 *
 * 抛 INTERNAL_ERROR + 固定文案"文档文本提取失败"（模拟真实提取失败）。
 */
export function createFailingTextExtractor(): TextExtractor {
  return {
    async extract(_filePath: string, _fileType: string): Promise<TextExtractResult> {
      throw internalError(MSG_EXTRACT_FAILED);
    },
  };
}

/**
 * T-M4-025：pdfjs-dist 环境补齐（生产 agent-host utilityProcess）。
 *
 * pdf-parse v2 内嵌 pdfjs-dist，其 Node 检测对 Electron 非 browser 进程（utilityProcess 的
 * process.type !== 'browser'）判 false：
 *   1. 不设置默认 GlobalWorkerOptions.workerSrc → 提取时抛 "No GlobalWorkerOptions.workerSrc"
 *   2. 顶层引用浏览器全局 DOMMatrix（main 进程无此问题，utilityProcess 缺失）
 *
 * 修复：进程内 fake worker + 最小 DOMMatrix shim（均在 agent-host 进程内完成，不 spawn 子进程）：
 *   - 加载 pdf-parse 自带 pdf.worker.mjs 的 WorkerMessageHandler 挂到 globalThis.pdfjsWorker
 *     （pdfjs fake worker 优先使用该 handler，无需 workerSrc / process.type 篡改）
 *   - DOMMatrix shim 实现 2D 仿射矩阵基本运算（文本提取所需），缺失时才注入
 */
class PdfMatrixShim {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  constructor(init?: string) {
    if (init && init.startsWith("matrix(")) {
      const m = init.slice(7, -1).split(/[ ,]+/).map(Number);
      if (m.length === 6) [this.a, this.b, this.c, this.d, this.e, this.f] = m;
    }
  }
  multiplySelf(other: PdfMatrixShim): this {
    const { a, b, c, d, e, f } = this;
    this.a = a * other.a + c * other.b;
    this.b = b * other.a + d * other.b;
    this.c = a * other.c + c * other.d;
    this.d = b * other.c + d * other.d;
    this.e = a * other.e + c * other.f + e;
    this.f = b * other.e + d * other.f + f;
    return this;
  }
  translateSelf(tx: number, ty: number): this {
    this.e += tx * this.a + ty * this.c;
    this.f += tx * this.b + ty * this.d;
    return this;
  }
  scaleSelf(sx: number, sy = sx): this {
    this.a *= sx; this.b *= sy; this.c *= sx; this.d *= sy;
    return this;
  }
  rotateSelf(rad: number): this {
    const cos = Math.cos(rad); const sin = Math.sin(rad);
    const { a, b, c, d, e, f } = this;
    this.a = a * cos + c * sin; this.b = b * cos + d * sin;
    this.c = -a * sin + c * cos; this.d = -b * sin + d * cos;
    this.e = e; this.f = f;
    return this;
  }
  flipXSelf(): this { return this.scaleSelf(-1, 1); }
  flipYSelf(): this { return this.scaleSelf(1, -1); }
  skewXSelf(sx: number): this {
    const { a, b, c, d } = this; this.c = a * Math.tan(sx) + c; this.d = b * Math.tan(sx) + d;
    return this;
  }
  skewYSelf(sy: number): this {
    const { a, b, c, d } = this; this.b = a * Math.tan(sy) + b; this.d = c * Math.tan(sy) + d;
    return this;
  }
  toString(): string {
    return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
  }
}

let pdfEnvReady: Promise<void> | null = null;
/** 幂等：进程内一次性补齐 pdfjs 环境（DOMMatrix + fake worker handler） */
function ensurePdfParseEnvironment(): Promise<void> {
  if (!pdfEnvReady) {
    pdfEnvReady = (async () => {
      const g = globalThis as Record<string, unknown>;
      if (typeof g.DOMMatrix === "undefined") {
        g.DOMMatrix = PdfMatrixShim;
      }
      const existing = g.pdfjsWorker as { WorkerMessageHandler?: unknown } | undefined;
      if (!existing?.WorkerMessageHandler) {
        try {
          // pdf-parse 自带 worker（与内嵌 pdfjs 同版本）：pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs
          const entry = require.resolve("pdf-parse");
          const pkgDir = path.resolve(path.dirname(entry), "..", "..", "..");
          const workerFile = path.join(pkgDir, "dist", "pdf-parse", "cjs", "pdf.worker.mjs");
          // tsc 会把 CJS 输出中的 import(x) 转为 require(x)，无法加载 file:// ESM worker；
          // 用 Function 构造保留真实动态 import（仅此处使用，不引入 eval 用户输入）
          const realImport = new Function("spec", "return import(spec)") as (spec: string) => Promise<{
            WorkerMessageHandler?: unknown;
          }>;
          const workerMod = await realImport(pathToFileURL(workerFile).href);
          g.pdfjsWorker = { WorkerMessageHandler: workerMod.WorkerMessageHandler };
        } catch {
          // worker 不可用：保持既有路径（仅影响 utilityProcess 之外的提取兜底），静默不泄漏细节
        }
      }
    })();
  }
  return pdfEnvReady;
}

/** PDF 正文提取（pdf-parse v2，pageJoiner 置空去除页脚标记） */
async function extractPdf(buf: Buffer): Promise<string> {
  await ensurePdfParseEnvironment();
  const mod = await import("pdf-parse");
  const PDFParseCtor = mod.PDFParse;
  const parser = new PDFParseCtor({ data: buf });
  try {
    const result = await parser.getText({ pageJoiner: "" });
    return (result.text ?? "").trim();
  } finally {
    await parser.destroy();
  }
}

/** DOCX 文本提取（jszip 解包 + mammoth extractRawText） */
async function extractDocx(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  // mammoth 运行期接受 Buffer；类型层用显式断言规避 @types/node Buffer 泛型差异
  const extractRawText = mammoth.default.extractRawText as unknown as (b: Buffer) => Promise<{ value?: string }>;
  const result = await extractRawText(buf);
  return (result.value ?? "").trim();
}

/** 从 OOXML zip 中按路径读取文本节点（pptx slides / xlsx sharedStrings） */
async function extractOoxmlText(buf: Buffer, targetPrefix: string): Promise<string> {
  const JSZipCtor = (await import("jszip")).default;
  const zip = await JSZipCtor.loadAsync(new Uint8Array(buf));
  const parts: string[] = [];
  const entries = Object.values(zip.files).filter((f) => !f.dir && f.name.startsWith(targetPrefix));
  for (const entry of entries) {
    const xml = await entry.async("string");
    parts.push(textFromXml(xml));
  }
  return parts.join("\n").trim();
}

/** 从 XML 中提取所有文本节点内容（去标签、保空格） */
function textFromXml(xml: string): string {
  const textNodes = xml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
  const texts = textNodes.map((t) => t.replace(/<\/?a:t>/g, ""));
  return texts.join("");
}

/** PPTX 文本提取（jszip 解析 ppt/slides/slide*.xml 的 <a:t>） */
function extractPptx(buf: Buffer): Promise<string> {
  return extractOoxmlText(buf, "ppt/slides/slide");
}

/** XLSX 文本提取（jszip 解析 xl/sharedStrings.xml 的 <t>） */
async function extractXlsx(buf: Buffer): Promise<string> {
  const JSZipCtor = (await import("jszip")).default;
  const zip = await JSZipCtor.loadAsync(new Uint8Array(buf));
  const shared = zip.file("xl/sharedStrings.xml");
  if (!shared) return "";
  const xml = await shared.async("string");
  const textNodes = xml.match(/<t[^>]*>([^<]*)<\/t>/g) || [];
  const texts: string[] = [];
  for (const t of textNodes) {
    texts.push(t.replace(/<t[^>]*>/g, "").replace(/<\/t>/g, ""));
  }
  return texts.join("\n").trim();
}

/**
 * Real Adapter：进程内真实文本提取（jszip / mammoth / pdf-parse）。
 *
 * 本任务范围（AGENTS.md §5.4 不连真实库做集成/E2E 断言）：
 *   - 分派 matrix 内（pdf/docx/pptx/xlsx）走真实库
 *   - 未映射格式 → INTERNAL_ERROR + "未配置"固定文案，不触发真实库
 *   - 提取失败 / 文件不可读 → INTERNAL_ERROR + 固定文案，不泄漏路径
 *
 * 真实提取由单件测试用合成夹具驱动（08-Test §1.3 第 6 条受控夹具）。
 */
export function createRealTextExtractor(): TextExtractor {
  return {
    async extract(filePath: string, fileType: string): Promise<TextExtractResult> {
      // 未映射格式：不触发真实库（08-Test §3.3.2 "未配置"分派路径）
      if (!(SUPPORTED_TYPES as readonly string[]).includes(fileType)) {
        throw internalError(MSG_NOT_CONFIGURED);
      }

      let buf: Buffer;
      try {
        buf = await readFile(filePath);
      } catch {
        // 文件不可读 → 固定文案，不泄漏路径（03-Arch §3.3）
        throw internalError(MSG_EXTRACT_FAILED);
      }

      try {
        switch (fileType) {
          case "pdf":
            return { text: await extractPdf(buf) };
          case "docx":
            return { text: await extractDocx(buf) };
          case "pptx":
            return { text: await extractPptx(buf) };
          case "xlsx":
            return { text: await extractXlsx(buf) };
          default:
            throw internalError(MSG_NOT_CONFIGURED); // 不可达，防御保留
        }
      } catch (e) {
        // 提取失败 → 固定文案，不泄漏栈/路径（03-Arch §3.3）
        if (e && typeof e === "object" && "code" in e && (e as { code: unknown }).code === "INTERNAL_ERROR") {
          throw e;
        }
        throw internalError(MSG_EXTRACT_FAILED);
      }
    },
  };
}