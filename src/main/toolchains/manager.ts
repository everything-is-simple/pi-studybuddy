/**
 * pi-studybuddy toolchain manager（03-Arch §6.5）
 *
 * 装配 discovery→probe→install→rescan，管理 60s TTL + focus 重扫。
 * 产出 ToolchainStatus[] 供 contract handlers 消费。
 *
 * 参考 pi-desktop manager.ts，独立重实现。
 */
import type { ToolchainStatus } from "../../contract/types";
import { discoverCandidates } from "./discovery-registry";
import { probeNode, type NodeProbeResult } from "./probes/node";
import { probeCapability } from "./probes/capabilities";
import { normalizeAndDedupeCandidates } from "./candidate-normalizer";
import { buildPublicToolchainState } from "./public-state";
import { ToolCapabilityId, TOOL_CAPABILITY_IDS } from "./index";
import { install as installToolchain } from "./installer";
import { buildRuntimeCapabilityStatuses } from "./runtime-capabilities";

const RESCAN_TTL_MS = 60_000; // 60s

/** capability ID → 可执行文件搜索名（如 js.node → node） */
export function executableNameForCapability(capabilityId: string): string {
  const map: Record<string, string> = {
    "shell.bash": "bash",
    "shell.powershell": "powershell",
    "vcs.git": "git",
    "js.node": "node",
    "js.npm": "npm",
    "js.npx": "npx",
    "js.bun": "bun",
    "python.interpreter": "python",
    "python.uv": "uv",
    "python.uvx": "uvx",
    "search.rg": "rg",
    "search.fd": "fd",
    "data.jq": "jq",
    "network.curl": "curl",
  };
  return map[capabilityId] ?? capabilityId;
}

/** 获取 capability 的人类可读名称 */
export function nameForCapability(capabilityId: string): string {
  const map: Record<string, string> = {
    "shell.bash": "Bash",
    "shell.powershell": "PowerShell",
    "vcs.git": "Git",
    "js.node": "Node.js",
    "js.npm": "npm",
    "js.npx": "npx",
    "js.bun": "Bun",
    "python.interpreter": "Python",
    "python.uv": "uv",
    "python.uvx": "uvx",
    "search.rg": "ripgrep",
    "search.fd": "fd",
    "data.jq": "jq",
    "network.curl": "curl",
  };
  return map[capabilityId] ?? capabilityId;
}

export interface ToolchainManager {
  /** 获取全部工具状态（含缓存，60s TTL） */
  list(): ToolchainStatus[];
  /** 安装指定 capability 到 userData（本任务仅框架） */
  install(capabilityId: string): Promise<ToolchainStatus>;
  /** 强制重新扫描 PATH */
  rescan(): ToolchainStatus[];
  /** 注册变更回调 */
  onChanged(cb: (statuses: ToolchainStatus[]) => void): void;
  dispose(): void;
}

export function createToolchainManager(): ToolchainManager {
  let cache: ToolchainStatus[] | null = null;
  let lastScanTime = 0;
  const changeCallbacks: Array<(statuses: ToolchainStatus[]) => void> = [];

  function probeAll(): ToolchainStatus[] {
    const results: ToolchainStatus[] = [];
    for (const capabilityId of TOOL_CAPABILITY_IDS) {
      const execName = executableNameForCapability(capabilityId);
      const seeds = discoverCandidates(execName);
      const deduped = normalizeAndDedupeCandidates(seeds);
      if (deduped.length === 0) {
        results.push(
          buildPublicToolchainState(capabilityId, "unsupported"),
        );
        continue;
      }

      const first = deduped[0];
      if (capabilityId === "js.node") {
        const nodeResult = probeNode(first.path);
        results.push(
          buildPublicToolchainState(
            capabilityId,
            nodeResult.health,
            nodeResult.version,
            nodeResult.execPath,
          ),
        );
      } else {
        const capaResult = probeCapability(first.path);
        results.push(
          buildPublicToolchainState(
            capabilityId,
            capaResult.health,
            capaResult.version,
            first.path,
          ),
        );
      }
    }
    return [...results, ...buildRuntimeCapabilityStatuses()];
  }

  function scan(): ToolchainStatus[] {
    const results = probeAll();
    cache = results;
    lastScanTime = Date.now();
    return results;
  }

  function list(): ToolchainStatus[] {
    if (cache && Date.now() - lastScanTime < RESCAN_TTL_MS) {
      return cache;
    }
    return scan();
  }

  function rescan(): ToolchainStatus[] {
    const results = scan();
    for (const cb of changeCallbacks) {
      cb(results);
    }
    return results;
  }

  async function install(capabilityId: string): Promise<ToolchainStatus> {
    const result = installToolchain(capabilityId);
    if (!result.success) {
      throw { code: "INSTALLER_UNAVAILABLE", message: "当前版本不提供该工具的自动安装器" };
    }
    const results = rescan();
    return results.find((status) => status.capabilityId === capabilityId)
      ?? buildPublicToolchainState(capabilityId, "unsupported");
  }

  function onChanged(cb: (statuses: ToolchainStatus[]) => void): void {
    changeCallbacks.push(cb);
  }

  function dispose(): void {
    cache = null;
    changeCallbacks.length = 0;
  }

  return { list, install, rescan, onChanged, dispose };
}