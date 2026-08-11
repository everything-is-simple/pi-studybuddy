# 任务计划：T-M4-021 M4 收官验收 + 打包冒烟

**任务 ID**：T-M4-021
**标题**：M4 收官验收 + 打包冒烟（安装 + 启动 + RPC 往返 + 安全不变量）
**日期**：2026-08-11
**状态**：✅ 已批准并实施完成（本地实施、定向验收、真实 Electron E2E、完整质量门通过；Git 收口待用户单独授权）
**关联文档**：01-TRD §7 决策 6 + 04-Todo §6.6 + 08-Test §5/§5.7/§6 + 09-UI §11 + 06-API §3
**里程碑**：M4 业务接线 + 打包部署（收官）
**优先级**：P4
**治理阶段**：阶段 5（冒烟 + E2E）
**用户授权**：用户明确选择 T-M4-021（2026-08-11"收官验收"；prompt 资产已就绪 v0.1.96）；待用户批准本计划与两项设计决策后实施
**集成基线**：master=origin/master=dda2a54（T-M4-025 Git 收口事实核验，04-Todo v0.1.147）
**实施分支**：agent/T-M4-021-m4-release-acceptance（待计划批准后建立）
**集成分支**：master
**测试运行根**：H:\pi-studybuddy-tmp\runs\T-M4-021\

---

## 1. 任务目标

### 做什么
完成 M4 最终发布验收：在**干净 master** 上重新构建 x64 NSIS 安装包（当前 master 已含 T-M4-009 之后全部代码与 T-M4-025 修复），隔离静默安装，至少两次启动，经 CDP 受控 piBridge 验证 installed app 的 renderer/preload/system.ping/global.db/代表性 RPC 往返与安全不变量；逐条对照 M4 退出门槛（04-Todo §6.6）并汇总发布证据矩阵。

### 为什么
M4 里程碑最后一个任务。T-M4-009 完成首次打包验证，但其后 master 发生了大量变更（S1-S7 接线/TTS/备份/回归 E2E/T-M4-025 extractor 修复），**必须重新构建当前 master 的安装包**并完成最终发布验收，M4 退出门槛才可宣告全部达成；用户明确指令"收官验收"。

### 依据
- 01-TRD §7 决策 6 v0.2.3（打包能力常态化：源码形态可运行 + x64 setup 能力）
- 04-Todo §6.6（M4 退出门槛 8 项）
- 08-Test §5（安全不变量）+ §5.7（桌面安全校验）+ §6（E2E）
- T-M4-021 prompt 资产（范围与验收主题；非目标：不实现新功能/不绕过签名安装安全失败/不因打包成功忽略实际启动或 RPC 失败）

## 2. 范围与非目标

### 范围
1. **重新构建 x64 安装包**（干净 master，Node24/pnpm11 基线）：`pnpm package:win`（electron-builder 26.15.3 NSIS x64）→ 产物 SHA-256 记录
2. **隔离静默安装**：`setup.exe /S` 安装到隔离目录（对齐 T-M4-009/T-M4-011 target-machine 先例）
3. **至少两次启动 + 全链验证**（复用/扩展 `scripts/package-smoke.mjs` CDP 模式）：installed app → renderer → preload piBridge → system.ping → global.db 建库 → 代表性业务 RPC（如 semesters.create / materials.list / tasks.dailyBrief 之一）往返；运行期环境变量全部指向 `runs\T-M4-021\`（数据根隔离）
4. **验收证据自动化**（决策 2）：新增 `tests/e2e/t-m4-021-release-acceptance.test.ts`——编排 构建→安装→两次启动→CDP 全链断言→SHA-256→验收证据矩阵输出；`scripts/package-smoke.mjs` 扩展支持 T-M4-021 run dir（或复用 env 参数）
5. **M4 退出门槛逐条对照**（04-Todo §6.6 8 项）+ 双维度独立审查 + 发布证据矩阵（质量门数据/安装包哈希/启动/RPC/安全/UUID/文档治理）
6. **治理同步**：`.plan/00-当前任务.md`、`docs/04-Todo`（登记 + v0.1.148）、`docs/00-索引`（v0.1.152）、收尾时 `.record/T-M4-021-实施记录.md` + 04-Todo §6.6 门槛全勾选

### 非目标（不做什么）
- **不在收官阶段实现新功能**；不新增产品/API/schema
- 不绕过签名/安装/安全失败（安装失败、启动失败、RPC 失败必须如实暴露，不得以"构建产物存在"代替验收）
- 不执行真实用户数据备份/恢复或触碰 `%LOCALAPPDATA%\PiStudyBuddy` / 真实密钥（安装验证全部用隔离根）
- 不自动 commit/merge/push/发布——本任务所有 Git 与发布动作仍需用户单独授权
- 不重跑全部单元/E2E（T-M4-020 全量回归已通过；本任务聚焦打包冒烟 + 门槛对照）

## 3. 文件清单

### 将创建的文件
| 文件路径 | 用途 |
|---|---|
| `tests/e2e/t-m4-021-release-acceptance.test.ts` | 收官验收 E2E：构建→安装→两次启动→CDP 全链断言→SHA-256→证据矩阵（决策 2A） |
| `.record/T-M4-021-实施记录.md` | 收尾时创建（8 章节） |

### 将修改的文件
| 文件路径 | 修改内容 |
|---|---|
| `scripts/package-smoke.mjs` | 支持 T-M4-021 run dir / TASK_ID 参数化（如需要，最小化） |
| `.plan/00-当前任务.md` | 指向本计划 |
| `docs/04-任务清单-Todo-List.md` | T-M4-021 pending→in_progress + 版本历史 v0.1.148 + §9 统计；收尾时 §6.6 退出门槛全勾选 |
| `docs/00-文档索引-Index.md` | 版本历史 v0.1.152 + 任务行同步 |

## 4. 接口设计

### 验证通道（复用 T-M4-009 先例，无新 API）
- `pnpm package:win` → `dist/*.exe`（NSIS x64 setup）
- 隔离安装：`setup.exe /S /D=<isolated-dir>`（对齐 T-M4-011 target-machine 先例）
- installed app 验证：Chrome DevTools Protocol（仅监听 127.0.0.1）→ renderer `window.piBridge` → `system.ping` / `semesters.create`（代表性业务 RPC）→ `global.db` 断言（`%LOCALAPPDATA%` 隔离根内）
- 环境变量：`PI_STUDYBUDDY_DATA_ROOT` / `PI_STUDYBUDDY_PACKAGE_RUN_DIR` / `PI_STUDYBUDDY_PACKAGE_APP` 全部指向 `runs\T-M4-021\`

### 数据表（不涉及）
无新增/修改表；验收仅读全局库/隔离根。

## 5. 测试策略

### 收官验收 E2E（阶段 5b，`tests/e2e/t-m4-021-release-acceptance.test.ts`）
- [ ] 构建：`pnpm package:win` 成功 → 存在 x64 NSIS setup → 记录 SHA-256（对齐 T-M4-011 `C3D09869...` 先例）
- [ ] 安装：静默安装到隔离目录 exit 0
- [ ] **两次启动**（决策：至少两次，T-M4-021 prompt 要求）：第一次启动 → CDP 验证 renderer/preload piBridge 就绪 + system.ping 往返 + global.db 建库 + 代表性业务 RPC（semesters.create）往返；退出 → 第二次启动 → 幂等验证（既有学期数据仍在 + 再次 RPC）
- [ ] 隐私/安全断言：运行日志与返回载荷无完整 UUID/路径/密钥/错误栈
- [ ] 证据矩阵：质量门数据（unit 118/1130、E2E 28/136、contract 127/127、安全 6/6、smoke 6/6、UUID 7/7）+ 安装包哈希 + 启动/RPC 结果汇总

### M4 退出门槛逐条对照（04-Todo §6.6，收尾时勾选）
| # | 门槛 | 证据 |
|---|---|---|
| 1 | 后端 5 处断裂全部修复 | T-M4-001~005 done（生产 handler 装配/extension-loader/真实 agent.send/global.db/credentials+settings） |
| 2 | 设置页可用 | T-M4-006 done（E2E t-m4-020-settings-renderer 通过） |
| 3 | 学期/课程切换 UI 可用 | T-M4-007/008 done（E2E t-m4-020-semester-switch 通过） |
| 4 | S1-S7 全部业务 Tab 前端 RPC 接通 | T-M4-010~017 done（8 个 renderer E2E 通过） |
| 5 | TTS 控制条 + 备份恢复面板接通 + BackupPanel 可达 | T-M4-018/019 done（E2E t-m4-018/019 通过） |
| 6 | 全链 E2E 回归通过 | T-M4-020 done（28 files/136 tests 全绿） |
| 7 | electron-builder x64 setup 产出 + 安装冒烟 | T-M4-009 + **本任务 T-M4-021 最终复验** |
| 8 | 安全不变量 6/6 + UUID 7/7 | check-desktop-security 6/6 + check-uuid-leak 7/7（master verify full 通过） |

### 回归
- [ ] `pnpm test` / `pnpm test:e2e` 既有 28 files 不回归（本任务仅新增验收 E2E）
- [ ] `pnpm verify -- --stage=full`：contract/security/smoke/UUID/docs/diff 全绿（master 复验）

### 安全不变量（如涉及）
- [ ] 验收过程全部隔离根；无密钥/路径/UUID 泄漏；SHA-256 记录可审计

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | 不涉及 |
| 2. 单件测试 | 不涉及（验收类任务） |
| 3. 集成测试 | 不涉及（既有覆盖） |
| 4. 系统组装 | 不涉及（无新业务代码；如验收发现缺陷则最小修复 + RED） |
| 5. 冒烟 + E2E | ✅ 核心：打包冒烟 + 两次启动全链验收 + 门槛对照 + 证据矩阵 |

## 7. 依赖关系

### 前置任务
- [x] T-M4-025：生产 S2Context extractor 注入（done；master=origin/master=dda2a54）
- [x] T-M4-020：E2E 全链回归（done；28 files/136 tests 基线）
- [x] T-M4-009：electron-builder 配置 + 首次 x64 setup（done；package:win/package-smoke 基建）
- [x] T-M4-001~019/022~024：M4 全部业务/修复/运行时任务（done）

### 组件依赖
- [x] electron-builder 26.15.3（NSIS x64，01-TRD §7 决策 6 v0.2.3）
- [x] scripts/package-smoke.mjs（T-M4-009 CDP 全链验证模式）
- [x] 真实 Electron 36.9.5 安装产物

## 8. 预期产物

### 代码
- `tests/e2e/t-m4-021-release-acceptance.test.ts`
- `scripts/package-smoke.mjs`（T-M4-021 run dir 参数化，如需要）

### 文档更新
- `docs/04-Todo`（v0.1.148：T-M4-021 in_progress + §9 统计 + 版本历史；收尾 v0.1.149 门槛全勾选 + done）
- `docs/00-索引`（v0.1.152 + 收尾 v0.1.153）
- 发布证据矩阵（实施记录 §6）

### 实施记录
- `.record/T-M4-021-实施记录.md`（受控收尾时创建）

## 9. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（01-TRD §7 决策 6 + 04-Todo §6.6 + 08-Test §5/§5.7/§6）
- [x] 步骤 2：检查文档门禁（04-Todo v0.1.147 done、单一任务门禁满足）
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [x] 步骤 4：独立审查计划（实施者审阅后提交用户批准）。
- [x] 步骤 5：用户批准计划（2026-08-11“批准”；裁决 1A/2A）。
- [x] 步骤 6：拆分任务、逐项实现（隔离分支 agent/T-M4-021-m4-release-acceptance）。
- [x] 步骤 7：编写或更新测试（验收 E2E：RED 构建依赖网络失败 → ELECTRON_MIRROR + 缓存补齐 → GREEN）
- [x] 步骤 8：type-check
- [x] 步骤 9：build
- [x] 步骤 10：test（全量 unit/integration 118 files/1130 tests 不回归）
- [x] 步骤 11：smoke / E2E（package:win 构建 + 隔离安装 + 两次启动 CDP 全链；全量 E2E 29 files/137 tests；verify full 通过）
- [x] 步骤 12：独立审查并修复（双维度；深挖 electron-builder 依赖下载根因：winCodeSign/electron 缓存缺失 + GitHub CDN 不稳定）
- [x] 步骤 13：更新 04-Todo（v0.1.149 + §6.6 门槛全勾选）+ 文档（00-索引 v0.1.153）
- [x] 步骤 14：文档治理检查（OK）
- [x] 步骤 15：diff 检查（git diff --check 通过）
- [ ] 步骤 16：提交交付（★ 用户 Git 收口授权）

## 10. 质量门与数据隔离

- Node 基线：`C:\node-v24.14.0-win-x64\node.exe --version` → v24.14.0；`pnpm --version` → 11.20.0
- 验收执行：`pnpm package:win` → 静默安装 → `tests/e2e/t-m4-021-release-acceptance.test.ts` → `pnpm verify -- --stage=full`
- 不回归基线：master 基线 118 files/1130 tests（unit/integration）+ 28 files/136 tests（真实 Electron E2E）+ contract 127/127 + 安全 6/6 + smoke 6/6 + UUID 7/7 + docs 治理 + `git diff --check`
- 所有运行数据/安装目录/用户数据/日志写入 `H:\pi-studybuddy-tmp\runs\T-M4-021\`；禁止写 `%LOCALAPPDATA%\PiStudyBuddy`；不连真实外部服务

## 11. 需用户裁决的设计决策

| # | 决策 | 方案 A（推荐） | 方案 B |
|---|---|---|---|
| 1 | 安装包验证通道 | **CDP 受控 piBridge 全链**（复用 T-M4-009 package-smoke 模式：renderer→preload→system.ping→global.db→代表性业务 RPC 往返；127.0.0.1 回环，无公网） | 进程级仅启动存活检查（弱，不验证真实 RPC 链路） |
| 2 | 验收证据自动化 | **新增 E2E 测试文件自动化断言**（t-m4-021-release-acceptance.test.ts 可复跑：构建→安装→两次启动→全链→SHA-256→证据矩阵） | 一次性执行脚本 + 人工日志记录（不可复跑、证据弱） |

## 12. 明确停止条件

- 安装失败 / 安装后启动失败 / RPC 往返失败（不得以构建产物存在代替验收，必须如实暴露并修复）
- 发现需要新增产品/API/schema 的缺陷 → 停止并按缺陷单独裁决
- 真实 Electron 无法启动、Node 非 v24.14.0、工作区归属无法区分（不得混入 pi-session html 等用户 dirty 文件）
- 用户未批准本计划或未授权实施

本计划只允许本地实施与治理证据同步；未经用户另行明确授权不得 `git add`、`git commit`、`git merge`、`git push`。

---

## 审查记录

（步骤 4 独立审查）计划由实施者审阅后提交用户批准：范围仅 M4 收官验收——干净 master 重新构建 x64 setup + 隔离安装 + 至少两次启动 + CDP 全链验证 + M4 退出门槛逐条对照 + 发布证据矩阵；不实现新功能；不绕过安装/启动/RPC 失败；两项设计决策（验证通道 CDP 全链/证据自动化 E2E）已明确。用户 2026-08-11 回复“批准”，计划按推荐方案 A 生效（裁决 1A/2A）。

## 完成记录

（步骤 5 收尾时填写）
- 完成日期：2026-08-11（本地实施与验收；Git 收口待授权）
- 实施记录：.record/T-M4-021-实施记录.md
- 状态：✅ 已批准并实施完成（本地）；Git 收口待用户单独授权
- 验收证据：验收 E2E 通过——x64 setup `Pi StudyBuddy Setup 0.1.0.exe` SHA-256 `540AF6C715E8F946CD72D543BBED613AE7ED7E8BAAAF466AD82B42EA9245C617` + 隔离静默安装 + 两次启动 + CDP 全链验证（system.ping/global.db/业务 RPC）；§6.6 M4 退出门槛 8 项全勾选；全量 unit/integration 118 files/1130 tests；真实 Electron E2E 29 files/137 tests；`verify --stage=full` 通过（contract 127/127 + 8 PiBridge + 35 tools、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）
