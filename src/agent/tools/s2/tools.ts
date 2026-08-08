/**
 * T-M1-002 S2 registerTool 工具定义（03-Arch §3.1 + §2.2 ToolDefinition 契约）
 *
 * 6 个 studybuddy_* 工具，execute 薄封装调用同一 handler 函数（06-API §3.4）。
 * 工具名匹配 ^studybuddy_[a-z_]+$；ToolDefinition 必填 name/label/description/parameters/execute。
 *
 * 工具清单：
 *   1. studybuddy_upload_material        → materials.upload
 *   2. studybuddy_convert_material       → materials.convert
 *   3. studybuddy_generate_note          → materials.generateNote
 *   4. studybuddy_replace_material_text  → materials.replaceText
 *   5. studybuddy_update_note           → notes.update
 *   6. studybuddy_update_learn_status   → modules.updateLearnStatus
 */
import { Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { S2Context } from "../../../agent-host/handlers/s2/context";
import { createS2Handlers } from "../../../agent-host/handlers/s2";
import type { Job } from "../../../contract/types";

/** 工具 execute 返回的 content 文本块 */
function textContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

/** 把业务对象序列化为 LLM 可读的 JSON 文本块 */
function jsonContent(obj: unknown): { type: "text"; text: string } {
  return textContent(JSON.stringify(obj, null, 2));
}

/**
 * 创建 S2 全部 6 个 studybuddy_* 工具。
 * @param ctx S2 上下文（数据层句柄，由 studybuddy-extension 注入）
 */
export function createS2Tools(ctx: S2Context): ToolDefinition[] {
  const handlers = createS2Handlers(ctx);

  return [
    // 1. studybuddy_upload_material → materials.upload
    {
      name: "studybuddy_upload_material",
      label: "上传资料",
      description:
        "为指定课程上传一份学习资料。系统会进行 MIME 服务端验证和路径安全检查（拒绝 ../:\\ 路径逃逸），写入 materials 表（status=pending）和 material_uploaded 事件。支持 PDF/DOCX/PPTX/XLSX/TXT/MD/图片。",
      promptSnippet: "上传资料：写入 pending 资料记录 + material_uploaded 事件",
      parameters: Type.Object({
        courseId: Type.String({ description: "课程实例 ID" }),
        file: Type.Object({
          name: Type.String({ description: "文件名（不含路径分隔符）" }),
          size: Type.Number({ description: "文件大小（字节）" }),
          mime: Type.String({ description: "MIME 类型，必须与文件扩展名一致" }),
        }),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["materials.upload"](params);
        return {
          content: [
            textContent(`资料已上传：${result.fileName}（${result.fileType}），状态 ${result.status}`),
            jsonContent(result),
          ],
          details: { materialId: result.id, status: result.status },
        };
      },
    },

    // 2. studybuddy_convert_material → materials.convert
    {
      name: "studybuddy_convert_material",
      label: "转换资料",
      description:
        "触发资料转换 Job（登记 pending 作业，不执行真实转换器）。资料状态从 pending→converting。转换器（PDF/DOCX/PPTX/图片 OCR）在独立后续任务实现。失败可重试（最多 3 次）。",
      promptSnippet: "转换资料：登记 convert Job + Material→converting",
      parameters: Type.Object({
        id: Type.String({ description: "资料 ID" }),
      }),
      async execute(_toolCallId, params) {
        const result = (await handlers["materials.convert"](params)) as Job;
        return {
          content: [
            textContent(`转换作业已登记：${result.jobType}，状态 ${result.status}，重试 ${result.retryCount}/${result.maxRetries}`),
            jsonContent(result),
          ],
          details: { jobId: result.id, jobType: result.jobType, status: result.status },
        };
      },
    },

    // 3. studybuddy_generate_note → materials.generateNote
    {
      name: "studybuddy_generate_note",
      label: "生成笔记",
      description:
        "触发 AI 笔记生成 Job（登记 pending 作业，不执行真实 AI 生成）。资料状态从 converted→note_generating。AI 生成器在独立后续任务实现。失败可重试（最多 3 次）。",
      promptSnippet: "生成笔记：登记 generate_note Job + Material→note_generating",
      parameters: Type.Object({
        id: Type.String({ description: "资料 ID（必须已转换 converted 状态）" }),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["materials.generateNote"](params);
        return {
          content: [
            textContent(`笔记生成作业已登记：${result.jobType}，状态 ${result.status}`),
            jsonContent(result),
          ],
          details: { jobId: result.id, jobType: result.jobType, status: result.status },
        };
      },
    },

    // 4. studybuddy_replace_material_text → materials.replaceText
    {
      name: "studybuddy_replace_material_text",
      label: "替换资料文本",
      description:
        "手动粘贴纯文本跳过转换管道。直接写 normalized_texts + Material 状态→converted。用于转换失败或纯文本资料的场景。",
      promptSnippet: "替换资料文本：跳过转换直写 normalized_texts",
      parameters: Type.Object({
        id: Type.String({ description: "资料 ID" }),
        text: Type.String({ description: "替换的纯文本内容" }),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["materials.replaceText"](params);
        return {
          content: [
            textContent(`资料文本已替换：${result.fileName}，状态 ${result.status}`),
            jsonContent(result),
          ],
          details: { materialId: result.id, status: result.status },
        };
      },
    },

    // 5. studybuddy_update_note → notes.update
    {
      name: "studybuddy_update_note",
      label: "更新笔记",
      description:
        "学生手动编辑结构化笔记（Markdown 正文 + 高亮）。写入 structured_notes 表并更新 updated_at。若笔记不存在则创建（prompt_version='manual'，ai_generated=0）。",
      promptSnippet: "更新笔记：写 structured_notes + highlights",
      parameters: Type.Object({
        materialId: Type.String({ description: "资料 ID" }),
        noteMarkdown: Type.String({ description: "Markdown 笔记正文" }),
        highlights: Type.Optional(
          Type.Array(
            Type.Object({
              text: Type.String({ description: "高亮文本" }),
              color: Type.Optional(Type.String({ description: "高亮颜色（可选）" })),
            }),
          ),
        ),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["notes.update"](params);
        return {
          content: [
            textContent(`笔记已更新：${result.noteMarkdown.slice(0, 50)}${result.noteMarkdown.length > 50 ? "..." : ""}`),
            jsonContent(result),
          ],
          details: { materialId: result.materialId },
        };
      },
    },

    // 6. studybuddy_update_learn_status → modules.updateLearnStatus
    {
      name: "studybuddy_update_learn_status",
      label: "更新学习状态",
      description:
        "更新知识模块的学习状态。状态机：not_started → learning → mastered → needs_review（任意顺序迁移）。非法状态值会被拒绝。",
      promptSnippet: "更新学习状态：not_started→learning→mastered→needs_review",
      parameters: Type.Object({
        id: Type.String({ description: "知识模块 ID" }),
        learnStatus: Type.Union(
          [
            Type.Literal("not_started"),
            Type.Literal("learning"),
            Type.Literal("mastered"),
            Type.Literal("needs_review"),
          ],
          { description: "学习状态：not_started/learning/mastered/needs_review" },
        ),
      }),
      async execute(_toolCallId, params) {
        const result = handlers["modules.updateLearnStatus"](params);
        return {
          content: [
            textContent(`学习状态已更新：${result.moduleName} → ${result.learnStatus}`),
            jsonContent(result),
          ],
          details: { moduleId: result.id, learnStatus: result.learnStatus },
        };
      },
    },
  ];
}

/** S2 工具名清单（用于断言） */
export const S2_TOOL_NAMES = [
  "studybuddy_upload_material",
  "studybuddy_convert_material",
  "studybuddy_generate_note",
  "studybuddy_replace_material_text",
  "studybuddy_update_note",
  "studybuddy_update_learn_status",
] as const;

/** S2 工具数量 */
export const S2_TOOL_COUNT = S2_TOOL_NAMES.length;
