/**
 * T-M3-002 RED: files.read handler（现成契约 + allowed-roots 白名单门禁）
 *
 * 权威依据：06-API §3.2（files.read 契约）+ 07-WF §2.8 步骤 4（@文件引用
 * 经 allowed-roots 校验）+ AGENTS.md §9.4（符号链接逃逸防护）。
 *
 * 测试策略：临时目录 fixture（数据隔离，写 H:\pi-studybuddy-tmp 语义由 CI 环境
 * 决定，测试自身用 os.tmpdir 子目录）。越权路径拒绝，不泄漏真实路径。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFileHandlers } from "../../src/agent-host/handlers/files";

describe("files.read（06-API §3.2 + allowed-roots 门禁）", () => {
  let dataRoot: string;
  let fileHandlers: ReturnType<typeof createFileHandlers>;

  beforeAll(() => {
    // 数据隔离：测试用临时目录作为业务数据根，绝不触真实 %LOCALAPPDATA%\PiStudyBuddy
    dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pi-studybuddy-files-read-"));
    const inside = path.join(dataRoot, "semester", "s1", "storage");
    fs.mkdirSync(inside, { recursive: true });
    fs.writeFileSync(path.join(inside, "note.txt"), "极限的 ε-δ 定义：对任意 ε>0，存在 δ>0…", "utf8");
    fileHandlers = createFileHandlers({} as never, { dataRoot });
  });

  afterAll(() => {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  });

  it("白名单内文件可读", async () => {
    const result = (await fileHandlers["files.read"]({
      path: path.join(dataRoot, "semester", "s1", "storage", "note.txt"),
    })) as { content: string; encoding: string };
    expect(result.encoding).toBe("utf8");
    expect(result.content).toContain("ε-δ");
  });

  it("越权路径拒绝（BAD_REQUEST，不泄漏路径细节）", async () => {
    await expect(
      fileHandlers["files.read"]({ path: "C:\\Users\\student\\Documents\\secret.txt" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("路径穿越（..）拒绝", async () => {
    await expect(
      fileHandlers["files.read"]({ path: path.join(dataRoot, "..", "..", "secret.txt") }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("文件不存在返回 NOT_FOUND", async () => {
    await expect(
      fileHandlers["files.read"]({ path: path.join(dataRoot, "nope.txt") }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
