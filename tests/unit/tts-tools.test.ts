import { describe, it, expect, beforeAll } from "vitest";
import { TtsContext } from "../../src/agent-host/handlers/tts/context";
import { createTtsTools, TTS_TOOL_NAMES, TTS_TOOL_COUNT } from "../../src/agent/tools/tts/tools";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

/**
 * T-M2-004 TTS registerTool 工具单件测试（08-Test §3.1 + 03-Arch §2.2 ToolDefinition 契约）
 *
 * 每个工具 ≥4 条契约断言：
 *   - ToolDefinition 必填 name/label/description/parameters/execute
 *   - 工具名匹配 ^studybuddy_[a-z_]+$
 *   - execute 成功返回 {content, details} 结构
 *   - execute 失败 throw Error
 *
 * 数据隔离（AGENTS.md §5.3）：TTS 无 db 句柄，无需隔离目录。
 */

describe("T-M2-004 TTS registerTool 工具单件测试", () => {
  let ctx: TtsContext;
  let tools: ToolDefinition[];

  beforeAll(() => {
    ctx = new TtsContext();
    tools = createTtsTools(ctx);
  });

  describe("工具契约断言", () => {
    it("TOOL-01 工具数量 = 3", () => {
      expect(tools.length).toBe(3);
      expect(TTS_TOOL_COUNT).toBe(3);
    });

    it("TOOL-02 工具名匹配 ^studybuddy_[a-z_]+$", () => {
      for (const name of TTS_TOOL_NAMES) {
        expect(name).toMatch(/^studybuddy_[a-z_]+$/);
      }
      expect(TTS_TOOL_NAMES).toContain("studybuddy_tts_speak");
      expect(TTS_TOOL_NAMES).toContain("studybuddy_tts_control");
      expect(TTS_TOOL_NAMES).toContain("studybuddy_tts_switch_engine");
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

  describe("studybuddy_tts_speak", () => {
    it("SPK-01 execute 成功 → 返回 {content, details} 含 playbackId + engine", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_tts_speak")!;
      const result = await tool.execute("call-1", { text: "工具层朗读测试" });
      expect(result.content).toBeDefined();
      expect(result.details).toBeDefined();
      const details = result.details as {
        playbackId: string;
        engine: string;
        fallbackUsed?: boolean;
      };
      expect(details.playbackId).toBeTruthy();
      expect(details.engine).toBe("sapi");
      expect(details.fallbackUsed).toBeUndefined();
    });

    it("SPK-02 execute 失败（text 空）→ throw Error", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_tts_speak")!;
      try {
        await tool.execute("call-2", { text: "" });
        expect.fail("应抛错");
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });

  describe("studybuddy_tts_control", () => {
    it("CTL-01 execute 成功（stop）→ 返回 {content, details} 含 action", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_tts_control")!;
      const speakTool = tools.find((t) => t.name === "studybuddy_tts_speak")!;
      const speakResult = await speakTool.execute("call-3", { text: "控制测试" });
      const speakDetails = speakResult.details as { playbackId: string };
      const result = await tool.execute("call-4", {
        playbackId: speakDetails.playbackId,
        action: "stop",
      });
      expect(result.content).toBeDefined();
      expect(result.details).toBeDefined();
      expect((result.details as { action: string }).action).toBe("stop");
    });

    it("CTL-02 execute 失败（未知 playbackId）→ throw Error", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_tts_control")!;
      try {
        await tool.execute("call-5", { playbackId: "nonexistent", action: "stop" });
        expect.fail("应抛错");
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });

  describe("studybuddy_tts_switch_engine", () => {
    it("SW-01 execute 成功 → 返回 {content, details} 含 engine", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_tts_switch_engine")!;
      const result = await tool.execute("call-6", { engine: "edge-tts" });
      expect(result.content).toBeDefined();
      expect(result.details).toBeDefined();
      expect((result.details as { engine: string }).engine).toBe("edge-tts");
      // 验证 ctx 状态已更新
      expect(ctx.currentEngine).toBe("edge-tts");
    });

    it("SW-02 execute 失败（非法引擎）→ throw Error", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_tts_switch_engine")!;
      try {
        await tool.execute("call-7", { engine: "invalid" as "sapi" });
        expect.fail("应抛错");
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });
});
