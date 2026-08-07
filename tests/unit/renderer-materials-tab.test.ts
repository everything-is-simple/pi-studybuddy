/**
 * T-M1-009 RED: MaterialsTab 资料 Tab 静态渲染测试
 *
 * 权威依据：09-UI §4.4（资料上传与转换）+ 05-ERD §8.3（Material 状态机）
 *
 * 测试策略：
 * - 传入夹具 materials 列表断言渲染输出（文件名/类型/状态）
 * - 状态标识（pending/converting/completed/failed）
 * - 空状态
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MaterialsTab } from "../../src/renderer/components/tabs/MaterialsTab";
import type { Material } from "../../src/contract/types";

// ---------- 夹具数据 ----------

const fixtureMaterials: Material[] = [
  {
    id: "mat-001",
    courseId: "course-001",
    fileName: "高等数学讲义.pdf",
    fileType: "pdf",
    fileSizeBytes: 1024000,
    mimeType: "application/pdf",
    storageKey: "mat-001.pdf",
    sourceType: "upload",
    status: "completed",
    permissionConfirmed: 1,
    uploadedAt: "2026-08-01T00:00:00Z",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-002",
    courseId: "course-001",
    fileName: "课堂笔记.docx",
    fileType: "docx",
    fileSizeBytes: 512000,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "mat-002.docx",
    sourceType: "upload",
    status: "converting",
    permissionConfirmed: 1,
    uploadedAt: "2026-08-07T00:00:00Z",
    createdAt: "2026-08-07T00:00:00Z",
    updatedAt: "2026-08-07T00:00:00Z",
  },
  {
    id: "mat-003",
    courseId: "course-001",
    fileName: "习题集.doc",
    fileType: "doc",
    fileSizeBytes: 256000,
    mimeType: "application/msword",
    storageKey: "mat-003.doc",
    sourceType: "upload",
    status: "conversion_failed",
    permissionConfirmed: 1,
    uploadedAt: "2026-08-06T00:00:00Z",
    createdAt: "2026-08-06T00:00:00Z",
    updatedAt: "2026-08-06T00:00:00Z",
  },
];

// ---------- MaterialsTab 渲染 ----------

describe("MaterialsTab 组件（09-UI §4.4 资料）", () => {
  it("渲染资料列表（文件名）", () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialsTab, { materials: fixtureMaterials }),
    );
    expect(html).toContain("高等数学讲义.pdf");
    expect(html).toContain("课堂笔记.docx");
    expect(html).toContain("习题集.doc");
  });

  it("渲染文件类型标识", () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialsTab, { materials: fixtureMaterials }),
    );
    expect(html).toContain("pdf");
    expect(html).toContain("docx");
  });

  it("渲染状态标识：completed", () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialsTab, { materials: fixtureMaterials }),
    );
    // 完成状态中文标识
    expect(html).toContain("已完成");
  });

  it("渲染状态标识：converting（转换中）", () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialsTab, { materials: fixtureMaterials }),
    );
    expect(html).toContain("转换中");
  });

  it("渲染状态标识：conversion_failed（转换失败）", () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialsTab, { materials: fixtureMaterials }),
    );
    expect(html).toContain("转换失败");
  });

  it("渲染上传入口（按钮）", () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialsTab, { materials: fixtureMaterials }),
    );
    // 上传按钮文案
    expect(html).toContain("上传");
  });

  it("空状态：无资料时渲染提示", () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialsTab, { materials: [] }),
    );
    expect(html).toContain("暂无");
  });

  it("不展示完整 UUID（§11.1 隐私边界）", () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialsTab, { materials: fixtureMaterials }),
    );
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
