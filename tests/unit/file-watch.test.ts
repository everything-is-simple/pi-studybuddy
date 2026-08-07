/**
 * T-M0-005 file-watch 单件测试（03-Arch §6.5/§6.6 + 06-API §3.2/§4）
 *
 * 验证 fs.watch + 100ms 防抖 → server.pushEvent("files.changed", { path, changeType })。
 * 数据隔离：写入 H:\pi-studybuddy-tmp\runs\T-M0-005\ 绝不污染业务数据。
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createFileWatchService, type FileWatchService } from "../../src/agent-host/file-watch";

const ISOLATION_ROOT = path.join(os.tmpdir(), "pi-studybuddy-T-M0-005");

/** 简易 RpcServer stub：记录 pushEvent 调用 */
function makeRpcStub() {
  const events: Array<{ topic: string; payload: unknown; key?: string }> = [];
  return {
    pushEvent(topic: string, payload: unknown, key?: string) {
      events.push({ topic, payload, key });
    },
    events,
    /** 取出 files.changed 事件 */
    fileEvents() {
      return events
        .filter((e) => e.topic === "files.changed")
        .map((e) => e.payload as { path: string; changeType: string });
    },
  };
}

/** 等待 100ms 防抖 + 一点 buffer 让 fs.watch 事件穿透 */
async function waitForDebounce(extraMs = 80): Promise<void> {
  await new Promise((r) => setTimeout(r, 100 + extraMs));
}

describe("file-watch 单件测试（fs.watch + 100ms 防抖）", () => {
  let service: FileWatchService;
  let rpc: ReturnType<typeof makeRpcStub>;

  beforeEach(() => {
    fs.mkdirSync(ISOLATION_ROOT, { recursive: true });
    rpc = makeRpcStub();
    service = createFileWatchService(rpc as unknown as Parameters<typeof createFileWatchService>[0]);
  });

  afterEach(() => {
    service.dispose();
    try {
      fs.rmSync(ISOLATION_ROOT, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("FW-UNIT-01: start 单文件路径 → 启动监听无错误", async () => {
    const filePath = path.join(ISOLATION_ROOT, "single.txt");
    fs.writeFileSync(filePath, "init");
    await expect(service.start(filePath)).resolves.toBeUndefined();
  });

  it("FW-UNIT-02: start 目录路径（recursive）→ 启动监听无错误", async () => {
    await expect(service.start(ISOLATION_ROOT)).resolves.toBeUndefined();
  });

  it("FW-UNIT-03: start 同一 path 两次 → 第二次不抛错（refs=2）", async () => {
    const filePath = path.join(ISOLATION_ROOT, "dup.txt");
    fs.writeFileSync(filePath, "init");
    await service.start(filePath);
    await expect(service.start(filePath)).resolves.toBeUndefined();
  });

  it("FW-UNIT-04: stop 不存在的 path → 静默返回（no-op）", () => {
    expect(() => service.stop(path.join(ISOLATION_ROOT, "nope.txt"))).not.toThrow();
  });

  it("FW-UNIT-05: stop 单次后 refs-- 仍 >0 → 文件变更仍推送事件", async () => {
    const filePath = path.join(ISOLATION_ROOT, "ref.txt");
    fs.writeFileSync(filePath, "init");
    await service.start(filePath);
    await service.start(filePath); // refs=2
    service.stop(filePath); // refs=1
    rpc.events.length = 0;

    fs.writeFileSync(filePath, "modified");
    await waitForDebounce();

    const fileEvents = rpc.fileEvents();
    expect(fileEvents.length).toBeGreaterThanOrEqual(1);
    expect(fileEvents[fileEvents.length - 1].changeType).toBe("change");
  });

  it("FW-UNIT-06: stop 至 refs=0 → 文件变更不再推送事件", async () => {
    const filePath = path.join(ISOLATION_ROOT, "stop.txt");
    fs.writeFileSync(filePath, "init");
    await service.start(filePath);
    service.stop(filePath);
    rpc.events.length = 0;

    fs.writeFileSync(filePath, "modified");
    await waitForDebounce();

    expect(rpc.fileEvents().length).toBe(0);
  });

  it("FW-UNIT-07: dispose → 全部 watcher 关闭，后续变更不再推送", async () => {
    const filePath = path.join(ISOLATION_ROOT, "dispose.txt");
    fs.writeFileSync(filePath, "init");
    await service.start(filePath);
    service.dispose();
    rpc.events.length = 0;

    fs.writeFileSync(filePath, "modified");
    await waitForDebounce();

    expect(rpc.fileEvents().length).toBe(0);
  });

  it("FW-UNIT-08: start 不存在的路径 → 抛错 Path not found", async () => {
    const noPath = path.join(ISOLATION_ROOT, "does-not-exist.txt");
    await expect(service.start(noPath)).rejects.toThrow(/not found/i);
  });

  it("FW-UNIT-09: 100ms 防抖合并多次变更 → server.pushEvent 仅触发一次", async () => {
    const filePath = path.join(ISOLATION_ROOT, "debounce.txt");
    fs.writeFileSync(filePath, "init");
    await service.start(filePath);
    // 等首次 watch 启动稳定
    await new Promise((r) => setTimeout(r, 50));

    rpc.events.length = 0;
    // 100ms 内连续变更 5 次
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(filePath, `v${i}`);
    }
    await waitForDebounce(50);

    const fileEvents = rpc.fileEvents();
    expect(fileEvents.length).toBe(1);
    expect(fileEvents[0].changeType).toBe("change");
  });

  it("FW-UNIT-10: changeType 推断——文件修改 → change", async () => {
    const filePath = path.join(ISOLATION_ROOT, "modify.txt");
    fs.writeFileSync(filePath, "init");
    await service.start(filePath);
    await new Promise((r) => setTimeout(r, 50));

    rpc.events.length = 0;
    fs.writeFileSync(filePath, "modified");
    await waitForDebounce();

    const fileEvents = rpc.fileEvents();
    expect(fileEvents.length).toBe(1);
    expect(fileEvents[0].changeType).toBe("change");
  });

  it("FW-UNIT-11: changeType 推断——目录内新增文件 → add", async () => {
    await service.start(ISOLATION_ROOT);
    await new Promise((r) => setTimeout(r, 50));

    rpc.events.length = 0;
    const newFile = path.join(ISOLATION_ROOT, "new-file.txt");
    fs.writeFileSync(newFile, "new");
    await waitForDebounce(150); // 目录监听 + 防抖

    const fileEvents = rpc.fileEvents();
    expect(fileEvents.length).toBeGreaterThanOrEqual(1);
    const addEvent = fileEvents.find((e) => e.changeType === "add");
    expect(addEvent).toBeDefined();
  });

  it("FW-UNIT-12: changeType 推断——文件删除 → unlink", async () => {
    const filePath = path.join(ISOLATION_ROOT, "delete.txt");
    fs.writeFileSync(filePath, "init");
    await service.start(filePath);
    await new Promise((r) => setTimeout(r, 50));

    rpc.events.length = 0;
    fs.unlinkSync(filePath);
    await waitForDebounce();

    const fileEvents = rpc.fileEvents();
    expect(fileEvents.length).toBe(1);
    expect(fileEvents[0].changeType).toBe("unlink");
  });

  it("FW-UNIT-13: dispose 幂等（重复调用不抛错）", () => {
    expect(() => {
      service.dispose();
      service.dispose();
    }).not.toThrow();
  });

  it("FW-UNIT-ISOLATION: 测试写入隔离目录，不污染业务数据根", () => {
    expect(fs.existsSync(ISOLATION_ROOT)).toBe(true);
    // 验证没有写入真实 userData 路径
    const userData = process.env.LOCALAPPDATA ?? "";
    if (userData) {
      const possibleLeak = path.join(userData, "PiStudyBuddy", "file-watch-test");
      expect(fs.existsSync(possibleLeak)).toBe(false);
    }
  });
});
