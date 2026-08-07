# T-M1-003 S3 限时练习 工具注册 + API

**状态**：📝 计划待审查（用户已批准开工，本计划供审查，批准后进入 TDD 实施）
**日期**：2026-08-07
**里程碑**：M1 核心闭环 MVP（第 3 项）
**治理阶段**：阶段2-4（单件→集成→装配→冒烟）

## 权威依据

- [04-Todo §7.2 行 419 + §7.2.1](../docs/04-任务清单-Todo-List.md)：T-M1-003 = S3 限时练习 工具注册 + API
- [07-WF §2.4 + §8.5](../docs/07-工作流-Workflow.md)：S3 限时练习流程（5 步 + in_progress→submitted→graded 状态机）
- [06-API §3.5](../docs/06-API契约-API-Contracts.md)：S3 练习 5 方法 + QuestionDTO 作答前防泄露
- [03-Arch §3.1](../docs/03-架构设计-Architecture-Design.md)：studybuddy_* registerTool 工具（S3 PracticeRunner 3 工具）+ §2.2 ToolDefinition 契约
- [05-ERD §3.3](../docs/05-数据模型-ERD-Data-Model.md)：questions / practice_sessions / practice_answers 三表 schema（已建库 T-M0-006）
- [08-Test §3.1/§3.2 + §7.4](../docs/08-测试验收-Test-Plan.md)：registerTool 工具 4 断言 + CHECK 约束断言 + 规则批改可证伪

## 任务范围

### 交付物

**1. DTO 对齐 schema（types.ts 偏离 ERD，须先修正）**

核实 [src/contract/types.ts](../src/contract/types.ts) 行 341-381，S3 DTO 与 05-ERD §3.3 不一致，按权威链 05-ERD（优先级4）> types.ts（优先级7）修正：

| DTO | 偏离点 | 修正方向 |
|---|---|---|
| `PracticeSession.status` | `"in_progress"\|"submitted"\|"expired"` | 改 `"in_progress"\|"submitted"\|"graded"`（§3.3.2 CHECK + §8.5 状态机）；`expired` 移除（超时用前端标记，不落库状态） |
| `PracticeSession` | 缺字段 | 补 `maxScore` / `totalScore` / `correctCount` / `startedAt` / `submittedAt` / `gradedAt`（§3.3.2）；`questionTypes` 保留（对应 question_types_json 映射） |
| `QuestionDTO` | 一致 | 保留（id/questionType/questionStem/options/score，作答前防泄露，06-API §5.1 已正确） |
| `PracticeResult` | 缺字段 | 补 `maxScore` / `submittedAt` / `gradedAt`；items 保留 { question, isCorrect, correctAnswer, explanation } |

**api.ts 影响**：`practice.*` 5 方法签名已在 [api.ts](../src/contract/api.ts) 行 194-208 声明，类型引用 types.ts，types.ts 修正后 api.ts 自动对齐，无需改方法签名。

**核查项**：修正后跑 `pnpm type-check` + `pnpm test`（现有 295 测试）确认无回归。S4+S5-S7 DTO 不动。

**2. RPC handlers（6 文件 + 共享 4 文件，5 方法）** — `src/agent-host/handlers/s3/` 下新建：

| 文件 | 方法 | 关键约束 |
|---|---|---|
| `practice.ts` | createSession / getQuestions / submit / getResult / listSessions | createSession：校验 questionCount 5-20 + moduleIds 1-10 + 同步调 AI 生成客观题（单选 60%/多选 20%/填空 20%）；**AI 失败不创建空 session，返回 INTERNAL_ERROR**；成功写 questions + practice_sessions(in_progress)；getQuestions：作答前 DTO 不含 correct_answer/acceptable_answers/explanation；submit：规则批改三策略（单选精确/多选 deepEquals/填空 normalize）+ 写 practice_answers + session submitted→graded + total_score/correct_count + 写 study_events(practice_submitted/practice_graded, source_system='S3')；getResult：含逐题正确答案+解析；listSessions：列表 |
| `grader.ts` | 私有：规则批改三策略 | 单选精确匹配；多选全选 deepEquals；填空 normalize（trim+全角转半角+统一大小写+去多余空格，支持多等价答案 OR）；**纯确定性规则，不调 LLM**（08-Test §7.4 可证伪） |
| `context.ts` | S3Context | 复用 S1/S2Context 模式（globalDb + semesterDbs 缓存） |
| `dto.ts` | mapQuestion / mapSession / mapResult | 行→DTO 映射，对齐 ERD 字段 + 作答前/后 DTO 隔离 |
| `errors.ts` | notFound / badRequest / internalError | 复用 S1/S2 模式 |
| `lookup.ts` | findSemesterByCourseId / findBaseSemester | 跨库查找（复用 S1 findSemesterByCourseId 模式） |
| `events.ts` | writeS3Event | 写 study_events（practice_submitted / practice_graded，source_system='S3'） |
| `index.ts` | createS3Handlers(ctx) | 装配 5 handler 出口 |

- 所有 handler 遵循 06-API §2.1 信封；错误码用 §2.2 五码 + §2.3 中文消息
- **AI 生成题目**：本任务**不接真实 LLM**。createSession 的题目生成走**可注入的 QuestionGenerator 接口**（默认实现 mock 确定性生成，满足题型分布比例），供后续 AI 任务接入；满足 08-Test §5.4 不连真实外部服务。生成器注入通过 S3Context 构造参数。

**3. registerTool 工具（3 个）** — `src/agent/tools/s3/tools.ts`，在 studybuddy-extension.ts setup 内 pi.registerTool：

`studybuddy_generate_questions` / `studybuddy_submit_practice` / `studybuddy_get_practice_result`

- 工具名匹配 `^studybuddy_[a-z_]+$`；ToolDefinition 必填 name/label/description/parameters/execute
- execute 薄封装调用同一 handler 函数（复用 S1/S2 tools.ts 模式）

**4. studybuddy-extension 集成** — 在 [studybuddy-extension.ts](../src/agent/studybuddy-extension.ts) setup 内追加 createS3Tools + pi.registerTool × 3（与 S1/S2 工具并列，共 15 工具）

### 不做

- ❌ S4 错题/薄弱点（T-M1-004 独立任务；本任务 submit 后 is_correct=false 答题只读输出，不归档）
- ❌ 真实 LLM 题目生成（QuestionGenerator 接口默认 mock；AI 接入留待后续任务）
- ❌ 主观题 / 跨课程混合组卷（S5 负责）
- ❌ 接入 agent-host Host RPC（与 S1/S2 一致，T-M1-001 §8 已记录留待壳层 UI 任务）
- ❌ 09-UI S3 标签页业务 UI（壳层任务）
- ❌ 改 api.ts 方法签名（5 方法已声明，仅 types.ts DTO 对齐）
- ❌ 改 semester.db 表结构（T-M0-006 已定，三表 + 触发器）
- ❌ S4-S7 DTO 对齐（各自 M1 任务）

## 关键约束（必须实现）

- **作答前 DTO 防泄露**：getQuestions 返回的 QuestionDTO 绝不含 correct_answer / acceptable_answers / explanation（06-API §5.1 + 02-PRD §7.2 最高优先级）
- **规则批改确定性**：submit 的批改由确定性规则负责，mock AI 不可用时仍产出正确结果（08-Test §7.4 可证伪）
- **AI 失败不创建空 session**：createSession 题目生成失败 → 不写 session，返回 INTERNAL_ERROR + "题目生成失败，请稍后重试或检查模型配置"
- **session 状态机**：`in_progress → submitted → graded`（07-WF §8.5）；submit 时 in_progress→submitted→graded 一次完成；已 graded 重复 submit 拒绝（BAD_REQUEST）
- **题目归属单个 session**：数据模型保证历史稳定，不跨 session 引用；触发器校验 question.course 匹配 session.course（05-ERD §6.1 T1）+ answer.question 属于 session（T5）
- **填空 normalize**：trim + 全角转半角 + 统一大小写 + 去多余空格 + 多等价答案 OR
- **questionCount 校验**：5-20（§3.3.2 CHECK）；moduleIds 1-10（07-WF §2.4 触发）
- **题型比例**：single 60% / multiple 20% / fill 20%（06-API §3.5）

## TDD 纪律

- RED（先写与权威条款对应的失败测试）→ GREEN（最小实现）→ REFACTOR
- 测试数据隔离：写入 `H:\pi-studybuddy-tmp\runs\T-M1-003\`，设 `PI_STUDYBUDDY_DATA_ROOT`
- 不连真实外部服务：题目生成走 mock QuestionGenerator，不调 LLM
- 单件测试：3 工具每个 ≥4 条契约断言（08-Test §3.1）+ CHECK 约束断言（§3.2）+ 规则批改三策略可证伪（§7.4）
- 集成测试：handler 与既有 semester.db schema 真实读写 + session 状态机 + 作答前 DTO 防泄露断言 + 批改三策略 + AI 失败不创建空 session + 重复 submit 拒绝

## 完成门槛

- [ ] DTO 对齐 types.ts（前置）+ type-check 全绿 + 现有 295 测试无回归
- [ ] 全部新增单件 + 集成测试通过
- [ ] pnpm type-check / pnpm test / pnpm contract-coverage（基线不退化）/ pnpm desktop-security / pnpm build / pnpm smoke / pnpm verify 全绿
- [ ] node scripts/check-docs-governance.mjs 全绿
- [ ] git diff --check 无空白错误
- [ ] 更新 docs/04-Todo（T-M1-003 done + 证据 + M1 统计）+ 00-索引 + AGENTS.md §3.1 版本号
- [ ] 创建 .record/T-M1-003-实施记录.md（8 章节）
- [ ] 记录未解决事项：S3 handler 未接 Host RPC（与 S1/S2 一致，壳层任务补全）；真实 LLM 题目生成待接入
- [ ] 不提交：真实密钥 / .env.local / 资料原文 / 完整 UUID / node_modules / 运行数据

## 分支与提交

- 分支：`agent/T-M1-003-s3-practice-tools`
- 提交（待用户授权）：`feat(m1): S3 限时练习 5 RPC handler + 3 studybuddy_* 工具注册 + 规则批改三策略 + DTO 对齐 ERD`