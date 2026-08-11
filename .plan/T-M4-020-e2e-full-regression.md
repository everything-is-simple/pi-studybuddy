# 任务计划：T-M4-020 E2E 全链回归

**任务 ID**：T-M4-020
**标题**：E2E 全链回归（后端断裂修复 + 设置页/学期切换 + S1-S7 接线）
**日期**：2026-08-11
**状态**：✅ 已批准并实施完成（本地实施、定向验收、真实 Electron E2E、完整质量门通过；Git 收口待用户单独授权）
**关联文档**：08-Test §5/§6/§7 + 09-UI §11 + 04-Todo §6.6 + 06-API §3 + 07-WF §2-§5
**里程碑**：M4 业务接线 + 打包部署
**优先级**：P4
**治理阶段**：阶段 5（冒烟 + E2E）
**用户授权**：用户明确选择 T-M4-020（2026-08-11"计划 T-M4-020"）；T-M4-020 prompt 资产已就绪 v0.1.96；待用户批准本计划与三项设计决策后实施
**集成基线**：master=origin/master=11ba50e（T-M4-019 Git 收口事实核验，04-Todo v0.1.139）
**实施分支**：agent/T-M4-020-e2e-full-regression（待计划批准后建立）
**集成分支**：master
**测试运行根**：H:\pi-studybuddy-tmp\runs\T-M4-020\

---

## 1. 任务目标

### 做什么
建立并执行 M4 真实 Electron 全链回归：补齐 renderer 层 E2E 覆盖缺口（S1 首页 / S2 资料 / 设置页 / 学期课程切换），与既有 8 个 renderer E2E + 13 个 RPC E2E 共同构成 M4 全链回归；执行完整 `verify --stage=full` 并以缺陷修复与回归证明为目的，不扩大产品功能。

### 为什么
M4 退出门槛（04-Todo §6.6）要求"全链 E2E 回归通过（E2E-01~13 + 新增后端断裂修复/设置页/学期切换 E2E）"。当前 renderer E2E 已覆盖 notes/practice/mistakes/cram/report/capture/tts/backup 八个 Tab，但 **首页（S1）、资料（S2）、设置页（T-M4-006）、学期/课程切换（T-M4-007）尚无 renderer 层 E2E**——这是 M4 收官验收（T-M4-021）前的最后一项质量门任务。

### 依据
- 08-Test §5（安全不变量）+ §6（E2E 框架：真实 Electron + 127.0.0.1 TCP）+ §7（断言矩阵）
- 09-UI §11（安全隐私 UI 边界：不展示 UUID/API key/真实地址/错误栈）
- 04-Todo §6.6（M4 退出门槛：全链 E2E 回归 + 安全不变量 6/6 + UUID 7/7）
- 07-WF §2-§5（S1-S7 主路径）+ 06-API §3（RPC 契约）
- T-M4-020 prompt 资产（范围与验收主题；非目标：不引入新功能、不把假阳性当验收、不以覆盖率数字为唯一目标）

## 2. 范围与非目标

### 范围
1. **新增 renderer E2E（真实 Electron + 隔离 fixture + 启动前预置数据，覆盖回归缺口）**：
   - `tests/e2e/t-m4-020-home-renderer.test.ts`：S1 首页主路径——预置学期+课程+考试/任务 → 首页 dailyBrief/tasks/exams 展示 + 课程门控 + 隐私断言
   - `tests/e2e/t-m4-020-materials-renderer.test.ts`：S2 资料主路径——SQL 预置资料 + 受控 storage 文件 → materials.list 展示 → convert 成功（text 夹具确定性）→ 归档只读（决策 2）
   - `tests/e2e/t-m4-020-settings-renderer.test.ts`：设置页主路径——settings.get/getSimpleMode + models.list/modelsConfig.get + credentials.listKeys（隔离根为空断言）+ toolchains.list + 返回工作台（决策 1）
   - `tests/e2e/t-m4-020-semester-switch-renderer.test.ts`：学期/课程切换 + 归档只读——预置两个学期 → 左侧栏切换学期 → 各 Tab 数据刷新 + 归档学期只读提示（决策 3）
2. **回归执行与证据**：`verify --stage=full` 全量（unit/integration 118 files + 真实 Electron E2E 24+4 files）+ contract 127/127 + 安全 6/6 + smoke 6/6 + UUID 7/7 + docs 治理 + `git diff --check` + 双维度独立审查证据。
3. **生产缺陷修复（如回归发现）**：最小化、先 RED、保留影响证据（08-Test §11.3 修复记录）；仅修复 fixture、测试 adapter 与确定性等待类问题除外。
4. **治理同步**：`.plan/00-当前任务.md`、`docs/04-Todo`（in_progress 登记 + v0.1.140）、`docs/00-索引`（v0.1.144）、收尾时 `.record/T-M4-020-实施记录.md`。

### 非目标（不做什么）
- **不引入未完成 Tab 的新功能**；不新增产品功能/API/schema（发现需要时停止并按缺陷单独裁决）
- 不把 E2E 假阳性通过当作验收；不以覆盖率数字为唯一目标
- 不改写既有 8 个 renderer E2E / 13 个 RPC E2E 的验收语义（仅按需修复 fixture/确定性等待）
- 不触碰真实业务数据根 / 真实密钥（设置页 E2E 仅隔离根 + 空凭证断言）；不连接真实外部服务
- 不做安装包/签名冒烟（属 T-M4-021）
- 不启动 T-M4-021

## 3. 文件清单

### 将创建的文件
| 文件路径 | 用途 |
|---|---|
| `tests/e2e/t-m4-020-home-renderer.test.ts` | S1 首页 renderer E2E（dailyBrief/tasks/exams + 门控 + 隐私） |
| `tests/e2e/t-m4-020-materials-renderer.test.ts` | S2 资料 renderer E2E（list + 受控 convert + 归档只读） |
| `tests/e2e/t-m4-020-settings-renderer.test.ts` | 设置页 renderer E2E（settings/models/credentials.listKeys/toolchains + 返回） |
| `tests/e2e/t-m4-020-semester-switch-renderer.test.ts` | 学期/课程切换 renderer E2E（多学期切换 + 归档只读提示） |
| `.record/T-M4-020-实施记录.md` | 收尾时创建（8 章节） |

### 将修改的文件
| 文件路径 | 修改内容 |
|---|---|
| `.plan/00-当前任务.md` | 指向本计划 |
| `docs/04-任务清单-Todo-List.md` | T-M4-020 pending→in_progress + 版本历史 v0.1.140 + §9 统计 |
| `docs/00-文档索引-Index.md` | 版本历史 v0.1.144 + 任务状态行同步 |
| 生产 src/（如回归发现缺陷） | 最小化修复 + §8 修复记录（08-Test §11.3） |

> 若回归发现既有 E2E fixture 失效（非产品缺陷），允许最小修复测试 fixture/确定性等待并登记影响证据。

## 4. 接口设计

### RPC 方法（复用既有，不新增；06-API §3）
- S1 首页：`tasks.dailyBrief({ semesterId })` + `tasks.list({ courseId })` + `exams.list({ courseId })`（host 已装配 T-M4-001/010）
- S2 资料：`materials.list({ courseId })` + `materials.convert({ id })` + `materials.retryConversion({ id })`（host 已装配 T-M1-002/007/011）
- 设置页：`settings.get` / `settings.getSimpleMode` / `settings.setSimpleMode` / `models.list` / `modelsConfig.get` / `credentials.listKeys({ prefix })` / `toolchains.list`（host 已装配 T-M4-003/006）
- 学期/课程：`semesters.list` / `courses.list({ semesterId })` / 归档学期派生只读（AppShell T-M4-007/008）

### 数据表（不涉及）
无新增/修改表；E2E 以 S1/S2 handler + 启动前 SQL 预置隔离 fixture（对齐 t-m4-012 先例）。

## 5. 测试策略

### 新增 renderer E2E（阶段 5b，真实 Electron + 127.0.0.1 TCP + 启动前隔离预置）
| 文件 | 覆盖主路径 | 关键断言 |
|---|---|---|
| `t-m4-020-home-renderer.test.ts` | 首页 dailyBrief/tasks/exams | 简报/任务/考试展示；无 courseId 门控提示；DOM 无完整 UUID/路径/栈 |
| `t-m4-020-materials-renderer.test.ts` | 资料 list + 受控 convert | 资料列表展示；convert 成功 status=converted；归档学期只读提示 + 操作禁用；隐私断言 |
| `t-m4-020-settings-renderer.test.ts` | 设置页主路径 | settings.get 默认值 + getSimpleMode；models.list 空 + modelsConfig.get 默认；credentials.listKeys 隔离根为空；toolchains.list 加载；返回工作台 |
| `t-m4-020-semester-switch-renderer.test.ts` | 学期/课程切换 | 两个学期预置 → 切换 → 各 Tab 数据刷新；归档学期只读提示；无敏感内部值 |

### 回归执行（阶段 5 全量）
- [ ] `pnpm test`：unit/integration/security 118 files 全绿（基线不回归）
- [ ] `pnpm test:e2e`：真实 Electron E2E 24 + 4 新文件全绿
- [ ] `pnpm verify -- --stage=full`：contract 127/127 + 安全 6/6 + smoke 6/6 + UUID 7/7 + docs 治理 + diff-check
- [ ] 双维度独立审查（功能/契约 + 治理/安全）无遗留 P0/P1

### 安全不变量（如涉及）
- [ ] E2E 断言 DOM 无完整 UUID / Windows 路径 / POSIX 路径 / file URI / 错误栈 / 密钥（09-UI §11.1 + AGENTS.md §9.3）
- [ ] 数据根隔离：E2E 全部写入 `H:\pi-studybuddy-tmp\runs\T-M4-020\`，不触碰 `%LOCALAPPDATA%\PiStudyBuddy`
- [ ] 设置页 E2E 不读写真实密钥（仅隔离根空凭证断言）

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | 不涉及 |
| 2. 单件测试 | 不涉及（回归类任务） |
| 3. 集成测试 | 不涉及（既有覆盖） |
| 4. 系统组装 | 不涉及（无新业务代码；如回归发现缺陷则最小修复） |
| 5. 冒烟 + E2E | ✅ 核心：4 个新 renderer E2E + 全量回归 + verify full |

## 7. 依赖关系

### 前置任务
- [x] T-M4-019：备份恢复面板 RPC 接线（done；执行序 38，master=origin/master=11ba50e）
- [x] T-M4-005~017：后端断裂修复 + 设置页/学期切换/AppShell + S1-S7 全部接线（done；回归对象）
- [x] T-M4-018：TTS 控制条 RPC 接线（done；回归对象）
- [x] T-M4-009：electron-builder 配置（done；T-M4-021 打包冒烟依赖）
- [x] T-M4-022/023/024：真实 Electron 运行时 + 交叉审查修订 + 模型 provider（done；E2E 底座）

### 组件依赖
- [x] 真实 Electron 36.9.5 + 127.0.0.1 TCP E2E harness（T-M4-022 确立）
- [x] 既有 renderer E2E 8 文件 + RPC E2E 13 文件（回归基线）

## 8. 预期产物

### 代码
- `tests/e2e/t-m4-020-home-renderer.test.ts` / `t-m4-020-materials-renderer.test.ts` / `t-m4-020-settings-renderer.test.ts` / `t-m4-020-semester-switch-renderer.test.ts`
- 生产缺陷最小修复（如回归发现）

### 文档更新
- `docs/04-Todo`（v0.1.140：T-M4-020 in_progress + §9 统计 + 版本历史）
- `docs/00-索引`（v0.1.144：版本历史 + 任务行同步）
- 08-Test §8/§11.3 修复记录（如回归发现缺陷）

### 实施记录
- `.record/T-M4-020-实施记录.md`（受控收尾时创建）

## 9. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（08-Test §5/§6/§7 + 09-UI §11 + 04-Todo §6.6）
- [x] 步骤 2：检查文档门禁（04-Todo v0.1.139 done、单一任务门禁满足）
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [x] 步骤 4：独立审查计划（实施者审阅后提交用户批准）。
- [x] 步骤 5：用户批准计划（2026-08-11“批准”；裁决 1A/2A/3A）。
- [x] 步骤 6：拆分任务、逐项实现（隔离分支 agent/T-M4-020-e2e-full-regression）。
- [x] 步骤 7：编写或更新测试（TDD：home E2E RED 失败 → 修复 → 4 文件全绿 6 tests）
- [x] 步骤 8：type-check
- [x] 步骤 9：build
- [x] 步骤 10：test（全量 unit/integration 118 files/1130 tests 不回归）
- [x] 步骤 11：smoke / E2E（smoke 6/6；全量真实 Electron E2E 28 files/136 tests；verify full 通过）
- [x] 步骤 12：独立审查并修复（双维度；无 P0/P1；生产 S2Context extractor 边界登记不属本任务范围）
- [x] 步骤 13：更新 04-Todo（v0.1.141）+ 文档（00-索引 v0.1.145）
- [x] 步骤 14：文档治理检查（OK）
- [x] 步骤 15：diff 检查（git diff --check 通过）
- [ ] 步骤 16：提交交付（★ 用户 Git 收口授权）

## 10. 质量门与数据隔离

- Node 基线：`C:\node-v24.14.0-win-x64\node.exe --version` → v24.14.0；`pnpm --version` → 11.20.0（AGENTS.md §10，执行前 `$env:Path` 前置）
- 定向新 E2E → `pnpm type-check` → `pnpm build` → `pnpm test` → `pnpm test:e2e` → `pnpm verify -- --stage=full`
- 不回归基线：master 基线 118 files/1130 tests（unit/integration）+ 24 files/130 tests（真实 Electron E2E）+ contract 127/127 + 安全 6/6 + smoke 6/6 + UUID 7/7 + docs 治理 + `git diff --check`
- 所有运行数据/Electron user-data/SQLite/日志写入 `H:\pi-studybuddy-tmp\runs\T-M4-020\`；禁止写 `%LOCALAPPDATA%\PiStudyBuddy`；不连真实外部服务/真实密钥

## 11. 需用户裁决的设计决策

| # | 决策 | 方案 A（推荐） | 方案 B |
|---|---|---|---|
| 1 | 设置页 E2E 密钥断言范围 | **仅 credentials.listKeys（隔离根为空断言），不触碰真实密钥**（对齐 AGENTS.md §9.2 密钥边界） | 尝试真实 vault 写读往返（涉真实数据根，违反 §5.3/§9.2，不推荐） |
| 2 | S2 资料 E2E 覆盖方式 | **SQL 预置资料 + 受控 storage 文件 → list/convert 主路径**（不驱动原生上传对话框，最小 footprint，不动 MaterialsTab） | 为 upload 新增 renderer 测试 seam（需改业务组件，超出回归最小原则） |
| 3 | 学期切换 E2E 覆盖 | **多学期切换 + 归档只读提示**（预置两学期，验证切换后各 Tab 数据刷新 + 归档只读） | 仅单学期（覆盖弱，不验证切换语义） |

## 12. 明确停止条件

- 回归中发现需要新增产品功能/API/schema 的缺陷 → 停止并按缺陷单独裁决（任务提示词明确）
- 真实 Electron 无法启动、Node 非 v24.14.0、工作区归属无法区分（不得混入 pi-session html 等用户 dirty 文件）
- 用户未批准本计划或未授权实施

本计划只允许本地实施与治理证据同步；未经用户另行明确授权不得 `git add`、`git commit`、`git merge`、`git push`。

---

## 审查记录

（步骤 4 独立审查）计划由实施者审阅后提交用户批准：范围仅补齐 renderer E2E 覆盖缺口（首页/资料/设置页/学期切换）+ 全量回归执行 + 最小缺陷修复，不引入新功能/API/schema；三项设计决策已明确（设置页凭证断言范围/资料覆盖方式/学期切换覆盖）。用户 2026-08-11 回复“批准”，计划按推荐方案 A 生效（裁决 1A/2A/3A）。

## 完成记录

（步骤 5 收尾时填写）
- 完成日期：2026-08-11（本地实施与验收；Git 收口待授权）
- 实施记录：.record/T-M4-020-实施记录.md
- 状态：✅ 已批准并实施完成（本地）；Git 收口待用户单独授权
- 验收证据：RED（home E2E taskType CHECK）→ 修复 → GREEN；新增 4 renderer E2E 6 tests；全量 unit/integration 118 files/1130 tests；真实 Electron E2E 28 files/136 tests；`verify --stage=full` 通过（contract 127/127 + 8 PiBridge + 35 tools、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）
