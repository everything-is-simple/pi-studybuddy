/**
 * T-M2-002 S6 deliveries.* handler（06-API §3.8 + 07-WF §3.2）
 *
 * 3 方法：
 *   - deliver：按 report_key+channel 去重（PK 冲突拒绝）+ 渠道投递 + credential-vault 集成 + study_events
 *   - retry：retry_count < max_retries → 重试；达上限 → retained_locally
 *   - list：按 reportKey 查询投递记录
 *
 * 渠道独立失败隔离（07-WF §3.2）：每个渠道独立 try-catch，互不影响。
 * credential-vault 解密失败 → INTERNAL_ERROR（07-WF §3.2）。
 */
import { randomUUID } from "node:crypto";
import type { S6Context } from "./context";
import { findSemesterByReportKey } from "./lookup";
import { writeReportDeliveredEvent } from "./events";
import { mapDelivery } from "./dto";
import { badRequest, notFound, internalError } from "./errors";
import type { ReportDelivery, ReportChannel } from "../../../contract/types";
import type { DeliverableReport } from "./delivery-channels";

function now(): string {
  return new Date().toISOString();
}

const VALID_CHANNELS: ReportChannel[] = ["local_export", "smtp", "feishu_webhook", "print"];
const MAX_RETRIES = 3;

function validateChannel(c: unknown): asserts c is ReportChannel {
  if (!VALID_CHANNELS.includes(c as ReportChannel)) {
    throw badRequest(`无效 channel：${String(c)}，应为 ${VALID_CHANNELS.join("/")}`);
  }
}

/** 投递报告（新建投递记录） */
export function handleDeliveriesDeliver(ctx: S6Context): (params: unknown) => ReportDelivery {
  return (params: unknown): ReportDelivery => {
    const p = params as { reportKey: string; channel: ReportChannel };
    if (!p.reportKey) throw badRequest("reportKey 不能为空");
    validateChannel(p.channel);

    const { db, semesterId } = findSemesterByReportKey(ctx, p.reportKey);

    // 按 report_key+channel 去重（PK 冲突拒绝重复投递）
    const existing = db
      .prepare("SELECT 1 FROM report_deliveries WHERE report_key = @rk AND channel = @ch")
      .get({ rk: p.reportKey, ch: p.channel });
    if (existing) {
      throw badRequest("该报告已在此渠道投递，请使用 retry 重试");
    }

    // 查 enabled target（global.db）
    const target = ctx.globalDb
      .prepare(
        `SELECT * FROM parent_report_targets
         WHERE semester_id = @sid AND channel_type = @ch AND enabled = 1 AND deleted_at IS NULL
         LIMIT 1`,
      )
      .get({ sid: semesterId, ch: p.channel }) as Record<string, unknown> | undefined;

    // credential-vault 集成：解密真实渠道地址
    let channelConfig: Record<string, unknown> = {};
    if (target) {
      const credentialKey = target.credential_key as string | undefined;
      if (credentialKey) {
        try {
          ctx.credentialGetter(credentialKey); // 解密（结果不进 DTO，仅验证可用性）
        } catch {
          throw internalError("家长联系方式解密失败，请重新配置");
        }
      }
      try {
        channelConfig = JSON.parse(target.channel_config_json as string);
      } catch {
        channelConfig = {};
      }
    }

    // 调渠道投递
    const reportRow = db
      .prepare("SELECT * FROM parent_reports WHERE report_key = @rk")
      .get({ rk: p.reportKey }) as Record<string, unknown>;
    const deliverable: DeliverableReport = {
      reportKey: p.reportKey,
      contentJson: reportRow.content_json as string,
      contentHash: reportRow.content_hash as string,
      reportType: reportRow.report_type as string,
    };

    const channel = ctx.deliveryChannels[p.channel];
    let status: ReportDelivery["status"] = "pending";
    let errorCode: string | undefined;
    const ts = now();
    try {
      const result = channel.deliver(deliverable, channelConfig);
      status = result.success ? "sent" : "failed";
      errorCode = result.errorCode;
    } catch (e) {
      status = "failed";
      errorCode = "DELIVERY_EXCEPTION";
      void e;
    }

    const sentAt = status === "sent" ? ts : null;
    db.prepare(
      `INSERT INTO report_deliveries (report_key, channel, status, retry_count, max_retries,
        error_code, sent_at, last_attempt_at, created_at)
       VALUES (@rk, @ch, @st, 0, @mr, @ec, @sa, @la, @ts)`,
    ).run({
      rk: p.reportKey,
      ch: p.channel,
      st: status,
      mr: MAX_RETRIES,
      ec: errorCode ?? null,
      sa: sentAt,
      la: ts,
      ts,
    });

    writeReportDeliveredEvent(db, semesterId, p.reportKey, p.channel, status);

    const row = db
      .prepare("SELECT * FROM report_deliveries WHERE report_key = @rk AND channel = @ch")
      .get({ rk: p.reportKey, ch: p.channel }) as Record<string, unknown>;
    return mapDelivery(row);
  };
}

/** 重试投递（retry_count+1，达上限 retained_locally） */
export function handleDeliveriesRetry(ctx: S6Context): (params: unknown) => ReportDelivery {
  return (params: unknown): ReportDelivery => {
    const p = params as { reportKey: string; channel: ReportChannel };
    if (!p.reportKey) throw badRequest("reportKey 不能为空");
    validateChannel(p.channel);

    const { db, semesterId } = findSemesterByReportKey(ctx, p.reportKey);
    const existing = db
      .prepare("SELECT * FROM report_deliveries WHERE report_key = @rk AND channel = @ch")
      .get({ rk: p.reportKey, ch: p.channel }) as Record<string, unknown> | undefined;
    if (!existing) throw notFound("未找到该投递记录");

    const retryCount = existing.retry_count as number;
    const maxRetries = existing.max_retries as number;

    // 达上限 → retained_locally
    if (retryCount >= maxRetries) {
      const ts = now();
      db.prepare(
        `UPDATE report_deliveries SET status = 'retained_locally', last_attempt_at = @ts
         WHERE report_key = @rk AND channel = @ch`,
      ).run({ rk: p.reportKey, ch: p.channel, ts });
      const row = db
        .prepare("SELECT * FROM report_deliveries WHERE report_key = @rk AND channel = @ch")
        .get({ rk: p.reportKey, ch: p.channel }) as Record<string, unknown>;
      return mapDelivery(row);
    }

    // 重试投递
    const reportRow = db
      .prepare("SELECT * FROM parent_reports WHERE report_key = @rk")
      .get({ rk: p.reportKey }) as Record<string, unknown>;
    const deliverable: DeliverableReport = {
      reportKey: p.reportKey,
      contentJson: reportRow.content_json as string,
      contentHash: reportRow.content_hash as string,
      reportType: reportRow.report_type as string,
    };

    const channel = ctx.deliveryChannels[p.channel];
    const ts = now();
    let status: ReportDelivery["status"] = "failed";
    let errorCode: string | undefined;
    try {
      const result = channel.deliver(deliverable, {});
      status = result.success ? "sent" : "failed";
      errorCode = result.errorCode;
    } catch {
      status = "failed";
      errorCode = "DELIVERY_EXCEPTION";
    }

    const newRetryCount = retryCount + 1;
    const finalStatus = status === "sent" ? "sent" : newRetryCount >= maxRetries ? "retained_locally" : "failed";
    const sentAt = status === "sent" ? ts : null;

    db.prepare(
      `UPDATE report_deliveries SET status = @st, retry_count = @rc, error_code = @ec,
        sent_at = @sa, last_attempt_at = @la
       WHERE report_key = @rk AND channel = @ch`,
    ).run({
      st: finalStatus,
      rc: newRetryCount,
      ec: errorCode ?? null,
      sa: sentAt,
      la: ts,
      rk: p.reportKey,
      ch: p.channel,
    });

    writeReportDeliveredEvent(db, semesterId, p.reportKey, p.channel, finalStatus);

    const row = db
      .prepare("SELECT * FROM report_deliveries WHERE report_key = @rk AND channel = @ch")
      .get({ rk: p.reportKey, ch: p.channel }) as Record<string, unknown>;
    return mapDelivery(row);
  };
}

/** 列表查询（按 reportKey） */
export function handleDeliveriesList(ctx: S6Context): (params: unknown) => ReportDelivery[] {
  return (params: unknown): ReportDelivery[] => {
    const p = params as { reportKey?: string };
    if (!p.reportKey) throw badRequest("reportKey 不能为空");

    const { db } = findSemesterByReportKey(ctx, p.reportKey);
    const rows = db
      .prepare(
        "SELECT * FROM report_deliveries WHERE report_key = @rk ORDER BY created_at ASC",
      )
      .all({ rk: p.reportKey }) as Record<string, unknown>[];
    return rows.map(mapDelivery);
  };
}
