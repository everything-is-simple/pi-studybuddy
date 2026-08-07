import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { handleOcrSchedule } from "../../../../src/agent-host/handlers/s1/ocr";
import {
  createMockOcrAdapter,
  createFailingOcrAdapter,
  type OcrAdapter,
} from "../../../../src/agent-host/handlers/s1/ocr-adapter";
import type { RpcError } from "../../../../src/contract/types";

/**
 * T-M1-005 S1 OCR handler 单件测试（03-Arch §3.3 + 08-Test §3.3.3）
 *
 * 断言：
 *   - mock 成功 → 返回 { text }
 *   - failing → 错误固定文案，不含 imagePath/stdout/stderr（安全断言）
 *   - 图片路径不存在 → BAD_REQUEST + "图片不存在"
 *   - 缺少路径 → BAD_REQUEST + "缺少图片路径"
 *   - 错误响应不含 imagePath/pythonPath/bridgePath（安全断言）
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-005\unit-handler。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-005\\unit-handler";

function isRpcError(e: unknown): e is RpcError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}

describe("T-M1-005 S1 OCR handler 单件测试", () => {
  let sampleImage: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    sampleImage = join(ISOLATION_DIR, "schedule.png");
    writeFileSync(
      sampleImage,
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
        0x0d, 0x49, 0x48, 0x44, 0x52,
      ]),
    );
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

  describe("mock adapter（成功路径）", () => {
    it("OK-01 mock 成功 → 返回 { text }，不含 imagePath/stdout/stderr", async () => {
      const handler = handleOcrSchedule({ ocrAdapter: createMockOcrAdapter() });
      const result = await handler({ imagePath: sampleImage });
      expect(typeof result.text).toBe("string");
      expect(result.text.length).toBeGreaterThan(0);
      expect(result).not.toHaveProperty("imagePath");
      expect(result).not.toHaveProperty("stdout");
      expect(result).not.toHaveProperty("stderr");
    });
  });

  describe("failing adapter（错误隔离）", () => {
    it("ERR-01 failing → INTERNAL_ERROR + '识别失败'，错误消息不含 imagePath/stdout/stderr", async () => {
      const handler = handleOcrSchedule({ ocrAdapter: createFailingOcrAdapter() });
      try {
        await handler({ imagePath: sampleImage });
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("识别失败");
        // 安全断言：错误响应不含 imagePath/Python/bridge/stdout/stderr
        expect(err.message).not.toContain(sampleImage);
        expect(err.message).not.toContain("python");
        expect(err.message).not.toContain("bridge");
        expect(err.message).not.toContain("stdout");
        expect(err.message).not.toContain("stderr");
      }
    });
  });

  describe("路径校验", () => {
    it("PATH-01 图片路径不存在 → BAD_REQUEST + '图片不存在'", async () => {
      const handler = handleOcrSchedule({ ocrAdapter: createMockOcrAdapter() });
      const missing = join(ISOLATION_DIR, "not-exist.png");
      try {
        await handler({ imagePath: missing });
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("BAD_REQUEST");
        expect(err.message).toContain("图片不存在");
        expect(err.message).not.toContain(missing);
      }
    });

    it("PATH-02 缺少图片路径 → BAD_REQUEST + '缺少图片路径'", async () => {
      const handler = handleOcrSchedule({ ocrAdapter: createMockOcrAdapter() });
      try {
        await handler({});
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("BAD_REQUEST");
        expect(err.message).toContain("缺少图片路径");
      }
    });

    it("PATH-03 空字符串路径 → BAD_REQUEST", async () => {
      const handler = handleOcrSchedule({ ocrAdapter: createMockOcrAdapter() });
      await expect(handler({ imagePath: "   " })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });
  });
});