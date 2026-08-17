import fs from "node:fs";
import path from "node:path";

export type ConfigAssetState = "ready" | "created" | "migrated" | "recovered" | "unavailable";

export interface ConfigAssetStatus {
  asset: "settings" | "models" | "pi-models" | "skills" | "console" | "credentials";
  state: ConfigAssetState;
  message: string;
  recoverable: boolean;
}

export class ConfigStorageError extends Error {
  constructor(
    readonly code: "CONFIG_INVALID" | "CONFIG_WRITE_FAILED",
    message: string,
    readonly recoverable = true,
  ) {
    super(message);
    this.name = "ConfigStorageError";
  }
}

interface VersionedConfigEnvelope<T> {
  schemaVersion: number;
  updatedAt: string;
  data: T;
}

export interface VersionedConfigStoreOptions<T> {
  asset: ConfigAssetStatus["asset"];
  fileName: string;
  schemaVersion: number;
  defaultData(): T;
  parse(value: unknown): T | null;
  migrate?(fromVersion: number, value: unknown): T | null;
}

export interface ConfigReadResult<T> {
  data: T;
  status: ConfigAssetStatus;
}

function status(
  asset: ConfigAssetStatus["asset"],
  state: ConfigAssetState,
  message: string,
  recoverable: boolean,
): ConfigAssetStatus {
  return { asset, state, message, recoverable };
}

function hasOwn(value: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}

export function createVersionedConfigStore<T>(options: VersionedConfigStoreOptions<T>) {
  const configFile = (dataRoot: string) => path.join(dataRoot, "config", options.fileName);

  function validate(value: unknown): T {
    const parsed = options.parse(value);
    if (!parsed) throw new ConfigStorageError("CONFIG_INVALID", "配置内容无效，请恢复默认设置后重试。");
    return parsed;
  }

  function write(dataRoot: string, value: T): void {
    const data = validate(value);
    const file = configFile(dataRoot);
    const directory = path.dirname(file);
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    const payload: VersionedConfigEnvelope<T> = {
      schemaVersion: options.schemaVersion,
      updatedAt: new Date().toISOString(),
      data,
    };
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(temporary, JSON.stringify(payload, null, 2), "utf8");
      fs.renameSync(temporary, file);
    } catch {
      try {
        fs.rmSync(temporary, { force: true });
      } catch {
        // Best-effort cleanup. The committed file remains untouched unless rename succeeded.
      }
      throw new ConfigStorageError("CONFIG_WRITE_FAILED", "配置未保存，请检查本机存储后重试。");
    }
  }

  function recover(dataRoot: string): ConfigReadResult<T> {
    const file = configFile(dataRoot);
    try {
      if (fs.existsSync(file)) {
        const quarantine = `${file}.corrupt-${Date.now()}.json`;
        fs.renameSync(file, quarantine);
      }
      const data = options.defaultData();
      write(dataRoot, data);
      return {
        data,
        status: status(options.asset, "recovered", "配置已恢复为默认值，请重新确认并保存设置。", true),
      };
    } catch (error) {
      if (error instanceof ConfigStorageError) throw error;
      throw new ConfigStorageError("CONFIG_WRITE_FAILED", "配置恢复失败，请检查本机存储后重试。");
    }
  }

  function read(dataRoot: string): ConfigReadResult<T> {
    const file = configFile(dataRoot);
    if (!fs.existsSync(file)) {
      const data = options.defaultData();
      write(dataRoot, data);
      return {
        data,
        status: status(options.asset, "created", "已创建默认配置。", true),
      };
    }

    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return recover(dataRoot);
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return recover(dataRoot);
    const record = raw as Record<string, unknown>;
    if (!hasOwn(record, "schemaVersion")) {
      const migrated = options.parse(raw);
      if (!migrated) return recover(dataRoot);
      write(dataRoot, migrated);
      return {
        data: migrated,
        status: status(options.asset, "migrated", "已升级本机配置。", true),
      };
    }

    const version = record.schemaVersion;
    if (typeof version !== "number" || !Number.isInteger(version)) return recover(dataRoot);
    if (version === options.schemaVersion) {
      const data = options.parse(record.data);
      if (!data) return recover(dataRoot);
      return { data, status: status(options.asset, "ready", "配置可用。", true) };
    }

    const migrated = options.migrate?.(version, record.data) ?? null;
    if (!migrated) return recover(dataRoot);
    write(dataRoot, migrated);
    return {
      data: migrated,
      status: status(options.asset, "migrated", "已升级本机配置。", true),
    };
  }

  return { read, write, configFile };
}
