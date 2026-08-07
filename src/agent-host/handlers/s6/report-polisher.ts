/**
 * T-M2-002 S6 ReportPolisher 可注入接口（07-WF §3.1 + 08-Test §5.5）
 *
 * 默认 createMockReportPolisher：确定性润色（加摘要句 + 标记 aiPolished=1）。
 * createFailingReportPolisher：模拟 AI 失败（抛错），用于测试降级路径。
 *
 * handler 捕获润色失败 → 保留规则报告（aiPolished=0），不阻塞投递。
 *
 * 接口为同步（与 S1-S5 handler 同步模式一致；未来真实 LLM 用 worker 同步桥或 child_process.execSync）。
 */

/** 规则报告内容（6 section） */
export interface RuleReport {
  study_rhythm: unknown;
  materials: unknown;
  practice: unknown;
  mistakes: unknown;
  exam_reminder: unknown;
  data_quality: unknown;
  [key: string]: unknown;
}

/** 润色结果 */
export interface PolishedReport {
  polished: boolean;
  content: RuleReport;
  aiModel?: string;
  promptVersion?: string;
}

export interface ReportPolisher {
  polish(report: RuleReport): PolishedReport;
}

/** mock 确定性润色：加 summary section + 标记 polished */
export function createMockReportPolisher(): ReportPolisher {
  return {
    polish(report: RuleReport): PolishedReport {
      return {
        polished: true,
        content: {
          ...report,
          summary: "本周学习状态稳定，请继续保持。",
        },
        aiModel: "mock-polisher",
        promptVersion: "v0.1",
      };
    },
  };
}

/** failing 润色：总是抛错，测试降级路径 */
export function createFailingReportPolisher(): ReportPolisher {
  return {
    polish(_report: RuleReport): PolishedReport {
      throw new Error("AI 润色服务不可用（mock 失败）");
    },
  };
}
