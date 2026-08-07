/**
 * T-M2-004 TTS Adapter（03-Arch §3.3 + §3.2 + 07-WF §4 + 08-Test §3.5/§5.4）
 *
 * 设计契约（03-Arch §3.3 外部桥 Adapter）：
 *   - SAPI 默认（Windows 系统自带、零依赖、离线可用）
 *   - edge-tts 可选（需网络 + 预装 CLI），失败自动降级 SAPI
 *   - 子进程调用（SAPI 走 powershell System.Speech；edge-tts 走 CLI）
 *   - 路径只来自配置（不猜路径，不回退云端）
 *   - 路径/stdout/stderr/密钥不泄漏；固定错误码
 *
 * 安全不变量（07-WF §4.3 + 08-Test §5.4）：
 *   - 不连真实 SAPI/edge-tts（测试全 mock）
 *   - 错误消息固定文案，不含 cliPath/stdout/stderr/密钥
 *   - 返回值仅含 { playbackId, engine, fallbackUsed? }，不含 stdout/stderr
 *
 * 本任务范围（08-Test §5.4 不连真实 SAPI/edge-tts）：
 *   - createMockTtsAdapter：默认 mock 确定性返回固定 playbackId + engine=sapi，所有测试用此
 *   - createFailingTtsAdapter：测试失败路径，speak 抛 INTERNAL_ERROR 固定文案
 *   - createRealSapiAdapter：真实 spawn powershell 框架（路径校验 + spawn 调用），
 *     集成测试不调真实子进程，仅校验路径未配置错误路径
 *   - createRealEdgeTtsAdapter：真实 spawn edge-tts CLI 框架，同上
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { RpcError, TtsSpeakResult } from "../../../contract/types";

/** Adapter 朗读控制：play/pause/stop + 可选 rate */
export type TtsControlAction = "play" | "pause" | "stop";

/** Adapter 状态查询结果（与 contract TtsStatus 一致） */
export interface TtsAdapterStatus {
  state: "playing" | "paused" | "stopped";
  position: number;
  duration: number;
}

/**
 * TtsAdapter 接口：可注入（03-Arch §3.3 + §6.2 上下文注入模式）。
 *
 * 职责：合成并播放文本 + 控制 + 查询状态。
 * playbackId 由 adapter 内部生成（mock 用确定性 ID，real 用 uuid）。
 */
export interface TtsAdapter {
  /** 合成并播放文本，返回 playbackId + 引擎 + 是否降级 */
  speak(text: string, opts?: { engine?: "sapi" | "edge-tts"; rate?: number }): Promise<TtsSpeakResult>;
  /** 控制播放（play/pause/stop） */
  control(playbackId: string, action: TtsControlAction, rate?: number): Promise<void>;
  /** 查询状态 */
  getStatus(playbackId: string): TtsAdapterStatus;
}

/** INTERNAL_ERROR 固定文案（07-WF §4.3 错误处理，不泄漏路径/stdout/stderr） */
const MSG_SAPI_UNAVAILABLE = "系统 TTS 不可用，请安装 edge-tts 或检查系统设置";
const MSG_EDGE_TTS_NOT_CONFIGURED = "edge-tts 未配置，请在设置中指定 edge-tts CLI 路径";
const MSG_TTS_FAILED = "朗读失败，请检查系统 TTS 设置或切换引擎";

function internalError(message: string): RpcError {
  return { code: "INTERNAL_ERROR", message };
}

function badRequest(message: string): RpcError {
  return { code: "BAD_REQUEST", message };
}

/** Mock 播放记录（确定性模拟状态机 + 位置推进） */
interface MockPlayback {
  playbackId: string;
  state: "playing" | "paused" | "stopped";
  startedAt: number;
  elapsedBeforePauseMs: number;
  lastResumeAt: number;
  text: string;
  rate: number;
}

/** 确定性 duration：每字 50ms（mock 模拟，09-UI 进度条容忍近似） */
function mockDuration(text: string): number {
  return Math.max(1000, text.length * 50);
}

/**
 * Mock Adapter：确定性返回固定 playbackId + engine=sapi，不调真实子进程（08-Test §5.4 全 mock）。
 *
 * 状态机：speak→playing / pause→paused / play→playing / stop→stopped。
 * position 由 elapsed 时间计算（playing 时累加，paused 时冻结）。
 */
export function createMockTtsAdapter(): TtsAdapter {
  const playbacks = new Map<string, MockPlayback>();

  return {
    async speak(text: string, opts?: { engine?: "sapi" | "edge-tts"; rate?: number }): Promise<TtsSpeakResult> {
      const playbackId = `mock_${randomUUID()}`;
      const now = Date.now();
      playbacks.set(playbackId, {
        playbackId,
        state: "playing",
        startedAt: now,
        elapsedBeforePauseMs: 0,
        lastResumeAt: now,
        text,
        rate: opts?.rate ?? 1.0,
      });
      // mock 按 opts.engine 返回（默认 sapi，switchEngine 后 edge-tts 正常返回）
      const engine = opts?.engine ?? "sapi";
      return { playbackId, engine };
    },

    async control(playbackId: string, action: TtsControlAction, _rate?: number): Promise<void> {
      const p = playbacks.get(playbackId);
      if (!p) {
        throw badRequest("未找到朗读会话");
      }
      const now = Date.now();
      if (action === "pause") {
        if (p.state === "playing") {
          p.elapsedBeforePauseMs += now - p.lastResumeAt;
          p.state = "paused";
        }
      } else if (action === "play") {
        if (p.state === "paused") {
          p.lastResumeAt = now;
          p.state = "playing";
        }
      } else if (action === "stop") {
        p.state = "stopped";
      }
    },

    getStatus(playbackId: string): TtsAdapterStatus {
      const p = playbacks.get(playbackId);
      if (!p) {
        throw badRequest("未找到朗读会话");
      }
      const duration = mockDuration(p.text);
      let position = p.elapsedBeforePauseMs;
      if (p.state === "playing") {
        position += Date.now() - p.lastResumeAt;
      }
      // 停止后 position 固定在 duration（朗读完成）
      if (p.state === "stopped") {
        position = duration;
      }
      return { state: p.state, position: Math.min(position, duration), duration };
    },
  };
}

/**
 * Failing Adapter：用于测试 handler 失败路径（08-Test §3.5 错误处理）。
 *
 * speak 抛 INTERNAL_ERROR + 固定文案"系统 TTS 不可用..."（模拟真实 SAPI 不可用）。
 * control/getStatus 抛 BAD_REQUEST（模拟会话不存在）。
 */
export function createFailingTtsAdapter(): TtsAdapter {
  return {
    async speak(): Promise<TtsSpeakResult> {
      throw internalError(MSG_SAPI_UNAVAILABLE);
    },
    async control(): Promise<void> {
      throw badRequest("未找到朗读会话");
    },
    getStatus(): TtsAdapterStatus {
      throw badRequest("未找到朗读会话");
    },
  };
}

/**
 * Failing Edge-TTS Adapter：用于测试 edge-tts 降级路径（08-Test §3.5 断言 2）。
 *
 * speak(engine=edge-tts) 抛 INTERNAL_ERROR（模拟网络失败），handler 层捕获后降级 SAPI。
 */
export function createFailingEdgeTtsAdapter(): TtsAdapter {
  return {
    async speak(_text: string, opts?: { engine?: "sapi" | "edge-tts"; rate?: number }): Promise<TtsSpeakResult> {
      // engine=edge-tts 时抛错（模拟网络失败），engine=sapi 时用 mock 行为（降级后正常）
      if (opts?.engine === "edge-tts") {
        throw internalError(MSG_TTS_FAILED);
      }
      // 降级到 SAPI 的 mock 行为
      const playbackId = `mock_${randomUUID()}`;
      return { playbackId, engine: "sapi", fallbackUsed: true };
    },
    async control(playbackId: string): Promise<void> {
      throw badRequest("未找到朗读会话: " + playbackId.slice(0, 8));
    },
    getStatus(): TtsAdapterStatus {
      throw badRequest("未找到朗读会话");
    },
  };
}

/**
 * Real SAPI Adapter：spawn powershell 子进程调用 System.Speech.Synthesis。
 *
 * 本任务范围（08-Test §5.4 不连真实 SAPI）：
 *   - 路径校验（sapiCliPath 非空，实际为 powershell.exe 路径或空走系统 PATH）
 *   - 真实 spawn 调用：实现框架，但集成测试不触发此路径
 *
 * 真实 SAPI 集成留待 E2E 受控夹具（08-Test §3.5 注释），不在本任务范围。
 *
 * 注意：SAPI 是 Windows 系统自带，powershell.exe 通常在系统 PATH，所以 sapiCliPath 可为空（走 PATH）。
 * 但为统一外部桥契约，仍保留 sapiCliPath 配置项（空时走 PATH）。
 */
export function createRealSapiAdapter(opts: { sapiCliPath?: string }): TtsAdapter {
  const { sapiCliPath } = opts;
  const playbacks = new Map<string, MockPlayback>();

  return {
    async speak(text: string, spOpts?: { engine?: "sapi" | "edge-tts"; rate?: number }): Promise<TtsSpeakResult> {
      // SAPI 默认引擎，engine=edge-tts 不应走到此 adapter（handler 层路由）
      const playbackId = `sapi_${randomUUID()}`;
      const now = Date.now();
      playbacks.set(playbackId, {
        playbackId,
        state: "playing",
        startedAt: now,
        elapsedBeforePauseMs: 0,
        lastResumeAt: now,
        text,
        rate: spOpts?.rate ?? 1.0,
      });

      // 真实 spawn powershell 调用 System.Speech（本任务范围不连真实子进程，框架实现）
      // E2E 受控夹具会注入真实 sapiCliPath 触发此路径
      const cmd = sapiCliPath && sapiCliPath.trim() !== "" ? sapiCliPath : "powershell.exe";
      return new Promise<TtsSpeakResult>((resolve, reject) => {
        const child = spawn(
          cmd,
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = ${spOpts?.rate ?? 0}; $s.Speak([Console]::In.ReadToEnd());`,
          ],
          { stdio: ["pipe", "pipe", "pipe"] },
        );

        child.stdin?.write(text);
        child.stdin?.end();

        let stderr = "";
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });

        child.on("error", () => {
          // 错误消息固定文案，不泄漏路径/stdout/stderr（07-WF §4.3）
          playbacks.delete(playbackId);
          reject(internalError(MSG_SAPI_UNAVAILABLE));
        });

        child.on("close", (code: number | null) => {
          if (code !== 0) {
            // 错误消息固定文案，不泄漏 stderr（07-WF §4.3）
            playbacks.delete(playbackId);
            reject(internalError(MSG_SAPI_UNAVAILABLE));
            return;
          }
          resolve({ playbackId, engine: "sapi" });
        });
      });
    },

    async control(playbackId: string, action: TtsControlAction, _rate?: number): Promise<void> {
      const p = playbacks.get(playbackId);
      if (!p) {
        throw badRequest("未找到朗读会话");
      }
      const now = Date.now();
      if (action === "pause" && p.state === "playing") {
        p.elapsedBeforePauseMs += now - p.lastResumeAt;
        p.state = "paused";
      } else if (action === "play" && p.state === "paused") {
        p.lastResumeAt = now;
        p.state = "playing";
      } else if (action === "stop") {
        p.state = "stopped";
      }
      // 真实 SAPI 暂停/恢复需调用 $s.Pause()/$s.Resume()，本任务范围框架实现
    },

    getStatus(playbackId: string): TtsAdapterStatus {
      const p = playbacks.get(playbackId);
      if (!p) {
        throw badRequest("未找到朗读会话");
      }
      const duration = mockDuration(p.text);
      let position = p.elapsedBeforePauseMs;
      if (p.state === "playing") {
        position += Date.now() - p.lastResumeAt;
      }
      if (p.state === "stopped") {
        position = duration;
      }
      return { state: p.state, position: Math.min(position, duration), duration };
    },
  };
}

/**
 * Real edge-tts Adapter：spawn edge-tts CLI 子进程。
 *
 * 本任务范围（08-Test §5.4 不连真实 edge-tts）：
 *   - 路径校验（edgeTtsCliPath 非空）→ INTERNAL_ERROR + 固定文案
 *   - 真实 spawn 调用：实现框架，但集成测试不触发此路径
 *
 * 真实 edge-tts 集成留待 E2E 受控夹具（08-Test §3.5 注释），不在本任务范围。
 */
export function createRealEdgeTtsAdapter(opts: { edgeTtsCliPath: string }): TtsAdapter {
  const { edgeTtsCliPath } = opts;
  const playbacks = new Map<string, MockPlayback>();

  return {
    async speak(text: string, spOpts?: { engine?: "sapi" | "edge-tts"; rate?: number }): Promise<TtsSpeakResult> {
      // 路径配置校验（03-Arch §3.3：CLI 路径只来自配置，不猜路径）
      if (!edgeTtsCliPath || edgeTtsCliPath.trim() === "") {
        throw internalError(MSG_EDGE_TTS_NOT_CONFIGURED);
      }

      const playbackId = `edge_${randomUUID()}`;
      const now = Date.now();
      playbacks.set(playbackId, {
        playbackId,
        state: "playing",
        startedAt: now,
        elapsedBeforePauseMs: 0,
        lastResumeAt: now,
        text,
        rate: spOpts?.rate ?? 1.0,
      });

      // 真实 spawn edge-tts CLI（本任务范围不连真实子进程，框架实现）
      return new Promise<TtsSpeakResult>((resolve, reject) => {
        const child = spawn(edgeTtsCliPath, ["--text", text, "--write-media", "/dev/null"], {
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stderr = "";
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });

        child.on("error", () => {
          // 错误消息固定文案，不泄漏路径/stdout/stderr（07-WF §4.3）
          playbacks.delete(playbackId);
          reject(internalError(MSG_TTS_FAILED));
        });

        child.on("close", (code: number | null) => {
          if (code !== 0) {
            // 错误消息固定文案，不泄漏 stderr（07-WF §4.3）
            playbacks.delete(playbackId);
            reject(internalError(MSG_TTS_FAILED));
            return;
          }
          resolve({ playbackId, engine: "edge-tts" });
        });
      });
    },

    async control(playbackId: string, action: TtsControlAction, _rate?: number): Promise<void> {
      const p = playbacks.get(playbackId);
      if (!p) {
        throw badRequest("未找到朗读会话");
      }
      const now = Date.now();
      if (action === "pause" && p.state === "playing") {
        p.elapsedBeforePauseMs += now - p.lastResumeAt;
        p.state = "paused";
      } else if (action === "play" && p.state === "paused") {
        p.lastResumeAt = now;
        p.state = "playing";
      } else if (action === "stop") {
        p.state = "stopped";
      }
      // 真实 edge-tts 不支持暂停/恢复（流式合成），stop 需 kill 子进程，本任务范围框架实现
    },

    getStatus(playbackId: string): TtsAdapterStatus {
      const p = playbacks.get(playbackId);
      if (!p) {
        throw badRequest("未找到朗读会话");
      }
      const duration = mockDuration(p.text);
      let position = p.elapsedBeforePauseMs;
      if (p.state === "playing") {
        position += Date.now() - p.lastResumeAt;
      }
      if (p.state === "stopped") {
        position = duration;
      }
      return { state: p.state, position: Math.min(position, duration), duration };
    },
  };
}
