# 任务计划：T-M4-006 设置页 UI

**任务 ID**：T-M4-006  
**日期**：2026-08-09  
**状态**：🚧 执行中（用户于 2026-08-09 已批准）  
**关联文档**：09-UI §3.1 / §9.2 / §10 / §11 / §12 / §13.3 / §14.2；03-Arch §2.5 / §4.5 / §6.4 / §6.5；06-API §3.13-§3.16 / §4；AGENTS.md §4.4 / §5 / §7  
**里程碑**：M4 业务接线 + 打包部署（阶段 4：系统组装）

---

## 1. 任务目标

### 做什么

实现可从左侧导航和 `Ctrl+,` 打开的**独立设置页面**，以真实 typed RPC 接通学习偏好、模型默认选择、AI/Email/飞书凭证状态与写入、工具链健康检查及 `toolchains.changed` 实时刷新；不新增任何契约方法。

### 为什么

M4 的 P0 基础 UI 要先让学生能在本机安全完成模型/密钥/学习偏好配置，并能看到本机工具链状态，才能继续学期/课程切换、AppShell 数据流和业务 Tab 接线。

### 依据

- 09-UI §3.1 将“⚙ 设置”置于左侧导航，§4.1 的 TabBar 固定为 9 个学习工作台 Tab；§13.3 要求 `Ctrl+,` 打开设置。
- 09-UI §9.2、§10.1-§10.2 定义模型配置、三组设置与工具链健康检查；§12 指定 `toolchains.changed` 更新设置页。
- 09-UI §11、§14.2 与 AGENTS.md §9.2-§9.3 要求绝不显示 API Key、完整 UUID、真实渠道地址、绝对路径或内部错误栈。
- 03-Arch §2.5 / §4.5 / §6.4 / §6.5，以及 06-API §3.13-§3.16 定义现有的 settings、credential-vault、modelsConfig 和 toolchains 契约边界。

### 裁决：设置作为独立页面（非 Tab）

设置由 `AppShell` 的独立页面状态承载，左侧栏增加“⚙ 设置”入口，`Ctrl+,` 打开；返回时保留原 active Tab。**不向 `TABS` 增加第 10 个 Tab**：09-UI §3.1 明确把设置放在左侧导航，而 §4.1 的 TabBar 仅定义对话与 S1-S7 的 9 个工作台 Tab。这是最小且与权威 UI 信息架构一致的实现。

---

## 2. 范围与非目标

### 范围

- 新建设置页三大分组：
  - **通用**：每日目标时长、可用时间、TTS 默认引擎/语速/音色、备份默认目录（仅相对目录名）/调度频率；通过 `settings.get` / `settings.update` 持久化。TTS、备份实际执行接线仍留给 T-M4-018 / T-M4-019。
  - **安全**：默认模型 provider/model（`models.list` + `modelsConfig.get/set`）、AI/Email/飞书凭证状态、日志脱敏说明、业务数据根隔离说明。
  - **开发者**：工具链健康检查、手动重扫、受支持 capability 的安装动作、实验性功能和脱敏调试日志偏好。
- 密钥状态**只**由 `credentials.listKeys` 判断；输入框始终 `type="password"`，提交走 `credentials.set`，移除走 `credentials.delete`。不调用 `credentials.get`，不向 UI 状态存储或渲染任何密钥值。
- 对模型 API Key 使用 `modelProvider:<provider>`；Email / 飞书使用受限别名 `parentContact:email` / `parentContact:feishu`。仅展示“已配置 / 未配置”。
- 读取工具链状态用 `toolchains.list`，重扫用 `toolchains.rescan`，安装用 `toolchains.install`，并订阅 `toolchains.changed` 刷新显示；路径仅安全化为文件名/“本机可用”，绝不显示绝对路径。
- 模型默认项使用已有 `modelsConfig.get/set`，选项源自已有 `models.list` handler，不在 renderer 伪造 fixture。
- 开关/表单保存失败时只显示固定中文可操作消息；对来自 RPC 的文本再次执行 UUID、密钥、绝对路径、堆栈样式过滤。

### 安全边界裁决

09-UI §10.1 的“数据根（路径/磁盘占用）”与 §11.1 的“绝不展示文件绝对路径”并存，且当前 127 个 RPC 没有数据根容量查询方法。本任务不得新增契约。因此页面将呈现**脱敏的数据根状态卡**（“本机业务数据根，已物理隔离；路径不在界面展示”）和“磁盘占用：当前版本未提供读取接口”，不伪造大小、不泄露绝对路径。后续若要显示真实容量，必须由经批准的单独任务先扩充 API 契约。

### 非目标（不做什么）

- 不实现 T-M4-007 学期/课程切换，不重构 T-M4-008 AppShell 数据流。
- 不实现 electron-builder / 打包（T-M4-009），不接线 S1-S7、TTS 控制条或备份恢复面板（T-M4-010~019）。
- 不新增、删除或改写 `Api` 契约方法；总数保持 127。
- 不连接真实 AI、SMTP、飞书、WPS 或 whisper.cpp；测试仅使用受控 RPC mock 与隔离运行目录。
- 不显示、记录或回填完整 UUID、API Key、真实邮箱/Webhook、绝对路径、SQL 或内部栈。
- 不自动提交、推送、合并，亦不启动下一任务。

---

## 3. 文件清单

### 将创建的文件

| 文件路径 | 用途 |
|---|---|
| `src/renderer/components/SettingsPage.tsx` | 设置独立页面；真实 typed RPC 加载、保存、凭证状态、工具链订阅及安全渲染。 |
| `tests/unit/renderer-settings-page.test.ts` | RED→GREEN 覆盖三组 UI、凭证密码框/状态、RPC 调用编排、工具链流更新与泄露拦截。 |
| `.record/T-M4-006-实施记录.md` | 收尾时创建的 8 章节实施记录。 |

### 将修改的文件

| 文件路径 | 修改内容 |
|---|---|
| `src/renderer/components/AppShell.tsx` | 设置独立页路由状态、左侧“⚙ 设置”入口、`Ctrl+,` 快捷键、返回工作台行为；不改 `TABS` 的 9 Tab 定义。 |
| `tests/unit/renderer-layout.test.ts` | RED 断言左侧设置入口、设置不是第 10 个 Tab、快捷键/独立页面壳的静态可见结构。 |
| `tests/e2e/electron-production-runtime.test.ts`（仅在现有真实 Electron harness 可可靠断言 renderer 设置入口时） | 补充受影响真实 Electron 冒烟：可见设置入口且不暴露敏感文本。若当前 TCP harness 无 DOM inspector，不伪造 E2E，保留单元层可执行证据并在实施记录说明覆盖边界。 |
| `docs/04-任务清单-Todo-List.md` | 开工已登记为 in_progress；收尾时登记事实、测试、Git 证据。 |
| `docs/00-文档索引-Index.md` | 同步 04-Todo 当前版本/状态和版本历史。 |
| `AGENTS.md` | 同步权威文档版本登记与治理修订记录。 |
| `.plan/00-当前任务.md` | 指向本计划；收尾时保留并标记完成。 |

> 预计**不修改** `src/contract/api.ts`、`src/contract/types.ts`、agent-host handlers 或数据库 schema；若调查证明任何已有 RPC 不可用，停止业务施工并按权威链请求裁决，而非临时新增契约。

---

## 4. 接口设计

### 既有 RPC（不新增）

```ts
// 偏好和简单模式
settings.get({})
settings.update({
  learningPreferences: { dailyGoalMinutes, availableTime },
  ttsPreferences: { defaultEngine, rate, voice },
  backupPreferences: { defaultDirectory, frequency },
  experimentalFeatures,
  debugLoggingEnabled,
})
settings.getSimpleMode({})
settings.setSimpleMode({ enabled })

// 密钥：只 list/set/delete，renderer 不调用 credentials.get
credentials.listKeys({ prefix? })
credentials.set({ key: "modelProvider:<provider>" | "parentContact:email" | "parentContact:feishu", value })
credentials.delete({ key })

// 模型：provider/model 别名写 <dataRoot>/config/models.json，key 不入此文件
models.list({})
modelsConfig.get({})
modelsConfig.set({ provider, model })

// 工具链
 toolchains.list({})
 toolchains.rescan({})
 toolchains.install({ capabilityId })
rpc.subscribe("toolchains.changed", undefined, onStatuses)
```

### Renderer 状态与脱敏规则

- `SettingsPage` 仅持有表单偏好、provider/model 别名、`configuredKeys: Set<string>`、`ToolchainStatus[]`、加载/保存状态与**空白**的待提交秘密输入。
- 成功提交或删除后立即清空秘密输入，再次 `listKeys` 刷新状态；不读取、缓存或日志化密钥。
- 工具链 `path` 只经安全 display helper 渲染为 basename 或“本机可用”；错误文案经 allowlist/脱敏 helper 转为中文操作提示。
- 保存相对备份目录；若用户输入绝对路径、盘符、`..` 或 URL，拒绝保存并展示中文提示。

### 数据与契约边界

`AppSettings` 已有 `[key: string]: unknown` 扩展位，设置页可用 `settings.update` 存储非敏感偏好；不为 UI 偏好新增 contract DTO。模型/密钥仍分别落到已有业务数据根模型配置和 credential-vault，满足物理隔离与密钥边界。

---

## 5. 测试策略

### 单件测试（阶段 2，先 RED）

- [ ] `SETTINGS-RED-01`：静态渲染包含“通用 / 安全 / 开发者”三组及学习、TTS、备份、模型、密钥、日志、数据根、工具链、实验性功能/调试日志的可操作结构。
- [ ] `SETTINGS-RED-02`：AI/Email/飞书输入均为 `type="password"`；markup 不含测试 API key、邮箱/Webhook、完整 UUID、绝对路径和堆栈字样。
- [ ] `SETTINGS-RED-03`：设置入口位于左侧、`TABS` 仍为 9 项；`Ctrl+,` 与返回工作台可驱动独立页面状态。
- [ ] `SETTINGS-RED-04`：注入 `TypedRpcClient` mock 时，初始化只调用 `settings.get`、`settings.getSimpleMode`、`credentials.listKeys`、`models.list`、`modelsConfig.get`、`toolchains.list`，并注册 `toolchains.changed`；不调用 `credentials.get`。
- [ ] `SETTINGS-RED-05`：保存偏好/简单模式/模型/凭证/工具链重扫或安装时，参数精确映射到已有 RPC；保存后秘密状态清空并刷新 key status。
- [ ] `SETTINGS-RED-06`：工具链路径与错误信息的 UI display helper 过滤绝对路径、UUID、key/stack 痕迹；数据根状态不伪造容量。

### 集成测试（阶段 3）

- [ ] 使用现有 `createMockRpcClient` 或等价记录型 typed RPC，验证 `SettingsPage` 使用真实方法名与 Api 类型参数；不修改 `src/contract/api.ts`。
- [ ] 对 `toolchains.changed` 回调注入新的 `ToolchainStatus[]`，断言设置页的状态源更新；卸载时调用 unsubscribe。
- [ ] 复验既有 `credentials-settings-handlers`、`models-config-handlers`、`toolchains-manager`，确保 renderer 方案不要求后端 mock 改造。

### 系统冒烟（阶段 5a）

- [ ] `pnpm build` 后真实 Electron 启动、`system.ping` 仍可用，renderer 引入 SettingsPage 不破坏 preload/CSP。
- [ ] `pnpm smoke` 6/6（或脚本当期规定数）通过。

### E2E（阶段 5b）

- [ ] 运行既有真实 Electron + loopback TCP E2E 全集；如 harness 能直接确认 renderer DOM，则补最小设置入口/安全文本断言。不得用 Node fork 或假 renderer 冒充 Electron E2E。

### 安全不变量

- [ ] UI secret 输入 `type=password`，且任何 setup/status/错误 DOM 不包含明文 secret。
- [ ] 不调用 `credentials.get`；仅 key-name 判断配置状态。
- [ ] 无完整 UUID、真实渠道地址、绝对路径、内部栈或 SQL 泄露；工具链 path 必须脱敏。
- [ ] 所有测试可写数据只在 `H:\pi-studybuddy-tmp\runs\T-M4-006\`；不触碰 `%LOCALAPPDATA%\PiStudyBuddy`。

---

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | 不新增第三方组件；React/Vitest/Electron 与既有 RPC 已就绪。 |
| 2. 单件测试 | 先新增 SettingsPage/脱敏 helper 的 RED 测试。 |
| 3. 集成测试 | 用 typed RPC mock 验证 settings/credentials/models/toolchains 调用与 stream 生命周期。 |
| 4. 系统组装 | AppShell 组装独立设置页、侧栏入口、快捷键，不增加 Tab 或 Api。 |
| 5. 冒烟 + E2E | build、smoke、既有真实 Electron E2E、契约/安全/UUID/治理检查全量复验。 |

---

## 7. 依赖关系

### 前置任务

- [x] T-M4-003：credentials/settings handlers 已真实装配。
- [x] T-M3-005：modelsConfig 读写业务数据根已完成。
- [x] T-M0-004：toolchains list/rescan/install 与 changed stream 已完成。
- [x] T-M4-022：真实 Electron 运行时与业务 E2E 承载已完成、已推送。

### 组件依赖

- [x] `TypedRpcClient`：renderer 至 agent-host 的契约调用与 stream subscribe。
- [x] credential-vault：密钥键名验证与 DPAPI 存储，UI 仅经 RPC 调用。
- [x] ToolchainManager：工具链发现、探测、安装与 changed 通知。

---

## 8. 预期产物

### 代码

- `src/renderer/components/SettingsPage.tsx`
- `src/renderer/components/AppShell.tsx` 的独立设置页面入口/快捷键接线
- `tests/unit/renderer-settings-page.test.ts`
- 仅在可验证时修改真实 Electron E2E 测试

### 文档更新

- `docs/04-任务清单-Todo-List.md`：in_progress → done 的完整证据
- `docs/00-文档索引-Index.md`、`AGENTS.md`：版本/状态同步
- **不更新** 06-API（无契约变化）

### 实施记录

- `.record/T-M4-006-实施记录.md`（收尾时创建，8 章节）

---

## 9. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界
- [x] 步骤 2：检查文档门禁、前置依赖和 master 干净状态
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [x] 步骤 4：独立审查计划（Heisenberg / Epicurus；初审意见已纳入修复）
- [x] 步骤 5：用户批准计划（★ 用户授权，2026-08-09）
- [x] 步骤 6：拆分任务、逐项实现
- [x] 步骤 7：先编写失败测试（TDD RED；2026-08-09：新增精确 RPC action 与设置导航状态测试，先失败 3 项：缺少 action helper / navigation reducer，后最小实现转绿）
- [x] 步骤 8：type-check（Node 24.14.0：tsconfig.json + tsconfig.node.json 均通过）
- [x] 步骤 9：build（`scripts/verify.mjs --stage=full` 内通过）
- [x] 步骤 10：test（全量 unit/integration 通过；慢探测用例显式 30s timeout，避免并行负载下误报 5s 超时）
- [x] 步骤 11：smoke / 真实 Electron E2E（verify full：smoke 6/6、真实 Electron E2E 16 files / 117 tests 通过）
- [x] 步骤 12：≥2 独立审查并修复（Heisenberg 与 Epicurus 最终复审均 PASS；Epicurus 初审的 RPC 覆盖/计划证据/慢测试意见已修复，末尾空白行已删除并复验）
- [x] 步骤 13：更新 04-Todo + 文档 + 实施记录（任务仍 in_progress：Git 收口未获授权）
- [x] 步骤 14：文档治理检查（通过；仅既有 01-TRD 状态字段格式非阻塞警告）
- [x] 步骤 15：diff 检查（2026-08-09：删除 `AppShell.tsx` EOF 空白行后，`git diff --check` 通过）
- [ ] 步骤 16：提交交付（★ 用户授权；本 Prompt 未授权，默认不执行）

---

## 10. 证据登记

- 测试日志路径：`H:\pi-studybuddy-tmp\runs\T-M4-006\`
- 提交哈希：待用户明确授权
- 推送状态：待用户明确授权
- 实施记录路径：`.record/T-M4-006-实施记录.md`

---

## 审查记录

- 2026-08-09：计划阶段的权威核对已完成：T-M4-003/T-M3-005/T-M0-004/T-M4-022 均为 done；`master...origin/master` 干净；原 `.plan/00-当前任务.md` 已标明 T-M4-022 完成且无其他执行中计划。
- 2026-08-09：用户明确批准计划并授权开始实施；上述裁决保持有效。
- 2026-08-09：Heisenberg 初审发现展示文本脱敏、provider key、stream/list 竞态和秘密输入清空风险；修复后复审 PASS。Epicurus 初审指出关键 RPC/导航测试、计划事实同步与慢探测回归不完整；已新增精确 action helper + reducer 测试、同步计划事实，并为真实 PATH/Agent 初始化慢测试设置 30s 局部时限，未降低产品断言；最终复审发现 `AppShell.tsx` EOF 空白行，删除后 `git diff --check` 通过，最终 PASS。
- 2026-08-09：受控偏差：当前公开 `toolchains` 契约没有 WPS Office 或 whisper.cpp 的独立 capability probe；页面明确不伪造状态。若要显示真实健康值，必须经单独批准任务扩展探测/API，或修订权威 UI 条款。
- 2026-08-09：隔离真实 Electron 手工 UI 验收补强：以 `PI_STUDYBUDDY_DATA_ROOT=H:\pi-studybuddy-tmp\runs\T-M4-006\manual-ui\data` 启动 `node_modules\electron\dist\electron.exe .`，确认左侧“⚙ 设置”可打开独立页；通用、安全、开发者分组、凭据仅显示状态、日志/数据根脱敏说明与工具链状态可见；返回工作台后仍为“对话”Tab，再以 `Ctrl+,` 重新打开设置。无真实密钥输入、无保存操作。截图证据位于同目录 `03-settings-page.png`、`04-settings-security-developer.png`、`05-settings-developer-controls.png`、`06-workspace-after-return.png`、`07-settings-opened-by-shortcut.png`。

## 完成记录

- 2026-08-09：复验时发现以 Node 24.14.0 启动的 `scripts/verify.mjs` 会让 shell/npm 子进程重新从全局 PATH 解析到 Node 25.4.0；这使既有 `js.node` 健康断言误报为 `unverified`。按 RED→GREEN 最小修复质量门：把 `process.execPath` 目录前置传给各检查子进程，不放宽探测或测试断言；随后 Node 24.14.0 `verify --stage=full` 全绿。该治理基线变更的原因、影响与依据已同步至 AGENTS.md §12、00-索引和 04-Todo。

- 2026-08-09：实现、完整质量门、两名独立审查最终 PASS 与最终 `git diff --check` 已完成；Node 24.14.0 `scripts/verify.mjs --stage=full` 通过（含 type-check、docs、全量 unit/integration、contract/security、build、smoke 6/6、真实 Electron E2E 16 files/117 tests）。任务依 AGENTS.md §4.5/§8.4 保持 in_progress，等待用户明确授权 Git 提交/推送；未预选下一任务。


