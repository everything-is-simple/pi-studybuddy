/**
 * T-M1-002 S2 handler DTO 映射（05-ERD §3.2 → contract/types.ts DTO）
 *
 * 把 db 行（snake_case）映射为 DTO（camelCase），对齐 05-ERD §3.2 七表 schema 字段。
 */
import type {
  Material,
  StructuredNote,
  MindMap,
  KnowledgeModule,
  Job,
} from "../../../contract/types";

type Row = Record<string, unknown>;

export function mapMaterial(r: Row): Material {
  return {
    id: r.id as string,
    courseId: r.course_instance_id as string,
    fileName: r.file_name as string,
    fileType: r.file_type as Material["fileType"],
    fileSizeBytes: r.file_size_bytes as number,
    mimeType: r.mime_type as string,
    storageKey: r.storage_key as string,
    sourceType: r.source_type as Material["sourceType"],
    status: r.status as Material["status"],
    permissionConfirmed: r.permission_confirmed as number,
    uploadedAt: r.uploaded_at as string,
    convertedAt: (r.converted_at as string) ?? undefined,
    noteGeneratedAt: (r.note_generated_at as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    deletedAt: (r.deleted_at as string) ?? undefined,
  };
}

export function mapNote(r: Row): StructuredNote {
  // highlights_json: JSON 字符串 → DTO 数组
  let highlights: Array<{ text: string; color?: string }> = [];
  if (r.highlights_json) {
    try {
      highlights = JSON.parse(r.highlights_json as string) as Array<{ text: string; color?: string }>;
    } catch {
      highlights = [];
    }
  }
  return {
    id: r.id as string,
    materialId: r.material_id as string,
    courseId: r.course_instance_id as string,
    noteMarkdown: r.note_markdown as string,
    highlights,
    promptVersion: r.prompt_version as string,
    model: r.model as string,
    tokenCount: (r.token_count as number) ?? undefined,
    aiGenerated: r.ai_generated as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function mapMindMap(r: Row): MindMap {
  return {
    id: r.id as string,
    materialId: r.material_id as string,
    courseId: r.course_instance_id as string,
    markmapJson: r.markmap_json as string,
    createdAt: r.created_at as string,
  };
}

export function mapModule(r: Row): KnowledgeModule {
  return {
    id: r.id as string,
    courseId: r.course_instance_id as string,
    materialId: r.material_id as string,
    moduleName: r.module_name as string,
    summary: (r.summary as string) ?? undefined,
    importance: (r.importance as number) ?? undefined,
    difficulty: (r.difficulty as number) ?? undefined,
    learnStatus: r.learn_status as KnowledgeModule["learnStatus"],
    sourceEvidenceJson: r.source_evidence_json as string,
    aiGenerated: r.ai_generated as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    deletedAt: (r.deleted_at as string) ?? undefined,
  };
}

export function mapJob(r: Row): Job {
  return {
    id: r.id as string,
    materialId: r.material_id as string,
    jobType: r.job_type as Job["jobType"],
    status: r.status as Job["status"],
    retryCount: r.retry_count as number,
    maxRetries: r.max_retries as number,
    errorCode: (r.error_code as string) ?? undefined,
    errorMessage: (r.error_message as string) ?? undefined,
    startedAt: (r.started_at as string) ?? undefined,
    completedAt: (r.completed_at as string) ?? undefined,
    timeoutMs: (r.timeout_ms as number) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
