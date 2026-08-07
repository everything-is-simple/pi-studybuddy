/**
 * T-M2-005 最小 ZIP 打包/解包工具（05-ERD §8.1 备份 zip 格式）
 *
 * 不引入外部依赖，使用 Node.js 内置 zlib（deflateRaw）+ 手动构建 ZIP 文件格式。
 * ZIP 格式参考：PKWARE APPNOTE 6.3.10（公开标准）。
 *
 * 支持特性：
 *   - 打包目录为 .zip（deflate 压缩）
 *   - 解压 .zip 到目录
 *   - 仅文件（不处理目录条目、符号链接、扩展属性）
 *   - 文件名使用 UTF-8
 *
 * 安全（AGENTS.md §9.4）：
 *   - zip 炸弹防护：解压时校验条目数上限 + 解压比上限
 *   - 路径逃逸防护：解压时校验文件名不包含 ../ 或绝对路径
 */
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// ZIP 常量
const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const METHOD_DEFLATE = 8;
const METHOD_STORE = 0;

/** zip 炸弹防护阈值（AGENTS.md §9.4） */
export const ZIP_BOMB_MAX_ENTRIES = 10000;
export const ZIP_BOMB_MAX_RATIO = 100; // 解压比上限 100:1

/** ZIP 条目（打包用） */
interface ZipEntry {
  filename: string; // 相对路径，使用 / 分隔
  data: Buffer;
}

/** CRC32 表（预计算） */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** DOS 时间戳（固定为 1980-01-01，简化处理） */
const DOS_TIME = 0x0000;
const DOS_DATE = 0x0021;

/** 将目录打包为 ZIP Buffer */
export function packDirectory(srcDir: string): Buffer {
  const entries = collectFiles(srcDir, srcDir);
  return packEntries(entries);
}

function collectFiles(baseDir: string, currentDir: string): ZipEntry[] {
  const entries: ZipEntry[] = [];
  const items = readdirSync(currentDir);
  for (const item of items) {
    const fullPath = path.join(currentDir, item);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      entries.push(...collectFiles(baseDir, fullPath));
    } else {
      const relPath = path.relative(baseDir, fullPath).split(path.sep).join("/");
      entries.push({ filename: relPath, data: readFileSync(fullPath) });
    }
  }
  return entries;
}

function packEntries(entries: ZipEntry[]): Buffer {
  const chunks: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const filenameBuf = Buffer.from(entry.filename, "utf8");
    const crc = crc32(entry.data);
    const compressed = deflateRawSync(entry.data);
    const method = compressed.length < entry.data.length ? METHOD_DEFLATE : METHOD_STORE;
    const fileData = method === METHOD_DEFLATE ? compressed : entry.data;

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(SIG_LOCAL, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x0800, 6); // flags: UTF-8 filename
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(DOS_TIME, 10);
    localHeader.writeUInt16LE(DOS_DATE, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(fileData.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(filenameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    chunks.push(localHeader, filenameBuf, fileData);

    // Central directory record (46 bytes + filename)
    const centralRecord = Buffer.alloc(46);
    centralRecord.writeUInt32LE(SIG_CENTRAL, 0);
    centralRecord.writeUInt16LE(20, 4); // version made by
    centralRecord.writeUInt16LE(20, 6); // version needed
    centralRecord.writeUInt16LE(0x0800, 8); // flags: UTF-8
    centralRecord.writeUInt16LE(method, 10);
    centralRecord.writeUInt16LE(DOS_TIME, 12);
    centralRecord.writeUInt16LE(DOS_DATE, 14);
    centralRecord.writeUInt32LE(crc, 16);
    centralRecord.writeUInt32LE(fileData.length, 20);
    centralRecord.writeUInt32LE(entry.data.length, 24);
    centralRecord.writeUInt16LE(filenameBuf.length, 28);
    centralRecord.writeUInt16LE(0, 30); // extra
    centralRecord.writeUInt16LE(0, 32); // comment
    centralRecord.writeUInt16LE(0, 34); // disk start
    centralRecord.writeUInt16LE(0, 36); // internal attr
    centralRecord.writeUInt32LE(0, 38); // external attr
    centralRecord.writeUInt32LE(offset, 42); // local header offset
    centralRecords.push(centralRecord, filenameBuf);

    offset += localHeader.length + filenameBuf.length + fileData.length;
  }

  // EOCD (22 bytes)
  const centralSize = centralRecords.reduce((sum, b) => sum + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central dir
  eocd.writeUInt16LE(entries.length, 8); // entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...chunks, ...centralRecords, eocd]);
}

/** ZIP 条目（解包用） */
export interface UnzippedEntry {
  filename: string;
  data: Buffer;
}

/**
 * 解压 ZIP Buffer 到条目列表。
 *
 * 安全（AGENTS.md §9.4）：
 *   - zip 炸弹防护：条目数上限 + 解压比上限
 *   - 路径逃逸防护：文件名不包含 ../ 或绝对路径
 */
export function unpackZip(zipBuf: Buffer, options?: {
  maxEntries?: number;
  maxRatio?: number;
}): UnzippedEntry[] {
  const maxEntries = options?.maxEntries ?? ZIP_BOMB_MAX_ENTRIES;
  const maxRatio = options?.maxRatio ?? ZIP_BOMB_MAX_RATIO;

  // 查找 EOCD
  const eocdOffset = findEocd(zipBuf);
  if (eocdOffset < 0) throw new Error("invalid zip: EOCD not found");

  const totalEntries = zipBuf.readUInt16LE(eocdOffset + 10);
  if (totalEntries > maxEntries) throw new ZipBombError(`entries exceed limit: ${totalEntries}`);

  const centralSize = zipBuf.readUInt32LE(eocdOffset + 12);
  const centralOffset = zipBuf.readUInt32LE(eocdOffset + 16);

  let totalUncompressed = 0;
  let totalCompressed = 0;
  const entries: UnzippedEntry[] = [];

  let pos = centralOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (zipBuf.readUInt32LE(pos) !== SIG_CENTRAL) throw new Error("invalid zip: bad central signature");

    const method = zipBuf.readUInt16LE(pos + 10);
    const crc = zipBuf.readUInt32LE(pos + 16);
    const compressedSize = zipBuf.readUInt32LE(pos + 20);
    const uncompressedSize = zipBuf.readUInt32LE(pos + 24);
    const filenameLen = zipBuf.readUInt16LE(pos + 28);
    const extraLen = zipBuf.readUInt16LE(pos + 30);
    const commentLen = zipBuf.readUInt16LE(pos + 32);
    const localOffset = zipBuf.readUInt32LE(pos + 42);

    const filename = zipBuf.toString("utf8", pos + 46, pos + 46 + filenameLen);

    // 路径逃逸防护
    if (filename.includes("..") || path.isAbsolute(filename)) {
      throw new PathTraversalError(`unsafe path: ${filename}`);
    }

    // 读取 local header 获取实际数据偏移
    const localFilenameLen = zipBuf.readUInt16LE(localOffset + 26);
    const localExtraLen = zipBuf.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localFilenameLen + localExtraLen;
    const fileData = zipBuf.subarray(dataOffset, dataOffset + compressedSize);

    let rawData: Buffer;
    if (method === METHOD_STORE) {
      rawData = fileData;
    } else if (method === METHOD_DEFLATE) {
      rawData = inflateRawSync(fileData);
    } else {
      throw new Error(`unsupported compression method: ${method}`);
    }

    if (rawData.length !== uncompressedSize) throw new Error("size mismatch");
    if (crc32(rawData) !== crc) throw new Error("crc mismatch");

    totalUncompressed += uncompressedSize;
    totalCompressed += compressedSize;

    entries.push({ filename, data: rawData });
    pos += 46 + filenameLen + extraLen + commentLen;
  }

  // zip 炸弹：解压比检查
  if (totalCompressed > 0 && totalUncompressed / totalCompressed > maxRatio) {
    throw new ZipBombError(`compression ratio exceeds limit: ${totalUncompressed}/${totalCompressed}`);
  }

  return entries;
}

function findEocd(buf: Buffer): number {
  // EOCD 最小 22 字节，comment 最多 65535 字节
  const minPos = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  return -1;
}

/** 解压 ZIP 到目录 */
export function unpackToDirectory(zipBuf: Buffer, destDir: string, options?: {
  maxEntries?: number;
  maxRatio?: number;
}): void {
  const entries = unpackZip(zipBuf, options);
  mkdirSync(destDir, { recursive: true });
  for (const entry of entries) {
    const targetPath = path.join(destDir, entry.filename);
    // 再次校验路径不逃逸
    const resolved = path.resolve(targetPath);
    const destResolved = path.resolve(destDir);
    if (!resolved.startsWith(destResolved + path.sep) && resolved !== destResolved) {
      throw new PathTraversalError(`path escapes target: ${entry.filename}`);
    }
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, entry.data);
  }
}

/** 计算目录内容的 SHA-256（manifest.json + data/ + storage/ 全部文件，按相对路径排序） */
export function computeDirectoryHash(dir: string): string {
  const files = collectFiles(dir, dir).sort((a, b) => a.filename.localeCompare(b.filename));
  const hash = createHash("sha256");
  for (const f of files) {
    hash.update(f.filename);
    hash.update(f.data);
  }
  return hash.digest("hex");
}

/** 自定义错误类 */
export class ZipBombError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipBombError";
  }
}

export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathTraversalError";
  }
}
