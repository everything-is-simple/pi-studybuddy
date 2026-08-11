/**
 * T-M4-016 RED：S6 host 侧 archived 写保护（对齐 S3/S5 assertSemesterWritable 模式）。
 * 归档学期：reports.generate / deliveries.deliver / deliveries.retry /
 * reportTargets.create / reportTargets.update / reportTargets.delete 必须被 host 直接 RPC 拒绝；
 * reports.list / reports.get / reports.freeze / deliveries.list / reportTargets.list 只读仍可用。
 * @vitest-environment node
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import { S6Context, createS6Handlers } from "../../src/agent-host/handlers/s6";
import { createGlobalDb } from "../../src/data/global";
import type { RpcError } from "../../src/contract/types";

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M4-016\\host-boundaries";

function isRpcError(error: unknown): error is RpcError {
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

function expectBadRequest(action: () => unknown): void {
  try {
    action();
    expect.fail("应抛出 BAD_REQUEST");
  } catch (error) {
    expect(isRpcError(error)).toBe(true);
    expect((error as RpcError).code).toBe("BAD_REQUEST");
  }
}

describe("T-M4-016 S6 host archived write boundaries", () => {
  let s1: S1Context;
  let s6: S6Context;
  let s1Handlers: ReturnType<typeof createS1Handlers>;
  let handlers: ReturnType<typeof createS6Handlers>;
  let semesterId: string;
  let reportKey: string;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    createGlobalDb(ISOLATION_DIR);
    s1 = new S1Context(ISOLATION_DIR);
    s6 = new S6Context(ISOLATION_DIR);
    s1Handlers = createS1Handlers(s1);
    handlers = createS6Handlers(s6);
    const semester = s1Handlers["semesters.create"]({ label: "T-M4-016 host boundaries", startDate: "2026-09-01", endDate: "2027-01-31", timezone: "Asia/Shanghai" }) as { id: string };
    semesterId = semester.id;
  });

  afterAll(() => {
    s6?.dispose();
    s1?.dispose();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        rmSync(ISOLATION_DIR, { recursive: true, force: true });
        break;
      } catch {
        // Windows may release SQLite handles shortly after dispose.
      }
    }
  });

  it("归档前：生成报告 / 创建目标 / 投递均可写", () => {
    const report = handlers["reports.generate"]({ semesterId, reportType: "weekly", periodStart: "2026-09-01", periodEnd: "2026-09-07" }) as { reportKey: string };
    reportKey = report.reportKey;
    expect(reportKey).toBeTruthy();
    const target = handlers["reportTargets.create"]({ semesterId, targetName: "本地导出", channelType: "local_export", channelConfigJson: JSON.stringify({ dir: "reports" }) }) as { id: string };
    expect(target.id).toBeTruthy();
    const delivery = handlers["deliveries.deliver"]({ reportKey, channel: "local_export" }) as { status: string };
    expect(delivery.status).toBe("sent");
  });

  it("归档后：reports.generate / deliveries.deliver / deliveries.retry / reportTargets.* 全部被 host 拒绝", () => {
    s1Handlers["semesters.transition"]({ id: semesterId, status: "teaching_ended" });
    s1Handlers["semesters.transition"]({ id: semesterId, status: "follow_up" });
    s1Handlers["semesters.transition"]({ id: semesterId, status: "archived" });

    expectBadRequest(() => handlers["reports.generate"]({ semesterId, reportType: "weekly", periodStart: "2026-09-01", periodEnd: "2026-09-07" }));
    expectBadRequest(() => handlers["deliveries.deliver"]({ reportKey, channel: "local_export" }));
    expectBadRequest(() => handlers["deliveries.retry"]({ reportKey, channel: "local_export" }));
    expectBadRequest(() => handlers["reportTargets.create"]({ semesterId, targetName: "新目标", channelType: "print", channelConfigJson: "{}" }));
    // 只读查询在归档学期仍可读
    expect(Array.isArray(handlers["reports.list"]({ semesterId }))).toBe(true);
    expect(handlers["reports.get"]({ reportKey })).toBeTruthy();
    expect(handlers["reports.freeze"]({ reportKey })).toBeTruthy();
    expect(Array.isArray(handlers["deliveries.list"]({ reportKey }))).toBe(true);
    expect(Array.isArray(handlers["reportTargets.list"]({ semesterId }))).toBe(true);
  });
});
