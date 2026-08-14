/**
 * 真实测试数据库构建器。
 *
 * 目的：测试使用独立的 SQLite 数据库，而非 renderer mock RPC 或运行时 test.* seed 方法。
 * 该构建器只在测试进程启动 Electron 之前写入 H:\pi-studybuddy-tmp\runs\ 下的隔离根；
 * 业务进程仍通过正式 handler 读取、写入、校验完整的 global.db / semester/<id>/sem.db。
 */
import fs from "node:fs";
import path from "node:path";

import { initializeDataRoot } from "../../src/main/data-root-init";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import { S2Context, createS2Handlers } from "../../src/agent-host/handlers/s2";
import { stageMaterialImport } from "../../src/shared/material-import";
import type { AssessmentAttempt, CourseInstance, Material, Semester } from "../../src/contract/types";

export interface SprintTestDatabaseFixture {
  dataRoot: string;
  semesterId: string;
  courseId: string;
  materialId: string;
  moduleId: string;
  confirmedExamId: string;
  unconfirmedExamId: string;
}

/**
 * 创建 S1-S5 冲刺链路的真实 SQLite 测试数据库。
 *
 * 允许的受控 fixture 只有测试数据库中的样本学习内容；所有业务实体都由正式 schema
 * 与正式 handler 创建；不通过 renderer mock、运行期 test.* seed 或直接 SQL 写入模块。
 */
export function prepareSprintTestDatabase(dataRoot: string): SprintTestDatabaseFixture {
  // 此根仅由本构建器复用；在测试开始前清理上轮残留。
  fs.rmSync(dataRoot, { recursive: true, force: true });
  initializeDataRoot(dataRoot);

  const s1Ctx = new S1Context(dataRoot);
  const s2Ctx = new S2Context(dataRoot);
  try {
    const s1 = createS1Handlers(s1Ctx);
    const s2 = createS2Handlers(s2Ctx);

    const semester = (s1["semesters.create"] as (params: unknown) => Semester)({
      label: "测试数据库 2026 秋",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      timezone: "Asia/Shanghai",
    });
    const course = (s1["courses.create"] as (params: unknown) => CourseInstance)({
      semesterId: semester.id,
      courseName: "测试数据库 高等数学",
      subject: "数学",
    });

    const sourceDir = path.join(dataRoot, "test-source");
    fs.mkdirSync(sourceDir, { recursive: true });
    const sourceFile = path.join(sourceDir, "极限与连续.md");
    fs.writeFileSync(sourceFile, "# 极限与连续\n函数极限描述自变量趋近时函数值的变化。", "utf8");
    const capability = stageMaterialImport(dataRoot, sourceFile);
    const material = (s2["materials.upload"] as (params: unknown) => Material)({
      courseId: course.id,
      file: {
        name: capability.fileName,
        size: capability.fileSize,
        mime: "text/markdown",
        importToken: capability.token,
      },
    });
    (s2["materials.replaceText"] as (params: unknown) => Material)({
      id: material.id,
      text: "极限与连续：当自变量趋近给定值时，函数值趋近唯一极限。",
    });

    const createdModule = (s2["modules.create"] as (params: unknown) => { id: string })({
      courseId: course.id,
      materialId: material.id,
      moduleName: "极限定义",
      summary: "理解函数极限的定义与基本性质。",
      importance: 4,
      difficulty: 3,
    });
    const moduleId = createdModule.id;

    const confirmedExam = (s1["exams.add"] as (params: unknown) => AssessmentAttempt)({
      courseId: course.id,
      examName: "测试数据库期末考试",
      examType: "final",
      scheduledDate: "2027-01-20",
      source: "student_input",
    });
    (s1["exams.confirm"] as (params: unknown) => AssessmentAttempt)({ id: confirmedExam.id, confirmed: true });
    const unconfirmedExam = (s1["exams.add"] as (params: unknown) => AssessmentAttempt)({
      courseId: course.id,
      examName: "测试数据库未确认测验",
      examType: "quiz",
      scheduledDate: "2026-11-15",
      source: "student_input",
    });

    return {
      dataRoot,
      semesterId: semester.id,
      courseId: course.id,
      materialId: material.id,
      moduleId,
      confirmedExamId: confirmedExam.id,
      unconfirmedExamId: unconfirmedExam.id,
    };
  } finally {
    // Electron 启动前关闭所有连接，避免 Windows SQLite WAL/文件锁干扰真实应用进程。
    s2Ctx.dispose();
    s1Ctx.dispose();
  }
}
