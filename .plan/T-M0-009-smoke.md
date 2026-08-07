# T-M0-009 M0 系统冒烟完整

**状态**：✅ 已完成（M0 收官）
**日期**：2026-08-07
**里程碑**：M0 骨架搭建（收官任务）
**治理阶段**：阶段5（冒烟 + E2E，08-Test §5）

## 权威依据

- [04-Todo §6.2](../docs/04-任务清单-Todo-List.md)：M0 退出门槛六项
- [04-Todo §7.1](../docs/04-任务清单-Todo-List.md)：M0 系统冒烟 = 08-Test §5 阶段5
- [08-Test §5.7](../docs/08-测试验收-Test-Plan.md)：安全不变量六条
- [03-Arch §6.4/§8.2](../docs/03-架构设计-Architecture-Design.md)：安全骨架 + 硬断言范式
- [05-ERD](../docs/05-数据模型-ERD-Data-Model.md)：建库 schema
- [06-API](../docs/06-API契约-API-Contracts.md)：RPC 契约

## 现状核实（已读源码确认）

- `scripts/smoke.mjs` 现仅覆盖「build 产物 8 项齐全 + RPC `system.ping` 往返」
- `scripts/check-desktop-security.mjs` INV-01~05 已实现硬断言，**INV-06 仍占位 `false`**（标注"延迟到 T-M0-008"），且第 88-95 行对占位宽松放行
- `scripts/verify.mjs` 第 107 行 `desktop-security` 标记 `optional: true`（为兼容占位）
- `src/shared/constants.ts` 仅 `RENDERER_CSP`，无 `HTML_PREVIEW_CSP`
- `src/main/protocol.ts` app:// 协议对所有响应统一注入 `RENDERER_CSP`
- 数据层入口 `src/data/index.ts` 导出 `createGlobalDb`/`initGlobalDb`/`createSemesterDb`/`initSemesterDb`/`openDatabase`/`assertIntegrity`
- `src/main/credential-vault.ts` 用 `safeStorage`（仅 Electron 运行时可用），构造函数支持注入 `SafeStorageAdapter`
- Git：T-M0-008 已推送（`034969c`=origin/master），工作区干净

## 任务范围

### 交付物

1. **INV-06 补全**（安全不变量第六条）
   - `src/shared/constants.ts` 新增 `HTML_PREVIEW_CSP`（含 `form-action 'none'` + `default-src 'self'` + `object-src 'none'` 等）
   - `src/main/protocol.ts` 对 `.html` 响应注入 `HTML_PREVIEW_CSP`（更严格），其他类型仍 `RENDERER_CSP`
   - `scripts/check-desktop-security.mjs` INV-06 转真实硬断言，移除"占位宽松放行"逻辑，六条任一失败退出非零
   - `scripts/verify.mjs` `desktop-security` 从 `optional: true` 改为硬阻塞
2. **smoke.mjs 扩展**（覆盖 §6.2 退出门槛六项）
   - 保留：build 产物齐全 + RPC `system.ping` 往返
   - 新增：建库冒烟（临时目录建 global.db + semester.db，断言 `assertIntegrity` + 关键表存在）
   - 新增：credential-vault 往返冒烟（注入 fake `SafeStorageAdapter`，set→get 一致性 + 键名校验）
   - 新增：调用 `check-desktop-security.mjs` 子进程六条全过
   - 汇总六项结果，任一失败退出非零
3. **测试**：扩展 `tests/security/invariants.test.ts` 加 INV-06 断言（RED→GREEN）

### 不做

- ❌ S1-S7 业务冒烟（M1+，08-Test §5.1-§5.6）
- ❌ 真实 GUI 启动自动化（`pnpm dev` 人工执行；本任务仅验证启动前置条件）
- ❌ Playwright E2E（M1 阶段 5b）
- ❌ 修改数据层 schema / 新增业务工具
- ❌ HTML 预览渲染器本体（M1+ S2），仅定义独立 CSP 常量并接入协议层

## TDD 计划

### RED

- 扩展 `tests/security/invariants.test.ts`：
  - INV-06：`HTML_PREVIEW_CSP` 存在 + 含 `form-action 'none'`；`protocol.ts` 对 `.html` 用 `HTML_PREVIEW_CSP`
- 运行 `pnpm test` → 失败（常量不存在）

### GREEN

1. `src/shared/constants.ts` 加 `HTML_PREVIEW_CSP`
2. `src/main/protocol.ts` `.html` 响应注入 `HTML_PREVIEW_CSP`
3. `scripts/check-desktop-security.mjs` INV-06 转硬断言 + 移除占位宽松
4. `scripts/verify.mjs` `desktop-security` 改硬阻塞
5. `scripts/smoke.mjs` 扩展建库 + vault 往返 + 调用 check-desktop-security
6. 运行 `pnpm test` → 通过

### REFACTOR

- 整理 smoke.mjs 分段结构（build → RPC → 建库 → vault → 安全 → 汇总）

## 运行数据隔离

- 建库/vault 冒烟数据写 `H:\pi-studybuddy-tmp\runs\T-M0-009\`
- 不污染业务数据根 `%LOCALAPPDATA%\PiStudyBuddy`
- 不连真实外部服务（safeStorage 用 fake adapter）

## 完成门槛

- [ ] `pnpm verify` 全绿（type-check + unit + contract-coverage + desktop-security + build + smoke）
- [ ] `check-desktop-security.mjs` 六条不变量全过（INV-06 不再占位，任一失败退出非零）
- [ ] `pnpm smoke` 覆盖六项且退出码 0
- [ ] Git 纪律：`git add <显式路径>` + `feat(m0): ...` 提交 + `git merge --ff-only` + 推送 origin/master
- [ ] 工作区干净 + `git diff --check` 通过

## 文档收尾

- `docs/04-Todo`：登记 T-M0-009 done + §9 统计（M0 全 done）+ 头部版本号修正（v0.1.11→v0.1.14）+ §6.0 补 M0 完成说明
- `docs/00-索引`：头部版本号修正（v0.1.25→v0.1.27）+ §七登记 T-M0-009 done + 版本历史条目
- `AGENTS.md`：§3.1 版本登记同步 + §12 修订记录
- `.plan/00-当前任务.md`：修正 T-M0-008 过时状态 + 登记 T-M0-009 完成
- `.record/T-M0-009-实施记录.md`：8 章节
