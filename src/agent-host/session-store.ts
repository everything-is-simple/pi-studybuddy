/**
 * T-M3-001 session-store 内存会话仓库（06-API §3.1 对话 Tab 承载）
 *
 * 承载 renderer ↔ agent-host 的会话管理基础（sessions.list/get/delete/context）。
 * T-M3-001 范围：纯内存仓库 + fixture，**不读取真实 pi 会话目录 ~/.pi/agent/**
 * （03-Arch §4.1 + AGENTS.md §9.5 物理隔离）——真实 pi 会话读取属 T-M3-003。
 *
 * T-M3-006 扩展：
 *   - rename(id, name)：重命名会话（06-API §3.1 sessions.rename）
 *   - export(id, format, destDir)：导出会话（md|json → { path }，06-API §3.1
 *     sessions.export），内容脱敏（AGENTS.md §9.3 不记录完整 UUID/密钥）
 *   - SessionSummary.unread? 可选字段（09-UI §3.3 unread 计数）
 *
 * T-M5-003 扩展（真实用户闭环，09-UI §7）：
 *   - touch(id, name?)：内部物化——agent.send 首次携带某 sessionId 时创建会话，
 *     不新增契约方法（contract 保持 127/127）
 *   - 持久化：业务数据根 `<dataRoot>/sessions.json`（原子写 tmp+rename），
 *     重启后会话元数据仍可见（09-UI §7 会话持久化；与 models.json/credentials.json
 *     同级的业务数据根状态文件，不新增 DB schema）
 *   - makeContext 移除 sess-001 硬编码计数（中性默认值）
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Session, SessionContext, SessionSummary } from "../contract/types";

/** 导出内容脱敏（AGENTS.md §9.3）：剥离完整 UUID 与 API key 形态 */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const KEY_RE = /\bsk-[a-z0-9]{20,}\b/gi;
function sanitizeExport(text: string): string {
  return text.replace(UUID_RE, "[id]").replace(KEY_RE, "[key]");
}

/** 会话持久化文件名（业务数据根，AGENTS.md §9.5；不新增 DB schema） */
const SESSIONS_FILE = "sessions.json";

/** 原子写（tmp + rename，防止半写损坏） */
function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = `${file}.tmp`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, file);
}

/** 从业务数据根加载已持久化会话（不存在/损坏 → 空列表） */
function loadPersistedSessions(dataRoot?: string): SessionSummary[] {
  if (!dataRoot) return [];
  try {
    const raw = readFileSync(join(dataRoot, SESSIONS_FILE), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionSummary[]) : [];
  } catch {
    return [];
  }
}

export interface SessionStore {
  list(params?: { limit?: number; cursor?: string }): SessionSummary[];
  get(id: string): Session | undefined;
  delete(id: string): boolean;
  context(id: string): SessionContext | undefined;
  /** 更新会话级学习场景元数据（09-UI §4.2：学科/目标/错题关联，T-M3-003） */
  updateMeta(id: string, meta: { subject?: string; goal?: string; mistakeIds?: string[] }): SessionSummary | undefined;
  /** 重命名会话（06-API §3.1 sessions.rename，T-M3-006） */
  rename(id: string, name: string): Session | undefined;
  /** 导出会话为 md/json 文件（06-API §3.1 sessions.export，T-M3-006） */
  export(id: string, format: "md" | "json", destDir: string): { path: string };
  /**
   * 物化会话（T-M5-003）：agent.send 首次携带该 sessionId 时创建真实会话。
   * 已存在 → 返回原摘要；不存在 → 创建 { id, name: name ?? "新会话" } 并持久化。
   */
  touch(id: string, name?: string): SessionSummary;
}

/** 默认 fixture 会话（仅测试显式注入；T-M5-003：生产不再注入） */
export function defaultSessionFixture(): SessionSummary[] {
  return [
    {
      id: "sess-001",
      name: "极限学习",
      updatedAt: "2026-08-08T09:00:00Z",
      preview: "ε-δ 定义",
    },
    {
      id: "sess-002",
      name: "导数练习",
      updatedAt: "2026-08-08T10:00:00Z",
      preview: "导数定义 5 题",
    },
  ];
}

export interface CreateSessionStoreOptions {
  /** 业务数据根：提供时启用 sessions.json 持久化（重启可见，T-M5-003） */
  dataRoot?: string;
}

/**
 * 创建会话仓库。
 * @param fixture 测试注入的初始会话（生产不传，空数据根=空会话）
 * @param opts    dataRoot 提供时：启动加载已持久化会话 + 每次变更原子写回
 */
export function createSessionStore(fixture?: SessionSummary[], opts: CreateSessionStoreOptions = {}): SessionStore {
  const dataRoot = opts.dataRoot;
  const sessions = new Map<string, SessionSummary>();
  // 持久化会话优先加载，fixture 覆盖（测试显式注入优先级最高）
  for (const s of loadPersistedSessions(dataRoot)) {
    sessions.set(s.id, s);
  }
  for (const s of fixture ?? []) {
    sessions.set(s.id, s);
  }

  /** 变更后原子写回业务数据根（T-M5-003 持久化） */
  function persist(): void {
    if (!dataRoot) return;
    writeJsonAtomic(join(dataRoot, SESSIONS_FILE), [...sessions.values()]);
  }

  /** 骨架会话上下文（中性默认值，T-M5-003 移除 sess-001 硬编码） */
  function makeContext(): SessionContext {
    return {
      systemPrompt: "学习对话（pi 原生承载，T-M3-001 骨架）",
      messages: 1,
      tokens: 0,
      compressed: false,
    };
  }

  return {
    list(params) {
      const sorted = [...sessions.values()].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );
      return params?.limit !== undefined ? sorted.slice(0, params.limit) : sorted;
    },
    get(id) {
      const summary = sessions.get(id);
      if (!summary) return undefined;
      return {
        ...summary,
        context: makeContext(),
      };
    },
    delete(id) {
      const removed = sessions.delete(id);
      if (removed) persist();
      return removed;
    },
    context(id) {
      return this.get(id)?.context;
    },
    touch(id, name) {
      const existing = sessions.get(id);
      if (existing) return existing;
      const summary: SessionSummary = {
        id,
        name: (name ?? "").trim() || "新会话",
        updatedAt: new Date().toISOString(),
      };
      sessions.set(id, summary);
      persist();
      return summary;
    },
    updateMeta(id, meta) {
      const summary = sessions.get(id);
      if (!summary) return undefined;
      const updated: SessionSummary = {
        ...summary,
        ...(meta.subject !== undefined ? { subject: meta.subject } : {}),
        ...(meta.goal !== undefined ? { goal: meta.goal } : {}),
        ...(meta.mistakeIds !== undefined ? { mistakeIds: meta.mistakeIds } : {}),
        updatedAt: new Date().toISOString(),
      };
      sessions.set(id, updated);
      persist();
      return updated;
    },
    rename(id, name) {
      const trimmed = name.trim();
      const summary = sessions.get(id);
      if (!summary || !trimmed) return undefined;
      const updated: SessionSummary = {
        ...summary,
        name: trimmed,
        updatedAt: new Date().toISOString(),
      };
      sessions.set(id, updated);
      persist();
      return {
        ...updated,
        context: makeContext(),
      };
    },
    export(id, format, destDir) {
      const summary = sessions.get(id);
      if (!summary) throw new Error(`会话不存在: ${id}`);
      const full = this.get(id) as Session;
      mkdirSync(destDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const ext = format === "json" ? "json" : "md";
      const path = join(destDir, `session-${summary.id}-${stamp}.${ext}`);
      if (format === "json") {
        const payload = {
          id: summary.id,
          name: summary.name,
          preview: summary.preview,
          ...(summary.subject !== undefined ? { subject: summary.subject } : {}),
          ...(summary.goal !== undefined ? { goal: summary.goal } : {}),
          ...(summary.mistakeIds !== undefined ? { mistakeIds: summary.mistakeIds } : {}),
          ...(summary.unread !== undefined ? { unread: summary.unread } : {}),
          context: {
            systemPrompt: full.context.systemPrompt,
            messages: full.context.messages,
            tokens: full.context.tokens,
            compressed: full.context.compressed,
          },
        };
        writeFileSync(path, sanitizeExport(JSON.stringify(payload, null, 2)), "utf8");
      } else {
        const md = [
          `# 会话：${sanitizeExport(summary.name)}`,
          ``,
          `- 会话 ID：${sanitizeExport(summary.id)}`,
          `- 最近更新：${summary.updatedAt}`,
          ...(summary.subject !== undefined ? [`- 学科标签：${sanitizeExport(summary.subject)}`] : []),
          ...(summary.goal !== undefined ? [`- 学习目标：${sanitizeExport(summary.goal)}`] : []),
          ...(summary.preview !== undefined ? [`- 摘要：${sanitizeExport(summary.preview)}`] : []),
          ``,
          `> 学习对话会话导出（pi-studybuddy）。对话消息内容不随导出携带，仅含会话元数据与上下文统计。`,
          ``,
          `- 消息数：${full.context.messages}`,
          `- 上下文 tokens：${full.context.tokens}`,
          `- 已压缩：${full.context.compressed ? "是" : "否"}`,
          ``,
        ].join("\n");
        writeFileSync(path, md, "utf8");
      }
      return { path };
    },
  };
}
