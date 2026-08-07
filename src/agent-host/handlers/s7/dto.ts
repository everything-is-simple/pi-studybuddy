/**
 * T-M2-003 S7 handler DTO 映射（05-ERD §3.2.1 → contract/types.ts Material DTO）
 *
 * 复用 S2 mapMaterial 字段映射规则（T-M1-002），S7 saveTranscription 创建 material 后映射返回。
 * S7 创建的 material 固定字段：file_type='text' / source_type='class_audio_transcription' /
 * status='converted' / permission_confirmed=1。
 */
import type { Material } from "../../../contract/types";

type Row = Record<string, unknown>;

/** mapMaterial：materials 行 → Material DTO（字段对齐 05-ERD §3.2.1 13 字段） */
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
