import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import { createGlobalDb } from "../../src/data/global";
import { S1Context } from "../../src/agent-host/handlers/s1/context";
import { createS1Tools, S1_TOOL_NAMES, S1_TOOL_COUNT } from "../../src/agent/tools/s1/tools";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

/**
 * T-M1-001 S1 registerTool 工具单件测试（08-Test §3.1 + 03-Arch §2.2 ToolDefinition 契约）
 *
 * 每个工具 ≥4 条契约断言（08-Test §3.1）：
 *   - registerTool 返回 void
 *   - ToolDefinition 必填 name/label/description/parameters/execute
 *   - execute 成功返回 {content, details} 结构
 *   - execute 失败 throw Error
 *
 * 工具名匹配 ^studybuddy_[a-z_]+$（03-Arch §2.2）
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M1-001\。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-001\\unit-tools";

describe("T-M1-001 S1 registerTool 工具单件测试", () => {
  let ctx: S1Context;
  let tools: ToolDefinition[];

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    ctx = new S1Context(ISOLATION_DIR);
    tools = createS1Tools(ctx);
  });

  afterAll(() => {
    ctx?.dispose();
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
    it("TOOLSET-01 返回 6 个工具（S1_TOOL_COUNT === 6）", () => {
      expect(tools.length).toBe(6);
      expect(S1_TOOL_COUNT).toBe(6);
    });

    it("TOOLSET-02 工具名清单与 S1_TOOL_NAMES 一致", () => {
      const names = tools.map((t) => t.name);
      expect(names).toEqual([...S1_TOOL_NAMES]);
    });

    it("TOOLSET-03 所有工具名匹配 ^studybuddy_[a-z_]+$", () => {
      for (const name of S1_TOOL_NAMES) {
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

  describe("studybuddy_init_semester", () => {
    const tool = () => tools.find((t) => t.name === "studybuddy_init_semester")!;

    it("INIT-01 label/description/promptSnippet 非空", () => {
      expect(tool().label).toBe("初始化学期");
      expect(tool().description).toContain("学期");
      expect(tool().promptSnippet).toBeTruthy();
    });

    it("INIT-02 execute 成功返回 {content, details}", async () => {
      const result = await tool().execute("call-1", {
        label: "工具测试学期",
        startDate: "2026-09-01",
        endDate: "2027-01-31",
        timezone: "Asia/Shanghai",
      }, undefined, undefined, {} as never);

      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0]).toHaveProperty("type", "text");
      expect(result.content[0]).toHaveProperty("text");
      expect(result.details).toHaveProperty("semesterId");
      expect(result.details).toHaveProperty("status", "active");
    });

    it("INIT-03 execute 缺少必填字段 throw Error", async () => {
      await expect(
        tool().execute("call-2", {
          label: "缺日期",
          startDate: "2026-09-01",
          // endDate 缺失
        } as never, undefined, undefined, {} as never),
      ).rejects.toThrow();
    });

    it("INIT-04 parameters 是 TypeBox Object schema", () => {
      const params = tool().parameters as { type?: string; properties?: unknown };
      expect(params).toHaveProperty("properties");
      expect(params).toHaveProperty("type");
    });
  });

  describe("studybuddy_add_exam", () => {
    let courseId: string;

    beforeAll(async () => {
      // 先建学期+课程
      const initTool = tools.find((t) => t.name === "studybuddy_init_semester")!;
      const semResult = await initTool.execute("setup-1", {
        label: "考试工具测试学期",
        startDate: "2026-09-01",
        endDate: "2027-01-31",
      }, undefined, undefined, {} as never);
      const semId = (semResult.details as { semesterId: string }).semesterId;

      // 直接用 handler 建课程
      const handlers = ctx;
      const semDb = handlers.semesterDb(semId);
      const { randomUUID } = await import("node:crypto");
      courseId = randomUUID();
      semDb.prepare(
        `INSERT INTO course_instances (id, semester_id, course_name, subject, status, created_at, updated_at)
         VALUES (?, ?, '测试课程', '测试', 'active', ?, ?)`,
      ).run(courseId, semId, new Date().toISOString(), new Date().toISOString());
    });

    const tool = () => tools.find((t) => t.name === "studybuddy_add_exam")!;

    it("ADD-01 execute 成功返回 pending 考试", async () => {
      const result = await tool().execute("call-1", {
        courseId,
        examName: "单元测试考试",
        examType: "quiz",
        scheduledDate: "2026-10-15",
        source: "student_input",
      }, undefined, undefined, {} as never);

      expect(result.content[0]).toHaveProperty("type", "text");
      expect((result.details as { confirmationStatus: string }).confirmationStatus).toBe("pending");
    });

    it("ADD-02 parameters 含 examType 枚举（midterm/final/makeup/retake/quiz）", () => {
      const params = tool().parameters as { properties?: Record<string, { anyOf?: Array<{ const?: string }> }> };
      const examType = params.properties?.examType;
      expect(examType).toBeDefined();
      const literals = examType?.anyOf?.map((l) => l.const) ?? [];
      expect(literals).toEqual(
        expect.arrayContaining(["midterm", "final", "makeup", "retake", "quiz"]),
      );
    });

    it("ADD-03 execute 非法 examType throw Error", async () => {
      await expect(
        tool().execute("call-2", {
          courseId,
          examName: "非法类型",
          examType: "invalid_type",
          scheduledDate: "2026-10-15",
          source: "student_input",
        } as never, undefined, undefined, {} as never),
      ).rejects.toThrow();
    });

    it("ADD-04 execute 不存在的 courseId throw Error", async () => {
      await expect(
        tool().execute("call-3", {
          courseId: "non-existent-course",
          examName: "测试",
          examType: "quiz",
          scheduledDate: "2026-10-15",
          source: "student_input",
        }, undefined, undefined, {} as never),
      ).rejects.toThrow();
    });
  });

  describe("studybuddy_confirm_exam", () => {
    const tool = () => tools.find((t) => t.name === "studybuddy_confirm_exam")!;

    it("CONFIRM-01 label 为 '确认考试'", () => {
      expect(tool().label).toBe("确认考试");
    });

    it("CONFIRM-02 parameters 含 confirmed boolean", () => {
      const params = tool().parameters as { properties?: Record<string, { type?: string }> };
      expect(params.properties?.confirmed?.type).toBe("boolean");
    });

    it("CONFIRM-03 execute 不存在的 id throw Error", async () => {
      await expect(
        tool().execute("call-1", {
          id: "non-existent-exam",
          confirmed: true,
        }, undefined, undefined, {} as never),
      ).rejects.toThrow();
    });

    it("CONFIRM-04 promptSnippet 非空", () => {
      expect(tool().promptSnippet).toBeTruthy();
    });
  });

  describe("studybuddy_daily_brief", () => {
    const tool = () => tools.find((t) => t.name === "studybuddy_daily_brief")!;

    it("BRIEF-01 label 为 '每日简报'", () => {
      expect(tool().label).toBe("每日简报");
    });

    it("BRIEF-02 execute 成功返回 {content, details}", async () => {
      // 先建一个学期
      const initTool = tools.find((t) => t.name === "studybuddy_init_semester")!;
      const semResult = await initTool.execute("brief-setup", {
        label: "简报测试学期",
        startDate: "2026-09-01",
        endDate: "2027-01-31",
      }, undefined, undefined, {} as never);
      const semId = (semResult.details as { semesterId: string }).semesterId;

      const result = await tool().execute("call-1", {
        semesterId: semId,
      }, undefined, undefined, {} as never);

      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty("type", "text");
      expect((result.details as { date: string }).date).toBeTruthy();
    });

    it("BRIEF-03 description 含 '纯规则聚合'（非 AI）", () => {
      expect(tool().description).toContain("纯规则聚合");
    });

    it("BRIEF-04 execute 不存在的 semesterId throw Error", async () => {
      await expect(
        tool().execute("call-2", {
          semesterId: "non-existent-semester",
        }, undefined, undefined, {} as never),
      ).rejects.toThrow();
    });
  });

  describe("studybuddy_complete_task", () => {
    const tool = () => tools.find((t) => t.name === "studybuddy_complete_task")!;

    it("COMPLETE-01 label 为 '完成任务'", () => {
      expect(tool().label).toBe("完成任务");
    });

    it("COMPLETE-02 execute 不存在的 id throw Error", async () => {
      await expect(
        tool().execute("call-1", {
          id: "non-existent-task",
        }, undefined, undefined, {} as never),
      ).rejects.toThrow();
    });

    it("COMPLETE-03 parameters 含 id string", () => {
      const params = tool().parameters as { properties?: Record<string, { type?: string }> };
      expect(params.properties?.id?.type).toBe("string");
    });

    it("COMPLETE-04 description 含 'task_completed 事件'", () => {
      expect(tool().description).toContain("task_completed");
    });
  });

  describe("studybuddy_transition_semester", () => {
    const tool = () => tools.find((t) => t.name === "studybuddy_transition_semester")!;

    it("TRANS-01 label 为 '学期状态迁移'", () => {
      expect(tool().label).toBe("学期状态迁移");
    });

    it("TRANS-02 parameters status 是枚举（teaching_ended/follow_up/archived）", () => {
      const params = tool().parameters as { properties?: Record<string, { anyOf?: Array<{ const?: string }> }> };
      const status = params.properties?.status;
      const literals = status?.anyOf?.map((l) => l.const) ?? [];
      expect(literals).toEqual(
        expect.arrayContaining(["teaching_ended", "follow_up", "archived"]),
      );
    });

    it("TRANS-03 execute 不存在的 id throw Error", async () => {
      await expect(
        tool().execute("call-1", {
          id: "non-existent-semester",
          status: "teaching_ended",
        }, undefined, undefined, {} as never),
      ).rejects.toThrow();
    });

    it("TRANS-04 description 含合法迁移路径", () => {
      expect(tool().description).toContain("active→teaching_ended→follow_up→archived");
    });
  });

  describe("studybuddy-extension 装配验证", () => {
    it("ASM-01 createS1Tools 返回的工具可被 registerTool 接受（stub pi 计数）", () => {
      let registerCount = 0;
      const stubPi = {
        registerTool: () => {
          registerCount++;
        },
      } as unknown as import("@earendil-works/pi-coding-agent").ExtensionAPI;

      // 模拟 studybuddy-extension setup 的核心逻辑
      for (const tool of tools) {
        stubPi.registerTool(tool);
      }
      expect(registerCount).toBe(6);
    });
  });
});
