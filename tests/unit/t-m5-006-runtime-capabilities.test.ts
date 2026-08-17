/**
 * T-M5-006 runtime capability state RED.
 *
 * 权威：T-M5-006 计划 §4/§6，运行能力 health 为启动/重扫派生状态，
 * 不持久化为配置 SoT，不泄露本机路径。
 */
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRuntimeCapabilityStatuses } from "../../src/main/toolchains/runtime-capabilities";
import { resolveManagedRuntimeResources, type RuntimeResourcesLocation } from "../../src/agent-host/runtime-resources";

const WINDOWS_PATH = /[A-Za-z]:[\\/]/;
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-006\\unit-runtime-capabilities";

function createVerifiedRuntimeFixture(): { location: RuntimeResourcesLocation; skillPath: string } {
  const root = path.join(RUN_ROOT, "integrity");
  rmSync(root, { recursive: true, force: true });
  const skillPath = path.join(root, "runtime-resources", "skills", "fixture", "SKILL.md");
  mkdirSync(path.dirname(skillPath), { recursive: true });
  const content = "---\\nname: fixture\\ndescription: fixture\\n---\\n";
  writeFileSync(skillPath, content, "utf8");
  const bytes = Buffer.from(content, "utf8");
  writeFileSync(
    path.join(root, "runtime-resources", "manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      resources: [{
        id: "fixture-skill",
        kind: "native-skill",
        source: "test",
        version: "0.0.1",
        license: "TEST",
        sha256: createHash("sha256").update(bytes).digest("hex"),
        relativePath: "skills/fixture/SKILL.md",
        sizeBytes: bytes.byteLength,
        owner: "test",
        updateResponsibility: "test",
      }],
    }),
    "utf8",
  );
  return {
    location: resolveManagedRuntimeResources({ isPackaged: true, resourcesPath: root }),
    skillPath,
  };
}

describe("T-M5-006 runtime capability statuses", () => {
  it("RUNTIME-CAPA-01: publishes bundled pi, extension and native skills as managed runtime capabilities", () => {
    const statuses = buildRuntimeCapabilityStatuses({
      platform: "win32",
      env: {},
      managedSkillCount: 2,
      manifestAvailable: true,
    });

    expect(statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capabilityId: "runtime.pi",
        health: "healthy",
        source: "bundled",
        managed: true,
        required: true,
      }),
      expect.objectContaining({
        capabilityId: "runtime.studybuddy-extension",
        health: "healthy",
        source: "bundled",
        managed: true,
        required: true,
      }),
      expect.objectContaining({
        capabilityId: "runtime.native-skills",
        health: "healthy",
        source: "bundled",
        managed: true,
        required: true,
        version: "2 skills",
      }),
    ]));
  });

  it("RUNTIME-CAPA-02: reports optional OCR, whisper, edge-tts and WPS without absolute paths", () => {
    const statuses = buildRuntimeCapabilityStatuses({
      platform: "win32",
      env: {
        PI_STUDYBUDDY_OCR_PYTHON: "C:\\private\\python.exe",
        PI_STUDYBUDDY_OCR_BRIDGE: "C:\\private\\ocr_bridge.py",
        PI_STUDYBUDDY_WHISPER_CLI: "C:\\private\\whisper-cli.exe",
        PI_STUDYBUDDY_WHISPER_MODEL: "C:\\private\\ggml.bin",
        PI_STUDYBUDDY_EDGE_TTS_CLI: "C:\\private\\edge-tts.exe",
      },
      managedSkillCount: 2,
      manifestAvailable: true,
    });

    const byId = new Map(statuses.map((status) => [status.capabilityId, status]));
    expect(byId.get("learning.ocr")?.health).toBe("unverified");
    expect(byId.get("learning.whisper")?.health).toBe("unverified");
    expect(byId.get("tts.edge-tts")?.health).toBe("unverified");
    expect(byId.get("learning.wps")?.source).toBe("external_optional");
    expect(byId.get("learning.wps")?.required).toBe(false);

    for (const status of statuses) {
      expect(status.path).toBeUndefined();
      expect(JSON.stringify(status)).not.toMatch(WINDOWS_PATH);
    }
  });

  it("RUNTIME-CAPA-03: marks managed runtime unhealthy when a declared skill is missing or tampered", () => {
    const fixture = createVerifiedRuntimeFixture();
    const healthy = buildRuntimeCapabilityStatuses({
      platform: "win32",
      env: {},
      runtimeResourcesLocation: fixture.location,
    });
    expect(healthy.find((status) => status.capabilityId === "runtime.native-skills")).toEqual(expect.objectContaining({
      health: "healthy",
      version: "1 skills",
    }));

    writeFileSync(fixture.skillPath, "tampered", "utf8");
    const tampered = buildRuntimeCapabilityStatuses({
      platform: "win32",
      env: {},
      runtimeResourcesLocation: fixture.location,
    });
    expect(tampered.find((status) => status.capabilityId === "runtime.pi")).toEqual(expect.objectContaining({
      health: "unsupported",
      reason: "应用运行资源缺失，请修复或重新安装应用",
    }));
    expect(tampered.find((status) => status.capabilityId === "runtime.native-skills")).toEqual(expect.objectContaining({
      health: "unsupported",
      reason: "应用运行资源缺失，请修复或重新安装应用",
    }));
  });

  it("RUNTIME-CAPA-04: keeps missing optional capabilities recoverable and SAPI visible on Windows", () => {
    const statuses = buildRuntimeCapabilityStatuses({
      platform: "win32",
      env: {},
      managedSkillCount: 0,
      manifestAvailable: false,
    });

    expect(statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ capabilityId: "tts.sapi", health: "healthy", source: "os", required: true }),
      expect.objectContaining({ capabilityId: "learning.ocr", health: "unsupported", required: false }),
      expect.objectContaining({ capabilityId: "learning.whisper", health: "unsupported", required: false }),
      expect.objectContaining({ capabilityId: "tts.edge-tts", health: "unsupported", required: false }),
      expect.objectContaining({ capabilityId: "runtime.native-skills", health: "unsupported", required: true }),
    ]));

    for (const capabilityId of ["learning.ocr", "learning.whisper", "tts.edge-tts", "learning.wps"]) {
      const status = statuses.find((item) => item.capabilityId === capabilityId);
      expect(status?.recovery).toBeTruthy();
      expect(status?.reason).toBeTruthy();
    }
  });
});
