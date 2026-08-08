import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { createRealTextExtractor, type TextExtractor } from "../../../../src/agent-host/handlers/s2/text-extractor";

/**
 * T-M1-007 TextExtractor 真实提取单件测试（08-Test §1.3 第 6 条受控夹具）
 *
 * 用 jszip 手工构建最小 OOXML（docx/pptx/xlsx）+ 受控最小 PDF，
 * 驱动 createRealTextExtractor 的真实进程内提取，断言提取文本正确。
 *
 * 数据隔离（AGENTS.md §5.3 + 08-Test §5.4）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-007\unit-fixtures。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-007\\unit-fixtures";

const extractor: TextExtractor = createRealTextExtractor();

/** DOCX 最小夹具：word/document.xml 含一段文本 */
async function buildDocx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>
</w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

/** PPTX 最小夹具：ppt/slides/slide1.xml 含 <a:t> 文本节点 */
async function buildPptx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "ppt/slides/slide1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sp><a:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></a:txBody></p:sp>
</p:sld>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

/** XLSX 最小夹具：xl/sharedStrings.xml 含 <t> 文本节点 */
async function buildXlsx(...texts: string[]): Promise<Buffer> {
  const zip = new JSZip();
  const items = texts.map((t) => `<si><t>${t}</t></si>`).join("");
  zip.file(
    "xl/sharedStrings.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${items}</sst>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

/** 受控最小单页 PDF（text 为 Helvetica 文本） */
function buildPdf(text: string): Buffer {
  const objs = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
  ];
  const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET\n`;
  objs.push(`4 0 obj\n<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream\nendobj\n`);
  objs.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  let data = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 0; i < objs.length; i++) {
    offsets.push(Buffer.byteLength(data, "latin1"));
    data += objs[i];
  }
  const xrefStart = Buffer.byteLength(data, "latin1");
  data += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 0; i < offsets.length; i++) {
    data += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  data += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(data, "latin1");
}

describe("T-M1-007 S2 TextExtractor 真实提取（合成夹具）", () => {
  let fixtureDir: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    fixtureDir = join(ISOLATION_DIR, "fixtures");
    mkdirSync(fixtureDir, { recursive: true });
  });

  afterAll(() => {
    for (let i = 0; i < 3; i++) {
      try {
        rmSync(ISOLATION_DIR, { recursive: true, force: true });
        break;
      } catch {
        // 忽略 EBUSY
      }
    }
  });

  it("REALFIX-01 docx 合成夹具 → 提取 word/document.xml 文本", async () => {
    const buf = await buildDocx("寒假数学作业汇总");
    const p = join(fixtureDir, "sample.docx");
    writeFileSync(p, buf);
    const r = await extractor.extract(p, "docx");
    expect(r.text).toContain("寒假数学作业汇总");
  });

  it("REALFIX-02 pptx 合成夹具 → 提取 slide1.xml <a:t> 文本", async () => {
    const buf = await buildPptx("第一章 数与式");
    const p = join(fixtureDir, "sample.pptx");
    writeFileSync(p, buf);
    const r = await extractor.extract(p, "pptx");
    expect(r.text).toContain("第一章 数与式");
  });

  it("REALFIX-03 xlsx 合成夹具 → 提取 sharedStrings <t> 文本", async () => {
    const buf = await buildXlsx("单元格一", "单元格二");
    const p = join(fixtureDir, "sample.xlsx");
    writeFileSync(p, buf);
    const r = await extractor.extract(p, "xlsx");
    expect(r.text).toContain("单元格一");
    expect(r.text).toContain("单元格二");
  });

  it("REALFIX-04 pdf 受控夹具 → 提取 PDF 正文文本", async () => {
    const buf = buildPdf("Hello StudyBuddy 123");
    const p = join(fixtureDir, "sample.pdf");
    writeFileSync(p, buf);
    const r = await extractor.extract(p, "pdf");
    expect(r.text).toContain("Hello StudyBuddy 123");
  });
});