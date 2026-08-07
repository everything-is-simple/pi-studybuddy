/**
 * T-M2-002 S6 投递渠道独立失败隔离（07-WF §3.2 + 08-Test §5.4）
 *
 * DeliveryChannel 接口 + 4 实现（local_export/smtp/feishu_webhook/print）。
 * 每个渠道独立 try-catch，互不影响（smtp 失败不影响 feishu_webhook）。
 * 真实渠道地址在 credential-vault，channelConfig 只存别名配置。
 *
 * 接口为同步（与 S1-S5 handler 同步模式一致；未来真实渠道用 worker 同步桥或 child_process.execSync）。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

/** 投递结果 */
export interface DeliveryResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/** 冻结报告内容（用于投递） */
export interface DeliverableReport {
  reportKey: string;
  contentJson: string;
  contentHash: string;
  reportType: string;
}

/** 渠道配置（别名，真实地址在 credential-vault） */
export interface ChannelConfig {
  [key: string]: unknown;
}

export interface DeliveryChannel {
  deliver(report: DeliverableReport, config: ChannelConfig): DeliveryResult;
}

/** local_export：写本地文件 */
function createLocalExportChannel(): DeliveryChannel {
  return {
    deliver(report: DeliverableReport, config: ChannelConfig): DeliveryResult {
      try {
        const dir = (config.dir as string) ?? "./reports";
        mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, `${report.reportKey}.json`);
        writeFileSync(filePath, report.contentJson, "utf-8");
        return { success: true };
      } catch (e) {
        return {
          success: false,
          errorCode: "LOCAL_EXPORT_FAILED",
          errorMessage: (e as Error).message,
        };
      }
    },
  };
}

/** smtp：mock 成功 */
function createSmtpChannel(): DeliveryChannel {
  return {
    deliver(): DeliveryResult {
      return { success: true };
    },
  };
}

/** feishu_webhook：mock 成功 */
function createFeishuWebhookChannel(): DeliveryChannel {
  return {
    deliver(): DeliveryResult {
      return { success: true };
    },
  };
}

/** print：mock 成功 */
function createPrintChannel(): DeliveryChannel {
  return {
    deliver(): DeliveryResult {
      return { success: true };
    },
  };
}

/** 4 渠道集合 */
export interface DeliveryChannels {
  local_export: DeliveryChannel;
  smtp: DeliveryChannel;
  feishu_webhook: DeliveryChannel;
  print: DeliveryChannel;
}

/** 默认 4 渠道全 mock 成功 */
export function createMockDeliveryChannels(): DeliveryChannels {
  return {
    local_export: createLocalExportChannel(),
    smtp: createSmtpChannel(),
    feishu_webhook: createFeishuWebhookChannel(),
    print: createPrintChannel(),
  };
}

/** 总是失败的渠道（测试重试上限 retained_locally） */
export function createFailingDeliveryChannel(): DeliveryChannel {
  return {
    deliver(): DeliveryResult {
      return {
        success: false,
        errorCode: "CHANNEL_FAILED",
        errorMessage: "渠道投递失败（mock）",
      };
    },
  };
}
