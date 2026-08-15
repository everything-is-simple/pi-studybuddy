/**
 * T-M2-005 备份恢复 registerTool 工具定义（03-Arch §3.1 + §2.2 ToolDefinition 契约）
 *
 * 5 个 studybuddy_* 工具，execute 薄封装调用 backup handler（06-API §3.11）。
 * 工具名匹配 ^studybuddy_[a-z_]+$；ToolDefinition 必填 name/label/description/parameters/execute。
 *
 * 工具清单：
 *   1. studybuddy_backup_course              → backup.course（单课程备份）
 *   2. studybuddy_backup_all_courses         → backup.allCourses（全课程备份）
 *   3. studybuddy_restore_course             → backup.restore（恢复课程）
 *   4. studybuddy_list_backups               → backup.list（查询备份历史）
 *   5. studybuddy_configure_backup_schedule  → backup.configureSchedule + listSchedules + toggleSchedule（调度配置）
 */
import { Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { BackupContext } from "../../../agent-host/handlers/backup/context";
import { createBackupHandlers } from "../../../agent-host/handlers/backup";

function textContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

function jsonContent(obj: unknown): { type: "text"; text: string } {
  return textContent(JSON.stringify(obj, null, 2));
}

export const BACKUP_TOOL_NAMES = [
  "studybuddy_backup_course",
  "studybuddy_backup_all_courses",
  "studybuddy_restore_course",
  "studybuddy_list_backups",
  "studybuddy_configure_backup_schedule",
] as const;

export const BACKUP_TOOL_COUNT = BACKUP_TOOL_NAMES.length;

/**
 * 创建备份恢复全部 5 个 studybuddy_* 工具。
 * @param ctx BackupContext（数据层句柄 + emit 回调）
 */
export function createBackupTools(ctx: BackupContext): ToolDefinition[] {
  const handlers = createBackupHandlers(ctx);

  return [
    // 1. studybuddy_backup_course → backup.course
    {
      name: "studybuddy_backup_course",
      label: "单课程备份",
      description:
        "将指定课程的数据和资料打包为 zip 备份文件（含 manifest.json + data/*.jsonl + storage/），计算 content_hash=SHA-256 完整性校验。备份到学生自选本地目录，不传云端。",
      promptSnippet: "单课程备份：zip 打包 + content_hash + 写 backup_records",
      parameters: Type.Object({
        courseInstanceId: Type.String({ description: "课程实例 ID" }),
        targetPath: Type.String({ description: "备份目标目录（本地路径）" }),
      }),
      async execute(_toolCallId, params) {
        const result = await handlers["backup.course"](params) as {
          id: string;
          zipFilename: string;
          contentHash: string;
          fileSizeBytes: number;
          status: string;
        };
        return {
          content: [
            textContent(
              `备份完成：${result.zipFilename}（${result.fileSizeBytes} 字节，状态 ${result.status}）。content_hash: ${result.contentHash.slice(0, 16)}...`,
            ),
            jsonContent(result),
          ],
          details: result,
        };
      },
    },

    // 2. studybuddy_backup_all_courses → backup.allCourses
    {
      name: "studybuddy_backup_all_courses",
      label: "整学期备份",
      description:
        "把指定学期的课程、学习记录、报告与资料文件打包为一个完整 ZIP，可整体恢复到目标学期。",
      promptSnippet: "整学期备份：生成一个可整体恢复的学期资产包",
      parameters: Type.Object({
        semesterId: Type.String({ description: "学期 ID" }),
        targetPath: Type.String({ description: "备份目标目录（本地路径）" }),
      }),
      async execute(_toolCallId, params) {
        const result = await handlers["backup.allCourses"](params) as {
          zipFilename: string;
          status: string;
          fileSizeBytes: number;
          contentHash: string;
        };
        return {
          content: [
            textContent(`整学期备份完成：${result.zipFilename}（${result.fileSizeBytes} 字节，状态 ${result.status}）。content_hash: ${result.contentHash.slice(0, 16)}...`),
            jsonContent(result),
          ],
          details: result,
        };
      },
    },

    // 3. studybuddy_restore_course → backup.restore
    {
      name: "studybuddy_restore_course",
      label: "恢复课程",
      description:
        "从 zip 备份文件恢复课程数据到目标学期。校验 content_hash + schema_version 兼容性；冲突时按学生选择 overwrite/create_new；恢复后 PRAGMA integrity_check。",
      promptSnippet: "恢复课程：解压 + content_hash 校验 + 冲突处理 + 导入 + integrity_check",
      parameters: Type.Object({
        zipPath: Type.String({ description: "zip 备份文件路径" }),
        targetSemesterId: Type.String({ description: "目标学期 ID" }),
        conflictResolution: Type.Optional(
          Type.Union([Type.Literal("overwrite"), Type.Literal("create_new"), Type.Literal("none")], {
            description: "冲突处理方式：overwrite=覆盖同名课程 / create_new=新建课程 / none=无冲突时直接恢复（默认）",
          }),
        ),
      }),
      async execute(_toolCallId, params) {
        const result = await handlers["backup.restore"](params) as {
          success: boolean;
          restoredCourseId: string;
          conflictResolved: string;
          tablesImported: string[];
          filesRestored: number;
          integrityCheck: string;
          schemaVersion?: string;
        };
        return {
          content: [
            textContent(
              `恢复完成：课程 ${result.restoredCourseId.slice(0, 8)}...，冲突处理 ${result.conflictResolved}，导入 ${result.tablesImported.length} 表 + ${result.filesRestored} 文件，完整性检查 ${result.integrityCheck}。`,
            ),
            jsonContent(result),
          ],
          details: result,
        };
      },
    },

    // 4. studybuddy_list_backups → backup.list
    {
      name: "studybuddy_list_backups",
      label: "查询备份历史",
      description:
        "从 backup_records 查询备份历史，可按学期或课程过滤。返回备份记录列表（含状态、content_hash、文件大小等）。",
      promptSnippet: "查询备份历史：按 semesterId/courseInstanceId 过滤",
      parameters: Type.Object({
        semesterId: Type.Optional(Type.String({ description: "学期 ID（可选过滤）" })),
        courseInstanceId: Type.Optional(Type.String({ description: "课程实例 ID（可选过滤）" })),
      }),
      async execute(_toolCallId, params) {
        const results = await handlers["backup.list"](params) as Array<{
          id: string;
          zipFilename: string;
          backupType: string;
          status: string;
          createdAt: string;
        }>;
        return {
          content: [
            textContent(
              `找到 ${results.length} 条备份记录。`,
            ),
            jsonContent({ count: results.length, records: results }),
          ],
          details: { count: results.length },
        };
      },
    },

    // 5. studybuddy_configure_backup_schedule → backup.configureSchedule + listSchedules + toggleSchedule
    {
      name: "studybuddy_configure_backup_schedule",
      label: "配置备份调度",
      description:
        "配置定期备份调度（cron 表达式 + 时区）。可创建新调度、查询现有调度、启用/禁用调度。默认每周一自动备份。",
      promptSnippet: "配置备份调度：cron_expression + timezone + enabled",
      parameters: Type.Object({
        action: Type.Union(
          [Type.Literal("create"), Type.Literal("list"), Type.Literal("toggle")],
          { description: "操作类型：create=创建调度 / list=查询调度 / toggle=启用/禁用调度" },
        ),
        semesterId: Type.String({ description: "学期 ID" }),
        courseInstanceId: Type.Optional(Type.String({ description: "课程实例 ID（可选，不填=全课程）" })),
        cronExpression: Type.Optional(Type.String({ description: "cron 表达式（action=create 时必填，如 '0 0 * * 1' 每周一）" })),
        timezone: Type.Optional(Type.String({ description: "时区（默认 Asia/Shanghai）" })),
        scheduleId: Type.Optional(Type.String({ description: "调度 ID（action=toggle 时必填）" })),
        enabled: Type.Optional(Type.Boolean({ description: "启用/禁用（action=toggle 时必填）" })),
      }),
      async execute(_toolCallId, params) {
        const p = params as {
          action: "create" | "list" | "toggle";
          semesterId: string;
          cronExpression?: string;
          timezone?: string;
          scheduleId?: string;
          enabled?: boolean;
        };

        if (p.action === "create") {
          const result = await handlers["backup.configureSchedule"]({
            semesterId: p.semesterId,
            cronExpression: p.cronExpression!,
            timezone: p.timezone ?? "Asia/Shanghai",
          }) as { id: string; cronExpression: string; enabled: boolean };
          return {
            content: [
              textContent(`调度已创建：${result.cronExpression}，启用状态 ${result.enabled}。`),
              jsonContent(result),
            ],
            details: result,
          };
        }

        if (p.action === "list") {
          const results = await handlers["backup.listSchedules"]({ semesterId: p.semesterId }) as Array<{
            id: string;
            cronExpression: string;
            enabled: boolean;
          }>;
          return {
            content: [
              textContent(`找到 ${results.length} 条调度配置。`),
              jsonContent({ count: results.length, schedules: results }),
            ],
            details: { count: results.length },
          };
        }

        // toggle
        const result = await handlers["backup.toggleSchedule"]({
          id: p.scheduleId!,
          enabled: p.enabled!,
        }) as { id: string; enabled: boolean };
        return {
          content: [
            textContent(`调度 ${result.id.slice(0, 8)}... 已${result.enabled ? "启用" : "禁用"}。`),
            jsonContent(result),
          ],
          details: result,
        };
      },
    },
  ];
}
