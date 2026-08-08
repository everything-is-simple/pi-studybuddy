import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import {
  createStudyBuddyExtension,
  STUDYBUDDY_EXTENSION_NAME,
} from "../../src/agent/studybuddy-extension";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * T-M1-001~004 + T-M2-001~005 studybuddy-extension 单件测试（03-Arch §2.1 + §3.1 S1-S7+TTS+备份恢复 工具装配）
 *
 * 断言（T-M2-005 升级后）：
 *   - createStudyBuddyExtension() 返回可调用 factory（typeof === "function"）
 *   - factory 返回 Promise（async 签名，符合 ExtensionFactory 契约）
 *   - 调用 factory(stubPi) 不抛错（setup 实现）
 *   - stubPi.registerTool 被调用 35 次（S1 6 + OCR 1 + S2 6 + S3 3 + S4 4 + S5 2 + S6 3 + S7 2 + TTS 3 + 备份恢复 5 个 studybuddy_* 工具）
 *   - stubPi.on 未被调用（M1-004 暂不订阅钩子）
 *   - STUDYBUDDY_EXTENSION_NAME === "pi-studybuddy"
 *
 * 数据隔离（AGENTS.md §5.3）：通过 PI_STUDYBUDDY_DATA_ROOT 注入隔离目录。
 */

const ISOLATION_DIR = "H:\\pi-studybuddy-tmp\\runs\\T-M1-001\\extension-unit";

/** 最小 stub pi：实现 registerTool + on + 调用计数器，as ExtensionAPI 绕过完整接口 */
function createStubPi(): {
  calls: { registerTool: number; on: number; registerProvider: number };
  registeredToolNames: string[];
  pi: ExtensionAPI;
} {
  const calls = { registerTool: 0, on: 0, registerProvider: 0 };
  const registeredToolNames: string[] = [];
  const pi = {
    registerTool: (tool: { name: string }) => {
      calls.registerTool++;
      registeredToolNames.push(tool.name);
    },
    on: () => {
      calls.on++;
    },
    registerProvider: () => {
      calls.registerProvider++;
    },
  } as unknown as ExtensionAPI;
  return { calls, registeredToolNames, pi };
}

describe("T-M1-001~004 + T-M2-001~005 studybuddy-extension 单件测试（S1+S2+S3+S4+S5+S6+S7+TTS+备份恢复 工具装配）", () => {
  let originalDataRoot: string | undefined;

  beforeAll(() => {
    rmSync(ISOLATION_DIR, { recursive: true, force: true });
    mkdirSync(ISOLATION_DIR, { recursive: true });
    originalDataRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
    process.env.PI_STUDYBUDDY_DATA_ROOT = ISOLATION_DIR;
  });

  afterAll(() => {
    if (originalDataRoot === undefined) {
      delete process.env.PI_STUDYBUDDY_DATA_ROOT;
    } else {
      process.env.PI_STUDYBUDDY_DATA_ROOT = originalDataRoot;
    }
    for (let i = 0; i < 3; i++) {
      try {
        rmSync(ISOLATION_DIR, { recursive: true, force: true });
        break;
      } catch {
        // 忽略 EBUSY
      }
    }
  });

  it("返回可调用 factory（typeof === 'function'）", () => {
    const factory = createStudyBuddyExtension();
    expect(typeof factory).toBe("function");
  });

  it("factory 调用后返回 Promise（async 签名，符合 ExtensionFactory 契约）", () => {
    const factory = createStudyBuddyExtension();
    const { pi } = createStubPi();
    const result = factory(pi);
    expect(result).toBeInstanceOf(Promise);
    return result;
  });

  it("调用 factory(stubPi) 不抛错（setup 实现）", async () => {
    const factory = createStudyBuddyExtension();
    const { pi } = createStubPi();
    await expect(factory(pi)).resolves.toBeUndefined();
  });

  it("registerTool 被调用 35 次（S1 6 + OCR 1 + S2 6 + S3 3 + S4 4 + S5 2 + S6 3 + S7 2 + TTS 3 + 备份恢复 5 个 studybuddy_* 工具）", async () => {
    const factory = createStudyBuddyExtension();
    const { calls, pi } = createStubPi();
    await factory(pi);
    expect(calls.registerTool).toBe(35);
  });

  it("注册的工具名全部匹配 ^studybuddy_[a-z_]+$", async () => {
    const factory = createStudyBuddyExtension();
    const { registeredToolNames, pi } = createStubPi();
    await factory(pi);
    expect(registeredToolNames.length).toBe(35);
    for (const name of registeredToolNames) {
      expect(name).toMatch(/^studybuddy_[a-z_]+$/);
    }
  });

  it("注册的工具名含 S1 7（含 OCR）+ S2 6 + S3 3 + S4 4 + S5 2 + S6 3 + S7 2 + TTS 3 + 备份恢复 5 个工具", async () => {
    const factory = createStudyBuddyExtension();
    const { registeredToolNames, pi } = createStubPi();
    await factory(pi);
    expect(registeredToolNames).toEqual(
      expect.arrayContaining([
        // S1
        "studybuddy_init_semester",
        "studybuddy_add_exam",
        "studybuddy_confirm_exam",
        "studybuddy_daily_brief",
        "studybuddy_complete_task",
        "studybuddy_transition_semester",
        // S1 OCR
        "studybuddy_ocr_schedule",
        // S2
        "studybuddy_upload_material",
        "studybuddy_convert_material",
        "studybuddy_generate_note",
        "studybuddy_replace_material_text",
        "studybuddy_update_note",
        "studybuddy_update_learn_status",
        // S3
        "studybuddy_generate_questions",
        "studybuddy_submit_practice",
        "studybuddy_get_practice_result",
        // S4
        "studybuddy_archive_mistake",
        "studybuddy_confirm_error_cause",
        "studybuddy_redo_mistake",
        "studybuddy_aggregate_weak_point",
        // S5
        "studybuddy_generate_mock_exam",
        "studybuddy_submit_mock_exam",
        // S6
        "studybuddy_generate_parent_report",
        "studybuddy_deliver_parent_report",
        "studybuddy_manage_report_targets",
        // S7
        "studybuddy_transcribe_class",
        "studybuddy_save_transcription",
        // TTS
        "studybuddy_tts_speak",
        "studybuddy_tts_control",
        "studybuddy_tts_switch_engine",
        // 备份恢复
        "studybuddy_backup_course",
        "studybuddy_backup_all_courses",
        "studybuddy_restore_course",
        "studybuddy_list_backups",
        "studybuddy_configure_backup_schedule",
      ]),
    );
  });

  it("调用 pi.on 注册 4 个生命周期钩子（T-M1-008 before_agent_start/session_start/tool_call/tool_result）", async () => {
    const factory = createStudyBuddyExtension();
    const { calls, pi } = createStubPi();
    await factory(pi);
    expect(calls.on).toBe(4);
  });

  it("不调用 registerProvider（M1-001 暂不注入 provider）", async () => {
    const factory = createStudyBuddyExtension();
    const { calls, pi } = createStubPi();
    await factory(pi);
    expect(calls.registerProvider).toBe(0);
  });

  it("STUDYBUDDY_EXTENSION_NAME === 'pi-studybuddy'（扩展标识）", () => {
    expect(STUDYBUDDY_EXTENSION_NAME).toBe("pi-studybuddy");
  });
});
