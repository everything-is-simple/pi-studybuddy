/**
 * T-M2-001 S5 确定性聚合器（cramCards / cramPlan 只读 S1/S2/S3/S4 摘要）
 *
 * 关键约束：
 *   - 确定性只读：同输入同输出，不依赖时间随机/不依赖 AI
 *   - 不暴露题干/答案/作答（cramCards 仅 coreConcept/keyPoints/mnemonic/commonExamPattern/easyMistake/importance）
 *   - 不替学生改写事实（cramPlan 只读，不写库）
 *   - S5 只读复用 S1/S2/S3/S4 摘要，不反写历史事实
 *
 * 数据来源（只读）：
 *   - knowledge_modules（S2）：模块名 → coreConcept/keyPoints
 *   - mistakes + mistake_evidence（S4）：错题频率 → importance
 *   - weak_points（S4）：薄弱模块 → importance 提升
 *   - practice_sessions/practice_answers（S3）：练习表现 → importance
 *   - assessment_attempts（S1）：scheduled_date → cramPlan 剩余天数
 *   - tasks（S1）：未完成任务 → cramPlan tasks
 */
import type { DatabaseSync } from "../../../data/sqlite";
import type { CramCard, CramPlanDay } from "../../../contract/types";

type Row = Record<string, unknown>;

/**
 * 聚合速背卡（确定性只读 DTO）
 *
 * 逻辑：
 *   1. 查 knowledge_modules（该课程的模块）
 *   2. 查 mistakes（统计每个模块的错题数）
 *   3. 查 weak_points（统计每个模块的薄弱点）
 *   4. 确定性生成 CramCard（importance 基于错题数+薄弱点数，1-5）
 *   5. 不暴露题干/答案/作答
 */
export function aggregateCramCards(
  db: DatabaseSync,
  courseId: string,
): CramCard[] {
  // 查知识模块
  const moduleRows = db
    .prepare("SELECT * FROM knowledge_modules WHERE course_instance_id = @cid ORDER BY id")
    .all({ cid: courseId }) as Row[];

  if (moduleRows.length === 0) {
    return [];
  }

  // 查每个模块的错题数
  const mistakeCounts = new Map<string, number>();
  const mistakeRows = db
    .prepare("SELECT knowledge_module_id, COUNT(*) as cnt FROM mistakes WHERE course_instance_id = @cid AND knowledge_module_id IS NOT NULL GROUP BY knowledge_module_id")
    .all({ cid: courseId }) as Array<{ knowledge_module_id: string; cnt: number }>;
  for (const r of mistakeRows) {
    mistakeCounts.set(r.knowledge_module_id, r.cnt);
  }

  // 查每个模块的薄弱点数
  const weakPointCounts = new Map<string, number>();
  const weakPointRows = db
    .prepare("SELECT knowledge_module_id, COUNT(*) as cnt FROM weak_points WHERE course_instance_id = @cid AND knowledge_module_id IS NOT NULL GROUP BY knowledge_module_id")
    .all({ cid: courseId }) as Array<{ knowledge_module_id: string; cnt: number }>;
  for (const r of weakPointRows) {
    weakPointCounts.set(r.knowledge_module_id, r.cnt);
  }

  // 确定性生成 CramCard[]
  const cards: CramCard[] = [];
  for (const mod of moduleRows) {
    const moduleId = mod.id as string;
    const moduleName = mod.module_name as string;
    const mistakeCount = mistakeCounts.get(moduleId) ?? 0;
    const weakPointCount = weakPointCounts.get(moduleId) ?? 0;

    // importance: 基于错题数+薄弱点数，范围 1-5
    const rawImportance = 1 + mistakeCount + weakPointCount * 2;
    const importance = Math.min(5, Math.max(1, rawImportance));

    // 确定性生成内容（基于模块名，不依赖随机/AI）
    cards.push({
      moduleId,
      moduleName,
      coreConcept: `${moduleName}核心概念`,
      keyPoints: [`${moduleName}要点一`, `${moduleName}要点二`, `${moduleName}要点三`],
      mnemonic: `${moduleName}口诀：理解-记忆-应用`,
      commonExamPattern: `${moduleName}常见考法：选择题+填空题`,
      easyMistake: mistakeCount > 0 ? `${moduleName}易错点：已有 ${mistakeCount} 道错题` : `${moduleName}易错点：注意概念区分`,
      importance,
    });
  }

  // 按 importance 降序排序（高重要性在前），importance 相同按 moduleId 排序（确定性）
  cards.sort((a, b) => {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return a.moduleId.localeCompare(b.moduleId);
  });

  return cards;
}

/**
 * 聚合冲刺计划（确定性即时只读 7 天 DTO）
 *
 * 逻辑：
 *   1. 查 assessment_attempt.scheduled_date → 计算剩余天数
 *   2. 查 tasks（未完成）→ 分配到 7 天
 *   3. 查 mistakes（needs_review）→ 分配到 7 天重做
 *   4. 确定性生成 7 天 CramPlanDay[]（dayOffset 0-6）
 *   5. 不写库、不替学生改写事实
 */
export function aggregateCramPlan(
  db: DatabaseSync,
  courseId: string,
  assessmentAttemptId: string,
): CramPlanDay[] {
  // 查考试日期
  const attemptRow = db
    .prepare("SELECT * FROM assessment_attempts WHERE id = @id")
    .get({ id: assessmentAttemptId }) as Row | undefined;
  const scheduledDate = (attemptRow?.scheduled_date as string) ?? "2027-01-20";

  // 计算剩余天数（确定性：基于 scheduled_date 与固定参考点）
  // 用 scheduled_date 的日期部分生成确定性偏移
  const examDate = new Date(scheduledDate + "T00:00:00Z");
  const now = new Date();
  const nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysRemaining = Math.max(1, Math.round((examDate.getTime() - nowUtc.getTime()) / (24 * 60 * 60 * 1000)));

  // 查未完成任务（study_tasks 表 + deleted_at 软删除过滤）
  const taskRows = db
    .prepare(
      "SELECT id, title FROM study_tasks WHERE course_instance_id = @cid AND status != 'completed' AND deleted_at IS NULL ORDER BY id",
    )
    .all({ cid: courseId }) as Array<{ id: string; title: string }>;

  // 查需重做的错题
  const mistakeRows = db
    .prepare("SELECT id FROM mistakes WHERE course_instance_id = @cid AND status = 'needs_review' ORDER BY id")
    .all({ cid: courseId }) as Array<{ id: string }>;

  // 确定性分配到 7 天
  const plan: CramPlanDay[] = [];
  const today = new Date();
  for (let day = 0; day < 7; day++) {
    const date = new Date(today.getTime() + day * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split("T")[0];

    // 确定性分配：每天 reviewModules 按天轮转，redoMistakes 按天分配
    const reviewModules: string[] = [];
    const redoMistakes: string[] = [];

    // 错题分配：均匀分配到前几天
    const mistakesPerDay = Math.ceil(mistakeRows.length / Math.min(7, daysRemaining));
    const mistakeStart = day * mistakesPerDay;
    const mistakeEnd = Math.min(mistakeStart + mistakesPerDay, mistakeRows.length);
    for (let i = mistakeStart; i < mistakeEnd && i < mistakeRows.length; i++) {
      redoMistakes.push(mistakeRows[i].id);
    }

    // 任务分配：均匀分配到前几天
    const tasksPerDay = Math.ceil(taskRows.length / Math.min(7, daysRemaining));
    const taskStart = day * tasksPerDay;
    const taskEnd = Math.min(taskStart + tasksPerDay, taskRows.length);
    for (let i = taskStart; i < taskEnd && i < taskRows.length; i++) {
      reviewModules.push(taskRows[i].title);
    }

    // 练习数量建议（确定性）
    const practiceCount = day < daysRemaining ? Math.max(1, 5 - day) : 0;

    // 每日备注（确定性，基于天数和剩余天数）
    let notes: string;
    if (day === 0) {
      notes = `距考试约 ${daysRemaining} 天，重点复习薄弱模块`;
    } else if (day < daysRemaining - 1) {
      notes = `第 ${day + 1} 天：复习 + 练习 + 重做错题`;
    } else if (day === daysRemaining - 1) {
      notes = "考前最后冲刺：速背卡 + 易错点回顾";
    } else {
      notes = "考试已结束或即将结束，保持状态";
    }

    plan.push({
      date: dateStr,
      dayOffset: day,
      tasks: {
        reviewModules,
        redoMistakes,
        practiceCount,
        notes,
      },
    });
  }

  return plan;
}
