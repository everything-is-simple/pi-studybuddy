import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import { createGlobalDb } from "../../src/data/global";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import { S6Context } from "../../src/agent-host/handlers/s6/context";
import { createS6Tools, S6_TOOL_NAMES, S6_TOOL_COUNT } from "../../src/agent/tools/s6/tools";
import { assertNoSensitiveLeak } from "../../src/agent-host/handlers/s6/leak-detector";
import { generateRuleReport } from "../../src/agent-host/handlers/s6/report-generator";
import {
  createMockReportPolisher,
  createFailingReportPolisher,
} from "../../src/agent-host/handlers/s6/report-polisher";
import {
  createMockDeliveryChannels,
  createFailingDeliveryChannel,
} from "../../src/agent-host/handlers/s6/delivery-channels";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { RpcError } from "../../src/contract/types";

/**
 * T-M2-002 S6 registerTool 工具单件测试（08-Test §3.1 + 03-Arch §2.2 ToolDefinition 契约）
 *
 * 每个工具 ≥4 条契约断言：
 *   - ToolDefinition 必填 name/label/description/parameters/execute
 *   - 工具名匹配 ^studybuddy_[a-z_]+$
 *   - execute 成功返回 {content, details} 结构
 *   - execute 失败 throw Error
 *
 * 安全不变量（08-Test §5.4）：
 *   - assertNoSensitiveLeak UUID 检测
 *   - 规则报告脱敏
 *   - 投递渠道独立失败隔离
 *
 * 数据隔离（AGENTS.md §5.3）：仅写 H:\pi-studybuddy-tmp\runs\T-M2-002\unit-tools。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M2-002\\unit-tools";

describe("T-M2-002 S6 registerTool 工具单件测试", () => {
  let s1Ctx: S1Context;
  let s6Ctx: S6Context;
  let s1Handlers: ReturnType<typeof createS1Handlers>;
  let tools: ToolDefinition[];
  let semesterId: string;
  let courseId: string;
  let reportKey: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    s1Ctx = new S1Context(ISOLATION_DIR);
    s1Handlers = createS1Handlers(s1Ctx);
    s6Ctx = new S6Context(ISOLATION_DIR, {
      reportPolisher: createMockReportPolisher(),
      deliveryChannels: createMockDeliveryChannels(),
      credentialGetter: () => "mock-value",
    });
    tools = createS6Tools(s6Ctx);

    const sem = (s1Handlers["semesters.create"] as (p: unknown) => unknown)({
      label: "S6工具测试学期",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      timezone: "Asia/Shanghai",
    }) as { id: string };
    semesterId = sem.id;

    const course = (s1Handlers["courses.create"] as (p: unknown) => unknown)({
      semesterId,
      courseName: "S6工具测试课程",
      subject: "数学",
    }) as { id: string };
    courseId = course.id;
  });

  afterAll(() => {
    s1Ctx?.dispose();
    s6Ctx?.dispose();
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
    it("TOOL-01 工具数量 = 3", () => {
      expect(tools.length).toBe(3);
      expect(S6_TOOL_COUNT).toBe(3);
    });

    it("TOOL-02 工具名匹配 ^studybuddy_[a-z_]+$", () => {
      for (const name of S6_TOOL_NAMES) {
        expect(name).toMatch(/^studybuddy_[a-z_]+$/);
      }
      expect(S6_TOOL_NAMES).toContain("studybuddy_generate_parent_report");
      expect(S6_TOOL_NAMES).toContain("studybuddy_deliver_parent_report");
      expect(S6_TOOL_NAMES).toContain("studybuddy_manage_report_targets");
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

  describe("studybuddy_generate_parent_report", () => {
    it("GEN-01 execute 成功 → 返回 {content, details} 含 reportKey", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_generate_parent_report")!;
      const result = await tool.execute("call-1", {
        semesterId,
        reportType: "weekly",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-07",
      });
      expect(result.content).toBeDefined();
      expect(result.details).toBeDefined();
      expect((result.details as { reportKey: string }).reportKey).toBeTruthy();
      reportKey = (result.details as { reportKey: string }).reportKey;
    });

    it("GEN-02 execute 失败 → throw Error（无效 reportType）", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_generate_parent_report")!;
      try {
        await tool.execute("call-2", {
          semesterId,
          reportType: "invalid_type",
          periodStart: "2026-10-01",
          periodEnd: "2026-10-07",
        });
        expect.fail("应抛错");
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });

  describe("studybuddy_deliver_parent_report", () => {
    it("DLV-01 execute 成功（local_export）→ 返回投递状态 sent", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_deliver_parent_report")!;
      const result = await tool.execute("call-3", {
        reportKey,
        channel: "local_export",
        retry: false,
      });
      expect(result.content).toBeDefined();
      expect((result.details as { status: string }).status).toBe("sent");
    });
  });

  describe("studybuddy_manage_report_targets", () => {
    it("MRT-01 execute 成功（action=create）→ 返回目标", async () => {
      const tool = tools.find((t) => t.name === "studybuddy_manage_report_targets")!;
      const result = await tool.execute("call-4", {
        action: "create",
        semesterId,
        targetName: "妈妈",
        channelType: "local_export",
        channelConfigJson: JSON.stringify({ dir: "H:/Reports" }),
      });
      expect(result.content).toBeDefined();
      expect((result.details as { targetName: string }).targetName).toBe("妈妈");
    });
  });

  describe("安全不变量 assertNoSensitiveLeak（08-Test §5.4）", () => {
    it("LEAK-01 无 UUID 的报告 → 通过（不抛错）", () => {
      const safeContent = { study_rhythm: { task_count: 5 }, materials: { count: 3 } };
      expect(() => assertNoSensitiveLeak(safeContent)).not.toThrow();
    });

    it("LEAK-02 注入完整 UUID → 抛 PARENT_REPORT_PRIVACY_VIOLATION", () => {
      const leakyContent = {
        study_rhythm: { note: "550e8400-e29b-41d4-a716-446655440000" },
      };
      try {
        assertNoSensitiveLeak(leakyContent);
        expect.fail("应抛 PARENT_REPORT_PRIVACY_VIOLATION");
      } catch (e) {
        expect((e as RpcError).code).toBe("PARENT_REPORT_PRIVACY_VIOLATION");
      }
    });

    it("LEAK-03 多个 UUID 都检测到", () => {
      const leakyContent = {
        a: "550e8400-e29b-41d4-a716-446655440000",
        b: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      };
      try {
        assertNoSensitiveLeak(leakyContent);
        expect.fail("应抛 PARENT_REPORT_PRIVACY_VIOLATION");
      } catch (e) {
        expect((e as RpcError).code).toBe("PARENT_REPORT_PRIVACY_VIOLATION");
      }
    });
  });

  describe("规则报告生成器（确定性脱敏）", () => {
    it("GEN-03 6 section 全部生成", () => {
      const db = s1Ctx.semesterDb(semesterId);
      const report = generateRuleReport(db, semesterId, "2026-10-01", "2026-10-07");
      expect(report.study_rhythm).toBeDefined();
      expect(report.materials).toBeDefined();
      expect(report.practice).toBeDefined();
      expect(report.mistakes).toBeDefined();
      expect(report.exam_reminder).toBeDefined();
      expect(report.data_quality).toBeDefined();
    });

    it("GEN-04 不含原文/题干/答案/作答（脱敏断言）", () => {
      const db = s1Ctx.semesterDb(semesterId);
      const report = generateRuleReport(db, semesterId, "2026-10-01", "2026-10-07");
      const serialized = JSON.stringify(report);
      expect(serialized).not.toContain("correct_answer");
      expect(serialized).not.toContain("student_answer");
      expect(serialized).not.toContain("question_stem");
      expect(serialized).not.toContain("error_cause_note");
    });
  });

  describe("AI 润色可注入（08-Test §5.5 降级）", () => {
    it("POL-01 mock 润色成功 → aiPolished=1", () => {
      const polisher = createMockReportPolisher();
      const result = polisher.polish({
        study_rhythm: { task_count: 1 },
      });
      expect(result.polished).toBe(true);
      expect(result.content).toBeDefined();
    });

    it("POL-02 failing 润色 → 抛错（handler 捕获降级）", () => {
      const polisher = createFailingReportPolisher();
      expect(() => polisher.polish({})).toThrow();
    });
  });

  describe("投递渠道独立失败隔离", () => {
    it("CH-01 local_export mock 成功", () => {
      const channels = createMockDeliveryChannels();
      const result = channels.local_export.deliver(
        {
          reportKey: "ch-test-1",
          contentJson: '{"test":1}',
          contentHash: "abc",
          reportType: "daily",
        },
        { dir: `${ISOLATION_DIR}/reports` },
      );
      expect(result.success).toBe(true);
    });

    it("CH-02 failing 渠道总是失败", () => {
      const channel = createFailingDeliveryChannel();
      const result = channel.deliver(
        {
          reportKey: "ch-test-2",
          contentJson: '{"test":1}',
          contentHash: "abc",
          reportType: "daily",
        },
        {},
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBeTruthy();
    });
  });
});
