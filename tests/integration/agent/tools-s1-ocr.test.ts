import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createOcrTools, OCR_TOOL_NAMES, OCR_TOOL_COUNT } from "../../../src/agent/tools/s1/ocr-tools";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

/**
 * T-M1-005 S1 OCR registerTool 工具集成测试（08-Test §3.1 + 03-Arch §2.2 ToolDefinition 契约）
 *
 * 断言：
 *   - 工具数量 = 1（OCR_TOOL_COUNT === 1）
 *   - 工具名匹配 ^studybuddy_[a-z_]+$
 *   - studybuddy_ocr_schedule 存在且有 name/label/description/parameters/execute 必填字段
 *   - execute 薄封装调 handler（mock adapter 注入）
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-005\integration-tools。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-005\\integration-tools";

describe("T-M1-005 S1 OCR registerTool 工具集成测试", () => {
  let tools: ToolDefinition[];
  let sampleImage: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    sampleImage = join(ISOLATION_DIR, "schedule.png");
    writeFileSync(
      sampleImage,
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
        0x0d, 0x49, 0x48, 0x44, 0x52,
      ]),
    );
    tools = createOcrTools();
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

  describe("工具集整体契约", () => {
    it("TOOLSET-01 返回 1 个工具（OCR_TOOL_COUNT === 1）", () => {
      expect(tools.length).toBe(1);
      expect(OCR_TOOL_COUNT).toBe(1);
    });

    it("TOOLSET-02 工具名匹配 ^studybuddy_[a-z_]+$", () => {
      for (const name of OCR_TOOL_NAMES) {
        expect(name).toMatch(/^studybuddy_[a-z_]+$/);
      }
      expect(OCR_TOOL_NAMES).toContain("studybuddy_ocr_schedule");
    });

    it("TOOLSET-03 工具名清单与 OCR_TOOL_NAMES 一致", () => {
      const names = tools.map((t) => t.name);
      expect(names).toEqual([...OCR_TOOL_NAMES]);
    });

    it("TOOLSET-04 工具 ToolDefinition 必填字段齐全（name/label/description/parameters/execute）", () => {
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

  describe("studybuddy_ocr_schedule", () => {
    const tool = () => tools.find((t) => t.name === "studybuddy_ocr_schedule")!;

    it("OCR-01 label 为 '课程表 OCR 识别预览'", () => {
      expect(tool().label).toBe("课程表 OCR 识别预览");
    });

    it("OCR-02 description 含 '本地 RapidOCR' + '不走多模态 AI'", () => {
      expect(tool().description).toContain("本地 RapidOCR");
      expect(tool().description).toContain("不走多模态 AI");
    });

    it("OCR-03 parameters 含 imagePath string", () => {
      const params = tool().parameters as { properties?: Record<string, { type?: string }> };
      expect(params.properties?.imagePath?.type).toBe("string");
    });

    it("OCR-04 execute 成功 → 返回 {content, details}，details 含 text/charCount", async () => {
      const result = await tool().execute("call-1", { imagePath: sampleImage });
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty("type", "text");
      expect(result.content[0]).toHaveProperty("text");
      const details = result.details as { text: string; charCount: number };
      expect(typeof details.text).toBe("string");
      expect(details.text.length).toBeGreaterThan(0);
      expect(typeof details.charCount).toBe("number");
    });

    it("OCR-05 execute 失败（图片不存在）→ throw Error", async () => {
      await expect(
        tool().execute("call-2", { imagePath: join(ISOLATION_DIR, "no-such.png") }),
      ).rejects.toThrow();
    });
  });
});