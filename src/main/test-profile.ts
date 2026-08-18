import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { S1Context, createS1Handlers } from "../agent-host/handlers/s1";
import { S2Context, createS2Handlers } from "../agent-host/handlers/s2";
import { stageMaterialImport } from "../shared/material-import";

const TEST_PROFILE_FLAG = "1";
const SEED_MARKER = ".test-profile-seeded";

type Handler = (params: unknown) => unknown;
type HandlerMap = Record<string, Handler>;

function call<T>(handlers: HandlerMap, method: string, params: unknown): T {
  const handler = handlers[method];
  if (!handler) throw new Error(`测试 profile handler 缺失：${method}`);
  return handler(params) as T;
}

/**
 * Explicit test-package opt-in only. The fixture is created through formal handlers
 * in a dedicated data root; no production root or pre-generated database is bundled.
 */
export function seedTestProfile(dataRoot: string): void {
  if (process.env.PI_STUDYBUDDY_TEST_PROFILE !== TEST_PROFILE_FLAG) return;

  const markerPath = path.join(dataRoot, SEED_MARKER);
  if (existsSync(markerPath)) return;

  const s1Context = new S1Context(dataRoot);
  const s2Context = new S2Context(dataRoot);
  try {
    const s1 = createS1Handlers(s1Context) as HandlerMap;
    const s2 = createS2Handlers(s2Context) as HandlerMap;
    const semester = call<{ id: string }>(s1, "semesters.create", {
      label: "Synthetic Test Semester",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      timezone: "Asia/Shanghai",
    });
    const course = call<{ id: string }>(s1, "courses.create", {
      semesterId: semester.id,
      courseName: "Synthetic Mathematics",
      subject: "Mathematics",
    });

    const sourceDir = path.join(dataRoot, "test-profile-source");
    mkdirSync(sourceDir, { recursive: true });
    const sourcePath = path.join(sourceDir, "synthetic-material.md");
    writeFileSync(
      sourcePath,
      "# Synthetic Limits\n\nThis material is generated for the test profile and contains no user content.\n",
      "utf8",
    );
    const capability = stageMaterialImport(dataRoot, sourcePath);
    const material = call<{ id: string }>(s2, "materials.upload", {
      courseId: course.id,
      file: {
        name: capability.fileName,
        size: capability.fileSize,
        mime: "text/markdown",
        importToken: capability.token,
      },
    });
    call(s2, "materials.replaceText", {
      id: material.id,
      text: "Synthetic limits material for controlled package verification.",
    });
    call(s2, "modules.create", {
      courseId: course.id,
      materialId: material.id,
      moduleName: "Synthetic Limit Definition",
      summary: "Synthetic knowledge module used by the test setup.",
      importance: 3,
      difficulty: 2,
    });

    const exam = call<{ id: string }>(s1, "exams.add", {
      courseId: course.id,
      examName: "Synthetic Final Exam",
      examType: "final",
      scheduledDate: "2027-01-20",
      source: "student_input",
    });
    call(s1, "exams.confirm", { id: exam.id, confirmed: true });
    writeFileSync(markerPath, JSON.stringify({ schemaVersion: 1, profileId: "synthetic-study-workbench" }), "utf8");
  } finally {
    s2Context.dispose();
    s1Context.dispose();
  }
}
