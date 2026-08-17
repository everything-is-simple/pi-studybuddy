# T-M5-006 唯一执行计划：必需运行依赖自包含与离线能力装配

**任务 ID**：T-M5-006  
**状态**：in_progress（开工登记与盘点阶段）  
**日期**：2026-08-17  
**里程碑**：M5 用户可用性验收 + 一键交付  
**优先级**：P0  
**执行序**：48  
**实施分支**：`agent/T-M5-006-runtime-dependencies`  
**集成分支**：`master`  
**运行根**：`H:\pi-studybuddy-tmp\runs\T-M5-006\`  
**前置**：T-M5-001、T-M5-009、T-M5-010 已 done；T-M5-005 保持 blocked，其三条遗留 UAT已并入 T-M5-008 最终干净 Windows 安装验收。  
**权威依据**：用户本会话“系统底座是 pi”“预制配置可用”“新 setup 必须在设置页重构与用户端测试后才制作”“按系统规定每任务执行开发工作流”“开工吧”；AGENTS.md §2/§4.1-§4.5/§5/§6/§7/§9/§11；01-TRD §2/§3/§7；03-Architecture §3.3/§6.5；08-Test §1/§3/§5/§6.6；09-UI §9/§10；11-组件装配；13-测试与运维 §2-§9。

## 1. 开工门禁与实时事实

| 项目 | 已核验事实 | 结论 |
|---|---|---|
| 用户授权 | 用户明确“开工吧”，此前已要求每个任务按完整开发工作流执行 | OK |
| 前置任务 | T-M5-001、009、010 为 done；T-M5-005 是有明确外部 UAT 缺口的 blocked 状态 | OK |
| 单一执行任务 | `docs/04` 已将 T-M5-006 登记为 in_progress；本计划为唯一执行计划 | OK |
| 分支 | 当前分支 `agent/T-M5-006-runtime-dependencies` | OK |
| 运行根 | 本任务所有测试/UAT 写入 `H:\pi-studybuddy-tmp\runs\T-M5-006\` | OK |
| 工具基线 | `pi 0.84.2`、Node `v24.14.0`、pnpm `11.20.0`、`fd 10.4.2`、`rg 15.2.0` 已在当前会话核验 | 仅作为盘点基线，后续需可重复验证 |
| 工作区 | 存在未跟踪 `nul` 及 3 个现有安装器；它们均明确排除：不读取、不暂存、不提交、不删除 | 已隔离，不阻塞本任务受控文件 |
| Git | 用户已授权本次受控治理改动提交并推送当前任务分支；不得因此执行 master 合并、生成 setup 或提前结束 T-M5-006 | 本次授权范围内 |

## 2. 用户补充裁决（2026-08-17；历史裁决保留）

### 2.1 AI provider/model 的实际使用语义

- AI provider 基本沿用当前个人配置，不为本任务重构供应商体系或强行增加新的 provider。
- 由于可用中转模型可能随时间波动，系统必须把“模型配置”与“当前可用性”分开：配置可以保留，但模型需要经过受控测试后才标记为当前可用。
- 设置/模型区域应显示每个已配置模型的脱敏标识、最近测试时间、可用/不可用/未测试状态和固定中文失败原因；不得显示 key、完整 endpoint、内部错误栈或敏感响应正文。
- 用户只能直接选择当前可用模型；选择结果持久化到业务数据根既有 `config/models.json`。模型顺序和 fallback 顺序必须明确可见。
- fallback 仅在当前模型调用失败且备用模型已通过最近一次健康测试时按用户配置顺序尝试；不得静默改变用户选择，也不得把失败伪装成成功。fallback 过程需在 UI/日志中以脱敏状态可见。
- 本任务只负责运行时探测、可用性状态、受管运行资产和离线/缺失降级；如需改变既有 API/schema/handler 或设置页交互合同，先停止并请求用户裁决。

### 2.2 邮箱/飞书的实际使用语义

- 邮箱、飞书配置的目的不是“保存一份配置”，而是配置保存后立即向父母目标发送一封脱敏验证消息，验证实际投递链路。
- 验证消息必须明确标注为测试/验证消息，不含学生资料原文、真实学习报告、密钥或完整 UUID；发送成功/失败必须在 UI 中显示，失败必须有固定中文错误与重试入口。
- 建议每日执行一次本机健康检查并记录最近状态；健康检查默认不每日向父母发送测试消息，避免骚扰。若产品需要真实发信验证，应改为用户显式点击“发送测试消息”并记录审计证据。
- 真实 S6 报告投递仍按 T-M5-010 已完成的业务闭环处理；T-M5-006 不重做报告 schema、投递业务或家长数据脱敏规则。

### 2.3 交付边界

上述用户裁决优先于本计划原有的泛化描述；本任务实施前先盘点现状，确认哪些能力已由 T-M5-010 覆盖，哪些只是运行时缺口。发现重复实现、需要新增业务合同或需要改变已验收语义时，停止并报告。

### 2.4 发行策略裁决（2026-08-17）

用户明确裁决，适用于本任务后续 RED/GREEN 的范围门禁：

1. 本版在既有 StudyBuddy extension 工具基础上，**新增并随包交付受管 pi native skills**；这是加法，不替换或停用 extension。native skills 必须具备受管 manifest、内容资源、发现路径、许可清单、完整性与五阶段组件证据后才可装配；在此之前不得宣称已发现或可用。
2. OCR、whisper.cpp CLI、whisper 模型和 edge-tts 仅在每项完成来源、精确版本、许可/再分发资格、SHA-256、体积、更新责任和组件五阶段证据后，才可作为随包候选。在核验完成前，不下载、不打包、不宣称可离线使用；须维持明确的可恢复降级。
3. WPS/Office 固定为外部可选依赖，不随包；只允许能力探测、固定中文失败和不阻塞其他资料格式的恢复路径。

本裁决不批准模型 health/fallback 或渠道验证健康域的 API/schema/handler/UI 扩展；这些仍须单独裁决或登记后续任务。

### 2.5 设置与本机配置资产重规划（2026-08-17）

用户明确要求将设置从零散表单提升为本机能力控制台，并把本机配置作为正式持久化资产治理。本裁决**supersedes §2.1 中逐模型持久化 health、每日测试和自动 fallback 的本任务要求，以及 §2.2 中每日渠道健康检查的本任务要求**；历史裁决保留，新的任务边界如下：

1. 配置不必强行进入 SQLite；正式 `DATA-CFG-*` 集合继续位于 `<dataRoot>/config/`，与业务 SQLite、pi 全局目录和 DPAPI 密钥物理隔离。非敏感通用偏好写 `settings.json`，默认模型写 `models.json`，非敏感模型目录写 `pi-models.json`，密钥仅写 DPAPI `credentials.json`；报告目标与备份调度继续属于 `global.db` 的既有业务配置。
2. 当前 T-M5-006 只负责其直接所需的运行资源 manifest、受管运行能力状态、pi native skills 装配和离线/缺失降级。它不实现通用设置导航、模型 health/fallback 或渠道验证工作流。
3. 后续已登记的 T-M5-011 负责配置资产 schema version、校验、原子写、迁移、重启回读、备份/恢复/卸载边界，以及通用、模型、学习技能、运行能力、家长渠道、数据与备份、关于与更新七类设置控制台。
4. 配置介质按职责拆分：学习事实留 SQLite；非敏感通用偏好、默认模型和非敏感模型目录留 `<dataRoot>/config/` 版本化 JSON；凭证只进 DPAPI vault；报告目标/备份调度等关系型配置留 `global.db`；瞬时能力 health 每次启动/重扫派生，不作为配置 SoT。
5. 模型保留用户显式的最小连接测试和默认选择持久化；不做每日测试、持久化 health 或自动 fallback。渠道仅允许用户显式发送固定脱敏测试消息；不做每日自动外发。
6. 剩余顺序为 T-M5-006→T-M5-011→T-M5-007 发布前真实 Electron 全功能 UAT→T-M5-008 最终候选与干净机安装验收；T-M5-005 三条遗留 UAT并入 T-M5-008。

T-M5-011 未获开工授权，不得为其创建详细计划、测试或业务实现。

## 3. 目标与范围

### 3.1 交付目标

在不改变真实凭证、不依赖开发工具由用户手动安装的前提下，形成并装配可验证的运行依赖策略，使最终安装产物能够承载：

1. pi 核心运行时、StudyBuddy extension 和随应用分发的学习 skills/工具资产；
2. Electron/Node 侧应用依赖及所需本地资源；
3. 可合法再分发的 OCR/Python/whisper 等运行资产，或等价的受控替代；
4. SAPI 默认 TTS 的离线可用性及其他可选 TTS 的明确降级；
5. WPS、云模型、SMTP/飞书真实凭证等不可再分发或不应内置内容的明确可选边界、固定中文失败与恢复入口；
6. 可审计的依赖、许可、体积、版本、来源、完整性、安全与更新责任清单；
7. 自动化与真实 Electron UAT 证明用户不需要手工安装开发环境即可使用本任务范围内的能力或得到可解释降级。

### 3.2 本轮允许范围

- 只读盘点当前 package、构建、运行时装配、pi/extension/skills、OCR/WPS/whisper/TTS 适配与现有测试；
- 为可合法分发且必要的运行资产增加明确的打包清单、启动发现、绝对路径注入、完整性/缺失错误和最小安装测试；
- 必要时新增与本任务直接相关的 manifest、adapter 配置、构建脚本、测试、运行文档与用户可见错误/状态；
- 所有新增外部组件先完成组件五阶段证据，调用 `studybuddy-component-assembly` skill 的检查要求；
- 在隔离根执行真实 Electron UAT：验证用户可见的可用状态或不安装外部能力时的明确降级与恢复入口。

### 3.3 明确非范围与停止条件

- **不制作新 setup、portable zip 或发布物**：这是 T-M5-008，且其前置 T-M5-007 干净机全功能 UAT尚未完成；本任务只提供未来打包所需的依赖装配与证据。
- 不读取、运行、复制、校验、暂存、提交或删除当前未跟踪安装器及 `nul`。
- 不写入 `%LOCALAPPDATA%\PiStudyBuddy`，不读取/修改真实业务数据、模型 key、SMTP 密码、飞书 Webhook 或全局 pi 配置。
- 不将真实 key、base URL、邮件地址、Webhook、学生资料、完整 UUID 打进仓库或安装包。
- 不擅自下载/安装许可、再分发资格、体积或安全边界未核实的第三方二进制/模型；遇到此情形停在 RED/盘点，提交最小选择题请求用户裁决。
- 不把 WPS/Office、云模型、真实外部账号当作核心离线闭环的强依赖；若无法合法随包，必须实现明确可选与可解释降级。
- 当前不启动 T-M5-007、T-M5-008；T-M5-005 的三条遗留 UAT在 T-M5-008 最终干净机安装验收时消费，不在本任务提前验收。
- 若发现需要新 API/schema、改变已验收设置页语义或引入超出依赖装配范围的业务功能，停止并请求用户裁决。

## 4. 影响面与验收追踪矩阵（盘点后细化）

| 权威条款 | 当前预期落点 | RED 测试 ID（先写） | GREEN / UAT 证据 |
|---|---|---|---|
| 01-TRD §2.1：pi 不改内核，经 extension/skills 接入 | `src/agent-host`、`src/agent/studybuddy-extension.ts`、构建清单 | `T-M5-006-PI-01`：已打包运行时可加载 pi 与 StudyBuddy extension，且不读取 `~/.pi` 业务数据 | 真实 Electron 启动、pi 对话/工具最小路径；隔离根 DOM/截图/日志 |
| 01-TRD §7 决策 4：SAPI 默认离线、edge-tts 可选 | TTS adapter / runtime probe / packaging | `T-M5-006-TTS-01`：无 edge-tts/网络仍可使用或说明 SAPI 路径 | 真机 UI 朗读或固定中文可恢复失败 |
| 用户配置边界（2026-08-17 supersedes） | 默认选择已落 `<dataRoot>/config/models.json`；当前模型最小测试既有 | T-M5-006 不新增模型状态、选择门控或 fallback；这些配置与 UI 语义后置 T-M5-011 | T-M5-011 获开工授权后，先更新 05/06/09/traceability 再写 RED |
| 用户渠道边界（2026-08-17 supersedes） | T-M5-010 已有报告目标、真实投递、状态与重试 | T-M5-006 不新增验证消息或渠道 health；后置 T-M5-011 | T-M5-011 获开工授权后，先定义独立于真实报告的显式脱敏测试消息及 RED |
| 01-TRD §3 + §7 决策 1：OCR/旧 Office 处理与 WPS 边界 | OCR bridge、WPS adapter、运行 manifest | `T-M5-006-OCR-01`：受支持图片 OCR 运行资产缺失/存在均有确定性结果；`T-M5-006-WPS-01`：WPS 不随包且不会阻塞核心路径 | 真实 Electron 中能力状态、失败提示与恢复入口 |
| 03-Arch §3.3 / §6.5：工具发现、绝对路径执行 | toolchains / main runtime resolver / agent-host injection | `T-M5-006-RUNTIME-01`：发布态只解析受管运行资产，不依赖开发机 PATH | 安装态或发布目录运行验证（不生成 setup） |
| 08-Test §1/§3/§5：组件五阶段、外部 mock 边界 | 单件/集成/E2E/UAT | `T-M5-006-MANIFEST-01`：依赖清单完整且漏项失败；对应组件单件/集成测试 | 定向、完整质量门与审计清单 |
| 08-Test §6.6、13 §2-§9：真机 UAT、可追溯可恢复 | UAT 脚本/证据、traceability consumer | `T-M5-006-UAT-01`：真实 Electron 从隔离空根通过设置/状态进入本轮能力验证 | 步骤 DOM/截图/JSON，重启回读，脱敏检查 |
| 09-UI §9/§10、§11：设置状态、不泄露敏感信息 | Settings UI / 工具链与 provider 状态 | `T-M5-006-UI-01`：只显示状态、别名与恢复动作，不显示路径/key/栈 | renderer/Electron/UAT 隐私断言 |

## 5. 组件拆分与五阶段策略

| 组件 / 能力 | 初步分类 | 阶段 1 盘点 | 后续路径 |
|---|---|---|---|
| pi runtime + `@earendil-works/pi-coding-agent` | Node 应用依赖 | 锁定版本、生产 import、许可证、打包包含情况 | 单件 load → extension 集成 → 发布目录 Electron 冒烟 |
| StudyBuddy extension / 自建学习 skills | 项目资产 | 入口、manifest、所需文件、启动发现 | 单件注册 → pi 集成 → Electron 工具链路 |
| Electron/Node 生产依赖 | 运行壳 | production dependency、asar/unpack、native 模块 | build/package 目录断言 → 启动 smoke |
| OCR Python/RapidOCR | 可选本地 adapter | 来源、许可证、体积、运行时/模型、可再分发性 | 确认后才下载/装配；否则固定失败与恢复指引 |
| whisper.cpp CLI/model | 可选本地 adapter | 来源、许可证、模型、平台/体积、安全哈希 | 确认后才下载/装配；否则 S7 明确不可用/不阻塞其他学习 |
| SAPI / edge-tts | OS 内置 / 可选 skill | SAPI 可用性，edge-tts 网络/许可边界 | SAPI 优先；可选项必须降级 |
| WPS COM | 外部不可再分发依赖 | WPS/Office 授权与 ProgID 探测 | 不随包；旧格式转换显示明确可选状态，不阻塞其它格式 |
| AI provider / SMTP / 飞书 | 用户凭证与外部服务 | 仅配置模板、DPAPI vault、mock 与失败状态 | 不包含真实 credential/endpoint；验证可解释状态与受控 fake |

## 6. RED → GREEN → REFACTOR 步骤

1. **盘点（阶段 1）**：不读旧安装器，读取源码、lockfile、`package.json`、electron-builder 配置、构建脚本、运行时入口、既有组件测试和 `docs/traceability`；建立受管依赖清单及“随包/OS 内置/可选外部/禁止随包”分类。记录许可证、来源、版本、体积、完整性和更新责任。
2. **RED（阶段 2/3 前）**：先增加失败的 manifest/packaging/runtime probe 测试，覆盖 pi 扩展装配、受管路径解析、遗漏依赖、离线降级、UI 脱敏和构建产物运行；保存首次失败日志到运行根。
3. **GREEN（阶段 2-4）**：仅实现使当前 RED 通过的最小 manifest、运行时解析/注入、打包资源声明和错误/恢复 UI；每个新增组件经过单件→pi/adapter 集成→主仓装配。
4. **REFACTOR**：在定向测试全绿后统一命名、状态、错误净化和清单结构；不扩大为发布功能或设置页重构。
5. **阶段 5**：执行受影响真实 Electron E2E；真实 Electron + 全新隔离数据根 UAT 验证可用/降级/重启回读；再完整质量门、独立双审查和受控收尾。

## 7. 测试、UAT 与质量门

### 自动化

- 定向：新增 `T-M5-006-*` 单元、集成、构建产物/运行时和真实 Electron E2E；外部 AI/SMTP/飞书/WPS/OCR/whisper 仍用受控 fake 或单件真实组件（仅在已合法装配后）。
- 全量：同一 PowerShell 进程先确认 Node `v24.14.0`、pnpm `11.20.0`，再运行 `pnpm type-check`、`pnpm build`、`pnpm test`、`pnpm smoke`、`node scripts/verify.mjs --stage=full`、文档治理、契约覆盖、桌面安全、UUID 泄漏检查（若脚本存在）和 `git diff --check`。

### 真机 UAT（硬门槛）

- 使用真实 Electron 和新的 `H:\pi-studybuddy-tmp\runs\T-M5-006\uat\` 数据根；不 seed、不注入、不直调 RPC/handler/数据库。
- 完全经可见 UI：首次进入设置/能力状态，验证 pi/模型未配置的可解释状态、离线 TTS 或失败恢复、OCR/whisper/WPS 缺失时的固定中文提示和不影响其它闭环的行为；对本任务新增的可见安装资产路径，覆盖创建/使用/重启回读。
- 为每步保存脱敏 DOM、截图和 JSON；检查不含完整 UUID、绝对路径、file URI、凭据、资料原文或堆栈。

## 8. 预计修改类别（以 RED 结果为准）

- `package.json` / electron-builder 或专用 runtime manifest、构建脚本；
- `src/main`、`src/agent-host`、adapter 与设置状态（仅依赖发现/注入/降级）；
- `tests/`、真实 Electron E2E、UAT 自动化辅助（不得替代原生 UAT）；
- `docs/traceability/` 的本任务消费证据，以及必要时 01/03/08/09/13 的说明性更新；
- `.record/T-M5-006-实施记录.md`（收尾时）。

任何新增 API/schema/handler 或用户可见业务能力，先停止并请求裁决。

## 9. 完成判据与 Git 约束

完成本地实施不等于任务 done。仅当五阶段、完整质量门、真机 UAT、两名独立审查、`docs/04`、实施记录和计划状态均完成时，才能申请收尾。本次用户已明确授权当前受控治理改动显式暂存、提交并推送任务分支；不得因此执行 master ff-only 合并、生成 setup 或提前结束 T-M5-006。后续功能改动仍须按各自测试和收尾门禁处理。
