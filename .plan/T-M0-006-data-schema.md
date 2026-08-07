# 任务计划：T-M0-006 数据层 schema（global.db + semester.db + 三层记忆）

**任务 ID**：T-M0-006
**日期**：2026-08-07
**状态**：✅ 已完成（2026-08-07，详见 .record/T-M0-006-实施记录.md）
**关联文档**：05-ERD §1-§10（权威）+ 03-Arch §4（数据层）+ 06-API §3.2 + 08-Test §3.2 + §5.4
**里程碑**：M0 骨架搭建
**前置**：T-M0-001 ✅ done（rpc/host 骨架）+ T-M0-002 ✅ done（contract 契约面）

---

## 1. 任务目标

### 做什么

为 pi-studybuddy **数据层** 落地可建库的 schema 能力：global.db（学期注册表）、semester.db（单学期 S1-S7 全量表）、三层记忆（L1 画像 JSON / L2 知识库索引 / L3 会话 FTS5），并统一 PRAGMA 配置，建库后 `PRAGMA integrity_check` 通过。

### 为什么

- **M0 退出门槛前置**：04-Todo §6.2 退出门槛"global.db + semester.db 可建库"由本任务落地。
- **数据层是公用零件**：AGENTS.md §4.3 装配顺序——壳层就绪后先建公用零件（数据层 schema），业务模块 M1 才在其上读写。
- **05-ERD 的 render 落地**：05-ERD §1-§10 已批准的 schema/触发器/索引/PRAGMA 需从文档变成可执行 SQL + 建库代码。

### 依据

- 05-ERD §2 全局库 schema（4 表 + CHECK + 索引）
- 05-ERD §3 学期库 schema（25 表 + CHECK + 索引）
- 05-ERD §6 触发器（9 个：6 关系一致性 + storage_key 逃逸 + mock_exam confirmed + 幂等归档）
- 05-ERD §4 三层记忆 schema（L1 JSON / L2 BM25+图谱 / L3 FTS5）
- 05-ERD §9 PRAGMA 配置 + §8.3 崩溃恢复（integrity_check）
- 03-Arch §4 数据层四层架构定位
- 08-Test §3.2 数据层单件测试 + §5.4 存储路径逃逸安全不变量

## 2. 范围与非目标

### 范围

1. **`src/data/schema/` 建库 SQL 定义**：global.sql.ts / semester.sql.ts / conversation.sql.ts（L3），以 TypeScript 导出 SQL 字符串常量，集中管理表/触发器/索引。
2. **`src/data/` 建库能力**：
   - `openDatabase(path)`：打开 SQLite（node:sqlite DatabaseSync）+ 应用 PRAGMA（05-ERD §9）
   - `initGlobalDb(db)`：建 global.db 全部 4 表 + 索引
   - `initSemesterDb(db)`：建 semester.db 全部 25 表 + 9 触发器 + 索引
   - `initConversationDb(db)`：建 L3 chunks 表 + chunks_fts 虚拟表
   - `createGlobalDb(dir)` / `createSemesterDb(dir, semesterId)`：落地文件 + `PRAGMA integrity_check` 断言
   - L1/L2 目录骨架与结构初始化（`initMemoryL1(dir)` / `initMemoryL2(dir)`）
3. **PRAGMA 统一**：WAL / synchronous NORMAL / foreign_keys ON / busy_timeout 5000 / cache_size / temp_store / mmap_size（05-ERD §9）。
4. **测试**：`tests/unit/data-schema.test.ts`（建库 + 表结构断言 + 触发器生效 + 约束生效 + integrity_check）+ `tests/integration/data-create.test.ts`（真实文件建库 + 数据隔离）。
5. **tsconfig.node.json 纳入 `src/data`**：数据层供 main/agent-host 后续使用，需被 node 编译覆盖。

### 非目标（不做什么）

- ❌ 业务 CRUD 读写封装（insert/query/update 的业务方法）→ 后续数据层任务 / M1+ 业务任务
- ❌ 业务 handler 注册（S1-S7 / backup 等）→ M1+
- ❌ credential-vault（safeStorage/DPAPI）→ T-M0-003
- ❌ toolchain 发现 → T-M0-004
- ❌ file-watch → T-M0-005
- ❌ studybuddy-extension 空壳 → T-M0-007
- ❌ 09-UI 三栏布局 → T-M0-008
- ❌ M0 系统冒烟完整 → T-M0-009
- ❌ L2 BM25 检索算法实现（仅建索引目录骨架 + 结构约定）→ M2/M3 业务任务
- ❌ L3 bigram 分词算法实现（仅 FTS5 虚拟表 + chunks 表落地）→ M3 对话任务

## 3. 文件清单

### 将创建的文件

| 文件路径 | 用途 |
|---|---|
| `src/data/schema/global.sql.ts` | global.db 4 表 DDL + 索引 + CHECK（05-ERD §2） |
| `src/data/schema/semester.sql.ts` | semester.db 25 表 DDL + 9 触发器 + 索引（05-ERD §3 + §6） |
| `src/data/schema/conversation.sql.ts` | L3 chunks 表 + chunks_fts 虚拟表 DDL（05-ERD §4.3） |
| `src/data/db.ts` | openDatabase + PRAGMA 应用 + integrity_check 断言 |
| `src/data/global.ts` | initGlobalDb + createGlobalDb |
| `src/data/semester.ts` | initSemesterDb + createSemesterDb |
| `src/data/memory.ts` | initMemoryL1 / initMemoryL2（L1 JSON + L2 索引目录骨架） |
| `src/data/index.ts` | 数据层统一出口 |
| `tests/unit/data-schema.test.ts` | 建库 + 表/触发器/约束/PRAGMA 断言 |
| `tests/integration/data-create.test.ts` | 真实文件建库 + 数据隔离 + integrity_check |

### 将修改的文件

| 文件路径 | 修改内容 |
|---|---|
| `tsconfig.node.json` | include 追加 `src/data` |
| `docs/04-Todo-List.md` | T-M0-006 任务行登记 + 状态 in_progress |
| `.plan/00-当前任务.md` | 指向本计划文件 |
| `docs/00-文档索引-Index.md` | 版本历史登记（收尾时） |
| `scripts/check-docs-governance.mjs` | 如需（确认数据层文档位置校验无冲突） |

## 4. 技术选型

### 4.1 SQLite 驱动：`node:sqlite`（DatabaseSync）—— 推荐

- **依据**：05-ERD §1.1 已为 L3 指定 `node:sqlite`（Node≥22.5）；本机 Node v22.16.0 满足。
- **优势**：Node 内置零依赖，无需 native build（避免 better-sqlite3 引入 pnpm build 复杂度），与 05-ERD 权威条款一致。
- **风险点（待用户裁决）**：`node:sqlite` 的 FTS5 虚拟表支持需在单件测试中实测验证（标准 SQLite 带 FTS5，但 node:sqlite 暴露面可能受限）。若 FTS5 不可用，回退方案为 L3 仅建普通 chunks 表 + 应用层 own 全文索引（容灾，不阻塞本任务其余范围）。

### 4.2 数据隔离

- 所有测试写入 `H:\pi-studybuddy-tmp\runs\T-M0-006\`（AGENTS.md §5.3），绝不污染 `%LOCALAPPDATA%\PiStudyBuddy`。
- 建库函数接受显式 `dir` 参数，测试注入隔离目录。

### 4.3 表结构落地策略

- SQL 以 TS 模板字符串常量集中管理（`schema/*.sql.ts`），建库时 `db.exec(sql)`。
- 触发器/CHECK/UNIQUE/索引全部随 DDL 执行，由测试断言 `sqlite_master` 中实际存在。

## 5. 接口设计

### 5.1 `src/data/db.ts`

```typescript
import { DatabaseSync } from "node:sqlite";

export interface DataDb {
  path: string;
  db: DatabaseSync;
}

export function openDatabase(path: string): DatabaseSync;
// 应用 PRAGMA（05-ERD §9）：WAL / synchronous NORMAL / foreign_keys ON / busy_timeout 5000 / cache_size / temp_store / mmap_size
export function assertIntegrity(db: DatabaseSync): void;
// PRAGMA integrity_check，非 "ok" 则抛错
```

### 5.2 `src/data/global.ts`

```typescript
export function createGlobalDb(dir: string): DataDb;
// 创建 global.db + 应用 PRAGMA + initGlobalDb + assertIntegrity
export function initGlobalDb(db: DatabaseSync): void;
// 执行 global.sql.ts DDL（semesters / parent_report_targets / backup_records / backup_schedules + 索引）
```

### 5.3 `src/data/semester.ts`

```typescript
export function createSemesterDb(dir: string, semesterId: string): DataDb;
// 创建 semester/<semesterId>/sem.db + 应用 PRAGMA + initSemesterDb + assertIntegrity
export function initSemesterDb(db: DatabaseSync): void;
// 执行 semester.sql.ts DDL（25 表 + 9 触发器 + 索引）
```

### 5.4 `src/data/memory.ts`

```typescript
export interface MemoryInitResult { l1Dir: string; l2Dir: string; l3Dir: string; }
export function initMemoryL1(dir: string): void;
// 创建 memory/l1/learner-profile.json（05-ERD §4.1 默认结构）+ events.jsonl 占位
export function initMemoryL2(dir: string): void;
// 创建 memory/l2/wiki-index/ 目录骨架（inverted_index/doc_lengths/graph_nodes/graph_edges 空结构）
export function initMemoryL3(dir: string): DataDb;
// 创建 memory/l3/conversation.sqlite + chunks 表 + chunks_fts 虚拟表
```

### 5.5 DDL 摘要（05-ERD 权威条款，实施时逐条照抄）

- **global.db 4 表**：semesters / parent_report_targets / backup_records / backup_schedules（索引 8 个，05-ERD §7.1）
- **semester.db 25 表**：course_instances / assessment_attempts / schedule_entries / study_tasks / study_events / materials / normalized_texts / structured_notes / mind_maps / knowledge_modules / material_chunks / jobs / questions / practice_sessions / practice_answers / mistakes / mistake_evidence / weak_points / mock_exam_papers / mock_exam_questions / mock_exam_attempts / mock_exam_answers / mock_exam_module_analyses / parent_reports / report_deliveries（索引见 05-ERD §7.2）
- **semester.db 9 触发器**（05-ERD §6）：trg_question_course_consistency / trg_mistake_question_consistency / trg_evidence_answer_consistency / trg_weakpoint_consistency / trg_answer_session_consistency / trg_mistake_module_consistency / trg_material_storage_key_safety / trg_mockpaper_attempt_confirmed / trg_mistake_idempotent_archive
- **L3**：chunks 表 + chunks_fts fts5 虚拟表（unescaped，tokenize unicode61）

## 6. 测试策略

### 6.1 单件测试（阶段 2，`tests/unit/data-schema.test.ts`）

使用 `:memory:` + 隔离目录（`H:\pi-studybuddy-tmp\runs\T-M0-006\`）：

- [ ] **GLOBAL-01**：`initGlobalDb` 后 `sqlite_master` 含 4 表 + 8 索引
- [ ] **GLOBAL-02**：semesters CHECK 约束生效（非法 status 拒绝）
- [ ] **SEMESTER-01**：`initSemesterDb` 后 `sqlite_master` 含 25 表 + 9 触发器
- [ ] **SEMESTER-02**：schedule_entries CHECK（end_time > start_time）生效
- [ ] **SEMESTER-03**：mock_exam_questions CHECK（选择题必有 options / 填空无 options）生效
- [ ] **TRG-01**：trg_question_course_consistency——question 与 practice_session course 不一致被拒
- [ ] **TRG-02**：trg_mistake_idempotent_archive——同一 question 重复建 mistake 被拒
- [ ] **TRG-03**：trg_mockpaper_attempt_confirmed——unconfirmed assessment_attempt 建 mock paper 被拒
- [ ] **TRG-04**：trg_material_storage_key_safety——storage_key 含 `..`/`:` 被拒（08-Test §5.4 存储路径逃逸）
- [ ] **PRAGMA-01**：`journal_mode` == wal + `foreign_keys` == 1
- [ ] **L3-01**：chunks 表 + chunks_fts 虚拟表创建成功（若 node:sqlite 支持 FTS5）
- [ ] **L1/L2-01**：initMemoryL1/L2 创建目录骨架 + 默认 JSON 结构

### 6.2 集成测试（阶段 3，`tests/integration/data-create.test.ts`）

- [ ] **CREATE-01**：`createGlobalDb` 在隔离目录落地 global.db 文件，`integrity_check` == ok
- [ ] **CREATE-02**：`createSemesterDb` 落地 `semester/<id>/sem.db`，`integrity_check` == ok
- [ ] **CREATE-03**：`foreign_keys ON` 下跨库外键语义正确（global→semester 仅 db_relative_path 关联，不建 FK）
- [ ] **ISOLATION-01**：测试写入隔离目录，不产生 `%LOCALAPPDATA%\PiStudyBuddy` 文件

### 6.3 安全不变量（如涉及）

- 08-Test §5.4 存储路径逃逸：TRG-04 覆盖 storage_key 逃逸防护。

## 7. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | — 不涉及（node:sqlite 为 Node 内置，零外部组件） |
| 2. 单件测试 | ⏳ data-schema.test.ts（表/触发器/约束/PRAGMA 断言） |
| 3. 集成测试 | ⏳ data-create.test.ts（真实文件建库 + isolation） |
| 4. 系统组装 | src/data/ 进入 tsconfig.node.json 编译覆盖 |
| 5. 冒烟 + E2E | 依赖 M0-009 系统冒烟（本任务不独立跑冒烟） |

## 8. 依赖关系

### 前置任务

- [x] T-M0-001（Electron 四进程骨架 + host）
- [x] T-M0-002（contract 契约面）

### 组件依赖

- [x] Node v22.16.0（满足 node:sqlite ≥22.5）
- [x] vitest（单件 + 集成测试）

### 参考仓库

- `H:\pi-references\inno-agent\...sqlite-store.ts`（L3 会话存储范式，05-ERD §4.3 指明）
- `H:\pi-references\pi-desktop`（contract/db 范式，仅参考）

**纪律**：参考范式但独立重实现，不复制代码。

## 9. 预期产物

- `src/data/schema/global.sql.ts` / `semester.sql.ts` / `conversation.sql.ts`
- `src/data/db.ts` / `global.ts` / `semester.ts` / `memory.ts` / `index.ts`
- `tests/unit/data-schema.test.ts` / `tests/integration/data-create.test.ts`
- `tsconfig.node.json`（include 追加 src/data）
- `.record/T-M0-006-实施记录.md`（收尾时创建）

## 10. 16 步执行跟踪

- [ ] 步骤 1：读文档、定边界（已完成：05-ERD §1-§10）
- [ ] 步骤 2：检查文档门禁（已完成：T-M0-002 done + master 干净 + .plan 无执行中任务）
- [ ] 步骤 3：编写 .plan/ 计划（本文件）
- [ ] 步骤 4：独立审查计划
- [ ] 步骤 5：用户批准计划（★ 用户授权）
- [ ] 步骤 6：拆分任务、逐项实现
- [ ] 步骤 7：TDD 测试（RED → 最小实现 GREEN → REFACTOR）
- [ ] 步骤 8：type-check（`pnpm type-check`）
- [ ] 步骤 9：build（`pnpm build`）
- [ ] 步骤 10：test（`pnpm test`）
- [ ] 步骤 11：smoke / 安全脚本（`pnpm smoke` + check-desktop-security）
- [ ] 步骤 12：独立审查并修复
- [ ] 步骤 13：更新 04-Todo + 文档
- [ ] 步骤 14：文档治理检查（`node scripts/check-docs-governance.mjs`）
- [ ] 步骤 15：diff 检查（`git diff --check`）
- [ ] 步骤 16：提交交付（★ 用户授权后执行）

## 11. 证据登记（收尾时填写）

- 测试日志路径：
- 提交哈希：
- 推送状态：
- 实施记录路径：

---

## 审查记录

### 审查项（步骤 4 独立审查）

1. **范围合理性**：仅建库能力（schema DDL + PRAGMA + integrity_check），业务 CRUD/M1 handler 明确非目标，无范围蔓延（AGENTS.md §6.4）。
2. **node:sqlite 选型**：符合 05-ERD §1.1 权威条款 + Node v22.16.0 满足；FTS5 支持为唯一风险点，留 L3-01 实测 + 容灾回退。
3. **触发器完整性**：9 个触发器（05-ERD §6）逐一断言，含存储路径逃逸（08-Test §5.4）。
4. **数据隔离**：测试全部注入隔离目录，符合 AGENTS.md §5.3。
5. **tsconfig 纳入**：数据层需被 node 编译覆盖，tsconfig.node.json include 追加 src/data。

### 待用户审查关注点

- **node:sqlite 是否可接受**（vs better-sqlite3）：node:sqlite 零依赖符合 ERD，但 FTS5 需实测；若你更倾向 better-sqlite3 的成熟多库/FTS5，需接受 pnpm build 引入 native 依赖。
- **L3 FTS5 回退方案**：若 node:sqlite FTS5 不可用，L3 仅建普通 chunks 表 + 应用层索引（容灾），是否可接受。

## 完成记录

- 完成日期：
- 实施记录：.record/T-M0-006-实施记录.md
- 状态：📝 待审查