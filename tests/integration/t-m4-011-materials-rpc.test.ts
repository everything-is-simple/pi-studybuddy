/**
 * T-M4-011 RED：S2 资料 Tab 必须通过现有 bridge + TypedRpcClient 完成资料闭环。
 *
 * 权威依据：09-UI §4.4、06-API §3.4、05-ERD §8.3、AGENTS.md §5.1/§5.3。
 * 仅使用 happy-dom 与内存 mock，不访问真实业务数据根或外部服务。
 * @vitest-environment happy-dom
 */
import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { PiBridge } from "../../src/contract/desktop";
import type { Job, Material } from "../../src/contract/types";
import { MaterialsTab } from "../../src/renderer/components/tabs/MaterialsTab";
import { createMockRpcClient } from "../../src/renderer/rpc-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type BridgeWindow = Window & { piBridge?: Pick<PiBridge, "showDialog"> };

function material(id: string, courseId: string, fileName: string, status: Material["status"]): Material {
  return {
    id,
    courseId,
    fileName,
    fileType: fileName.endsWith(".pdf") ? "pdf" : "md",
    fileSizeBytes: 100,
    mimeType: fileName.endsWith(".pdf") ? "application/pdf" : "text/markdown",
    storageKey: fileName,
    sourceType: "upload",
    status,
    permissionConfirmed: 0,
    uploadedAt: "2026-08-09T00:00:00.000Z",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
  };
}

function job(materialId: string, jobType: Job["jobType"]): Job {
  return {
    id: "job-001",
    materialId,
    jobType,
    status: "pending",
    retryCount: 0,
    maxRetries: 3,
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

function button(host: HTMLDivElement, label: string): HTMLButtonElement {
  const result = Array.from(host.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(label));
  if (!(result instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return result;
}

describe("T-M4-011 MaterialsTab RPC 接线", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;
  const originalBridge = (window as BridgeWindow).piBridge;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    (window as BridgeWindow).piBridge = originalBridge;
    root = undefined;
    host = undefined;
  });

  it("无 courseId 时不调用 list，上传按钮禁用且不提供资料动作", async () => {
    let listCalls = 0;
    const rpc = createMockRpcClient({
      "materials.list": () => {
        listCalls += 1;
        return [];
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MaterialsTab, { rpc })));
    await flush();

    expect(listCalls).toBe(0);
    expect(button(host, "上传资料").disabled).toBe(true);
    expect(host.textContent).toContain("请先选择课程");
    expect(host.textContent).not.toContain("转换");
    expect(host.textContent).not.toContain("生成笔记");
  });

  it("使用 academicContext.courseId 加载当前课程资料，不使用旧 courseId", async () => {
    const calls: unknown[] = [];
    const rpc = createMockRpcClient({
      "materials.list": (params: unknown) => {
        calls.push(params);
        return [material("mat-1", "course-context", "讲义.pdf", "pending")];
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () =>
      root?.render(
        React.createElement(MaterialsTab, {
          rpc,
          courseId: "course-legacy",
          academicContext: { semesterId: "semester-1", courseId: "course-context" },
        }),
      ),
    );
    await flush();

    expect(calls).toEqual([{ courseId: "course-context" }]);
    expect(host.textContent).toContain("讲义.pdf");
    expect(host.textContent).toContain("待处理");
  });

  it("选择文件后调用真实 materials.upload，并在成功后刷新列表", async () => {
    const listed = [material("mat-uploaded", "course-1", "新资料.pdf", "pending")];
    const calls: Array<{ method: string; params: unknown }> = [];
    let listCalls = 0;
    (window as BridgeWindow).piBridge = {
      showDialog: async () => ({ canceled: false, filePath: "C:\\Users\\student\\新资料.pdf", importToken: "test-import-token", fileName: "新资料.pdf", fileSize: 123 }),
    };
    const rpc = createMockRpcClient({
      "materials.list": () => {
        listCalls += 1;
        return listCalls === 1 ? [] : listed;
      },
      "materials.upload": (params: unknown) => {
        calls.push({ method: "materials.upload", params });
        return listed[0];
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MaterialsTab, { rpc, courseId: "course-1" })));
    await flush();

    await act(async () => button(host!, "上传资料").click());
    await flush();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      method: "materials.upload",
      params: {
        courseId: "course-1",
        file: { name: "新资料.pdf", size: 123, mime: "application/pdf", importToken: "test-import-token" },
      },
    });
    expect(listCalls).toBe(2);
    expect(host.textContent).toContain("新资料.pdf");
    expect(host.textContent).not.toContain("C:\\Users\\student");
  });

  it("归档课程仍可读取资料，但所有写操作均被只读门控阻止", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "materials.list": () => [material("mat-readonly", "course-archived", "归档.md", "pending")],
      "materials.convert": (params: unknown) => {
        calls.push({ method: "materials.convert", params });
        return job("mat-readonly", "convert_pdf");
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () =>
      root?.render(
        React.createElement(MaterialsTab, {
          rpc,
          academicContext: { semesterId: "semester-archived", courseId: "course-archived", isReadOnly: true },
        }),
      ),
    );
    await flush();

    expect(button(host, "上传资料").disabled).toBe(true);
    expect(button(host, "开始转换").disabled).toBe(true);
    expect(calls).toEqual([]);
  });

  it("文件对话框返回前切换课程时丢弃选择，不上传到旧课程", async () => {
    const dialog = deferred<{ canceled: boolean; filePath: string; importToken?: string; fileName?: string; fileSize?: number }>();
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "materials.list": (params: unknown) => [
        material(
          (params as { courseId: string }).courseId === "course-a" ? "mat-a" : "mat-b",
          (params as { courseId: string }).courseId,
          (params as { courseId: string }).courseId === "course-a" ? "A.md" : "B.md",
          "pending",
        ),
      ],
      "materials.upload": (params: unknown) => {
        calls.push({ method: "materials.upload", params });
        return material("mat-uploaded", "course-a", "旧课程.pdf", "pending");
      },
    });
    (window as BridgeWindow).piBridge = { showDialog: () => dialog.promise };
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MaterialsTab, { rpc, courseId: "course-a" })));
    await flush();
    await act(async () => button(host!, "上传资料").click());
    await act(async () => root?.render(React.createElement(MaterialsTab, { rpc, courseId: "course-b" })));
    await flush();

    dialog.resolve({ canceled: false, filePath: "C:\\Users\\student\\旧课程.pdf" });
    await flush();

    expect(calls).toEqual([]);
    expect(host.textContent).toContain("B.md");
    expect(host.textContent).not.toContain("上传资料成功");
  });

  it("仅在允许状态下调用 convert/generateNote，并阻止同一资料并发转换", async () => {
    const convertDeferred = deferred<Job>();
    const calls: Array<{ method: string; params: unknown }> = [];
    const materials = [
      material("mat-pending", "course-1", "待转换.md", "pending"),
      material("mat-converted", "course-1", "已转换.md", "converted"),
      material("mat-completed", "course-1", "已完成.md", "completed"),
    ];
    const rpc = createMockRpcClient({
      "materials.list": () => materials,
      "materials.convert": (params: unknown) => {
        calls.push({ method: "materials.convert", params });
        return convertDeferred.promise;
      },
      "materials.generateNote": (params: unknown) => {
        calls.push({ method: "materials.generateNote", params });
        return job("mat-converted", "generate_note");
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MaterialsTab, { rpc, courseId: "course-1" })));
    await flush();

    const convert = button(host, "转换");
    await act(async () => {
      convert.click();
      convert.click();
    });
    expect(calls.filter((call) => call.method === "materials.convert")).toEqual([
      { method: "materials.convert", params: { id: "mat-pending" } },
    ]);
    expect(convert.disabled).toBe(true);
    expect(host.textContent).toContain("转换中");

    convertDeferred.resolve(job("mat-pending", "convert_pdf"));
    await flush();
    await act(async () => button(host!, "生成笔记").click());
    await flush();

    expect(calls.filter((call) => call.method === "materials.generateNote")).toEqual([
      { method: "materials.generateNote", params: { id: "mat-converted" } },
    ]);
  });

  it("切换课程后，旧资料操作完成不会刷新或提示新课程", async () => {
    const convertDeferred = deferred<Job>();
    const courseA = material("mat-a", "course-a", "A.md", "pending");
    const courseB = material("mat-b", "course-b", "B.md", "pending");
    const calls: Array<{ method: string; params: unknown }> = [];
    const rpc = createMockRpcClient({
      "materials.list": (params: unknown) =>
        (params as { courseId: string }).courseId === "course-a" ? [courseA] : [courseB],
      "materials.convert": (params: unknown) => {
        calls.push({ method: "materials.convert", params });
        return convertDeferred.promise;
      },
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MaterialsTab, { rpc, courseId: "course-a" })));
    await flush();
    await act(async () => button(host!, "开始转换").click());
    await act(async () => root?.render(React.createElement(MaterialsTab, { rpc, courseId: "course-b" })));
    await flush();
    convertDeferred.resolve(job("mat-a", "convert_pdf"));
    await flush();

    expect(host.textContent).toContain("B.md");
    expect(host.textContent).not.toContain("转换任务已提交");
    expect(calls).toEqual([{ method: "materials.convert", params: { id: "mat-a" } }]);
  });

  it("RPC/bridge 失败时只显示固定脱敏文案，不渲染内部错误详情", async () => {
    (window as BridgeWindow).piBridge = {
      showDialog: async () => {
        throw new Error("C:\\secret\\student.pdf 550e8400-e29b-41d4-a716-446655440000\nstack trace");
      },
    };
    const rpc = createMockRpcClient({
      "materials.list": () => [],
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(React.createElement(MaterialsTab, { rpc, courseId: "course-1" })));
    await flush();

    await act(async () => button(host!, "上传资料").click());
    await flush();

    expect(host.textContent).toContain("上传资料失败，请稍后重试。");
    expect(host.textContent).not.toContain("C:\\secret");
    expect(host.textContent).not.toContain("550e8400-e29b-41d4-a716-446655440000");
    expect(host.textContent).not.toContain("stack trace");
  });
});
