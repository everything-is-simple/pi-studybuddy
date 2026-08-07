import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createGlobalDb } from "../../src/data/global";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import {
  S7Context,
  createS7Handlers,
} from "../../src/agent-host/handlers/s7";
import { createMockWhisperAdapter } from "../../src/agent-host/handlers/s7/whisper-adapter";
import { findSemesterByCourseId } from "../../src/agent-host/handlers/s7/lookup";
import type { RpcError, Material } from "../../src/contract/types";

/**
 * T-M2-003 S7 课堂采集 handler 集成测试（06-API §3.9 + 07-WF §2.7 + 05-ERD §3.2.1/§3.2.2/§3.1.5）
 *
 * 在隔离目录落地真实 SQLite，验证 handler×global.db/semester.db 真实读写：
 *   - classCapture.transcribe：许可 + WAV + mock adapter + finally 清理
 *   - classCapture.saveTranscription：跨库 handoff 到 S2（materials + normalized_texts + study_events）
 *   - 跨学期隔离：semester-A 的 handoff 不出现在 semester-B 的库中
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M2-003\integration。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-003\\integration";

function isRpcError(e: unknown): e is RpcError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e
  );
}

/** 构造合法 PCM WAV 44 字节头部 */
function buildValidPcmWavHeader(): Buffer {
  const buf = Buffer.alloc(44, 0);
  buf.write("RIFF", 0, 4, "ascii");
  buf.writeUInt32LE(36, 4);
  buf.write("WAVE", 8, 4, "ascii");
  buf.write("fmt ", 12, 4, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(16000, 24);
  buf.writeUInt32LE(32000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, 4, "ascii");
  buf.writeUInt32LE(0, 40);
  return buf;
}

describe("T-M2-003 S7 课堂采集 handler 集成测试", () => {
  let s1Ctx: S1Context;
  let s1Handlers: ReturnType<typeof createS1Handlers>;
  let s7Ctx: S7Context;
  let handlers: ReturnType<typeof createS7Handlers>;
  let semesterId: string;
  let courseId: string;
  let semesterIdB: string;
  let courseIdB: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    s1Ctx = new S1Context(ISOLATION_DIR);
    s1Handlers = createS1Handlers(s1Ctx);

    // 学期 A + 课程 A
    const semA = s1Handlers["semesters.create"]({
      label: "S7集成测试学期A",
      startDate: "2026-02-01",
      endDate: "2026-07-01",
      timezone: "Asia/Shanghai",
    }) as { id: string };
    semesterId = semA.id;
    const courseA = s1Handlers["courses.create"]({
      semesterId,
      courseName: "S7集成测试课程A",
      subject: "数学",
    }) as { id: string };
    courseId = courseA.id;

    // 学期 B + 课程 B（用于跨学期隔离验证）
    const semB = s1Handlers["semesters.create"]({
      label: "S7集成测试学期B",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      timezone: "Asia/Shanghai",
    }) as { id: string };
    semesterIdB = semB.id;
    const courseB = s1Handlers["courses.create"]({
      semesterId: semesterIdB,
      courseName: "S7集成测试课程B",
      subject: "语文",
    }) as { id: string };
    courseIdB = courseB.id;

    s7Ctx = new S7Context(ISOLATION_DIR, {
      whisperAdapter: createMockWhisperAdapter(),
      tmpRoot: join(ISOLATION_DIR, "tmp", "class-capture"),
    });
    handlers = createS7Handlers(s7Ctx);
  });

  afterAll(() => {
    s7Ctx?.dispose();
    s1Ctx?.dispose();
    for (let i = 0; i < 3; i++) {
      try {
        rmSync(ISOLATION_DIR, { recursive: true, force: true });
        break;
      } catch {
        // 忽略 EBUSY
      }
    }
  });

  function call<M extends keyof typeof handlers>(method: M, params: unknown): unknown {
    return (handlers[method] as (p: unknown) => unknown)(params);
  }

  async function callAsync<M extends keyof typeof handlers>(method: M, params: unknown): Promise<unknown> {
    return await (handlers[method] as (p: unknown) => Promise<unknown> | unknown)(params);
  }

  describe("classCapture.transcribe 集成", () => {
    it("TR-01 许可确认 + 合法 WAV + mock adapter → 返回 transcription", async () => {
      const file = join(ISOLATION_DIR, "integration-valid.wav");
      writeFileSync(file, buildValidPcmWavHeader());
      const result = await callAsync("classCapture.transcribe", {
        courseId,
        audioFile: { name: "valid.wav", size: 44, mime: "audio/wav", path: file },
        permissionConfirmed: true,
      }) as { transcription: string };
      expect(typeof result.transcription).toBe("string");
      expect(result.transcription.length).toBeGreaterThan(0);
    });

    it("TR-02 许可 false → BAD_REQUEST（集成层验证完整路径）", async () => {
      try {
        await callAsync("classCapture.transcribe", {
          courseId,
          audioFile: { name: "test.wav", size: 44, mime: "audio/wav", path: join(ISOLATION_DIR, "test.wav") },
          permissionConfirmed: false,
        });
        throw new Error("应抛异常但未抛");
      } catch (e) {
        expect(isRpcError(e)).toBe(true);
        expect((e as RpcError).code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("classCapture.saveTranscription 跨库 handoff", () => {
    it("HO-01 saveTranscription → materials 行存在 + 字段值正确", () => {
      const result = call("classCapture.saveTranscription", {
        courseId,
        transcription: "集成测试 handoff 文本 A。",
        title: "课堂笔记-集成-A",
      }) as Material;

      const { db } = findSemesterByCourseId(s7Ctx, courseId);
      const row = db
        .prepare("SELECT * FROM materials WHERE id = @id")
        .get({ id: result.id }) as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row.file_type).toBe("text");
      expect(row.source_type).toBe("class_audio_transcription");
      expect(row.status).toBe("converted");
      expect(row.permission_confirmed).toBe(1);
      expect(row.mime_type).toBe("text/plain");
      expect(row.file_name).toBe("课堂笔记-集成-A");
      expect(row.course_instance_id).toBe(courseId);
    });

    it("HO-02 同上 → normalized_texts 行存在 + content_hash 一致 + UNIQUE(material_id)", () => {
      const transcription = "集成测试 handoff 文本 B。";
      const result = call("classCapture.saveTranscription", {
        courseId,
        transcription,
        title: "笔记-B",
      }) as Material;

      const { db } = findSemesterByCourseId(s7Ctx, courseId);
      const ntRow = db
        .prepare("SELECT * FROM normalized_texts WHERE material_id = @mid")
        .get({ mid: result.id }) as Record<string, unknown>;
      expect(ntRow).toBeDefined();
      expect(ntRow.content).toBe(transcription);
      const expectedHash = createHash("sha256").update(transcription).digest("hex");
      expect(ntRow.content_hash).toBe(expectedHash);
      expect(ntRow.char_count).toBe(transcription.length);
      expect(ntRow.source_type).toBe("class_audio_transcription");

      // UNIQUE(material_id)：再插一条同 material_id 应失败
      let uniqueViolated = false;
      try {
        db.prepare(
          "INSERT INTO normalized_texts (id, material_id, content, content_hash, char_count, source_type, created_at) VALUES (@id, @mid, @c, @h, @cc, @st, @ts)",
        ).run({
          id: "dup-id",
          mid: result.id,
          c: "dup",
          h: "dup",
          cc: 3,
          st: "class_audio_transcription",
          ts: new Date().toISOString(),
        });
      } catch {
        uniqueViolated = true;
      }
      expect(uniqueViolated).toBe(true);
    });

    it("HO-03 同上 → study_events 行存在 + source_system='S7' + course_instance_id 关联", () => {
      const result = call("classCapture.saveTranscription", {
        courseId,
        transcription: "集成测试 handoff 文本 C。",
        title: "笔记-C",
      }) as Material;

      const { db } = findSemesterByCourseId(s7Ctx, courseId);
      const evRow = db
        .prepare("SELECT * FROM study_events WHERE source_ref_id = @mid AND source_system = 'S7'")
        .get({ mid: result.id }) as Record<string, unknown>;
      expect(evRow).toBeDefined();
      expect(evRow.event_type).toBe("class_handoff_saved");
      expect(evRow.source_system).toBe("S7");
      expect(evRow.course_instance_id).toBe(courseId);
      expect(evRow.semester_id).toBe(semesterId);
    });

    it("HO-04 返回 Material DTO 与 DB 行一致", () => {
      const result = call("classCapture.saveTranscription", {
        courseId,
        transcription: "DTO 一致性测试。",
        title: "笔记-DTO",
      }) as Material;

      const { db } = findSemesterByCourseId(s7Ctx, courseId);
      const row = db
        .prepare("SELECT * FROM materials WHERE id = @id")
        .get({ id: result.id }) as Record<string, unknown>;
      expect(result.id).toBe(row.id);
      expect(result.courseId).toBe(row.course_instance_id);
      expect(result.fileName).toBe(row.file_name);
      expect(result.fileType).toBe(row.file_type);
      expect(result.sourceType).toBe(row.source_type);
      expect(result.status).toBe(row.status);
      expect(result.permissionConfirmed).toBe(row.permission_confirmed);
    });

    it("HO-05 跨学期隔离：semester-A 的 handoff 不出现在 semester-B 的库中", () => {
      // 在学期 A 创建 handoff
      const resultA = call("classCapture.saveTranscription", {
        courseId,
        transcription: "学期 A 的 handoff 文本。",
        title: "笔记-A",
      }) as Material;

      // 在学期 B 的库中查询该 material_id，应不存在
      const dbB = s7Ctx.semesterDb(semesterIdB);
      const rowInB = dbB
        .prepare("SELECT 1 FROM materials WHERE id = @id")
        .get({ id: resultA.id });
      expect(rowInB).toBeUndefined();

      // 学期 B 的事件中也不应有该 material_id
      const evInB = dbB
        .prepare("SELECT 1 FROM study_events WHERE source_ref_id = @id AND source_system = 'S7'")
        .get({ id: resultA.id });
      expect(evInB).toBeUndefined();
    });

    it("HO-06 courseId 不存在 → NOT_FOUND", () => {
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

    it("HO-07 跨学期 handoff：学期 B 的课程也能正常 handoff", () => {
      const result = call("classCapture.saveTranscription", {
        courseId: courseIdB,
        transcription: "学期 B 的 handoff 文本。",
        title: "笔记-B学期",
      }) as Material;

      const { db, semesterId: sidB } = findSemesterByCourseId(s7Ctx, courseIdB);
      expect(sidB).toBe(semesterIdB);

      const row = db
        .prepare("SELECT * FROM materials WHERE id = @id")
        .get({ id: result.id }) as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row.course_instance_id).toBe(courseIdB);
    });
  });
});
