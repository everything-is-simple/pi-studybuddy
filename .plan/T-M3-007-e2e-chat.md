# T-M3-007 E2E-10~13（对话默认主入口/工具调用/@引用/TTS+L3 检索）

**task-id**：T-M3-007
**里程碑**：M3 对话与打磨（§7.5 全局执行顺序表第 17 行）
**日期**：2026-08-08
**依据**：08-Test §6.5 + 04-Todo §6.5 M3 退出门槛 + 06-API §3.1/§3.1.1/§4 + 07-WF §2.8 + 09-UI §4.2
**状态**：⏳ in_progress（用户批准开工，2026-08-08）

---

## 1. 任务目标

为 M3 对话承载（agent.send / sessions.* / modelsConfig.* singleton + agent.events 流式事件 + 工具跳转 + @引用/TTS + L3 检索）编写端到端测试，验证：

- E2E-10：对话默认主入口（DEFAULT_TAB_ID=chat + agent.send 流式事件序列 message_start→token×N→context_compressed + 会话列表）
- E2E-11：工具调用 + 跳转（触发词 → tool_call/tool_result 事件对 + 工具名断言 + toolJumpTarget 映射断言 + sessionMeta 写回）
- E2E-12：@引用 + TTS（materials.upload 夹具 → allowed-roots 校验 → tts.speak → 标记已复习 study_events）
- E2E-13：L3 检索（多轮 send → turn_end 增量索引 → 二次 launch 重启 → sessions.search 命中）

**核心增量**：test-main.js 当前只装配 S1-S7+TTS+Backup handler，**缺 agent.* / sessions.* / modelsConfig.**——对话承载未入 E2E 子进程，本任务将其装配入子进程并承载 agent.events 事件推送。

**M3 退出门槛覆盖**（04-Todo §6.5）：
- [ ] E2E-10~13 对话 Tab 全通过（本任务）
- [ ] 应用启动默认打开对话 Tab（E2E-10）
- [ ] AI 自主调用工具 + 跳转结构化 Tab（E2E-11）
- [ ] @文件引用 + TTS 朗读 + L3 会话检索（E2E-12 / E2E-13）

## 2. 范围与非目标

### 范围
- test-main.js 扩展装配 agent.send + sessions.* + modelsConfig.get/set handler（复用 dist 编译产物 createAgentHandlers/createSessionHandlers/createModelHandlers）
- agent.events 事件推送承载：agent.send 发射事件序列后，经 IPC `{"type":"event","topic":"agent.events","payload":...}` 推送给 RpcDriver
- RpcDriver 扩展：waitForEvent(topic, predicate, timeout) 订阅辅助 + 二次 launch 复用（E2E-13 重启语义）
- 4 个 E2E 测试文件（e2e-10~13）
- 必要的 helper 扩展（electron-launcher 增加"复用同一 dataRoot 不清理"选项）

### 非目标
- E2E-01~13 全链回归 + 安全不变量最终校验 → T-M3-008（P0，最后门槛）
- 真实 LLM / 外部 AI 服务（08-Test §5.4 全 mock）
- 不修改 pi 底座内核；不引入新运行时依赖
- 真实 Electron UI 自动化（UI 断言由 renderer 静态渲染测试覆盖）
- 新 handler 入 test-main.js 不新增契约方法（复用既有 127 方法）

## 3. 权威条款 / 关键断言映射（08-Test §6.5）

| 断言 | E2E | 依据 |
|---|---|---|
| DEFAULT_TAB_ID = "chat"（对话默认 Tab） | E2E-10 | §6.5 断言 1 |
| agent.send 流式事件序列 message_start→token×N→context_compressed | E2E-10 | §6.5 断言 2 |
| 事件 payload 无完整 UUID（防泄露） | E2E-10~13 | AGENTS.md §9.3 + 08-Test §7.2 |
| L1 画像注入（before_agent_start 钩子） | E2E-10 | §6.5 断言 5 |
| 触发词 → tool_call/tool_result 事件对 + 工具名 | E2E-11 | §6.5 断言 3 |
| toolJumpTarget("studybuddy_generate_questions").tabId = "practice"（映射表） | E2E-11 | 07-WF §2.8 |
| sessionMeta 写回 → sessions.get 可见 subject/goal | E2E-11 | §6.5 断言 6 |
| @引用 allowed-roots 校验通过路径 + 越权拒绝 | E2E-12 | §6.5 断言 4 |
| tts.speak → playbackId + 状态（mock TtsAdapter） | E2E-12 | §6.5 断言 4 |
| 标记已复习 → study_events 多一条 practice_reviewed | E2E-12 | §6.5 断言 4 |
| 多轮 send → turn_end 增量索引 → chunks_fts 有记录 | E2E-13 | §6.5 断言 6 |
| dispose → 二次 launch（同一 dataRoot）→ sessions.search 命中 | E2E-13 | §6.5 断言 6 |

## 4. 文件清单

### 新增文件
- tests/e2e/e2e-10-chat-entry.test.ts
- tests/e2e/e2e-11-tool-jump.test.ts
- tests/e2e/e2e-12-attach-tts.test.ts
- tests/e2e/e2e-13-l3-search.test.ts

### 修改文件
- tests/e2e/test-main.js（装配 agent/sessions/modelsConfig handler + agent.events 事件推送）
- tests/e2e/helpers/rpc-driver.ts（waitForEvent 订阅辅助）
- tests/e2e/helpers/electron-launcher.ts（E2E_RUN_DIR → runs\T-M3-007\ + 二次 launch 复用 dataRoot 选项）

### 文档更新（收尾阶段）
- docs/04-Todo（T-M3-007 done + §6.5 退出门槛相关项 + §9 统计）
- docs/00-索引（版本同步）
- AGENTS.md（§3.1 版本同步）
- .plan/00-当前任务.md（状态更新）
- .record/T-M3-007-实施记录.md（8 章节）

## 5. 测试策略

### E2E 框架
复用 T-M1-010/T-M2-009 的 vitest + child_process.fork + Node.js IPC 框架（test-main.js 子进程 + RpcDriver 协议），前置 `pnpm build`。

### 数据隔离
所有 E2E 写 `H:\pi-studybuddy-tmp\runs\T-M3-007\e2e\<suffix>\`（仿 E2E_RUN_DIR 范式）。

### 外部服务全 mock
AI / SAPI / edge-tts / whisper.cpp 全 mock，不连真实服务（08-Test §1.3 第 6 条）。agent.events 走受控夹具发射。

## 6. 五阶段治理定位

本任务处于**阶段 5b（系统 E2E）**，是 M3 退出门槛任务。前置：
- 阶段 1-4：对话承载层（T-M3-001 主入口 / T-M3-002 原生能力 / T-M3-003 L3+业务化 / T-M3-004 工具跳转 / T-M3-005 model_select+turn_end / T-M3-006 UI）全部 done
- 阶段 5a：系统冒烟已通过（各业务任务内置冒烟）
- 阶段 5b E2E-01~09：T-M1-010 + T-M2-009 已完成

## 7. 依赖关系

| 依赖 | 状态 |
|---|---|
| T-M3-001~006（对话承载层 + 会话管理 + 工具映射 + L3 + model_select/turn_end + UI） | ✅ done |
| T-M1-010（E2E 框架 + E2E-01~03） | ✅ done |
| T-M2-009（E2E-04~09 + test-main.js 装配范式） | ✅ done |

## 8. 预期产物

- 4 个 E2E 测试文件（E2E-10~13）
- test-main.js 扩展（agent/sessions/modelsConfig handler 装配 + agent.events 事件推送）
- rpc-driver.ts waitForEvent + electron-launcher 二次 launch 复用
- 质量门全通过（type-check + 966+ 单元/集成测试 + E2E-10~13 新增全绿 + build + smoke 6/6 + 文档治理 + 契约覆盖 + 安全不变量 6/6）
- M3 退出门槛 E2E-10~13 相关项勾选

---

## 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（Prompt + AGENTS.md/00-索引/04-Todo/08-Test §6.5/07-WF §2.8/06-API §3.1 + test-main.js/rpc-driver/electron-launcher 现状核对）
- [x] 步骤 2：确认 T-M3-006 收尾完成（master 68d7352 + origin/master）+ 用户批准开工 + .plan 无其他执行中任务
- [x] 步骤 3：创建 .plan/T-M3-007-e2e-chat.md 草案
- [x] 步骤 4：独立审查计划（Prompt 核实通过，一处非阻塞描述偏差：RpcDriver 走 Node IPC 非 stdin/stdout）
- [x] 步骤 5：用户批准开工登记（04-Todo v0.1.62 + 00-索引 v0.1.69 + AGENTS.md v0.1.49 + 分支 agent/T-M3-007-e2e-chat）
- [ ] 步骤 6~12：TDD 实施（test-main.js 装配先行 → RpcDriver waitForEvent → E2E-10~13 逐个 RED→GREEN）+ 质量门 + 独立审查
- [ ] 步骤 13：04-Todo done 登记 + 文档同步 + 实施记录
- [ ] 步骤 14：文档治理检查
- [ ] 步骤 15：diff 检查
- [ ] 步骤 16：提交交付（★ 用户授权）

## 审查记录

**审查日期**：2026-08-08
**审查者**：AI 审查者（独立视角）

### 审查结论：✅ 通过

**检查项**：
1. ✅ 任务目标覆盖完整 — 4 个 E2E（10~13）对应 08-Test §6.5 + M3 退出门槛
2. ✅ 文件清单完整 — 4 新增 + 3 修改 + 收尾文档
3. ✅ 接口与 06-API 一致 — 复用已有 127 方法，test.* 仅进 test-main.js 不进 api.ts
4. ✅ 关键不变量覆盖 — 事件序列/防泄露/工具跳转映射/allowed-roots/@引用/L3 跨进程持久化
5. ✅ 铁律无违反 — 数据隔离 runs\T-M3-007\，外部服务全 mock，E2E 前置 pnpm build

**补充说明**：
- E2E-13 二次 launch 需 electron-launcher 增加"复用同一 dataRoot 不清理"选项（当前 launchElectron 每次 fs.rmSync 清理）
- agent.events 事件推送需 test-main.js 在 agent.send 发射后将事件序列经 IPC `{"type":"event",...}` 转发给 RpcDriver

**用户批准**：用户已于 2026-08-08 批准开工（Prompt 确认 + "执行吧"）