/**
 * T-M5-004 RED：S2 笔记（CTRL-NOTE-05/06）思维导图呈现 + 证据回链可点击。
 *
 * 权威依据：09-UI §4.5（笔记预览与导图）+ 02-PRD §3.3（降低幻觉关键约束，
 * sourceEvidenceJson 回链）+ T-M5-004 prompt §4.3（Markdown/公式/Mermaid/思维导图和
 * source evidence 回链；硬约束：不以静态文字冒充可点击证据回链）。
 *
 * 现状缺口（T-M5-001 G-P1-03/S2-06）：笔记正文纯文本 pre-wrap；模块显示静态
 * "来源：资料回链"，无思维导图入口，无真实回链动作。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { KnowledgeModule, Material, MindMap, StructuredNote } from "../../src/contract/types";
import { NotesTab } from "../../src/renderer/components/tabs/NotesTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function material(id: string, courseId: string, fileName: string): Material {
  return {
    id, courseId, fileName,
    fileType: fileName.toLowerCase().endsWith(".md") ? "md" : "pdf",
    fileSizeBytes: 1024,
    mimeType: "application/pdf",
    storageKey: `semester/sem-b/storage/${id}-${fileName}`,
    sourceType: "upload",
    status: "completed",
    permissionConfirmed: 1,
    uploadedAt: "2026-08-09T00:00:00.000Z",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
  };
}

function moduleItem(id: string, materialId: string, moduleName: string): KnowledgeModule {
  return {
    id, courseId: "course-b", materialId, moduleName,
    summary: "模块摘要",
    importance: 3,
    difficulty: 3,
    learnStatus: "learning",
    sourceEvidenceJson: JSON.stringify({ materialId, page: 12 }),
    aiGenerated: 1,
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
  };
}

function note(materialId: string): StructuredNote {
  return {
    id: "note-1", materialId, courseId: "course-b",
    noteMarkdown: "# 第一章\n\n极限是微积分的基础概念。",
    highlights: [{ text: "极限" }],
    promptVersion: "v1", model: "mock", aiGenerated: 1,
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
  };
}

function mindMap(materialId: string): MindMap {
  return {
    id: "mm-1", materialId, courseId: "course-b",
    markmapJson: JSON.stringify({ root: { name: "极限与连续", children: [{ name: "极限定义" }] } }),
    createdAt: "2026-08-09T00:00:00.000Z",
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

describe("T-M5-004 CTRL-NOTE 思维导图与证据回链", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("RED 1: 笔记就绪时渲染「思维导图」按钮，点击调用 notes.getMindMap 并展示导图内容", async () => {
    const mindMapCalls: Array<{ materialId: string }> = [];
    const rpc = createMockRpcClient({
      "materials.list": () => [material("mat-a", "course-b", "讲义.md")],
      "modules.list": () => [moduleItem("mod-a", "mat-a", "极限与连续")],
      "notes.get": () => note("mat-a"),
      "notes.getMindMap": (params: unknown) => {
        mindMapCalls.push(params as { materialId: string });
        return mindMap("mat-a");
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b" },
    })));
    await flush();

    // 选择资料
    const select = host.querySelector<HTMLSelectElement>("#notes-material-select");
    expect(select, "应有资料选择器").toBeTruthy();
    await act(async () => {
      select!.value = "material-1";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    expect(host.textContent).toContain("第一章");
    const mindMapButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("思维导图"));
    expect(mindMapButton, "笔记就绪应有「思维导图」按钮").toBeTruthy();
    await act(async () => mindMapButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();

    expect(mindMapCalls).toEqual([{ materialId: "mat-a" }]);
    expect(host.textContent).toContain("极限与连续");
  });

  it("RED 2: 思维导图加载失败显示固定中文错误且可重试", async () => {
    let mindMapCalls = 0;
    const rpc = createMockRpcClient({
      "materials.list": () => [material("mat-a", "course-b", "讲义.md")],
      "modules.list": () => [moduleItem("mod-a", "mat-a", "极限与连续")],
      "notes.get": () => note("mat-a"),
      "notes.getMindMap": () => {
        mindMapCalls += 1;
        if (mindMapCalls === 1) return Promise.reject(new Error("mind map boom"));
        return mindMap("mat-a");
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b" },
    })));
    await flush();

    const select = host.querySelector<HTMLSelectElement>("#notes-material-select");
    await act(async () => {
      select!.value = "material-1";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    const mindMapButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("思维导图"));
    await act(async () => mindMapButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();

    expect(host.textContent).toContain("暂时无法加载思维导图");
    expect(host.textContent).not.toContain("mind map boom");
    const retryButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("重试"));
    expect(retryButton, "思维导图失败应有重试按钮").toBeTruthy();
    await act(async () => retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();
    expect(host.textContent).toContain("极限与连续");
  });

  it("RED 3: 知识模块证据回链可点击，点击调用 files.read 读取来源原文", async () => {
    const readCalls: Array<{ path: string }> = [];
    const rpc = createMockRpcClient({
      "materials.list": () => [material("mat-a", "course-b", "讲义.md")],
      "modules.list": () => [moduleItem("mod-a", "mat-a", "极限与连续")],
      "notes.get": () => note("mat-a"),
      "files.read": (params: unknown) => {
        readCalls.push(params as { path: string });
        return { content: "来源原文内容", encoding: "utf8" };
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b" },
    })));
    await flush();

    const select = host.querySelector<HTMLSelectElement>("#notes-material-select");
    await act(async () => {
      select!.value = "material-1";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    const evidenceButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("查看来源"));
    expect(evidenceButton, "知识模块证据应提供「查看来源」回链按钮").toBeTruthy();
    await act(async () => evidenceButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();

    expect(readCalls.length, "点击证据回链应调用 files.read").toBeGreaterThan(0);
    expect(host.textContent).toContain("来源原文内容");
  });

  it("RED 4: 当前资料已显式选择时，可见模块创建表单调用 modules.create 并立即刷新局部列表", async () => {
    const calls: Array<{ courseId: string; materialId: string; moduleName: string; summary?: string }> = [];
    const created = moduleItem("mod-created", "mat-a", "极限定义");
    const rpc = createMockRpcClient({
      "materials.list": () => [material("mat-a", "course-b", "讲义.md")],
      "modules.list": () => [],
      "notes.get": () => note("mat-a"),
      "modules.create": (params: unknown) => {
        calls.push(params as { courseId: string; materialId: string; moduleName: string; summary?: string });
        return created;
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b" },
    })));
    await flush();

    const select = host.querySelector<HTMLSelectElement>("#notes-material-select");
    await act(async () => {
      select!.value = "material-1";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    const nameInput = host.querySelector<HTMLInputElement>('input[aria-label="知识模块名称"]');
    expect(nameInput, "显式选择资料后应有模块名称输入框").toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(nameInput, "极限定义");
      nameInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const createButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("创建知识模块"));
    expect(createButton, "应有可见的创建知识模块按钮").toBeTruthy();
    await act(async () => (createButton as HTMLButtonElement).click());
    await flush();

    expect(calls).toEqual([{ courseId: "course-b", materialId: "mat-a", moduleName: "极限定义", summary: undefined }]);
    expect(host.textContent).toContain("极限定义");
  });

  it("MOD-UI-01：同名模块被 host 拒绝时展示可操作的脱敏提示", async () => {
    const rpc = createMockRpcClient({
      "materials.list": () => [material("mat-a", "course-b", "讲义.md")],
      "modules.list": () => [],
      "notes.get": () => note("mat-a"),
      "modules.create": () => Promise.reject({ code: "BAD_REQUEST", message: "internal details must not enter DOM" }),
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, { rpc, courseId: "course-b" })));
    await flush();
    const select = host.querySelector<HTMLSelectElement>("#notes-material-select");
    await act(async () => { select!.value = "material-1"; select!.dispatchEvent(new Event("change", { bubbles: true })); });
    await flush();
    const nameInput = host.querySelector<HTMLInputElement>("input[aria-label=\"知识模块名称\"]");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(nameInput, "极限定义");
      nameInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const createButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("创建知识模块"));
    await act(async () => (createButton as HTMLButtonElement).click());
    await flush();
    expect(host.textContent).toContain("该资料下已存在同名知识模块，请修改模块名称。");
    expect(host.textContent).not.toContain("internal details must not enter DOM");
  });

  it("RED 5: 资料暂无笔记时，已持久化知识模块仍必须在选中资料后可见", async () => {
    const rpc = createMockRpcClient({
      "materials.list": () => [material("mat-a", "course-b", "讲义.md")],
      "modules.list": () => [moduleItem("mod-persisted", "mat-a", "极限基本概念")],
      "notes.get": () => Promise.reject({ code: "NOT_FOUND", message: "not found" }),
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b" },
    })));
    await flush();

    const select = host.querySelector<HTMLSelectElement>("#notes-material-select");
    await act(async () => {
      select!.value = "material-1";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    expect(host.textContent).toContain("该资料暂无笔记");
    expect(host.textContent).toContain("知识模块");
    expect(host.textContent).toContain("极限基本概念");
  });

  it("RED 4: 归档学期只读时编辑/保存/模块状态按钮禁用", async () => {
    const rpc = createMockRpcClient({
      "materials.list": () => [material("mat-a", "course-b", "讲义.md")],
      "modules.list": () => [moduleItem("mod-a", "mat-a", "极限与连续")],
      "notes.get": () => note("mat-a"),
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(NotesTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b", isReadOnly: true },
    })));
    await flush();

    const select = host.querySelector<HTMLSelectElement>("#notes-material-select");
    await act(async () => {
      select!.value = "material-1";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    const editButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("编辑"));
    expect(editButton, "应有编辑按钮").toBeTruthy();
    expect((editButton as HTMLButtonElement).disabled, "归档学期编辑按钮应禁用").toBe(true);
    const moduleButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("标记"));
    expect((moduleButton as HTMLButtonElement).disabled, "归档学期模块状态按钮应禁用").toBe(true);
  });
});
