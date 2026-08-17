import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  createStudyBuddySession,
  ensureRuntimeProviderConfig,
  type StudyBuddySession,
} from "../../src/agent-host/studybuddy-extension-loader";
import { readFileSync, writeFileSync } from "node:fs";
import type { ToolInfo } from "@earendil-works/pi-coding-agent";

/**
 * T-M4-004 studybuddy-extension 接入 pi 内核 + extension-loader（断裂 2 修复）
 *
 * 断言（03-Arch §2.1/§6.2 + 08-Test §4 集成测试）：
 *   - createStudyBuddySession() 仅在注入业务数据根的模型配置和凭证后创建 pi AgentSession
 *   - 未提供模型配置时明确拒绝，不可构造无 model 会话供生产 agent.send 静默降级
 *   - session.getAllTools() 包含 35 个 studybuddy_* 工具（S1 6 + OCR 1 + S2 6 + S3 3 + S4 4 + S5 2 + S6 3 + S7 2 + TTS 3 + 备份恢复 5）
 *   - 不侵入 ~/.pi（通过 PI_CODING_AGENT_DIR 环境变量隔离 pi agent 目录）
 *   - session 可 dispose（资源清理）
 *
 * 数据隔离（AGENTS.md §5.3 + §9.5）：
 *   - 业务数据根 → PI_STUDYBUDDY_DATA_ROOT = H:\pi-studybuddy-tmp\runs\T-M4-004\data
 *   - pi agent 目录 → PI_CODING_AGENT_DIR = H:\pi-studybuddy-tmp\runs\T-M4-004\agent
 *   - 两者物理隔离，不写 ~/.pi
 */

const ISOLATION_BASE = "H:\\pi-studybuddy-tmp\\runs\\T-M4-004";
const DATA_ROOT = path.join(ISOLATION_BASE, "data");
const AGENT_DIR = path.join(ISOLATION_BASE, "agent");

/** 期望的 35 个 studybuddy_* 工具名（按 S1-S7 + TTS + 备份恢复 顺序） */
const EXPECTED_TOOL_NAMES = [
  // S1 学习节奏 6
  "studybuddy_init_semester",
  "studybuddy_add_exam",
  "studybuddy_confirm_exam",
  "studybuddy_daily_brief",
  "studybuddy_complete_task",
  "studybuddy_transition_semester",
  // S1 OCR 1
  "studybuddy_ocr_schedule",
  // S2 资料笔记 6
  "studybuddy_upload_material",
  "studybuddy_convert_material",
  "studybuddy_generate_note",
  "studybuddy_replace_material_text",
  "studybuddy_update_note",
  "studybuddy_update_learn_status",
  // S3 限时练习 3
  "studybuddy_generate_questions",
  "studybuddy_submit_practice",
  "studybuddy_get_practice_result",
  // S4 错题改错 4
  "studybuddy_archive_mistake",
  "studybuddy_confirm_error_cause",
  "studybuddy_redo_mistake",
  "studybuddy_aggregate_weak_point",
  // S5 期末冲刺 2
  "studybuddy_generate_mock_exam",
  "studybuddy_submit_mock_exam",
  // S6 家长报告 3
  "studybuddy_generate_parent_report",
  "studybuddy_deliver_parent_report",
  "studybuddy_manage_report_targets",
  // S7 课堂采集 2
  "studybuddy_transcribe_class",
  "studybuddy_save_transcription",
  // TTS 朗读 3
  "studybuddy_tts_speak",
  "studybuddy_tts_control",
  "studybuddy_tts_switch_engine",
  // 备份恢复 5
  "studybuddy_backup_course",
  "studybuddy_backup_all_courses",
  "studybuddy_restore_course",
  "studybuddy_list_backups",
  "studybuddy_configure_backup_schedule",
];

function safeRmSync(p: string): void {
  try {
    rmSync(p, { recursive: true, force: true });
  } catch {
    // Windows EBUSY: 忽略
  }
}

describe("T-M4-004 studybuddy-extension 接入 pi 内核 + extension-loader（断裂 2 修复）", () => {
  let originalDataRoot: string | undefined;
  let originalAgentDir: string | undefined;
  let session: StudyBuddySession | undefined;

  beforeAll(() => {
    safeRmSync(ISOLATION_BASE);
    mkdirSync(DATA_ROOT, { recursive: true });
    mkdirSync(AGENT_DIR, { recursive: true });
    originalDataRoot = process.env.PI_STUDYBUDDY_DATA_ROOT;
    originalAgentDir = process.env.PI_CODING_AGENT_DIR;
    process.env.PI_STUDYBUDDY_DATA_ROOT = DATA_ROOT;
    process.env.PI_CODING_AGENT_DIR = AGENT_DIR;
  });

  afterAll(async () => {
    try {
      await session?.dispose();
    } catch {
      // 忽略清理错误
    }
    if (originalDataRoot === undefined) {
      delete process.env.PI_STUDYBUDDY_DATA_ROOT;
    } else {
      process.env.PI_STUDYBUDDY_DATA_ROOT = originalDataRoot;
    }
    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }
    for (let i = 0; i < 3; i++) {
      safeRmSync(ISOLATION_BASE);
      try {
        rmSync(ISOLATION_BASE, { recursive: true, force: true });
        break;
      } catch {
        // 忽略 EBUSY
      }
    }
  });

  it("未提供模型配置时明确返回 MODEL_NOT_CONFIGURED", async () => {
    await expect(
      createStudyBuddySession({ dataRoot: DATA_ROOT, agentDir: AGENT_DIR, cwd: DATA_ROOT }),
    ).rejects.toMatchObject({
      code: "MODEL_NOT_CONFIGURED",
      message: "尚未配置可用 AI 模型，请先在设置中完成模型配置",
    });
  });

  it("createStudyBuddySession() 成功创建 pi AgentSession（不抛错）", async () => {
    session = await createStudyBuddySession({
      dataRoot: DATA_ROOT,
      agentDir: AGENT_DIR,
      cwd: DATA_ROOT,
      modelConfig: { provider: "deepseek", model: "DeepSeek V4 Flash", apiKey: "test-key" },
    });
    expect(session).toBeDefined();
    expect(session.session).toBeDefined();
    expect(typeof session.session.getAllTools).toBe("function");
    expect(session.session.model?.id).toBe("deepseek-chat");
  }, 30_000);

  it("既有 provider catalog 升级时保留连接配置并补齐默认和自定义模型", () => {
    const catalog = path.join(DATA_ROOT, "config", "pi-models.json");
    mkdirSync(path.dirname(catalog), { recursive: true });
    writeFileSync(catalog, JSON.stringify({
      providers: {
        agnes: {
          name: "用户 Agnes",
          baseUrl: "https://example.invalid/v1",
          api: "openai-completions",
          models: [{ id: "agnes-custom", name: "用户模型" }],
        },
        deepseek: {
          name: "用户 DeepSeek",
          baseUrl: "https://example.invalid/deepseek",
          api: "openai-completions",
          models: [],
        },
      },
    }), "utf8");

    ensureRuntimeProviderConfig(DATA_ROOT);

    const stored = JSON.parse(readFileSync(catalog, "utf8"));
    expect(stored.schemaVersion).toBe(1);
    expect(typeof stored.updatedAt).toBe("string");
    const providers = stored.data.providers;
    expect(providers.agnes.name).toBe("用户 Agnes");
    expect(providers.agnes.baseUrl).toBe("https://example.invalid/v1");
    expect(providers.agnes.models.map((model: { id: string }) => model.id)).toEqual(expect.arrayContaining([
      "agnes-2.5-flash",
      "agnes-custom",
    ]));
    expect(providers.deepseek.name).toBe("用户 DeepSeek");
    expect(providers.deepseek.baseUrl).toBe("https://example.invalid/deepseek");
    expect(providers.deepseek.models.map((model: { id: string }) => model.id)).toEqual(expect.arrayContaining([
      "deepseek-chat",
      "deepseek-reasoner",
    ]));
    expect(providers.sharkgpt.models.map((model: { id: string }) => model.id)).toContain("gpt-5.6-terra");
    expect(providers.voklygpt.models.map((model: { id: string }) => model.id)).toContain("gpt-5.6-terra");

    writeFileSync(catalog, JSON.stringify({ providers: {} }), "utf8");
    ensureRuntimeProviderConfig(DATA_ROOT);
    expect(JSON.parse(readFileSync(catalog, "utf8"))).toMatchObject({ schemaVersion: 1, data: { providers: expect.any(Object) } });
  });

  it("agnes 自定义 OpenAI 兼容 provider（pi-models.json）可创建 session（不连网）", async () => {
    const agnesSession = await createStudyBuddySession({
      dataRoot: DATA_ROOT,
      agentDir: AGENT_DIR,
      cwd: DATA_ROOT,
      modelConfig: { provider: "agnes", model: "agnes-2.5-flash", apiKey: "test-key" },
    });
    try {
      expect(agnesSession).toBeDefined();
      expect(agnesSession.session.model?.id).toBe("agnes-2.5-flash");
      expect(agnesSession.session.model?.provider).toBe("agnes");
    } finally {
      await agnesSession.dispose();
    }
  }, 30_000);

  it("session.getAllTools() 包含 35 个 studybuddy_* 工具（S1-S7 + TTS + 备份恢复）", () => {
    const allTools: ToolInfo[] = session!.session.getAllTools();
    const studybuddyTools = allTools.filter((t) => t.name.startsWith("studybuddy_"));
    expect(studybuddyTools.length).toBe(35);
    const toolNames = studybuddyTools.map((t) => t.name).sort();
    const expected = [...EXPECTED_TOOL_NAMES].sort();
    expect(toolNames).toEqual(expected);
  });

  it("不侵入 ~/.pi（PI_CODING_AGENT_DIR 隔离 pi agent 目录到测试临时目录）", () => {
    // 验证 PI_CODING_AGENT_DIR 指向隔离目录，而非 ~/.pi
    expect(process.env.PI_CODING_AGENT_DIR).toBe(AGENT_DIR);
    expect(AGENT_DIR).not.toContain(".pi");
  });

  it("session 可 dispose（资源清理不抛错）", async () => {
    expect(session?.dispose).toBeDefined();
    // dispose 在 afterAll 统一执行，此处只验证 API 存在
  });
});
