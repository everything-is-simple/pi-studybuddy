import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
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
 *
 * T-M2-007 新增：真实转写测试（08-Test §9.3 允许本机真实），探测 whisper-cli + 模型存在才跑，
 * 数据隔离写 H:\pi-studybuddy-tmp\runs\T-M2-007\unit-whisper。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-003\\unit-whisper";
const T2_ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-007\\unit-whisper";

// T-M2-007 真实验证路径（步骤1 边界验证已确认存在）
const WHISPER_CLI =
  "H:\\ai-studybuddy-components\\local-asr-whispercpp\\build-msvc-x64-release\\bin\\Release\\whisper-cli.exe";
const WHISPER_MODEL = "H:\\ai-studybuddy-components\\local-asr-whispercpp\\models\\ggml-base.bin";

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

/**
 * 构造带真实数据的 16kHz/mono/16-bit PCM WAV（含 3s 正弦波 data chunk）。
 * whisper.cpp 需要真实音频数据才能转写，纯 44 字节空头会被识别为空白音频。
 */
function buildSineWavBuffer(seconds = 3, sampleRate = 16000): Buffer {
  const numSamples = seconds * sampleRate;
  const dataSize = numSamples * 2; // 16-bit = 2 bytes/sample
  const buf = Buffer.alloc(44 + dataSize, 0);
  buf.write("RIFF", 0, 4, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, 4, "ascii");
  buf.write("fmt ", 12, 4, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // 单声道
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byteRate
  buf.writeUInt16LE(2, 32); // blockAlign
  buf.writeUInt16LE(16, 34); // 16-bit
  buf.write("data", 36, 4, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  // 3s 正弦波（440Hz，幅值 0.3 —— 足够让 whisper 识别为有声音量）
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(0.3 * 32767 * Math.sin((2 * Math.PI * 440 * i) / sampleRate));
    buf.writeInt16LE(sample, 44 + i * 2);
  }
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

  describe("createRealWhisperAdapter 真实转写（T-M2-007，08-Test §9.3 允许本机真实）", () => {
    const realAvailable =
      existsSync(WHISPER_CLI) && existsSync(WHISPER_MODEL);
    const skipReason = realAvailable
      ? ""
      : "whisper-cli 或 ggml-base.bin 不存在，跳过真实转写测试（避免 CI 依赖模型文件）";

    beforeAll(() => {
      rmSync(T2_ISOLATION_DIR, { recursive: true, force: true });
      mkdirSync(T2_ISOLATION_DIR, { recursive: true });
    });

    afterAll(() => {
      for (let i = 0; i < 3; i++) {
        try {
          rmSync(T2_ISOLATION_DIR, { recursive: true, force: true });
          break;
        } catch {
          // 忽略 EBUSY
        }
      }
    });

    it("真实路径 → 转写合成 3s 正弦波 PCM WAV 返回非空 text，无 stdout/stderr 字段", async () => {
      if (!realAvailable) {
        console.log(skipReason);
        return;
      }
      const adapter = createRealWhisperAdapter({
        cliPath: WHISPER_CLI,
        modelPath: WHISPER_MODEL,
      });
      const wavPath = join(T2_ISOLATION_DIR, "sine.wav");
      writeFileSync(wavPath, buildSineWavBuffer());

      const result = await adapter.transcribe(wavPath);

      // 只断言 text 非空 + 无泄漏字段，不断言具体识别文本（正弦波识别结果与模型相关）
      expect(typeof result.text).toBe("string");
      expect(result.text.length).toBeGreaterThan(0);
      // 不返回 stdout 全文（08-Test §3.3.2 断言 3 关键约束）
      expect(result).not.toHaveProperty("stdout");
      expect(result).not.toHaveProperty("stderr");
    }, 30000);

    it("真实路径 + 非法音频头 → BAD_REQUEST（先验证文件头再 spawn）", async () => {
      if (!realAvailable) {
        console.log(skipReason);
        return;
      }
      const adapter = createRealWhisperAdapter({
        cliPath: WHISPER_CLI,
        modelPath: WHISPER_MODEL,
      });
      const badPath = join(T2_ISOLATION_DIR, "bad.wav");
      const buf = Buffer.alloc(44, 0);
      buf.write("ID3", 0, 3, "ascii");
      writeFileSync(badPath, buf);

      try {
        await adapter.transcribe(badPath);
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });
  });
});
