# T-M1-004 S4 错题/薄弱点 工具注册 + API

**task-id**：T-M1-004
**标题**：S4 错题/薄弱点 工具注册 + API
**里程碑**：M1 核心闭环 MVP（第 4 项，M1 3 done / 7 pending → 4 done / 6 pending）
**治理阶段**：阶段2-4（单件→集成→装配→冒烟）
**分支**：`agent/T-M1-004-s4-mistakes-weakness-tools`
**状态**：in_progress
**开工时间**：2026-08-07

## 一、权威依据

| 权威源 | 章节 | 关键内容 |
|---|---|---|
| 04-Todo §7.2 行420 | S4 | 错题/薄弱点 工具注册 + API，scope=07-WF §2.5+06-API §3.6，阶段2-4 |
| 07-WF §2.5 行187-226 | S4 流程 | 幂等归档/evidence_count≥2/S4只读S3/不进S6 |
| 07-WF §8.6 + §8.7 | 状态机 | 错题 needs_review↔mastered；薄弱点 active→resolved→regressed |
| 06-API §3.6 行257-275 | 10 方法 | mistakes 6 + weakPoints 4 |
| 05-ERD §3.4.1-3.4.3 | 三表 schema | mistakes / mistake_evidence / weak_points |
| 05-ERD §6.1 行1017 + §6.4 行1110 | 触发器 | 6 一致性 + 幂等归档 |
| 03-Arch §3.1 行233-240 | 4 工具 | archive_mistake/confirm_error_cause/redo_mistake/aggregate_weak_point |
| 08-Test §3.2.4 + §5.5 + §6.1 | 断言 | 幂等归档 + 状态机可证伪 + E2E-03 |
| src/contract/types.ts 行392-426 | DTO 现状 | 偏离 ERD 7 处（待对齐） |

## 二、范围

### 1. DTO 对齐 types.ts（前置）

| DTO | 偏离点 | 修正方向 |
|---|---|---|
| ErrorCategory | 五值全错 | ERD §3.4.1：concept_unclear/misread/formula_error/step_missing/time_pressure/other |
| Mistake.status | 多 archived | ERD §3.4.1 CHECK：仅 needs_review/mastered |
| Mistake | 缺 7 字段 | knowledgeModuleId/errorCause/errorCauseConfirmedBy/errorCauseAiSuggestion/lastRedoCorrect/masteredAt/updatedAt |
| MistakeEvidence | 缺类型 | 新增：{id, mistakeId, sourcePracticeAnswerId, evidenceType, recordedAt, createdAt} |
| RedoResult | 缺 2 字段 | evidenceCount/weakPointFormed |
| WeakPoint | 缺 4 字段 | firstEvidencedAt/lastEvidencedAt/resolvedAt/updatedAt |
| Mistake.practiceAnswerId | 保留为可选便利字段 | 标记 optional（ERD 无，但 DTO 便利） |

### 2. RPC handlers（8 文件 + 共享 4 文件，10 方法）— src/agent-host/handlers/s4/

- mistakes.ts：list/get/confirmErrorCause/suggestErrorCause/redo/archive
- weakpoints.ts：list/get/resolve/regress
- aggregator.ts：私有 aggregateWeakPoint
- context.ts：S4Context + ErrorCauseAdvisor 注入
- dto.ts：mapMistake/mapMistakeWithEvidence/mapWeakPoint
- errors.ts：notFound/badRequest/internalError
- lookup.ts：findSemesterByMistakeId/findSemesterByPracticeAnswerId/findSemesterByWeakPointId
- events.ts：writeMistakeArchivedEvent/writeErrorCauseConfirmedEvent/writePracticeReviewedEvent
- index.ts：createS4Handlers(ctx)

### 3. registerTool 工具（4 个）— src/agent/tools/s4/tools.ts

- studybuddy_archive_mistake → mistakes.archive
- studybuddy_confirm_error_cause → mistakes.confirmErrorCause
- studybuddy_redo_mistake → mistakes.redo
- studybuddy_aggregate_weak_point → weakPoints.list（或私有 aggregator）

### 4. studybuddy-extension 集成

- setup 内追加 createS4Tools + pi.registerTool × 4（与 S1/S2/S3 并列，共 19 工具）

## 三、关键约束

1. **幂等归档**：mistakes.archive 检查 UNIQUE(question_id)；已有 → 追加 mistake_evidence（UNIQUE(source_practice_answer_id) 防重复）；没有 → 新建 mistake(status=needs_review)
2. **S4 只读 S3 事实**：archive 通过 practiceAnswerId 查 practice_answers（is_correct=0），不反写 S3
3. **错因学生确认**：AI 只提建议（带"不确定"标记 + confidence），学生必须确认；error_cause_confirmed_by='student'
4. **薄弱点 evidence_count≥2**：单次错误不形成；redo 正确后若 evidence_count≥2 且无对应 weak_point（UNIQUE(course_instance_id, knowledge_module_id)）则归纳
5. **错题状态机**：needs_review ↔ mastered（重做正确→mastered；再次答错→回退）
6. **薄弱点状态机**：active → resolved → regressed（resolved 可回退 regressed）
7. **6 关系一致性触发器**：mistake/question/course/module 一致 + mistake_evidence.answer 属于 mistake.question + weak_points.course/module 一致
8. **ErrorCategory 六分类**：concept_unclear/misread/formula_error/step_missing/time_pressure/other
9. **AI 失败降级**：suggestErrorCause 失败返回 INTERNAL_ERROR + "AI 建议暂时不可用，请手动选择错因"，不阻塞学生手动确认

## 四、TDD 纪律

- RED（先写与权威条款对应的失败测试）→ GREEN（最小实现）→ REFACTOR
- 测试数据隔离：H:\pi-studybuddy-tmp\runs\T-M1-004\，设 PI_STUDYBUDDY_DATA_ROOT
- 不连真实外部服务：ErrorCauseAdvisor 走 mock，不调 LLM
- 单件测试：4 工具每个 ≥4 条契约断言（08-Test §3.1）+ 幂等归档约束断言（§3.2.4）+ 状态机可证伪（§7.4）
- 集成测试：handler × semester.db 真实读写 + 幂等归档 + 6 触发器 + 状态机 + AI 降级

## 五、完成门槛

- [ ] DTO 对齐 types.ts + type-check 全绿 + 现有 336 测试无回归
- [ ] 全部新增单件 + 集成测试通过
- [ ] pnpm type-check / test / contract-coverage / desktop-security / build / smoke / verify / docs-governance 全绿
- [ ] git diff --check 无空白错误
- [ ] 更新 docs/04-Todo（T-M1-004 done + 证据 + M1 4 done）+ 00-索引 + AGENTS.md §3.1
- [ ] 创建 .record/T-M1-004-实施记录.md（8 章节）
- [ ] 记录未解决事项：S4 handler 未接 Host RPC；真实 LLM 错因建议待接入

## 六、不做

- ❌ 真实 LLM 错因建议（ErrorCauseAdvisor 默认 mock）
- ❌ S5 期末冲刺（独立任务）
- ❌ 接入 agent-host Host RPC（与 S1/S2/S3 一致）
- ❌ 09-UI S4 标签页业务 UI（壳层任务）
- ❌ 改 api.ts 方法签名（仅 types.ts DTO 对齐）
- ❌ 改 semester.db 表结构（T-M0-006 已定）
- ❌ S3 反向调用（S4 只读 S3 事实）
- ❌ S5-S7 DTO 对齐
- ❌ 错题正文/答案/作答/错因进 S6 家长报告

## 七、提交

- 分支：agent/T-M1-004-s4-mistakes-weakness-tools
- 提交（待用户授权）：feat(m1): S4 错题/薄弱点 10 RPC handler + 4 studybuddy_* 工具注册 + 幂等归档 + 状态机 + DTO 对齐 ERD
