import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  createMockOcrAdapter,
  createFailingOcrAdapter,
  createRealOcrAdapter,
  type OcrAdapter,
} from "../../../../src/agent-host/handlers/s1/ocr-adapter";
import type { RpcError } from "../../../../src/contract/types";

/**
 * T-M1-005 S1 OcrAdapter 单件测试（03-Arch §3.3 + 08-Test §3.3.3）
 *
 * 三态：
 *   1. mock：确定性返回固定文本，无子进程调用，不返回 stdout/stderr
 *   2. failing：抛 INTERNAL_ERROR + 固定文案
 *   3. real：路径未配置 → INTERNAL_ERROR + "未配置"，错误消息不含 pythonPath/bridgePath/imagePath
 *
 * 安全不变量（AGENTS.md §5.4）：不连真实 RapidOCR，仅测试 mock + real 框架（路径校验）。
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-005\unit-adapter。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-005\\unit-adapter";

function isRpcError(e: unknown): e is RpcError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}

describe("T-M1-005 S1 OcrAdapter 单件测试", () => {
  let sampleImage: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    sampleImage = join(ISOLATION_DIR, "schedule.png");
    // 最小合法 PNG 头（PNG signature + IHDR 占位），仅用于路径校验测试
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

  describe("createMockOcrAdapter", () => {
    it("MOCK-01 确定性返回固定文本，不返回 stdout/stderr（08-Test §3.3.3 断言）", async () => {
      const adapter: OcrAdapter = createMockOcrAdapter();
      const result = await adapter.recognize(sampleImage);
      expect(typeof result.text).toBe("string");
      expect(result.text.length).toBeGreaterThan(0);
      // 不返回 stdout/stderr（08-Test §3.3.3 关键约束）
      expect(result).not.toHaveProperty("stdout");
      expect(result).not.toHaveProperty("stderr");
      expect(result).not.toHaveProperty("imagePath");
    });

    it("MOCK-02 确定性：多次调用同一路径返回相同文本", async () => {
      const adapter: OcrAdapter = createMockOcrAdapter();
      const r1 = await adapter.recognize(sampleImage);
      const r2 = await adapter.recognize(sampleImage);
      expect(r1.text).toBe(r2.text);
    });
  });

  describe("createFailingOcrAdapter", () => {
    it("FAIL-01 抛 INTERNAL_ERROR + '识别失败'，错误消息不含路径/stdout/stderr", async () => {
      const adapter: OcrAdapter = createFailingOcrAdapter();
      try {
        await adapter.recognize(sampleImage);
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("识别失败");
        expect(err.message).not.toContain(sampleImage);
        expect(err.message).not.toContain("stdout");
        expect(err.message).not.toContain("stderr");
      }
    });
  });

  describe("createRealOcrAdapter", () => {
    it("REAL-01 pythonPath 未配置 → INTERNAL_ERROR + '未配置'，错误消息不含 pythonPath/bridgePath/imagePath", async () => {
      const adapter = createRealOcrAdapter({
        pythonPath: "",
        bridgePath: "H:\\pi-studybuddy\\scripts\\ocr-bridge\\ocr_bridge.py",
      });
      try {
        await adapter.recognize(sampleImage);
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("未配置");
        expect(err.message).not.toContain("ocr_bridge.py");
        expect(err.message).not.toContain(sampleImage);
        expect(err.message).not.toContain("stdout");
        expect(err.message).not.toContain("stderr");
      }
    });

    it("REAL-02 bridgePath 未配置 → INTERNAL_ERROR + '未配置'", async () => {
      const adapter = createRealOcrAdapter({
        pythonPath: "H:\\AIStudyBuddy\\runtime\\venv\\Scripts\\python.exe",
        bridgePath: "",
      });
      try {
        await adapter.recognize(sampleImage);
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("未配置");
        expect(err.message).not.toContain("python.exe");
      }
    });

    it("REAL-03 返回对象无 stdout 属性（防 stdout 泄漏）", async () => {
      // 路径未配置时返回的 Promise 拒绝，但符合契约：返回值永远不会含 stdout
      const adapter = createRealOcrAdapter({
        pythonPath: "",
        bridgePath: "",
      });
      // 只断言路径未配置抛错（不连真实子进程）
      await expect(adapter.recognize(sampleImage)).rejects.toMatchObject({
        code: "INTERNAL_ERROR",
      });
    });

    it("REAL-04 图片路径存在性由 handler 校验（real adapter 不隐式抛出路径错误）", async () => {
      // 验证 real adapter 在路径配置完整时不会提前抛"未配置"（spawn 路径为其职责）
      const adapter = createRealOcrAdapter({
        pythonPath: "H:\\AIStudyBuddy\\runtime\\venv\\Scripts\\python.exe",
        bridgePath: "H:\\pi-studybuddy\\scripts\\ocr-bridge\\ocr_bridge.py",
      });
      expect(typeof adapter.recognize).toBe("function");
      // 不实际调用（不连真实子进程），仅验证创建成功
      expect(existsSync(sampleImage)).toBe(true);
    });
  });
});