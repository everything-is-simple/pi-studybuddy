/**
 * T-M2-003 S7 PCM WAV 文件头服务端验证（07-WF §2.7 + 03-Arch §3.3 + 08-Test §3.3.2）
 *
 * 不信任浏览器 MIME（05-ERD §3.2.1），服务端重新读取 44 字节头部字节级验证。
 *
 * 校验项（任一失败 → throw BAD_REQUEST）：
 *   1. 文件存在且可读
 *   2. RIFF magic（bytes 0-3 = "RIFF"）
 *   3. WAVE magic（bytes 8-11 = "WAVE"）
 *   4. fmt chunk PCM format（bytes 20-21 = 0x0001，小端）
 *   5. 单声道（bytes 22-23 = 0x0001）
 *   6. 16kHz 采样率（bytes 24-27 = 0x00003E80，小端）
 *   7. 16-bit 位深（bytes 34-35 = 0x0010，小端）
 *
 * 安全（07-WF §2.7）：错误消息固定文案，不含文件路径/stdout/stderr/密钥。
 */
import { openSync, readSync, closeSync, statSync } from "node:fs";
import type { RpcError } from "../../../contract/types";

/** 固定错误消息（不泄漏路径，07-WF §2.7 关键约束） */
const ERROR_MESSAGE = "仅支持 PCM WAV 格式（16kHz/单声道/16-bit）";

function badRequest(message: string): RpcError {
  return { code: "BAD_REQUEST", message };
}

/** PCM WAV 头部最小长度（RIFF/WAVE/fmt/data 四段标准头） */
const MIN_HEADER_SIZE = 44;

/** 期望的 RIFF magic（bytes 0-3） */
const RIFF_MAGIC = "RIFF";

/** 期望的 WAVE magic（bytes 8-11） */
const WAVE_MAGIC = "WAVE";

/** PCM 音频格式码（bytes 20-21 LE） */
const PCM_FORMAT_TAG = 1;

/** 单声道（bytes 22-23 LE） */
const MONO_CHANNELS = 1;

/** 16kHz 采样率（bytes 24-27 LE） */
const SAMPLE_RATE_16K = 16000;

/** 16-bit 位深（bytes 34-35 LE） */
const BITS_16 = 16;

/**
 * 验证 PCM WAV 文件头。任一校验失败抛 BAD_REQUEST（消息固定，不含路径）。
 *
 * @param filePath PCM WAV 文件绝对路径
 * @throws RpcError BAD_REQUEST 当文件不存在/不可读/头部不合法
 */
export function validatePcmWav(filePath: string): void {
  let fd: number | null = null;
  let fileSize = 0;
  try {
    // 1. 文件存在 + 大小
    try {
      const stat = statSync(filePath);
      fileSize = stat.size;
      if (fileSize < MIN_HEADER_SIZE) {
        throw badRequest(ERROR_MESSAGE);
      }
    } catch (e) {
      // statSync 失败或我们主动抛的 BAD_REQUEST
      if (e && typeof e === "object" && "code" in e) {
        const err = e as { code?: string; message?: string };
        if (err.code === "BAD_REQUEST") throw e;
      }
      throw badRequest(ERROR_MESSAGE);
    }

    // 2. 打开 + 读取 44 字节头部
    try {
      fd = openSync(filePath, "r");
    } catch {
      throw badRequest(ERROR_MESSAGE);
    }

    const header = Buffer.alloc(MIN_HEADER_SIZE, 0);
    let bytesRead = 0;
    try {
      bytesRead = readSync(fd, header, 0, MIN_HEADER_SIZE, 0);
    } catch {
      throw badRequest(ERROR_MESSAGE);
    }
    if (bytesRead < MIN_HEADER_SIZE) {
      throw badRequest(ERROR_MESSAGE);
    }

    // 3. RIFF magic（bytes 0-3）
    if (header.toString("ascii", 0, 4) !== RIFF_MAGIC) {
      throw badRequest(ERROR_MESSAGE);
    }

    // 4. WAVE magic（bytes 8-11）
    if (header.toString("ascii", 8, 12) !== WAVE_MAGIC) {
      throw badRequest(ERROR_MESSAGE);
    }

    // 5. fmt chunk PCM format（bytes 20-21 LE，1 = PCM）
    const fmtTag = header.readUInt16LE(20);
    if (fmtTag !== PCM_FORMAT_TAG) {
      throw badRequest(ERROR_MESSAGE);
    }

    // 6. 单声道（bytes 22-23 LE）
    const channels = header.readUInt16LE(22);
    if (channels !== MONO_CHANNELS) {
      throw badRequest(ERROR_MESSAGE);
    }

    // 7. 16kHz 采样率（bytes 24-27 LE）
    const sampleRate = header.readUInt32LE(24);
    if (sampleRate !== SAMPLE_RATE_16K) {
      throw badRequest(ERROR_MESSAGE);
    }

    // 8. 16-bit 位深（bytes 34-35 LE）
    const bitsPerSample = header.readUInt16LE(34);
    if (bitsPerSample !== BITS_16) {
      throw badRequest(ERROR_MESSAGE);
    }

    // 全部通过 → 不抛异常
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        // 关闭失败不影响校验结论
      }
    }
  }
}
