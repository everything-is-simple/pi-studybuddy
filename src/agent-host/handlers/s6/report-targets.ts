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
import { assertSemesterExists } from "./lookup";
import { mapTarget } from "./dto";
import { badRequest, notFound } from "./errors";
import type { ParentReportTarget, ReportChannel } from "../../../contract/types";

function now(): string {
  return new Date().toISOString();
}

const VALID_CHANNEL_TYPES: ReportChannel[] = ["local_export", "smtp", "feishu_webhook", "print"];

function validateChannelType(c: unknown): asserts c is ReportChannel {
  if (!VALID_CHANNEL_TYPES.includes(c as ReportChannel)) {
    throw badRequest(`无效 channelType：${String(c)}，应为 ${VALID_CHANNEL_TYPES.join("/")}`);
  }
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

    // 验证 channelConfigJson 是合法 JSON
    try {
      JSON.parse(p.channelConfigJson);
    } catch {
      throw badRequest("channelConfigJson 不是合法 JSON");
    }

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
        cj: p.channelConfigJson,
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
      try {
        JSON.parse(p.channelConfigJson as string);
      } catch {
        throw badRequest("channelConfigJson 不是合法 JSON");
      }
      updates.push("channel_config_json = @cj");
      values.cj = p.channelConfigJson as string;
    }
    if (p.credentialKey !== undefined) {
      updates.push("credential_key = @ck");
      values.ck = (p.credentialKey as string) ?? null;
    }
    if (p.enabled !== undefined) {
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

    ctx.globalDb
      .prepare("UPDATE parent_report_targets SET deleted_at = @ts, updated_at = @ts WHERE id = @id")
      .run({ id: p.id, ts: now() });
  };
}
