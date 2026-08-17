import { beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { createSettingsHandlers } from "../../src/agent-host/handlers/settings";

const ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-011\\settings-sections";

describe("T-M5-011 七类设置的非敏感分区（RED）", () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(ROOT, { recursive: true });
  });

  it("SET-SECTION-01 学习技能和关于更新偏好保存后可由新 handler 重启回读", () => {
    const first = createSettingsHandlers(ROOT);

    expect(first["settings.getSection"]({ asset: "skills" })).toEqual({ showUnavailableSkills: true });
    expect(first["settings.getSection"]({ asset: "console" })).toEqual({ checkUpdatesOnStart: true });
    expect(first["settings.updateSection"]({ asset: "skills", data: { showUnavailableSkills: false } })).toEqual({ showUnavailableSkills: false });
    expect(first["settings.updateSection"]({ asset: "console", data: { checkUpdatesOnStart: false } })).toEqual({ checkUpdatesOnStart: false });

    const restarted = createSettingsHandlers(ROOT);
    expect(restarted["settings.getSection"]({ asset: "skills" })).toEqual({ showUnavailableSkills: false });
    expect(restarted["settings.getSection"]({ asset: "console" })).toEqual({ checkUpdatesOnStart: false });
  });

  it("SET-SECTION-02 配置状态只返回受限字段，且不暴露路径、栈、密钥或 health 原始诊断", async () => {
    const handlers = createSettingsHandlers(ROOT, { credentialService: { listKeys: async () => [] } });
    const statuses = await handlers["settings.getConfigStatus"]({});

    expect(statuses.map((item) => item.asset)).toEqual(["settings", "models", "pi-models", "skills", "console", "credentials"]);
    expect(JSON.stringify(statuses)).not.toMatch(/[a-z]:[\\/]|\\\\|\b(?:sk-|bearer|authorization)\b|\bat\s+.+\(/i);
    expect(statuses.every((item) => typeof item.recoverable === "boolean")).toBe(true);
  });

  it("SET-SECTION-03 DPAPI vault 不可用仅显示固定可恢复状态", async () => {
    const handlers = createSettingsHandlers(ROOT, { credentialService: { listKeys: async () => { throw new Error("C:\\private\\vault failed"); } } });

    const credentials = (await handlers["settings.getConfigStatus"]({})).find((item) => item.asset === "credentials");

    expect(credentials).toEqual({ asset: "credentials", state: "unavailable", message: "系统加密暂不可用，请解锁 Windows 后重试。", recoverable: true });
  });
});
