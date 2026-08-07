import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validatePcmWav } from "../../src/agent-host/handlers/s7/wav-validator";
import type { RpcError } from "../../src/contract/types";

/**
 * T-M2-003 S7 PCM WAV 文件头验证单件测试（07-WF §2.7 + 08-Test §3.3.2）
 *
 * 服务端重新读取 44 字节头部字节级验证，不信任浏览器 MIME（05-ERD §3.2.1）。
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M2-003\unit-wav。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-003\\unit-wav";

/**
 * 构造 44 字节 PCM WAV 头部 Buffer。
 * 默认：RIFF/WAVE/PCM/16kHz/单声道/16-bit。
 * 各字段可单独覆盖以构造非法变体。
 */
function buildWavHeader(opts: {
  riff?: string; // bytes 0-3
  wave?: string; // bytes 8-11
  fmtTag?: number; // bytes 20-21 音频格式（1=PCM）
  channels?: number; // bytes 22-23
  sampleRate?: number; // bytes 24-27
  bitsPerSample?: number; // bytes 34-35
  data?: string; // bytes 36-39 "data"
  fmtChunkSize?: number; // bytes 16-19
  extraBytes?: number; // 附加字节（截断时用 negative）
}): Buffer {
  const buf = Buffer.alloc(44, 0);
  const riff = opts.riff ?? "RIFF";
  const wave = opts.wave ?? "WAVE";
  const fmtTag = opts.fmtTag ?? 1;
  const channels = opts.channels ?? 1;
  const sampleRate = opts.sampleRate ?? 16000;
  const bits = opts.bitsPerSample ?? 16;
  const data = opts.data ?? "data";
  const fmtSize = opts.fmtChunkSize ?? 16;

  buf.write(riff, 0, 4, "ascii");
  buf.writeUInt32LE(36, 4); // 文件大小 - 8
  buf.write(wave, 8, 4, "ascii");
  buf.write("fmt ", 12, 4, "ascii");
  buf.writeUInt32LE(fmtSize, 16);
  buf.writeUInt16LE(fmtTag, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  const byteRate = sampleRate * channels * (bits / 8);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(channels * (bits / 8), 32);
  buf.writeUInt16LE(bits, 34);
  buf.write(data, 36, 4, "ascii");
  buf.writeUInt32LE(0, 40); // data chunk 大小

  return opts.extraBytes !== undefined ? buf.subarray(0, 44 + opts.extraBytes) : buf;
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

describe("T-M2-003 S7 PCM WAV 文件头验证单件测试", () => {
  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
  });

  it("合法 PCM WAV（16kHz/单声道/16-bit）→ 通过（不抛异常）", () => {
    const file = join(ISOLATION_DIR, "valid.wav");
    writeFileSync(file, buildWavHeader({}));
    expect(() => validatePcmWav(file)).not.toThrow();
  });

  it("拒绝 MP3 文件头（ID3）→ BAD_REQUEST 含 'PCM WAV'", () => {
    const file = join(ISOLATION_DIR, "mp3-id3.wav");
    const buf = Buffer.alloc(44, 0);
    buf.write("ID3", 0, 3, "ascii");
    writeFileSync(file, buf);
    try {
      validatePcmWav(file);
      throw new Error("应抛异常但未抛");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      const err = e as RpcError;
      expect(err.code).toBe("BAD_REQUEST");
      expect(err.message).toContain("PCM WAV");
    }
  });

  it("拒绝 MP3 文件头（0xFFFB MPEG-1 Layer 3）→ BAD_REQUEST", () => {
    const file = join(ISOLATION_DIR, "mp3-fffb.wav");
    const buf = Buffer.alloc(44, 0);
    buf.writeUInt8(0xff, 0);
    buf.writeUInt8(0xfb, 1);
    writeFileSync(file, buf);
    try {
      validatePcmWav(file);
      throw new Error("应抛异常但未抛");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as RpcError).code).toBe("BAD_REQUEST");
    }
  });

  it("拒绝 M4A 文件头（ftyp box）→ BAD_REQUEST", () => {
    const file = join(ISOLATION_DIR, "m4a.wav");
    const buf = Buffer.alloc(44, 0);
    // M4A: bytes 4-7 = "ftyp"
    buf.writeUInt32BE(0, 0);
    buf.write("ftyp", 4, 4, "ascii");
    writeFileSync(file, buf);
    try {
      validatePcmWav(file);
      throw new Error("应抛异常但未抛");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as RpcError).code).toBe("BAD_REQUEST");
    }
  });

  it("拒绝 WebM 文件头（0x1A45DFA3 EBML）→ BAD_REQUEST", () => {
    const file = join(ISOLATION_DIR, "webm.wav");
    const buf = Buffer.alloc(44, 0);
    buf.writeUInt8(0x1a, 0);
    buf.writeUInt8(0x45, 1);
    buf.writeUInt8(0xdf, 2);
    buf.writeUInt8(0xa3, 3);
    writeFileSync(file, buf);
    try {
      validatePcmWav(file);
      throw new Error("应抛异常但未抛");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as RpcError).code).toBe("BAD_REQUEST");
    }
  });

  it("拒绝非 PCM WAV（IEEE float format code 0x0003）→ BAD_REQUEST", () => {
    const file = join(ISOLATION_DIR, "float.wav");
    writeFileSync(file, buildWavHeader({ fmtTag: 3 }));
    try {
      validatePcmWav(file);
      throw new Error("应抛异常但未抛");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as RpcError).code).toBe("BAD_REQUEST");
    }
  });

  it("拒绝非 16kHz 采样率（44.1kHz）→ BAD_REQUEST", () => {
    const file = join(ISOLATION_DIR, "44100.wav");
    writeFileSync(file, buildWavHeader({ sampleRate: 44100 }));
    try {
      validatePcmWav(file);
      throw new Error("应抛异常但未抛");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as RpcError).code).toBe("BAD_REQUEST");
    }
  });

  it("拒绝双声道（非单声道）→ BAD_REQUEST", () => {
    const file = join(ISOLATION_DIR, "stereo.wav");
    writeFileSync(file, buildWavHeader({ channels: 2 }));
    try {
      validatePcmWav(file);
      throw new Error("应抛异常但未抛");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as RpcError).code).toBe("BAD_REQUEST");
    }
  });

  it("拒绝 24-bit 位深（非 16-bit）→ BAD_REQUEST", () => {
    const file = join(ISOLATION_DIR, "24bit.wav");
    writeFileSync(file, buildWavHeader({ bitsPerSample: 24 }));
    try {
      validatePcmWav(file);
      throw new Error("应抛异常但未抛");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as RpcError).code).toBe("BAD_REQUEST");
    }
  });

  it("拒绝空文件（0 字节）→ BAD_REQUEST", () => {
    const file = join(ISOLATION_DIR, "empty.wav");
    writeFileSync(file, Buffer.alloc(0));
    try {
      validatePcmWav(file);
      throw new Error("应抛异常但未抛");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as RpcError).code).toBe("BAD_REQUEST");
    }
  });

  it("拒绝截断头部（< 44 字节，仅 12 字节）→ BAD_REQUEST", () => {
    const file = join(ISOLATION_DIR, "truncated.wav");
    writeFileSync(file, buildWavHeader({}).subarray(0, 12));
    try {
      validatePcmWav(file);
      throw new Error("应抛异常但未抛");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as RpcError).code).toBe("BAD_REQUEST");
    }
  });

  it("拒绝不存在的文件路径 → BAD_REQUEST", () => {
    const file = join(ISOLATION_DIR, "nonexistent.wav");
    try {
      validatePcmWav(file);
      throw new Error("应抛异常但未抛");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as RpcError).code).toBe("BAD_REQUEST");
    }
  });

  it("拒绝错误 WAVE magic（bytes 8-11 = 'XVID'）→ BAD_REQUEST", () => {
    const file = join(ISOLATION_DIR, "bad-wave.wav");
    writeFileSync(file, buildWavHeader({ wave: "XVID" }));
    try {
      validatePcmWav(file);
      throw new Error("应抛异常但未抛");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as RpcError).code).toBe("BAD_REQUEST");
    }
  });

  it("错误消息不含文件路径（安全：路径不泄漏）", () => {
    const file = join(ISOLATION_DIR, "leak-test.wav");
    writeFileSync(file, buildWavHeader({ channels: 2 }));
    try {
      validatePcmWav(file);
      throw new Error("应抛异常但未抛");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      const err = e as RpcError;
      // 错误消息不得包含文件路径
      expect(err.message).not.toContain(ISOLATION_DIR);
      expect(err.message).not.toContain(file);
      expect(err.message).not.toContain("leak-test");
    }
  });
});
