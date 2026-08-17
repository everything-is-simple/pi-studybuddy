import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RuntimeResourcesError,
  loadManagedRuntimeResources,
  resolveManagedRuntimeResources,
} from "../../src/agent-host/runtime-resources";

const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-006\\unit-runtime-resources";
const REPO_ROOT = path.resolve(__dirname, "../..");

function createManifest(root: string, manifest: unknown): void {
  const runtimeRoot = path.join(root, "runtime-resources");
  mkdirSync(runtimeRoot, { recursive: true });
  writeFileSync(path.join(runtimeRoot, "manifest.json"), JSON.stringify(manifest), "utf8");
}

describe("T-M5-006 受管运行资源 manifest", () => {
  it("T-M5-006-MANIFEST-01：受管资源必须有应用内 manifest，不能把开发目录或 ~/.pi 当作发布来源", () => {
    const resources = resolveManagedRuntimeResources({
      isPackaged: false,
      developmentRoot: REPO_ROOT,
    });

    expect(resources.root).toBe(path.join(REPO_ROOT, "runtime-resources"));
    expect(resources.manifestPath).toBe(path.join(resources.root, "manifest.json"));
    expect(resources.root).not.toContain(".pi");
  });

  it("T-M5-006-MANIFEST-02：每个受管资源必须声明来源、版本、许可证、SHA-256、相对路径、体积、owner 和更新责任", () => {
    const resources = resolveManagedRuntimeResources({
      isPackaged: false,
      developmentRoot: REPO_ROOT,
    });
    const manifest = loadManagedRuntimeResources(resources);

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.resources.length).toBeGreaterThan(0);
    for (const resource of manifest.resources) {
      expect(resource.id).toMatch(/^[a-z0-9._-]+$/);
      expect(resource.source).not.toHaveLength(0);
      expect(resource.version).not.toHaveLength(0);
      expect(resource.license).not.toHaveLength(0);
      expect(resource.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(resource.relativePath).not.toMatch(/^(?:[A-Za-z]:|\\\\|\/)/);
      expect(resource.sizeBytes).toBeGreaterThan(0);
      expect(resource.owner).not.toHaveLength(0);
      expect(resource.updateResponsibility).not.toHaveLength(0);
    }
  });

  it("T-M5-006-RUNTIME-01：发布态只从应用 resources 解析，受管资源缺失或篡改时固定失败", () => {
    const root = path.join(RUN_ROOT, "missing");
    rmSync(root, { recursive: true, force: true });
    createManifest(root, { schemaVersion: 1, resources: [] });

    const resolved = resolveManagedRuntimeResources({
      isPackaged: true,
      resourcesPath: root,
    });
    expect(() => loadManagedRuntimeResources(resolved)).toThrow(RuntimeResourcesError);
  });
});
