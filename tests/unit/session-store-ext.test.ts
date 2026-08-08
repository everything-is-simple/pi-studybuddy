/**
 * T-M3-006 RED: SessionStore 扩展单件测试（rename/export/unread）
 *
 * 权威依据：06-API §3.1（sessions.rename/export 契约已定义，handler 归 T-M3-006）
 * + 09-UI §7（会话管理 UI）+ AGENTS.md §9.3（导出脱敏：不记录完整 UUID）。
 *
 * 测试策略：纯内存仓库单件断言（无 I/O）；export 写 runs 隔离目录
 * （裁决 1：H:\pi-studybuddy-tmp\runs\T-M3-006\exports\，不污染业务数据根）。
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSessionStore, defaultSessionFixture } from "../../src/agent-host/session-store";

describe("SessionStore 扩展（T-M3-006，06-API §3.1 rename/export + unread）", () => {
  it("rename 更新会话名称并刷新 updatedAt", () => {
    const store = createSessionStore(defaultSessionFixture());
    const renamed = store.rename("sess-001", "极限定义精讲");
    expect(renamed?.id).toBe("sess-001");
    expect(renamed?.name).toBe("极限定义精讲");
    // ISO 字符串字典序即时间序；rename 刷新 updatedAt ≥ 原值
    expect(renamed?.updatedAt >= "2026-08-08T09:00:00Z").toBe(true);
    const after = store.get("sess-001");
    expect(after?.name).toBe("极限定义精讲");
  });

  it("rename 不存在的会话返回 undefined", () => {
    const store = createSessionStore(defaultSessionFixture());
    expect(store.rename("sess-999", "不存在")).toBeUndefined();
  });

  it("rename 空名/纯空白名返回 undefined（不落空名）", () => {
    const store = createSessionStore(defaultSessionFixture());
    expect(store.rename("sess-001", "  ")).toBeUndefined();
    expect(store.get("sess-001")?.name).toBe("极限学习");
  });

  it("export md 写入隔离目录并返回 path，内容为脱敏对话摘要", () => {
    const store = createSessionStore(defaultSessionFixture());
    const destDir = mkdtempSync(join(tmpdir(), "t-m3-006-export-md-"));
    try {
      const result = store.export("sess-001", "md", destDir);
      expect(existsSync(result.path)).toBe(true);
      const content = readFileSync(result.path, "utf8");
      expect(content).toContain("极限学习");
      expect(content).toContain("ε-δ 定义");
      // 脱敏：导出内容不含完整 UUID / 密钥（AGENTS.md §9.3）
      expect(content).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
      expect(content).not.toMatch(/sk-[a-z0-9]{20,}/i);
    } finally {
      rmSync(destDir, { recursive: true, force: true });
    }
  });

  it("export json 返回结构化会话（元数据 + 上下文统计），同样脱敏", () => {
    const store = createSessionStore(defaultSessionFixture());
    const destDir = mkdtempSync(join(tmpdir(), "t-m3-006-export-json-"));
    try {
      const result = store.export("sess-001", "json", destDir);
      const parsed = JSON.parse(readFileSync(result.path, "utf8")) as {
        id: string;
        name: string;
        preview?: string;
        context?: { messages: number; tokens: number; compressed: boolean };
      };
      expect(parsed.id).toBe("sess-001");
      expect(parsed.name).toBe("极限学习");
      expect(parsed.context?.messages).toBeGreaterThan(0);
      const raw = readFileSync(result.path, "utf8");
      expect(raw).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
    } finally {
      rmSync(destDir, { recursive: true, force: true });
    }
  });

  it("export 不存在的会话抛出错误", () => {
    const store = createSessionStore(defaultSessionFixture());
    const destDir = mkdtempSync(join(tmpdir(), "t-m3-006-export-missing-"));
    try {
      expect(() => store.export("sess-999", "md", destDir)).toThrow();
    } finally {
      rmSync(destDir, { recursive: true, force: true });
    }
  });

  it("SessionSummary 携带可选 unread 计数并透传 list", () => {
    const store = createSessionStore([
      ...defaultSessionFixture(),
      { id: "sess-003", name: "新消息会话", updatedAt: "2026-08-08T11:00:00Z", unread: 3 },
    ]);
    const list = store.list({});
    const withUnread = list.find((s) => s.id === "sess-003");
    expect(withUnread?.unread).toBe(3);
    // 既有 fixture 无 unread 字段（可选，向后兼容）
    expect(list.find((s) => s.id === "sess-001")?.unread).toBeUndefined();
  });
});
