import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createMockWhisperAdapter,
  createRealWhisperAdapter,
  type WhisperCppAdapter,
} from "../../src/agent-host/handlers/s7/whisper-adapter";
import type { RpcError } from "../../src/contract/types";

/**
 * T-M2-003 S7 WhisperCppAdapter 单件测试（03-Arch §3.3 + 08-Test §3.3.2 三断言）
 *
 * 三断言：
 *   1. 路径未配置（cliPath=""）→ INTERNAL_ERROR + "未配置"，错误消息不含路径/stdout/stderr
 *   2. 受控 PCM WAV 文件头验证：拒绝 MP3/M4A/WebM（adapter 内部调 wavValidator）
 *   3. 转写成功返回 { text: string }，不返回 stdout 字段
 *
 * 安全不变量（08-Test §5.4）：不连真实 whisper.cpp，仅测试 mock + real 框架（路径校验）。
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M2-003\unit-whisper。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-003\\unit-whisper";

/** 构造合法 PCM WAV 44 字节头部 */
function buildValidPcmWavHeader(): Buffer {
  const buf = Buffer.alloc(44, 0);
  buf.write("RIFF", 0, 4, "ascii");
  buf.writeUInt32LE(36, 4);
  buf.write("WAVE", 8, 4, "ascii");
  buf.write("fmt ", 12, 4, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // 单声道
  buf.writeUInt32LE(16000, 24); // 16kHz
  buf.writeUInt32LE(32000, 28); // byteRate
  buf.writeUInt16LE(2, 32); // blockAlign
  buf.writeUInt16LE(16, 34); // 16-bit
  buf.write("data", 36, 4, "ascii");
  buf.writeUInt32LE(0, 40);
  return buf;
}

function isRpcError(e: unknown): e is RpcError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}

describe("T-M2-003 S7 WhisperCppAdapter 单件测试", () => {
  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
  });

  describe("createMockWhisperAdapter", () => {
    it("转写成功返回 { text: string }，不返回 stdout 字段（08-Test §3.3.2 断言 3）", async () => {
      const adapter: WhisperCppAdapter = createMockWhisperAdapter();
      const file = join(ISOLATION_DIR, "valid.wav");
      writeFileSync(file, buildValidPcmWavHeader());

      const result = await adapter.transcribe(file);

      expect(typeof result.text).toBe("string");
      expect(result.text.length).toBeGreaterThan(0);
      // 不返回 stdout 全文（08-Test §3.3.2 断言 3 关键约束）
      expect(result).not.toHaveProperty("stdout");
      expect(result).not.toHaveProperty("stderr");
    });

    it("受控 PCM WAV 文件头验证：拒绝 MP3 → BAD_REQUEST 含 'PCM WAV'（08-Test §3.3.2 断言 2）", async () => {
      const adapter: WhisperCppAdapter = createMockWhisperAdapter();
      const file = join(ISOLATION_DIR, "mp3.wav");
      const buf = Buffer.alloc(44, 0);
      buf.write("ID3", 0, 3, "ascii");
      writeFileSync(file, buf);

      try {
        await adapter.transcribe(file);
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("BAD_REQUEST");
        expect(err.message).toContain("PCM WAV");
      }
    });

    it("受控 PCM WAV 文件头验证：拒绝 WebM → BAD_REQUEST", async () => {
      const adapter: WhisperCppAdapter = createMockWhisperAdapter();
      const file = join(ISOLATION_DIR, "webm.wav");
      const buf = Buffer.alloc(44, 0);
      buf.writeUInt8(0x1a, 0);
      buf.writeUInt8(0x45, 1);
      buf.writeUInt8(0xdf, 2);
      buf.writeUInt8(0xa3, 3);
      writeFileSync(file, buf);

      try {
        await adapter.transcribe(file);
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("受控 PCM WAV 文件头验证：拒绝 M4A → BAD_REQUEST", async () => {
      const adapter: WhisperCppAdapter = createMockWhisperAdapter();
      const file = join(ISOLATION_DIR, "m4a.wav");
      const buf = Buffer.alloc(44, 0);
      buf.write("ftyp", 4, 4, "ascii");
      writeFileSync(file, buf);

      try {
        await adapter.transcribe(file);
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("确定性：多次调用同一文件返回相同文本（默认 mock 不依赖外部状态）", async () => {
      const adapter: WhisperCppAdapter = createMockWhisperAdapter();
      const file = join(ISOLATION_DIR, "deterministic.wav");
      writeFileSync(file, buildValidPcmWavHeader());

      const r1 = await adapter.transcribe(file);
      const r2 = await adapter.transcribe(file);
      expect(r1.text).toBe(r2.text);
    });
  });

  describe("createRealWhisperAdapter", () => {
    it("路径未配置（cliPath=''）→ INTERNAL_ERROR + '未配置'，错误消息不含路径/stdout/stderr（08-Test §3.3.2 断言 1）", async () => {
      const adapter = createRealWhisperAdapter({
        cliPath: "",
        modelPath: "/some/model.bin",
      });
      const file = join(ISOLATION_DIR, "valid-for-cli.wav");
      writeFileSync(file, buildValidPcmWavHeader());

      try {
        await adapter.transcribe(file);
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("未配置");
        // 错误消息不含 cliPath/modelPath/audioFilePath/stdout/stderr
        expect(err.message).not.toContain("some/model.bin");
        expect(err.message).not.toContain(ISOLATION_DIR);
        expect(err.message).not.toContain(file);
        expect(err.message).not.toContain("valid-for-cli");
        expect(err.message).not.toContain("stdout");
        expect(err.message).not.toContain("stderr");
      }
    });

    it("modelPath 未配置（modelPath=''）→ INTERNAL_ERROR + '未配置'", async () => {
      const adapter = createRealWhisperAdapter({
        cliPath: "/some/whisper-cli",
        modelPath: "",
      });
      const file = join(ISOLATION_DIR, "valid-for-model.wav");
      writeFileSync(file, buildValidPcmWavHeader());

      try {
        await adapter.transcribe(file);
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("未配置");
        expect(err.message).not.toContain("some/whisper-cli");
      }
    });

    it("受控 PCM WAV 文件头验证：real adapter 同样拒绝 MP3 → BAD_REQUEST", async () => {
      const adapter = createRealWhisperAdapter({
        cliPath: "/some/whisper-cli",
        modelPath: "/some/model.bin",
      });
      const file = join(ISOLATION_DIR, "mp3-real.wav");
      const buf = Buffer.alloc(44, 0);
      buf.write("ID3", 0, 3, "ascii");
      writeFileSync(file, buf);

      try {
        await adapter.transcribe(file);
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });
  });
});
