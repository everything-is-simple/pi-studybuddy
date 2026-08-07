# 任务计划：T-M2-004 TTS skill

**任务 ID**：T-M2-004
**日期**：2026-08-07
**状态**：📝 待审查
**关联文档**：07-WF §4 + 06-API §3.10 + 03-Arch §3.1/§3.3 + 08-Test §3.5/§5.4 + 02-PRD §3.9 + 09-UI §5
**里程碑**：M2 完整闭环（第 4 任务）

---

## 1. 任务目标

### 做什么

实现 TTS 跨子系统朗读能力：4 RPC handler + 3 studybuddy_* 工具 + TtsAdapter 可注入接口（SAPI 默认 + edge-tts 降级）+ 朗读状态机 + Streams["tts.state"] 推送。

### 为什么

- 02-PRD §3.9 将 TTS 列为跨子系统随时可击发核心特性（听觉复习通道：S2 笔记/S4 错题复盘/S5 冲刺要点/任意 Markdown 均可朗读）
- 是 09-UI S5-S7+TTS UI 任务的前置依赖
- 是 M2 退出门槛"TTS 跨子系统朗读冒烟通过"的必要组件

### 依据

- [07-WF §4](../docs/07-工作流-Workflow.md)：TTS 朗读路径（4 步流程 + 场景化朗读 + 标记已复习 + 关键约束 + 错误处理）
- [06-API §3.10](../docs/06-API契约-API-Contracts.md)：4 RPC 方法
- [03-Arch §3.1](../docs/03-架构设计-Architecture-Design.md)：3 工具 + 无独立 TTS 表
- [03-Arch §3.3](../docs/03-架构设计-Architecture-Design.md)：外部桥 Adapter 契约（参照 whisper.cpp Adapter 范式）
- [08-Test §3.5](../docs/08-测试验收-Test-Plan.md)：TTS skill 单测 3 断言 + §5.4 不连真实外部服务全 mock
- [02-PRD §3.9](../docs/02-PRD-产品需求-Product-Requirements.md)：TTS 跨子系统核心特性
- [09-UI §5](../docs/09-使用者介面-UI-Design.md)：TTS 朗读 UI（本任务只做 RPC+工具，UI 留待后续）

## 2. 范围与非目标

### 范围

- 4 RPC handler：tts.speak / tts.control / tts.switchEngine / tts.getStatus
- 3 studybuddy_* 工具注册：studybuddy_tts_speak / studybuddy_tts_control / studybuddy_tts_switch_engine
- TtsAdapter 可注入接口 + 3 实现（mock/failing/real），参照 WhisperCppAdapter 范式
- SAPI COM 桥 real adapter（powershell 子进程调用 System.Speech.Synthesis）
- edge-tts 桥 real adapter（子进程调用 edge-tts CLI，降级方案）
- 朗读状态机（idle → playing → paused → stopped）+ playbackId 生成 + 位置/时长追踪
- edge-tts 失败自动降级 SAPI（fallbackUsed=true）
- Streams["tts.state"] 推送朗读状态变更（streams.ts 已就绪）
- 契约微调：api.ts tts.speak result 扩展 + types.ts 补 TtsSpeakResult（对齐 08-Test §3.5 断言）
- studybuddy-extension.ts 接入 TtsContext + createTtsTools（工具数 26 → 29）
- 扩展装配测试同步更新（断言 3 个 TTS 工具被注册）

### 非目标（不做什么）

- **不做 TTS UI**（全局控制条/内嵌朗读按钮/状态反馈/标记已复习按钮）——留待 09-UI S5-S7+TTS+备份恢复 UI 任务
- **不做"标记已复习"handler**——走 S1 events.markReviewed（study_events event_type=practice_reviewed），不在 TTS 范围
- **不持久化朗读内容**——无独立 TTS 表（朗读是即时行为，07-WF §4.3 + 03-Arch §3.1）
- **不连真实 SAPI/edge-tts**——测试全 mock（08-Test §5.4）
- **不做 E2E-07 TTS**——留待 E2E-04~09 任务
- **不做 TTS skill 封装（progressive disclosure）**——03-Arch §3.1 提到"封装为 skill"，但本任务先做 registerTool 工具，skill 封装留待 M3 对话打磨阶段（工具调用视图成熟后再封装）

## 3. 文件清单

### 将创建的文件

| 文件路径 | 用途 |
|---|---|
| `src/agent-host/handlers/tts/tts-adapter.ts` | TtsAdapter 接口 + createMockTtsAdapter / createFailingTtsAdapter / createRealSapiAdapter / createRealEdgeTtsAdapter（参照 whisper-adapter.ts） |
| `src/agent-host/handlers/tts/playback.ts` | 朗读状态机（PlaybackManager：playbackId 生成 + 状态追踪 + 位置/时长 + Streams 推送） |
| `src/agent-host/handlers/tts/context.ts` | TtsContext（参照 S7Context：注入 TtsAdapter + 当前引擎 + Streams 推送回调） |
| `src/agent-host/handlers/tts/tts.ts` | 4 handler 实现（handleSpeak / handleControl / handleSwitchEngine / handleGetStatus） |
| `src/agent-host/handlers/tts/index.ts` | createTtsHandlers(ctx) 装配出口（参照 s7/index.ts） |
| `src/agent/tools/tts/tools.ts` | createTtsTools(ctx) 注册 3 工具（参照 s7/tools.ts） |
| `tests/unit/tts-adapter.test.ts` | Adapter 单件测试（mock 确定性 + failing 抛错 + real 路径校验，参照 s7-whisper-adapter.test.ts） |
| `tests/unit/tts-playback.test.ts` | 状态机单件测试（idle→playing→paused→stopped + playbackId 唯一 + 位置追踪） |
| `tests/unit/tts-handlers.test.ts` | 4 handler 单件测试（speak 返回 playbackId + control 状态机 + switchEngine + getStatus） |
| `tests/unit/tts-tools.test.ts` | 3 工具注册测试（参照 s7-tools.test.ts） |
| `tests/integration/tts-handlers.test.ts` | 集成测试（TtsContext + 4 handler + Streams 推送，参照 s7-handlers.test.ts） |

### 将修改的文件

| 文件路径 | 修改内容 |
|---|---|
| `src/contract/api.ts` | tts.speak result 扩展为 `{ playbackId, engine, fallbackUsed? }`（对齐 08-Test §3.5 断言 r.fallbackUsed/r.engine） |
| `src/contract/types.ts` | 补 TtsSpeakResult 接口（{ playbackId, engine, fallbackUsed? }） |
| `src/agent/studybuddy-extension.ts` | 接入 TtsContext + createTtsTools（工具数 26 → 29） |
| `tests/integration/studybuddy-extension.test.ts` | 扩展装配测试同步更新（断言 3 个 TTS 工具被注册，工具数 26 → 29） |
| `docs/04-任务清单-Todo-List.md` | §7.3.1 新增 T-M2-004 行 + §9 统计 M2 4 done（收尾时） |

## 4. 接口设计

### RPC 方法（06-API §3.10，api.ts 已就绪 + 微调）

```typescript
// contract/api.ts（现状 L304-316，tts.speak result 需扩展）
"tts.speak": {
  params: { text: string; engine?: "sapi" | "edge-tts" };
  result: { playbackId: string; engine: "sapi" | "edge-tts"; fallbackUsed?: boolean };
  //                                    ↑ 新增 engine      ↑ 新增 fallbackUsed（对齐 08-Test §3.5）
};
"tts.control": {
  params: { playbackId: string; action: "play" | "pause" | "stop"; rate?: number };
  result: void;
};
"tts.switchEngine": { params: { engine: "sapi" | "edge-tts" }; result: void };
"tts.getStatus": {
  params: { playbackId: string };
  result: { state: "playing" | "paused" | "stopped"; position: number; duration: number };
};
```

**契约微调依据**：08-Test §3.5 断言 `r.fallbackUsed` 和 `r.engine`，但 api.ts 现状 tts.speak result 只有 `{ playbackId }`。按权威链 08-Test（优先级4）> api.ts 现状（优先级7），扩展 result。types.ts 补 TtsSpeakResult 接口。

### registerTool 工具（03-Arch §3.1，3 个）

```typescript
// src/agent/tools/tts/tools.ts
pi.registerTool({
  name: "studybuddy_tts_speak",       // 触发朗读
  name: "studybuddy_tts_control",     // 播放/暂停/停止/语速
  name: "studybuddy_tts_switch_engine", // 切换 SAPI/edge-tts
});
// 注意：tts.getStatus 是 RPC 不是工具（03-Arch §3.1 工具表只列 3 个）
```

### TtsAdapter 接口（参照 WhisperCppAdapter 范式）

```typescript
// src/agent-host/handlers/tts/tts-adapter.ts
export interface TtsSpeakResult {
  playbackId: string;
  engine: "sapi" | "edge-tts";
  fallbackUsed?: boolean;
}

export interface TtsAdapter {
  /** 合成并播放文本，返回 playbackId + 引擎 + 是否降级 */
  speak(text: string, opts?: { engine?: "sapi" | "edge-tts"; rate?: number }): Promise<TtsSpeakResult>;
  /** 控制播放（play/pause/stop） */
  control(playbackId: string, action: "play" | "pause" | "stop", rate?: number): Promise<void>;
  /** 查询状态 */
  getStatus(playbackId: string): { state: "playing" | "paused" | "stopped"; position: number; duration: number };
}
```

### 朗读状态机（playback.ts）

```
idle ──speak──→ playing ──pause──→ paused ──play──→ playing
                    │                  │
                    └──stop──→ stopped ←┘
                    
switchEngine: 切换当前引擎，不影响进行中的播放（下次 speak 生效）
```

- playbackId：`tts_<timestamp>_<random>` 生成
- mock adapter：speak 后状态 playing，control(stop) 后 stopped，position/duration 确定性模拟
- real adapter：spawn 子进程，状态由子进程生命周期 + 定时器模拟位置推进

### 数据表

**无**（03-Arch §3.1 + 07-WF §4.3：无独立 TTS 表，朗读是即时行为不持久化；已复习标记走 S1 StudyEvent practice_reviewed）

## 5. 测试策略

### 单件测试（阶段 2）

**tts-adapter.test.ts**（参照 s7-whisper-adapter.test.ts）：
- [ ] createMockTtsAdapter：speak 返回 playbackId + engine=sapi + fallbackUsed=undefined
- [ ] createMockTtsAdapter：control(stop) 后 getStatus.state=stopped
- [ ] createMockTtsAdapter：getStatus 返回确定性 position/duration
- [ ] createFailingTtsAdapter：speak 抛 INTERNAL_ERROR + 固定文案"系统 TTS 不可用..."（不泄漏路径/stdout/stderr）
- [ ] createRealSapiAdapter：sapiCliPath 为空 → INTERNAL_ERROR + "系统 TTS 不可用，请安装 edge-tts 或检查系统设置"
- [ ] createRealEdgeTtsAdapter：edgeTtsCliPath 为空 → INTERNAL_ERROR + "edge-tts 未配置"（不连真实子进程）
- [ ] 错误消息固定文案，不含路径/stdout/stderr/密钥（08-Test §5.4）

**tts-playback.test.ts**：
- [ ] speak 生成唯一 playbackId（两次 speak 不重复）
- [ ] 状态机：idle → playing（speak）→ paused（control pause）→ playing（control play）→ stopped（control stop）
- [ ] position/duration 确定性（mock 下可预测）
- [ ] control 未知 playbackId → BAD_REQUEST

**tts-handlers.test.ts**（4 handler）：
- [ ] handleSpeak：返回 { playbackId, engine, fallbackUsed? }（08-Test §3.5 断言 1：SAPI 默认返回 playbackId）
- [ ] handleSpeak：engine=edge-tts + adapter 失败 → fallbackUsed=true + engine=sapi（08-Test §3.5 断言 2：edge-tts 失败降级 SAPI）
- [ ] handleSpeak：朗读不写 study_events（08-Test §3.5 断言 3：朗读本身不写 StudyEvent）
- [ ] handleControl：play/pause/stop 状态机
- [ ] handleSwitchEngine：切换引擎 + 下次 speak 生效
- [ ] handleGetStatus：返回 { state, position, duration }

**tts-tools.test.ts**（参照 s7-tools.test.ts）：
- [ ] createTtsTools 返回 3 个工具，name 匹配 ^studybuddy_tts_(speak|control|switch_engine)$
- [ ] 每个工具有 name/label/description/parameters/execute
- [ ] execute 薄封装调 handler

### 集成测试（阶段 3）

**tts-handlers.test.ts**（参照 s7-handlers.test.ts）：
- [ ] TtsContext + createTtsHandlers 装配，4 方法可调用
- [ ] speak → Streams["tts.state"] 推送 { playbackId, state: "playing", ... }
- [ ] control(stop) → Streams["tts.state"] 推送 state: "stopped"
- [ ] edge-tts 失败降级 SAPI：fallbackUsed=true + Streams 推送 engine=sapi

**studybuddy-extension.test.ts**（扩展装配同步更新）：
- [ ] createStudyBuddyExtension() 注册 29 个工具（26 + 3 TTS）
- [ ] 工具名包含 studybuddy_tts_speak / studybuddy_tts_control / studybuddy_tts_switch_engine（08-Test §4.1 断言）

### 系统冒烟（阶段 5a）

- [ ] smoke.mjs 无需改动（TTS 不在 M0 冒烟六项，M2 冒烟在 E2E 阶段）

### E2E（阶段 5b）

- [ ] E2E-07 TTS 留待后续 E2E-04~09 任务（本任务不做）

### 安全不变量（08-Test §5.4）

- [ ] 不连真实 SAPI/edge-tts（全 mock）
- [ ] 路径不泄漏（错误消息固定文案，不含 cliPath/modelPath）
- [ ] stdout/stderr 不泄漏（real adapter spawn 失败只返回固定文案）
- [ ] 固定错误码（INTERNAL_ERROR + 固定文案）

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | ⏭️ 跳过（SAPI 是 Windows 系统自带零依赖；edge-tts CLI 路径只来自配置，不预装） |
| 2. 单件测试 | ✅ tts-adapter + tts-playback + tts-handlers + tts-tools |
| 3. 集成测试 | ✅ tts-handlers 集成 + studybuddy-extension 装配 |
| 4. 系统组装 | ✅ 代码进入 src/ + type-check + lint |
| 5. 冒烟 + E2E | ⏭️ 跳过 E2E（留待 E2E-04~09 任务）；smoke 无需改动 |

## 7. 依赖关系

### 前置任务

- [x] T-M2-003 S7 课堂采集（已完成，§8.4 三者齐全）——提供 WhisperCppAdapter 范式参照

### 组件依赖

- [x] contract 层（api.ts/types.ts/streams.ts）——TTS 方法/DTO/Stream 已就绪，仅需微调 tts.speak result
- [x] studybuddy-extension.ts——已接入 S1-S7 26 工具，TTS 在此追加
- [x] S1 StudyEvent——"标记已复习"走 S1 events（不在本任务范围，但 TTS 不持久化的依据）

## 8. 关键决策点（待用户审查）

### 决策 1：SAPI real adapter 实现方式

**选项 A（推荐）**：powershell 子进程调用 `System.Speech.Synthesis.SpeechSynthesizer`
- 符合 03-Arch §3.3 外部桥契约（子进程调用）
- 零 npm 依赖（powershell 是 Windows 自带）
- 缺点：子进程启动开销，但 TTS 本就是异步

**选项 B**：node 直接 COM 调用（需 node-ffi-napi 或 winax npm 包）
- 新增 npm 依赖（违反零新依赖原则）
- 不符合 03-Arch §3.3 子进程契约

**推荐 A**，符合外部桥契约 + 零新依赖。

### 决策 2：edge-tts real adapter 实现方式

**选项 A（推荐）**：子进程调用 `edge-tts` CLI（pip install edge-tts）
- 符合 03-Arch §3.3 子进程契约
- 路径只来自配置（edgeTtsCliPath）
- 缺点：需学生预装 edge-tts（但 edge-tts 是可选降级，SAPI 默认零依赖）

**选项 B**：node 直接 HTTP 调用 edge-tts WebSocket API
- 不符合 03-Arch §3.3 子进程契约
- 需实现 WebSocket 协议

**推荐 A**，符合外部桥契约。

### 决策 3：朗读位置/时长追踪方式

mock adapter 下 position/duration 确定性模拟（如 duration=text.length*50ms，position=elapsed）。
real adapter 下 SAPI/edge-tts 不直接提供位置，用定时器估算（elapsed since speak）。

**推荐**：mock 确定性 + real 定时器估算，position/duration 是近似值（09-UI 控制条进度条容忍近似）。

### 决策 4：契约微调（api.ts tts.speak result 扩展）

08-Test §3.5 断言 `r.fallbackUsed` 和 `r.engine`，但 api.ts 现状只有 `{ playbackId }`。

**推荐**：扩展为 `{ playbackId, engine, fallbackUsed? }`，types.ts 补 TtsSpeakResult。依据权威链 08-Test（优先级4）> api.ts 现状（优先级7）。

## 9. 预期产物

### 代码

- `src/agent-host/handlers/tts/` 6 文件（tts-adapter/playback/context/tts/index + tools）
- `src/agent/tools/tts/tools.ts`
- `tests/unit/tts-*.test.ts` 4 文件
- `tests/integration/tts-handlers.test.ts`

### 文档更新

- `docs/04-Todo-List.md`（§7.3.1 新增 T-M2-004 + §9 统计）
- `docs/00-文档索引-Index.md`（版本同步）
- `AGENTS.md`（§3.1 版本同步，§12 修订记录）

### 实施记录

- `.record/T-M2-004-实施记录.md`（收尾时创建，8 章节）

## 10. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界
- [x] 步骤 2：检查文档门禁
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [ ] 步骤 4：独立审查计划
- [ ] 步骤 5：用户批准计划（★ 用户授权）
- [ ] 步骤 6：拆分任务、逐项实现
- [ ] 步骤 7：编写或更新测试（TDD：RED → GREEN → REFACTOR）
- [ ] 步骤 8：type-check
- [ ] 步骤 9：build
- [ ] 步骤 10：test
- [ ] 步骤 11：smoke（无需改动）
- [ ] 步骤 12：独立审查并修复
- [ ] 步骤 13：更新 04-Todo + 文档
- [ ] 步骤 14：文档治理检查
- [ ] 步骤 15：diff 检查
- [ ] 步骤 16：提交交付（★ 用户授权）

## 11. 证据登记（收尾时填写）

- 测试日志路径：
- 提交哈希：
- 推送状态：
- 实施记录路径：

---

## 审查记录

（步骤 4 独立审查时填写）

## 完成记录

（步骤 5 收尾时填写）
- 完成日期：
- 实施记录：.record/T-M2-004-实施记录.md
- 状态：✅ 已完成
