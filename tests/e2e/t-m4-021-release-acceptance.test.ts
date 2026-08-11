/**
 * T-M4-021：M4 收官验收 E2E（01-TRD §7 决策 6 v0.2.3 + 04-Todo §6.6 + 08-Test §5/§5.7）。
 *
 * 在干净 master 上：重新构建 x64 NSIS setup（当前 master 已含 T-M4-009 后全部代码与 T-M4-025 修复）
 * → SHA-256 记录 → 隔离静默安装 → 至少两次启动（CDP 受控 piBridge 全链：renderer → preload →
 * system.ping → global.db → 代表性业务 RPC semesters.create 往返）→ 发布证据矩阵断言。
 * 运行产物（安装包/安装目录/用户数据/日志）仅落入 H:\pi-studybuddy-tmp\runs\T-M4-021\。
 */
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-021\\e2e-acceptance";
const INSTALL_DIR = path.join(RUN_ROOT, "install");
const RELEASE_DIR = path.join(PROJECT_ROOT, "release");
const INSTALLED_EXE = path.join(INSTALL_DIR, "Pi StudyBuddy.exe");
// Windows 下 pnpm 是 .cmd shim，execFile 需显式扩展名；node 为真实 exe 可直接调用
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

/** 执行命令并返回 stdout/stderr 摘要（避免把安装细节/密钥回显） */
async function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number; shell?: boolean } = {}): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd: opts.cwd ?? PROJECT_ROOT,
      env: opts.env ?? process.env,
      timeout: opts.timeout ?? 300_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
      shell: opts.shell ?? false,
    });
    return { stdout: stdout.slice(0, 2000), stderr: stderr.slice(0, 2000) };
  } catch (error) {
    const item = error as { stdout?: string; stderr?: string; message?: string };
    throw new Error(`命令失败: ${cmd} ${args.join(" ")} :: ${item.message ?? ""} :: ${(item.stdout ?? "").slice(0, 500)}`);
  }
}

function sha256(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

/** 步骤 1：pnpm package:win 重新构建 x64 NSIS setup（干净 master 当前代码；瞬时锁/网络失败重试一次） */
async function buildSetup(): Promise<string> {
  fs.mkdirSync(RUN_ROOT, { recursive: true });
  // ELECTRON_MIRROR：依赖下载走 npmmirror（GitHub CDN 在本机网络下极不稳定）；
  // 属构建依赖下载参数，不影响安装/启动/RPC 验收语义（验收通道仍为真实安装产物）。
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await run(PNPM, ["package:win"], { cwd: PROJECT_ROOT, timeout: 900_000, shell: true, env: { ...process.env, ELECTRON_MIRROR: "https://npmmirror.com/mirrors/electron/" } });
      break;
    } catch (error) {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        continue;
      }
      throw error;
    }
  }
  const candidates = fs
    .readdirSync(RELEASE_DIR)
    .filter((name) => name.endsWith(".exe") && /Setup/i.test(name));
  if (candidates.length === 0) throw new Error("未生成 x64 NSIS setup 产物");
  return path.join(RELEASE_DIR, candidates[0]);
}

/** 步骤 2：隔离静默安装（NSIS /S + /D） */
async function silentInstall(setupPath: string): Promise<string> {
  fs.rmSync(INSTALL_DIR, { recursive: true, force: true });
  fs.mkdirSync(INSTALL_DIR, { recursive: true });
  await run(setupPath, ["/S", `/D=${INSTALL_DIR}`], { cwd: path.dirname(setupPath), timeout: 180_000 });
  if (!fs.existsSync(INSTALLED_EXE)) throw new Error("隔离安装后未找到已安装可执行文件");
  return INSTALLED_EXE;
}

/** 步骤 3：已安装应用两次启动 + CDP 全链验证（scripts/package-smoke.mjs，T-M4-021 run dir） */
async function runInstalledVerification(appPath: string): Promise<string> {
  // 清理 package-smoke 运行子目录，避免与全量套件前序 Electron 实例的 profile/数据根锁冲突
  for (const sub of ["package-data-root", "package-profile"]) {
    fs.rmSync(path.join(RUN_ROOT, sub), { recursive: true, force: true });
  }
  // 终止可能残留的已安装应用实例（全量套件并行/串行执行边界）
  try {
    await execFileAsync("taskkill", ["/F", "/IM", "Pi StudyBuddy.exe"], { windowsHide: true });
  } catch {
    /* 无残留实例属正常 */
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  const { stdout } = await run("node", ["scripts/package-smoke.mjs"], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PI_STUDYBUDDY_PACKAGE_APP: appPath,
      PI_STUDYBUDDY_PACKAGE_RUN_DIR: RUN_ROOT,
      PI_STUDYBUDDY_PACKAGE_TASK_ID: "T-M4-021",
      VITEST: undefined,
    },
    timeout: 600_000,
  });
  return stdout;
}

describe("T-M4-021 M4 收官验收（打包冒烟）", () => {
  it("x64 setup 构建 → SHA-256 → 隔离静默安装 → 两次启动全链验证 → 证据矩阵", async () => {
    // 1. 构建 + 哈希
    const setupPath = await buildSetup();
    const setupHash = sha256(setupPath);
    expect(setupHash).toMatch(/^[0-9A-F]{64}$/);

    // 2. 隔离静默安装
    const appPath = await silentInstall(setupPath);

    // 3. 两次启动 + CDP 全链验证（system.ping + global.db + 业务 RPC）
    const smokeOutput = await runInstalledVerification(appPath);
    expect(smokeOutput).toContain("两次隔离启动");
    expect(smokeOutput).toContain("system.ping");
    expect(smokeOutput).toContain("业务 RPC");

    // 4. 证据矩阵断言
    const evidence = {
      setupBuilt: true,
      setupFile: path.basename(setupPath),
      sha256: setupHash,
      installedExeExists: fs.existsSync(appPath),
      twoLaunchesVerified: smokeOutput.includes("first-launch") && smokeOutput.includes("second-launch"),
      pingVerified: smokeOutput.includes("system.ping"),
      businessRpcVerified: smokeOutput.includes("业务 RPC"),
    };
    fs.writeFileSync(path.join(RUN_ROOT, "release-acceptance-evidence.json"), JSON.stringify(evidence, null, 2), "utf8");

    expect(evidence.setupBuilt).toBe(true);
    expect(evidence.sha256.length).toBe(64);
    expect(evidence.installedExeExists).toBe(true);
    expect(evidence.twoLaunchesVerified).toBe(true);
    expect(evidence.pingVerified).toBe(true);
    expect(evidence.businessRpcVerified).toBe(true);
  }, 1_200_000);
});
