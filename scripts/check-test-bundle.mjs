import fs from "node:fs";
import path from "node:path";

const root = process.env.PI_STUDYBUDDY_TEST_ROOT ?? process.cwd();
const unpackedBundle = path.join(root, "release-test", "win-unpacked", "resources", "test-bundle");
const bundle = fs.existsSync(unpackedBundle) ? unpackedBundle : path.join(root, "test-bundle");
const manifestPath = path.join(bundle, "manifest.json");

const forbiddenNames = [
  "credentials.json",
  ".env",
  ".env.local",
  "global.db",
  "semester.db",
  "parent_reports",
  "report_deliveries",
  ".git",
  ".plan",
  ".record",
  "uat",
  "evidence",
];
const forbiddenTokens = [
  "apiKey",
  "secret",
  "accessToken",
  "refreshToken",
  "privateKey",
  "baseUrl",
  "smtpPassword",
  "feishuToken",
];

function fail(message) {
  console.error(`[test-bundle] 失败：${message}`);
  process.exitCode = 1;
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(filePath));
    else result.push(filePath);
  }
  return result;
}

if (!fs.existsSync(manifestPath)) {
  fail("测试 bundle manifest 缺失");
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.containsUserData !== false || manifest.containsCredentials !== false) {
    fail("manifest 未声明无用户数据和无凭据边界");
  }
  if (manifest.externalServices !== "mock-only" || manifest.fixtureMode !== "formal-handlers") {
    fail("manifest 的 fixture 或外部服务边界不符合方案 B");
  }
  const files = walk(bundle);
  for (const filePath of files) {
    const relative = path.relative(bundle, filePath).replaceAll("\\", "/").toLowerCase();
    if (forbiddenNames.some((token) => relative.includes(token.toLowerCase()))) {
      fail(`测试 bundle 含禁止文件名：${relative}`);
      continue;
    }
    if (!/\.(json|md|cmd)$/i.test(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    for (const token of forbiddenTokens) {
      if (text.includes(token)) fail(`测试 bundle 含敏感字段名：${relative}`);
    }
  }
  if (!process.exitCode) console.log(`[test-bundle] ✅ ${path.relative(process.cwd(), bundle)}：manifest 与 ${files.length} 个 bundle 文件边界通过`);
}
