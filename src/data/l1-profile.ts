/**
 * T-M3-003 L1 画像写回（05-ERD §4.1）
 *
 * 学科偏好/学习目标写回 %LOCALAPPDATA%\PiStudyBuddy\memory\l1\learner-profile.json。
 * 结构不变（version "1.0"），仅更新 learning_preferences.preferred_subjects / goals。
 * 原子写：先写 .tmp 再 rename（单写进程 OK，避免半写损坏）。
 * 画像文件缺失时按默认结构创建后再写回。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";

/** 写回补丁（可选字段：只更新提供的项，缺省不覆盖） */
export interface LearnerProfilePatch {
  preferred_subjects?: string[];
  goals?: string[];
}

/** L1 画像文件路径（05-ERD §4.1） */
export function learnerProfilePath(dataRoot: string): string {
  return path.join(dataRoot, "memory", "l1", "learner-profile.json");
}

/**
 * 更新 L1 学习者画像（原子写）。
 * @param dataRoot 业务数据根（memory 的父级）
 * @param patch    部分更新字段
 */
export function updateLearnerProfile(dataRoot: string, patch: LearnerProfilePatch): void {
  const profilePath = learnerProfilePath(dataRoot);
  const l1Dir = path.dirname(profilePath);
  mkdirSync(l1Dir, { recursive: true });

  // 读取现有画像（缺失则默认结构）
  let profile: Record<string, unknown>;
  if (existsSync(profilePath)) {
    try {
      profile = JSON.parse(readFileSync(profilePath, "utf8")) as Record<string, unknown>;
    } catch {
      profile = {}; // 损坏时重建
    }
  } else {
    profile = {};
  }

  // 结构兜底（05-ERD §4.1 字段）
  if (typeof profile.version !== "string") profile.version = "1.0";
  if (typeof profile.student_id !== "string") profile.student_id = "local-student";
  const prefs = (profile.learning_preferences ??= {}) as Record<string, unknown>;
  if (patch.preferred_subjects !== undefined) prefs.preferred_subjects = patch.preferred_subjects;
  if (patch.goals !== undefined) {
    // goals 为顶层数组字段（05-ERD §4.1）
    profile.goals = patch.goals;
  }
  profile.updated_at = new Date().toISOString();

  // 原子写：.tmp + rename
  const tmpPath = `${profilePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(profile, null, 2), "utf8");
  renameSync(tmpPath, profilePath);
}
