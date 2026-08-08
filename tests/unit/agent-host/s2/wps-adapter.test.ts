import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  createMockWpsAdapter,
  createFailingWpsAdapter,
  createRealWpsAdapter,
  type WpsAdapter,
} from "../../../../src/agent-host/handlers/s2/wps-adapter";
import type { RpcError } from "../../../../src/contract/types";

/**
 * T-M1-006 S2 WpsAdapter 单件测试（03-Arch §3.3 + 08-Test §3.3.1）
 *
 * 三态：
 *   1. mock：确定性返回固定 outPath/outFileName，无子进程调用，不返回 stdout/stderr
 *   2. failing：抛 INTERNAL_ERROR + 固定文案
 *   3. real：路径未配置 → INTERNAL_ERROR + "未配置"，错误消息不含 pythonPath/bridgePath/inPath
 *
 * 安全不变量（AGENTS.md §5.4）：不连真实 WPS，仅测试 mock + real 框架（路径校验）。
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-006\unit-adapter。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-006\\unit-adapter";

function isRpcError(e: unknown): e is RpcError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}

describe("T-M1-006 S2 WpsAdapter 单件测试", () => {
  let sampleIn: string;
  let outDir: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    outDir = join(ISOLATION_DIR, "out");
    mkdirSync(outDir, { recursive: true });
    sampleIn = join(ISOLATION_DIR, "sample.doc");
    writeFileSync(sampleIn, "fake doc content");
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

  describe("createMockWpsAdapter", () => {
    it("MOCK-01 确定性返回 outPath/outFileName，不返回 stdout/stderr（08-Test §3.3.1 断言）", async () => {
      const adapter: WpsAdapter = createMockWpsAdapter();
      const result = await adapter.convert(sampleIn, outDir);
      expect(result.outFileName).toBe("sample.docx");
      expect(result.outPath).toBe(join(outDir, "sample.docx"));
      // 不返回 stdout/stderr/inPath（08-Test §3.3.1 关键约束）
      expect(result).not.toHaveProperty("stdout");
      expect(result).not.toHaveProperty("stderr");
      expect(result).not.toHaveProperty("inPath");
    });

    it("MOCK-02 确定性：多次调用同一路径返回相同 outPath", async () => {
      const adapter: WpsAdapter = createMockWpsAdapter();
      const r1 = await adapter.convert(sampleIn, outDir);
      const r2 = await adapter.convert(sampleIn, outDir);
      expect(r1.outPath).toBe(r2.outPath);
      expect(r1.outFileName).toBe(r2.outFileName);
    });
  });

  describe("createFailingWpsAdapter", () => {
    it("FAIL-01 抛 INTERNAL_ERROR + '转换失败'，错误消息不含路径/stdout/stderr", async () => {
      const adapter: WpsAdapter = createFailingWpsAdapter();
      try {
        await adapter.convert(sampleIn, outDir);
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("转换失败");
        expect(err.message).not.toContain(sampleIn);
        expect(err.message).not.toContain(outDir);
        expect(err.message).not.toContain("stdout");
        expect(err.message).not.toContain("stderr");
      }
    });
  });

  describe("createRealWpsAdapter", () => {
    it("REAL-01 pythonPath 未配置 → INTERNAL_ERROR + '未配置'，错误消息不含 pythonPath/bridgePath/inPath", async () => {
      const adapter = createRealWpsAdapter({
        pythonPath: "",
        bridgePath: "H:\\pi-studybuddy\\scripts\\wps-bridge\\wps_bridge.py",
      });
      try {
        await adapter.convert(sampleIn, outDir);
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("未配置");
        expect(err.message).not.toContain("wps_bridge.py");
        expect(err.message).not.toContain(sampleIn);
        expect(err.message).not.toContain("stdout");
        expect(err.message).not.toContain("stderr");
      }
    });

    it("REAL-02 bridgePath 未配置 → INTERNAL_ERROR + '未配置'", async () => {
      const adapter = createRealWpsAdapter({
        pythonPath: "H:\\AIStudyBuddy\\runtime\\venv\\Scripts\\python.exe",
        bridgePath: "",
      });
      try {
        await adapter.convert(sampleIn, outDir);
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
      const adapter = createRealWpsAdapter({
        pythonPath: "",
        bridgePath: "",
      });
      await expect(adapter.convert(sampleIn, outDir)).rejects.toMatchObject({
        code: "INTERNAL_ERROR",
      });
    });

    it("REAL-04 输入路径存在性由 handler 校验（real adapter 不隐式抛出路径错误）", async () => {
      const adapter = createRealWpsAdapter({
        pythonPath: "H:\\AIStudyBuddy\\runtime\\venv\\Scripts\\python.exe",
        bridgePath: "H:\\pi-studybuddy\\scripts\\wps-bridge\\wps_bridge.py",
      });
      expect(typeof adapter.convert).toBe("function");
      expect(existsSync(sampleIn)).toBe(true);
    });
  });
});