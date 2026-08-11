/**
 * T-M2-008 RED: CaptureTab 采集 Tab 静态渲染测试
 *
 * 权威依据：09-UI §4.10（课堂录音转写）+ §7.2（合规确认强制）
 *
 * 测试策略：
 * - 合规确认 checkbox（未勾选时转写禁用）
 * - 文件选择入口
 * - 转写结果展示
 * - 保存为 S2 笔记按钮
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CaptureTab } from "../../src/renderer/components/tabs/CaptureTab";
import type { FileMeta } from "../../src/contract/types";

// ---------- 夹具数据 ----------

const fixtureFile: FileMeta = {
  name: "课堂录音.wav",
  size: 10240000,
  mime: "audio/wav",
  path: "H:\\recordings\\课堂录音.wav",
};

const fixtureTranscription = "今天我们学习了极限的 ε-δ 定义。极限是微积分的基础概念...";

// ---------- CaptureTab 合规确认 ----------

describe("CaptureTab 合规确认（09-UI §4.10 + §7.2 强制）", () => {
  it("渲染合规确认 checkbox", () => {
    const html = renderToStaticMarkup(
      React.createElement(CaptureTab, { permissionConfirmed: false }),
    );
    expect(html).toContain("合规");
    expect(html).toContain("确认");
  });

  it("未勾选合规确认时转写按钮禁用（§7.2 强制）", () => {
    const html = renderToStaticMarkup(
      React.createElement(CaptureTab, { permissionConfirmed: false }),
    );
    // 转写按钮应禁用
    expect(html).toContain("disabled");
  });

  it("合规确认 + 课程 + 文件齐备时转写按钮可用（§7.2 + 09-UI §4.10 完整门控）", () => {
    const html = renderToStaticMarkup(
      React.createElement(CaptureTab, {
        permissionConfirmed: true,
        selectedFile: fixtureFile,
        courseId: "course-1",
      }),
    );
    // 转写按钮本身不应 disabled（课程门控/文件门控/合规确认齐备）
    const beforeTranscribe = html.split("开始转写")[0].slice(-120);
    expect(beforeTranscribe).not.toContain("disabled");
  });

  it("渲染合规确认提示文案", () => {
    const html = renderToStaticMarkup(
      React.createElement(CaptureTab, { permissionConfirmed: false }),
    );
    // 应有合规确认相关说明
    expect(html).toContain("录音");
    expect(html).toContain("授权");
  });
});

// ---------- CaptureTab 文件选择 ----------

describe("CaptureTab 文件选择（09-UI §4.10）", () => {
  it("渲染文件选择入口", () => {
    const html = renderToStaticMarkup(
      React.createElement(CaptureTab, { permissionConfirmed: true }),
    );
    expect(html).toContain("选择");
    expect(html).toContain("文件");
  });

  it("选中文件后渲染文件名", () => {
    const html = renderToStaticMarkup(
      React.createElement(CaptureTab, {
        permissionConfirmed: true,
        selectedFile: fixtureFile,
      }),
    );
    expect(html).toContain("课堂录音.wav");
  });

  it("渲染 WAV 格式提示（§4.10 PCM WAV 单一输入）", () => {
    const html = renderToStaticMarkup(
      React.createElement(CaptureTab, { permissionConfirmed: true }),
    );
    expect(html).toContain("WAV");
  });
});

// ---------- CaptureTab 转写结果 ----------

describe("CaptureTab 转写结果（09-UI §4.10）", () => {
  it("渲染转写结果内容", () => {
    const html = renderToStaticMarkup(
      React.createElement(CaptureTab, {
        permissionConfirmed: true,
        selectedFile: fixtureFile,
        transcription: fixtureTranscription,
      }),
    );
    expect(html).toContain("极限的 ε-δ 定义");
  });

  it("渲染保存为 S2 笔记按钮", () => {
    const html = renderToStaticMarkup(
      React.createElement(CaptureTab, {
        permissionConfirmed: true,
        selectedFile: fixtureFile,
        transcription: fixtureTranscription,
      }),
    );
    expect(html).toContain("保存");
    expect(html).toContain("笔记");
  });

  it("无转写结果时不展示保存按钮", () => {
    const html = renderToStaticMarkup(
      React.createElement(CaptureTab, {
        permissionConfirmed: true,
        selectedFile: fixtureFile,
      }),
    );
    // 无转写结果时不应有保存为笔记按钮
    expect(html).not.toContain("保存为笔记");
  });
});

// ---------- CaptureTab 空状态 ----------

describe("CaptureTab 空状态", () => {
  it("初始状态渲染合规确认入口", () => {
    const html = renderToStaticMarkup(
      React.createElement(CaptureTab, { permissionConfirmed: false }),
    );
    expect(html).toContain("合规");
  });

  it("不展示完整 UUID（§11.1 隐私边界）", () => {
    const html = renderToStaticMarkup(
      React.createElement(CaptureTab, {
        permissionConfirmed: true,
        selectedFile: fixtureFile,
        transcription: fixtureTranscription,
      }),
    );
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
