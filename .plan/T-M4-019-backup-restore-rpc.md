# 任务计划：T-M4-019 备份恢复面板 RPC 接线 + TabBar 入口

**任务 ID**：T-M4-019
**标题**：备份恢复面板 RPC 接线 + TabBar 入口
**日期**：2026-08-11
**状态**：✅ 已批准并实施完成（本地实施、定向验收、真实 Electron E2E、完整质量门通过；Git 收口待用户单独授权）
**关联文档**：09-UI §6.1-§6.3 + 06-API §3.11/§4 + 07-WF §5 + 08-Test §5/§6.4/§7.6 + 03-Arch §6.7
**里程碑**：M4 业务接线 + 打包部署
**优先级**：P3
**治理阶段**：阶段 4（系统组装）
**用户授权**：用户明确选择 T-M4-019~021 序列继续（2026-08-11"下一个任务 T-M4-019~021 开始了 先做prompt 做plan"；T-M4-019 prompt 资产已就绪 v0.1.96）；待用户批准本计划与四项设计决策后实施
**集成基线**：master=origin/master=586d1f0（T-M4-018 Git 收口事实核验，04-Todo v0.1.136）
**实施分支**：agent/T-M4-019-backup-restore-rpc（待计划批准后建立）
**集成分支**：master
**测试运行根**：H:\pi-studybuddy-tmp\runs\T-M4-019\

---

## 1. 任务目标

### 做什么
把 T-M2-008 交付的静态 `BackupPanel` 接线到既有备份恢复 RPC（`backup.course/allCourses/restore/list/configureSchedule/listSchedules/toggleSchedule` + `Streams["backup.progress"]`），并新增 TabBar 入口使 BackupPanel 可达（04-Todo §6.6 退出门槛"BackupPanel 可达"）。

### 为什么
M4 退出门槛要求"备份恢复面板 RPC 接通 + BackupPanel 可达"。当前 `BackupPanel` 的"立即备份/恢复/调度"全部无 `onClick`，`rpc` prop 未消费；`TABS` 无 backup Tab（renderTab case "backup" 存在但无 TabBar 入口）。这是 T-M4-018（TTS 控制条）收官后 M4 剩余最后一项业务接线（T-M4-019 后仅剩 E2E 回归与收官验收）。

### 依据
- 09-UI §6.1-§6.3（备份入口/恢复交互/归档触发备份）
- 06-API §3.11（backup.* 7 方法契约）+ §4（Streams["backup.progress"]）
- 07-WF §5.1-§5.3（手动/调度/恢复流程）
- 08-Test §5（安全不变量）+ §6.4（E2E-09）+ §7.6（备份恢复断言）
- AGENTS.md §4.4/§5/§7/§8/§9（任务门禁/TDD/受控收尾/Git/安全）

## 2. 范围与非目标

### 范围
1. **BackupPanel RPC 接线**（`src/renderer/components/BackupPanel.tsx` 重写内部实现 + 受控 props）：
   - **手动备份**：`backup.course({ courseInstanceId, targetPath })`（备份此课程）+ `backup.allCourses({ semesterId, targetPath })`（备份全部课程）；课程门控（无 courseId → 禁用备份此课程）；in-flight 防重复
   - **目标目录**：desktop dialog directory capability 选择备份目录（shell 层，见 §4）；renderer **不显示完整路径**（AGENTS.md §9.3），仅"已选择备份目录"提示
   - **调度配置**：`backup.configureSchedule({ semesterId, cronExpression, timezone })` + `backup.listSchedules({ semesterId })` + `backup.toggleSchedule({ id, enabled })`；cron 非空前端校验 + host 校验；启停切换
   - **备份历史**：`backup.list({ semesterId })` → 展示 zipFilename/类型/大小/状态/时间（**不显示 targetPath 完整路径**）
   - **恢复**：dialog rawPath + zip filter 选择 zip → `backup.restore({ zipPath, targetSemesterId, conflictResolution })` → RestoreResult 摘要（integrityCheck/tablesImported/filesRestored/conflictResolved/schemaVersion）
   - **进度订阅**：`subscribe("backup.progress")` → 备份进行中状态展示（host 生产接线，见 §4）
   - 竞态/卸载保护、重复 mutation 防护、错误净化、隐私展示（不显示 zipPath/targetPath/完整 UUID/错误栈）
2. **TabBar 入口**：`src/renderer/tabs.ts` `TABS` 新增 backup Tab（第 10 个）→ renderTab case "backup" 已存在 → BackupPanel 可达（09-UI §4.1/§2.1 同步，见设计决策 1）
3. **测试**：
   - 更新 `tests/unit/renderer-backup-panel.test.ts`（保留静态断言，适配受控 props）
   - 新增 `tests/integration/t-m4-019-backup-rpc.test.ts`（RED→GREEN，C-RED-01~10）
   - 新增 `tests/e2e/t-m4-019-backup-renderer.test.ts`（真实 Electron + 受控目录/zip fixture）
   - 既有 `e2e-09-schedule-backup.test.ts` 不回归
4. **治理同步**：`.plan/00-当前任务.md`、`docs/04-Todo`（in_progress 登记 + v0.1.137 + §9 统计口径修正）、`docs/00-索引`（v0.1.141）、收尾时 `.record/T-M4-019-实施记录.md`

### 非目标（不做什么）
- **不新增/不改 RPC API、handler、schema**（contract 保持 127/127；`backup.*` 已装配于 `src/agent-host/handlers/backup/`，仅复用）
- 不实现运行态 cron 守护进程（T-M2-005 偏差已记录：backup_schedules 仅配置表，无 tick 调度器）
- 不做归档触发备份 UI（07-WF §5.4 `semesters.transition` 自动 pre/post_archive 备份流程，不在本轮 renderer 范围）
- 不执行真实用户资料备份/恢复（E2E 用隔离目录 + 受控 zip fixture；08-Test §5.3）
- 不把 targetPath/zipPath 完整路径暴露给 renderer DOM（AGENTS.md §9.3）
- 不启动 T-M4-020/021（E2E 全链回归/收官验收，各在前序完成后单独做计划）

## 3. 文件清单

### 将创建的文件
| 文件路径 | 用途 |
|---|---|
| `tests/integration/t-m4-019-backup-rpc.test.ts` | C-RED-01~10 集成测试（mock rpc + mock bridge dialog + backup.progress 发射） |
| `tests/e2e/t-m4-019-backup-renderer.test.ts` | 真实 Electron renderer E2E（隔离 fixture + 受控目录/zip seam） |
| `.record/T-M4-019-实施记录.md` | 收尾时创建（8 章节） |

### 将修改的文件
| 文件路径 | 修改内容 |
|---|---|
| `src/renderer/components/BackupPanel.tsx` | 静态壳 → 受控 + RPC 接线（手动备份/目录选择/调度/历史/恢复/进度/竞态/净化） |
| `src/renderer/tabs.ts` | TABS 新增 backup Tab（第 10 个，决策 1） |
| `src/renderer/components/AppShell.tsx` | renderTab 传 rpc（backup case 已有）+ 状态栏备份状态绑定（如涉及） |
| `src/contract/types.ts` | `DialogOptions.directory?: boolean`（shell capability，非 RPC 契约） |
| `src/main/ipc.ts` | `showDesktopDialog` 支持 directory 模式（open + openDirectory → 返回目录路径） |
| `src/agent-host/index.ts` | 生产接入 `Streams["backup.progress"]` 推送（BackupContext emit → server.pushEvent） |
| `tests/unit/renderer-backup-panel.test.ts` | 适配受控状态 props，保留静态渲染与隐私断言 |
| `.plan/00-当前任务.md` | 指向本计划 |
| `docs/04-任务清单-Todo-List.md` | T-M4-019 pending→in_progress + 版本历史 v0.1.137 + §9 统计 |
| `docs/00-文档索引-Index.md` | 版本历史 v0.1.141 + 任务状态行同步 |
| `docs/09-使用者介面-UI-Design.md` | §4.1/§2.1 增补"备份"Tab（决策 1 批准后同步，治理基线修订登记） |

> preload `showDialog` 仅透传 options（通道名不变），无需修改。

## 4. 接口设计

### RPC 方法（复用既有，不新增；06-API §3.11）
```typescript
// contract/api.ts（既有，contract 保持 127/127）
interface Api {
  "backup.course": { params: { courseInstanceId: string; targetPath: string }; result: BackupRecord };
  "backup.allCourses": { params: { semesterId: string; targetPath: string }; result: BackupRecord[] };
  "backup.restore": {
    params: { zipPath: string; targetSemesterId: string; conflictResolution?: "overwrite" | "create_new" };
    result: RestoreResult;
  };
  "backup.list": { params: { semesterId?: string; courseInstanceId?: string }; result: BackupRecord[] };
  "backup.configureSchedule": {
    params: { semesterId: string; courseInstanceId?: string; cronExpression: string; timezone: string };
    result: BackupSchedule;
  };
  "backup.listSchedules": { params: { semesterId: string }; result: BackupSchedule[] };
  "backup.toggleSchedule": { params: { id: string; enabled: boolean }; result: BackupSchedule };
}
```
host 侧已具备（T-M2-005，仅核验不改）：
- `handleBackupCourse/AllCourses`：写 backup_records（in_progress→completed/failed）+ content_hash=SHA-256 + zip 打包 + backup.progress 推送（ctx.emit 可选）
- `handleRestore`：content_hash 校验 + schema_version 校验 + 冲突处理（overwrite/create_new/none→create_new）+ integrity_check → RestoreResult；错误固定文案（不泄漏 zipPath/解压细节）
- `handleConfigureSchedule/ListSchedules/ToggleSchedule`：cron 校验 + 启停

### Streams 订阅（既有；06-API §4）
```typescript
"backup.progress": { backupRecordId: string; phase: string; progress: number };
```
renderer 经 `rpc.subscribe("backup.progress", undefined, onProgress)` 展示备份进度。**生产接线**：`createBusinessHandlers` 中 `new BackupContext(dataRoot, { emit: (event) => server.pushEvent("backup.progress", event) })`（对齐 T-M4-018 tts.state 先例；contract 127/127 不变）。

### 桌面对话框 capability（shell 层，非 RPC）
```typescript
// src/contract/types.ts
export interface DialogOptions {
  // ...既有字段
  /** T-M4-019 备份：true 时 open 对话框以目录模式返回本地目录路径（备份目标目录）。 */
  directory?: boolean;
}
```
```typescript
// src/main/ipc.ts showDesktopDialog
if (options.type === "open") {
  const result = await dialog.showOpenDialog({
    ...,
    properties: options.directory ? ["openDirectory"] : ["openFile"],
  });
  if (options.directory) {
    return { canceled: false, rawPath: result.filePaths[0] }; // 目录路径（不 staging）
  }
  // rawPath / importToken 既有分支不变
}
```

### 数据表（不涉及）
无新增/修改表；备份/调度复用 05-ERD §2.3/§2.4（backup_records/backup_schedules，host 已实现）。

## 5. 测试策略

### 单件测试（阶段 2）
- [ ] 更新 `tests/unit/renderer-backup-panel.test.ts`：保留手动备份/调度/历史/恢复流程静态断言；适配受控 props（onBackupCourse/onBackupAll/onRestore/onConfigureSchedule/onToggleSchedule/backups/schedules/restoreResult/restorePhase/progress）
- [ ] 断言面板 DOM 无完整 UUID/Windows 路径/POSIX 路径/file URI/错误栈（隐私边界，09-UI §11.1 + AGENTS.md §9.3）

### 集成测试（阶段 3，`tests/integration/t-m4-019-backup-rpc.test.ts`）
| ID | 设计条款 | 断言 |
|---|---|---|
| C-RED-01 | 手动备份（07-WF §5.1 + 06-API §3.11） | 备份此课程 → `backup.course({ courseInstanceId, targetPath })` 只调一次；in-flight 防重复；无 courseId → 禁用 + 提示"请先选择课程" |
| C-RED-02 | 目录选择（dialog directory capability） | mock `bridge.showDialog({ type:"open", directory:true })` → 返回 rawPath；确认后不显示完整路径（仅"已选择备份目录"）；canceled → 状态不变 |
| C-RED-03 | 备份全部（07-WF §5.1） | 备份全部课程 → `backup.allCourses({ semesterId, targetPath })` 只调一次；in-flight 防重复 |
| C-RED-04 | 调度（07-WF §5.2 + 06-API §3.11） | `configureSchedule({ semesterId, cronExpression, timezone })` 只调一次；空 cron 前端阻止；`listSchedules` 展示；`toggleSchedule({ id, enabled })` 启停往返 |
| C-RED-05 | 历史（06-API §3.11 backup.list） | `backup.list({ semesterId })` 加载并展示 zipFilename/类型/大小/状态/时间；**不显示 targetPath 完整路径** |
| C-RED-06 | 恢复（07-WF §5.3 + 06-API §3.11） | 选择 zip（dialog rawPath + filters zip）→ `backup.restore({ zipPath, targetSemesterId, conflictResolution })` 只调一次；成功后展示 RestoreResult 摘要（integrityCheck/tablesImported/filesRestored/conflictResolved） |
| C-RED-07 | 冲突策略显式选择（决策 2） | 恢复前 radio 选择覆盖/新建 → restore 携带对应 conflictResolution；默认新建（对齐 host none→create_new） |
| C-RED-08 | backup.progress 订阅（06-API §4） | subscribe 收到 { backupRecordId, phase, progress } → 备份中进度展示；备份完成 → 历史刷新 |
| C-RED-09 | 竞态/卸载（08-Test §5） | 备份/恢复进行中切换课程/卸载 → 旧响应丢弃；setState 不执行；失败固定文案 |
| C-RED-10 | 错误净化（AGENTS.md §9.3） | BAD_REQUEST/INTERNAL_ERROR 只显示固定文案；DOM 无 zipPath/targetPath/完整 UUID/错误栈/密钥 |
| C-RED-11 | TabBar 入口（09-UI §4.1 同步） | `TABS` 含 backup Tab（label "备份"）；TabBar 点击 → renderTab case "backup" → BackupPanel 渲染 |

### E2E（阶段 5b，`tests/e2e/t-m4-019-backup-renderer.test.ts`）
- [ ] 主流程：真实 Electron 启动（127.0.0.1 TCP）→ 预置学期+课程 → 进入"备份"Tab → 受控目录 seam（`window.__PI_BACKUP_DIR_FIXTURE__`，对齐 T-M4-017 先例）→ 备份此课程 → 历史出现 → 调度配置/启停 → 恢复（受控 zip fixture）→ RestoreResult 摘要
- [ ] 隐私断言：DOM 无完整 UUID / Windows 路径 / POSIX 路径 / file URI / 错误栈 / 密钥

### 安全不变量（如涉及）
- [ ] 备份/恢复错误固定文案；无路径/stdout/密钥泄漏；UUID 泄漏检测 `check-uuid-leak` 不影响 7/7 基线

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | 不涉及（无新组件下载） |
| 2. 单件测试 | 更新既有 renderer-backup-panel 静态测试 |
| 3. 集成测试 | ✅ 核心：C-RED-01~11（mock rpc + mock dialog + backup.progress 发射） |
| 4. 系统组装 | ✅ 核心：BackupPanel RPC 接线 + TabBar 入口 + dialog directory capability + 生产 progress 推送 |
| 5. 冒烟 + E2E | 真实 Electron renderer E2E + 完整质量门 |

## 7. 依赖关系

### 前置任务
- [x] T-M4-018：TTS 控制条 RPC 接线（done；执行序 37/38 连续，master=origin/master=586d1f0）
- [x] T-M2-005：备份恢复 handler（done；backup.* 7 方法 + zip 打包/恢复/调度已可用）
- [x] T-M2-008：09-UI S5-S7+TTS+备份恢复 UI（done；BackupPanel 静态壳已存在）
- [x] T-M4-008：AppShell 数据流重构（done；renderTab case "backup" 已存在）
- [x] T-M4-017：desktop dialog rawPath capability（done；恢复 zip 选择复用）

### 组件依赖
- [x] BackupContext（T-M2-005；emit 选项既有，生产接线对齐 T-M4-018 tts.state 先例）
- [x] desktop dialog capability（shell；本轮扩展 directory 模式，复用既有 SHOW_DIALOG 通道）

## 8. 预期产物

### 代码
- `src/renderer/components/BackupPanel.tsx`（接线）
- `src/renderer/tabs.ts`（backup Tab 入口）
- `src/contract/types.ts`（DialogOptions.directory）
- `src/main/ipc.ts`（directory 模式）
- `src/agent-host/index.ts`（backup.progress 生产推送）
- `tests/integration/t-m4-019-backup-rpc.test.ts` / `tests/e2e/t-m4-019-backup-renderer.test.ts`
- `tests/unit/renderer-backup-panel.test.ts`（更新）

### 文档更新
- `docs/04-Todo`（v0.1.137：T-M4-019 in_progress + §9 统计 + 版本历史）
- `docs/00-索引`（v0.1.141：版本历史 + 任务行同步）
- `docs/09-UI`（§4.1/§2.1 备份 Tab 同步，决策 1 批准后；治理基线修订登记）
- 06-API §3.11/§4 说明性增补（renderer 接线落地注解，如涉及）

### 实施记录
- `.record/T-M4-019-实施记录.md`（受控收尾时创建）

## 9. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（09-UI §6 + 06-API §3.11/§4 + 07-WF §5 + 08-Test）
- [x] 步骤 2：检查文档门禁（04-Todo v0.1.136 done、单一任务门禁满足）
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [x] 步骤 4：独立审查计划（实施者审阅后提交用户批准）。
- [x] 步骤 5：用户批准计划（2026-08-11“批准”；裁决 1A/2A/3A/4A）。
- [x] 步骤 6：拆分任务、逐项实现（隔离分支 agent/T-M4-019-backup-restore-rpc）。
- [x] 步骤 7：编写或更新测试（TDD：RED 初次失败 → GREEN 28/28）
- [x] 步骤 8：type-check
- [x] 步骤 9：build
- [x] 步骤 10：test（定向 45 + 全量 118 files/1130 tests）
- [x] 步骤 11：smoke / E2E（smoke 6/6；真实 Electron renderer t-m4-019-backup-renderer 1 test；全量 24 files/130 tests）
- [x] 步骤 12：独立审查并修复（双维度；修复进度残留 + 既有 renderer-layout 9→10 Tab 断言同步）
- [x] 步骤 13：更新 04-Todo（v0.1.138）+ 文档（00-索引 v0.1.142 + 09-UI v0.1.5）
- [x] 步骤 14：文档治理检查（OK）
- [x] 步骤 15：diff 检查（git diff --check 通过）
- [x] 步骤 16：提交交付（★ 用户 Git 收口授权 2026-08-11；`master=origin/master=8a6f952` 已核验）

## 10. 质量门与数据隔离

- Node 基线：`C:\node-v24.14.0-win-x64\node.exe --version` → v24.14.0；`pnpm --version` → 11.20.0（AGENTS.md §10，执行前 `$env:Path` 前置）
- 定向 unit/integration/E2E → `pnpm type-check` → `pnpm build` → `pnpm test` → `pnpm smoke` → `pnpm verify -- --stage=full`
- 不回归基线：master 基线 117 files/1119 tests（unit/integration）+ 23 files/129 tests（真实 Electron E2E）+ contract 127/127 + 安全 6/6 + smoke 6/6 + UUID 7/7 + docs 治理 + `git diff --check`
- 所有运行数据/Electron user-data/SQLite/日志/备份 zip 写入 `H:\pi-studybuddy-tmp\runs\T-M4-019\`；禁止写 `%LOCALAPPDATA%\PiStudyBuddy`；不连真实外部服务

## 11. 需用户裁决的设计决策

| # | 决策 | 方案 A（推荐） | 方案 B |
|---|---|---|---|
| 1 | BackupPanel 可达入口 | **TabBar 新增"备份"Tab（第 10 个）**（任务标题"TabBar 入口"；renderTab case 已存在；需同步 09-UI §4.1/§2.1 增补备份 Tab） | 设置页入口（不动 TabBar，但 M4 退出门槛"BackupPanel 可达"需经设置页跳转，09-UI §10 无备份小节） |
| 2 | 恢复冲突策略 | **恢复前显式选择**（覆盖/新建 radio，默认新建；对齐 host conflictResolution 参数语义——"none" 实际落 create_new） | 不选择（host 默认 create_new，学生无覆盖机会） |
| 3 | 历史行"恢复"按钮 | **触发 zip 选择恢复流程**（复用恢复区 dialog rawPath + zip filter 流程，便于从历史恢复） | 移除按钮（仅展示历史，恢复统一走底部恢复区） |
| 4 | 备份目标目录选择 | **新增 dialog directory capability**（shell 层扩展 DialogOptions.directory，对齐 rawPath 先例；renderer 不显示完整路径；E2E 用 `__PI_BACKUP_DIR_FIXTURE__` seam） | 固定默认目录（不可配置，不符合 09-UI §6.1"目标目录 [更改...]"） |

## 12. 明确停止条件

- 需要新增/修改 RPC API、handler、schema 或 AppShell 学习上下文状态
- 发现 host 侧备份/恢复防线缺失（须先 RED 登记偏差并经用户裁决后修复）
- 真实 Electron 无法启动、Node 非 v24.14.0、工作区归属无法区分（不得混入 pi-session html 等用户 dirty 文件）
- 用户未批准本计划或未授权实施

本计划只允许本地实施与治理证据同步；未经用户另行明确授权不得 `git add`、`git commit`、`git merge`、`git push`。

---

## 审查记录

（步骤 4 独立审查）计划由实施者审阅后提交用户批准：范围仅既有 backup.* RPC 接线 + TabBar 入口 + dialog directory capability（shell 层）+ backup.progress 生产推送，contract 127/127 不变；四项设计决策已明确（TabBar 入口 / 冲突策略 / 历史恢复按钮 / 目录选择）。用户 2026-08-11 回复“批准”，计划按推荐方案 A 生效（裁决 1A/2A/3A/4A）。

## 完成记录

（步骤 5 收尾时填写）
- 完成日期：2026-08-11（Git 收口完成：功能 `1bc68e2` + 治理 `8a6f952` 已推送 origin/master 并核验 `master=origin/master=8a6f952`）
- 实施记录：.record/T-M4-019-实施记录.md
- 状态：✅ 已完成（docs/04 v0.1.139 登记 done；master=origin/master=8a6f952 核验通过）
- 验收证据：RED 初次失败（4 项）→ GREEN；定向 integration 11 tests + unit 17 tests；真实 Electron E2E t-m4-019-backup-renderer 1 test；全量 unit/integration 118 files/1130 tests；真实 Electron E2E 24 files/130 tests；`verify --stage=full` 通过（contract 127/127 + 8 PiBridge + 35 tools、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）
