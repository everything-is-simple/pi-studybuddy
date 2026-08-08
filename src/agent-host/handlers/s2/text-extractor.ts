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

/** PDF 正文提取（pdf-parse v2，pageJoiner 置空去除页脚标记） */
async function extractPdf(buf: Buffer): Promise<string> {
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