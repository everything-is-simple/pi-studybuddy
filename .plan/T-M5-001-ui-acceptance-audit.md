# T-M5-001 全 UI/功能/依赖用户验收审计与追踪矩阵

**状态**：执行中
**日期**：2026-08-12
**里程碑**：M5 用户可用性验收 + UI 修订 + 一键交付
**实施分支**：`agent/T-M5-001-ui-acceptance-audit`
**测试运行根**：`H:\\pi-studybuddy-tmp\\runs\\T-M5-001\\`
**集成基线**：`master=origin/master=869de2f`

## 1. 裁决与范围

用户明确要求从真实用户能够正常使用出发，逐页、逐按钮核验 UI、功能、设计偏差和部署依赖；发现缺口后由后续 M5 任务修订。本任务是审计任务，不实现业务修复。

### 纳入范围

- 读取 01-TRD、07-Workflow、08-Test、09-UI 与当前 M5 退出门槛。
- 盘点 renderer 的所有页面、Tab、左栏、设置、TTS、备份、会话、对话和可见控件。
- 对照 handler/API、已有单元/集成/真实 Electron E2E 证据，区分“已实现”“仅静态展示”“仅测试夹具”“未接线”“未验证”。
- 核验当前 x64 setup 的打包清单、安装启动证据和必需外部运行依赖边界。
- 建立可供 T-M5-002~008 使用的逐项追踪矩阵、P0/P1/P2 差异清单和验收证据清单。

### 明确不纳入

- 不修复 `src/`、`tests/`、打包配置或 API/schema。
- 不创建或修改 T-M5-002~008 的详细计划，不切换其他任务。
- 不连接真实 AI、SMTP、飞书、WPS、OCR 或 whisper 外部服务；只审计依赖声明和已有受控证据。
- 不把 `tests/e2e` 的 fixture 注入路径、静态 `renderToStaticMarkup` 或 `semesters.create` 代表性 RPC 计为完整用户验收。
- 不读取、记录或提交真实凭证、学生资料、完整 UUID 或真实业务数据。

## 2. 证据顺序

设计条款 → 页面/控件 ID → 生产实现位置 → API/本机能力 → 已有测试证据 → 当前缺口 → 后续任务归属。

每个控件至少标记：

- `implemented`: 生产 UI 存在且行为有真实运行证据。
- `static-only`: 只在无 RPC 静态 props 或展示组件中存在。
- `fixture-only`: 仅依赖测试注入、固定 ID 或受控 fixture。
- `wired-unverified`: 生产调用已存在，但无真实安装应用证据。
- `missing`: 设计要求或用户必要路径缺少入口/行为。
- `blocked`: 依赖或前置业务缺失，无法合理验收。

## 3. 预期产物

- `docs/09-使用者介面-UI-Design.md` 或任务记录中引用的 UI 条款与实现差异摘要。
- `.record/T-M5-001-实施记录.md`，包含 8 章节：裁决范围、实际审计结果、偏差、根因、决定依据、测试证据、Git 证据、未解决事项。
- `H:\\pi-studybuddy-tmp\\runs\\T-M5-001\\ui-function-dependency-matrix.md`：逐页/逐控件追踪矩阵，测试运行数据不进 Git。
- `H:\\pi-studybuddy-tmp\\runs\\T-M5-001\\gap-register.md`：P0/P1/P2 缺口及后续任务映射。
- `H:\\pi-studybuddy-tmp\\runs\\T-M5-001\\package-dependency-audit.md`：setup/zip 文件清单、运行依赖、不可再分发依赖与支持边界。
- 如执行真实安装包复验，产物只落 `H:\\pi-studybuddy-tmp\\runs\\T-M5-001\\`，并记录脱敏摘要、版本、SHA-256、体积和退出结果。

## 4. RED → GREEN → REFACTOR

本任务无业务实现；RED/GREEN 体现在审计断言：

1. RED：先用静态扫描和代码/测试对照列出设计要求但无生产证据的页面、控件、固定 fixture、占位和未验证依赖。
2. GREEN：补齐矩阵中每一项的生产位置、已有证据、缺口等级和后续任务归属；不以“代码存在”替代行为证据。
3. REFACTOR：去重差异，复核 P0/P1 分类、编号连续性、M5 任务覆盖和敏感信息脱敏。

## 5. 验收清单

- [x] 00-09、AGENTS、M5 登记和当前任务计划一致。
- [x] 10 个主 UI 面：Chat、Home、Materials、Notes、Practice、Mistakes、Cram、Report、Capture、Backup，以及 Settings、左栏、TTS、上下文/状态栏全部有矩阵行。
- [x] 每个可见按钮、输入、选择器、开关和文件对话框有控件级行；成功、禁用、失败、重试/取消语义分别标记。
- [x] 明确区分真实生产路径与 `initial*` props、`__PI_*_FIXTURE__`、固定 `sess-001`/`mist-001` 等测试语义。
- [x] 明确列出当前空白数据根是否能只靠 UI 创建学期、课程、考试和任务；不能则登记 P0。
- [x] 明确列出所有静默 catch、占位文案、固定状态栏/上下文、不可达设计入口及其后续任务。
- [x] 审计 setup/portable zip 当前是否包含 OCR/Python/whisper/WPS 等必需能力；不能证明则登记 P0/P1，不猜测可分发许可。
- [x] Node24.14.0/pnpm11.20.0 质量门和 `git diff --check` 通过；不执行 Git 收口。
- [x] 两份独立审查（实现/UX、打包/验收）已依据矩阵复核审计结论；P0/P1 保持未关闭，本任务不得报告 M5 完成。

## 6. 受控命令

当前 PowerShell 质量门前置：

```powershell
$env:Path = "C:\\node-v24.14.0-win-x64;$env:Path"
node --version
pnpm --version
```

计划内命令：

```powershell
pnpm type-check
pnpm test
pnpm test:e2e
pnpm build
pnpm package:win
pnpm verify -- --stage=full
node scripts/check-docs-governance.mjs
node scripts/check-contract-coverage.mjs
node scripts/check-desktop-security.mjs
node scripts/check-uuid-leak.mjs
 git diff --check
```

若运行打包/安装复验，必须设置 `PI_STUDYBUDDY_PACKAGE_TASK_ID=T-M5-001` 和 `PI_STUDYBUDDY_PACKAGE_RUN_DIR=H:\\pi-studybuddy-tmp\\runs\\T-M5-001`，不得使用真实数据根。

## 7. 停止条件

- 发现需要业务修复时，记录缺口并停止修改代码，归属 T-M5-002~008。
- 发现文档冲突时，只记录冲突并请求用户裁决；不删除历史决策。
- 发现安装包无法证明依赖自包含时，记录为 M5-006/M5-008 阻塞；不声称“一键安装”已达成。
- 审计矩阵和双独立审查完成后停止，等待用户选择下一个 M5 任务。
