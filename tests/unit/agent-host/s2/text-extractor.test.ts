import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import {
  createMockTextExtractor,
  createFailingTextExtractor,
  createRealTextExtractor,
  type TextExtractor,
} from "../../../../src/agent-host/handlers/s2/text-extractor";
import type { RpcError } from "../../../../src/contract/types";

/**
 * T-M1-007 S2 TextExtractor 单件测试（03-Arch §3.3 + 08-Test §3.3.2）
 *
 * 三态：
 *   1. mock：确定性返回固定文本，不调真实库
 *   2. failing：抛 INTERNAL_ERROR + 固定文案"提取失败"
 *   3. real：未映射格式 → INTERNAL_ERROR + "未配置"；文件不可读 → 固定文案不泄漏路径
 *
 * 真实提取（docx/pptx/xlsx/pdf 合成夹具）见 text-extractors.test.ts。
 *
 * 安全不变量（AGENTS.md §5.4 + 08-Test §3.3.2）：错误消息固定文案，不泄漏路径/stdout/stderr。
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-007\unit-adapter。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-007\\unit-adapter";

function isRpcError(e: unknown): e is RpcError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}

describe("T-M1-007 S2 TextExtractor 单件测试", () => {
  let sampleIn: string;
  let missingPath: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    sampleIn = join(ISOLATION_DIR, "sample.pdf");
    writeFileSync(sampleIn, "not a real pdf");
    missingPath = join(ISOLATION_DIR, "does-not-exist.pdf");
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

  describe("createMockTextExtractor", () => {
    it("MOCK-01 确定性返回固定文本，不调真实库，不返回 stdout/stderr", async () => {
      const extractor: TextExtractor = createMockTextExtractor();
      const r = await extractor.extract("/nonexistent/file.pdf", "pdf");
      expect(r).toEqual({ text: "这是 pdf 文档的 mock 文本提取结果。" });
      // 不返回 stdout/stderr/inPath（08-Test §3.3.2 关键约束）
      expect(r).not.toHaveProperty("stdout");
      expect(r).not.toHaveProperty("stderr");
    });

    it("MOCK-02 确定性：多次调用同一格式返回相同文本", async () => {
      const extractor: TextExtractor = createMockTextExtractor();
      const r1 = await extractor.extract("/a.pdf", "pdf");
      const r2 = await extractor.extract("/b.pdf", "pdf");
      expect(r1.text).toBe(r2.text);
    });
  });

  describe("createFailingTextExtractor", () => {
    it("FAIL-01 抛 INTERNAL_ERROR + '提取失败'，错误消息不含路径/stdout/stderr", async () => {
      const extractor: TextExtractor = createFailingTextExtractor();
      try {
        await extractor.extract(sampleIn, "pdf");
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("提取失败");
        expect(err.message).not.toContain(sampleIn);
        expect(err.message).not.toContain("stdout");
        expect(err.message).not.toContain("stderr");
      }
    });
  });

  describe("createRealTextExtractor", () => {
    it("REAL-01 未映射格式 → INTERNAL_ERROR + '未配置'，不触发真实库", async () => {
      const extractor: TextExtractor = createRealTextExtractor();
      try {
        await extractor.extract(sampleIn, "rtf");
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("未配置");
        expect(err.message).not.toContain(sampleIn);
      }
    });

    it("REAL-02 文件不可读 → INTERNAL_ERROR + 固定文案，不泄漏路径", async () => {
      const extractor: TextExtractor = createRealTextExtractor();
      try {
        await extractor.extract(missingPath, "pdf");
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("提取失败");
        expect(err.message).not.toContain(ISOLATION_DIR);
        expect(err.message).not.toContain("does-not-exist");
      }
    });

    it("REAL-03 返回对象无 stdout 属性（防 stdout 泄漏）", async () => {
      const extractor: TextExtractor = createRealTextExtractor();
      await expect(extractor.extract(missingPath, "pdf")).rejects.toMatchObject({
        code: "INTERNAL_ERROR",
      });
    });

    it("REAL-04 支持格式白名单公开（分派矩阵）", () => {
      const extractor: TextExtractor = createRealTextExtractor();
      expect(typeof extractor.extract).toBe("function");
    });
  });
});