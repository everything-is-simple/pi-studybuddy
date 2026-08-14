import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const traceabilityRoot = resolve(process.cwd(), "docs", "traceability");

const requiredAssets = [
  "interaction-catalog.md",
  "error-catalog.md",
  "data-asset-catalog.md",
  "system-traceability.md",
  "operations-runbook.md",
  "release-evidence.md",
] as const;

describe("T-M5-009 traceability baseline", () => {
  it("publishes all six controlled governance assets", () => {
    for (const asset of requiredAssets) {
      expect(existsSync(resolve(traceabilityRoot, asset)), asset).toBe(true);
    }
  });

  it("keeps the required traceability relations and evidence boundaries explicit", () => {
    const contents = requiredAssets.map((asset) =>
      readFileSync(resolve(traceabilityRoot, asset), "utf8"),
    );
    const corpus = contents.join("\n");

    expect(corpus).toContain("T-M5-009");
    expect(corpus).toContain("CTRL-");
    expect(corpus).toContain("ACT-");
    expect(corpus).toContain("ERR-");
    expect(corpus).toContain("DATA-");
    expect(corpus).toContain("TEST-");
    expect(corpus).toContain("UAT-");
    expect(corpus).toContain("SQLite");
    expect(corpus).toContain("H:\\pi-studybuddy-tmp\\runs\\<task-id>\\");
    expect(corpus).toContain("%LOCALAPPDATA%\\PiStudyBuddy");
    expect(corpus).toContain("不等于真机 UAT");
    expect(corpus).toContain("不记录");
  });

  it("does not turn unknown coverage into a pass claim", () => {
    const interaction = readFileSync(
      resolve(traceabilityRoot, "interaction-catalog.md"),
      "utf8",
    );
    expect(interaction).toMatch(/未覆盖|待核验|阻塞/);
    expect(interaction).not.toContain("全部通过");
  });
});
