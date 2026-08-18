import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const releaseRoot = path.join(root, "release-test");
const corepackJs = process.env.PI_STUDYBUDDY_COREPACK_JS;
const packageManager = corepackJs
  ? process.execPath
  : (process.env.PI_STUDYBUDDY_PNPM ?? (process.platform === "win32" ? "pnpm.cmd" : "pnpm"));
const packageManagerPrefix = corepackJs
  ? [corepackJs, "pnpm"]
  : (packageManager.toLowerCase().includes("corepack") ? ["pnpm"] : []);
const toolchainDir = process.env.PI_STUDYBUDDY_PACKAGE_TOOLCHAIN_DIR
  ?? (process.platform === "win32"
    ? "H:\\pi-studybuddy-tmp\\runs\\T-M5-011\\package-toolchain"
    : path.join("/tmp", "pi-studybuddy-test-package-toolchain"));
if (process.platform === "win32" && corepackJs) {
  fs.rmSync(toolchainDir, { recursive: true, force: true });
  fs.mkdirSync(toolchainDir, { recursive: true });
  const corepackCmd = path.resolve(path.dirname(corepackJs), "..", "..", "..", "corepack.cmd");
  fs.writeFileSync(path.join(toolchainDir, "pnpm.cmd"), `@\"${corepackCmd}\" pnpm %*\r\n`, "utf8");
}
const childEnv = {
  ...process.env,
  ...(fs.existsSync(toolchainDir) ? { PATH: `${toolchainDir}${path.delimiter}${process.env.PATH ?? ""}` } : {}),
};

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: /\.(cmd|bat)$/i.test(command),
    env: childEnv,
  });

  if (result.error) {
    console.error(`[test-package] 子进程启动失败：${command}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

fs.rmSync(releaseRoot, { recursive: true, force: true });
run(packageManager, [...packageManagerPrefix, "build"]);
run(packageManager, [...packageManagerPrefix, "exec", "electron-builder", "--config", "electron-builder.test.yml", "--win", "nsis", "--x64", "--publish", "never"]);
run(process.execPath, ["scripts/check-test-bundle.mjs", "--release-dir", releaseRoot]);

const setup = path.join(releaseRoot, "pi-studybuddy-test--方案b-setup包.exe");
const unpacked = path.join(releaseRoot, "win-unpacked", "pi-studybuddy-test.exe");
if (!fs.existsSync(setup) || !fs.existsSync(unpacked)) {
  console.error("[test-package] 失败：x64 setup 或 win-unpacked 可执行文件缺失");
  process.exit(1);
}
console.log(`[test-package] ✅ setup=${path.basename(setup)} win-unpacked=${path.basename(unpacked)}`);
