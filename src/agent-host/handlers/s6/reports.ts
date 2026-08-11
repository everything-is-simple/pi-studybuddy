/**
 * T-M2-002 S6 reports.* handler（06-API §3.8 + 07-WF §3.1）
 *
 * 4 方法：
 *   - generate：规则生成 + AI 润色（可注入，失败降级）+ assertNoSensitiveLeak + 冻结快照 + study_events
 *   - freeze：冻结快照（content_json + content_hash SHA-256）+ UUID 检测
 *   - get：查询返回 DTO
 *   - list：按 semesterId/reportType 过滤
 */
import { createHash, randomUUID } from "node:crypto";
import type { S6Context } from "./context";
import { assertSemesterExists, assertSemesterWritable, findSemesterByReportKey } from "./lookup";
import { generateRuleReport } from "./report-generator";
import { assertNoSensitiveLeak } from "./leak-detector";
import { writeReportGeneratedEvent } from "./events";
import { mapReport } from "./dto";
import { badRequest, notFound, internalError } from "./errors";
import type { ParentReport, ParentReportType } from "../../../contract/types";

function now(): string {
  return new Date().toISOString();
}

const VALID_REPORT_TYPES: ParentReportType[] = ["daily", "weekly", "monthly", "exam_reminder"];

function validateReportType(t: unknown): asserts t is ParentReportType {
  if (!VALID_REPORT_TYPES.includes(t as ParentReportType)) {
    throw badRequest(`无效 reportType：${String(t)}，应为 ${VALID_REPORT_TYPES.join("/")}`);
  }
}

/** 生成家长报告（规则 + AI 润色 + UUID 检测 + 冻结快照） */
export function handleReportsGenerate(ctx: S6Context): (params: unknown) => ParentReport {
  return (params: unknown): ParentReport => {
    const p = params as {
      semesterId: string;
      reportType: ParentReportType;
      periodStart: string;
      periodEnd: string;
    };
    if (!p.semesterId || !p.periodStart || !p.periodEnd) {
      throw badRequest("semesterId/periodStart/periodEnd 不能为空");
    }
    validateReportType(p.reportType);
    assertSemesterExists(ctx, p.semesterId);
    assertSemesterWritable(ctx, p.semesterId);

    const db = ctx.semesterDb(p.semesterId);
    const ruleReport = generateRuleReport(db, p.semesterId, p.periodStart, p.periodEnd);

    // assertNoSensitiveLeak UUID 检测（规则报告阶段）
    assertNoSensitiveLeak(ruleReport);

    // AI 润色（可注入，失败降级保留规则报告）
    let finalContent: unknown = ruleReport;
    let aiPolished = 0;
    let aiModel: string | undefined;
    let promptVersion: string | undefined;
    try {
      const polished = ctx.reportPolisher.polish(ruleReport);
      if (polished.polished) {
        finalContent = polished.content;
        aiPolished = 1;
        aiModel = polished.aiModel;
        promptVersion = polished.promptVersion;
      }
    } catch {
      // AI 润色失败 → 保留规则报告，aiPolished=0（08-Test §5.5 降级不阻塞）
      aiPolished = 0;
    }

    // 冻结快照
    const contentJsonStr = JSON.stringify(finalContent);
    const contentHash = createHash("sha256").update(contentJsonStr).digest("hex");
    const reportKey = randomUUID();
    const ts = now();

    db.prepare(
      `INSERT INTO parent_reports (report_key, semester_id, report_type, period_start, period_end,
        content_json, content_hash, rule_generated, ai_polished, ai_model, prompt_version,
        privacy_check_passed, generated_at, created_at)
       VALUES (@rk, @sid, @rt, @ps, @pe, @cj, @ch, 1, @ap, @am, @pv, 1, @ts, @ts)`,
    ).run({
      rk: reportKey,
      sid: p.semesterId,
      rt: p.reportType,
      ps: p.periodStart,
      pe: p.periodEnd,
      cj: contentJsonStr,
      ch: contentHash,
      ap: aiPolished,
      am: aiModel ?? null,
      pv: promptVersion ?? null,
      ts,
    });

    writeReportGeneratedEvent(db, p.semesterId, reportKey);

    const row = db
      .prepare("SELECT * FROM parent_reports WHERE report_key = @rk")
      .get({ rk: reportKey }) as Record<string, unknown>;
    return mapReport(row);
  };
}

/** 冻结快照（重新检测 UUID + 验证 content_hash 一致性） */
export function handleReportsFreeze(ctx: S6Context): (params: unknown) => ParentReport {
  return (params: unknown): ParentReport => {
    const p = params as { reportKey: string };
    if (!p.reportKey) throw badRequest("reportKey 不能为空");

    const { db, semesterId } = findSemesterByReportKey(ctx, p.reportKey);
    void semesterId;
    const row = db
      .prepare("SELECT * FROM parent_reports WHERE report_key = @rk")
      .get({ rk: p.reportKey }) as Record<string, unknown> | undefined;
    if (!row) throw notFound("未找到该家长报告");

    // UUID 检测
    const content = JSON.parse(row.content_json as string);
    assertNoSensitiveLeak(content);

    // 验证 hash 一致性（防篡改）
    const contentHash = createHash("sha256")
      .update(row.content_json as string)
      .digest("hex");
    if (contentHash !== (row.content_hash as string)) {
      throw internalError("content_hash 不一致，报告可能被篡改");
    }

    return mapReport(row);
  };
}

/** 查询报告 */
export function handleReportsGet(ctx: S6Context): (params: unknown) => ParentReport {
  return (params: unknown): ParentReport => {
    const p = params as { reportKey: string };
    if (!p.reportKey) throw badRequest("reportKey 不能为空");

    const { db } = findSemesterByReportKey(ctx, p.reportKey);
    const row = db
      .prepare("SELECT * FROM parent_reports WHERE report_key = @rk")
      .get({ rk: p.reportKey }) as Record<string, unknown> | undefined;
    if (!row) throw notFound("未找到该家长报告");
    return mapReport(row);
  };
}

/** 列表查询 */
export function handleReportsList(ctx: S6Context): (params: unknown) => ParentReport[] {
  return (params: unknown): ParentReport[] => {
    const p = params as { semesterId?: string; reportType?: ParentReportType };
    if (!p.semesterId) throw badRequest("semesterId 不能为空");
    assertSemesterExists(ctx, p.semesterId);

    const db = ctx.semesterDb(p.semesterId);
    let rows: Record<string, unknown>[];
    if (p.reportType) {
      rows = db
        .prepare(
          "SELECT * FROM parent_reports WHERE semester_id = @sid AND report_type = @rt ORDER BY created_at DESC",
        )
        .all({ sid: p.semesterId, rt: p.reportType }) as Record<string, unknown>[];
    } else {
      rows = db
        .prepare(
          "SELECT * FROM parent_reports WHERE semester_id = @sid ORDER BY created_at DESC",
        )
        .all({ sid: p.semesterId }) as Record<string, unknown>[];
    }
    return rows.map(mapReport);
  };
}
