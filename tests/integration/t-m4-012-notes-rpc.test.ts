/**
 * T-M4-012 RED：NotesTab 必须以局部显式资料选择驱动 S2 RPC。
 *
 * 权威依据：09-UI §4.5、07-Workflow §2.3、06-API §3.4、AGENTS.md §5.1/§5.3。
 * 仅使用 happy-dom 与内存 mock，不访问真实业务数据根或外部服务。
 * @vitest-environment happy-dom
 */
import { randomUUID } from "node:crypto";
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { Material, StructuredNote, KnowledgeModule } from "../../src/contract/types";
import { NotesTab } from "../../src/renderer/components/tabs/NotesTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const fixtureMaterial: Material = {
  id: "material-id-1", courseId: "course-1", fileName: "第一章.pdf", fileType: "pdf",
  fileSizeBytes: 1024, mimeType: "application/pdf", storageKey: "material-id-1.pdf",
  sourceType: "upload", status: "completed", permissionConfirmed: 1,
  uploadedAt: "2026-08-10T00:00:00.000Z", createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
};

const fixtureNote: StructuredNote = {
  id: "note-1", materialId: "material-id-1", courseId: "course-1",
  noteMarkdown: "# 第一章笔记", highlights: [], promptVersion: "manual", model: "student",
  aiGenerated: 0, createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
};

const fixtureModule: KnowledgeModule = {
  id: "module-1", courseId: "course-1", materialId: "material-id-1", moduleName: "极限",
  summary: "核心概念", importance: 5, difficulty: 3, learnStatus: "not_started",
  sourceEvidenceJson: JSON.stringify({ page: 1 }), aiGenerated: 0,
  createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
};

const fixtureMaterialB: Material = { ...fixtureMaterial, id: "material-id-2", fileName: "第二章.pdf", storageKey: "material-id-2.pdf" };
const fixtureNoteB: StructuredNote = { ...fixtureNote, id: "note-2", materialId: "material-id-2", noteMarkdown: "# 第二章笔记" };
const fixtureModuleB: KnowledgeModule = { ...fixtureModule, id: "module-2", materialId: "material-id-2", moduleName: "导数", summary: "第二章模块" };

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function setText(editor: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(editor, value);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

async function flush(): Promise<void> {
  await act(async () => { await Promise.resolve(); await new Promise<void>((resolve) => setTimeout(resolve, 0)); });
}

function findSelect(host: HTMLDivElement): HTMLSelectElement {
  const element = host.querySelector('select[aria-label="选择资料"]');
  if (!(element instanceof HTMLSelectElement)) throw new Error("资料选择器不存在");
  return element;
}

function findButton(host: HTMLDivElement, label: string): HTMLButtonElement {
  const element = Array.from(host.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(label));
  if (!(element instanceof HTMLButtonElement)) throw new Error(`按钮不存在: ${label}`);
  return element;
}

describe("T-M4-012 NotesTab RPC 接线", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove(); root = undefined; host = undefined;
  });

  it("未明确选择资料前不调用 notes.get，也不默认选择第一条", async () => {
    let notesGetCalls = 0;
    const rpc = createMockRpcClient({
      "materials.list": () => [fixtureMaterial],
      "notes.get": () => { notesGetCalls += 1; return fixtureNote; },
      "modules.list": () => [fixtureModule],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, { rpc, courseId: "course-1" })));
    await flush();
    expect(notesGetCalls).toBe(0);
    expect(findSelect(host).value).toBe("");
    expect(host.innerHTML).not.toContain("material-id-1");
  });

  it("显式选择资料后以该 materialId 读取笔记并展示对应模块", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "materials.list": (params: unknown) => { calls.push({ method: "materials.list", params }); return [fixtureMaterial]; },
      "notes.get": (params: unknown) => { calls.push({ method: "notes.get", params }); return fixtureNote; },
      "modules.list": (params: unknown) => { calls.push({ method: "modules.list", params }); return [fixtureModule]; },
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, { rpc, courseId: "course-1" })));
    await flush();
    const select = findSelect(host);
    await act(async () => { select.value = "material-1"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await flush();
    expect(calls).toContainEqual({ method: "notes.get", params: { materialId: "material-id-1" } });
    expect(host.textContent).toContain("第一章笔记");
    expect(host.textContent).toContain("极限");
  });

  it("保存编辑调用 notes.update，并更新知识模块学习状态", async () => {
    const updates: Array<{ method: string; params: unknown }> = [];
    const updatedNote = { ...fixtureNote, noteMarkdown: "# 已保存笔记" };
    const updatedModule = { ...fixtureModule, learnStatus: "learning" as const };
    const rpc = createMockRpcClient({
      "materials.list": () => [fixtureMaterial],
      "notes.get": () => fixtureNote,
      "notes.update": (params: unknown) => { updates.push({ method: "notes.update", params }); return updatedNote; },
      "modules.list": () => [fixtureModule],
      "modules.updateLearnStatus": (params: unknown) => { updates.push({ method: "modules.updateLearnStatus", params }); return updatedModule; },
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, { rpc, courseId: "course-1" })));
    await flush();
    const select = findSelect(host);
    await act(async () => { select.value = "material-1"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await flush();
    await act(async () => findButton(host, "编辑").click());
    const editor = host.querySelector('textarea[aria-label="笔记内容"]');
    if (!(editor instanceof HTMLTextAreaElement)) throw new Error("笔记编辑器不存在");
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set; setter?.call(editor, "# 已保存笔记"); editor.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => findButton(host, "保存笔记").click());
    await flush();
    expect(updates).toContainEqual({ method: "notes.update", params: { materialId: "material-id-1", noteMarkdown: "# 已保存笔记", highlights: [] } });
    await act(async () => findButton(host, "标记学习中").click());
    await flush();
    expect(updates).toContainEqual({ method: "modules.updateLearnStatus", params: { id: "module-1", learnStatus: "learning" } });
  });

  it("归档学期不提供笔记或模块写入口", async () => {
    const writeCalls: string[] = [];
    const rpc = createMockRpcClient({
      "materials.list": () => [fixtureMaterial], "notes.get": () => fixtureNote, "modules.list": () => [fixtureModule],
      "notes.update": () => { writeCalls.push("notes.update"); return fixtureNote; },
      "modules.updateLearnStatus": () => { writeCalls.push("modules.updateLearnStatus"); return fixtureModule; },
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, { rpc, academicContext: { semesterId: "semester-1", courseId: "course-1", isReadOnly: true } })));
    await flush();
    const select = findSelect(host);
    await act(async () => { select.value = "material-1"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await flush();
    expect(findButton(host, "编辑").disabled).toBe(true);
    expect(findButton(host, "标记学习中").disabled).toBe(true);
    expect(writeCalls).toEqual([]);
  });
  it("NOT_FOUND 后可新建笔记，并以当前资料 materialId 保存", async () => {
    const updates: unknown[] = [];
    const rpc = createMockRpcClient({
      "materials.list": () => [fixtureMaterial],
      "notes.get": () => Promise.reject({ code: "NOT_FOUND" }),
      "notes.update": (params: unknown) => { updates.push(params); return { ...fixtureNote, noteMarkdown: "# 手动笔记" }; },
      "modules.list": () => [],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, { rpc, courseId: "course-1" })));
    await flush();
    const select = findSelect(host);
    await act(async () => { select.value = "material-1"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await flush();
    await act(async () => findButton(host, "新建笔记").click());
    const editor = host.querySelector('textarea[aria-label="笔记内容"]');
    if (!(editor instanceof HTMLTextAreaElement)) throw new Error("新建笔记编辑器不存在");
    await act(async () => setText(editor, "# 手动笔记"));
    await act(async () => findButton(host, "保存笔记").click());
    await flush();
    expect(updates).toContainEqual({ materialId: "material-id-1", noteMarkdown: "# 手动笔记", highlights: [] });
  });

  it("保存 A 的延迟响应不会在切换 B 后覆盖当前笔记", async () => {
    const pendingSave = deferred<StructuredNote>();
    const rpc = createMockRpcClient({
      "materials.list": () => [fixtureMaterial, fixtureMaterialB],
      "notes.get": (params: unknown) => (params as { materialId: string }).materialId === fixtureMaterial.id ? fixtureNote : fixtureNoteB,
      "notes.update": () => pendingSave.promise,
      "modules.list": () => [fixtureModule, fixtureModuleB],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, { rpc, courseId: "course-1" })));
    await flush();
    const select = findSelect(host);
    await act(async () => { select.value = "material-1"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await flush();
    await act(async () => findButton(host, "编辑").click());
    const editor = host.querySelector('textarea[aria-label="笔记内容"]');
    if (!(editor instanceof HTMLTextAreaElement)) throw new Error("笔记编辑器不存在");
    await act(async () => setText(editor, "# A 保存中的笔记"));
    await act(async () => findButton(host, "保存笔记").click());
    await act(async () => { select.value = "material-2"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await flush();
    pendingSave.resolve({ ...fixtureNote, noteMarkdown: "# A 晚到响应" });
    await flush();
    expect(findSelect(host).value).toBe("material-2");
    expect(host.textContent).toContain("第二章笔记");
    expect(host.textContent).not.toContain("A 晚到响应");
  });

  it("资料、笔记和模块文本含 UUID、绝对路径或堆栈时不进入 DOM", async () => {
    const uuid = randomUUID();
    const windowsPath = ["C:", "private", "secret.pdf"].join("\\");
    const unixPath = ["", "private", "note.md"].join("/");
    const sensitiveMaterial = { ...fixtureMaterial, fileName: "资料-" + uuid + "-" + windowsPath };
    const sensitiveNote = { ...fixtureNote, noteMarkdown: "# " + uuid + " " + unixPath + "\nError: internal\n at hidden" };
    const sensitiveModule = { ...fixtureModule, moduleName: "模块-" + uuid, summary: windowsPath };
    const rpc = createMockRpcClient({
      "materials.list": () => [sensitiveMaterial],
      "notes.get": () => sensitiveNote,
      "modules.list": () => [sensitiveModule],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, { rpc, courseId: "course-1" })));
    await flush();
    expect(host.innerHTML).not.toContain(uuid);
    expect(host.innerHTML).not.toContain(windowsPath);
    await act(async () => { findSelect(host).value = "material-1"; findSelect(host).dispatchEvent(new Event("change", { bubbles: true })); });
    await flush();
    expect(host.textContent).not.toContain(uuid);
    expect(host.textContent).not.toContain(windowsPath);
    expect(host.textContent).not.toContain(unixPath);
    expect(host.textContent).not.toContain("Error: internal");
  });

  it("按 courseId 查询并只显示当前所选资料的模块", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "materials.list": (params: unknown) => { calls.push({ method: "materials.list", params }); return [fixtureMaterial, fixtureMaterialB]; },
      "notes.get": (params: unknown) => (params as { materialId: string }).materialId === fixtureMaterial.id ? fixtureNote : fixtureNoteB,
      "modules.list": (params: unknown) => { calls.push({ method: "modules.list", params }); return [fixtureModule, fixtureModuleB]; },
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, { rpc, courseId: "course-1" })));
    await flush();
    expect(calls).toContainEqual({ method: "materials.list", params: { courseId: "course-1" } });
    expect(calls).toContainEqual({ method: "modules.list", params: { courseId: "course-1" } });
    await act(async () => { findSelect(host).value = "material-1"; findSelect(host).dispatchEvent(new Event("change", { bubbles: true })); });
    await flush();
    expect(host.textContent).toContain("极限");
    expect(host.textContent).not.toContain("导数");
    await act(async () => { findSelect(host).value = "material-2"; findSelect(host).dispatchEvent(new Event("change", { bubbles: true })); });
    await flush();
    expect(host.textContent).toContain("导数");
    expect(host.textContent).not.toContain("极限");
  });
  it("Windows、POSIX 和 file URI 绝对路径各自独立时均不进入 DOM", async () => {
    const windowsPath = "source=" + ["C:", "private", "secret.pdf"].join("\\");
    const posixPath = "path=" + ["", "private", "note.md"].join("/");
    const fileUri = "file:" + ["", "", "private", "secret.md"].join("/");
    const rpc = createMockRpcClient({
      "materials.list": () => [{ ...fixtureMaterial, fileName: windowsPath }],
      "notes.get": () => ({ ...fixtureNote, noteMarkdown: posixPath }),
      "modules.list": () => [{ ...fixtureModule, moduleName: fileUri, summary: windowsPath }],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, { rpc, courseId: "course-1" })));
    await flush();
    expect(host.innerHTML).not.toContain(windowsPath);
    await act(async () => { findSelect(host).value = "material-1"; findSelect(host).dispatchEvent(new Event("change", { bubbles: true })); });
    await flush();
    expect(host.textContent).not.toContain(windowsPath);
    expect(host.textContent).not.toContain(posixPath);
    expect(host.textContent).not.toContain(fileUri);
  });
  it("延迟 notes.get 在课程切换后不能回写旧课程笔记", async () => {
    const delayedNote = deferred<StructuredNote>();
    const rpc = createMockRpcClient({
      "materials.list": (params: unknown) => (params as { courseId: string }).courseId === "course-1" ? [fixtureMaterial] : [{ ...fixtureMaterialB, courseId: "course-2" }],
      "notes.get": () => delayedNote.promise,
      "modules.list": () => [],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, { rpc, courseId: "course-1" })));
    await flush();
    await act(async () => { findSelect(host).value = "material-1"; findSelect(host).dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => root?.render(React.createElement(NotesTab, { rpc, courseId: "course-2" })));
    await flush();
    delayedNote.resolve(fixtureNote);
    await flush();
    expect(findSelect(host).value).toBe("");
    expect(host.textContent).not.toContain("第一章笔记");
  });
});
