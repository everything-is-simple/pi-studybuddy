/**
 * T-M4-011 S2 文件导入/storage + host 归档只读回归。
 *
 * 权威依据：05-ERD §3.2.1、06-API §3.4、07-Workflow §2.3/§8.3、AGENTS.md §5.3。
 * 只使用 H:\\pi-studybuddy-tmp\\runs\\T-M4-011\\handler-import 隔离目录。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createGlobalDb } from "../../src/data/global";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import { S2Context, createS2Handlers } from "../../src/agent-host/handlers/s2";
import type { Material } from "../../src/contract/types";
import type { TextExtractor } from "../../src/agent-host/handlers/s2/text-extractor";
import { stageTestMaterial } from "../helpers/material-import";

const ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M4-011\\handler-import";
const SOURCE_DIR = join(ROOT, "source");

function call<M extends string>(handlers: Record<string, unknown>, method: M, params: unknown): unknown {
  return (handlers[method] as (input: unknown) => unknown)(params);
}

describe("T-M4-011 S2 文件导入与 host 归档只读", () => {
  let s1: S1Context;
  let s2: S2Context;
  let s1Handlers: ReturnType<typeof createS1Handlers>;
  let s2Handlers: ReturnType<typeof createS2Handlers>;
  let semesterId: string;
  let courseId: string;

  beforeAll(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(SOURCE_DIR, { recursive: true });
    createGlobalDb(ROOT);
    s1 = new S1Context(ROOT);
    s1Handlers = createS1Handlers(s1);
    const semester = call(s1Handlers, "semesters.create", {
      label: "T-M4-011 导入测试学期",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      timezone: "Asia/Shanghai",
    }) as { id: string };
    semesterId = semester.id;
    const course = call(s1Handlers, "courses.create", {
      semesterId,
      courseName: "T-M4-011 测试课程",
      subject: "数学",
    }) as { id: string };
    courseId = course.id;
    const readingExtractor: TextExtractor = {
      async extract(filePath: string): Promise<{ text: string }> {
        return { text: readFileSync(filePath, "utf8") };
      },
    };
    s2 = new S2Context(ROOT, undefined, readingExtractor);
    s2Handlers = createS2Handlers(s2);
  });

  afterAll(async () => {
    s2?.dispose();
    s1?.dispose();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        rmSync(ROOT, { recursive: true, force: true });
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  });

  it("从 path 导入到业务 storage，使用真实大小并阻止归档学期直接 RPC 写入", async () => {
    const sourceContent = "%PDF-T-M4-011 fixture content%\\n";
    const file = stageTestMaterial(ROOT, SOURCE_DIR, "真实资料.pdf", "application/pdf", sourceContent);
    const material = call(s2Handlers, "materials.upload", { courseId, file }) as Material;
    const storedPath = join(ROOT, material.storageKey);

    expect(material.fileSizeBytes).toBe(Buffer.byteLength(sourceContent));
    expect(existsSync(storedPath)).toBe(true);
    expect(readFileSync(storedPath, "utf8")).toBe(sourceContent);

    const convertedJob = await (s2Handlers["materials.convert"] as (input: unknown) => Promise<{ status: string }>)({
      id: material.id,
    });
    expect(convertedJob.status).toBe("completed");
    const normalized = s2
      .semesterDb(semesterId)
      .prepare("SELECT content FROM normalized_texts WHERE material_id = @id")
      .get({ id: material.id }) as { content?: string } | undefined;
    expect(normalized?.content).toBe(sourceContent);

    call(s1Handlers, "semesters.transition", { id: semesterId, status: "teaching_ended" });
    call(s1Handlers, "semesters.transition", { id: semesterId, status: "follow_up" });
    call(s1Handlers, "semesters.transition", { id: semesterId, status: "archived" });

    const archivedFile = stageTestMaterial(ROOT, SOURCE_DIR, "归档资料.pdf", "application/pdf", "%PDF-ARCHIVED%");
    expect(() => call(s2Handlers, "materials.upload", { courseId, file: archivedFile })).toThrowError(/归档|只读/);
    await expect((s2Handlers["materials.convert"] as (input: unknown) => Promise<unknown>)({ id: material.id })).rejects.toThrowError(
      /归档|只读/,
    );
    expect(() =>
      call(s2Handlers, "notes.update", { materialId: material.id, noteMarkdown: "不应写入", highlights: [] }),
    ).toThrowError(/归档|只读/);
  });
});
