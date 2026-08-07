# T-M1-001 S1 学期/课程/考试/课表/任务 工具注册 + API

**状态**：🔄 进行中
**日期**：2026-08-07
**里程碑**：M1 核心闭环 MVP（首任务）
**治理阶段**：阶段2-4（单件→集成→装配→冒烟）

## 权威依据

- [04-Todo §7.2](../docs/04-任务清单-Todo-List.md)：M1 首任务 = S1 学期/课程/考试/课表/任务 工具注册 + API
- [07-WF §2.2](../docs/07-工作流-Workflow.md)：S1 学期初始化流程（5 步 + 状态机 + 错误处理）
- [06-API §3.3](../docs/06-API契约-API-Contracts.md)：S1 学习节奏 25 方法（6 命名空间）+ §2 信封 + 5 错误码
- [03-Arch §3.1](../docs/03-架构设计-Architecture-Design.md)：6 个 studybuddy_* registerTool 工具 + §2.2 ToolDefinition 契约
- [05-ERD §2.1 + §3.1](../docs/05-数据模型-ERD-Data-Model.md)：semesters 表 + S1 五表 schema（已建库 T-M0-006）
- [08-Test §3.1](../docs/08-测试验收-Test-Plan.md)：registerTool 工具 4 断言 + §3.2 CHECK 约束

## 前置：DTO 对齐 schema（已完成）

核实发现 contract/types.ts DTO（T-M0-002）与 05-ERD schema（T-M0-006）存在 10 处字段/值域不一致。按权威链 05-ERD（优先级4）> types.ts（优先级7），已修正 types.ts 7 个 S1 DTO + api.ts source 值域对齐 05-ERD：

- Semester.status 去 planning；加 studentName/ready/archivedAt/createdAt/updatedAt
- CourseInstance 去 courseDirPath；加 dailyMinutesTarget/availableTimeJson/targetScoreJson/retakeOf/status/updatedAt
- AssessmentAttempt: confirmationStatus 加 rejected 四态；examType 改 midterm/final/makeup/retake/quiz；source 改 student_input/ocr_schedule/ai_extracted；去 newAttemptId 加 retakeOf/confirmedBy/actualDate/changeHistoryJson
- ScheduleEntry 加 weekPattern/createdAt/updatedAt
- StudyTask: priority 改 number 1-5；taskType 改 review/practice/note/exam_prep/other；status 改 pending/in_progress/completed/skipped；加 description/sourceRefId/completedAt/createdAt/updatedAt
- StudyEvent: semesterId 改必填；加 sourceSystem(EventSourceSystem)/sourceRefId/eventDataJson/createdAt；去 reviewedAt/refType/refId

type-check + 171 测试全绿无回归。S2-S7 DTO 留待各自 M1 任务对齐。

## 现状核实（已读源码确认）

- semester.db S1 五表已建（T-M0-006）：course_instances / assessment_attempts / schedule_entries / study_tasks / study_events
- global.db semesters 表已建（T-M0-006）
- contract api.ts 已声明全部 25 个 S1 方法签名 + DTO 类型已对齐 schema
- studybuddy-extension.ts 空壳 setup 可用（T-M0-007），M1+ 在 setup 内调 pi.registerTool
- data 层就绪：createGlobalDb / createSemesterDb / initSemesterDb / applyPragmas / assertIntegrity
- handlers 目录已有 files.ts / toolchains.ts / ping.ts 范式可参考（toolchainHandlers 导出对象 + createFileHandlers 工厂函数两种范式）
- agent-host/index.ts 用 server.handle({ ... }) 装配 handler
- pi ExtensionAPI.registerTool 签名：registerTool(tool: ToolDefinition): void

## 任务范围

### 交付物

**1. RPC handlers（6 文件，25 方法）** — `src/agent-host/handlers/` 下新建：

| 文件 | 方法 | 关键约束 |
|---|---|---|
| `semesters.ts` | list / create / get / update / transition / archive | create 跨库写：global.db:semesters(status=active,ready=0) + 初始化 semester/<id>/sem.db；transition 状态机 active→teaching_ended→follow_up→archived；archive 只读+审计痕迹 |
| `courses.ts` | list / create / get / update / importSchedule | importSchedule 占位返回 BAD_REQUEST + 中文消息（OCR 是独立后续任务） |
| `exams.ts` | list / add / confirm / supersede | add 写 confirmation_status=pending；confirm 写 confirmed_at/confirmed_by='student' + study_events(exam_confirmed) + semesters.update(ready=1)；四态 pending/confirmed/rejected/superseded |
| `schedule.ts` | list / create / update / delete | 依赖既有 CHECK end_time>start_time；delete 软删除 |
| `tasks.ts` | list / create / complete / dailyBrief | complete 写 StudyEvent(source_system='S1')；dailyBrief 纯规则聚合（非 AI） |
| `events.ts` | list / markReviewed | markReviewed 写 practice_reviewed 事件 |

- 所有 handler 遵循 06-API §2.1 信封：成功 `{success:true, data}`，失败 `{success:false, error:{code, message}}`
- 错误码用 §2.2 五码 + §2.3 中文可操作消息；绝不暴露 SQL/路径/完整 UUID/栈
- 在 agent-host/index.ts 装配 6 组新 handler

**2. registerTool 工具（6 个）** — 在 studybuddy-extension.ts 的 setup 内 pi.registerTool：

`studybuddy_init_semester` / `studybuddy_add_exam` / `studybuddy_confirm_exam` / `studybuddy_daily_brief` / `studybuddy_complete_task` / `studybuddy_transition_semester`

- 工具名匹配 `^studybuddy_[a-z_]+$`；ToolDefinition 必填 name/label/description/parameters/execute
- execute 成功返回 `{content, details, usage?, terminate?}`；失败 throw Error
- registerTool 返回 void
- 工具定义放 `src/agent/tools/s1/`，execute 薄封装调用同一 handler 函数

### 不做

- ❌ S2-S7 子系统（后续 T-M1 任务）
- ❌ OCR venv Adapter（courses.importSchedule 占位 BAD_REQUEST，独立任务）
- ❌ 真正触发备份（semesters.transition 归档备份延后 M2）
- ❌ LLM 调用（dailyBrief 纯规则聚合）
- ❌ 返工 semester.db 表结构（T-M0-006 已定）
- ❌ 09-UI S1 标签页业务 UI（独立任务）

## TDD 纪律

- RED→GREEN→REFACTOR；先写与权威条款对应的失败测试
- 测试数据隔离：H:\pi-studybuddy-tmp\runs\T-M1-001\，设 PI_STUDYBUDDY_DATA_ROOT
- 不连真实外部服务（不调 LLM/OCR/备份）
- 单件测试：6 个工具每个 ≥4 条契约断言（08-Test §3.1）+ CHECK 约束断言（§3.2.5）
- 集成测试：handler 与既有 semester.db schema 真实读写 + 状态机迁移 + 考试四态

## 完成门槛

- [ ] 全部单件 + 集成测试通过
- [ ] pnpm type-check / pnpm test / pnpm smoke / pnpm verify 全绿
- [ ] git diff --check 无空白错误
- [ ] 更新 docs/04-Todo + 00-索引 + AGENTS.md §3.1
- [ ] 创建 .record/T-M1-001-实施记录.md（8 章节）
- [ ] 不提交：真实密钥/.env.local/资料原文/完整 UUID/node_modules
