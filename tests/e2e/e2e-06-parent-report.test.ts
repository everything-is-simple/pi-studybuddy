/**
 * E2E-06 家长报告生成与投递（08-Test §6.2）
 *
 * 流程：触发报告 → 规则生成 → 冻结 → UUID 检测通过 → 本地导出 → 文件存在 → 投递状态 sent
 *   渠道隔离：SMTP(mock) 失败不影响本地导出
 *
 * 断言（08-Test §7.2 隐私边界 + §7.3 证据驱动 + §7.6 备份恢复无关）：
 *   - reports.generate 规则生成 + content_hash SHA-256 + privacy_check_passed=1（§7.2）
 *   - reports.freeze 重新检测 UUID + 校验 hash 一致性（§7.2）
 *   - reportTargets.create 创建 local_export target（channelConfigJson 含 dir）
 *   - deliveries.deliver(local_export) → sent + 文件存在（本地导出）
 *   - 渠道隔离：deliver(smtp) 失败（注入 failing，test-main）不影响 local_export 已 sent（§7.2 + 07-WF §3.2）
 *   - 重复投递同渠道被拒（PK(report_key, channel) 去重）（05-ERD §3.6.2）
 *
 * 数据隔离（AGENTS.md §5.3）：写 H:\pi-studybuddy-tmp\runs\T-M2-009\e2e\e2e-06\
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { launchElectron, type LaunchedApp } from "./helpers/electron-launcher";
import { RpcDriver } from "./helpers/rpc-driver";
import { SEMESTER_FIXTURE, isRpcError } from "./helpers/fixtures";
import type { Semester, ParentReport, ReportDelivery, ParentReportTarget } from "../../src/contract/types";

describe("E2E-06 家长报告生成与投递", () => {
  let app: LaunchedApp;
  let rpc: RpcDriver;
  let semesterId: string;
  let reportKey: string;
  let exportDir: string;

  beforeAll(async () => {
    app = await launchElectron("e2e-06");
    rpc = new RpcDriver(app.channel);
    await rpc.init();

    const sem = await rpc.call<Semester>("semesters.create", SEMESTER_FIXTURE);
    semesterId = sem.id;
    exportDir = path.join(app.dataRoot, "reports");
  }, 60_000);

  afterAll(async () => {
    await app?.dispose();
  });

  it("E06-01 规则生成报告（reports.generate）— 冻结快照 §7.2", async () => {
    const report = await rpc.call<ParentReport>("reports.generate", {
      semesterId,
      reportType: "weekly",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-07",
    });
    expect(report.reportKey).toBeTruthy();
    expect(report.reportType).toBe("weekly");
    expect(report.ruleGenerated).toBe(1);
    expect(report.privacyCheckPassed).toBe(1);
    expect(report.contentHash).toMatch(/^[0-9a-f]{64}$/);
    reportKey = report.reportKey;
  });

  it("E06-02 冻结报告（reports.freeze）— UUID 检测 + hash 校验 §7.2", async () => {
    const report = await rpc.call<ParentReport>("reports.freeze", { reportKey });
    expect(report.reportKey).toBe(reportKey);
    expect(report.privacyCheckPassed).toBe(1);
    // content_json 不含完整 UUID（防泄露 §7.2）
    const serialized = JSON.stringify(report.contentJson);
    expect(serialized).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("E06-03 创建 local_export 投递目标（reportTargets.create）", async () => {
    const target = await rpc.call<ParentReportTarget>("reportTargets.create", {
      semesterId,
      targetName: "本地导出",
      channelType: "local_export",
      channelConfigJson: JSON.stringify({ dir: exportDir }),
    });
    expect(target.id).toBeTruthy();
    expect(target.channelType).toBe("local_export");
    expect(target.enabled).toBe(1);
  });

  it("E06-04 本地导出投递（deliveries.deliver）→ sent + 文件存在", async () => {
    const delivery = await rpc.call<ReportDelivery>("deliveries.deliver", {
      reportKey,
      channel: "local_export",
    });
    expect(delivery.reportKey).toBe(reportKey);
    expect(delivery.channel).toBe("local_export");
    expect(delivery.status).toBe("sent");
    expect(delivery.maxRetries).toBeGreaterThan(0);
    // 本地导出文件存在
    const filePath = path.join(exportDir, `${reportKey}.json`);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("E06-05 渠道隔离：SMTP 失败不影响 local_export（§7.2 + 07-WF §3.2）", async () => {
    // smtp 渠道在 test-main 注入 failing mock → status=failed
    const smtp = await rpc.call<ReportDelivery>("deliveries.deliver", {
      reportKey,
      channel: "smtp",
    });
    expect(smtp.channel).toBe("smtp");
    expect(smtp.status).toBe("failed");
    // local_export 已 sent 的记录不受影响
    const deliveries = await rpc.call<ReportDelivery[]>("deliveries.list", { reportKey });
    const localExport = deliveries.find((d) => d.channel === "local_export");
    expect(localExport?.status).toBe("sent");
  });

  it("E06-06 重复投递同渠道被拒（PK 去重 §7.4）", async () => {
    try {
      await rpc.call("deliveries.deliver", { reportKey, channel: "local_export" });
      throw new Error("重复投递应被拒但未拒绝");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as { code: string }).code).toBe("BAD_REQUEST");
    }
  });
});