# T-M4-011 当前任务计划：S2 资料 Tab RPC 接线

**任务 ID**：T-M4-011
**状态**：in_progress
**日期**：2026-08-10
**分支**：agent/T-M4-011-s2-materials-rpc
**基线**：master/origin/master @ 49904bd
**授权**：用户明确批准本轮只实施 T-M4-011，并已明确授权 commit/merge/push；不启动 T-M4-012~021。

## 1. 权威范围

- `docs/09-使用者介面-UI-Design.md` §4.4：资料列表、上传、转换进度与状态动作。
- `docs/06-API契约-API-Contracts.md` §3.4：复用 `materials.list/upload/convert/generateNote` 真实 DTO。
- `docs/05-数据模型-ERD-Data-Model.md` §8.3：Material 状态机及允许动作。
- `AGENTS.md` §4、§5、§7、§8、§9、§11：单任务门禁、TDD、隔离、脱敏与受控收尾。

## 2. 本轮范围

1. 当前课程 `materials.list({ courseId })` 加载与课程门控。
2. 通过现有 `window.piBridge.showDialog({ type: "open" })` 选择受控文件，并按真实 `FileMeta` DTO 调用 `materials.upload({ courseId, file })`。
3. 按状态机门控 `materials.convert({ id })`、`materials.retryConversion({ id })` 与 `materials.generateNote({ id })`。
4. 操作后的列表刷新、loading/empty/error/success、固定错误文案与竞态隔离。
5. 以单元、mounted happy-dom 集成及既有真实 Electron RPC E2E 补齐证据；不连接真实外部服务。

## 3. 明确非范围

- 不新增 RPC 方法或修改 schema；本轮经用户追加授权，允许修改现有 S2 host handler、FileMeta 说明和测试/API 契约注解，以完成真实文件导入与归档写防线。
- 不实施 T-M4-012 笔记 Tab 或任何后续任务。
- 不连接真实 AI、WPS、whisper.cpp、OCR 或外部网络服务。
- 不写入 `%LOCALAPPDATA%\PiStudyBuddy`；测试数据和日志仅使用 `H:\pi-studybuddy-tmp\runs\T-M4-011\`。
- Git 收口已获用户授权，但必须在本计划证据同步、diff 检查和当前分支复验通过后按 AGENTS §8 顺序执行。

## 4. 实施顺序（RED → GREEN → REFACTOR）

- [ ] **RED 原始日志补证仍待后续治理修订**：实施前曾观察到旧静态 MaterialsTab 的 4 个有意义失败，但原始失败日志未保留；当前不伪造该历史输出。
- [x] **GREEN**：接通 `materials.list/upload/convert/retryConversion/generateNote`，加入状态动作、刷新和固定脱敏文案；host 导入源文件到 storage 并拒绝 archived 学期写入。
- [x] **REFACTOR**：加入 `ContextToken` 与递增 action id，阻止对话框跨课程写入、归档课程写操作、旧动作清理新动作；host 侧统一 S2 archived 写守卫；文件以原子复制进入 storage，main open dialog 限制为 `openFile`。
- [x] **定向验证**：6 files / 79 tests passed（Node24.14.0），含 renderer capability transport、文件导入/storage、转换读取与 host archived 写守卫；补验日志位于 `H:\pi-studybuddy-tmp\runs\T-M4-011\`。
- [x] **完整验证**：已安装并使用 Node 24.14.0 / pnpm 11.20.0 目标基线；`pnpm test` 106 files / 1037 tests 全通过，`node scripts/verify.mjs --stage=full` 通过（unit/integration 106 files / 1037 tests、真实 Electron E2E 16 files / 118 tests），以及 type-check/build/smoke/contract/security/UUID/docs/diff 全通过。日志为 `node24-git-closeout-unit-final-v2.log`、`node24-git-closeout-verify-full-v2.log` 及既有任务日志。
- [x] **两名独立审查者交叉审查**：审查者 A（架构/契约/测试）与 B（治理/验收）独立结论已归档为 `.record/T-M4-011-审查-A.md` / `.record/T-M4-011-审查-B.md`；修订与最终边界已记录。
- [x] **本地收尾材料**：建立 `.record/T-M4-011-实施记录.md`、两份独立审查记录并同步 Todo/索引/AGENTS/API 元数据；本轮补齐 renderer 对一次性 `importToken/fileName/fileSize` 的传递和全量 fixture/E2E 适配；已获用户 Git 收口授权，下一步执行提交/合并/推送。

## 5. 预期影响文件

- `src/renderer/components/tabs/MaterialsTab.tsx`
- `src/main/ipc.ts`（仅 open dialog 文件选择边界）
- `src/agent-host/handlers/s2/lookup.ts`、`materials.ts`、`notes.ts`、`modules.ts`（文件导入/storage 与 host archived 写守卫）
- `src/contract/types.ts`、`docs/06-API契约-API-Contracts.md`（FileMeta/S2 upload 语义）
- `tests/integration/t-m4-011-s2-import-archive.test.ts`、`tests/integration/t-m4-011-materials-rpc.test.ts`
- `tests/e2e/e2e-02-materials-notes.test.ts`、`tests/e2e/helpers/electron-launcher.ts`
- `.plan/00-当前任务.md`、`docs/04-任务清单-Todo-List.md`
- `.record/T-M4-011-实施记录.md`
- `AGENTS.md` 与 `docs/00-文档索引-Index.md` 的版本/状态同步；不改设计/API 基线。

## 6. 证据边界

- 本地实现：当前隔离分支，尚未进入 master；Git 收口授权已生效。
- 开发机验证：Node v24.14.0 / pnpm 11.20.0；用户级运行时安装于 `C:\Users\Administrator\.tools\node-v24.14.0`，并已以此运行完整质量门。
- 真实 Electron：以 `PI_STUDYBUDDY_E2E_RUN_DIR=H:\pi-studybuddy-tmp\runs\T-M4-011\e2e` 重跑资料 E2E，资料 E2E 1 file / 10 tests passed；完整 verify full 真实 Electron E2E 16 files / 118 tests passed；E02-01 已验证真实 fixture → storage 文件存在、真实大小和转换读取。
- target-machine acceptance：pending-target-machine，未验证。
- Git：用户已授权 commit/merge/push；按 AGENTS §8 顺序执行。
- T-M4-012 及之后任务不得启动。
