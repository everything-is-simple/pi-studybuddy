import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  main?: string;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  build?: {
    appId?: string;
    productName?: string;
    asar?: boolean;
    directories?: { output?: string };
    files?: string[];
    win?: {
      target?: Array<{ target?: string; arch?: string[] }>;
    };
    nsis?: {
      oneClick?: boolean;
      allowToChangeInstallationDirectory?: boolean;
    };
  };
};

const repoRoot = path.resolve(__dirname, "../..");
const manifestPath = path.join(repoRoot, "package.json");
const packageSmokePath = path.join(repoRoot, "scripts", "package-smoke.mjs");

function readManifest(): PackageManifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
}

describe("T-M4-009 electron-builder configuration", () => {
  it("pins electron-builder and exposes a reproducible Windows packaging command", () => {
    const manifest = readManifest();

    expect(manifest.devDependencies?.["electron-builder"]).toBe("26.15.3");
    expect(manifest.scripts?.["package:win"]).toContain("pnpm build");
    expect(manifest.scripts?.["package:win"]).toContain("electron-builder");
    expect(manifest.scripts?.["package:win"]).toContain("--win nsis --x64");
    expect(manifest.scripts?.["package:win"]).toContain("--publish never");
    expect(manifest.scripts?.["package:smoke"]).toBe("node scripts/package-smoke.mjs");
  });

  it("declares the packaged Electron entrypoint and x64 NSIS target", () => {
    const manifest = readManifest();
    const winTarget = manifest.build?.win?.target ?? [];

    expect(manifest.main).toBe("dist/main/main.js");
    expect(manifest.build?.appId).toBe("com.pi.studybuddy");
    expect(manifest.build?.productName).toBe("Pi StudyBuddy");
    expect(manifest.build?.asar).toBe(true);
    expect(manifest.build?.directories?.output).toBe("release");
    expect(winTarget).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "nsis", arch: ["x64"] }),
      ]),
    );
  });

  it("keeps packaging limited to runtime output and excludes source/test material", () => {
    const manifest = readManifest();
    const files = manifest.build?.files ?? [];

    expect(files).toEqual(expect.arrayContaining(["dist/**/*"]));
    expect(files).toEqual(expect.arrayContaining(["package.json"]));
    expect(files).toEqual(expect.arrayContaining(["!src{,/**/*}"]));
    expect(files).toEqual(expect.arrayContaining(["!tests{,/**/*}"]));
    expect(files).toEqual(expect.arrayContaining(["!docs{,/**/*}"]));
    expect(files).toEqual(expect.arrayContaining(["!scripts{,/**/*}"]));
  });

  it("uses an assisted installer configuration for first-time desktop verification", () => {
    const manifest = readManifest();

    expect(manifest.build?.nsis?.oneClick).toBe(false);
    expect(manifest.build?.nsis?.allowToChangeInstallationDirectory).toBe(true);
  });

  it("isolates the packaged Electron Chromium profile during installation smoke", () => {
    const packageSmoke = readFileSync(packageSmokePath, "utf8");

    expect(packageSmoke).toContain("--user-data-dir=");
    expect(packageSmoke).toContain("electron-user-data");
  });
});
