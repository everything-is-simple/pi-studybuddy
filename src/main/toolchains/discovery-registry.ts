/**
 * pi-studybuddy toolchain discovery-registry（03-Arch §6.5 第 1 点）
 *
 * 扫描系统 PATH，发现 14 种 capability 的可执行文件候选。
 * MAX_SEEDS=320、MAX_ENUMERATED_CHILDREN=64 边界防护。
 *
 * 参考 pi-desktop discovery-registry.ts，独立重实现。
 */
import fs from "node:fs";
import path from "node:path";

const MAX_ENUMERATED_CHILDREN = 64;
const MAX_SEEDS = 320;

export interface DiscoveryFileSystem {
  isFile(filePath: string): boolean;
  readDirectoryNames(directoryPath: string): string[];
}

export const nodeDiscoveryFileSystem: DiscoveryFileSystem = {
  isFile(filePath) {
    try {
      return fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  },
  readDirectoryNames(directoryPath) {
    try {
      return fs
        .readdirSync(directoryPath, { withFileTypes: true })
        .filter((entry) => entry.isFile() || entry.isSymbolicLink())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, "en"))
        .slice(0, MAX_ENUMERATED_CHILDREN);
    } catch {
      return [];
    }
  },
};

export interface ExecutableSeed {
  path: string;
}

/** 根据 capability 名称返回候选可执行文件名清单（Windows 加 .exe/.cmd 等） */
export function executableNames(name: string): string[] {
  const base = name.toLowerCase();
  if (process.platform === "win32") {
    return [`${base}.exe`, `${base}.cmd`, `${base}.bat`];
  }
  return [base];
}

/** 扫描 PATH 发现可执行文件候选 */
export function discoverCandidates(
  capabilityName: string,
  fileSystem: DiscoveryFileSystem = nodeDiscoveryFileSystem,
): ExecutableSeed[] {
  const pathEnv = process.env.PATH ?? "";
  const dirs = pathEnv
    .split(path.delimiter)
    .map((d) => d.trim())
    .filter(Boolean);
  const names = executableNames(capabilityName);
  const seeds: ExecutableSeed[] = [];

  for (const dir of dirs) {
    if (seeds.length >= MAX_SEEDS) break;
    const children = fileSystem.readDirectoryNames(dir);
    for (const child of children) {
      if (seeds.length >= MAX_SEEDS) break;
      if (names.includes(child.toLowerCase())) {
        const fullPath = path.join(dir, child);
        if (fileSystem.isFile(fullPath)) {
          seeds.push({ path: fullPath });
        }
      }
    }
  }

  return seeds;
}