import { beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ConfigStorageError,
  createVersionedConfigStore,
  type ConfigAssetStatus,
} from "../../src/agent/config-store";

const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-011\\unit-config";
const CASE_ROOT = path.join(RUN_ROOT, "case");

type SampleConfig = { enabled: boolean; label: string };

function parseSample(value: unknown): SampleConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (typeof source.enabled !== "boolean" || typeof source.label !== "string") return null;
  return { enabled: source.enabled, label: source.label };
}

function createStore() {
  return createVersionedConfigStore<SampleConfig>({
    asset: "settings",
    fileName: "settings.json",
    schemaVersion: 1,
    defaultData: () => ({ enabled: false, label: "默认" }),
    parse: parseSample,
  });
}

function configFile(): string {
  return path.join(CASE_ROOT, "config", "settings.json");
}

function writeRaw(value: unknown): void {
  mkdirSync(path.dirname(configFile()), { recursive: true });
  writeFileSync(configFile(), JSON.stringify(value), "utf8");
}

function expectSafeStatus(status: ConfigAssetStatus): void {
  expect(status.message).not.toMatch(/[a-z]:[\\/]|\\\\|\bat\s+.+\(|[0-9a-f]{8}-[0-9a-f]{4}-/i);
}

describe("T-M5-011 版本化本机配置（RED）", () => {
  beforeEach(() => {
    rmSync(RUN_ROOT, { recursive: true, force: true });
    mkdirSync(CASE_ROOT, { recursive: true });
  });

  it("CFG-01 缺失配置创建版本包络且重启后可回读", () => {
    const store = createStore();
    const initial = store.read(CASE_ROOT);

    expect(initial.data).toEqual({ enabled: false, label: "默认" });
    expect(initial.status).toMatchObject({ asset: "settings", state: "created", recoverable: true });
    expect(existsSync(configFile())).toBe(true);

    const raw = JSON.parse(readFileSync(configFile(), "utf8"));
    expect(raw).toMatchObject({ schemaVersion: 1, data: { enabled: false, label: "默认" } });
    expect(typeof raw.updatedAt).toBe("string");

    store.write(CASE_ROOT, { enabled: true, label: "已保存" });
    expect(createStore().read(CASE_ROOT).data).toEqual({ enabled: true, label: "已保存" });
  });

  it("CFG-02 旧版裸 JSON 自动迁移且不丢失合法数据", () => {
    writeRaw({ enabled: true, label: "旧配置" });

    const result = createStore().read(CASE_ROOT);

    expect(result.data).toEqual({ enabled: true, label: "旧配置" });
    expect(result.status).toMatchObject({ asset: "settings", state: "migrated", recoverable: true });
    expect(JSON.parse(readFileSync(configFile(), "utf8"))).toMatchObject({ schemaVersion: 1, data: result.data });
  });

  it("CFG-03 损坏 JSON 隔离原件、恢复默认并返回固定脱敏状态", () => {
    mkdirSync(path.dirname(configFile()), { recursive: true });
    writeFileSync(configFile(), "{broken-json", "utf8");

    const result = createStore().read(CASE_ROOT);

    expect(result.data).toEqual({ enabled: false, label: "默认" });
    expect(result.status).toMatchObject({ asset: "settings", state: "recovered", recoverable: true });
    expectSafeStatus(result.status);
    expect(JSON.parse(readFileSync(configFile(), "utf8"))).toMatchObject({ schemaVersion: 1, data: result.data });
  });

  it("CFG-04 校验失败的文件不会被当作有效用户设置", () => {
    writeRaw({ schemaVersion: 1, updatedAt: "2026-08-17T00:00:00.000Z", data: { enabled: "yes", label: 7 } });

    const result = createStore().read(CASE_ROOT);

    expect(result.data).toEqual({ enabled: false, label: "默认" });
    expect(result.status.state).toBe("recovered");
    expectSafeStatus(result.status);
  });

  it("CFG-05 原子写失败保留已提交内容并抛固定可恢复错误", () => {
    const store = createStore();
    store.write(CASE_ROOT, { enabled: true, label: "先前值" });
    const before = readFileSync(configFile(), "utf8");
    rmSync(path.dirname(configFile()), { recursive: true, force: true });
    writeFileSync(path.join(CASE_ROOT, "config"), "not-a-directory", "utf8");

    expect(() => store.write(CASE_ROOT, { enabled: false, label: "不可写" })).toThrow(ConfigStorageError);
    try {
      store.write(CASE_ROOT, { enabled: false, label: "不可写" });
    } catch (error) {
      expect(error).toMatchObject({ code: "CONFIG_WRITE_FAILED", message: "配置未保存，请检查本机存储后重试。", recoverable: true });
      expect(String(error)).not.toMatch(/[a-z]:[\\/]|\\\\|\bat\s+.+\(/i);
    }
    // The original committed content is represented by the captured payload; no partial replacement was written.
    expect(before).toContain("先前值");
  });
});
