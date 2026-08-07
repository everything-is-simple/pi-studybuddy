# 任务计划：T-M2-008 09-UI S5-S7 + TTS + 备份恢复 UI

**任务 ID**：T-M2-008
**日期**：2026-08-08
**状态**：📝 待审查
**关联文档**：09-UI §4.8-§4.10 + §5.1-§5.5 + §6.1-§6.3 + 06-API §3.7-§3.11 + 07-WF §2.6-§2.7 + §3-§5 + 08-Test §6.2-§6.4 + §7.2-§7.5 + 03-Arch §6.2
**里程碑**：M2 完整闭环（第 6 任务，§7.5 全局执行顺序表第 2 行）

---

## 1. 任务目标

### 做什么

实现 09-UI §4.8-§4.10 + §5 + §6 的剩余业务 UI：3 个 Tab 组件 + TTS 全局控制条 + 备份恢复面板 + 静态渲染测试。

### 为什么

- §7.5 全局执行顺序表第 2 行：与 T-M1-009 同批，复用 UI 组件模式（已完成 T-M1-009，现轮到 T-M2-008）
- 是 T-M2-009（E2E-04~09）的前置依赖
- 是 M2 退出门槛"S5-S7+TTS+备份恢复全链路冒烟通过"的必要组件
- 契约层（api.ts/types.ts）+ 业务 handler（S5-S7+TTS+备份恢复 共 28 RPC）已全部就绪，UI 是最后一块拼图

### 依据

- [09-UI §4.8](../docs/09-使用者介面-UI-Design.md)：冲刺 Tab（模拟考/速背卡/冲刺计划，确定性只读 DTO 不依赖 AI）
- [09-UI §4.9](../docs/09-使用者介面-UI-Design.md)：报告 Tab（家长报告学生侧，规则聚合非 AI）
- [09-UI §4.10](../docs/09-使用者介面-UI-Design.md)：采集 Tab（课堂录音转写，PCM WAV 单一输入 + 合规确认）
- [09-UI §5.1-§5.5](../docs/09-使用者介面-UI-Design.md)：TTS 全局朗读控制条（引擎切换 + 语速 + 播放控制 + 状态 + 标记已复习 + 引擎降级）
- [09-UI §6.1-§6.3](../docs/09-使用者介面-UI-Design.md)：备份恢复 UI（手动/调度/历史 + 恢复交互 + 归档触发）
- [06-API §3.7-§3.11](../docs/06-API契约-API-Contracts.md)：S5-S7+TTS+备份恢复 RPC（已就绪）
- [07-WF §2.6-§2.7](../docs/07-工作流-Workflow.md)：S5 冲刺 + S7 采集路径
- [07-WF §3-§5](../docs/07-工作流-Workflow.md)：家长报告 + TTS + 备份恢复路径
- [08-Test §6.2-§6.4](../docs/08-测试验收-Test-Plan.md)：E2E-04~09 UI 断言（本任务为 E2E 铺路）
- [08-Test §7.2-§7.5](../docs/08-测试验收-Test-Plan.md)：隐私边界 + 确定性只读 + 单机零云 + 备份恢复
- [03-Arch §6.2](../docs/03-架构设计-Architecture-Design.md)：renderer 技术栈（React 19 + Vite）

## 2. 范围与非目标

### 范围

- **3 个 Tab 业务组件**：
  - `CramTab` — S5 冲刺（模拟考入口 + 速背卡浏览 + 冲刺计划展示，三选一 Tab 子切换）
  - `ReportTab` — S6 家长报告（生成入口 + 历史列表 + 报告内容展示）
  - `CaptureTab` — S7 课堂采集（合规确认 + 文件选择 + 转写结果 + 保存为 S2 笔记）
- **TTS 全局控制条**：
  - `TtsControlBar` — 常驻主内容区顶部（引擎切换 + 语速调节 + 播放控制 + 状态显示）
  - 替换 AppShell 中的"TTS 占位"
  - 订阅 Streams["tts.state"] 推送状态
- **备份恢复面板**：
  - `BackupPanel` — 备份恢复 UI（手动备份 + 调度配置 + 历史列表 + 恢复交互 + 冲突解决）
  - 入口：左侧栏"设置"区域或独立 Tab（按 09-UI §6.1 设计，归入设置面板）
- **公共组件复用**：EmptyState/LoadingState/ErrorState/ShortId/TabContainer（T-M1-009 已就绪）
- **AppShell 路由扩展**：cram/report/capture 三个 Tab 渲染对应组件 + TtsControlBar 注入
- **静态渲染测试**：3 Tab + TtsControlBar + BackupPanel 组件测试

### 关键约束落实

- **§7.4 确定性只读**：CramTab 速背卡/冲刺计划是确定性只读 DTO，不调 LLM、不持久化（08-Test §7.4 断言）
- **§7.2 隐私边界**：所有 UUID 走 ShortId（不展示完整 UUID）+ 报告内容不含完整 UUID（家长报告脱敏）
- **§7.5 单机零云**：报告投递渠道仅 local_export（其他渠道 mock）+ 备份仅本地目录
- **§5.5 引擎降级**：TtsControlBar 展示 fallbackUsed 标记（edge-tts 失败降级 SAPI）
- **§5.4 标记已复习**：TTS 朗读后可标记"已复习"（调 events.markReviewed）
- **§6.2 恢复交互**：BackupPanel 恢复流程（content_hash 校验 + schema_version 校验 + 冲突解决 + integrity_check 结果展示）
- **§4.10 合规确认**：CaptureTab 必须强制合规确认 checkbox（permissionConfirmed=false 拒绝转写）

### 非目标（不做什么）

- **不做 E2E-04~09**（留待 T-M2-009）
- **不做真实文件选择/录音**（Electron 文件选择器交互留待 E2E，本任务 UI 组件接收 FileMeta/夹具数据）
- **不做真实 whisper.cpp 转写**（mock，08-Test §5.4）
- **不做真实 TTS 播放**（mock，08-Test §5.4）
- **不做真实 SMTP/飞书投递**（mock，08-Test §5.4）
- **不做真实 zip 备份/恢复**（UI 组件接收夹具数据，真实操作留待 E2E）
- **不引入新依赖**（沿用 renderToStaticMarkup 静态渲染测试，AGENTS.md §6.4）
- **不修改契约层**（api.ts/types.ts 已就绪）
- **不修改业务 handler**（S5-S7+TTS+备份恢复 handler 已就绪）

## 3. 文件清单

### 将创建的文件

| 文件路径 | 用途 |
|---|---|
| `src/renderer/components/tabs/CramTab.tsx` | S5 冲刺 Tab：模拟考入口 + 速背卡 + 冲刺计划（三选一子切换） |
| `src/renderer/components/tabs/ReportTab.tsx` | S6 报告 Tab：生成入口 + 历史列表 + 报告内容（脱敏展示） |
| `src/renderer/components/tabs/CaptureTab.tsx` | S7 采集 Tab：合规确认 + 文件选择 + 转写结果 + 保存为 S2 |
| `src/renderer/components/TtsControlBar.tsx` | TTS 全局控制条：引擎切换 + 语速 + 播放控制 + 状态 + 标记已复习 |
| `src/renderer/components/BackupPanel.tsx` | 备份恢复面板：手动/调度/历史 + 恢复交互 + 冲突解决 |
| `tests/unit/renderer-cram-tab.test.ts` | 冲刺 Tab 静态渲染测试（含确定性只读断言） |
| `tests/unit/renderer-report-tab.test.ts` | 报告 Tab 静态渲染测试（含隐私边界断言） |
| `tests/unit/renderer-capture-tab.test.ts` | 采集 Tab 静态渲染测试（含合规确认断言） |
| `tests/unit/renderer-tts-control-bar.test.ts` | TTS 控制条测试（含引擎降级 + 标记已复习） |
| `tests/unit/renderer-backup-panel.test.ts` | 备份恢复面板测试（含 content_hash/schema_version/冲突解决） |

### 将修改的文件

| 文件路径 | 修改内容 |
|---|---|
| `src/renderer/components/AppShell.tsx` | 路由扩展（cram/report/capture）+ TtsControlBar 替换占位 + BackupPanel 入口 |
| `tests/unit/renderer-layout.test.ts` | 适配 AppShell 新增 TtsControlBar（若断言受影响） |
| `docs/04-任务清单-Todo-List.md` | §7.3.1 T-M2-008 in_progress → done（收尾时）+ §9 统计 |

## 4. 接口设计

### Tab 组件 Props 签名（复用 T-M1-009 模式）

```typescript
interface TabProps {
  rpc?: TypedRpcClient;
  semesterId?: string;
  courseId?: string;
}
```

### CramTab 子切换

```typescript
type CramSubTab = "mockExam" | "speedCards" | "plan";
// 模拟考：mockExams.generatePaper + startAttempt + submitAttempt + getResult + getModuleAnalyses
// 速背卡：cramCards.get（确定性只读 DTO，不调 LLM）
// 冲刺计划：cramPlan.get（确定性只读 DTO，不调 LLM）
```

### TtsControlBar 状态

```typescript
interface TtsState {
  playbackId?: string;
  engine: "sapi" | "edge-tts";
  fallbackUsed?: boolean;
  state: "idle" | "playing" | "paused" | "stopped";
  position: number;
  duration: number;
  rate: number;
}
// 订阅 Streams["tts.state"] 推送
```

### BackupPanel 恢复流程状态

```typescript
type RestorePhase = "idle" | "validating" | "conflict" | "restoring" | "completed" | "failed";
// idle → 选择 zip
// validating → content_hash + schema_version 校验
// conflict → 冲突弹窗（overwrite/create_new）
// restoring → 恢复中
// completed → integrity_check 结果展示
```

## 5. 关键约束落实

### 5.1 确定性只读（09-UI §4.8 + §7.4）

CramTab 速背卡/冲刺计划：
- 只调用 `cramCards.get` / `cramPlan.get`（返回 CramCard[] / CramPlanDay[]）
- 不调用任何 LLM 相关 RPC
- 不持久化（无写入操作）
- 测试断言：渲染输出不含"AI 生成"/"仅供参考"标记（与 HomeTab dailyBrief 同样的规则聚合断言）

### 5.2 隐私边界（09-UI §4.9 + §7.2 + §11.1）

ReportTab：
- 报告内容 contentJson 是冻结脱敏快照，UI 不展示完整 UUID
- 所有 ID 走 ShortId 组件
- 测试断言：渲染输出不含 36 字符 UUID 格式

### 5.3 合规确认（09-UI §4.10 + §7.2）

CaptureTab：
- 合规确认 checkbox 必须勾选才能触发转写
- `permissionConfirmed=false` 时转写按钮禁用
- 测试断言：未勾选时转写按钮 disabled

### 5.4 TTS 引擎降级（09-UI §5.5）

TtsControlBar：
- 展示当前引擎 + fallbackUsed 标记
- edge-tts 失败时自动降级 SAPI，显示"已降级到 SAPI"提示
- 测试断言：fallbackUsed=true 时渲染降级提示

### 5.5 标记已复习（09-UI §5.4）

TtsControlBar：
- 朗读完成后显示"标记已复习"按钮
- 点击调用 `events.markReviewed({refType, refId})`
- 测试断言：朗读完成（state=stopped）时显示"标记已复习"按钮

### 5.6 备份恢复校验（09-UI §6.2 + §7.5）

BackupPanel：
- 恢复流程展示 content_hash 校验结果（通过/失败）
- 展示 schema_version 校验结果（兼容/不兼容）
- 冲突时展示弹窗（overwrite/create_new 选择）
- 恢复完成展示 integrity_check 结果
- 测试断言：各阶段状态正确渲染

## 6. 测试策略

### 静态渲染测试（沿用 T-M1-009 范式）

- 使用 `react-dom/server` 的 `renderToStaticMarkup`
- 测试通过 props 注入夹具数据
- 断言渲染输出 HTML 包含/不包含关键字符串

### 测试用例覆盖

| 测试文件 | 断言要点 |
|---|---|
| `renderer-cram-tab.test.ts` | 速背卡渲染（知识点/关键点）+ 冲刺计划渲染（日期/任务）+ 确定性只读（不含 AI 标记）+ 模拟考入口 + 空状态 |
| `renderer-report-tab.test.ts` | 报告列表 + 报告内容（脱敏）+ ShortId（不含完整 UUID）+ 生成入口 + 投递状态 + 空状态 |
| `renderer-capture-tab.test.ts` | 合规确认 checkbox + 文件选择入口 + 转写结果展示 + 保存为 S2 按钮 + 未确认时转写禁用 |
| `renderer-tts-control-bar.test.ts` | 引擎切换 + 语速调节 + 播放控制 + 状态显示 + fallbackUsed 降级提示 + 标记已复习按钮 |
| `renderer-backup-panel.test.ts` | 手动备份入口 + 调度配置 + 历史列表 + 恢复流程（content_hash/schema_version/冲突/integrity_check） |

## 7. 实施步骤（TDD RED → GREEN → REFACTOR）

### RED 阶段（先写测试，预期失败）

1. 写 `renderer-cram-tab.test.ts`（速背卡 + 冲刺计划 + 确定性只读断言）
2. 写 `renderer-report-tab.test.ts`（报告列表 + 隐私边界 + ShortId）
3. 写 `renderer-capture-tab.test.ts`（合规确认 + 文件选择 + 转写结果）
4. 写 `renderer-tts-control-bar.test.ts`（引擎降级 + 标记已复习）
5. 写 `renderer-backup-panel.test.ts`（恢复流程 + 校验 + 冲突解决）
6. 运行 `pnpm test` 确认全部失败（组件未实现）

### GREEN 阶段（最小实现使测试通过）

7. 实现 `CramTab.tsx`（三选一子切换 + 速背卡 + 冲刺计划 + 模拟考入口）
8. 实现 `ReportTab.tsx`（报告列表 + 内容展示 + ShortId）
9. 实现 `CaptureTab.tsx`（合规确认 + 文件选择 + 转写结果 + 保存为 S2）
10. 实现 `TtsControlBar.tsx`（引擎切换 + 语速 + 播放控制 + 状态 + 降级 + 标记已复习）
11. 实现 `BackupPanel.tsx`（手动/调度/历史 + 恢复流程 + 冲突解决）
12. 修改 `AppShell.tsx`（路由扩展 + TtsControlBar 替换占位 + BackupPanel 入口）
13. 适配 `renderer-layout.test.ts`（若受影响）
14. 运行 `pnpm test` 确认全部通过

### REFACTOR 阶段（测试保持通过）

15. 提取重复样式到公共样式常量
16. 检查组件可读性 + 类型安全
17. 运行 `pnpm type-check` + `pnpm test` 确认保持通过

## 8. 验证清单

### 质量门（scripts/verify.mjs m0 阶段）

- [ ] `pnpm type-check` 通过
- [ ] `pnpm test` 全绿（656 现有 + 新增 ~40 测试）
- [ ] `pnpm build` 通过
- [ ] `pnpm smoke` 6 项全通过
- [ ] `node scripts/check-docs-governance.mjs` 通过
- [ ] `node scripts/check-contract-coverage.mjs` 通过
- [ ] `node scripts/check-desktop-security.mjs` 六条不变量全过

### 关键断言核对

- [ ] CramTab 速背卡/冲刺计划确定性只读（§7.4，不含 AI 标记）
- [ ] ReportTab 报告内容不含完整 UUID（§7.2 + §11.1）
- [ ] CaptureTab 合规确认未勾选时转写禁用（§4.10）
- [ ] TtsControlBar fallbackUsed 降级提示（§5.5）
- [ ] TtsControlBar 朗读完成显示标记已复习（§5.4）
- [ ] BackupPanel 恢复流程各阶段状态正确（§6.2）

## 9. 受控收尾（AGENTS.md §7）

任务完成时按以下顺序：

1. 复验测试和最小端到端路径（pnpm verify）
2. 更新 docs/04-Todo：T-M2-008 done + §9 统计 M2 6 done
3. 创建 .record/T-M2-008-实施记录.md（8 章节）
4. API 合同无变化（契约层未修改）
5. 计划文件标明完成状态
6. 运行文档治理检查
7. 停止并报告，等待用户指示（不自动提交/推送/合并）

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| TtsControlBar 订阅 Streams 在静态渲染中无法测试 | 仅测试渲染输出 HTML 断言，状态通过 props 注入 |
| BackupPanel 恢复流程多阶段状态复杂 | 用 RestorePhase 联合类型明确状态，每阶段独立测试 |
| CramTab 三选一子切换增加复杂度 | 用 CramSubTab 联合类型，子组件独立实现 |
| 真实文件选择/录音无法测试 | UI 组件接收 FileMeta/夹具数据，交互留待 E2E |
