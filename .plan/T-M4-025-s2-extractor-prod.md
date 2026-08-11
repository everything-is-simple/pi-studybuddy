# 任务计划：T-M4-025 生产资料转换 extractor 注入修复

**任务 ID**：T-M4-025
**标题**：生产 S2Context 注入真实 TextExtractor（materials.convert 生产可用）
**日期**：2026-08-11
**状态**：✅ 已批准（2026-08-11 用户“批准计划 T-M4-025”）
**关联文档**：07-WF §2.3 + 06-API §3.4 + 05-ERD §3.2.2 + 08-Test §3.3.2/§5.4 + T-M4-020 实施记录 §4/§8
**里程碑**：M4 业务接线 + 打包部署（缺陷修复）
**优先级**：P0（生产功能缺口）
**治理阶段**：阶段 3-4（集成 + 系统组装）
**用户授权**：用户明确指令解决该缺口（2026-08-11"然后我们再解决：生产 S2Context 未注入 extractor…"）；待用户批准本计划后实施
**集成基线**：master=origin/master=329b83d（T-M4-020 Git 收口事实核验，04-Todo v0.1.142）
**实施分支**：agent/T-M4-025-s2-extractor-prod（待计划批准后建立）
**集成分支**：master
**测试运行根**：H:\pi-studybuddy-tmp\runs\T-M4-025\

---

## 1. 任务目标

### 做什么
修复 T-M4-020 回归审查发现的**生产后端缺口**：生产 `createBusinessHandlers` 以 `new S2Context(dataRoot)` 构建 S2 上下文，未注入 `textExtractor`，导致生产环境 `materials.convert` 仅登记 Job（material 停在 converting），**学生上传 PDF/DOCX/PPTX/XLSX 后转换永不完成**。修复：生产注入 `createRealTextExtractor()`（pdf-parse/jszip/mammoth 本地库，进程内提取，非外部服务）。

### 为什么
- 生产可用性：S2 资料转换是 M1 核心闭环（07-WF §2.3）的核心能力；生产只登记 Job 意味着"上传→转换→生成笔记"闭环在生产不可完成（T-M1-007 的 extractor 仅在集成测试注入，生产装配遗漏）。
- T-M4-020 回归审查发现并登记（实施记录 §4/§8），用户明确指示解决。
- 与 T-M4-018/019 先例一致：生产接线补齐（stream emit / extractor 注入），不改 handler/API/schema。

### 依据
- 07-WF §2.3（资料转换管道：materials.convert → 提取 → normalized_texts → converted）
- 06-API §3.4（materials.convert/retryConversion 契约）
- 05-ERD §3.2.2（normalized_texts：content_hash/char_count/source_type 先删后插幂等）
- 08-Test §3.3.2（TextExtractor 三态 + 受控夹具）+ §5.4（不连真实外部服务；pdf-parse/jszip/mammoth 为本地库，不在 mock 清单）
- AGENTS.md §4.4/§5/§7/§8/§9

## 2. 范围与非目标

### 范围
1. **生产装配修复**（`src/agent-host/index.ts`）：
   - `createBusinessHandlers` 中 `new S2Context(dataRoot, undefined, createRealTextExtractor())`——注入真实进程内 TextExtractor（第 3 构造参数）
   - 影响：生产 `materials.convert` 的 convert_pdf/docx/pptx/xlsx 分派真实提取；成功写 normalized_texts + Material→converted + Job→completed；失败 conversion_failed + Job→failed（固定文案，不泄漏路径/栈）
2. **回归 E2E 升级为真实断言**（`tests/e2e/t-m4-020-materials-renderer.test.ts`）：
   - 种子材料 storageKey 指向**真实 PDF 夹具**（受控最小 PDF，`dataRoot/<storageKey>` 实际落盘）
   - 点击"开始转换" → 断言 status 变为 **"已转换"**（converted，真实提取完成）——从"Job 登记"升级为"生产真实转换完成"
3. **测试**：
   - 更新 `t-m4-020-materials-renderer.test.ts`（真实 PDF 夹具 + converted 断言）
   - 既有 `tests/integration/s2-handlers.test.ts` / `t-m1-007-convert-pipeline.test.ts` 不回归（它们自注入 extractor，不受生产装配影响）
   - 新增定向单件/集成断言：生产 `createBusinessHandlers` 装配后 convert_pdf 真实完成（如合适）
4. **治理同步**：`.plan/00-当前任务.md`、`docs/04-Todo`（登记 + v0.1.143）、`docs/00-索引`（v0.1.147）、收尾时 `.record/T-M4-025-实施记录.md` + 08-Test §11.3 修复记录

### 非目标（不做什么）
- **不注入 WPS/OCR Adapter**（doc/ppt/xls 的 wps_convert、图片 ocr_image）：WPS COM 与 OCR venv 属 08-Test §5.4"全 mock"外部组件清单（spawn Python/WPS 子进程），生产保持"仅登记 Job"既有边界；如需生产启用需另行裁决（依赖 WPS 安装/OCR venv 就绪）
- 不新增/改 RPC API、handler、schema（contract 127/127 不变；仅 S2Context 构造装配）
- 不改 text-extractor / extractor 实现（既有三态已就绪）
- 不触碰真实业务数据根；不连接真实外部服务
- 不启动 T-M4-021（收官验收仍待本任务收口后单独选择）

## 3. 文件清单

### 将创建的文件
| 文件路径 | 用途 |
|---|---|
| `.record/T-M4-025-实施记录.md` | 收尾时创建（8 章节） |
| `tests/unit/t-m4-025-extractor-prod.test.ts`（如合适） | 生产装配 convert 真实完成断言（RED→GREEN） |

### 将修改的文件
| 文件路径 | 修改内容 |
|---|---|
| `src/agent-host/index.ts` | `new S2Context(dataRoot, undefined, createRealTextExtractor())`（导入 createRealTextExtractor） |
| `tests/e2e/t-m4-020-materials-renderer.test.ts` | 真实 PDF 夹具 + converted 断言（回归升级） |
| `.plan/00-当前任务.md` | 指向本计划 |
| `docs/04-任务清单-Todo-List.md` | 新增 T-M4-025 登记（M4 24→25）+ §9 统计 + 版本历史 v0.1.143 |
| `docs/00-文档索引-Index.md` | 版本历史 v0.1.147 + 任务行同步 |
| `docs/08-测试验收-Test-Plan.md` | §11.3 修复记录（如涉及） |

## 4. 接口设计

### 生产装配（不改 handler/API/schema）
```typescript
// src/agent-host/index.ts createBusinessHandlers
import { createRealTextExtractor } from "./handlers/s2/text-extractor";
// ...
const s2Ctx = new S2Context(dataRoot, undefined, createRealTextExtractor());
// 构造参数：(dataRoot, wpsAdapter?, textExtractorAdapter?, ocrAdapter?)
//   wps/ocr 保持 undefined —— 08-Test §5.4 外部组件 mock 边界
```

### RPC 行为（复用既有，06-API §3.4）
- `materials.convert({ id })`：convert_pdf/docx/pptx/xlsx → 真实 extractor 提取 `dataRoot/<storageKey>` → 成功写 normalized_texts（先删后插）+ Material→converted + Job→completed；失败 Material→conversion_failed + Job→failed（固定文案）
- `materials.retryConversion({ id })`：conversion_failed 重试同管道

### 数据表（不涉及）
无新增/修改表；normalized_texts/materials/jobs 复用 05-ERD §3.2.2（host 既有）。

## 5. 测试策略

### 单件/集成测试（阶段 3，RED→GREEN）
- [ ] RED：新增生产装配断言（或先跑升级后 materials E2E 见 RED——convert 停在 converting 不达 converted）
- [ ] GREEN：`createBusinessHandlers` 装配后，`materials.convert` 对受控 PDF 夹具真实提取 → Material status=converted + normalized_texts 落库（如合适新增单件/集成测试，或由升级后 materials E2E 覆盖）

### E2E（阶段 5b，升级 `t-m4-020-materials-renderer.test.ts`）
- [ ] 主流程：真实 Electron → 资料 Tab → 受控 PDF 夹具（storageKey 落盘真实文件）→ 点击转换 → **状态变为"已转换"**（真实生产提取完成）+ 隐私断言
- [ ] 归档只读用例保持（转换禁用）

### 回归
- [ ] `pnpm test`：unit/integration 118 files/1130 tests 不回归
- [ ] `pnpm test:e2e`：28 files 不回归（materials E2E 升级后仍绿）
- [ ] `pnpm verify -- --stage=full`：contract/security/smoke/UUID/docs/diff 全绿

### 安全不变量（如涉及）
- [ ] 提取失败固定文案（不泄漏 storageKey/路径/栈）；UUID 7/7 不回归

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | 不涉及（pdf-parse/jszip/mammoth 已安装 dependencies） |
| 2. 单件测试 | 不涉及（extractor 三态已有单件覆盖） |
| 3. 集成测试 | ✅ 核心：生产装配 convert 真实完成断言（RED→GREEN） |
| 4. 系统组装 | ✅ 核心：createBusinessHandlers 注入 createRealTextExtractor |
| 5. 冒烟 + E2E | materials renderer E2E 升级（converted 真实断言）+ 全量质量门 |

## 7. 依赖关系

### 前置任务
- [x] T-M1-007：资料转换管道（done；TextExtractor 三态 + runTextConversion 已就绪）
- [x] T-M4-002：agent-host 生产装配（done；createBusinessHandlers 为装配点）
- [x] T-M4-020：E2E 全链回归（done；审查发现并登记本缺口，master=origin/master=329b83d）

### 组件依赖
- [x] pdf-parse / jszip / mammoth（本地库，dependencies 已装，08-Test §1.3 受控夹具可驱动）
- [x] createRealTextExtractor（T-M1-007 既有实现）

## 8. 预期产物

### 代码
- `src/agent-host/index.ts`（1 行装配注入 + import）
- `tests/e2e/t-m4-020-materials-renderer.test.ts`（PDF 夹具 + converted 断言）
- `tests/unit/t-m4-025-extractor-prod.test.ts`（如合适）

### 文档更新
- `docs/04-Todo`（v0.1.143：T-M4-025 登记 in_progress + §9 统计 + 版本历史）
- `docs/00-索引`（v0.1.147）
- `docs/08-Test` §11.3 修复记录（如涉及）

### 实施记录
- `.record/T-M4-025-实施记录.md`（受控收尾时创建）

## 9. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（07-WF §2.3 + 06-API §3.4 + 08-Test §3.3.2/§5.4）
- [x] 步骤 2：检查文档门禁（04-Todo v0.1.142 done、单一任务门禁满足）
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [x] 步骤 4：独立审查计划（实施者审阅后提交用户批准）。
- [x] 步骤 5：用户批准计划（2026-08-11“批准计划 T-M4-025”）。
- [x] 步骤 6：拆分任务、逐项实现（隔离分支 agent/T-M4-025-s2-extractor-prod）。
- [x] 步骤 7：编写或更新测试（TDD：materials E2E converted 断言 RED 失败 → 装配修复 + pdfjs 环境补齐 → GREEN）
- [x] 步骤 8：type-check
- [x] 步骤 9：build
- [x] 步骤 10：test（全量 unit/integration 118 files/1130 tests 不回归）
- [x] 步骤 11：smoke / E2E（smoke 6/6；全量真实 Electron E2E 28 files/136 tests；verify full 通过）
- [x] 步骤 12：独立审查并修复（双维度；深挖 pdfjs utilityProcess 环境根因：DOMMatrix + workerSrc + tsc import 转换三层问题）
- [x] 步骤 13：更新 04-Todo（v0.1.144）+ 文档（00-索引 v0.1.148）
- [x] 步骤 14：文档治理检查（OK）
- [x] 步骤 15：diff 检查（git diff --check 通过）
- [x] 步骤 16：提交交付（★ 用户 Git 收口授权 2026-08-11；网络恢复后 `master=origin/master=5359d17` 已核验）

## 10. 质量门与数据隔离

- Node 基线：`C:\node-v24.14.0-win-x64\node.exe --version` → v24.14.0；`pnpm --version` → 11.20.0
- 定向 → `pnpm type-check` → `pnpm build` → `pnpm test` → `pnpm test:e2e` → `pnpm verify -- --stage=full`
- 不回归基线：master 基线 118 files/1130 tests（unit/integration）+ 28 files/136 tests（真实 Electron E2E）+ contract 127/127 + 安全 6/6 + smoke 6/6 + UUID 7/7 + docs 治理 + `git diff --check`
- 所有运行数据/PDF 夹具/日志写入 `H:\pi-studybuddy-tmp\runs\T-M4-025\`；禁止写 `%LOCALAPPDATA%\PiStudyBuddy`；不连真实外部服务

## 11. 明确停止条件

- 需要新增/修改 RPC API、handler、schema 或改变 WPS/OCR 外部组件边界
- 真实 Electron 无法启动、Node 非 v24.14.0、工作区归属无法区分（不得混入 pi-session html 等用户 dirty 文件）
- 用户未批准本计划或未授权实施

本计划只允许本地实施与治理证据同步；未经用户另行明确授权不得 `git add`、`git commit`、`git merge`、`git push`。

---

## 审查记录

（步骤 4 独立审查）计划由实施者审阅后提交用户批准：范围仅生产 S2Context 注入 createRealTextExtractor（本地库，非外部服务）+ materials E2E 升级为 converted 真实断言；不注入 WPS/OCR（§5.4 mock 边界）；contract 127/127 不变。用户 2026-08-11 回复“批准计划 T-M4-025”，计划生效。

## 完成记录

（步骤 5 收尾时填写）
- 完成日期：2026-08-11（Git 收口完成：功能 `00b7579` + 治理 `22ecdde` + 中间事实 `5359d17` 已推送 origin/master 并核验 `master=origin/master=5359d17`）
- 实施记录：.record/T-M4-025-实施记录.md
- 状态：✅ 已完成（docs/04 v0.1.147 登记 done；master=origin/master=5359d17 核验通过）
- 验收证据：RED（materials E2E converted 断言失败）→ 装配修复 + pdfjs utilityProcess 环境补齐 → GREEN；真实 Electron E2E materials 2/2（converted 真实断言）；全量 unit/integration 118 files/1130 tests；真实 Electron E2E 28 files/136 tests；`verify --stage=full` 通过（contract 127/127 + 8 PiBridge + 35 tools、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）
