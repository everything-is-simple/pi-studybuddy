# 任务计划：T-M1-007 资料转换管道（PDF/DOCX/PPTX/图片 OCR 编排 + normalized_texts 写入）

**任务 ID**：T-M1-007
**日期**：2026-08-08
**状态**：✅ 已完成（步骤 1-15 完成，步骤 16 待用户授权提交）
**关联文档**：07-WF §2.3（S2 转换管道）+ 03-Arch §3.3（外部桥 Adapter + §5.3 studybuddy-format-* 引擎依赖）+ 05-ERD §3.2.2（normalized_texts）+ 06-API §3.4（materials.*）+ 08-Test §3.3（转换管道测试）
**里程碑**：M1 核心闭环 MVP

---

## 1. 任务目标

### 做什么
补全 S2 资料转换管道：为 PDF/DOCX/PPTX/XLSX/图片 五类格式实现真实文本提取/OCR，编排进 `materials.convert` / `materials.retryConversion`，转换成功后写入 `normalized_texts` 并置 Material→converted；失败置 conversion_failed + Job→failed。同时补齐 T-M1-006 遗留的 wps_convert 后续文本提取（doc/ppt/xls 转中间格式后仍需提取新格式文本写 normalized_texts）。

### 为什么
- 07-WF §2.3 规定 S2 转换管道：`pdf→pdf-parse / docx→jszip+mammoth / pptx→jszip / xlsx→jszip sharedStrings / doc/ppt/xls→WPS COM 桥转中间格式 / image→OCR venv`，转换成功**必须**写 `normalized_texts` + `materials.status=converted`。
- 当前 `materials.convert` 除 `wps_convert`（T-M1-006）外，对 `convert_pdf/convert_docx/convert_pptx/convert_xlsx/ocr_image` 仅登记 Job 不执行真实转换器（[materials.ts](file:///h:/pi-studybuddy/src/agent-host/handlers/s2/materials.ts#L213-L232)），且 `wps_convert` 成功后**不写 normalized_texts**（T-M1-006 §2 非目标留待本任务）。
- T-M1-008 跨切钩子依赖本任务（§7.5 全局执行顺序第 7 行前置 = T-M1-005 + T-M1-006 + T-M1-007）。

### 依据
07-WF §2.3（转换分派矩阵 + 成功写 normalized_texts）+ 03-Arch §5.3（studybuddy-format-* 引擎依赖：pdf-parse / jszip+mammoth / jszip）+ 05-ERD §3.2.2（normalized_texts 表 UNIQUE(material_id)）+ 08-Test §1.3 第 6 条（文本提取 node 库单件真实；OCR 受控夹具）+ 03-Arch §3.3（桥 Adapter 模式，错误固定文案不泄漏路径）。

## 2. 范围与非目标

### 范围
- `TextExtractor` 文本提取器组件（Node 库：pdf-parse / jszip / mammoth），三态（mock / failing / real），参照 `ocr-adapter.ts` / `wps-adapter.ts` 模式
- 接入 OcrAdapter 到 `ocr_image` job_type（复用 T-M1-005 的 `createMockOcrAdapter/createFailingOcrAdapter/createRealOcrAdapter`）
- 编排 `materials.convert` / `retryConversion`：按 job_type 分派提取器/OCR，成功写 `normalized_texts` + Material→converted，失败 conversion_failed + Job→failed
- 补齐 wps_convert 成功后对中间格式（docx/pptx/xlsx）的文本提取并写 normalized_texts
- 测试运行数据隔离 `H:\pi-studybuddy-tmp\runs\T-M1-007\`

### 非目标（不做什么）
- **不新增独立 `studybuddy_*` 工具**：转换管道经既有 `materials.convert` 触发，不注册新的 format 工具（03-Arch §5.3 的 studybuddy-format-* 是技能供给清单，主干经 RPC 方法触发，不重复注册）。
- **不做 ODF/RTF/EPUB 提取**：07-WF §2.3 列了 odt/ods/odp/rtf/epub，但 05-ERD §3.2.1 的 file_type CHECK 七类仅 pdf/docx/pptx/xlsx/image/doc/ppt/xls，`classifyFileType` 不允许 odt/rtf/epub 上传（[materials.ts](file:///h:/pi-studybuddy/src/agent-host/handlers/s2/materials.ts#L45-L52)）。故 ODF/RTF/EPUB 不在本任务范围。
- **不做 AI 笔记生成**：`generateNote` 维持既有 Job 登记入口，不接真实 AI（独立后续，且受 AGENTS.md §5.4 mock 约束）。
- **不连真实 pdf-parse/mammoth 做集成/E2E**：单件测试用合成夹具（jszip 手工构建最小 docx/pptx/xlsx XML）+ 受控 pdf 夹具；集成/E2E 用 mock（08-Test §1.3 第 6 条）。
- **不修改 pi 内核**：仅业务 Adapter 层（AGENTS.md §1.1）。
- **不做 T-M1-008 跨切钩子**：那是下一任务。

## 3. 文件清单

### 将创建的文件
| 文件路径 | 用途 |
|---|---|
| `src/agent-host/handlers/s2/text-extractor.ts` | TextExtractor 接口 + 三态（mock/failing/real），Node 库 pdf-parse/jszip/mammoth 文本提取框架 |
| `src/agent-host/handlers/s2/text-extractor.test.ts` | TextExtractor 单件（vitest）：mock 确定性 / failing 抛错 / real 路径未配置错误 |
| `src/agent-host/handlers/s2/text-extractors.test.ts` | （如需）合成夹具驱动真实 docx/pptx/xlsx 提取单件（jszip 构建最小 OOXML） |
| `tests/integration/t-m1-007-convert-pipeline.test.ts` | 转换管道集成测试：五类格式 convert 成功写 normalized_texts + wps 中间格式补提取 + 失败路径 |

### 将修改的文件
| 文件路径 | 修改内容 |
|---|---|
| `src/agent-host/handlers/s2/context.ts` | S2Context 增加 textExtractor + ocrAdapter 注入槽（ref wps 注入） |
| `src/agent-host/handlers/s2/materials.ts` | convert/retryConversion 按 job_type 分派提取器/OCR，成功写 normalized_texts + Material→converted；wps_convert 成功后补中间格式文本提取 |
| `package.json` | 新增依赖：jszip / pdf-parse / mammoth（download 阶段，走五阶段组件治理） |
| `docs/04-任务清单-Todo-List.md` | 任务状态 + 证据登记（收尾时） |
| `docs/00-文档索引-Index.md` | 版本号同步（收尾时） |
| `AGENTS.md` | §3.1 版本号同步（收尾时） |

## 4. 接口设计

### TextExtractor 接口（TS，ref ocr-adapter / wps-adapter）
```typescript
export interface TextExtractResult { text: string; }
export interface TextExtractor {
  /** 提取文件文本，返回纯文本（不返回 stdout 全文） */
  extract(filePath: string, fileType: string): Promise<TextExtractResult>;
}
// 三态：createMockTextExtractor / createFailingTextExtractor / createRealTextExtractor({pdf, docx, pptx, xlsx})
```

### 文本提取分派矩阵（07-WF §2.3 + 03-Arch §5.3）
| file_type | Node 库 | 提取目标 |
|---|---|---|
| pdf | pdf-parse | PDF 正文文本 |
| docx | jszip + mammoth | word/document.xml → 文本 |
| pptx | jszip | ppt/slides/slide*.xml → 文本 |
| xlsx | jszip | xl/sharedStrings.xml → 文本 |
| image | OcrAdapter（复用 T-M1-005 venv 桥） | 图片 OCR 文本 |

### 安全不变量（复用既有模式）
- 路径未配置 → INTERNAL_ERROR + 固定文案"文档文本提取未配置，请在设置中指定提取引擎路径"
- 提取失败 → INTERNAL_ERROR + 固定文案"文档文本提取失败，请检查文件是否完整或已损坏"
- 返回值仅含 `{ text }`，不含 stdout/stderr（08-Test §3.3 断言）
- 错误消息固定文案，不泄漏路径/stdout/stderr/密钥（03-Arch §3.3 + AGENTS.md §9.3）

### materials.convert 编排集成点
- 现有 `inferConvertJobType` 已把 pdf/docx/pptx/xlsx→convert_*/image→ocr_image（[materials.ts](file:///h:/pi-studybuddy/src/agent-host/handlers/s2/materials.ts#L91-L105)）
- 本任务：`materials.convert` 对 `convert_pdf/convert_docx/convert_pptx/convert_xlsx/ocr_image` 且已注入对应 adapter 时，执行真实提取：
  - 成功：写 `normalized_texts`（content_hash + char_count + source_type=upload + extraction_meta_json）+ Material→converted + Job→completed
  - 失败：Material→conversion_failed + Job→failed（error_message 固定文案）
- `wps_convert`：T-M1-006 已实现格式转换（Material→converted + Job→completed），本任务补齐转换后对中间格式（docx/pptx/xlsx）的文本提取并写 normalized_texts
- **注入边界**：未注入 adapter 时维持既有"仅登记 Job"语义（03-Arch 延后执行），与 wps_convert/T-M1-006 一致

### 数据表
无新增表（写既有 `normalized_texts` + `materials` 状态迁移，05-ERD §3.2.2）。`normalized_texts` UNIQUE(material_id)：先删后插（ref materials.replaceText 既有模式）。

## 5. 测试策略

### 单件测试（阶段 2）
- [ ] vitest `TextExtractor.mock`：确定性返回固定文本，不调真实库
- [ ] vitest `TextExtractor.failing`：抛 INTERNAL_ERROR + 固定文案，验证调用方错误隔离
- [ ] vitest `TextExtractor.real`：路径未配置 → INTERNAL_ERROR + "未配置"固定文案；不触发真实库（AGENTS.md §5.4）
- [ ] vitest 合成夹具：jszip 构建最小 docx（word/document.xml）/pptx（ppt/slides/slide1.xml）/xlsx（xl/sharedStrings.xml）→ real 提取返回预期文本（受控夹具，08-Test §1.3 第 6 条）

### 集成测试（阶段 3）
- [ ] convert_pdf/convert_docx/convert_pptx/convert_xlsx 注入 mock TextExtractor → Job 登记 + Material→converted + normalized_texts 写入（content_hash/char_count 正确，先删后插幂等）
- [ ] ocr_image 注入 mock OcrAdapter → 同上 + source_type 区分
- [ ] wps_convert 注入 mock WpsAdapter + mock TextExtractor → 格式转换 + 中间格式文本提取 + normalized_texts 写入
- [ ] 提取器抛错 → conversion_failed + Job→failed（error_message 固定文案不泄漏路径）
- [ ] 未注入 adapter → 仅登记 Job（pending + converting），保持既有语义

### 系统冒烟（阶段 5a）
- [ ] 转换管道随 S2 管道冒烟（真实库可用时走真实提取；不可用走 mock）

### E2E（阶段 5b）
- [ ] 影响范围：E2E-02 资料笔记全链（pdf/docx/pptx/xlsx/image 上传→转换→笔记）如涉及；本任务以单件+集成为主，E2E 留待 T-M1-008 或受影响用例回归

### 安全不变量
- [ ] 错误消息固定文案，不泄漏 inPath/pythonPath/stdout/stderr/密钥（03-Arch §3.3 + 08-Test §3.3）
- [ ] 子进程失败不影响主进程（崩溃隔离，复用既有模式）

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | ⏳ 本任务（jszip/pdf-parse/mammoth `pnpm add` 落地 node_modules） |
| 2. 单件测试 | ⏳ 本任务核心（TextExtractor 三态 + 合成夹具） |
| 3. 集成测试 | ⏳ 本任务（materials.convert 编排接入） |
| 4. 系统组装 | ⏳ 本任务（代码进 src/ + 类型检查 + lint） |
| 5. 冒烟 + E2E | ⏳ 本任务（冒烟；E2E 留 T-M1-008 / 受影响用例回归） |

## 7. 依赖关系

### 前置任务
- [x] T-M1-005：OCR venv Adapter（已完成，本任务复用 createMock/Failing/Real OcrAdapter）
- [x] T-M1-006：WPS COM 桥（已完成，本任务复用 WpsAdapter + 补齐中间格式文本提取）
- [x] T-M1-002：S2 资料模块（已完成，inferConvertJobType 七类 job_type 已预留）

### 组件依赖
- [ ] jszip（DOOXML 解压提取，需 `pnpm add`）
- [ ] pdf-parse（PDF 文本提取，需 `pnpm add`）
- [ ] mammoth（DOCX 文本提取，需 `pnpm add`）
- [x] OcrAdapter（T-M1-005 已建，复用）
- [x] WpsAdapter（T-M1-006 已建，复用）

## 8. 预期产物

### 代码
- `src/agent-host/handlers/s2/text-extractor.ts` + 单件测试
- `src/agent-host/handlers/s2/context.ts`（textExtractor + ocrAdapter 注入槽）
- `src/agent-host/handlers/s2/materials.ts`（convert/retry 编排 + normalized_texts 写入 + wps 中间格式补提取）
- `tests/integration/t-m1-007-convert-pipeline.test.ts`

### 依赖
- `package.json` 新增 jszip / pdf-parse / mammoth

### 文档更新
- `docs/04-Todo-List.md`（T-M1-007 状态 + 证据）
- `docs/00-文档索引-Index.md` + `AGENTS.md`（版本号同步）

### 实施记录
- `.record/T-M1-007-实施记录.md`（收尾时创建，8 章节）

## 9. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界
- [x] 步骤 2：检查文档门禁
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [x] 步骤 4：独立审查计划
- [x] 步骤 5：用户批准计划（★ 用户授权）
- [x] 步骤 6：拆分任务、逐项实现
- [x] 步骤 7：编写或更新测试（TDD）
- [x] 步骤 8：type-check
- [x] 步骤 9：build
- [x] 步骤 10：test
- [x] 步骤 11：smoke / E2E
- [x] 步骤 12：独立审查并修复
- [x] 步骤 13：更新 04-Todo + 文档
- [x] 步骤 14：文档治理检查
- [x] 步骤 15：diff 检查
- [ ] 步骤 16：提交交付（★ 用户授权）

## 10. 证据登记（收尾时填写）

- 测试日志路径：
- 提交哈希：
- 推送状态：
- 实施记录路径：

---

## 审查记录

**步骤 4 独立审查（2026-08-08）— 通过**
- 任务边界：补全五类格式文本提取 + 编排 + normalized_texts 写入，非目标清晰（不新增独立工具 / 不做 ODF-RTF-EPUB / 不做 AI 笔记 / 不连真实库做集成）
- 文件清单：新建 + 修改完整无遗漏（text-extractor + 单件 + 合成夹具 + 集成测试；context/materials/package.json 修改）
- 接口设计：TextExtractor 三态 + 分派矩阵 + 安全不变量，与 07-WF §2.3 / 03-Arch §5.3 / 05-ERD §3.2.2 一致
- 测试策略：覆盖 mock/failing/real + 合成夹具 + 集成编排 + 失败路径 + 错误不泄漏
- 铁律核对：数据隔离 `H:\pi-studybuddy-tmp\runs\T-M1-007\` + 集成/E2E 用 mock（08-Test §5.4）+ 错误不泄漏路径/stdout/stderr/密钥
- 实现细节核对：
  - `inferConvertJobType` 已把 pdf/docx/pptx/xlsx→convert_*/image→ocr_image（materials.ts L91-105），计划编排点正确
  - `normalized_texts` UNIQUE(material_id)（semester.sql.ts L139-149），写前先删后插（ref replaceText 既有语义）
  - wps_convert 现有 runWpsConversion 丢弃 adapter.convert 返回值（materials.ts L415），本任务需捕获 outPath 以补中间格式文本提取——已识别为实现点
  - 现有 s2-process MAT-09 对 convert_pdf 仅登记 Job（pending+converting），未注入 adapter 语义保留，注入 mock 后才走真实路径，不破坏既有测试
  - smoke.mjs 不涉及 materials.convert，本任务冒烟/E2E 影响范围准确
- 结论：✅ 通过，进入步骤 5 用户批准

## 完成记录

- 完成日期：2026-08-08
- 实施记录：.record/T-M1-007-实施记录.md
- 状态：✅ 已完成（步骤 16 待用户授权 commit + push）
- 测试：773 单元/集成 + 80 E2E 全绿 + verify 全绿（执行 8 跳过 2）+ smoke 6/6 + 文档治理通过
- 关键交付：TextExtractor 三态 + pdf-parse/jszip/mammoth 真实提取 + OcrAdapter 复用接入 ocr_image + materials.convert/retryConversion 编排 + normalized_texts 写入 + wps_convert 中间格式补提取