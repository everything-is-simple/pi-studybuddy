/**
 * T-M1-008 context-pack（03-Arch §2.3 before_agent_start 多源上下文注入）
 *
 * 构造可注入 systemPrompt 的上下文段：
 *   - L1 学习者画像（memory/l1/learner-profile.json，05-ERD §4.1）
 *   - 当前激活学期 + 课程（global.db semesters + semester.db course_instances）
 *   - 最近学习事件（memory/l1/events.jsonl 末尾 8 行）
 *
 * 缺失任一来源时跳过对应段，绝不让上下文注入失败阻塞 agent 启动。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { S1Context } from "../agent-host/handlers/s1/context";

export interface StudyContextSections {
  sections: string[];
}

/** 构造 before_agent_start 多源上下文段 */
export function buildStudyContextSections(opts: { dataRoot: string }): Promise<StudyContextSections> {
  const sections: string[] = [];
  const l1Dir = path.join(opts.dataRoot, "memory", "l1");

  // L1 学习者画像
  const profilePath = path.join(l1Dir, "learner-profile.json");
  if (existsSync(profilePath)) {
    try {
      const profile = JSON.parse(readFileSync(profilePath, "utf8")) as {
        basic_info?: { name?: string; grade_level?: string };
        learning_preferences?: { preferred_subjects?: string[] };
      };
      const name = profile?.basic_info?.name ?? "";
      const grade = profile?.basic_info?.grade_level ?? "";
      const subjects = profile?.learning_preferences?.preferred_subjects ?? [];
      sections.push(
        `【学习者画像】${name || "未命名学生"}${grade ? `（${grade}）` : ""}；偏好科目：${subjects.length ? subjects.join("、") : "未设置"}。`,
      );
    } catch {
      // 画像解析失败跳过
    }
  }

  // 当前激活学期 + 课程
  const ctx = new S1Context(opts.dataRoot);
  try {
    const active = ctx.globalDb
      .prepare(
        "SELECT id, semester_label FROM semesters WHERE status = 'active' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
      )
      .get() as { id: string; semester_label: string } | undefined;
    if (active) {
      const courses = ctx
        .semesterDb(active.id)
        .prepare("SELECT course_name FROM course_instances WHERE deleted_at IS NULL ORDER BY created_at ASC")
        .all() as Array<{ course_name: string }>;
      const courseText = courses.length ? courses.map((c) => c.course_name).join("、") : "尚未登记课程";
      sections.push(`【当前学期】${active.semester_label}；课程：${courseText}。`);
    }
  } catch {
    // 库未初始化/表不存在时跳过学期段
  } finally {
    ctx.dispose();
  }

  // 最近学习事件
  const eventsPath = path.join(l1Dir, "events.jsonl");
  if (existsSync(eventsPath)) {
    try {
      const lines = readFileSync(eventsPath, "utf8").split("\n").filter((l) => l.trim() !== "");
      const recent = lines.slice(-8);
      if (recent.length) {
        sections.push(`【最近学习事件】\n${recent.join("\n")}`);
      }
    } catch {
      // 忽略
    }
  }

  return Promise.resolve({ sections });
}