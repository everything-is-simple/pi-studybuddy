import fs from "node:fs";
import path from "node:path";
import type { SkillManifest } from "../../contract/types";
import {
  getManagedNativeSkillPaths,
  getManagedRuntimeResourcesForCurrentApp,
  loadManagedRuntimeResources,
  resolveManagedRuntimeResources,
  resolveVerifiedManagedResource,
  type ManagedRuntimeResource,
} from "../runtime-resources";

interface ManagedSkill extends SkillManifest {
  resource: ManagedRuntimeResource;
  skillPath: string;
  description: string;
}

function readFrontmatter(content: string): { name: string; description: string } | null {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/);
  if (!match) return null;
  const name = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!name || !description) return null;
  return { name, description };
}

function loadManagedSkills(): ManagedSkill[] {
  const location = getManagedRuntimeResourcesForCurrentApp();
  const manifest = loadManagedRuntimeResources(location);
  return manifest.resources
    .filter((resource) => resource.kind === "native-skill")
    .map((resource) => {
      const skillPath = resolveVerifiedManagedResource(location, resource);
      const content = fs.readFileSync(skillPath, "utf8");
      const frontmatter = readFrontmatter(content);
      if (!frontmatter) throw new Error("应用学习技能清单无效，请修复或重新安装应用");
      if (frontmatter.name !== resource.id) throw new Error("应用学习技能标识不一致，请修复或重新安装应用");
      return {
        name: frontmatter.name,
        version: resource.version,
        description: frontmatter.description,
        source: "local" as const,
        resource,
        skillPath,
      };
    });
}

function safeManagedSkills(): ManagedSkill[] {
  try {
    return loadManagedSkills();
  } catch {
    return [];
  }
}

export function createSkillHandlers() {
  return {
    "skills.list": (): SkillManifest[] => safeManagedSkills().map(({ resource: _resource, skillPath: _skillPath, ...manifest }) => manifest),
    "skills.search": (params: unknown): SkillManifest[] => {
      const query = typeof (params as { query?: unknown })?.query === "string"
        ? (params as { query: string }).query.trim().toLocaleLowerCase()
        : "";
      return safeManagedSkills()
        .filter((skill) => !query || `${skill.name} ${skill.description}`.toLocaleLowerCase().includes(query))
        .map(({ resource: _resource, skillPath: _skillPath, ...manifest }) => manifest);
    },
    "skills.install": (_params: unknown): SkillManifest => {
      throw { code: "BAD_REQUEST", message: "当前版本仅提供随应用安装的学习技能" };
    },
    "skills.getContent": (params: unknown): { skillMd: string; helpers: string[] } => {
      const name = (params as { name?: unknown })?.name;
      const skill = safeManagedSkills().find((item) => item.name === name);
      if (!skill) throw { code: "NOT_FOUND", message: "技能不存在" };
      return { skillMd: fs.readFileSync(skill.skillPath, "utf8"), helpers: [] };
    },
    "skills.uninstall": (_params: unknown): void => {
      throw { code: "BAD_REQUEST", message: "随应用安装的学习技能不能在此卸载" };
    },
  };
}

export function getManagedSkillPathsForSession(): string[] {
  return getManagedNativeSkillPaths(getManagedRuntimeResourcesForCurrentApp());
}

export function getManagedSkillPathsForRoot(developmentRoot: string): string[] {
  const location = resolveManagedRuntimeResources({ isPackaged: false, developmentRoot: path.resolve(developmentRoot) });
  return getManagedNativeSkillPaths(location);
}
