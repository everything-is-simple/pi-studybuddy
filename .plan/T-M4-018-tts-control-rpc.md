# 任务计划：T-M4-018 TTS 控制条 RPC 接线

**任务 ID**：T-M4-018
**标题**：TTS 控制条 RPC 接线（speak + control + switchEngine + getStatus）
**日期**：2026-08-11
**状态**：✅ 已批准并实施完成（本地实施、定向验收、真实 Electron E2E、完整质量门通过；Git 收口待用户单独授权）
**关联文档**：09-UI §5.1-§5.5 + 06-API §3.10/§4 + 07-WF §4 + 08-Test §3.5/§5/§6.3/§6.5 + 03-Arch §6.7
**里程碑**：M4 业务接线 + 打包部署
**优先级**：P3
**治理阶段**：阶段 4（系统组装）
**用户授权**：用户明确选择并批准开工 T-M4-018（2026-08-11"/plan" 选定 T-M4-018 行）；待用户批准本计划与四项设计决策后实施
**集成基线**：master=origin/master=87afbe0（T-M4-017 Git 收口事实核验，04-Todo v0.1.131）
**实施分支**：agent/T-M4-018-tts-control-rpc（待计划批准后建立）
**集成分支**：master
**测试运行根**：H:\pi-studybuddy-tmp\runs\T-M4-018\

---

## 1. 任务目标

### 做什么
把 T-M2-008 交付的静态 TTS 全局控制条（`TtsControlBar`）与既有内嵌朗读按钮接线到既有 RPC：`tts.speak` / `tts.control` / `tts.switchEngine` / `tts.getStatus` + `Streams["tts.state"]` 订阅，使播放、暂停、停止、进度、语速、引擎切换与降级提示真实可用。

### 为什么
M4 里程碑要求"TTS 控制条 + 备份恢复面板 RPC 接通"（04-Todo §6.6 退出门槛）。当前 `TtsControlBar` 的播放/暂停/停止/引擎/语速/标记已复习按钮全部无 `onClick`，`rpc` prop 未消费；NotesTab/MistakesTab 的"朗读"按钮亦为静态壳——生产链路完全未打通。这是 T-M4-017（S7 采集）收官后剩余两项 P3 业务接线之一（T-M4-018/019）。

### 依据
- 09-UI §5.1-§5.5（全局朗读控制条 + 内嵌朗读按钮 + 状态反馈 + 标记已复习 + 引擎降级）
- 06-API §3.10（tts.speak/control/switchEngine/getStatus 契约）+ §4（Streams["tts.state"] 推送主题）
- 07-WF §4.1-§4.3（随时可击发流程 + 标记已复习 + 错误处理）
- 08-Test §3.5（TTS 断言）+ §5（安全不变量）+ §6.3/§6.5（E2E-07/E2E-12 既有 TTS 覆盖）
- AGENTS.md §4.4/§5/§7/§8/§9（任务门禁/TDD/受控收尾/Git/安全）

## 2. 范围与非目标

### 范围
1. **TtsControlBar 接线**（`src/renderer/components/TtsControlBar.tsx` 重写内部实现 + 状态持有）：
   - **播放**：`tts.speak({ text, engine })` → 保存 `playbackId` + `engine` + `fallbackUsed`；in-flight 防重复；多入口复用同一控制条不产生重复播放（09-UI §5.1）
   - **暂停/停止**：`tts.control({ playbackId, action: "pause" | "stop" })`
   - **语速**：`tts.control({ playbackId, action: "play", rate })`（播放中实时调节，空闲时存本地供下次 speak）
   - **引擎切换**：`tts.switchEngine({ engine })` → 控制条当前引擎展示 + 后续 speak 携带该引擎
   - **状态订阅**：`subscribe("tts.state", …)` 更新 state/position/duration（进度显示 + 播放中高亮）
   - **降级提示**：`fallbackUsed=true` → "已降级到 SAPI"（§5.5）；错误固定文案不展示路径/stdout/密钥
   - **状态持有位置**：AppShell 局部持有 TTS 播放态（playbackId/state/engine/rate/fallback），经 props 注入 TtsControlBar（不新增跨 Tab 学习上下文状态）
   - 隐私：playbackId 完整 UUID 一律经 ShortId/摘要展示（AGENTS.md §9.3 + 09-UI §11.1）
2. **既有内嵌朗读按钮接线**（仅既有 2 处，09-UI §5.2）：
   - NotesTab（`src/renderer/components/tabs/NotesTab.tsx`：282 行笔记预览"朗读"）→ `tts.speak({ text: noteMarkdown })`
   - MistakesTab（`src/renderer/components/tabs/MistakesTab.tsx`：260 行错题详情"朗读"）→ `tts.speak({ text: 错题解析/复盘文本 })`
   - 触发后统一走 AppShell 持有关联的 TTS 状态，控制条即时反映
3. **测试**：
   - 更新 `tests/unit/renderer-tts-control-bar.test.ts`（保留静态渲染断言，适配受控状态 props）
   - 新增 `tests/integration/t-m4-018-tts-rpc.test.ts`（RED→GREEN，C-RED-01~XX）
   - 新增 `tests/e2e/t-m4-018-tts-renderer.test.ts`（真实 Electron + 127.0.0.1 TCP，mock TtsAdapter）
   - 既有 `e2e-07-tts.test.ts` / `e2e-12-attach-tts.test.ts` 不回归
4. **治理同步**：`.plan/00-当前任务.md`、`docs/04-Todo`（in_progress 登记 + v0.1.132）、`docs/00-索引`（v0.1.136）、收尾时 `.record/T-M4-018-实施记录.md`

### 非目标（不做什么）
- **不新增/不改 RPC API、handler、adapter、状态机、stream 契约**（contract 保持 127/127；`tts.*` 已装配于 `src/agent-host/handlers/tts/`，仅复用）
- 不把所有 S1-S7 文本入口一并重构（09-UI §5.2 列 9 处朗读入口，本轮仅接线既有 NotesTab/MistakesTab 2 处；其余 7 处留后续/按需裁决）
- 不接真实 SAPI / edge-tts（08-Test §5.4 全 mock；生产默认 mock adapter，真实引擎属设置页能力）
- 不将朗读本身持久化为学习事实/StudyEvent（仅学生主动"标记已复习"经 events.markReviewed 写 StudyEvent，07-WF §4.3）
- 不新增 AppShell 全局学习状态（TTS 播放态为 AppShell 局部 UI 状态，不属于 academicContext）
- 不写 `%LOCALAPPDATA%\PiStudyBuddy`；不连接真实外部服务

## 3. 文件清单

### 将创建的文件
| 文件路径 | 用途 |
|---|---|
| `tests/integration/t-m4-018-tts-rpc.test.ts` | C-RED-01~XX 集成测试（mock rpc + mock tts.state 发射） |
| `tests/e2e/t-m4-018-tts-renderer.test.ts` | 真实 Electron renderer E2E（隔离 fixture + mock TtsAdapter） |
| `.record/T-M4-018-实施记录.md` | 收尾时创建（8 章节） |

### 将修改的文件
| 文件路径 | 修改内容 |
|---|---|
| `src/renderer/components/TtsControlBar.tsx` | 静态壳 → 受控 + RPC 接线（播放/暂停/停止/语速/引擎/进度/降级/标记已复习回调） |
| `src/renderer/components/AppShell.tsx` | 持有 TTS 播放态 + `subscribe("tts.state")` + 传 props 给 TtsControlBar；提供 `onSpeak(text, ref?)` 回调给内嵌朗读入口 |
| `src/renderer/components/tabs/NotesTab.tsx` | 笔记预览"朗读"按钮 onClick → onSpeak(noteMarkdown) |
| `src/renderer/components/tabs/MistakesTab.tsx` | 错题详情"朗读"按钮 onClick → onSpeak(解析文本) |
| `tests/unit/renderer-tts-control-bar.test.ts` | 适配受控状态 props，保留静态渲染与隐私断言 |
| `.plan/00-当前任务.md` | 指向本计划 |
| `docs/04-任务清单-Todo-List.md` | T-M4-018 pending→in_progress + 版本历史 v0.1.132 + §9 统计 |
| `docs/00-文档索引-Index.md` | 版本历史 v0.1.136 + 任务状态行同步 |

> preload/contract/rpc-client 无需修改（`TypedRpcClient.call/subscribe` 已具备类型化 TTS 调用与订阅）。

## 4. 接口设计

### RPC 方法（复用既有，不新增；06-API §3.10）
```typescript
// contract/api.ts（既有，contract 保持 127/127）
interface Api {
  "tts.speak": {
    params: { text: string; engine?: "sapi" | "edge-tts" };
    result: { playbackId: string; engine: "sapi" | "edge-tts"; fallbackUsed?: boolean };
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
  "events.markReviewed": { params: { refType: string; refId: string }; result: StudyEvent }; // §5.4，待裁决 4
}
```
host 侧已具备（T-M2-004，仅核验不改）：
- `tts.speak`：SAPI 默认离线（mock adapter）；edge-tts 失败自动降级 SAPI 且 `fallbackUsed=true`；返回 playbackId（脱敏展示）
- `tts.control` / `tts.switchEngine` / `tts.getStatus`：状态机 idle→playing→paused→stopped；错误固定文案（"系统 TTS 不可用…" / "edge-tts 连接失败，已自动切换到 SAPI"），不泄漏路径/stdout/密钥

### Streams 订阅（既有；06-API §4）
```typescript
// contract/streams.ts（既有）
"tts.state": { playbackId: string; state: "playing" | "paused" | "stopped"; position: number; duration: number };
```
renderer 经 `rpc.subscribe("tts.state", undefined, onTtsState)` 更新控制条进度/状态；按 playbackId 归属过滤（旧播放不覆盖新播放）。

### 状态提升（AppShell 局部）
```typescript
// AppShell 内部持有（不进入 academicContext / 学习上下文）
interface TtsUiState {
  playbackId?: string;
  status: TtsStatus;                 // { state, position, duration }
  engine: "sapi" | "edge-tts";
  rate: number;
  fallbackUsed: boolean;
  title?: string;                    // 最近朗读内容短标题（待裁决 2）
}
```

### 数据表（不涉及）
无新增/修改表；朗读不持久化；"标记已复习"复用 study_events（host 已实现，05-ERD §3.1.5）。

## 5. 测试策略

### 单件测试（阶段 2）
- [ ] 更新 `tests/unit/renderer-tts-control-bar.test.ts`：保留引擎切换/语速/播放控制/状态显示/降级/标记已复习静态断言；适配受控 props（onSpeak/onControl/onSwitchEngine/onMarkReviewed/rate/status/engine/fallbackUsed/title）
- [ ] 断言控制条 DOM 无完整 playbackId UUID（隐私边界，09-UI §11.1）

### 集成测试（阶段 3，`tests/integration/t-m4-018-tts-rpc.test.ts`）
| ID | 设计条款 | 断言 |
|---|---|---|
| C-RED-01 | speak（06-API §3.10） | 点播放只调一次 `tts.speak({text, engine})`；in-flight 防重复；成功保存 playbackId/engine/fallbackUsed |
| C-RED-02 | control（06-API §3.10） | 暂停/停止按当前 playbackId 调 `tts.control`；无 playbackId 时禁用/忽略 |
| C-RED-03 | 语速（06-API §3.10） | 播放中调 `tts.control({playbackId, action:"play", rate})` 实时生效；空闲仅存本地供下次 speak |
| C-RED-04 | switchEngine（06-API §3.10） | 切换后控制条展示新引擎；后续 speak 携带该引擎 |
| C-RED-05 | tts.state 订阅（06-API §4） | subscribe 收到 playing/paused/stopped → 状态显示与进度更新；旧 playbackId 事件不覆盖新播放 |
| C-RED-06 | 多入口复用（09-UI §5.1/§5.2 + 07-WF §4.1） | NotesTab/MistakesTab 内嵌朗读触发 onSpeak → 控制条状态更新；重复触发不产生并行重复播放（停止旧播放或拒绝） |
| C-RED-07 | 降级提示（09-UI §5.5） | speak 返回 fallbackUsed=true → 显示"已降级到 SAPI" |
| C-RED-08 | 标记已复习（09-UI §5.4，待裁决 4） | 朗读完成（stopped）显示按钮 → `events.markReviewed` 只调一次；朗读本身不写 StudyEvent |
| C-RED-09 | 竞态/卸载（08-Test §5） | 播放中切换 Tab/卸载 → setState 不执行；超时/失败不泄漏内部状态 |
| C-RED-10 | 错误净化（AGENTS.md §9.3 + 07-WF §4） | INTERNAL_ERROR 只显示固定文案；DOM 无完整 playbackId/路径/错误栈/密钥 |

### E2E（阶段 5b，`tests/e2e/t-m4-018-tts-renderer.test.ts`）
- [ ] 主流程：真实 Electron 启动（127.0.0.1 TCP）→ 预置学期/课程/笔记 fixture → 进入笔记 Tab 点"朗读" → 控制条播放中状态与进度 → 暂停/停止 → 引擎切换
- [ ] 内嵌入口：错题 Tab 朗读入口触发 → 控制条统一反映，无重复播放
- [ ] 归档/课程边界与隐私断言：DOM 无完整 UUID / 路径 / file URI / 错误栈 / 密钥
- [ ] 标记已复习（如裁决 4 接入）：study_events 新增 practice_reviewed

### 安全不变量（如涉及）
- [ ] 朗读错误固定文案；无路径/stdout/密钥泄漏；UUID 泄漏检测 `check-uuid-leak` 不影响 7/7 基线

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | 不涉及（无新组件下载） |
| 2. 单件测试 | 更新既有 renderer-tts-control-bar 静态测试 |
| 3. 集成测试 | ✅ 核心：C-RED-01~10（mock rpc + mock tts.state 发射） |
| 4. 系统组装 | ✅ 核心：TtsControlBar 接线 + AppShell 状态持有 + 内嵌朗读按钮接线 |
| 5. 冒烟 + E2E | 真实 Electron renderer E2E + 完整质量门 |

## 7. 依赖关系

### 前置任务
- [x] T-M4-017：S7 采集 Tab RPC 接线（done；执行序 37 的前置，master=origin/master=87afbe0）
- [x] T-M2-004：TTS handler（done；tts.speak/control/switchEngine/getStatus + tts.state 已可用）
- [x] T-M2-008：09-UI S5-S7+TTS+备份恢复 UI（done；TtsControlBar 静态壳 + 内嵌朗读按钮已存在）
- [x] T-M4-008：AppShell 数据流重构（done；AppShell 已统一持有 rpc 与 academicContext）

### 组件依赖
- [x] TtsAdapter（mock 注入，08-Test §5.4 不连真实 SAPI/edge-tts）
- [x] TypedRpcClient.subscribe（既有，03-Arch §6.3 RPC 层）

## 8. 预期产物

### 代码
- `src/renderer/components/TtsControlBar.tsx`（接线）
- `src/renderer/components/AppShell.tsx`（TTS 状态持有 + onSpeak 回调）
- `src/renderer/components/tabs/NotesTab.tsx` / `MistakesTab.tsx`（内嵌朗读按钮接线）
- `tests/integration/t-m4-018-tts-rpc.test.ts`
- `tests/e2e/t-m4-018-tts-renderer.test.ts`
- `tests/unit/renderer-tts-control-bar.test.ts`（更新）

### 文档更新
- `docs/04-Todo`（v0.1.132：T-M4-018 in_progress + §9 统计 + 版本历史）
- `docs/00-索引`（v0.1.136：版本历史 + 任务行同步）
- 06-API §3.10/§4 说明性增补（renderer 接线落地注解，如涉及）

### 实施记录
- `.record/T-M4-018-实施记录.md`（受控收尾时创建）

## 9. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（09-UI §5 + 06-API §3.10/§4 + 07-WF §4 + 08-Test）
- [x] 步骤 2：检查文档门禁（04-Todo v0.1.131 done、单一任务门禁满足）
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [x] 步骤 4：独立审查计划（实施者审阅后提交用户批准）。
- [x] 步骤 5：用户批准计划（2026-08-11“批准”；裁决 1A/2A/3A/4A）。
- [x] 步骤 6：拆分任务、逐项实现（隔离分支 agent/T-M4-018-tts-control-rpc）。
- [x] 步骤 7：编写或更新测试（TDD：RED 初次失败 → GREEN 27/27）
- [x] 步骤 8：type-check
- [x] 步骤 9：build
- [x] 步骤 10：test（定向 27 + 全量 117 files/1119 tests）
- [x] 步骤 11：smoke / E2E（smoke 6/6；真实 Electron renderer t-m4-018-tts-renderer 1 test；全量 23 files/129 tests）
- [x] 步骤 12：独立审查并修复（双维度；修复 busyRef 同步防重复缺陷）
- [x] 步骤 13：更新 04-Todo（v0.1.133）+ 文档（00-索引 v0.1.137）
- [x] 步骤 14：文档治理检查（OK）
- [x] 步骤 15：diff 检查（git diff --check 通过）
- [x] 步骤 16：提交交付（★ 用户 Git 收口授权 2026-08-11；网络恢复后推送完成）

## 10. 质量门与数据隔离

- Node 基线：`C:\node-v24.14.0-win-x64\node.exe --version` → v24.14.0；`pnpm --version` → 11.20.0（AGENTS.md §10，执行前 `$env:Path` 前置）
- 定向 unit/integration/E2E → `pnpm type-check` → `pnpm build` → `pnpm test` → `pnpm smoke` → `pnpm verify -- --stage=full`
- 不回归基线：master 基线 116 files/1105 tests（unit/integration）+ 22 files/128 tests（真实 Electron E2E）+ contract 127/127 + 安全 6/6 + smoke 6/6 + UUID 7/7 + docs 治理 + `git diff --check`
- 所有运行数据/Electron user-data/SQLite/日志写入 `H:\pi-studybuddy-tmp\runs\T-M4-018\`；禁止写 `%LOCALAPPDATA%\PiStudyBuddy`；不连真实 SAPI/edge-tts/AI/SMTP/飞书/WPS/whisper.cpp

## 11. 需用户裁决的设计决策

| # | 决策 | 方案 A（推荐） | 方案 B |
|---|---|---|---|
| 1 | TTS 状态来源 | **tts.state stream 订阅**（subscribe 即时推送，对齐 06-API §4 与 09-UI §5.3 进度反馈；getStatus 仅在初始化/恢复时兜底） | getStatus 轮询（实现简单但延迟高、浪费 IPC） |
| 2 | 控制条"当前朗读内容"标题 | **renderer 记录最近朗读短标题/文本摘要**（对齐 09-UI §5.1"当前朗读内容标题 + 进度"；内嵌入口传入内容标题） | 仅状态+进度，无标题（改动最小但不符合 §5.1 展示） |
| 3 | 内嵌朗读按钮接线范围 | **仅既有 NotesTab/MistakesTab 2 处**（对齐任务提示词"既有内嵌朗读入口"+"不把所有 S1-S7 文本入口一并重构"） | 全部 9 处（超出本轮，需重构多个 Tab，范围蔓延） |
| 4 | 标记已复习（09-UI §5.4） | **接入 events.markReviewed**（朗读完成显示按钮，内嵌入口提供 refType/refId；对齐 07-WF §4.3 与既有 E2E-07/E2E-12 语义） | 本轮不接入，按钮保留静态（严格对齐任务提示词允许接线范围，留后续） |

## 12. 明确停止条件

- 需要新增/修改 RPC API、handler、adapter、状态机、stream 契约或 AppShell 学习上下文状态
- 发现 host 侧 TTS 防线缺失（须先 RED 登记偏差并经用户裁决后修复）
- 真实 Electron 无法启动、Node 非 v24.14.0、工作区归属无法区分（不得混入 pi-session html 等用户 dirty 文件）
- 用户未批准本计划或未授权实施

本计划只允许本地实施与治理证据同步；未经用户另行明确授权不得 `git add`、`git commit`、`git merge`、`git push`。

---

## 审查记录

（步骤 4 独立审查）计划由实施者审阅后提交用户批准：范围仅既有 TTS RPC 接线 + tts.state 订阅 + 既有内嵌朗读按钮（NotesTab/MistakesTab），contract 127/127 不变；四项设计决策已明确（stream 订阅 / 标题展示 / 按钮范围 / 标记已复习）。用户 2026-08-11 回复“批准”，计划按推荐方案 A 生效（裁决 1A/2A/3A/4A）。

## 完成记录

（步骤 5 收尾时填写）
- 完成日期：2026-08-11（Git 收口完成：功能 `dd4b909` + 治理 `e92c567` + 中间事实 `3dfef67` 已推送 origin/master 并核验 `master=origin/master=3dfef67`）
- 实施记录：.record/T-M4-018-实施记录.md
- 状态：✅ 已完成（docs/04 v0.1.136 登记 done；master=origin/master=3dfef67 核验通过）
- 验收证据：RED 初次失败（4 项）→ GREEN；定向 integration 10 tests + unit 17 tests；真实 Electron E2E t-m4-018-tts-renderer 1 test；全量 unit/integration 117 files/1119 tests；真实 Electron E2E 23 files/129 tests；`verify --stage=full` 通过（contract 127/127 + 8 PiBridge + 35 tools、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）
