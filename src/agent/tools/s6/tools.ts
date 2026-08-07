/**
 * T-M2-002 S6 registerTool 工具定义（03-Arch §3.1 + §2.2 ToolDefinition 契约）
 *
 * 3 个 studybuddy_* 工具，execute 薄封装调用 S6 handler（06-API §3.8）。
 * 工具名匹配 ^studybuddy_[a-z_]+$；ToolDefinition 必填 name/label/description/parameters/execute。
 *
 * 工具清单：
 *   1. studybuddy_generate_parent_report  → reports.generate + reports.freeze（生成即冻结）
 *   2. studybuddy_deliver_parent_report   → deliveries.deliver / deliveries.retry
 *   3. studybuddy_manage_report_targets   → reportTargets.create/update/delete
 */
import { Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { S6Context } from "../../../agent-host/handlers/s6/context";
import { createS6Handlers } from "../../../agent-host/handlers/s6";

function textContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

function jsonContent(obj: unknown): { type: "text"; text: string } {
  return textContent(JSON.stringify(obj, null, 2));
}

export const S6_TOOL_NAMES = [
  "studybuddy_generate_parent_report",
  "studybuddy_deliver_parent_report",
  "studybuddy_manage_report_targets",
] as const;

export const S6_TOOL_COUNT = S6_TOOL_NAMES.length;

/**
 * 创建 S6 全部 3 个 studybuddy_* 工具。
 * @param ctx S6 上下文（数据层句柄 + ReportPolisher + DeliveryChannels + credentialGetter）
 */
export function createS6Tools(ctx: S6Context): ToolDefinition[] {
  const handlers = createS6Handlers(ctx);

  return [
    // 1. studybuddy_generate_parent_report → reports.generate + reports.freeze
    {
      name: "studybuddy_generate_parent_report",
      label: "生成家长报告",
      description:
        "规则优先聚合 S1-S4 数据生成家长报告（6 section）+ AI 仅润色（失败保留规则报告）+ 冻结快照 + UUID 泄漏检测。不含原文/题干/答案/作答/错因/UUID/真实渠道地址。",
      promptSnippet: "生成家长报告：规则聚合 + AI 润色降级 + 冻结 + UUID 检测",
      parameters: Type.Object({
        semesterId: Type.String({ description: "学期 ID" }),
        reportType: Type.Union(
          [
            Type.Literal("daily"),
            Type.Literal("weekly"),
            Type.Literal("monthly"),
            Type.Literal("exam_reminder"),
          ],
          { description: "报告类型：daily/weekly/monthly/exam_reminder" },
        ),
        periodStart: Type.String({ description: "统计开始日期（YYYY-MM-DD）" }),
        periodEnd: Type.String({ description: "统计结束日期（YYYY-MM-DD）" }),
      }),
      async execute(_toolCallId, params) {
        const report = handlers["reports.generate"](params) as {
          reportKey: string;
          reportType: string;
          contentHash: string;
          aiPolished: number;
        };
        // 生成即冻结（决策 1：工具层合并，RPC 层分离）
        handlers["reports.freeze"]({ reportKey: report.reportKey });
        return {
          content: [
            textContent(
              `家长报告已生成并冻结：类型 ${report.reportType}，AI 润色 ${report.aiPolished ? "成功" : "未启用"}，hash ${report.contentHash.slice(0, 8)}...`,
            ),
            jsonContent(report),
          ],
          details: {
            reportKey: report.reportKey,
            reportType: report.reportType,
            aiPolished: report.aiPolished,
            contentHash: report.contentHash,
          },
        };
      },
    },

    // 2. studybuddy_deliver_parent_report → deliveries.deliver / deliveries.retry
    {
      name: "studybuddy_deliver_parent_report",
      label: "投递家长报告",
      description:
        "投递冻结报告到指定渠道（local_export/smtp/feishu_webhook/print），渠道独立失败隔离，最多重试 3 次达上限 retained_locally。真实渠道地址在 credential-vault。",
      promptSnippet: "投递家长报告：渠道独立隔离 + 重试上限 retained_locally",
      parameters: Type.Object({
        reportKey: Type.String({ description: "报告 ID（report_key）" }),
        channel: Type.Union(
          [
            Type.Literal("local_export"),
            Type.Literal("smtp"),
            Type.Literal("feishu_webhook"),
            Type.Literal("print"),
          ],
          { description: "投递渠道" },
        ),
        retry: Type.Optional(
          Type.Boolean({ description: "true=重试已有投递，false/省略=新建投递" }),
        ),
      }),
      async execute(_toolCallId, params) {
        const { reportKey, channel, retry } = params as {
          reportKey: string;
          channel: "local_export" | "smtp" | "feishu_webhook" | "print";
          retry?: boolean;
        };
        const result = retry
          ? handlers["deliveries.retry"]({ reportKey, channel })
          : handlers["deliveries.deliver"]({ reportKey, channel });
        const delivery = result as {
          reportKey: string;
          channel: string;
          status: string;
          retryCount: number;
        };
        return {
          content: [
            textContent(
              `投递结果：渠道 ${delivery.channel}，状态 ${delivery.status}，重试次数 ${delivery.retryCount}`,
            ),
            jsonContent(delivery),
          ],
          details: {
            reportKey: delivery.reportKey,
            channel: delivery.channel,
            status: delivery.status,
            retryCount: delivery.retryCount,
          },
        };
      },
    },

    // 3. studybuddy_manage_report_targets → reportTargets.create/update/delete
    {
      name: "studybuddy_manage_report_targets",
      label: "管理报告目标",
      description:
        "管理家长报告投递目标（创建/更新/软删除）。真实邮箱/Webhook URL 存 credential-vault，channelConfigJson 仅存别名。",
      promptSnippet: "管理报告目标：create/update/delete + credential-vault 别名",
      parameters: Type.Object({
        action: Type.Union(
          [Type.Literal("create"), Type.Literal("update"), Type.Literal("delete")],
          { description: "操作类型" },
        ),
        semesterId: Type.Optional(Type.String({ description: "create 时必填：学期 ID" })),
        targetName: Type.Optional(Type.String({ description: "create/update 时：目标名称" })),
        channelType: Type.Optional(
          Type.Union(
            [
              Type.Literal("local_export"),
              Type.Literal("smtp"),
              Type.Literal("feishu_webhook"),
              Type.Literal("print"),
            ],
            { description: "create 时必填：渠道类型" },
          ),
        ),
        channelConfigJson: Type.Optional(
          Type.String({ description: "create/update 时：渠道配置 JSON（别名）" }),
        ),
        credentialKey: Type.Optional(
          Type.String({ description: "create/update 时：credential-vault 键名" }),
        ),
        id: Type.Optional(Type.String({ description: "update/delete 时：目标 ID" })),
        enabled: Type.Optional(Type.Number({ description: "update 时：启用状态 0/1" })),
      }),
      async execute(_toolCallId, params) {
        const p = params as {
          action: "create" | "update" | "delete";
          semesterId?: string;
          targetName?: string;
          channelType?: "local_export" | "smtp" | "feishu_webhook" | "print";
          channelConfigJson?: string;
          credentialKey?: string;
          id?: string;
          enabled?: number;
        };

        if (p.action === "create") {
          if (!p.semesterId || !p.targetName || !p.channelType || !p.channelConfigJson) {
            throw new Error("create 需要 semesterId/targetName/channelType/channelConfigJson");
          }
          const result = handlers["reportTargets.create"]({
            semesterId: p.semesterId,
            targetName: p.targetName,
            channelType: p.channelType,
            channelConfigJson: p.channelConfigJson,
            credentialKey: p.credentialKey,
          }) as { id: string; targetName: string; channelType: string };
          return {
            content: [textContent(`报告目标已创建：${result.targetName}（${result.channelType}）`)],
            details: result,
          };
        }

        if (p.action === "update") {
          if (!p.id) throw new Error("update 需要 id");
          const result = handlers["reportTargets.update"](p) as {
            id: string;
            targetName: string;
          };
          return {
            content: [textContent(`报告目标已更新：${result.targetName}`)],
            details: result,
          };
        }

        if (p.action === "delete") {
          if (!p.id) throw new Error("delete 需要 id");
          handlers["reportTargets.delete"]({ id: p.id });
          return {
            content: [textContent("报告目标已软删除")],
            details: { id: p.id, deleted: true },
          };
        }

        throw new Error(`未知 action：${p.action}`);
      },
    },
  ];
}
