/**
 * pi-studybuddy toolchain Node probe（03-Arch §6.5 第 2 点）
 *
 * 专用 probe：探测 Node 版本并判定 health。
 * MINIMUM_NODE_VERSION="22.19.0"，MAXIMUM_VERIFIED_NODE_MAJOR=24。
 * health：unsupported（版本过低）/ unverified（超出验证范围）/ healthy。
 */
import { execFileSync } from "node:child_process";

const MINIMUM_NODE_VERSION = "22.0.0";
const MAXIMUM_VERIFIED_NODE_MAJOR = 24;

export interface NodeProbeResult {
  health: "unsupported" | "unverified" | "healthy";
  version?: string;
  execPath?: string;
  arch?: string;
  platform?: string;
}

/** 执行 Node probe */
export function probeNode(execPath: string): NodeProbeResult {
  try {
    const code = `console.log(JSON.stringify({ versions: { node: process.version }, arch: process.arch, platform: process.platform, execPath: process.execPath }))`;
    const stdout = execFileSync(execPath, ["-e", code], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const payload = JSON.parse(stdout.trim()) as {
      versions?: { node?: string };
      arch?: string;
      platform?: string;
      execPath?: string;
    };

    const version = payload.versions?.node?.replace(/^v/, "") ?? "";
    const arch = payload.arch;
    const platform = payload.platform;

    const health = nodeHealth(version);
    return { health, version, execPath, arch, platform };
  } catch (err) {
    console.error("probeNode error for", execPath, ":", String(err));
    return { health: "unsupported" };
  }
}

function nodeHealth(version: string): "unsupported" | "unverified" | "healthy" {
  if (!version) return "unsupported";
  const major = Number.parseInt(version.split(".")[0] ?? "0", 10);
  if (major < 22) return "unsupported";
  if (compareVersions(version, MINIMUM_NODE_VERSION) < 0) return "unsupported";
  if (major > MAXIMUM_VERIFIED_NODE_MAJOR) return "unverified";
  return "healthy";
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aNum = aParts[i] ?? 0;
    const bNum = bParts[i] ?? 0;
    if (aNum !== bNum) return aNum - bNum;
  }
  return 0;
}