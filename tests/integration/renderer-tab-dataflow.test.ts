/**
 * T-M4-008 RED：数据型 Tab 必须绑定 AppShell 学术上下文和 RPC 生命周期。
 *
 * 权威依据：T-M4-008 Prompt、AGENTS.md §5.1/§5.3，以及 06-API materials.list 契约。
 * 测试只使用进程内 deferred RPC，不写业务数据根、不连接外部服务。
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

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function material(id: string, courseId: string, fileName: string): Material {
  return {
    id,
    courseId,
    fileName,
    fileType: "md",
    fileSizeBytes: 1,
    mimeType: "text/markdown",
    storageKey: fileName,
    sourceType: "upload",
    status: "completed",
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

describe("T-M4-008 Tab 数据流", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("没有有效 courseId 时不调用业务 RPC", async () => {
    let calls = 0;
    const rpc = createMockRpcClient({
      "materials.list": () => {
        calls += 1;
        return [];
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MaterialsTab, { rpc })));
    await flush();
    expect(calls).toBe(0);
    expect(host.textContent).toContain("暂无");
  });

  it("课程切换时旧响应不能覆盖新课程，并在 rpc 替换后重新加载", async () => {
    const courseA = deferred<Material[]>();
    const courseB = deferred<Material[]>();
    let calls = 0;
    const rpc = createMockRpcClient({
      "materials.list": (params: unknown) => {
        calls += 1;
        return (params as { courseId: string }).courseId === "course-a" ? courseA.promise : courseB.promise;
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MaterialsTab, { rpc, courseId: "course-a" })));
    await flush();
    expect(host.textContent).toContain("加载");

    await act(async () => root?.render(React.createElement(MaterialsTab, { rpc, courseId: "course-b" })));
    await flush();
    courseB.resolve([material("material-b", "course-b", "B.md")]);
    await flush();
    expect(host.textContent).toContain("B.md");

    courseA.resolve([material("material-a", "course-a", "A.md")]);
    await flush();
    expect(host.textContent).toContain("B.md");
    expect(host.textContent).not.toContain("A.md");

    const replacement = createMockRpcClient({
      "materials.list": () => [material("material-c", "course-b", "C.md")],
    });
    await act(async () => root?.render(React.createElement(MaterialsTab, { rpc: replacement, courseId: "course-b" })));
    await flush();
    expect(host.textContent).toContain("C.md");
    expect(calls).toBe(2);
  });
});
