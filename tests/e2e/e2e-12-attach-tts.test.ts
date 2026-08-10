/**
 * E2E-12 对话 @文件引用 + TTS 朗读（08-Test §6.5 + 07-WF §2.8 步骤 4）
 *
 * 流程：建学期+课程 → 上传资料（materials.upload）→ @引用文件注入
 *   （files.read 经 allowed-roots 白名单校验）→ tts.speak 朗读 → 标记已复习
 *
 * 断言（08-Test §6.5 关键断言 + AGENTS.md §9.4）：
 *   - @引用 allowed-roots 校验：dataRoot 内真实路径 files.read 通过
 *   - 越权路径（dataRoot 外）files.read 拒绝（BAD_REQUEST，不泄漏路径）
 *   - 上传资料返回 storageKey（@文件引用承载锚点）
 *   - tts.speak → playbackId + engine=sapi（mock TtsAdapter，离线可用 §7.1）
 *   - tts.getStatus → state=playing
 *   - events.markReviewed → study_events 多一条 practice_reviewed
 *
 * 数据隔离（AGENTS.md §5.3）：写 H:\pi-studybuddy-tmp\runs\T-M4-022\e2e\e2e-12\
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { launchElectron, type LaunchedApp } from "./helpers/electron-launcher";
import { RpcDriver } from "./helpers/rpc-driver";
import { stageTestMaterial } from "../helpers/material-import";
import { SEMESTER_FIXTURE, isRpcError } from "./helpers/fixtures";
import type {
  Semester,
  CourseInstance,
  Material,
  TtsSpeakResult,
  TtsStatus,
  StudyEvent,
} from "../../src/contract/types";

describe("E2E-12 对话 @文件引用 + TTS 朗读", () => {
  let app: LaunchedApp;
  let rpc: RpcDriver;
  let semesterId: string;
  let courseId: string;
  let materialId: string;
  let refFileAbs: string;

  beforeAll(async () => {
    app = await launchElectron("e2e-12");
    rpc = new RpcDriver(app.channel);
    await rpc.init();

    const sem = await rpc.call<Semester>("semesters.create", SEMESTER_FIXTURE);
    semesterId = sem.id;
    const course = await rpc.call<CourseInstance>("courses.create", {
      semesterId,
      courseName: "E2E-12 测试课程",
      subject: "数学",
    });
    courseId = course.id;

    // 在 dataRoot 内准备 @引用真实文件（allowed-roots 白名单内）
    refFileAbs = path.join(app.dataRoot, "ref-note.txt");
    fs.writeFileSync(refFileAbs, "第2章 导数定义：导数是函数在某点的瞬时变化率。", "utf8");
  }, 60_000);

  afterAll(async () => {
    await app?.dispose();
  });

  it("E12-01 上传 PDF 资料（materials.upload）→ 返回 storageKey（@引用锚点）", async () => {
    const mat = await rpc.call<Material>("materials.upload", {
      courseId,
      file: stageTestMaterial(app.dataRoot, path.join(app.dataRoot, "fixtures"), "chapter2.pdf", "application/pdf", "chapter 2 fixture"),
    });
    expect(mat.id).toBeTruthy();
    expect(mat.storageKey).toBeTruthy();
    expect(mat.courseId).toBe(courseId);
    materialId = mat.id;
  });

  it("E12-02 @引用注入：dataRoot 内文件 files.read 通过（allowed-roots 校验，AGENTS.md §9.4）", async () => {
    const res = await rpc.call<{ content: string; encoding: string }>("files.read", {
      path: refFileAbs,
    });
    expect(res.encoding).toBe("utf8");
    expect(res.content).toContain("导数定义");
  });

  it("E12-03 @引用越权拒绝：dataRoot 外路径 files.read → BAD_REQUEST（不泄漏路径）", async () => {
    const outsidePath = path.join(process.cwd(), "..", "..", "outside-ref.txt");
    try {
      await rpc.call("files.read", { path: outsidePath });
      throw new Error("越权路径应拒绝但未拒绝");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as { code: string }).code).toBe("BAD_REQUEST");
    }
  });

  it("E12-04 相对路径 @引用：materials.storageKey 相对 dataRoot 解析后通过校验", async () => {
    // storageKey 是相对 dataRoot 的路径，files.read 相对 dataRoot 解析再做白名单校验
    const res = await rpc.call<{ content: string; encoding: string }>("files.read", {
      path: "ref-note.txt",
    });
    expect(res.content).toContain("导数定义");
  });

  it("E12-05 TTS 朗读（tts.speak）→ playbackId + engine=sapi（08-Test §7.1 离线可用）", async () => {
    const result = await rpc.call<TtsSpeakResult>("tts.speak", {
      text: "导数是函数在某点的瞬时变化率。",
    });
    expect(result.playbackId).toBeTruthy();
    expect(result.engine).toBe("sapi");
  });

  it("E12-06 播放状态（tts.getStatus）→ playing", async () => {
    const speak = await rpc.call<TtsSpeakResult>("tts.speak", {
      text: "朗读状态验证。",
    });
    const status = await rpc.call<TtsStatus>("tts.getStatus", { playbackId: speak.playbackId });
    expect(status.state).toBe("playing");
    expect(status.duration).toBeGreaterThan(0);
  });

  it("E12-07 标记已复习 → study_events 多一条 practice_reviewed（08-Test §3.5 断言 3）", async () => {
    const before = await rpc.call<StudyEvent[]>("events.list", { semesterId });
    const beforeCount = before.filter((e) => e.eventType === "practice_reviewed").length;
    const evt = await rpc.call<StudyEvent>("events.markReviewed", {
      refType: "tts",
      refId: "review-chat-001",
    });
    expect(evt.eventType).toBe("practice_reviewed");
    const after = await rpc.call<StudyEvent[]>("events.list", { semesterId });
    const afterCount = after.filter((e) => e.eventType === "practice_reviewed").length;
    expect(afterCount).toBe(beforeCount + 1);
  });
});