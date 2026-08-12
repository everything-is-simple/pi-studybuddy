/**
 * T-M5-004 RED：S2 资料（CTRL-MATERIAL-01~05）预览、AI 生成失败重试、列表失败重试、归档禁用。
 *
 * 权威依据：09-UI §4.4/§8（资料预览/查看）+ T-M5-004 prompt §4.2（资料：转换失败不静默、
 * AI 不可用时明确失败恢复入口、loading/success/empty/failure/retry）。
 *
 * 现状缺口（T-M5-001 G-P1-03/S2-03）：列表无「查看/预览」控件；materials.retryAiGeneration
 * 未接线；资料列表加载失败无重试按钮。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { Material } from "../../src/contract/types";
import { MaterialsTab } from "../../src/renderer/components/tabs/MaterialsTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function material(id: string, courseId: string, fileName: string, status: Material["status"]): Material {
  return {
    id, courseId, fileName,
    fileType: fileName.toLowerCase().endsWith(".md") ? "md" : "pdf",
    fileSizeBytes: 1024,
    mimeType: "application/pdf",
    storageKey: `semester/sem-b/storage/${id}-${fileName}`,
    sourceType: "upload",
    status,
    permissionConfirmed: 1,
    uploadedAt: "2026-08-09T00:00:00.000Z",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

describe("T-M5-004 CTRL-MATERIAL 资料预览/重试/归档", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("RED 1: 已转换资料行渲染「预览」按钮，点击调用 files.previewMarkdown 并展示内容", async () => {
    const previewCalls: Array<{ path: string }> = [];
    const rpc = createMockRpcClient({
      "materials.list": () => [material("mat-md", "course-b", "讲义.md", "converted")],
      "files.previewMarkdown": (params: unknown) => {
        previewCalls.push(params as { path: string });
        return { html: "<pre>预览正文</pre>" };
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MaterialsTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b" },
    })));
    await flush();

    const previewButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("预览"));
    expect(previewButton, "已转换资料应有「预览」按钮").toBeTruthy();
    await act(async () => previewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();
    expect(previewCalls.length, "点击预览应调用 files.previewMarkdown").toBeGreaterThan(0);
    expect(previewCalls[0].path).toContain("讲义.md");
    expect(host.textContent).toContain("预览正文");
  });

  it("RED 2: 预览失败显示固定中文错误且不泄漏路径", async () => {
    const rpc = createMockRpcClient({
      "materials.list": () => [material("mat-md", "course-b", "讲义.md", "converted")],
      "files.previewMarkdown": () => Promise.reject(new Error("C:\\secret\\path boom")),
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MaterialsTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b" },
    })));
    await flush();

    const previewButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("预览"));
    await act(async () => previewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();

    expect(host.textContent).toContain("预览失败");
    expect(host.textContent).not.toContain("secret");
    expect(host.textContent).not.toContain("C:");
  });

  it("RED 3: 笔记生成失败状态渲染「重试生成笔记」，点击调用 materials.retryAiGeneration", async () => {
    const retryCalls: Array<{ id: string }> = [];
    const rpc = createMockRpcClient({
      "materials.list": () => [material("mat-a", "course-b", "讲义.pdf", "note_generating")],
      "materials.retryAiGeneration": (params: unknown) => {
        retryCalls.push(params as { id: string });
        return { id: "job-x", status: "pending", createdAt: "2026-08-09T00:00:00.000Z" };
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MaterialsTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b" },
    })));
    await flush();

    const retryButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("重试生成笔记"));
    expect(retryButton, "note_generating 状态应有「重试生成笔记」按钮").toBeTruthy();
    await act(async () => retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();
    expect(retryCalls).toEqual([{ id: "mat-a" }]);
  });

  it("RED 4: 资料列表加载失败显示「重试」，点击后重新调用 materials.list", async () => {
    let listCalls = 0;
    const rpc = createMockRpcClient({
      "materials.list": () => {
        listCalls += 1;
        if (listCalls === 1) return Promise.reject(new Error("list boom"));
        return [material("mat-b", "course-b", "重试后资料.pdf", "pending")];
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MaterialsTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b" },
    })));
    await flush();

    expect(host.textContent).toContain("暂时无法加载资料");
    const retryButton = Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes("重试"));
    expect(retryButton, "资料加载失败应有「重试」按钮").toBeTruthy();
    await act(async () => retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush();
    expect(listCalls).toBeGreaterThan(1);
    expect(host.textContent).toContain("重试后资料.pdf");
  });

  it("RED 5: 归档学期只读时上传/转换/预览按钮全部禁用", async () => {
    const rpc = createMockRpcClient({
      "materials.list": () => [material("mat-a", "course-b", "讲义.pdf", "pending")],
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MaterialsTab, {
      rpc, academicContext: { semesterId: "sem-b", courseId: "course-b", isReadOnly: true },
    })));
    await flush();

    const buttons = Array.from(host.querySelectorAll("button"));
    const enabled = buttons.filter((item) => !(item as HTMLButtonElement).disabled);
    expect(enabled.length, "归档学期应全部按钮禁用，实际启用按钮: " + enabled.map((item) => item.textContent).join(",")).toBe(0);
  });
});
