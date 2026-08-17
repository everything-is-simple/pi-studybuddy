/**
 * T-M5-006 external capability degradation RED/GREEN.
 *
 * 生产路径缺少 OCR/whisper 配置时必须固定失败，不能用 mock 冒充成功。
 * 测试/显式注入路径仍可使用 mock。
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createPcmWavBuffer } from "../e2e/helpers/fixtures";
import { createOcrTools } from "../../src/agent/tools/s1/ocr-tools";
import { S1Context, createS1Handlers } from "../../src/agent-host/handlers/s1";
import { createRuntimeS2Context, createS2Handlers } from "../../src/agent-host/handlers/s2";
import { S7Context } from "../../src/agent-host/handlers/s7/context";
import { handleTranscribe } from "../../src/agent-host/handlers/s7/class-capture";
import { createGlobalDb } from "../../src/data/global";
import type { Job, Material } from "../../src/contract/types";
import { stageTestMaterial } from "../helpers/material-import";

const RUN_ROOT = "H:\\pi-studybuddy-tmp\\runs\\T-M5-006\\external-degradation";

describe("T-M5-006 external capability degradation", () => {
  it("OCR-01: production OCR tool without adapter/config fails with fixed Chinese message", async () => {
    fs.mkdirSync(RUN_ROOT, { recursive: true });
    const imagePath = path.join(RUN_ROOT, "schedule.png");
    fs.writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const [tool] = createOcrTools(undefined, { allowMock: false });

    await expect(tool.execute("call-ocr", { imagePath })).rejects.toMatchObject({
      message: "OCR 识别未配置，请在设置中指定 OCR 引擎路径",
    });
  });

  it("WPS-01: production S2 converts legacy Office to fixed failed job when WPS bridge is not configured", async () => {
    const dataRoot = path.join(RUN_ROOT, "wps");
    fs.rmSync(dataRoot, { recursive: true, force: true });
    fs.mkdirSync(dataRoot, { recursive: true });
    createGlobalDb(dataRoot);

    const s1Ctx = new S1Context(dataRoot);
    const s1Handlers = createS1Handlers(s1Ctx);
    const semester = s1Handlers["semesters.create"]({
      label: "T-M5-006 WPS",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      timezone: "Asia/Shanghai",
    }) as { id: string };
    const course = s1Handlers["courses.create"]({
      semesterId: semester.id,
      courseName: "WPS 外部能力",
      subject: "语文",
    }) as { id: string };

    const s2Ctx = createRuntimeS2Context(dataRoot, { env: {}, isTest: false });
    const s2Handlers = createS2Handlers(s2Ctx);
    const file = stageTestMaterial(dataRoot, path.join(dataRoot, "fixtures"), "legacy.doc", "application/msword", "legacy content");
    const material = s2Handlers["materials.upload"]({ courseId: course.id, file }) as Material;
    const job = await s2Handlers["materials.convert"]({ id: material.id }) as Job;
    const after = s2Handlers["materials.get"]({ id: material.id }) as Material;

    expect(job.jobType).toBe("wps_convert");
    expect(job.status).toBe("failed");
    expect(job.errorMessage).toBe("WPS 转换未配置，请在设置中指定 WPS 桥引擎路径");
    expect(after.status).toBe("conversion_failed");

    s2Ctx.dispose();
    s1Ctx.dispose();
  });

  it("WHISPER-01: production S7 without whisper config fails with fixed Chinese message", async () => {
    fs.mkdirSync(RUN_ROOT, { recursive: true });
    const wavPath = path.join(RUN_ROOT, "class.wav");
    fs.writeFileSync(wavPath, createPcmWavBuffer(16));
    const ctx = new S7Context(RUN_ROOT, { allowMockWhisper: false });
    const transcribe = handleTranscribe(ctx);

    await expect(transcribe({
      courseId: "course-short",
      audioFile: { id: "file-short", name: "class.wav", mimeType: "audio/wav", sizeBytes: 44, path: wavPath },
      permissionConfirmed: true,
    })).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "语音转写未配置，请在设置中指定 whisper.cpp 路径",
    });
  });
});
