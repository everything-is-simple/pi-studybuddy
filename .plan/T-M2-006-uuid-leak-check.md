# T-M2-006 S6 UUID 泄漏检测独立校验脚本

**任务**：T-M2-006（业务Adapter / S6，P1）
**里程碑**：M2 完整闭环
**状态**：进行中（用户已于 2026-08-08 批准开工）
**日期**：2026-08-08
**依据**：03-Arch §8.2（UUID 泄漏检测）+ §8.1（安全不变量）+ 08-Test §5.4（家长报告脱敏冒烟）+ §5.7（安全不变量硬断言范式）+ 02-PRD §5.2（privacyCheckPassed）+ 05-ERD §3.6（privacy_check_passed 列）+ AGENTS.md §9.3（日志脱敏）

---

## 1. 任务目标

创建一个**独立静态审计脚本** `scripts/check-uuid-leak.mjs`，遵循 `scripts/check-desktop-security.mjs` 的硬断言范式，对 S6 家长报告 **UUID 泄漏检测布线**做静态审计。任一断言失败立即退出（非零码），阻塞合并。

> `assertNoSensitiveLeak` 业务实现已在 T-M2-002 完成（[leak-detector.ts](../src/agent-host/handlers/s6/leak-detector.ts)），本任务**不修改业务逻辑**，只把"检测已正确布线"固化为可持续运行的独立校验脚本。

## 2. 范围与非目标

### 2.1 范围（做）

- 新建 `scripts/check-uuid-leak.mjs`：静态读取 S6 相关源文件，断言 UUID 泄漏检测布线完整（见 §4）
- 脚本可独立运行：`node scripts/check-uuid-leak.mjs`，全部通过退出 0，任一失败退出 1

### 2.2 非目标（不做）

- ❌ 不修改 `leak-detector.ts` / `reports.ts` / `errors.ts` 业务逻辑（T-M2-002 已完成）
- ❌ 不新增 E2E 用例（S6 UUID 泄漏检测 E2E 已在 T-M2-009 覆盖）
- ❌ 不修改 `check-desktop-security.mjs` / `verify.mjs`（本脚本保持独立，不接入统一质量门，避免过度工程化）
- ❌ 不改 API 契约 / 不改数据表（无 schema 变更）
- ❌ 不连真实外部服务（纯静态文本审计，无运行时依赖）

## 3. 文件清单

| 操作 | 路径 | 说明 |
|---|---|---|
| 新建 | `scripts/check-uuid-leak.mjs` | UUID 泄漏检测独立静态审计脚本 |
| 新建 | `tests/e2e/check-uuid-leak.script.test.ts` | 脚本自身冒烟（TDD）。**文件名偏差**：计划草案为 `.test.mjs`，实施改为 `.test.ts`——vitest.e2e.config.ts 仅收集 `tests/e2e/**/*.test.ts`（`.mjs` 不会被质量门收集，无法纳入回归） |

> 脚本基于 `fs.readFileSync` 正则/子串断言，与 `check-desktop-security.mjs` 同构，无需新增依赖。

## 4. 脚本断言设计（UUID-01 ~ UUID-07）

读源：`leak-detector.ts` / `reports.ts` / `errors.ts` / `types.ts`。

| ID | 断言 | 权威条款 |
|---|---|---|
| UUID-01 | `leak-detector.ts` 定义 UUID 正则 `8-4-4-4-12 hex`（`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`） | 03-Arch §8.2 |
| UUID-02 | `assertNoSensitiveLeak` 函数存在且 `JSON.stringify` 后扫描 | 03-Arch §8.2 |
| UUID-03 | 命中时抛 `PARENT_REPORT_PRIVACY_VIOLATION`：`errors.ts` 含 `privacyViolation` + `types.ts` ErrorCode 含该码 | 06-API §2.2 + 02-PRD §5.2 |
| UUID-04 | `reports.ts` **规则报告阶段**调用 `assertNoSensitiveLeak(ruleReport)` | 08-Test §5.4 |
| UUID-05 | `reports.ts` **冻结阶段**调用 `assertNoSensitiveLeak(content)` | 07-WF §3.1 |
| UUID-06 | 错误 message 为固定文案（不含路径分隔符 `:`/`\`/`/`，不泄漏堆栈） | AGENTS.md §9.3 |
| UUID-07 | `privacy_check_passed` 列写入：`types.ts` ParentReport DTO 含 `privacyCheckPassed` | 05-ERD §3.6 |

## 5. 测试策略

### 5.1 脚本冒烟测试（tests/e2e/check-uuid-leak.script.test.ts）

- 运行 `node scripts/check-uuid-leak.mjs` → 退出码 0（当前实现已全绿）
- 构造一个"泄漏布线缺失"的临时夹具（`--src` 指向空目录）→ 退出码非 0 + 输出 FAILED
- 验证脚本对 `--help` 正常退出 0

> 该测试用 `child_process.execFileSync` 运行脚本，临时夹具写入 `H:\pi-studybuddy-tmp\runs\T-M2-006\`（AGENTS.md §5.3 数据隔离）。

### 5.2 数据隔离

- 所有临时夹具写入 `H:\pi-studybuddy-tmp\runs\T-M2-006\`，不使用真实业务数据根

## 6. 五阶段治理定位

| 阶段 | 定位 |
|---|---|
| 阶段1 下载 | 无新组件（Node 内置 fs，无外部依赖） |
| 阶段2 单件 | 脚本对 7 条断言的自检（脚本冒烟测试） |
| 阶段3 集成 | 脚本对真实 S6 源（leak/reports/errors/types）的静态审计 |
| 阶段4 组装 | 脚本进入 `scripts/` |
| 阶段5 冒烟E2E | `node scripts/check-uuid-leak.mjs` 全绿 + 脚本冒烟测试通过 |

## 7. 依赖关系

- 前置：T-M2-002 done（S6 家长报告，leak-detector.ts 已实现）
- 依赖：`src/agent-host/handlers/s6/leak-detector.ts` / `reports.ts` / `errors.ts` + `src/contract/types.ts` 已存在
- 范式参考：`scripts/check-desktop-security.mjs`（硬断言 + 退出码模式）

## 8. 预期产物

- `scripts/check-uuid-leak.mjs`（独立脚本）+ `tests/e2e/check-uuid-leak.script.test.ts`（冒烟测试）
- type-check + build + 全量测试 + smoke 通过
- 04-Todo v0.1.47（登记 done）+ 00-索引 v0.1.53 + AGENTS.md v0.1.32 + .record/T-M2-006

## 9. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界
- [x] 步骤 2：检查文档门禁（master 干净 + 无执行中任务 + 用户已选 T-M2-006）
- [x] 步骤 3：编写 .plan/ 计划
- [x] 步骤 4：独立审查计划
- [x] 步骤 5：用户批准计划（★ 用户授权）
- [x] 步骤 6：拆分任务、逐项实现
- [x] 步骤 7：编写或更新测试（TDD）
- [x] 步骤 8：type-check（零错误零警告）
- [x] 步骤 9：build（无错误）
- [x] 步骤 10：test（全绿无 skip）
- [x] 步骤 11：smoke / E2E（铁律不破）
- [x] 步骤 12：独立审查并修复
- [x] 步骤 13：更新 04-Todo + 文档
- [x] 步骤 14：文档治理检查
- [x] 步骤 15：diff 检查
- [ ] 步骤 16：提交交付（★ 用户授权）

## 审查记录

**步骤 4 独立审查（2026-08-08）**：

- ✅ 布线核实：`reports.ts` 两处调用确证——规则报告阶段 `assertNoSensitiveLeak(ruleReport)`（reports.ts:51）+ 冻结阶段 `assertNoSensitiveLeak(content)`（reports.ts:120）
- ✅ 范式核实：`check-desktop-security.mjs` 硬断言 + 非零退出码模式已确认（check 函数 + failed 数组 + process.exit(1)）
- ✅ 正则核实：`leak-detector.ts:11` UUID_PATTERN 为 `8-4-4-4-12 hex`（v1/v4/v5 覆盖），与 03-Arch §8.2 一致
- ✅ 错误码核实：`errors.ts:20-22` privacyViolation 返回 `PARENT_REPORT_PRIVACY_VIOLATION`；`types.ts:36` ErrorCode 含该码
- ✅ 范围边界：非目标（不修改业务逻辑 / 不接入 verify / 不新增 E2E）正确排除，符合"独立校验脚本"定位
- ✅ 测试策略：脚本冒烟（退出码）+ 数据隔离（runs/T-M2-006）闭环，可验证可审计
- 结论：计划完整、技术上可执行，无阻塞项

**步骤 12 独立审查（2026-08-08）**：

- ✅ 脚本 7 断言 UUID-01~07 与计划 §4 一致，权威条款引用正确（03-Arch §8.2 / 06-API §2.2 / 02-PRD §5.2 / 08-Test §5.4 / 07-WF §3.1 / AGENTS.md §9.3 / 05-ERD §3.6）
- ✅ 未修改任何业务逻辑文件（leak-detector.ts / reports.ts / errors.ts / types.ts 均只读）
- ✅ 测试 3 用例覆盖真实源码全绿 / 夹具 FAILED / --help 三态，`execFileSync` 正确捕获退出码
- ✅ 参数设计：`--src` 覆盖源根（测试注入夹具）+ `readSource` 对缺失源优雅降级为空串 → 统一打印 FAILED
- ✅ 数据隔离：夹具写入 `H:\pi-studybuddy-tmp\runs\T-M2-006\`
- ✅ 偏差记录：测试文件名 `.test.mjs` → `.test.ts`（vitest.e2e 仅收集 `*.test.ts`，否则不入质量门）
- 结论：实现完整、无越权、无阻塞项，质量门全绿（type-check + build + 799 单元/集成 + 83 E2E + smoke 6/6）