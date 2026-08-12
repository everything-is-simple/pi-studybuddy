# T-M5-003 对话/会话/模型/文件引用真实用户闭环修订

**状态**：执行中
**日期**：2026-08-12
**里程碑**：M5 用户可用性验收 + UI 修订 + 一键交付
**实施分支**：`agent/T-M5-003-chat-session-model-closure`
**测试运行根**：`H:\pi-studybuddy-tmp\runs\T-M5-003\`
**集成基线**：`master=origin/master=9ec9b1e`（2026-08-12 核验；原开工基线 869de2f，T-M5-002 已快进并入 master；实施前重新核验）

## 1. 裁决与范围

用户明确批准 T-M5-003 开工（"P0 项按序推进 T-M5-003"）。真机 UAT 已确认：空数据首屏对话显示 `defaultSessionFixture()` 假会话、模型下拉列出 7 provider 但底部恒"未配置"。本任务移除 fixture/占位/静默失败，打通对话默认主入口的真实用户闭环。

### 纳入范围

- 移除生产 `defaultSessionFixture()` 注入（`src/agent-host/index.ts:132`），空数据根会话列表为空；fixture 仅保留测试注入。
- 移除 ChatTab 硬编码 `sess-001`/`mist-001`/`sess-new`（`ChatTab.tsx:353/676/746`、`AppShell.tsx:364`）：发送、工具跳转、错题关联均消费真实当前会话/真实错题。
- 真实会话管理：新建/切换/重命名/导出/删除，首条消息归属正确会话，重启后会话持久化可见。
- 真实模型状态：`modelsConfig.get/set` 成功/失败可见且可重试；底部状态栏与设置页、对话请求一致，不再恒"未配置"。
- 真实错题/文件选择：关联错题从真实 `mistakes.list` 选择；`@文件` 从真实资料选择并读取。
- 失败路径可见：会话加载、模型加载、发送失败均有固定中文错误 + 重试，无静默 catch。

### 明确不纳入

- 不修改 S1-S7/TTS/备份/设置页面控件（T-M5-004/005）。
- 不处理 OCR/WPS/whisper 随包（T-M5-006）。
- 不新增 API/schema（contract 保持 127/127）；若 RED 证明既有契约无法表达条款，另行请求裁决。
- 不连真实外部 AI 服务；测试用受控 mock，生产路径仅验证状态流转与错误可见。
- 不写入真实业务数据根或真实凭证。

## 2. 已定实现裁决

1. 生产会话存储：空数据根初始化为空会话列表；新建会话产生真实 ID，发送首条消息写入该会话。
2. 会话 ID 单一来源：ChatTab 消费 AppShell `activeSessionId`，删除所有字面量 `sess-001`。
3. 错题关联：按钮打开真实错题选择（`mistakes.list` 当前课程），选中后以脱敏 ID 传给 agent.send 的 sessionMeta。
4. 模型状态：AppShell 底部状态栏订阅 `modelsConfig.get` 结果；配置失败显示"模型未配置"且指向设置页可操作；成功保存后状态栏/设置页/对话请求一致。
5. 静默 catch 全量清理：本任务涉及的会话/模型/文件 RPC 失败均显示固定中文错误与重试，不吞异常。

## 3. RED -> GREEN -> REFACTOR

### RED

先新增失败测试，至少覆盖：

- 空数据根 `sessions.list` 返回空（生产不注入 fixture），真实 Electron 首屏无"导数练习/极限学习"。
- ChatTab 发送携带当前 `activeSessionId`（新建会话后首条消息归属新会话）；两次会话各自历史/标题正确。
- 关联错题从真实列表选择，agent.send sessionMeta.mistakeIds 仅含选中项；无选中时不写入。
- 模型配置失败显示固定错误且可重试；成功保存后底部状态栏显示所选模型。
- 真实 Electron E2E：空数据根创建会话→发送→重启→会话持久化，DOM 无 fixture 内容与敏感信息。

### GREEN

- 最小实现：session-store 空初始化 + AppShell/ChatTab 会话 ID 接线 + 错题选择器 + 模型状态订阅与错误显示。
- 失败路径：loading/error/empty/retry 四态齐全。

### REFACTOR

- 提取会话/模型/错题选择的纯状态与错误文案常量，避免复制异步规则。
- 核对无完整 UUID/路径/栈泄漏。

## 4. 预期文件范围

- `src/agent-host/session-store.ts`、`src/agent-host/index.ts`
- `src/renderer/components/tabs/ChatTab.tsx`、`src/renderer/components/AppShell.tsx`
- `src/renderer/components/SessionSidebar.tsx`（如需）
- 状态栏/错题选择相关 renderer 模块
- 对应 `tests/unit/`、`tests/integration/`、`tests/e2e/`
- `.record/T-M5-003-实施记录.md`（收尾时创建）

## 5. 验收清单

- [ ] 空数据根会话列表为空，无 fixture 会话与内容。
- [ ] 新建会话后发送首条消息归属新会话；切换/重命名/导出/删除可用且重启持久化。
- [ ] 关联错题从真实错题列表选择，sessionMeta 仅含选中项。
- [ ] 模型配置失败可见且可重试；成功保存后底部状态/设置页/对话请求一致。
- [ ] 会话/模型/文件引用失败均显示固定中文错误，无静默 catch。
- [ ] 真实 Electron E2E 完成空数据会话闭环 + 重启持久化 + DOM 无敏感信息。
- [ ] 定向测试、受影响真实 Electron E2E、type-check、security/UUID 检查和完整 `verify --stage=full` 通过。
- [ ] 两名独立审查者复核实现/UX 与安装态验收边界。

## 6. 受控命令

```powershell
$env:Path = "C:\node-v24.14.0-win-x64;$env:Path"
node --version
pnpm --version
pnpm test -- <targeted-tests>
pnpm test:e2e -- <targeted-e2e>
pnpm type-check
pnpm verify -- --stage=full
node scripts/check-docs-governance.mjs
node scripts/check-contract-coverage.mjs
node scripts/check-desktop-security.mjs
node scripts/check-uuid-leak.mjs
git diff --check
```

所有测试运行数据写入 `H:\pi-studybuddy-tmp\runs\T-M5-003\`。不运行真实外部服务，不使用真实用户数据或凭证。

## 7. 停止条件

- API/schema 缺少对话闭环必须表达的能力，或设计条款冲突：记录证据并请求用户裁决。
- 任何 P0/P1 不属于对话/会话/模型/文件引用边界：登记到既定 T-M5-004~008，不扩展本任务。
- 完成所有验收项、独立审查与质量门后，按 AGENTS.md §7 受控收尾；不自动创建或启动下一任务，不自动 commit、merge 或 push。

## 完成记录

- 完成日期：2026-08-12
- 实施记录：`.record/T-M5-003-实施记录.md`
- 状态：✅ 本地实施/验收完成（RED→GREEN→REFACTOR + 真机 UAT 两阶段 + 双独立审查无 P0/P1）；Git 收口完成后转 done。
- 收尾事实：生产空数据无 fixture、真实会话（新建/发送/物化/重启持久化/内联重命名）、模型状态失败可见可重试、真实错题选择、turn_end L3 真实会话归属（用户裁决纳入）；unit/integration 123 files/1149 tests、真实 Electron E2E 32 files/141 tests、verify full 通过（t-m4-021 一次环境性抖动重跑通过）；真机 UAT 证据 21 文件落 `runs\T-M5-003\uat\`（不进 Git）；无 API/handler/schema 变化（contract 127/127）；T-M5-004~008 保持 pending。
