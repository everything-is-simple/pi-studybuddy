import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { createGlobalDb } from "../../src/data/global";
import { S2Context } from "../../src/agent-host/handlers/s2/context";
import { S1Context } from "../../src/agent-host/handlers/s1/context";
import { createS1Handlers } from "../../src/agent-host/handlers/s1";
import { createS2Tools, S2_TOOL_NAMES, S2_TOOL_COUNT } from "../../src/agent/tools/s2/tools";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { stageTestMaterial } from "../helpers/material-import";

/**
 * T-M1-002 S2 registerTool 工具单件测试（08-Test §3.1 + 03-Arch §2.2 ToolDefinition 契约）
 *
 * 每个工具 ≥4 条契约断言（08-Test §3.1）：
 *   - registerTool 返回 void
 *   - ToolDefinition 必填 name/label/description/parameters/execute
 *   - execute 成功返回 {content, details} 结构
 *   - execute 失败 throw Error
 *
 * 工具名匹配 ^studybuddy_[a-z_]+$（03-Arch §2.2）
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-002\。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-002\\unit-tools";

function stagedFile(fileName: string, content = "upload test") {
  return stageTestMaterial(ISOLATION_DIR, `${ISOLATION_DIR}\\fixtures`, fileName, "application/pdf", content);
}

describe("T-M1-002 S2 registerTool 工具单件测试", () => {
  let ctx: S2Context;
  let s1Ctx: S1Context;
  let tools: ToolDefinition[];
  let semesterId: string;
  let courseId: string;
  const STORAGE_DIR = `${ISOLATION_DIR}\\semester\\__s2_tools_sem__\\storage`;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    ctx = new S2Context(ISOLATION_DIR);
    s1Ctx = new S1Context(ISOLATION_DIR);
    const s1Handlers = createS1Handlers(s1Ctx);
    const sem = (s1Handlers["semesters.create"] as (p: unknown) => unknown)({
      label: "S2工具测试学期",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      timezone: "Asia/Shanghai",
    }) as { id: string };
    semesterId = sem.id;
    const course = (s1Handlers["courses.create"] as (p: unknown) => unknown)({
      semesterId,
      courseName: "工具测试课程",
      subject: "数学",
    }) as { id: string };
    courseId = course.id;
    mkdirSync(STORAGE_DIR, { recursive: true });
    tools = createS2Tools(ctx);
  });

  afterAll(() => {
    ctx?.dispose();
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

  describe("工具集整体契约", () => {
    it("TOOLSET-01 返回 6 个工具（S2_TOOL_COUNT === 6）", () => {
      expect(tools.length).toBe(6);
      expect(S2_TOOL_COUNT).toBe(6);
    });

    it("TOOLSET-02 工具名清单与 S2_TOOL_NAMES 一致", () => {
      const names = tools.map((t) => t.name);
      expect(names).toEqual([...S2_TOOL_NAMES]);
    });

    it("TOOLSET-03 所有工具名匹配 ^studybuddy_[a-z_]+$", () => {
      for (const name of S2_TOOL_NAMES) {
        expect(name).toMatch(/^studybuddy_[a-z_]+$/);
      }
    });

    it("TOOLSET-04 所有工具有唯一 name（无重复）", () => {
      const names = tools.map((t) => t.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it("TOOLSET-05 所有工具 ToolDefinition 必填字段齐全（name/label/description/parameters/execute）", () => {
      for (const tool of tools) {
        expect(typeof tool.name).toBe("string");
        expect(tool.name.length).toBeGreaterThan(0);
        expect(typeof tool.label).toBe("string");
        expect(tool.label.length).toBeGreaterThan(0);
        expect(typeof tool.description).toBe("string");
        expect(tool.description.length).toBeGreaterThan(0);
        expect(tool.parameters).toBeDefined();
        expect(typeof tool.execute).toBe("function");
      }
    });
  });

  describe("studybuddy_upload_material", () => {
    const tool = () => tools.find((t) => t.name === "studybuddy_upload_material")!;

    it("UP-01 label/description/promptSnippet 非空", () => {
      expect(tool().label).toBe("上传资料");
      expect(tool().description).toContain("资料");
      expect(tool().promptSnippet).toBeTruthy();
    });

    it("UP-02 execute 成功返回 {content, details}", async () => {
      const result = await tool().execute("call-1", {
        courseId,
        file: stagedFile("up-test.pdf"),
      });
      expect(result.content).toBeInstanceOf(Array);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.details).toBeDefined();
      expect(result.details).toHaveProperty("materialId");
    });

    it("UP-03 execute 失败 throw Error（非法 courseId）", async () => {
      await expect(
        tool().execute("call-2", {
          courseId: "nonexistent-course",
          file: { name: "test.pdf", size: 100, mime: "application/pdf" },
        }),
      ).rejects.toThrow();
    });

    it("UP-04 execute 失败 throw Error（路径逃逸）", async () => {
      await expect(
        tool().execute("call-3", {
          courseId,
          file: { name: "../../../etc/passwd", size: 100, mime: "application/pdf" },
        }),
      ).rejects.toThrow();
    });
  });

  describe("studybuddy_convert_material", () => {
    const tool = () => tools.find((t) => t.name === "studybuddy_convert_material")!;

    it("CV-01 label/description/promptSnippet 非空", () => {
      expect(tool().label).toBe("转换资料");
      expect(tool().description).toContain("转换");
      expect(tool().promptSnippet).toBeTruthy();
    });

    it("CV-02 execute 成功返回 {content, details}", async () => {
      // 先上传一个新资料
      const uploadTool = tools.find((t) => t.name === "studybuddy_upload_material")!;
      const uploadResult = await uploadTool.execute("cv-up", {
        courseId,
        file: stagedFile("cv-test.pdf"),
      });
      const materialId = (uploadResult.details as { materialId: string }).materialId;

      const result = await tool().execute("cv-1", { id: materialId });
      expect(result.content).toBeInstanceOf(Array);
      expect(result.details).toBeDefined();
      expect(result.details).toHaveProperty("jobId");
      expect(result.details).toHaveProperty("status");
    });

    it("CV-03 execute 失败 throw Error（不存在 id）", async () => {
      await expect(tool().execute("cv-2", { id: "nonexistent-id" })).rejects.toThrow();
    });
  });

  describe("studybuddy_generate_note", () => {
    const tool = () => tools.find((t) => t.name === "studybuddy_generate_note")!;

    it("GN-01 label/description/promptSnippet 非空", () => {
      expect(tool().label).toBe("生成笔记");
      expect(tool().description).toContain("笔记");
      expect(tool().promptSnippet).toBeTruthy();
    });

    it("GN-02 execute 成功返回 {content, details}", async () => {
      // 先上传 + replaceText 转换（绕过真实转换器）
      const uploadTool = tools.find((t) => t.name === "studybuddy_upload_material")!;
      const uploadResult = await uploadTool.execute("gn-up", {
        courseId,
        file: stagedFile("gn-test.pdf"),
      });
      const materialId = (uploadResult.details as { materialId: string }).materialId;
      const replaceTool = tools.find((t) => t.name === "studybuddy_replace_material_text")!;
      await replaceTool.execute("gn-rep", { id: materialId, text: "测试内容供笔记生成" });

      const result = await tool().execute("gn-1", { id: materialId });
      expect(result.content).toBeInstanceOf(Array);
      expect(result.details).toBeDefined();
      expect(result.details).toHaveProperty("jobId");
    });

    it("GN-03 execute 失败 throw Error（pending 状态拒绝）", async () => {
      const uploadTool = tools.find((t) => t.name === "studybuddy_upload_material")!;
      const uploadResult = await uploadTool.execute("gn-fail", {
        courseId,
        file: stagedFile("gn-fail.pdf"),
      });
      const materialId = (uploadResult.details as { materialId: string }).materialId;
      await expect(tool().execute("gn-2", { id: materialId })).rejects.toThrow();
    });
  });

  describe("studybuddy_replace_material_text", () => {
    const tool = () => tools.find((t) => t.name === "studybuddy_replace_material_text")!;

    it("RT-01 label/description/promptSnippet 非空", () => {
      expect(tool().label).toBe("替换资料文本");
      expect(tool().description).toContain("文本");
      expect(tool().promptSnippet).toBeTruthy();
    });

    it("RT-02 execute 成功返回 {content, details}", async () => {
      const uploadTool = tools.find((t) => t.name === "studybuddy_upload_material")!;
      const uploadResult = await uploadTool.execute("rt-up", {
        courseId,
        file: stagedFile("rt-test.pdf"),
      });
      const materialId = (uploadResult.details as { materialId: string }).materialId;

      const result = await tool().execute("rt-1", { id: materialId, text: "替换后的纯文本" });
      expect(result.content).toBeInstanceOf(Array);
      expect(result.details).toBeDefined();
      expect(result.details).toHaveProperty("materialId");
      expect(result.details).toHaveProperty("status");
    });

    it("RT-03 execute 失败 throw Error（不存在 id）", async () => {
      await expect(tool().execute("rt-2", { id: "nonexistent-id", text: "x" })).rejects.toThrow();
    });
  });

  describe("studybuddy_update_note", () => {
    const tool = () => tools.find((t) => t.name === "studybuddy_update_note")!;

    it("NT-01 label/description/promptSnippet 非空", () => {
      expect(tool().label).toBe("更新笔记");
      expect(tool().description).toContain("笔记");
      expect(tool().promptSnippet).toBeTruthy();
    });

    it("NT-02 execute 成功返回 {content, details}", async () => {
      const uploadTool = tools.find((t) => t.name === "studybuddy_upload_material")!;
      const uploadResult = await uploadTool.execute("nt-up", {
        courseId,
        file: stagedFile("nt-test.pdf"),
      });
      const materialId = (uploadResult.details as { materialId: string }).materialId;

      const result = await tool().execute("nt-1", {
        materialId,
        noteMarkdown: "# 手动笔记",
        highlights: [{ text: "重点" }],
      });
      expect(result.content).toBeInstanceOf(Array);
      expect(result.details).toBeDefined();
      expect(result.details).toHaveProperty("materialId");
    });

    it("NT-03 execute 失败 throw Error（不存在 materialId）", async () => {
      await expect(
        tool().execute("nt-2", {
          materialId: "nonexistent-id",
          noteMarkdown: "x",
        }),
      ).rejects.toThrow();
    });
  });

  describe("studybuddy_update_learn_status", () => {
    const tool = () => tools.find((t) => t.name === "studybuddy_update_learn_status")!;

    it("LS-01 label/description/promptSnippet 非空", () => {
      expect(tool().label).toBe("更新学习状态");
      expect(tool().description).toContain("学习");
      expect(tool().promptSnippet).toBeTruthy();
    });

    it("LS-02 execute 失败 throw Error（不存在 moduleId）", async () => {
      await expect(
        tool().execute("ls-1", { id: "nonexistent-id", learnStatus: "learning" }),
      ).rejects.toThrow();
    });

    it("LS-03 execute 失败 throw Error（非法 learnStatus）", async () => {
      // 先 SQL 插入一个 module 供测试
      const db = ctx.semesterDb(semesterId);
      const uploadTool = tools.find((t) => t.name === "studybuddy_upload_material")!;
      const uploadResult = await uploadTool.execute("ls-up", {
        courseId,
        file: stagedFile("ls-test.pdf"),
      });
      const materialId = (uploadResult.details as { materialId: string }).materialId;
      const ts = new Date().toISOString();
      db.prepare(
        `INSERT INTO knowledge_modules (id, course_instance_id, material_id, module_name, learn_status, source_evidence_json, ai_generated, created_at, updated_at)
         VALUES (@id, @cid, @mid, 'LS测试模块', 'not_started', '{}', 1, @ts, @ts)`,
      ).run({ id: "ls-module-id", cid: courseId, mid: materialId, ts });

      await expect(
        tool().execute("ls-2", { id: "ls-module-id", learnStatus: "invalid_status" }),
      ).rejects.toThrow();
    });
  });
});
