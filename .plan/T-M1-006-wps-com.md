# 任务计划：T-M1-006 WPS COM 桥（doc/ppt/xls 转换）

**任务 ID**：T-M1-006
**日期**：2026-08-08
**状态**：📝 待审查
**关联文档**：03-Arch §3.3（WPS COM 桥）+ 08-Test §3.3.1（pytest 契约）+ 07-WF §2.3（S2 转换管道）+ 06-API §3.4（materials.*）
**里程碑**：M1 核心闭环 MVP

---

## 1. 任务目标

### 做什么
实现 WPS COM 桥组件：把旧版 doc/ppt/xls 文件转换为 docx/pptx/xlsx 中间格式，再走 S2 现有转换管道（上传 → 转换 → AI 笔记）。复用 OCR venv 的 Python 运行时（`H:\AIStudyBuddy\runtime\venv\Scripts\python.exe`），pywin32 经 WPS COM（ProgID：KWPS/KET/KWPP.Application）打开并"另存为"新格式。

### 为什么
- S2 资料上传支持 doc/ppt/xls（03-Arch §3.1 `studybuddy_upload_material`），但 S2 转换管道只认 docx/pptx/xlsx/pdf/image。旧版格式必须先转中间格式（03-Arch §3.3）。
- materials.convert 的 `inferConvertJobType` 已把 doc/ppt/xls 映射为 `wps_convert` job_type（[materials.ts](file:///h:/pi-studybuddy/src/agent-host/handlers/s2/materials.ts#L91-L105)），但真实转换器尚未实现——本任务补齐。
- T-M1-007 资料转换管道依赖本任务（§7.5 全局执行顺序第 7 行前置 = T-M1-005 + T-M1-006）。

### 依据
03-Arch §3.3（WPS COM 桥契约：pywin32 子进程 + stdin/stdout JSON + 子进程隔离 WPS 崩溃 + doc→docx/ppt→pptx/xls→xlsx）+ 08-Test §3.3.1（pytest：doc→docx 归一化 JSON / 崩溃隔离 / JSON 协议）+ 08-Test §1.3 第 6 条（WPS COM 单件需真实 WPS；集成/E2E 可 mock 子进程返回）。

## 2. 范围与非目标

### 范围
- Python 桥 `scripts/wps-bridge/wps_bridge.py`：pywin32 调 WPS COM，doc→docx / ppt→pptx / xls→xlsx
- pytest 单件 `scripts/wps-bridge/test_wps_convert.py`（08-Test §3.3.1 三用例）
- TS `WpsAdapter` 三态（mock / failing / real），参照 `ocr-adapter.ts` 模式
- 接入 S2 转换管道：materials.convert 的 `wps_convert` job_type 执行真实转换（注入 adapter 时）
- 测试运行数据隔离 `H:\pi-studybuddy-tmp\runs\T-M1-006\`

### 非目标（不做什么）
- **不注册独立 `studybuddy_wps_convert` 工具**：WPS 转换是转换管道的一步，经既有 `studybuddy_convert_material` 触发，无独立业务场景（与 OCR 的 `studybuddy_ocr_schedule` 不同——那是独立课表识别场景）。若用户要求对称独立工具，另行评估。
- **不连真实 WPS 进行集成/E2E 测试**：单件 pytest 可真实（08-Test §1.3 第 6 条），集成/E2E 用 mock 子进程返回（08-Test §9.3）。
- **不做 T-M1-007 资料转换管道**（PDF/DOCX/PPTX/图片 OCR 编排）——那是下一任务。
- **不修改 pi 内核**：仅业务 Adapter 层（AGENTS.md §1.1）。
- **不做 docx/pptx/xlsx 的文本提取**：本桥只做"旧格式→新格式"转换，新格式提取属 T-M1-007。

## 3. 文件清单

### 将创建的文件
| 文件路径 | 用途 |
|---|---|
| `scripts/wps-bridge/wps_bridge.py` | Python 桥：pywin32 + WPS COM，stdin/stdout JSON 协议，doc/ppt/xls → docx/pptx/xlsx |
| `scripts/wps-bridge/test_wps_convert.py` | pytest 单件（08-Test §3.3.1 三用例：转换归一化 JSON / 崩溃隔离 / JSON 协议） |
| `src/agent-host/handlers/s2/wps-adapter.ts` | TS WpsAdapter 三态（mock/failing/real），ref ocr-adapter.ts |
| `src/agent-host/handlers/s2/wps-adapter.test.ts` | WpsAdapter 单件（vitest） |
| `src/agent-host/handlers/s2/wps-bridge.test.ts` | （如需）S2 转换管道集成测试 |

### 将修改的文件
| 文件路径 | 修改内容 |
|---|---|
| `src/agent-host/handlers/s2/materials.ts` | `wps_convert` job_type 执行真实转换（注入 WpsAdapter 时），写 normalized_texts + Material→converted |
| `src/agent-host/handlers/s2/context.ts` | S2Context 增加 WpsAdapter 注入槽（ref ocr 的 S1 Context 注入） |
| `docs/04-任务清单-Todo-List.md` | 任务状态 + 证据登记（收尾时） |
| `docs/00-文档索引-Index.md` | 版本号同步（收尾时） |
| `AGENTS.md` | §3.1 版本号同步（收尾时） |

## 4. 接口设计

### Python 桥 JSON 协议（stdin/stdout，03-Arch §3.3）
```
输入：{"action":"convert","inPath":"<绝对路径>","outDir":"<绝对输出目录>"}
输出：{"status":"ok","outPath":"<新文件绝对路径>","outFileName":"test.docx"}   （exit 0）
     {"status":"error","error":"<固定文案>"}                                    （exit 非 0）
```
- 支持扩展名：doc→docx、ppt→pptx、xls→xlsx（按输入扩展名选 WPS ProgID：KWPS/KET/KWPP.Application）
- 复用 OCR venv python.exe；错误固定文案，不泄漏路径/stdout/stderr/密钥

### WpsAdapter 接口（TS，ref ocr-adapter.ts）
```typescript
export interface WpsConvertResult { outPath: string; outFileName: string; }
export interface WpsAdapter {
  convert(inPath: string, outDir: string): Promise<WpsConvertResult>;
}
// 三态：createMockWpsAdapter / createFailingWpsAdapter / createRealWpsAdapter({pythonPath, bridgePath})
```

### materials.convert 集成点
- `inferConvertJobType` 已把 doc/ppt/xls → `wps_convert`（[materials.ts](file:///h:/pi-studybuddy/src/agent-host/handlers/s2/materials.ts#L91-L105)）
- 本任务：`materials.convert` 对 `wps_convert` job_type 且已注入 WpsAdapter 时，执行真实转换（调用 `WpsAdapter.convert`），成功后 Material→converted + Job→completed；失败 Material→conversion_failed + Job→failed。
- **边界**：本任务只做"旧格式→新格式"转换（doc→docx 中间格式），**不写 normalized_texts**——文本提取属 T-M1-007（§2 非目标）。materials.convert 由同步改为 async（RPC 层已支持 Promise，06-API §2.2 返回值 Job 不变）。

### 数据表
无新增表（转换结果写既有 `normalized_texts` + `materials` 状态迁移，05-ERD §3.2）。

## 5. 测试策略

### 单件测试（阶段 2）
- [ ] pytest `doc → docx`：`run_wps_bridge(["convert","--in","test.doc","--out",tmp])` → `status=="ok"` 且 `test.docx` 存在（08-Test §3.3.1）
- [ ] pytest `ppt → pptx` / `xls → xlsx`：同 doc 模式（参照 08-Test §3.3.1，参数化三格式）
- [ ] pytest `崩溃隔离`：非法输入 → 子进程退出码非 0 → 主进程收到对应错误（08-Test §3.3.1）
- [ ] pytest `JSON 协议`：stdin/stdout 严格 JSON，无额外输出污染（08-Test §3.3.1 `ping`）
- [ ] vitest `WpsAdapter.mock`：确定性返回固定 outPath，不调真实子进程
- [ ] vitest `WpsAdapter.failing`：抛 INTERNAL_ERROR + 固定文案，验证调用方错误隔离
- [ ] vitest `WpsAdapter.real`：路径未配置 → INTERNAL_ERROR + "未配置"固定文案；不触发真实 spawn（AGENTS.md §5.4）

### 集成测试（阶段 3）
- [ ] materials.convert（wps_convert）注入 mock adapter → Job 登记 + Material 状态迁移 + normalized_texts 写入
- [ ] adapter 抛错 → 转换失败路径（Material→conversion_failed / Job→failed）

### 系统冒烟（阶段 5a）
- [ ] WPS 桥随 S2 管道冒烟（真实 WPS 可用时走真实转换；不可用走 mock 子进程）

### E2E（阶段 5b）
- [ ] 影响范围：E2E-02 资料笔记全链（doc 上传→转换→笔记）如涉及；本任务以单件+集成为主，E2E 留待 T-M1-007

### 安全不变量
- [ ] 错误消息固定文案，不泄漏 inPath/pythonPath/stdout/stderr/密钥（03-Arch §3.3 + 08-Test §3.3.1）
- [ ] 子进程失败不影响主进程（崩溃隔离）

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | ✅ 已完成（pywin32 已装到 OCR venv + WPS 已装 + ProgID 已探测注册） |
| 2. 单件测试 | ⏳ 本任务核心（pytest 桥 + vitest adapter） |
| 3. 集成测试 | ⏳ 本任务（materials.convert 接入） |
| 4. 系统组装 | ⏳ 本任务（代码进 src/ + 类型检查 + lint） |
| 5. 冒烟 + E2E | ⏳ 本任务（冒烟；E2E 留 T-M1-007） |

## 7. 依赖关系

### 前置任务
- [x] T-M1-005：OCR venv Adapter（已完成，本任务复用同一 venv 运行时 + 桥模式）
- [x] T-M1-002：S2 资料/笔记/知识模块（已完成，materials.convert 的 wps_convert job_type 已预留）

### 组件依赖
- [x] WPS COM（KWPS/KET/KWPP.Application ProgID 已注册，WPS 12.1.0.28043）
- [x] OCR venv Python 运行时（`H:\AIStudyBuddy\runtime\venv\Scripts\python.exe`）
- [x] pywin32（pywin32-312 已装到 OCR venv）

## 8. 预期产物

### 代码
- `scripts/wps-bridge/wps_bridge.py` + `test_wps_convert.py`
- `src/agent-host/handlers/s2/wps-adapter.ts` + `wps-adapter.test.ts`
- `src/agent-host/handlers/s2/materials.ts`（wps_convert 真实转换接入）+ `context.ts`（adapter 注入）

### 文档更新
- `docs/04-Todo-List.md`（T-M1-006 状态 + 证据）
- `docs/00-文档索引-Index.md` + `AGENTS.md`（版本号同步）

### 实施记录
- `.record/T-M1-006-实施记录.md`（收尾时创建，8 章节）

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
- [ ] 步骤 16：提交交付（★ 用户授权）— 等待用户授权

## 10. 证据登记（收尾时填写）

- 测试日志路径：
- 提交哈希：
- 推送状态：
- 实施记录路径：

---

## 审查记录

**步骤 4 独立审查（2026-08-08）— 通过**
- 任务边界：桥 + Adapter + 接入 S2 管道，非目标清晰（不注册独立工具 / 不做 T-M1-007 / 不连真实 WPS 集成测试）
- 文件清单：4 新建 + 5 修改，完整无遗漏
- 接口设计：JSON 协议 + WpsAdapter 三态，与 03-Arch §3.3 / 06-API §3.4 一致
- 测试策略：覆盖转换 / 崩溃隔离 / JSON 协议 / 错误固定文案不泄漏四类不变量
- 铁律核对：子进程隔离 + 错误不泄漏路径/stdout/stderr/密钥 + 数据隔离 `H:\pi-studybuddy-tmp\runs\T-M1-006\` + 集成/E2E 用 mock 子进程（08-Test §5.4）
- 结论：✅ 通过，进入步骤 5 用户批准

**步骤 5 用户批准（2026-08-08）— 用户已明确批准开工**
- 用户回复："批准" → 本任务进入执行阶段（步骤 6-11）
- 状态：in_progress（04-Todo v0.1.41 已登记）

## 完成记录

- 完成日期：2026-08-08
- 实施记录：.record/T-M1-006-实施记录.md
- 状态：⬜ 待提交授权（步骤 16 等待用户授权）