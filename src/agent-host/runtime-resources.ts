import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type ManagedRuntimeResourceKind = "native-skill";

export interface ManagedRuntimeResource {
  id: string;
  kind: ManagedRuntimeResourceKind;
  source: string;
  version: string;
  license: string;
  sha256: string;
  relativePath: string;
  sizeBytes: number;
  owner: string;
  updateResponsibility: string;
}

export interface ManagedRuntimeResources {
  schemaVersion: 1;
  resources: ManagedRuntimeResource[];
}

export interface RuntimeResourcesLocation {
  root: string;
  manifestPath: string;
}

export class RuntimeResourcesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeResourcesError";
  }
}

function isSafeRelativePath(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && !path.isAbsolute(value)
    && !value.split(/[\\/]+/).some((segment) => segment === ".." || segment.length === 0);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isResource(value: unknown): value is ManagedRuntimeResource {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const resource = value as Record<string, unknown>;
  return typeof resource.id === "string"
    && /^[a-z0-9._-]+$/.test(resource.id)
    && resource.kind === "native-skill"
    && isNonEmptyString(resource.source)
    && isNonEmptyString(resource.version)
    && isNonEmptyString(resource.license)
    && typeof resource.sha256 === "string"
    && /^[a-f0-9]{64}$/.test(resource.sha256)
    && isSafeRelativePath(resource.relativePath)
    && typeof resource.sizeBytes === "number"
    && Number.isSafeInteger(resource.sizeBytes)
    && resource.sizeBytes > 0
    && isNonEmptyString(resource.owner)
    && isNonEmptyString(resource.updateResponsibility);
}

export function resolveManagedRuntimeResources(options: {
  isPackaged: boolean;
  resourcesPath?: string;
  developmentRoot?: string;
}): RuntimeResourcesLocation {
  const root = options.isPackaged
    ? options.resourcesPath && path.join(options.resourcesPath, "runtime-resources")
    : options.developmentRoot && path.join(options.developmentRoot, "runtime-resources");
  if (!root) throw new RuntimeResourcesError("应用运行资源目录不可用，请重新安装应用");
  const resolvedRoot = path.resolve(root);
  return {
    root: resolvedRoot,
    manifestPath: path.join(resolvedRoot, "manifest.json"),
  };
}

export function loadManagedRuntimeResources(location: RuntimeResourcesLocation): ManagedRuntimeResources {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(location.manifestPath, "utf8"));
  } catch {
    throw new RuntimeResourcesError("应用运行资源清单不可用，请修复或重新安装应用");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new RuntimeResourcesError("应用运行资源清单无效，请修复或重新安装应用");
  }
  const manifest = parsed as { schemaVersion?: unknown; resources?: unknown };
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.resources) || manifest.resources.length === 0 || !manifest.resources.every(isResource)) {
    throw new RuntimeResourcesError("应用运行资源清单无效，请修复或重新安装应用");
  }
  const ids = new Set<string>();
  for (const resource of manifest.resources) {
    if (ids.has(resource.id)) throw new RuntimeResourcesError("应用运行资源清单重复，请修复或重新安装应用");
    ids.add(resource.id);
  }
  return { schemaVersion: 1, resources: manifest.resources };
}

export function resolveVerifiedManagedResource(
  location: RuntimeResourcesLocation,
  resource: ManagedRuntimeResource,
): string {
  const filePath = path.resolve(location.root, resource.relativePath);
  const relative = path.relative(location.root, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new RuntimeResourcesError("应用运行资源路径无效，请修复或重新安装应用");
  }
  let content: Buffer;
  try {
    content = fs.readFileSync(filePath);
  } catch {
    throw new RuntimeResourcesError("应用运行资源缺失，请修复或重新安装应用");
  }
  if (content.byteLength !== resource.sizeBytes || createHash("sha256").update(content).digest("hex") !== resource.sha256) {
    throw new RuntimeResourcesError("应用运行资源校验失败，请修复或重新安装应用");
  }
  return filePath;
}

export function getManagedNativeSkillPaths(location: RuntimeResourcesLocation): string[] {
  const manifest = loadManagedRuntimeResources(location);
  return manifest.resources
    .filter((resource) => resource.kind === "native-skill")
    .map((resource) => resolveVerifiedManagedResource(location, resource));
}

export function getManagedRuntimeResourcesForCurrentApp(): RuntimeResourcesLocation {
  const packagedRoot = process.resourcesPath
    ? path.join(process.resourcesPath, "runtime-resources")
    : undefined;
  // utilityProcess does not expose Electron's app module reliably. The managed manifest
  // itself is the authoritative packaged-runtime marker.
  if (packagedRoot && fs.existsSync(path.join(packagedRoot, "manifest.json"))) {
    return resolveManagedRuntimeResources({ isPackaged: true, resourcesPath: process.resourcesPath });
  }
  return resolveManagedRuntimeResources({
    isPackaged: false,
    developmentRoot: path.resolve(__dirname, "..", ".."),
  });
}
