# 任务计划：T-M2-001 S5 期末冲刺（模拟考/速背卡/冲刺计划）工具注册 + API

**任务 ID**：T-M2-001
**日期**：2026-08-07
**状态**：📝 待审查
**关联文档**：04-Todo §6.4 + §7.3 / 07-WF §2.6 + §8.8 / 06-API §3.7 / 05-ERD §3.5 + §6.3 / 03-Arch §3.1 / 08-Test §3.2 + §5.5 + §6.2
**里程碑**：M2 完整闭环（首任务）

> 里程碑归属说明：`.plan/00-当前任务.md` 旧文与用户口述称"M1 剩余"，但按权威链 04-Todo（优先级5）> .plan（优先级6），S5 属 M2（04-Todo §6.4 M2 范围含 S5 + §7.3 M2 任务大纲第 1 行）。S5 是 M2 首任务故序号 001。开工时同步修正 `.plan/00` 表述。

---

## 1. 任务目标

### 做什么
实现 S5 期末冲刺全链路：模拟考（mockExams 6 方法）+ 临考速背（cramCards 1 方法）+ 冲刺计划（cramPlan 1 方法），共 8 RPC handler + 2 studybuddy_* registerTool 工具 + S5Context + 可注入 MockExamGenerator + 确定性聚合器 + DTO 对齐 ERD §3.5 + studybuddy-extension 接入。

### 为什么
闭合"已确认考试 → 模拟考 → 批改 → 弱项分析 → 速背卡 + 冲刺计划"考前冲刺链路（02-PRD §3.6 考试驱动学习闭环的临考段）。S5 只读复用 S1/S2/S3/S4 摘要，不反写历史事实，是 M2 完整闭环的首个任务（04-Todo §6.4）。

### 依据
- 04-Todo §7.3 行438（M2 任务大纲 S5）+ §6.4（M2 范围 + 退出门槛）
- 07-WF §2.6（S5 三入口流程）+ §8.8（模拟考状态机 in_progress→submitted→graded）
- 06-API §3.7（S5 8 方法表）+ 行471（getPaper 未提交不含 correct_answer 防泄露）
- 05-ERD §3.5（S5 五表 schema，T-M0-006 已建库）+ §6.3（trg_mockpaper_attempt_confirmed 触发器）+ §5 ER 关系
- 03-Arch §3.1 行242-247（S5 ExamCrammer 2 工具：studybuddy_generate_mock_exam + studybuddy_submit_mock_exam）
- 08-Test §3.1/§3.2（单件/集成断言）+ §5.5 行526（速背卡/冲刺计划确定性只读）+ §5.5 行565（模拟考状态机）+ §6.2 行413-414（E2E-04）

---

## 2. 范围与非目标

### 范围
1. **8 RPC handler**（06-API §3.7）：
   - mockExams.generatePaper / getPaper / startAttempt / submitAttempt / getResult / getModuleAnalyses（6）
   - cramCards.get（1，确定性只读 DTO）
   - cramPlan.get（1，确定性即时只读 7 天 DTO）
2. **2 studybuddy_* registerTool 工具**（03-Arch §3.1 行246-247）：
   - studybuddy_generate_mock_exam（AI 生成限时模拟卷，触发器校验 confirmed，source_hash 防重复）
   - studybuddy_submit_mock_exam（学生限时作答 + 规则批改客观题）
3. **S5Context** 数据层句柄管理（复用 S1/S2/S3/S4 模式 + lookup 跨库查找 + 注入 MockExamGenerator）
4. **MockExamGenerator 可注入接口**（默认 mock，类似 S3 QuestionGenerator；AI 失败不创建空卷→INTERNAL_ERROR）
5. **复用 S3 grader 三策略**（单选精确/多选 deepEquals/填空 normalize+多等价）批改客观题
6. **cramCards/cramPlan 确定性聚合器**（只读 S1 tasks/S2 modules/S3 practice/S4 mistakes+weak_points 摘要）
7. **source_hash 防重复生成**同一套卷
8. **模块分析** weakness_level strong/medium/weak + UNIQUE(mock_attempt_id, knowledge_module_id)
9. **study_events 写入**（event_type=mock_exam_completed, source_system='S5'）
10. **DTO 对齐 ERD §3.5**（前置修正 types.ts，见 §3 前置）
11. **studybuddy-extension 接入 S5 工具**（19 → 21 工具）

### 非目标（不做什么）
- 真实 LLM 模拟卷生成（MockExamGenerator 默认 mock，真实 LLM 待后续）
- 09-UI S5 标签页业务 UI（壳层任务，04-Todo §7.3 行445）
- 接入 agent-host Host RPC（与 S1-S4 一致，留待壳层 UI 任务统一补全）
- 改 semester.db 表结构（T-M0-006 已定；DTO 与 schema 不一致按权威链 05-ERD > types.ts 修正 types.ts）
- 改 api.ts 方法签名（仅 types.ts DTO 对齐；api.ts 行233-248 签名已就绪）
- S5 反写 S1/S2/S3/S4 历史事实（S5 只读复用摘要）
- 题干/答案/作答/速背正文进 S6 家长报告（07-WF §2.6 行277）
- S6 / S7 / TTS / 备份恢复（独立任务）
- E2E-04 全链实施（08-Test §6.2，留待 M2 退出门槛或独立 E2E 任务；本任务做单件 + 集成断言）

---

## 3. 前置 DTO 对齐（参考 T-M1-001 v0.1.16 模式）

核实 `src/contract/types.ts` 行502-555 S5 DTO vs 05-ERD §3.5 schema，按权威链 05-ERD（优先级4）> types.ts（优先级7）修正：

| DTO | 偏离点 | 修正方向（依据 05-ERD） |
|---|---|---|
| `MockExamPaper` | 缺 7 字段 + timeLimit 命名 | 补 courseInstanceId/paperTitle/questionCount/totalScore/aiModel/promptVersion/generatedAt；timeLimit→timeLimitMinutes（§3.5.1 行624-637） |
| `MockExamPaper.questions` | 用 QuestionDTO[] 但未明确含哪些字段 | 保留 questions: QuestionDTO[]（聚合视图，paper 表 + mock_exam_questions 表联读）；核实 QuestionDTO 字段是否含防泄露支持（参考 S3 getQuestions） |
| `MockExamAttempt.status` | **缺 graded**（状态机偏离） | 改 `"in_progress" \| "submitted" \| "graded"`（§3.5.3 行682-683 CHECK + 07-WF §8.8） |
| `MockExamAttempt` | 缺 8 字段 | 补 courseInstanceId/submittedAt/gradedAt/totalScore/maxScore/correctCount/durationMs/createdAt（§3.5.3 行678-692） |
| `MockExamResult` | 缺汇总字段 | 补 totalScore/maxScore/correctCount（§3.5.3 行687-690 + 06-API §3.7 行286 展示总分/正确率/耗时/模块分析） |
| `MockExamModuleAnalysis.strength` | **缺 medium**（CHECK 偏离） | 改 `"strong" \| "medium" \| "weak"`（§3.5.5 行726-727 CHECK） |
| `MockExamModuleAnalysis` | 缺 2 字段 | 补 totalQuestions/correctCount（§3.5.5 行723-724） |
| `CramCard` | 已对齐 | ✅ 无需修改（§3.7 行296-308） |
| `CramPlanDay` | 已对齐 | ✅ 无需修改（§3.7 行316-328） |

**对齐后** type-check + 现有 383 测试全绿，再进入 S5 handler 实现。

---

## 4. 文件清单

### 将创建的文件

| 文件路径 | 用途 |
|---|---|
| `src/agent-host/handlers/s5/context.ts` | S5Context 类（复用 S4 模式 + 注入 MockExamGenerator + PI_STUDYBUDDY_DATA_ROOT 隔离） |
| `src/agent-host/handlers/s5/mock-exams.ts` | 6 方法（generatePaper/getPaper/startAttempt/submitAttempt/getResult/getModuleAnalyses） |
| `src/agent-host/handlers/s5/cram-cards.ts` | 1 方法（get，确定性只读聚合） |
| `src/agent-host/handlers/s5/cram-plan.ts` | 1 方法（get，确定性即时只读 7 天聚合） |
| `src/agent-host/handlers/s5/mock-exam-generator.ts` | MockExamGenerator 接口 + MockExamQuestion 类型 + createMockMockExamGenerator() + createFailingMockExamGenerator() |
| `src/agent-host/handlers/s5/aggregator.ts` | 私有确定性聚合逻辑（cramCards/cramPlan 只读 S1/S2/S3/S4 摘要） |
| `src/agent-host/handlers/s5/dto.ts` | mapPaper/mapAttempt/mapResult/mapModuleAnalysis，行→DTO 对齐 ERD 字段 |
| `src/agent-host/handlers/s5/errors.ts` | notFound/badRequest/internalError（复用 S1-S4 模式） |
| `src/agent-host/handlers/s5/lookup.ts` | 跨库查找（assessment_attempt/course_instance/knowledge_modules/mistakes/weak_points/tasks/practice_answers） |
| `src/agent-host/handlers/s5/events.ts` | writeMockExamCompletedEvent，写 study_events（source_system='S5'） |
| `src/agent-host/handlers/s5/index.ts` | 组装 8 handler 为 createS5Handlers(ctx)，导出 S5Context/MockExamGenerator/createMockMockExamGenerator |
| `src/agent/tools/s5/tools.ts` | 2 工具（studybuddy_generate_mock_exam/studybuddy_submit_mock_exam），TypeBox schema + execute 薄封装；导出 S5_TOOL_NAMES + S5_TOOL_COUNT |
| `tests/integration/s5-handlers.test.ts` | 集成测试（覆盖 8 handler + 状态机 + 触发器 + 防泄露 + AI 降级 + 确定性） |
| `tests/unit/s5-tools.test.ts` | 单件测试（2 工具 ToolDefinition + execute 成功/失败） |

### 将修改的文件

| 文件路径 | 修改内容 |
|---|---|
| `src/contract/types.ts` | S5 DTO 对齐 ERD §3.5（见 §3 前置） |
| `src/agent/studybuddy-extension.ts` | 接入 S5Context + createS5Tools，pi.registerTool × 2（19 → 21 工具） |
| `tests/unit/studybuddy-extension.test.ts` | registerTool 期望 19→21 + S5 工具名清单断言 |
| `tests/integration/studybuddy-extension-contract.test.ts` | registerTool 期望 19→21 + 多次调用次数 |
| 治理文档（AGENTS.md / docs/00-索引 / docs/04-Todo） | 版本同步（收尾时） |

---

## 5. 接口设计

### RPC 方法（06-API §3.7，api.ts 行233-248 已就绪，不改签名）

```typescript
// mockExams（6）
mockExams.generatePaper({ assessmentAttemptId, questionCount, timeLimit? }) → MockExamPaper
  // 触发器校验 assessment_attempt 必须 confirmed（05-ERD §6.3）
  // MockExamGenerator 生成题 → 写 mock_exam_papers + mock_exam_questions
  // source_hash 防重复；AI 失败不创建空卷 → INTERNAL_ERROR
mockExams.getPaper({ paperId }) → MockExamPaper
  // 未提交时 questions 不含 correctAnswer/acceptableAnswers/explanation（防泄露，06-API 行471）
mockExams.startAttempt({ paperId }) → MockExamAttempt  // status=in_progress
mockExams.submitAttempt({ attemptId, answers }) → MockExamResult
  // 规则批改客观题（复用 S3 grader 三策略）
  // 写 mock_exam_answers + mock_exam_attempts(status=submitted→graded, total_score, correct_count, duration_ms)
  // 写 mock_exam_module_analyses（weakness_level strong/medium/weak）
  // 写 study_events(event_type=mock_exam_completed, source_system='S5')
  // 重复 submit 拒绝 BAD_REQUEST
mockExams.getResult({ attemptId }) → MockExamResult
mockExams.getModuleAnalyses({ attemptId }) → MockExamModuleAnalysis[]

// cramCards（1，确定性只读 DTO）
cramCards.get({ assessmentAttemptId }) → CramCard[]
  // 不持久化、不依赖 AI、不暴露题干/答案/作答
  // 从薄弱点 + 错题证据 + 关键知识模块确定性聚合

// cramPlan（1，确定性即时只读 7 天 DTO）
cramPlan.get({ assessmentAttemptId }) → CramPlanDay[]
  // 不持久化、不替学生改写事实
  // 按剩余天数 + 未完成任务 + 练习表现 + 错题 + 薄弱点排序
```

### registerTool 工具（03-Arch §3.1 行246-247，2 工具）

```typescript
pi.registerTool({
  name: "studybuddy_generate_mock_exam",
  label: "生成模拟卷",
  description: "AI 生成限时模拟卷（独立于 S3）。触发器校验 assessment_attempt 必须 confirmed；source_hash 防重复生成。",
  parameters: TypeBox({ assessmentAttemptId, questionCount, timeLimit? }),
  execute: async (params, ctx) => { /* 薄封装 mockExams.generatePaper */ }
});

pi.registerTool({
  name: "studybuddy_submit_mock_exam",
  label: "提交模拟考",
  description: "学生限时作答 + 规则批改客观题。展示总分/正确率/耗时/逐题结果/模块覆盖。",
  parameters: TypeBox({ attemptId, answers }),
  execute: async (params, ctx) => { /* 薄封装 mockExams.submitAttempt */ }
});
```

### 数据表（05-ERD §3.5，T-M0-006 已建库，不改 schema）

- `mock_exam_papers`（§3.5.1）：trg_mockpaper_attempt_confirmed 触发器（§6.3）校验 assessment_attempt confirmed
- `mock_exam_questions`（§3.5.2）：CHECK 选择题/填空题字段互斥；UNIQUE(mock_paper_id, question_index)
- `mock_exam_attempts`（§3.5.3）：status CHECK in_progress/submitted/graded
- `mock_exam_answers`（§3.5.4）：UNIQUE(mock_attempt_id, mock_question_id)
- `mock_exam_module_analyses`（§3.5.5）：weakness_level CHECK strong/medium/weak；UNIQUE(mock_attempt_id, knowledge_module_id)

### MockExamGenerator 接口（参考 S3 question-generator.ts 模式）

```typescript
export interface MockExamQuestion {
  questionIndex: number;
  questionType: QuestionType;  // single_choice/multiple_choice/fill_blank（复用 S3 类型）
  questionStem: string;
  options: string[];           // 选择题必填，填空题空数组
  correctAnswer: string;
  acceptableAnswers?: string[];
  explanation: string;
  score: number;
  knowledgeModuleId: string;
}

export interface MockExamGenerator {
  generate(params: {
    courseId: string;
    moduleIds: string[];
    questionCount: number;
    questionTypes: QuestionType[];
  }): MockExamQuestion[];
}

// createMockMockExamGenerator()：确定性 mock，题型分布同 S3（单选60%/多选20%/填空20%）
// createFailingMockExamGenerator()：测试用，throw Error → generatePaper 捕获不创建空卷 → INTERNAL_ERROR
```

### source_hash 防重复

```typescript
// generatePaper 时计算 source_hash = sha256(assessmentAttemptId + questionCount + moduleIds + prompt_version)
// INSERT 前查 mock_exam_papers WHERE source_hash=? AND assessment_attempt_id=?
// 已存在 → 返回已有 paper（幂等）；不存在 → 新建
```

---

## 6. 测试策略

### 单件测试（阶段 2，tests/unit/s5-tools.test.ts）
- [ ] 工具集整体契约：S5_TOOL_COUNT === 2 + S5_TOOL_NAMES 含 2 工具名
- [ ] studybuddy_generate_mock_exam：ToolDefinition 必填（name/label/description/parameters/execute）+ execute 成功返回 {content, details} + details 字段 + execute 失败 throw Error
- [ ] studybuddy_submit_mock_exam：同上 ≥4 断言

### 集成测试（阶段 3，tests/integration/s5-handlers.test.ts）
**generatePaper（GEN-01~05）**：
- [ ] GEN-01：confirmed 考试 + 生成成功 → 写 papers + questions + 返回 MockExamPaper
- [ ] GEN-02：未 confirmed 考试 → 触发器拦截 BAD_REQUEST + "该考试未确认，无法生成模拟卷"
- [ ] GEN-03：source_hash 防重复（同参数二次调用 → 返回已有 paper，不新建）
- [ ] GEN-04：AI 失败（FailingMockExamGenerator）→ 不创建空卷 → INTERNAL_ERROR + "模拟卷生成失败，请稍后重试"
- [ ] GEN-05：questionCount 校验（参考 S3 边界）

**getPaper（GET-01~03）**：
- [ ] GET-01：未提交 attempt 时 questions 不含 correctAnswer/acceptableAnswers/explanation（防泄露断言）
- [ ] GET-02：已 graded 时 questions 含正确答案（供复盘）
- [ ] GET-03：不存在 paperId → NOT_FOUND

**startAttempt（START-01~02）**：
- [ ] START-01：成功 → status=in_progress + startedAt
- [ ] START-02：不存在 paperId → NOT_FOUND

**submitAttempt（SUB-01~06）**：
- [ ] SUB-01：规则批改三策略（单选精确/多选 deepEquals/填空 normalize+多等价）→ 正确性判定
- [ ] SUB-02：状态机 in_progress→submitted→graded + totalScore/correctCount/durationMs 写入
- [ ] SUB-03：mock_exam_module_analyses 写入（weakness_level strong/medium/weak + UNIQUE）
- [ ] SUB-04：study_events 写入（event_type=mock_exam_completed, source_system='S5'）
- [ ] SUB-05：重复 submit（已 graded）→ BAD_REQUEST
- [ ] SUB-06：不存在 attemptId → NOT_FOUND

**getResult / getModuleAnalyses（RES-01~03）**：
- [ ] RES-01：getResult 返回汇总（totalScore/maxScore/correctCount/correctRate/elapsedMs + moduleAnalyses）
- [ ] RES-02：getModuleAnalyses 返回 weak/medium/strong 分布
- [ ] RES-03：不存在 attemptId → NOT_FOUND

**cramCards.get（CRAM-01~03）**：
- [ ] CRAM-01：确定性只读（同输入同输出，二次调用结果一致）
- [ ] CRAM-02：不暴露题干/答案/作答（DTO 字段断言：仅 coreConcept/keyPoints/mnemonic/commonExamPattern/easyMistake/importance）
- [ ] CRAM-03：未 confirmed 考试 → BAD_REQUEST

**cramPlan.get（PLAN-01~03）**：
- [ ] PLAN-01：7 天 DTO（dayOffset 0-6）+ 确定性
- [ ] PLAN-02：不替学生改写事实（只读，不写库）
- [ ] PLAN-03：按剩余天数排序（dayOffset 递增）

**触发器（TRG-01~02）**：
- [ ] TRG-01：assessment_attempt 未 confirmed → trg_mockpaper_attempt_confirmed 拦截
- [ ] TRG-02：mock_exam_questions CHECK 选择题/填空题字段互斥

### 系统冒烟（阶段 5a）
- [ ] pnpm smoke：S5 不破坏现有六项（build + RPC + 建库 + vault + 六不变量 + 汇总）

### E2E（阶段 5b，本任务不做全链，留待 M2 退出门槛）
- [ ] E2E-04（08-Test §6.2）：confirmed 考试 → 生成模拟卷 → 限时作答 → 批改 → 查看弱项分析 → 速背卡 → 冲刺计划（留待后续）

### 安全不变量（如涉及）
- [ ] getPaper 未提交不含 correct_answer（防泄露，06-API §471）—— 集成测试 GET-01 覆盖
- [ ] cramCards 不暴露题干/答案/作答 —— 集成测试 CRAM-02 覆盖
- [ ] AI 失败不创建空卷 —— 集成测试 GEN-04 覆盖（08-Test §5.5）

---

## 7. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | ⏭️ 跳过（无新外部组件，复用 S3 grader + S4 context 模式） |
| 2. 单件测试 | ✅ s5-tools.test.ts（2 工具单件） |
| 3. 集成测试 | ✅ s5-handlers.test.ts（8 handler + 状态机 + 触发器 + 防泄露 + AI 降级 + 确定性） |
| 4. 系统组装 | ✅ 进入 src/agent-host/handlers/s5/ + src/agent/tools/s5/ + studybuddy-extension 接入 |
| 5. 冒烟 + E2E | ✅ pnpm smoke（系统冒烟）；E2E-04 留待 M2 退出门槛 |

---

## 8. 依赖关系

### 前置任务
- [x] T-M0-006：数据层 schema（mock_exam_* 五表 + trg_mockpaper_attempt_confirmed 已建库）
- [x] T-M0-002：contract 类型化契约面（S5 8 方法签名已就绪）
- [x] T-M1-001：S1（assessment_attempts confirmed 状态 + tasks + exams）
- [x] T-M1-002：S2（knowledge_modules）
- [x] T-M1-003：S3（grader 三策略 + QuestionGenerator 可注入模式 + QuestionType 类型）
- [x] T-M1-004：S4（mistakes + weak_points，cramCards/cramPlan 只读复用）
- [x] T-M1-004 已推送 origin/master（commit 9118c60，前置门禁已核查）

### 组件依赖
- [x] S3 grader.ts（复用 gradeAnswer 三策略，不复制实现）
- [x] S4 context.ts 模式（复用 S5Context 句柄管理 + 可注入接口模式）
- [x] S3 question-generator.ts 模式（参考 MockExamGenerator 可注入设计）

---

## 9. 预期产物

### 代码
- `src/agent-host/handlers/s5/`（11 文件）
- `src/agent/tools/s5/tools.ts`（1 文件）
- `tests/integration/s5-handlers.test.ts` + `tests/unit/s5-tools.test.ts`（2 文件）

### 文档更新（收尾时）
- `docs/04-Todo`：新建 §7.3.1 M2 任务登记表 + 登记 T-M2-001 done + §9 统计 M2 1 done
- `docs/00-索引`：§三/§七/§八 版本同步
- `AGENTS.md`：§3.1 版本登记同步（04-Todo + 00-索引 版本号）+ §12 修订记录
- `.record/T-M2-001-实施记录.md`：8 章节（AGENTS.md §7.1）
- `.plan/00-当前任务.md`：更新指向 T-M2-001

### 实施记录
- `.record/T-M2-001-实施记录.md`（收尾时创建）

---

## 10. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（AGENTS.md §0 + S5 设计文档已读）
- [x] 步骤 2：检查文档门禁（前置门禁三项通过 + master 干净）
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [ ] 步骤 4：独立审查计划（用户审查）
- [ ] 步骤 5：用户批准计划（★ 用户授权）
- [ ] 步骤 6：前置 DTO 对齐 types.ts（§3 前置）+ type-check + 现有测试全绿
- [ ] 步骤 7：编写测试（TDD RED：s5-handlers.test.ts + s5-tools.test.ts）
- [ ] 步骤 8：实现 S5 handler + 工具（TDD GREEN）
- [ ] 步骤 9：type-check
- [ ] 步骤 10：build
- [ ] 步骤 11：test（TDD GREEN 全绿）+ smoke
- [ ] 步骤 12：独立审查并修复（REFACTOR）
- [ ] 步骤 13：更新 04-Todo + 00-索引 + AGENTS.md + .record
- [ ] 步骤 14：文档治理检查（check-docs-governance.mjs）
- [ ] 步骤 15：diff 检查（git diff --check）
- [ ] 步骤 16：提交交付（★ 用户授权，不自动提交/推送）

---

## 11. 证据登记（收尾时填写）

- 测试日志路径：
- 提交哈希：
- 推送状态：
- 实施记录路径：.record/T-M2-001-实施记录.md

---

## 审查记录

（步骤 4 独立审查时填写）

## 完成记录

（步骤 5 收尾时填写）
- 完成日期：
- 实施记录：.record/T-M2-001-实施记录.md
- 状态：✅ 已完成

---

## 关键约束复核（业务铁律，实现时逐条落实）

1. 模拟卷独立于 S3（mock_exam_* 独立表，不复用 practice_*）
2. source_hash 防重复生成同一套卷
3. 速背卡 + 冲刺计划是确定性只读 DTO，不建表、不持久化、不依赖 AI、不替学生改写事实
4. S5 只读复用 S1/S2/S3/S4 摘要，不反写历史事实
5. 未确认考试 → BAD_REQUEST + "该考试未确认，无法生成模拟卷"
6. AI 生成模拟卷失败 → 不创建空卷 → INTERNAL_ERROR + "模拟卷生成失败，请稍后重试"（08-Test §5.5）
7. getPaper 未提交不含 correct_answer/acceptable_answers/explanation（防泄露，06-API §471）
8. mock_exam_attempts 状态机 in_progress→submitted→graded；重复 submit 拒绝 BAD_REQUEST
9. mock_exam_questions CHECK 选择题/填空题字段互斥
10. mock_exam_module_analyses weakness_level CHECK strong/medium/weak + UNIQUE(mock_attempt_id, knowledge_module_id)
11. cramCards 不暴露题干/答案/作答
12. cramPlan 7 天每日建议，按剩余天数 + 未完成任务 + 练习表现 + 错题 + 薄弱点排序
