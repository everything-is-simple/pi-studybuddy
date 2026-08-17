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
import { findSemesterByReportKey, assertSemesterWritable } from "./lookup";
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

function parseCredentialConfig(channel: ReportChannel, credentialValue: string | undefined): Record<string, unknown> | undefined {
  if (!credentialValue) return undefined;
  if (channel !== "smtp") return { credentialValue };
  try {
    const parsed = JSON.parse(credentialValue) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const value = parsed as Record<string, unknown>;
      const result: Record<string, unknown> = { credentialValue: typeof value.password === "string" ? value.password : undefined };
      for (const key of ["host", "port", "from", "to"]) {
        if (value[key] !== undefined) result[key] = value[key];
      }
      return result;
    }
  } catch {
    // Legacy SMTP credentials remain supported as the password value.
  }
  return { credentialValue };
}

/**
 * 将 DPAPI 中短暂解密的渠道凭据合并到 host 内存配置；绝不写回 SQLite、JSON 或 DTO。
 * SMTP 支持结构化 vault 内容，以便地址/端点与授权码同属 DPAPI 边界。
 */
export function mergeCredentialConfig(channel: ReportChannel, config: Record<string, unknown>, credentialValue: string | undefined): Record<string, unknown> {
  const credentialConfig = parseCredentialConfig(channel, credentialValue);
  return credentialConfig ? { ...config, ...credentialConfig } : config;
}
function loadTargetConfig(
  ctx: S6Context,
  semesterId: string,
  channel: ReportChannel,
): { config: Record<string, unknown>; errorCode?: string } {
  const target = ctx.globalDb
    .prepare(`SELECT * FROM parent_report_targets
      WHERE semester_id = @sid AND channel_type = @ch AND enabled = 1 AND deleted_at IS NULL
      ORDER BY updated_at DESC, rowid DESC LIMIT 1`)
    .get({ sid: semesterId, ch: channel }) as Record<string, unknown> | undefined;
  if (!target) return { config: {}, errorCode: "DELIVERY_TARGET_NOT_CONFIGURED" };
  const credentialKey = target.credential_key as string | undefined;
  let credentialValue: string | undefined;
  if (credentialKey) {
    try {
      credentialValue = ctx.credentialGetter(credentialKey);
    } catch {
      return { config: {}, errorCode: "DELIVERY_CREDENTIAL_UNAVAILABLE" };
    }
  }
  try {
    const config = JSON.parse(target.channel_config_json as string);
    if (!config || typeof config !== "object" || Array.isArray(config)) return { config: {}, errorCode: "DELIVERY_TARGET_INVALID" };
    return { config: mergeCredentialConfig(channel, config as Record<string, unknown>, credentialValue) };
  } catch {
    return { config: {}, errorCode: "DELIVERY_TARGET_INVALID" };
  }
}

async function loadTargetConfigAsync(
  ctx: S6Context,
  semesterId: string,
  channel: ReportChannel,
): Promise<{ config: Record<string, unknown>; errorCode?: string }> {
  const target = ctx.globalDb
    .prepare(`SELECT * FROM parent_report_targets
      WHERE semester_id = @sid AND channel_type = @ch AND enabled = 1 AND deleted_at IS NULL
      ORDER BY updated_at DESC, rowid DESC LIMIT 1`)
    .get({ sid: semesterId, ch: channel }) as Record<string, unknown> | undefined;
  if (!target) return { config: {}, errorCode: "DELIVERY_TARGET_NOT_CONFIGURED" };
  const credentialKey = target.credential_key as string | undefined;
  let credentialValue: string | undefined;
  if (credentialKey) {
    try {
      credentialValue = (await ctx.credentialGetterAsync?.(credentialKey)) ?? undefined;
      if (!credentialValue) return { config: {}, errorCode: "DELIVERY_CREDENTIAL_UNAVAILABLE" };
    } catch {
      return { config: {}, errorCode: "DELIVERY_CREDENTIAL_UNAVAILABLE" };
    }
  }
  try {
    const config = JSON.parse(target.channel_config_json as string);
    if (!config || typeof config !== "object" || Array.isArray(config)) return { config: {}, errorCode: "DELIVERY_TARGET_INVALID" };
    return { config: mergeCredentialConfig(channel, config as Record<string, unknown>, credentialValue) };
  } catch {
    return { config: {}, errorCode: "DELIVERY_TARGET_INVALID" };
  }
}
export function handleDeliveriesDeliver(ctx: S6Context): (params: unknown) => ReportDelivery | Promise<ReportDelivery> {
  return (params: unknown): ReportDelivery | Promise<ReportDelivery> => {
    const p = params as { reportKey: string; channel: ReportChannel };
    if (!p.reportKey) throw badRequest("reportKey 不能为空");
    validateChannel(p.channel);
    const { db, semesterId } = findSemesterByReportKey(ctx, p.reportKey);
    assertSemesterWritable(ctx, semesterId);
    const existing = db.prepare("SELECT 1 FROM report_deliveries WHERE report_key = @rk AND channel = @ch").get({ rk: p.reportKey, ch: p.channel });
    if (existing) throw badRequest("该报告已在此渠道投递，请使用 retry 重试");

    const finish = (target: { config: Record<string, unknown>; errorCode?: string }): ReportDelivery | Promise<ReportDelivery> => {
      const reportRow = db.prepare("SELECT * FROM parent_reports WHERE report_key = @rk").get({ rk: p.reportKey }) as Record<string, unknown>;
      const deliverable: DeliverableReport = {
        reportKey: p.reportKey,
        contentJson: reportRow.content_json as string,
        contentHash: reportRow.content_hash as string,
        reportType: reportRow.report_type as string,
      };
      const channel = ctx.deliveryChannels[p.channel];
      const ts = now();
      const persist = (result: { success: boolean; errorCode?: string }): ReportDelivery => {
        const status: ReportDelivery["status"] = result.success ? "sent" : "failed";
        db.prepare(`INSERT INTO report_deliveries (report_key, channel, status, retry_count, max_retries, error_code, sent_at, last_attempt_at, created_at) VALUES (@rk, @ch, @st, 0, @mr, @ec, @sa, @la, @ts)`).run({
          rk: p.reportKey,
          ch: p.channel,
          st: status,
          mr: MAX_RETRIES,
          ec: result.errorCode ?? null,
          sa: status === "sent" ? ts : null,
          la: ts,
          ts,
        });
        writeReportDeliveredEvent(db, semesterId, p.reportKey, p.channel, status);
        return mapDelivery(db.prepare("SELECT * FROM report_deliveries WHERE report_key = @rk AND channel = @ch").get({ rk: p.reportKey, ch: p.channel }) as Record<string, unknown>);
      };
      if (target.errorCode) return persist({ success: false, errorCode: target.errorCode });
      try {
        const result = channel.deliver(deliverable, target.config);
        return result instanceof Promise ? result.then(persist).catch(() => persist({ success: false, errorCode: "DELIVERY_EXCEPTION" })) : persist(result);
      } catch {
        return persist({ success: false, errorCode: "DELIVERY_EXCEPTION" });
      }
    };

    if (ctx.credentialGetterAsync) return loadTargetConfigAsync(ctx, semesterId, p.channel).then(finish);
    return finish(loadTargetConfig(ctx, semesterId, p.channel));
  };
}

/** 重试投递（retry_count+1，达上限 retained_locally） */
export function handleDeliveriesRetry(ctx: S6Context): (params: unknown) => ReportDelivery | Promise<ReportDelivery> {
  return (params: unknown): ReportDelivery | Promise<ReportDelivery> => {
    const p = params as { reportKey: string; channel: ReportChannel };
    if (!p.reportKey) throw badRequest("reportKey 不能为空");
    validateChannel(p.channel);
    const { db, semesterId } = findSemesterByReportKey(ctx, p.reportKey);
    assertSemesterWritable(ctx, semesterId);
    const existing = db
      .prepare("SELECT * FROM report_deliveries WHERE report_key = @rk AND channel = @ch")
      .get({ rk: p.reportKey, ch: p.channel }) as Record<string, unknown> | undefined;
    if (!existing) throw notFound("未找到该投递记录");
    const retryCount = existing.retry_count as number;
    const maxRetries = existing.max_retries as number;
    if (retryCount >= maxRetries) {
      const ts = now();
      db.prepare(
        `UPDATE report_deliveries SET status = 'retained_locally', last_attempt_at = @ts
         WHERE report_key = @rk AND channel = @ch`,
      ).run({ rk: p.reportKey, ch: p.channel, ts });
      return mapDelivery(db.prepare("SELECT * FROM report_deliveries WHERE report_key = @rk AND channel = @ch").get({ rk: p.reportKey, ch: p.channel }) as Record<string, unknown>);
    }

    const reportRow = db.prepare("SELECT * FROM parent_reports WHERE report_key = @rk").get({ rk: p.reportKey }) as Record<string, unknown>;
    const deliverable: DeliverableReport = {
      reportKey: p.reportKey,
      contentJson: reportRow.content_json as string,
      contentHash: reportRow.content_hash as string,
      reportType: reportRow.report_type as string,
    };
    const channel = ctx.deliveryChannels[p.channel];
    const persist = (result: { success: boolean; errorCode?: string }): ReportDelivery => {
      const status: ReportDelivery["status"] = result.success ? "sent" : "failed";
      const finalStatus = status === "sent" ? "sent" : retryCount + 1 >= maxRetries ? "retained_locally" : "failed";
      const ts = now();
      db.prepare(
        `UPDATE report_deliveries SET status = @st, retry_count = @rc, error_code = @ec,
          sent_at = @sa, last_attempt_at = @la
         WHERE report_key = @rk AND channel = @ch`,
      ).run({
        st: finalStatus,
        rc: retryCount + 1,
        ec: result.errorCode ?? null,
        sa: status === "sent" ? ts : null,
        la: ts,
        rk: p.reportKey,
        ch: p.channel,
      });
      writeReportDeliveredEvent(db, semesterId, p.reportKey, p.channel, finalStatus);
      return mapDelivery(db.prepare("SELECT * FROM report_deliveries WHERE report_key = @rk AND channel = @ch").get({ rk: p.reportKey, ch: p.channel }) as Record<string, unknown>);
    };
    const attempt = (target: { config: Record<string, unknown>; errorCode?: string }): ReportDelivery | Promise<ReportDelivery> => {
      if (target.errorCode) return persist({ success: false, errorCode: target.errorCode });
      try {
        const result = channel.deliver(deliverable, target.config);
        return result instanceof Promise ? result.then(persist).catch(() => persist({ success: false, errorCode: "DELIVERY_EXCEPTION" })) : persist(result);
      } catch {
        return persist({ success: false, errorCode: "DELIVERY_EXCEPTION" });
      }
    };
    if (ctx.credentialGetterAsync) return loadTargetConfigAsync(ctx, semesterId, p.channel).then(attempt);
    return attempt(loadTargetConfig(ctx, semesterId, p.channel));
  };
}

/** 列表查询（按 reportKey） */
export function handleDeliveriesList(ctx: S6Context): (params: unknown) => ReportDelivery[] {
  return (params: unknown): ReportDelivery[] => {
    const p = params as { reportKey?: string };
    if (!p.reportKey) throw badRequest("reportKey 不能为空");

    const { db } = findSemesterByReportKey(ctx, p.reportKey);
    const rows = db
      .prepare("SELECT * FROM report_deliveries WHERE report_key = @rk ORDER BY created_at ASC")
      .all({ rk: p.reportKey }) as Record<string, unknown>[];
    return rows.map(mapDelivery);
  };
}
