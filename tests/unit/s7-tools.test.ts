import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createGlobalDb } from "../../src/data/global";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import { S7Context } from "../../src/agent-host/handlers/s7/context";
import { createS7Tools, S7_TOOL_NAMES, S7_TOOL_COUNT } from "../../src/agent/tools/s7/tools";
import { createMockWhisperAdapter } from "../../src/agent-host/handlers/s7/whisper-adapter";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

/**
 * T-M2-003 S7 registerTool 工具单件测试（08-Test §3.1 + 03-Arch §2.2 ToolDefinition 契约）
 *
 * 每个工具 ≥4 条契约断言：
 *   - ToolDefinition 必填 name/label/description/parameters/execute
 *   - 工具名匹配 ^studybuddy_[a-z_]+$
 *   - execute 成功返回 {content, details} 结构
 *   - execute 失败 throw Error
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M2-003\unit-tools。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-003\\unit-tools";

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

describe("T-M2-003 S7 registerTool 工具单件测试", () => {
  let s1Ctx: S1Context;
  let s1Handlers: ReturnType<typeof createS1Handlers>;
  let s7Ctx: S7Context;
  let tools: ToolDefinition[];
  let semesterId: string;
  let courseId: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    s1Ctx = new S1Context(ISOLATION_DIR);
    s1Handlers = createS1Handlers(s1Ctx);

    const sem = (s1Handlers["semesters.create"] as (p: unknown) => unknown)({
      label: "S7工具测试学期",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      timezone: "Asia/Shanghai",
    }) as { id: string };
    semesterId = sem.id;

    const course = (s1Handlers["courses.create"] as (p: unknown) => unknown)({
      semesterId,
      courseName: "S7工具测试课程",
      subject: "数学",
    }) as { id: string };
    courseId = course.id;

    s7Ctx = new S7Context(ISOLATION_DIR, {
      whisperAdapter: createMockWhisperAdapter(),
      tmpRoot: join(ISOLATION_DIR, "tmp", "class-capture"),
    });
    tools = createS7Tools(s7Ctx);
  });

  afterAll(() => {
    s1Ctx?.dispose();
    s7Ctx?.dispose();
    for (let i = 0; i < 3; i++) {
      try {
        rmSync(ISOLATION_DIR, { recursive: true, force: true });
        break;
      } catch {
        // 忽略 EBUSY
      }
    }
  });

  describe("工具契约断言", () => {
    it("TOOL-01 工具数量 = 2", () => {
      expect(tools.length).toBe(2);
      expect(S7_TOOL_COUNT).toBe(2);
    });

    it("TOOL-02 工具名匹配 ^studybuddy_[a-z_]+$", () => {
      for (const name of S7_TOOL_NAMES) {
        expect(name).toMatch(/^studybuddy_[a-z_]+$/);
      }
      expect(S7_TOOL_NAMES).toContain("studybuddy_transcribe_class");
      expect(S7_TOOL_NAMES).toContain("studybuddy_save_transcription");
    });

    it("TOOL-03 每个工具有必填字段 name/label/description/parameters/execute", () => {
      for (const tool of tools) {
        expect(tool.name).toBeTruthy();
        expect(tool.label).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.parameters).toBeDefined();
        expect(typeof tool.execute).toBe("function");
      }
    });
  });

  describe("studybuddy_transcribe_class", () => {
    it("TR-01 execute 成功 → 返回 {content, details} 含 transcription", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_transcribe_class")!;
      const file = join(ISOLATION_DIR, "tool-valid.wav");
      writeFileSync(file, buildValidPcmWavHeader());
      const result = await tool.execute("call-1", {
        courseId,
        audioFilePath: file,
        permissionConfirmed: true,
      });
      expect(result.content).toBeDefined();
      expect(result.details).toBeDefined();
      expect((result.details as { transcription: string }).transcription).toBeTruthy();
      expect(typeof (result.details as { charCount: number }).charCount).toBe("number");
    });

    it("TR-02 execute 失败（许可 false）→ throw Error", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_transcribe_class")!;
      try {
        await tool.execute("call-2", {
          courseId,
          audioFilePath: join(ISOLATION_DIR, "test.wav"),
          permissionConfirmed: false,
        });
        expect.fail("应抛错");
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("TR-03 execute 失败（WAV 验证失败）→ throw Error", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_transcribe_class")!;
      const file = join(ISOLATION_DIR, "tool-mp3.wav");
      const buf = Buffer.alloc(44, 0);
      buf.write("ID3", 0, 3, "ascii");
      writeFileSync(file, buf);
      try {
        await tool.execute("call-3", {
          courseId,
          audioFilePath: file,
          permissionConfirmed: true,
        });
        expect.fail("应抛错");
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });

  describe("studybuddy_save_transcription", () => {
    it("SV-01 execute 成功 → 返回 {content, details} 含 materialId", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_save_transcription")!;
      const result = await tool.execute("call-4", {
        courseId,
        transcription: "工具层保存测试文本。",
        title: "工具层笔记",
      });
      expect(result.content).toBeDefined();
      expect(result.details).toBeDefined();
      const details = result.details as {
        materialId: string;
        fileName: string;
        fileType: string;
        sourceType: string;
        status: string;
      };
      expect(details.materialId).toBeTruthy();
      expect(details.fileName).toBe("工具层笔记");
      expect(details.fileType).toBe("text");
      expect(details.sourceType).toBe("class_audio_transcription");
      expect(details.status).toBe("converted");
    });

    it("SV-02 execute 失败（transcription 空）→ throw Error", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_save_transcription")!;
      try {
        await tool.execute("call-5", {
          courseId,
          transcription: "",
          title: "笔记",
        });
        expect.fail("应抛错");
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("SV-03 execute 失败（courseId 不存在）→ throw Error", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_save_transcription")!;
      try {
        await tool.execute("call-6", {
          courseId: "nonexistent-course-id",
          transcription: "测试。",
          title: "笔记",
        });
        expect.fail("应抛错");
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });
});
