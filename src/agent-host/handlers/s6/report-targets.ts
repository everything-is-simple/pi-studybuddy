/**
 * T-M2-002 S6 reportTargets.* handler（06-API §3.8 + 05-ERD §2.2）
 *
 * 4 方法（全部操作 global.db parent_report_targets 表）：
 *   - list：按 semesterId 查询（不含已软删）
 *   - create：创建目标（真实渠道地址在 credential-vault，channelConfigJson 仅存别名）
 *   - update：更新目标（部分字段）
 *   - delete：软删除（deletedAt 非空）
 */
import { randomUUID } from "node:crypto";
import type { S6Context } from "./context";
import { assertSemesterExists, assertSemesterWritable } from "./lookup";
import { mapTarget } from "./dto";
import { badRequest, notFound } from "./errors";
import type { ChannelTestResult, ParentReportTarget, ReportChannel } from "../../../contract/types";
import type { DeliverableReport } from "./delivery-channels";
import { mergeCredentialConfig } from "./deliveries";

function now(): string {
  return new Date().toISOString();
}

const VALID_CHANNEL_TYPES: ReportChannel[] = ["local_export", "smtp", "feishu_webhook", "print"];

function validateChannelType(c: unknown): asserts c is ReportChannel {
  if (!VALID_CHANNEL_TYPES.includes(c as ReportChannel)) {
    throw badRequest(`无效 channelType：${String(c)}，应为 ${VALID_CHANNEL_TYPES.join("/")}`);
  }
}

function parseChannelConfig(raw: string, channelType: ReportChannel): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw badRequest("channelConfigJson 不是合法 JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest("channelConfigJson 必须是 JSON 对象");
  const config = value as Record<string, unknown>;
  const forbidden = channelType === "smtp"
    ? ["to", "from", "host", "port", "password", "credentialValue", "endpoint", "url", "webhookUrl"]
    : channelType === "feishu_webhook"
      ? ["url", "webhookUrl", "endpoint", "credentialValue", "secret", "token"]
      : ["password", "credentialValue", "secret", "token"];
  if (Object.keys(config).some((key) => forbidden.includes(key))) throw badRequest("渠道配置不得包含收件地址、端点或密钥");
  if (channelType !== "local_export" && Object.keys(config).some((key) => /path|dir/i.test(key))) {
    throw badRequest("远程渠道配置不得包含本地路径");
  }
  if (channelType === "local_export" && config.dir !== undefined && typeof config.dir !== "string") {
    throw badRequest("本地导出目录无效");
  }
  return config;
}

function normalizeStoredConfig(channelType: ReportChannel, config: Record<string, unknown>): string {
  return JSON.stringify(channelType === "local_export" && typeof config.dir === "string"
    ? { alias: "本地导出目录", dir: config.dir }
    : config);
}

/** 列表查询（不含已软删） */
export function handleReportTargetsList(
  ctx: S6Context,
): (params: unknown) => ParentReportTarget[] {
  return (params: unknown): ParentReportTarget[] => {
    const p = params as { semesterId: string };
    if (!p.semesterId) throw badRequest("semesterId 不能为空");
    assertSemesterExists(ctx, p.semesterId);

    const rows = ctx.globalDb
      .prepare(
        "SELECT * FROM parent_report_targets WHERE semester_id = @sid AND deleted_at IS NULL ORDER BY created_at DESC",
      )
      .all({ sid: p.semesterId }) as Record<string, unknown>[];
    return rows.map(mapTarget);
  };
}

/** 创建目标 */
export function handleReportTargetsCreate(
  ctx: S6Context,
): (params: unknown) => ParentReportTarget {
  return (params: unknown): ParentReportTarget => {
    const p = params as {
      semesterId: string;
      targetName: string;
      channelType: ReportChannel;
      channelConfigJson: string;
      credentialKey?: string;
    };
    if (!p.semesterId || !p.targetName || !p.channelConfigJson) {
      throw badRequest("semesterId/targetName/channelConfigJson 不能为空");
    }
    validateChannelType(p.channelType);
    assertSemesterExists(ctx, p.semesterId);
    assertSemesterWritable(ctx, p.semesterId);

    const channelConfig = parseChannelConfig(p.channelConfigJson, p.channelType);

    const id = randomUUID();
    const ts = now();
    ctx.globalDb
      .prepare(
        `INSERT INTO parent_report_targets (id, semester_id, target_name, channel_type,
          channel_config_json, credential_key, enabled, created_at, updated_at)
         VALUES (@id, @sid, @tn, @ct, @cj, @ck, 1, @ts, @ts)`,
      )
      .run({
        id,
        sid: p.semesterId,
        tn: p.targetName,
        ct: p.channelType,
        cj: normalizeStoredConfig(p.channelType, channelConfig),
        ck: p.credentialKey ?? null,
        ts,
      });

    const row = ctx.globalDb
      .prepare("SELECT * FROM parent_report_targets WHERE id = @id")
      .get({ id }) as Record<string, unknown>;
    return mapTarget(row);
  };
}

/** 更新目标（部分字段） */
export function handleReportTargetsUpdate(
  ctx: S6Context,
): (params: unknown) => ParentReportTarget {
  return (params: unknown): ParentReportTarget => {
    const p = params as { id: string; [k: string]: unknown };
    if (!p.id) throw badRequest("id 不能为空");

    const existing = ctx.globalDb
      .prepare("SELECT * FROM parent_report_targets WHERE id = @id AND deleted_at IS NULL")
      .get({ id: p.id }) as Record<string, unknown> | undefined;
    if (!existing) throw notFound("未找到该报告目标");
    assertSemesterWritable(ctx, existing.semester_id as string);

    const updates: string[] = [];
    const values: Record<string, string | number | null> = { id: p.id };
    if (p.targetName !== undefined) {
      updates.push("target_name = @tn");
      values.tn = p.targetName as string;
    }
    if (p.channelType !== undefined) {
      validateChannelType(p.channelType);
      updates.push("channel_type = @ct");
      values.ct = p.channelType as string;
    }
    if (p.channelConfigJson !== undefined) {
      const channelType = (p.channelType ?? existing.channel_type) as ReportChannel;
      validateChannelType(channelType);
      const channelConfig = parseChannelConfig(p.channelConfigJson as string, channelType);
      updates.push("channel_config_json = @cj");
      values.cj = normalizeStoredConfig(channelType, channelConfig);
    }
    if (p.credentialKey !== undefined) {
      updates.push("credential_key = @ck");
      values.ck = (p.credentialKey as string) ?? null;
    }
    if (p.enabled !== undefined) {
      if (p.enabled !== 0 && p.enabled !== 1) throw badRequest("enabled 必须为 0 或 1");
      updates.push("enabled = @en");
      values.en = p.enabled as number;
    }

    if (updates.length > 0) {
      updates.push("updated_at = @ts");
      values.ts = now();
      ctx.globalDb
        .prepare(`UPDATE parent_report_targets SET ${updates.join(", ")} WHERE id = @id`)
        .run(values);
    }

    const row = ctx.globalDb
      .prepare("SELECT * FROM parent_report_targets WHERE id = @id")
      .get({ id: p.id }) as Record<string, unknown>;
    return mapTarget(row);
  };
}

/**
 * 用户显式渠道验证：只允许 SMTP/飞书已启用目标，发送固定脱敏消息。
 * 不生成或读取真实学习报告，不写 report_deliveries，不持久化 health。
 */
export function handleReportTargetsSendTestMessage(
  ctx: S6Context,
): (params: unknown) => ChannelTestResult | Promise<ChannelTestResult> {
  return (params: unknown): ChannelTestResult | Promise<ChannelTestResult> => {
    const { targetId } = params as { targetId?: unknown };
    if (typeof targetId !== "string" || !targetId) throw badRequest("请选择需要验证的投递目标");
    const target = ctx.globalDb
      .prepare("SELECT * FROM parent_report_targets WHERE id = @id AND enabled = 1 AND deleted_at IS NULL")
      .get({ id: targetId }) as Record<string, unknown> | undefined;
    if (!target) throw notFound("未找到可用的投递目标");
    const channel = target.channel_type as ReportChannel;
    if (channel !== "smtp" && channel !== "feishu_webhook") {
      throw badRequest("当前目标不支持发送测试消息");
    }
    assertSemesterWritable(ctx, target.semester_id as string);

    const send = (credentialValue?: string): ChannelTestResult | Promise<ChannelTestResult> => {
      let config: Record<string, unknown>;
      try {
        const parsed = JSON.parse(target.channel_config_json as string);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
        config = mergeCredentialConfig(channel, parsed as Record<string, unknown>, credentialValue);
      } catch {
        return { channel, status: "failed", message: "渠道配置无效，请检查后重试。" };
      }
      if (!credentialValue) return { channel, status: "failed", message: "请先保存该渠道的凭据后重试。" };
      const testMessage: DeliverableReport = {
        reportKey: "configuration-test",
        reportType: "configuration-test",
        contentHash: "not-persisted",
        contentJson: JSON.stringify({ type: "configuration-test", message: "这是一条配置验证消息，不包含学习资料或学习报告。" }),
      };
      const result = ctx.deliveryChannels[channel].deliver(testMessage, config);
      const map = (value: { success: boolean }): ChannelTestResult => value.success
        ? { channel, status: "sent", message: "测试消息已发送。" }
        : { channel, status: "failed", message: "测试消息发送失败，请检查配置后重试。" };
      return result instanceof Promise ? result.then(map).catch(() => map({ success: false })) : map(result);
    };

    const credentialKey = target.credential_key as string | undefined;
    if (!credentialKey) return send(undefined);
    if (ctx.credentialGetterAsync) {
      return ctx.credentialGetterAsync(credentialKey).then((value) => send(value ?? undefined)).catch(() => send(undefined));
    }
    try {
      return send(ctx.credentialGetter(credentialKey));
    } catch {
      return send(undefined);
    }
  };
}

/** 软删除 */
export function handleReportTargetsDelete(
  ctx: S6Context,
): (params: unknown) => void {
  return (params: unknown): void => {
    const p = params as { id: string };
    if (!p.id) throw badRequest("id 不能为空");

    const existing = ctx.globalDb
      .prepare("SELECT 1 FROM parent_report_targets WHERE id = @id AND deleted_at IS NULL")
      .get({ id: p.id });
    if (!existing) throw notFound("未找到该报告目标");
    const targetRow = ctx.globalDb
      .prepare("SELECT semester_id FROM parent_report_targets WHERE id = @id AND deleted_at IS NULL")
      .get({ id: p.id }) as { semester_id: string };
    assertSemesterWritable(ctx, targetRow.semester_id);

    ctx.globalDb
      .prepare("UPDATE parent_report_targets SET deleted_at = @ts, updated_at = @ts WHERE id = @id")
      .run({ id: p.id, ts: now() });
  };
}
