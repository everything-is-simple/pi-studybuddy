# 任务计划：T-M1-005 OCR venv Adapter（课表图片识别）

**任务 ID**：T-M1-005
**日期**：2026-08-08
**状态**：📝 待审查（用户已批准开工）
**关联文档**：03-Arch §3.3 + 08-Test §3.3 + 02-PRD §4.1
**里程碑**：M1 核心闭环（§7.5 全局执行顺序表第 5 行）

---

## 1. 任务目标

### 做什么

实现 S1 课表图片识别的外部桥组件 **OCR venv Adapter**：Python 桥脚本（RapidOCR 本地识别）+ TS `OcrAdapter` 可注入接口（mock/failing/real 三态）+ 7 图格式单件测试 + studybuddy-extension 工具注册接入。

### 为什么

S1 学期初始化流程（`studybuddy_init_semester`）需要"课程表 OCR 识别预览"能力（03-Arch §3.4 工具表 `studybuddy-ocr-schedule`）。当前 mock 状态，需落地真实组件框架。是 M1 核心闭环中"图片→结构化课表"的关键拼图，也是 T-M1-007 资料转换管道的图片 OCR 前置。

### 依据

- [03-Arch §3.3](../docs/03-架构设计-Architecture-Design.md)：OCR venv Adapter 设计契约（onnxruntime/PIL 全图格式 + 复用 venv python.exe + 子进程 JSON 协议 + 手写 OCR 走本地 RapidOCR）
- [08-Test §3.3.3](../docs/08-测试验收-Test-Plan.md)：pytest `@pytest.mark.parametrize` 7 格式断言 run_ocr 返回非空字符串
- [02-PRD §4.1](../docs/02-PRD-产品需求-Product-Requirements.md)：手写 OCR 走本地 RapidOCR，不走多模态 AI（吸收结论）
- [03-Arch §3.4](../docs/03-架构设计-Architecture-Design.md)：`studybuddy-ocr-schedule` 工具（课程表 OCR 识别预览，OCR venv onnxruntime/PIL）
- AGENTS.md §5.4：v0.1 mock 先于真实，测试不连真实 RapidOCR

## 2. 范围与非目标

### 范围

- **Python 桥脚本** `scripts/ocr-bridge/ocr_bridge.py`：stdin/stdout JSON 协议，接收 `{ imagePath }` → 本地 RapidOCR 识别 → 返回 `{ text }`；复用 `H:\AIStudyBuddy\runtime\venv\Scripts\python.exe`（仅真实实现引用，测试不调用）
- **TS OcrAdapter 接口**（可注入三态）：
  - `createMockOcrAdapter()`：确定性返回固定文本，不调子进程
  - `createFailingOcrAdapter()`：抛错，验证错误隔离
  - `createRealOcrAdapter(opts)`：spawn Python 桥 + 解析 stdout（本任务仅实现框架，测试用 mock）
- **子进程契约**：spawn(python, [ocr_bridge.py])，stdin/stdout JSON；路径只来自配置；错误消息固定文案，不泄漏路径/stdout/stderr/密钥
- **7 图格式单件测试**（08-Test §3.3.3）：jpg/jpeg/png/webp/gif/bmp/tiff 参数化，assert run_ocr 返回非空字符串
- **studybuddy-extension 接入**：注册 `studybuddy_ocr_schedule` 工具（课表 OCR 识别预览）
- **toolchain 依赖**：走 §6.5 统一绝对路径（`toolchain-runtime.ts` prependPath），Windows PATH 不全防失败

### 非目标（不做什么）

- 不实现真实 RapidOCR / onnxruntime 模型加载与推理（真实集成留待 E2E 受控夹具，本任务只写框架 + mock 测试）
- 不实现课表结构化解析（OCR 只返回文本，结构化解析走 S1 既有流程）
- 不做多模态 AI OCR（02-PRD §4.1）
- 不建独立数据表（OCR 是纯识别能力，无持久化）
- 不改动 contract/api.ts（OCR 是 S1 内部能力，经 `studybuddy_init_semester` / `studybuddy_ocr_schedule` 工具暴露，无独立 RPC 方法）

## 3. 文件清单

### 将创建的文件

| 文件路径 | 用途 |
|---|---|
| `scripts/ocr-bridge/ocr_bridge.py` | Python 桥：stdin/stdout JSON 协议，RapidOCR 识别返回 { text }（真实实现，测试不调用） |
| `scripts/ocr-bridge/test_ocr.py` | pytest 单件（08-Test §3.3.3 7 格式参数化）|
| `src/agent-host/handlers/s1/ocr-adapter.ts` | OcrAdapter 接口 + createMockOcrAdapter/createFailingOcrAdapter/createRealOcrAdapter（三态） |
| `src/agent-host/handlers/s1/ocr.ts` | handleOcrSchedule：图片路径校验 + adapter.recognize + 返回 { text }（错误固定文案） |
| `src/agent-host/handlers/s1/errors.ts` | 复用现有 S1 errors（若已存在则补 OCR 固定文案） |
| `src/agent/tools/s1/ocr-tools.ts` | `studybuddy_ocr_schedule` 工具 TypeBox schema + execute 薄封装 |
| `tests/unit/agent-host/s1/ocr-adapter.test.ts` | OcrAdapter 单件（三态 + 不泄漏路径/stdout） |
| `tests/unit/agent-host/s1/ocr.test.ts` | handler 单件（mock 成功 / failing 错误隔离 / 路径校验） |
| `tests/integration/agent/tools-s1-ocr.test.ts` | 扩展契约：OCR 工具注册断言 |

### 将修改的文件

| 文件路径 | 修改内容 |
|---|---|
| `src/agent/studybuddy-extension.ts` | 接入 createOcrTools，注册 `studybuddy_ocr_schedule`（工具数 34→35） |
| `src/agent-host/handlers/s1/index.ts` | 装配 handleOcrSchedule 到 S1 handler 路由 |
| `docs/04-任务清单-Todo-List.md` | §7.2.1 T-M1-005 in_progress→done + §9 统计 |
| `docs/00-文档索引-Index.md` | 版本历史同步 |
| `AGENTS.md` | §3.1 + §12 版本号同步 |

> 注：OCR 工具是否作为独立 registerTool 还是并入 `studybuddy_init_semester`，实施时以 03-Arch §3.1/§3.4 工具表为准确认。若判断 OCR 识别预览应独立暴露，则新建 `studybuddy_ocr_schedule`；否则并入 init_semester 流程。此为用户授权范围内实现决策。

## 4. 接口设计

### OcrAdapter 接口（可注入，03-Arch §3.3 + 08-Test §3.3.3）

```typescript
export interface OcrAdapter {
  /** 识别图片文本，返回纯文本（不返回 stdout 全文） */
  recognize(imagePath: string): Promise<{ text: string }>;
}

/** 默认 mock：确定性返回固定文本，不调子进程 */
export function createMockOcrAdapter(): OcrAdapter;

/** failing：抛错，验证调用方错误隔离 */
export function createFailingOcrAdapter(): OcrAdapter;

/** 真实实现：spawn Python 桥，解析 stdout JSON（本任务仅框架，测试用 mock） */
export function createRealOcrAdapter(opts: {
  pythonPath: string;
  bridgePath: string;
}): OcrAdapter;
```

### Python 桥（真实实现，测试不调用）

```python
# scripts/ocr-bridge/ocr_bridge.py
# stdin 读 JSON { "imagePath": "..." }
# 本地 RapidOCR 识别，stdout 写 JSON { "text": "..." }
# 错误：stdout 写 { "error": "固定文案" }，exit 非 0
```

### registerTool 工具（03-Arch §3.4）

```typescript
{
  name: "studybuddy_ocr_schedule",
  label: "课程表 OCR 识别预览",
  description: "本地 RapidOCR 识别课程表图片（jpg/jpeg/png/webp/gif/bmp/tiff），返回识别的原始文本供学生确认。不走多模态 AI；路径只来自配置；不返回 stdout。",
  parameters: Type.Object({
    imagePath: Type.String({ description: "课程表图片文件路径" }),
  }),
  async execute(_toolCallId, params) { /* 薄封装 handler */ }
}
```

## 5. 测试策略

### 单件测试（阶段 2）

**`scripts/ocr-bridge/test_ocr.py`**（08-Test §3.3.3）：
- [ ] `@pytest.mark.parametrize("fmt", ["jpg","jpeg","png","webp","gif","bmp","tiff"])` 断言 `run_ocr(sample_image(fmt))` 返回非空字符串
- [ ] 依赖：venv 中存在 RapidOCR/onnxruntime/PIL（此测试在 venv 就绪环境运行，真实识别）

> 注：pytest 单件测试在 OCR venv 就绪时走真实识别（08-Test §11.2 表：OCR venv 单件真实）。若本机 venv 未探测到 RapidOCR，则在测试中标注 skip，TS 侧 mock 测试保证框架逻辑。

**`tests/unit/agent-host/s1/ocr-adapter.test.ts`**（三态）：
- [ ] mock adapter 确定性返回固定文本，无子进程调用（spy 断言无 spawn）
- [ ] failing adapter 抛错
- [ ] real adapter 未配置路径 → 抛错，错误消息不含路径
- [ ] real adapter 返回值无 stdout 属性（防 stdout 泄漏）

**`tests/unit/agent-host/s1/ocr.test.ts`**（handler 单件）：
- [ ] mock adapter 成功 → 返回 { text }
- [ ] failing adapter → 错误固定文案，不含 imagePath/stdout/stderr（安全断言）
- [ ] 图片路径不存在 → BAD_REQUEST + "图片不存在"
- [ ] 错误响应不含 imagePath / pythonPath / bridgePath（安全断言）

### 集成测试（阶段 3）

**`tests/integration/agent/tools-s1-ocr.test.ts`**（扩展契约）：
- [ ] createStudyBuddyExtension setup 后工具数 = 35（34 + OCR 1）
- [ ] 工具名匹配 `^studybuddy_[a-z_]+$`
- [ ] `studybuddy_ocr_schedule` 存在且有 name/label/description/parameters/execute 必填字段
- [ ] execute 薄封装调 handler（mock ctx 注入）

### 系统冒烟（阶段 5a）

- [ ] `pnpm smoke`：现有 6 项不退化
- [ ] 测试总数增长（基线 722 + 预期 10+）

### E2E（阶段 5b，本任务范围外）

> E2E-01 学期初始化含 OCR 预览（08-Test §6.1），属 T-M1-010 已交付的 E2E 框架。本任务只确保单件 + 集成测试全绿，OCR 真实识别 E2E 受控夹具留待后续。

### 安全不变量（如涉及）

- [ ] 不连真实 RapidOCR（AGENTS.md §5.4）：TS 测试全 mock，Python 单件测试仅在 venv 就绪时真实执行
- [ ] 路径不泄漏：错误消息固定文案，不含 imagePath/pythonPath/bridgePath
- [ ] stdout/stderr 不泄漏：OcrAdapter 返回值无 stdout 属性
- [ ] 运行数据隔离：测试写 H:\pi-studybuddy-tmp\runs\T-M1-005\，不污染 %LOCALAPPDATA%\PiStudyBuddy

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | ✅ venv 已下载（04-Todo §4.1 看板），本任务不重新下载 |
| 2. 单件测试 | ✅ pytest 7 格式 + TS OcrAdapter 三态单件 |
| 3. 集成测试 | ✅ tools-s1-ocr 扩展契约 |
| 4. 系统组装 | ✅ studybuddy-extension 接入 + S1 handler 装配 |
| 5. 冒烟 + E2E | ✅ smoke 6 项不退化（真实识别 E2E 留后续） |

## 7. 依赖关系

### 前置任务

- [x] T-M1-001 S1 学习节奏工具（OCR 接入目标，已 done）
- [x] T-M0-004 toolchain 框架（统一绝对路径执行，已 done）
- [x] OCR venv 已下载（04-Todo §4.1 看板 ✅）

### 组件依赖

- `H:\AIStudyBuddy\runtime\venv\Scripts\python.exe`（OCR venv，阶段1 已下载）
- RapidOCR / onnxruntime / PIL（venv 内，真实实现引用，测试 mock）
- node:child_process（spawn，仅 createRealOcrAdapter 框架，测试用 mock）
- typebox（工具 schema，与现有 S1 一致）

## 8. 预期产物

### 代码

- `scripts/ocr-bridge/`（2 文件：ocr_bridge.py + test_ocr.py）
- `src/agent-host/handlers/s1/ocr-adapter.ts` + `ocr.ts`
- `src/agent/tools/s1/ocr-tools.ts`
- `tests/unit/agent-host/s1/`（2 文件）
- `tests/integration/agent/tools-s1-ocr.test.ts`

### 文档更新

- `docs/04-任务清单-Todo-List.md`（§7.2.1 + §9 + §10 + 头部版本 → v0.1.40）
- `docs/00-文档索引-Index.md`（版本历史 → v0.1.47）
- `AGENTS.md`（§3.1 + §12 → v0.1.27）
- `.plan/00-当前任务.md`（执行中 → 完成）

### 实施记录

- `.record/T-M1-005-实施记录.md`（收尾时创建，8 章节模板）

## 9. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（03-Arch §3.3 + 08-Test §3.3.3 + 02-PRD §4.1 已核实）
- [x] 步骤 2：检查文档门禁（无需改 contract/api.ts，OCR 是 S1 内部能力）
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [x] 步骤 4：独立审查计划（用户审查）
- [x] 步骤 5：用户批准计划（★ 用户授权，已批准开工 T-M1-005）
- [ ] 步骤 6：拆分任务、逐项实现（ocr-adapter → ocr → ocr-bridge → ocr-tools → extension 接入）
- [ ] 步骤 7：编写或更新测试（TDD RED→GREEN→REFACTOR）
- [ ] 步骤 8：type-check（pnpm type-check）
- [ ] 步骤 9：build（pnpm build）
- [ ] 步骤 10：test（pnpm test + pytest scripts/ocr-bridge/）
- [ ] 步骤 11：smoke（pnpm smoke）
- [ ] 步骤 12：独立审查并修复
- [ ] 步骤 13：更新 04-Todo v0.1.40 + 00-索引 v0.1.47 + AGENTS.md v0.1.27
- [ ] 步骤 14：文档治理检查（node scripts/check-docs-governance.mjs）
- [ ] 步骤 15：diff 检查 + 实施记录创建（.record/T-M1-005-实施记录.md）
- [ ] 步骤 16：提交交付（★ 用户授权，AGENTS.md §8.3）

## 10. 证据登记

- 测试日志路径：H:\pi-studybuddy-tmp\runs\T-M1-005\
- verify 状态：type-check + build + test + smoke + docs-governance 待实施后登记
- 提交哈希 / 推送状态：实施后登记

---

## 审查记录

步骤 4 独立审查：用户在会话中批准开工（登记 T-M1-005 in_progress + 创建详细计划），计划已审查通过进入实施。

## 单一执行任务门禁核查（AGENTS.md §4.4）

创建本详细计划的三项前置条件已全部满足：
1. ✅ T-M2-009 已正式完成（§8.4 三者齐全：04-Todo v0.1.38 + master 671f010 + origin/master 推送成功）
2. ✅ 用户已明确批准 T-M1-005 OCR venv Adapter 开工
3. ✅ 该任务即将进入实施

> 本计划严格遵守 §4.4：用户批准开工后才创建详细计划，含文件清单、命令、预期输出和实现步骤。