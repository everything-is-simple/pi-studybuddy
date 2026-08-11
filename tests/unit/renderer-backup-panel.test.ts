/**
 * T-M2-008 RED: BackupPanel 备份恢复面板静态渲染测试
 *
 * 权威依据：09-UI §6.1-§6.3（备份恢复 UI）+ §7.5（单机零云）
 *
 * 测试策略：
 * - 手动备份入口 + 调度配置 + 历史列表
 * - 恢复流程（content_hash/schema_version/冲突/integrity_check）
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BackupPanel } from "../../src/renderer/components/BackupPanel";
import type { BackupRecord, RestoreResult } from "../../src/contract/types";

// ---------- 夹具数据 ----------

const fixtureBackups: BackupRecord[] = [
  {
    id: "a1b2c3d4-5678-9012-abcd-ef0123456789",
    semesterId: "sem-001",
    courseInstanceId: "course-001",
    backupType: "manual",
    targetPath: "H:\\backups",
    zipFilename: "backup-20260808.zip",
    contentHash: "abc123def456",
    fileSizeBytes: 1024000,
    status: "completed",
    startedAt: "2026-08-08T10:00:00Z",
    completedAt: "2026-08-08T10:01:00Z",
    createdAt: "2026-08-08T10:00:00Z",
  },
  {
    id: "b2c3d4e5-6789-0123-abcd-ef1234567890",
    semesterId: "sem-001",
    courseInstanceId: "course-001",
    backupType: "scheduled",
    targetPath: "H:\\backups",
    zipFilename: "backup-20260807.zip",
    contentHash: "xyz789uvw012",
    fileSizeBytes: 980000,
    status: "completed",
    scheduleCron: "0 2 * * *",
    startedAt: "2026-08-07T02:00:00Z",
    completedAt: "2026-08-07T02:01:00Z",
    createdAt: "2026-08-07T02:00:00Z",
  },
];

const fixtureRestoreResult: RestoreResult = {
  success: true,
  restoredCourseId: "course-001",
  conflictResolved: "none",
  tablesImported: ["materials", "notes", "practice_sessions"],
  filesRestored: 5,
  integrityCheck: "ok",
  schemaVersion: "1.0",
};

// ---------- BackupPanel 手动备份 ----------

describe("BackupPanel 手动备份（09-UI §6.1）", () => {
  it("渲染手动备份入口", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, { backups: fixtureBackups }),
    );
    expect(html).toContain("备份");
    expect(html).toContain("手动");
  });

  it("渲染备份目标目录选择入口", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, { backups: fixtureBackups }),
    );
    expect(html).toContain("备份目录");
    expect(html).toContain("选择备份目录");
  });
});

// ---------- BackupPanel 调度配置 ----------

describe("BackupPanel 调度配置（09-UI §6.1）", () => {
  it("渲染调度配置入口", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, { backups: fixtureBackups }),
    );
    expect(html).toContain("调度");
  });

  it("渲染 cron 表达式输入", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, { backups: fixtureBackups }),
    );
    expect(html).toContain("cron");
  });
});

// ---------- BackupPanel 历史列表 ----------

describe("BackupPanel 历史列表（09-UI §6.1）", () => {
  it("渲染备份历史列表", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, { backups: fixtureBackups }),
    );
    expect(html).toContain("backup-20260808.zip");
    expect(html).toContain("backup-20260807.zip");
  });

  it("渲染备份类型标识（手动/调度）", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, { backups: fixtureBackups }),
    );
    expect(html).toContain("手动");
    expect(html).toContain("调度");
  });

  it("ShortId：不展示完整 UUID（§11.1 铁律）", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, { backups: fixtureBackups }),
    );
    expect(html).not.toContain("a1b2c3d4-5678-9012-abcd-ef0123456789");
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("渲染恢复入口按钮", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, { backups: fixtureBackups }),
    );
    expect(html).toContain("恢复");
  });
});

// ---------- BackupPanel 恢复流程 ----------

describe("BackupPanel 恢复流程（09-UI §6.2 + §7.5）", () => {
  it("validating 阶段渲染校验中提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, {
        backups: fixtureBackups,
        restorePhase: "validating",
      }),
    );
    expect(html).toContain("校验中");
  });

  it("渲染 content_hash 校验结果（§6.2）", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, {
        backups: fixtureBackups,
        restorePhase: "validating",
        hashValid: true,
      }),
    );
    expect(html).toContain("content_hash");
    expect(html).toContain("通过");
  });

  it("渲染 schema_version 校验结果（§6.2）", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, {
        backups: fixtureBackups,
        restorePhase: "validating",
        schemaCompatible: true,
      }),
    );
    expect(html).toContain("schema_version");
    expect(html).toContain("兼容");
  });

  it("conflict 阶段渲染冲突解决弹窗（§6.2）", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, {
        backups: fixtureBackups,
        restorePhase: "conflict",
      }),
    );
    expect(html).toContain("冲突");
    expect(html).toContain("覆盖");
    expect(html).toContain("新建");
  });

  it("restoring 阶段渲染恢复中提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, {
        backups: fixtureBackups,
        restorePhase: "restoring",
      }),
    );
    expect(html).toContain("恢复中");
  });

  it("completed 阶段渲染 integrity_check 结果（§6.2）", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, {
        backups: fixtureBackups,
        restorePhase: "completed",
        restoreResult: fixtureRestoreResult,
      }),
    );
    expect(html).toContain("integrity_check");
    expect(html).toContain("ok");
  });

  it("completed 阶段渲染恢复详情", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, {
        backups: fixtureBackups,
        restorePhase: "completed",
        restoreResult: fixtureRestoreResult,
      }),
    );
    expect(html).toContain("5");
    expect(html).toContain("materials");
  });

  it("failed 阶段渲染失败提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, {
        backups: fixtureBackups,
        restorePhase: "failed",
        restoreError: "content_hash 校验失败",
      }),
    );
    expect(html).toContain("失败");
  });
});

// ---------- BackupPanel 空状态 ----------

describe("BackupPanel 空状态", () => {
  it("无备份历史时渲染提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(BackupPanel, { backups: [] }),
    );
    expect(html).toContain("暂无");
  });
});
