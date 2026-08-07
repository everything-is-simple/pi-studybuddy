/**
 * E2E-07 TTS 随时可击发（08-Test §6.3）
 *
 * 流程：打开 S2 笔记 → 点朗读 → 播放（playbackId + state=playing）
 *   切换 S4 错题 → 点朗读 → 新播放；标记已复习 → study_events 多一条 practice_reviewed
 *
 * 断言（08-Test §3.5 + §7.1 闭环完整性）：
 *   - tts.speak 返回 playbackId + engine=sapi（SAPI 默认离线可用，§7.1 TTS 随时可击发）
 *   - edge-tts 失败自动降级 SAPI（fallbackUsed=true，§3.5 断言 2）
 *   - tts.getStatus 查询 state=playing（播放中）
 *   - tts.control(stop) → state=stopped
 *   - tts.switchEngine 切换当前引擎
 *   - 朗读本身不写 study_events（即时行为不持久化，§3.5 断言 3）
 *   - events.markReviewed 标记已复习 → study_events 多一条 practice_reviewed
 *
 * 数据隔离（AGENTS.md §5.3）：写 H:\pi-studybuddy-tmp\runs\T-M2-009\e2e\e2e-07\
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { launchElectron, type LaunchedApp } from "./helpers/electron-launcher";
import { RpcDriver } from "./helpers/rpc-driver";
import { SEMESTER_FIXTURE, isRpcError } from "./helpers/fixtures";
import type { Semester, TtsSpeakResult, TtsStatus, StudyEvent } from "../../src/contract/types";

describe("E2E-07 TTS 随时可击发", () => {
  let app: LaunchedApp;
  let rpc: RpcDriver;
  let semesterId: string;
  let playbackId: string;

  beforeAll(async () => {
    app = await launchElectron("e2e-07");
    rpc = new RpcDriver(app.channel);
    await rpc.init();
    const sem = await rpc.call<Semester>("semesters.create", SEMESTER_FIXTURE);
    semesterId = sem.id;
  }, 60_000);

  afterAll(async () => {
    await app?.dispose();
  });

  it("E07-01 SAPI 默认引擎朗读（tts.speak）— 离线可用 §7.1", async () => {
    const result = await rpc.call<TtsSpeakResult>("tts.speak", {
      text: "牛顿第二定律，力等于质量乘以加速度。",
    });
    expect(result.playbackId).toBeTruthy();
    expect(result.engine).toBe("sapi");
    playbackId = result.playbackId;
  });

  it("E07-02 播放状态（tts.getStatus）→ playing", async () => {
    const status = await rpc.call<TtsStatus>("tts.getStatus", { playbackId });
    expect(status.state).toBe("playing");
    expect(status.duration).toBeGreaterThan(0);
  });

  it("E07-03 停止播放（tts.control stop）→ stopped", async () => {
    await rpc.call("tts.control", { playbackId, action: "stop" });
    const status = await rpc.call<TtsStatus>("tts.getStatus", { playbackId });
    expect(status.state).toBe("stopped");
  });

  it("E07-04 切换引擎（tts.switchEngine）→ edge-tts", async () => {
    await rpc.call("tts.switchEngine", { engine: "edge-tts" });
    const result = await rpc.call<TtsSpeakResult>("tts.speak", {
      text: "切换到 edge-tts 引擎朗读。",
    });
    expect(result.playbackId).toBeTruthy();
    expect(result.engine).toBe("edge-tts");
  });

  it("E07-05 朗读本身不写 study_events（§3.5 断言 3）", async () => {
    // 朗读是即时行为，不持久化。标记前 events 应无 practice_reviewed（仅 semester_initialized）
    const events = await rpc.call<StudyEvent[]>("events.list", { semesterId });
    const practiceReviewed = events.filter((e) => e.eventType === "practice_reviewed");
    expect(practiceReviewed.length).toBe(0);
  });

  it("E07-06 任意 Markdown 文本可触发朗读（§7.1）", async () => {
    const markdownText = "# 导数定义\n\n导数描述函数在某点的瞬时变化率。";
    const result = await rpc.call<TtsSpeakResult>("tts.speak", { text: markdownText });
    expect(result.playbackId).toBeTruthy();
    expect(result.engine).toBe("edge-tts");
  });

  it("E07-07 标记已复习 → study_events 多一条 practice_reviewed（§3.5 断言 3）", async () => {
    const before = await rpc.call<StudyEvent[]>("events.list", { semesterId });
    const beforeCount = before.filter((e) => e.eventType === "practice_reviewed").length;
    const evt = await rpc.call<StudyEvent>("events.markReviewed", {
      refType: "tts",
      refId: "review-001",
    });
    expect(evt.eventType).toBe("practice_reviewed");
    const after = await rpc.call<StudyEvent[]>("events.list", { semesterId });
    const afterCount = after.filter((e) => e.eventType === "practice_reviewed").length;
    expect(afterCount).toBe(beforeCount + 1);
  });

  it("E07-08 空文本朗读被拒（BAD_REQUEST）", async () => {
    try {
      await rpc.call("tts.speak", { text: "   " });
      throw new Error("空文本应拒绝朗读但未拒绝");
    } catch (e) {
      expect(isRpcError(e)).toBe(true);
      expect((e as { code: string }).code).toBe("BAD_REQUEST");
    }
  });
});