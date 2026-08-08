/**
 * T-M3-004 RED: 工具→目标 Tab 映射纯函数单测
 *
 * 权威依据：09-UI §4.1（标签页总览 + 主要 RPC 列）+ 07-WF §2.8
 * （对话出题→跳练习 Tab / 上传资料→跳资料 Tab / 请求报告→S6）
 * + T-M3-004 裁决 1（五裁决：35 工具全覆盖映射表 + update_learn_status→notes
 * + backup_* 无目标 Tab 不渲染跳转 + TTS 无跳转）。
 *
 * 测试策略：纯函数断言（工具名 → tabId/label），35 工具全覆盖 + 无目标 Tab 工具
 * 返回 undefined + 未知工具 undefined。UI 跳转按钮渲染与 onNavigateTab 回调
 * 走 ChatTab 静态渲染断言（见 renderer-chat-tab-jump 测试）。
 */
import { describe, it, expect } from "vitest";
import { toolJumpTarget, type ToolJumpTarget } from "../../src/renderer/tool-tab-map";

/** 期望目标 Tab 的断言辅助 */
function expectJump(toolName: string, tabId: string): void {
  const target = toolJumpTarget(toolName);
  expect(target, `${toolName} 应映射到 ${tabId}`).toBeDefined();
  expect((target as ToolJumpTarget).tabId).toBe(tabId);
  expect((target as ToolJumpTarget).label).toBeTruthy();
}

/** 期望无目标 Tab（tts_* / backup_* / 未知工具） */
function expectNoJump(toolName: string): void {
  expect(toolJumpTarget(toolName), `${toolName} 应无目标 Tab`).toBeUndefined();
}

describe("工具→目标 Tab 映射（T-M3-004 裁决 1，09-UI §4.1 + 07-WF §2.8）", () => {
  it("S3 练习域 3 工具 → practice", () => {
    expectJump("studybuddy_generate_questions", "practice");
    expectJump("studybuddy_submit_practice", "practice");
    expectJump("studybuddy_get_practice_result", "practice");
  });

  it("S2 笔记域 2 工具 → notes", () => {
    expectJump("studybuddy_generate_note", "notes");
    expectJump("studybuddy_update_note", "notes");
  });

  it("S2 学习状态工具（裁决补录）→ notes", () => {
    expectJump("studybuddy_update_learn_status", "notes");
  });

  it("S2 资料域 3 工具 → materials", () => {
    expectJump("studybuddy_upload_material", "materials");
    expectJump("studybuddy_convert_material", "materials");
    expectJump("studybuddy_replace_material_text", "materials");
  });

  it("S4 错题域 4 工具 → mistakes", () => {
    expectJump("studybuddy_confirm_error_cause", "mistakes");
    expectJump("studybuddy_redo_mistake", "mistakes");
    expectJump("studybuddy_archive_mistake", "mistakes");
    expectJump("studybuddy_aggregate_weak_point", "mistakes");
  });

  it("S5 冲刺域 2 工具 → cram", () => {
    expectJump("studybuddy_generate_mock_exam", "cram");
    expectJump("studybuddy_submit_mock_exam", "cram");
  });

  it("S6 报告域 3 工具 → report", () => {
    expectJump("studybuddy_generate_parent_report", "report");
    expectJump("studybuddy_deliver_parent_report", "report");
    expectJump("studybuddy_manage_report_targets", "report");
  });

  it("S7 采集域 2 工具 → capture", () => {
    expectJump("studybuddy_transcribe_class", "capture");
    expectJump("studybuddy_save_transcription", "capture");
  });

  it("S1 首页域 6 工具 + OCR → home", () => {
    expectJump("studybuddy_init_semester", "home");
    expectJump("studybuddy_transition_semester", "home");
    expectJump("studybuddy_add_exam", "home");
    expectJump("studybuddy_confirm_exam", "home");
    expectJump("studybuddy_complete_task", "home");
    expectJump("studybuddy_daily_brief", "home");
    expectJump("studybuddy_ocr_schedule", "home");
  });

  it("TTS 域 3 工具无目标 Tab（朗读控制条全局，不跳转，裁决 1）", () => {
    expectNoJump("studybuddy_tts_speak");
    expectNoJump("studybuddy_tts_control");
    expectNoJump("studybuddy_tts_switch_engine");
  });

  it("备份域 5 工具无目标 Tab（TabBar 无 backup Tab，裁决 1a 留 T-M3-006）", () => {
    expectNoJump("studybuddy_backup_course");
    expectNoJump("studybuddy_backup_all_courses");
    expectNoJump("studybuddy_restore_course");
    expectNoJump("studybuddy_list_backups");
    expectNoJump("studybuddy_configure_backup_schedule");
  });

  it("未知工具返回 undefined（映射白名单语义）", () => {
    expectNoJump("studybuddy_nonexistent_tool");
    expectNoJump("random_tool");
    expectNoJump("");
  });

  it("label 为中文 Tab 名（去练习/去笔记 按钮文案基础，裁决 3）", () => {
    expect((toolJumpTarget("studybuddy_generate_questions") as ToolJumpTarget).label).toBe("练习");
    expect((toolJumpTarget("studybuddy_generate_note") as ToolJumpTarget).label).toBe("笔记");
    expect((toolJumpTarget("studybuddy_generate_mock_exam") as ToolJumpTarget).label).toBe("冲刺");
    expect((toolJumpTarget("studybuddy_upload_material") as ToolJumpTarget).label).toBe("资料");
  });

  it("35 工具全覆盖：注册工具均命中映射（白名单外仅 tts/backup 域）", () => {
    const all35 = [
      // S1 6
      "studybuddy_init_semester",
      "studybuddy_transition_semester",
      "studybuddy_add_exam",
      "studybuddy_confirm_exam",
      "studybuddy_complete_task",
      "studybuddy_daily_brief",
      // S1-OCR 1
      "studybuddy_ocr_schedule",
      // S2 6
      "studybuddy_upload_material",
      "studybuddy_convert_material",
      "studybuddy_replace_material_text",
      "studybuddy_generate_note",
      "studybuddy_update_note",
      "studybuddy_update_learn_status",
      // S3 3
      "studybuddy_generate_questions",
      "studybuddy_submit_practice",
      "studybuddy_get_practice_result",
      // S4 4
      "studybuddy_confirm_error_cause",
      "studybuddy_redo_mistake",
      "studybuddy_archive_mistake",
      "studybuddy_aggregate_weak_point",
      // S5 2
      "studybuddy_generate_mock_exam",
      "studybuddy_submit_mock_exam",
      // S6 3
      "studybuddy_generate_parent_report",
      "studybuddy_deliver_parent_report",
      "studybuddy_manage_report_targets",
      // S7 2
      "studybuddy_transcribe_class",
      "studybuddy_save_transcription",
      // TTS 3
      "studybuddy_tts_speak",
      "studybuddy_tts_control",
      "studybuddy_tts_switch_engine",
      // 备份 5
      "studybuddy_backup_course",
      "studybuddy_backup_all_courses",
      "studybuddy_restore_course",
      "studybuddy_list_backups",
      "studybuddy_configure_backup_schedule",
    ];
    // 备份域 5 工具（无目标 Tab：TabBar 无 backup，裁决 1a）
    const BACKUP_DOMAIN = ["studybuddy_backup_course", "studybuddy_backup_all_courses", "studybuddy_restore_course", "studybuddy_list_backups", "studybuddy_configure_backup_schedule"];
    expect(all35).toHaveLength(35);
    for (const tool of all35) {
      const target = toolJumpTarget(tool);
      if (target === undefined) {
        // 无目标 Tab 仅允许 tts 域 / 备份域（裁决 1/1a）
        const isTts = tool.startsWith("studybuddy_tts_");
        const isBackup = BACKUP_DOMAIN.includes(tool);
        expect(isTts || isBackup, `${tool} 无目标 Tab 但不在 tts/backup 域白名单`).toBe(true);
      } else {
        expect(["home", "materials", "notes", "practice", "mistakes", "cram", "report", "capture"]).toContain(
          target.tabId,
        );
      }
    }
  });
});
