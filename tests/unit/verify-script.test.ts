import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");
const verifyScript = readFileSync(path.join(repoRoot, "scripts", "verify.mjs"), "utf8");

describe("verify script skip labels", () => {
  it("T-M5-006-VERIFY-01: preserves digits so --skip=e2e skips the e2e check", () => {
    expect(verifyScript).toContain('replace(/[^a-z0-9]/g, "")');
    expect(verifyScript).toContain("opts.skip.has(normalizedCheckLabel(label))");
  });
});
