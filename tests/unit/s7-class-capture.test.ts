import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createGlobalDb } from "../../src/data/global";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import { S7Context } from "../../src/agent-host/handlers/s7/context";
import { createS7Handlers } from "../../src/agent-host/handlers/s7";
import { findSemesterByCourseId } from "../../src/agent-host/handlers/s7/lookup";
import {
  createMockWhisperAdapter,
  createFailingWhisperAdapter,
} from "../../src/agent-host/handlers/s7/whisper-adapter";
import type { RpcError, Material } from "../../src/contract/types";

/**
 * T-M2-003 S7 classCapture handler 单件测试（06-API §3.9 + 07-WF §2.7 + 08-Test §3.3.2）
 *
 * handler×S7Context 单件：
 *   - transcribe：许可 false→BAD_REQUEST / WAV 验证失败→BAD_REQUEST / adapter 失败→INTERNAL_ERROR /
 *     成功返回 { transcription } / 原始音频 finally 清理 / 错误响应不泄漏路径
 *   - saveTranscription：创建 material + normalized_text + study_event / content_hash 一致 / DTO 字段对齐 / courseId 不存在→NOT_FOUND
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M2-003\unit-handler。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-003\\unit-handler";

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

describe("T-M2-003 S7 classCapture handler 单件测试", () => {
  let s1Ctx: S1Context;
  let s1Handlers: ReturnType<typeof createS1Handlers>;
  let s7Ctx: S7Context;
  let handlers: ReturnType<typeof createS7Handlers>;
  let semesterId: string;
  let courseId: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    s1Ctx = new S1Context(ISOLATION_DIR);
    s1Handlers = createS1Handlers(s1Ctx);

    // 建学期 + 课程
    const sem = s1Handlers["semesters.create"]({
      label: "S7测试学期",
      startDate: "2026-02-01",
      endDate: "2026-07-01",
      timezone: "Asia/Shanghai",
    }) as { id: string };
    semesterId = sem.id;
    const course = s1Handlers["courses.create"]({
      semesterId,
      courseName: "S7测试课程",
      subject: "数学",
    }) as { id: string };
    courseId = course.id;

    s7Ctx = new S7Context(ISOLATION_DIR, {
      whisperAdapter: createMockWhisperAdapter(),
      tmpRoot: join(ISOLATION_DIR, "tmp", "class-capture"),
    });
    handlers = createS7Handlers(s7Ctx);
  });

  afterAll(() => {
    s7Ctx.dispose();
    s1Ctx.dispose();
  });

  async function callAsync<M extends keyof typeof handlers>(method: M, params: unknown): Promise<unknown> {
    return await (handlers[method] as (p: unknown) => Promise<unknown> | unknown)(params);
  }

  function call<M extends keyof typeof handlers>(method: M, params: unknown): unknown {
    return (handlers[method] as (p: unknown) => unknown)(params);
  }

  describe("classCapture.transcribe", () => {
    it("permissionConfirmed=false → BAD_REQUEST + '许可确认'", async () => {
      try {
        await callAsync("classCapture.transcribe", {
          courseId,
          audioFile: { name: "test.wav", size: 44, mime: "audio/wav", path: join(ISOLATION_DIR, "test.wav") },
          permissionConfirmed: false,
        });
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("BAD_REQUEST");
        expect(err.message).toContain("许可确认");
      }
    });

    it("permissionConfirmed=true + 合法 WAV + mock adapter 成功 → 返回 { transcription }", async () => {
      const file = join(ISOLATION_DIR, "valid.wav");
      writeFileSync(file, buildValidPcmWavHeader());
      const result = await callAsync("classCapture.transcribe", {
        courseId,
        audioFile: { name: "valid.wav", size: 44, mime: "audio/wav", path: file },
        permissionConfirmed: true,
      }) as { transcription: string };
      expect(typeof result.transcription).toBe("string");
      expect(result.transcription.length).toBeGreaterThan(0);
    });

    it("WAV 验证失败（MP3）→ BAD_REQUEST + 'PCM WAV'（错误消息不含路径）", async () => {
      const file = join(ISOLATION_DIR, "mp3.wav");
      const buf = Buffer.alloc(44, 0);
      buf.write("ID3", 0, 3, "ascii");
      writeFileSync(file, buf);
      try {
        await callAsync("classCapture.transcribe", {
          courseId,
          audioFile: { name: "mp3.wav", size: 44, mime: "audio/wav", path: file },
          permissionConfirmed: true,
        });
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("BAD_REQUEST");
        expect(err.message).toContain("PCM WAV");
        // 错误消息不含文件路径
        expect(err.message).not.toContain(file);
        expect(err.message).not.toContain(ISOLATION_DIR);
      }
    });

    it("mock adapter 抛错 → INTERNAL_ERROR + '转写失败'（错误消息不含 stdout/stderr）", async () => {
      const file = join(ISOLATION_DIR, "fail.wav");
      writeFileSync(file, buildValidPcmWavHeader());
      // 重新构造一个用 failing adapter 的 ctx
      const failingCtx = new S7Context(ISOLATION_DIR, {
        whisperAdapter: createFailingWhisperAdapter(),
        tmpRoot: join(ISOLATION_DIR, "tmp", "class-capture-fail"),
      });
      const failingHandlers = createS7Handlers(failingCtx);
      try {
        await (failingHandlers["classCapture.transcribe"] as (p: unknown) => Promise<unknown>)({
          courseId,
          audioFile: { name: "fail.wav", size: 44, mime: "audio/wav", path: file },
          permissionConfirmed: true,
        });
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.message).toContain("转写失败");
        expect(err.message).not.toContain("stdout");
        expect(err.message).not.toContain("stderr");
      } finally {
        failingCtx.dispose();
      }
    });

    it("成功后 tmp/class-capture/<request-id>/ 目录被清理（finally 断言）", async () => {
      const file = join(ISOLATION_DIR, "cleanup-success.wav");
      writeFileSync(file, buildValidPcmWavHeader());
      const tmpRoot = join(ISOLATION_DIR, "tmp", "class-capture-cleanup-success");
      const ctx = new S7Context(ISOLATION_DIR, {
        whisperAdapter: createMockWhisperAdapter(),
        tmpRoot,
      });
      const h = createS7Handlers(ctx);
      try {
        await (h["classCapture.transcribe"] as (p: unknown) => Promise<unknown>)({
          courseId,
          audioFile: { name: "cleanup.wav", size: 44, mime: "audio/wav", path: file },
          permissionConfirmed: true,
        });
        // 验证 tmpRoot 下所有 request-id 目录已被清理
        if (existsSync(tmpRoot)) {
          const entries = readdirSync(tmpRoot);
          expect(entries.length).toBe(0);
        }
        // tmpRoot 自身可能存在（空目录），但其下不应有 request-id 目录
      } finally {
        ctx.dispose();
      }
    });

    it("失败后 tmp/class-capture/<request-id>/ 目录也被清理（finally 断言）", async () => {
      const file = join(ISOLATION_DIR, "cleanup-fail.wav");
      writeFileSync(file, buildValidPcmWavHeader());
      const tmpRoot = join(ISOLATION_DIR, "tmp", "class-capture-cleanup-fail");
      const ctx = new S7Context(ISOLATION_DIR, {
        whisperAdapter: createFailingWhisperAdapter(),
        tmpRoot,
      });
      const h = createS7Handlers(ctx);
      try {
        await (h["classCapture.transcribe"] as (p: unknown) => Promise<unknown>)({
          courseId,
          audioFile: { name: "cleanup.wav", size: 44, mime: "audio/wav", path: file },
          permissionConfirmed: true,
        });
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
      } finally {
        // 即使失败，tmp 目录也应清理
        if (existsSync(tmpRoot)) {
          const entries = readdirSync(tmpRoot);
          expect(entries.length).toBe(0);
        }
        ctx.dispose();
      }
    });

    it("错误响应不包含 audioFilePath / cliPath / modelPath / stdout / stderr（安全断言）", async () => {
      const file = join(ISOLATION_DIR, "leak.wav");
      writeFileSync(file, buildValidPcmWavHeader());
      const ctx = new S7Context(ISOLATION_DIR, {
        whisperAdapter: createFailingWhisperAdapter(),
        whisperCliPath: "/secret/whisper-cli",
        whisperModelPath: "/secret/model.bin",
        tmpRoot: join(ISOLATION_DIR, "tmp", "class-capture-leak"),
      });
      const h = createS7Handlers(ctx);
      try {
        await (h["classCapture.transcribe"] as (p: unknown) => Promise<unknown>)({
          courseId,
          audioFile: { name: "leak.wav", size: 44, mime: "audio/wav", path: file },
          permissionConfirmed: true,
        });
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        const err = e as RpcError;
        expect(err.message).not.toContain("/secret/whisper-cli");
        expect(err.message).not.toContain("/secret/model.bin");
        expect(err.message).not.toContain(file);
        expect(err.message).not.toContain(ISOLATION_DIR);
        expect(err.message).not.toContain("stdout");
        expect(err.message).not.toContain("stderr");
      } finally {
        ctx.dispose();
      }
    });
  });

  describe("classCapture.saveTranscription", () => {
    it("成功创建 material（file_type='text' / source_type='class_audio_transcription' / status='converted' / permission_confirmed=1）", () => {
      const result = call("classCapture.saveTranscription", {
        courseId,
        transcription: "这是测试转写文本。",
        title: "课堂笔记-数学-20260807",
      }) as Material;

      expect(result.fileType).toBe("text");
      expect(result.sourceType).toBe("class_audio_transcription");
      expect(result.status).toBe("converted");
      expect(result.permissionConfirmed).toBe(1);
      expect(result.fileName).toBe("课堂笔记-数学-20260807");
      expect(result.mimeType).toBe("text/plain");
      expect(result.courseId).toBe(courseId);
    });

    it("成功创建 normalized_text（content_hash=SHA-256 / char_count / source_type='class_audio_transcription'）", () => {
      const transcription = "这是测试转写文本2。";
      const result = call("classCapture.saveTranscription", {
        courseId,
        transcription,
        title: "笔记2",
      }) as Material;

      // 查库验证 normalized_text
      const { db } = findSemesterByCourseId(s7Ctx, courseId);
      const ntRow = db
        .prepare("SELECT * FROM normalized_texts WHERE material_id = @mid")
        .get({ mid: result.id }) as Record<string, unknown>;
      expect(ntRow).toBeDefined();
      expect(ntRow.content).toBe(transcription);
      // content_hash = SHA-256(transcription) hex
      const expectedHash = createHash("sha256")
        .update(transcription)
        .digest("hex");
      expect(ntRow.content_hash).toBe(expectedHash);
      expect(ntRow.char_count).toBe(transcription.length);
      expect(ntRow.source_type).toBe("class_audio_transcription");
    });

    it("成功创建 study_event（event_type='class_handoff_saved' / source_system='S7' / source_ref_id=material_id）", () => {
      const result = call("classCapture.saveTranscription", {
        courseId,
        transcription: "这是测试转写文本3。",
        title: "笔记3",
      }) as Material;

      const { db } = findSemesterByCourseId(s7Ctx, courseId);
      const evRow = db
        .prepare("SELECT * FROM study_events WHERE source_ref_id = @mid AND source_system = 'S7'")
        .get({ mid: result.id }) as Record<string, unknown>;
      expect(evRow).toBeDefined();
      expect(evRow.event_type).toBe("class_handoff_saved");
      expect(evRow.source_system).toBe("S7");
      expect(evRow.course_instance_id).toBe(courseId);
    });

    it("返回 Material DTO 字段对齐 ERD（13 字段）", () => {
      const result = call("classCapture.saveTranscription", {
        courseId,
        transcription: "字段对齐测试。",
        title: "笔记4",
      }) as Material;

      // 13 字段断言
      expect(typeof result.id).toBe("string");
      expect(result.courseId).toBe(courseId);
      expect(typeof result.fileName).toBe("string");
      expect(result.fileType).toBe("text");
      expect(typeof result.fileSizeBytes).toBe("number");
      expect(result.mimeType).toBe("text/plain");
      expect(typeof result.storageKey).toBe("string");
      expect(result.sourceType).toBe("class_audio_transcription");
      expect(result.status).toBe("converted");
      expect(result.permissionConfirmed).toBe(1);
      expect(typeof result.uploadedAt).toBe("string");
      expect(result.convertedAt).toBeDefined();
      expect(typeof result.createdAt).toBe("string");
      expect(typeof result.updatedAt).toBe("string");
    });

    it("courseId 不存在 → NOT_FOUND", () => {
      try {
        call("classCapture.saveTranscription", {
          courseId: "nonexistent-course-id",
          transcription: "测试。",
          title: "笔记",
        });
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("NOT_FOUND");
      }
    });

    it("transcription 空字符串 → BAD_REQUEST", () => {
      try {
        call("classCapture.saveTranscription", {
          courseId,
          transcription: "",
          title: "笔记",
        });
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });

    it("title 空 → BAD_REQUEST", () => {
      try {
        call("classCapture.saveTranscription", {
          courseId,
          transcription: "测试。",
          title: "",
        });
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });
  });
});
