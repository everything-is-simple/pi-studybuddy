# 任务计划：T-M2-005 备份恢复

**任务 ID**：T-M2-005
**日期**：2026-08-08
**状态**：📝 待审查
**关联文档**：07-WF §5 + 06-API §3.11 + 05-ERD §2.3/§2.4/§8.1-§8.3 + 03-Arch §3.1 + 08-Test §5.3/§5.4/§7.6 + 02-PRD §3.10 + 09-UI §6
**里程碑**：M2 完整闭环（第 5 任务，M2 最后一个业务 Adapter）

---

## 1. 任务目标

### 做什么

实现备份恢复全链路：7 RPC handler + 5 studybuddy_* 工具 + zip 打包/解包 + content_hash=SHA-256 完整性校验 + schema_version 兼容性校验 + 恢复冲突处理 + PRAGMA integrity_check + 定期调度配置 + Streams["backup.progress"] 推送。

### 为什么

- 02-PRD §3.10 将备份恢复列为 SQLite 崩溃应对双保险（WAL + 定期 zip）
- 是 09-UI 备份恢复 UI 任务的前置依赖
- 是 M2 退出门槛"备份恢复 content_hash + integrity_check 通过"的必要组件
- 是 M2 最后一个业务 Adapter，完成后 M2 仅剩 UI + E2E 两个方向

### 依据

- [07-WF §5](../docs/07-工作流-Workflow.md)：备份恢复路径（手动备份 + 定期调度 + 恢复流程 + 归档触发 + zip 结构 + 关键约束 + 错误处理 3 条）
- [06-API §3.11](../docs/06-API契约-API-Contracts.md)：7 RPC 方法（backup.course / allCourses / restore / list / configureSchedule / listSchedules / toggleSchedule）
- [05-ERD §2.3](../docs/05-数据模型-ERD-Data-Model.md)：backup_records schema（14 字段 + 4 索引 + CHECK 约束）
- [05-ERD §2.4](../docs/05-数据模型-ERD-Data-Model.md)：backup_schedules schema（10 字段 + 索引）
- [05-ERD §8.1-§8.3](../docs/05-数据模型-ERD-Data-Model.md)：备份 zip 内部结构 + 恢复流程 + SQLite 崩溃恢复
- [03-Arch §3.1](../docs/03-架构设计-Architecture-Design.md)：5 工具注册清单 + 归档前后强制备份约束
- [08-Test §5.3](../docs/08-测试验收-Test-Plan.md)：备份恢复冒烟（单课程/全课程/定期调度/恢复/归档触发）
- [08-Test §5.4](../docs/08-测试验收-Test-Plan.md)：不连真实外部服务全 mock
- [08-Test §7.6](../docs/08-测试验收-Test-Plan.md)：备份恢复不变量（每课程独立 zip / 本地目录 / content_hash / 定期调度 / 手动触发 / 归档前后 / 崩溃恢复）
- [02-PRD §3.10](../docs/02-PRD-产品需求-Product-Requirements.md)：备份恢复产品需求（手动/定期/归档触发，不传云端）
- [09-UI §6](../docs/09-使用者介面-UI-Design.md)：备份恢复 UI（本任务不做，留待后续）
- [AGENTS.md §9.4](../AGENTS.md)：zip 炸弹防护（条目/解压比限制）+ MIME 严格匹配

## 2. 范围与非目标

### 范围

- **前置 DTO 对齐**：types.ts BackupRecord / BackupSchedule 对齐 05-ERD §2.3/§2.4 schema（当前 DTO 字段不全，缺 backup_type/status/content_hash/zip_filename/error_code/schedule_cron/started_at/completed_at/last_run_at/next_run_at 等，类似 T-M1-001 前置对齐）
- **7 RPC handler**：
  - `backup.course` — 单课程备份为 zip（manifest.json + data/*.jsonl + storage/）+ content_hash=SHA-256 + 写 backup_records(manual)
  - `backup.allCourses` — 全课程备份（遍历 course_instances 逐个调用 backup.course）
  - `backup.restore` — 解压 + content_hash 校验 + schema_version 兼容 + 冲突 overwrite/create_new + 导入 jsonl + 复制 storage + PRAGMA integrity_check
  - `backup.list` — 从 backup_records 查询（按 semesterId/courseInstanceId 过滤）
  - `backup.configureSchedule` — 写 backup_schedules（cron_expression + timezone）
  - `backup.listSchedules` — 查询 backup_schedules
  - `backup.toggleSchedule` — 启用/禁用调度
- **5 studybuddy_* 工具注册**（03-Arch §3.1）：
  - `studybuddy_backup_course` → backup.course
  - `studybuddy_backup_all_courses` → backup.allCourses
  - `studybuddy_restore_course` → backup.restore
  - `studybuddy_list_backups` → backup.list
  - `studybuddy_configure_backup_schedule` → backup.configureSchedule + listSchedules + toggleSchedule
- **BackupContext 句柄管理**（复用 S1-S7 Context 模式：globalDb + semesterDbs + dataRoot + dispose）
- **zip 打包**（Node 内置 zlib/fs，不引入外部依赖）：
  - manifest.json 生成（course_instance_id/course_name/semester_id/semester_label/backup_type/backup_date/content_hash/schema_version/tables/file_count/total_size_bytes）
  - data/*.jsonl 按 course_instance_id 过滤导出 semester.db 相关表
  - storage/ 复制该课程 storage_key 指向的资料文件
- **zip 解包与恢复**：
  - 解压到临时目录 + 读取 manifest.json
  - content_hash=SHA-256 校验完整性（不匹配 → BAD_REQUEST）
  - schema_version 兼容性校验（不兼容 → BAD_REQUEST）
  - 检查目标学期同名课程冲突（学生确认 overwrite/create_new）
  - 导入 data/*.jsonl 到 semester.db
  - 复制 storage/ 文件到目标学期 storage 目录
  - PRAGMA integrity_check（失败 → INTERNAL_ERROR）
- **backup_records 状态机**：in_progress → completed / failed
- **Streams["backup.progress"] 推送**（已在 streams.ts 就绪，备份/恢复进度）
- **定期调度配置**（backup_schedules CRUD，cron_expression 校验）
- **zip 炸弹防护**（AGENTS.md §9.4：条目数限制 + 解压比限制）
- **符号链接逃逸防护**（恢复时校验 storage/ 文件不逃逸目标目录）
- **studybuddy-extension.ts 接入**（BackupContext + createBackupTools，工具数 29 → 34）
- **扩展装配测试同步更新**（断言 5 个备份工具被注册）

### 非目标（不做什么）

- **不做备份恢复 UI**（09-UI §6 全局控制条/备份历史列表/恢复向导，留待 09-UI S5-S7+TTS+备份恢复 UI 任务）
- **不做归档触发备份的联动**（07-WF §5.4 semesters.transition 到 archived 时强制 backup.allCourses）——需修改 S1 已完成的 transition handler，跨任务耦合，留待后续评估。本任务 backup.allCourses 可独立调用，归档联动作为后续增强
- **不实现真实 cron-scheduler 调度执行**（08-Test §5.4 不连真实外部服务）——本任务只实现 backup_schedules 配置 CRUD + listSchedules + toggleSchedule，cron 到期执行留待调度层任务（03-Arch §7 调度层 isCronDue）
- **不做 E2E-08/09 备份恢复**（留待 E2E-04~09 任务）
- **不传云端**（02-PRD §3.10，只本地目录）
- **不自动决定冲突处理**（学生确认 overwrite 或 create_new）
- **不连真实外部服务**（测试全 mock，zip 打包/解压用 tmp 目录夹具，08-Test §5.4）

## 3. 文件清单

### 将创建的文件

| 文件路径 | 用途 |
|---|---|
| `src/agent-host/handlers/backup/context.ts` | BackupContext（复用 S1-S7 模式：globalDb + semesterDbs + dataRoot + dispose） |
| `src/agent-host/handlers/backup/dto.ts` | DTO 对齐 05-ERD §2.3/§2.4（BackupRecord/BackupSchedule 完整字段 + 查询参数 + 恢复参数） |
| `src/agent-host/handlers/backup/errors.ts` | 错误码 + 固定文案（CONTENT_HASH_MISMATCH / SCHEMA_VERSION_INCOMPATIBLE / INTEGRITY_CHECK_FAILED / ZIP_BOMB_DETECTED / PATH_TRAVERSAL_DETECTED） |
| `src/agent-host/handlers/backup/zip-packer.ts` | zip 打包（manifest.json + data/*.jsonl 按 course_instance_id 过滤导出 + storage/ 复制 + content_hash 计算） |
| `src/agent-host/handlers/backup/zip-restorer.ts` | zip 解包与恢复（解压 + manifest 读取 + content_hash 校验 + schema_version 校验 + 冲突检查 + jsonl 导入 + storage 复制 + integrity_check + zip 炸弹防护） |
| `src/agent-host/handlers/backup/backup.ts` | 7 handler 实现（handleBackupCourse / handleBackupAllCourses / handleRestore / handleList / handleConfigureSchedule / handleListSchedules / handleToggleSchedule） |
| `src/agent-host/handlers/backup/index.ts` | createBackupHandlers(ctx) 装配出口（参照 s7/index.ts） |
| `src/agent/tools/backup/tools.ts` | createBackupTools(ctx) 注册 5 工具（参照 s7/tools.ts） |
| `tests/unit/backup-zip-packer.test.ts` | zip 打包单件测试（manifest 字段 + jsonl 按 course_instance_id 过滤 + storage 复制 + content_hash 计算 + 文件计数） |
| `tests/unit/backup-zip-restorer.test.ts` | zip 解包单件测试（content_hash 校验失败/通过 + schema_version 兼容/不兼容 + 冲突 overwrite/create_new/none + integrity_check + zip 炸弹防护 + 符号链接逃逸防护） |
| `tests/unit/backup-handlers.test.ts` | 7 handler 单件测试（backup.course 写 backup_records + allCourses 多课程 + restore 返回 RestoreResult + list 过滤 + configureSchedule 写 backup_schedules + listSchedules + toggleSchedule 状态机） |
| `tests/unit/backup-tools.test.ts` | 5 工具注册测试（参照 s7-tools.test.ts） |
| `tests/integration/backup-handlers.test.ts` | 集成测试（BackupContext + 7 handler + Streams["backup.progress"] 推送 + backup_records 状态机 in_progress→completed，参照 s7-handlers.test.ts） |

### 将修改的文件

| 文件路径 | 修改内容 |
|---|---|
| `src/contract/types.ts` | BackupRecord 对齐 05-ERD §2.3（补 backup_type/status/content_hash/zip_filename/error_code/schedule_cron/started_at/completed_at 8 字段）+ BackupSchedule 对齐 §2.4（补 last_run_at/next_run_at/enabled 改为 boolean 保持 DTO 语义）+ RestoreResult 补 schemaVersion 字段 |
| `src/agent/studybuddy-extension.ts` | 接入 BackupContext + createBackupTools（工具数 29 → 34）+ 更新顶部注释 |
| `tests/integration/studybuddy-extension-contract.test.ts` | 扩展装配测试同步更新（断言 5 个备份工具被注册，工具数 29 → 34） |
| `docs/04-任务清单-Todo-List.md` | §7.3.1 新增 T-M2-005 行 + §9 统计 M2 5 done（收尾时） |

## 4. 接口设计

### RPC 方法（06-API §3.11，api.ts 已就绪无需修改）

```typescript
// contract/api.ts（现状 L318-340，已就绪）
"backup.course": {
  params: { courseInstanceId: string; targetPath: string };
  result: BackupRecord;
};
"backup.allCourses": {
  params: { semesterId: string; targetPath: string };
  result: BackupRecord[];
};
"backup.restore": {
  params: { zipPath: string; targetSemesterId: string; conflictResolution?: "overwrite" | "create_new" };
  result: RestoreResult;
};
"backup.list": {
  params: { semesterId?: string; courseInstanceId?: string };
  result: BackupRecord[];
};
"backup.configureSchedule": {
  params: { semesterId: string; courseInstanceId?: string; cronExpression: string; timezone: string };
  result: BackupSchedule;
};
"backup.listSchedules": { params: { semesterId: string }; result: BackupSchedule[] };
"backup.toggleSchedule": { params: { id: string; enabled: boolean }; result: BackupSchedule };
```

### DTO 对齐（types.ts → 05-ERD §2.3/§2.4）

```typescript
// BackupRecord 对齐 05-ERD §2.3（当前 7 字段 → 15 字段）
export interface BackupRecord {
  id: string;
  semesterId: string;                    // 改为必填（NOT NULL REFERENCES semesters(id)）
  courseInstanceId: string;
  backupType: "manual" | "scheduled" | "pre_archive" | "post_archive";  // 新增
  targetPath: string;
  zipFilename: string;                   // 新增
  contentHash: string;                   // 新增
  fileSizeBytes: number;                 // 重命名 sizeBytes → fileSizeBytes
  status: "in_progress" | "completed" | "failed";  // 新增
  errorCode?: string;                    // 新增（可选）
  scheduleCron?: string;                 // 新增（可选，scheduled 类型时记录）
  startedAt: string;                     // 新增
  completedAt?: string;                  // 新增
  createdAt: string;
}

// BackupSchedule 对齐 05-ERD §2.4（当前 6 字段 → 10 字段）
export interface BackupSchedule {
  id: string;
  semesterId: string;
  courseInstanceId?: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;                      // 已有
  lastRunAt?: string;                    // 新增
  nextRunAt?: string;                    // 新增
  createdAt: string;                     // 新增
  updatedAt: string;                     // 新增
}

// RestoreResult 补 schemaVersion（恢复时返回实际 schema_version）
export interface RestoreResult {
  success: boolean;
  restoredCourseId: string;
  conflictResolved: "overwrite" | "create_new" | "none";
  tablesImported: string[];
  filesRestored: number;
  integrityCheck: "ok" | "warning";
  schemaVersion?: string;                // 新增（manifest 中的 schema_version）
}
```

### zip 内部结构（05-ERD §8.1）

```
<course-name>-<backup-date>.zip
  ├ manifest.json
  │  {
  │    "course_instance_id": "uuid",
  │    "course_name": "高等数学",
  │    "semester_id": "uuid",
  │    "semester_label": "2026 秋",
  │    "backup_type": "manual",
  │    "backup_date": "2026-08-08",
  │    "content_hash": "sha256...",
  │    "schema_version": "1.0",
  │    "tables": ["course_instances", "materials", ...],
  │    "file_count": 15,
  │    "total_size_bytes": 12345678
  │  }
  ├ data/
  │  ├ course_instances.jsonl
  │  ├ materials.jsonl
  │  ├ normalized_texts.jsonl
  │  ├ structured_notes.jsonl
  │  ├ knowledge_modules.jsonl
  │  └ ... (该课程所有相关表，按 course_instance_id 过滤导出)
  └ storage/
     ├ material-uuid-1.pdf
     └ ...
```

### 错误码（固定文案，不泄漏路径/stdout/stderr）

| 错误码 | 触发条件 | 错误消息（固定文案） | HTTP 类比 |
|---|---|---|---|
| `CONTENT_HASH_MISMATCH` | 恢复时 content_hash 不匹配 | "备份文件已损坏，content_hash 不匹配" | BAD_REQUEST |
| `SCHEMA_VERSION_INCOMPATIBLE` | schema_version 不兼容 | "备份版本不兼容，当前系统不支持该版本" | BAD_REQUEST |
| `INTEGRITY_CHECK_FAILED` | 恢复后 PRAGMA integrity_check 失败 | "恢复后数据完整性检查失败，请联系技术支持" | INTERNAL_ERROR |
| `ZIP_BOMB_DETECTED` | 条目数或解压比超限 | "备份文件异常，可能已损坏" | BAD_REQUEST |
| `PATH_TRAVERSAL_DETECTED` | storage/ 文件逃逸目标目录 | "备份文件包含不安全的路径" | BAD_REQUEST |
| `BACKUP_FAILED` | zip 打包失败 | "备份失败，请重试" | INTERNAL_ERROR |
| `SCHEDULE_NOT_FOUND` | toggleSchedule 调度不存在 | "调度配置不存在" | NOT_FOUND |

### 安全约束

- **zip 炸弹防护**（AGENTS.md §9.4）：条目数上限 10000 + 解压比上限 100:1
- **符号链接逃逸防护**：恢复时校验 storage/ 文件路径不逃逸目标 storage 目录
- **content_hash=SHA-256**：备份时计算 + 恢复时校验
- **schema_version 兼容性**：当前版本 "1.0"，不兼容则拒绝
- **不传云端**：targetPath 只本地目录
- **不泄漏路径/stdout/stderr**：错误消息固定文案

## 5. 测试计划（TDD，08-Test §3 + §5.3 + §7.6）

### 单件测试（阶段 2）

#### backup-zip-packer.test.ts

- manifest.json 字段完整（10 字段）
- data/*.jsonl 按 course_instance_id 过滤导出（只含该课程数据）
- storage/ 复制该课程 storage_key 指向的资料文件
- content_hash=SHA-256 计算正确
- file_count / total_size_bytes 统计正确
- zip 文件名格式 `<course-name>-<backup-date>.zip`
- 空课程（无资料无数据）可备份
- 大课程（多表多文件）可备份

#### backup-zip-restorer.test.ts

- content_hash 校验通过 → 继续恢复
- content_hash 校验失败 → 抛 CONTENT_HASH_MISMATCH
- schema_version 兼容 → 继续恢复
- schema_version 不兼容 → 抛 SCHEMA_VERSION_INCOMPATIBLE
- 无冲突 → conflictResolved="none"
- 有冲突 + overwrite → 覆盖现有课程数据
- 有冲突 + create_new → 新建课程
- 恢复后 PRAGMA integrity_check 通过 → integrityCheck="ok"
- 恢复后 PRAGMA integrity_check 失败 → 抛 INTEGRITY_CHECK_FAILED
- zip 炸弹防护：条目数超限 → 抛 ZIP_BOMB_DETECTED
- zip 炸弹防护：解压比超限 → 抛 ZIP_BOMB_DETECTED
- 符号链接逃逸：storage/ 文件逃逸目标目录 → 抛 PATH_TRAVERSAL_DETECTED
- 恢复后 data/*.jsonl 正确导入 semester.db
- 恢复后 storage/ 文件正确复制到目标 storage 目录
- 恢复后返回 RestoreResult（含 tablesImported/filesRestored/integrityCheck/schemaVersion）

#### backup-handlers.test.ts

- backup.course：写 backup_records(manual, completed) + 返回 BackupRecord + 推送 Streams["backup.progress"]
- backup.course：targetPath 不存在 → 创建目录
- backup.course：courseInstanceId 不存在 → NOT_FOUND
- backup.allCourses：遍历 course_instances 逐个备份 + 返回 BackupRecord[]
- backup.allCourses：学期无课程 → 返回空数组
- backup.restore：返回 RestoreResult + 写 backup_records(恢复记录)
- backup.list：按 semesterId 过滤
- backup.list：按 courseInstanceId 过滤
- backup.list：无参数返回全部
- backup.configureSchedule：写 backup_schedules + 返回 BackupSchedule
- backup.configureSchedule：cron_expression 校验（格式错误 → BAD_REQUEST）
- backup.listSchedules：按 semesterId 查询
- backup.toggleSchedule：enabled true→false
- backup.toggleSchedule：调度不存在 → SCHEDULE_NOT_FOUND

#### backup-tools.test.ts

- 5 工具 name 匹配 ^studybuddy_[a-z_]+$
- 5 工具必填 name/label/description/parameters/execute
- execute 薄封装调用对应 handler
- TypeBox schema 参数校验

### 集成测试（阶段 3）

#### backup-handlers.test.ts（集成）

- BackupContext + 7 handler 全链路
- backup.course → backup.list → backup.restore 往返
- backup.allCourses 多课程备份
- Streams["backup.progress"] 推送备份进度
- backup_records 状态机 in_progress → completed
- backup_schedules CRUD 全链路
- 跨库读写（global.db backup_records + semester.db 数据导出）

### 扩展装配测试（同步更新）

- studybuddy-extension-contract.test.ts：断言 5 个备份工具被注册（工具数 29 → 34）

### 不变式断言（08-Test §7.6）

- 每课程独立 zip（backup.course 返回单个 BackupRecord）
- 备份到本地目录（targetPath 本地路径）
- content_hash 校验（恢复时校验）
- 手动触发 backup_type=manual
- 恢复后 integrity_check 通过

## 6. TDD 执行步骤（AGENTS.md §5.1 RED → GREEN → REFACTOR）

### 步骤 1：前置 DTO 对齐

1. RED：修改 types.ts BackupRecord/BackupSchedule/RestoreResult → 运行 type-check 发现 contract 测试失败
2. GREEN：修复 contract 测试断言对齐新 DTO
3. REFACTOR：确认 562 测试全绿

### 步骤 2：BackupContext + errors + dto

1. RED：写 backup/context.ts + errors.ts + dto.ts → 写 backup-handlers.test.ts 失败用例
2. GREEN：实现 BackupContext（复用 S7Context 模式）+ 错误码 + DTO
3. REFACTOR：确认单件测试通过

### 步骤 3：zip-packer

1. RED：写 backup-zip-packer.test.ts 失败用例
2. GREEN：实现 zip-packer.ts（manifest + jsonl + storage + content_hash）
3. REFACTOR：确认单件测试通过

### 步骤 4：zip-restorer

1. RED：写 backup-zip-restorer.test.ts 失败用例（含安全防护）
2. GREEN：实现 zip-restorer.ts（解压 + 校验 + 冲突 + 导入 + integrity_check + zip 炸弹防护）
3. REFACTOR：确认单件测试通过

### 步骤 5：7 handler

1. RED：写 backup-handlers.test.ts 完整失败用例
2. GREEN：实现 backup.ts 7 handler + index.ts 装配出口
3. REFACTOR：确认单件测试通过

### 步骤 6：5 工具注册

1. RED：写 backup-tools.test.ts 失败用例
2. GREEN：实现 tools/backup/tools.ts 5 工具
3. REFACTOR：确认单件测试通过

### 步骤 7：集成测试

1. RED：写 integration/backup-handlers.test.ts 失败用例
2. GREEN：确认集成测试通过（handler + Context + Streams）
3. REFACTOR：确认集成测试通过

### 步骤 8：extension 接入

1. RED：修改 studybuddy-extension.ts + studybuddy-extension-contract.test.ts → 装配测试失败
2. GREEN：接入 BackupContext + createBackupTools
3. REFACTOR：确认装配测试通过（工具数 29 → 34）

### 步骤 9：全量验证

1. `pnpm type-check` 通过
2. `pnpm test` 全绿（562 + 新增测试）
3. `pnpm build` 通过
4. `pnpm smoke` 6/6 通过
5. `node scripts/check-docs-governance.mjs` 通过

## 7. 范式参照

| 范式 | 参照来源 | 复用点 |
|---|---|---|
| BackupContext 句柄管理 | S7Context（src/agent-host/handlers/s7/context.ts） | globalDb + semesterDbs + dataRoot + dispose |
| handler 装配出口 | s7/index.ts | createBackupHandlers(ctx) 返回 method→fn 映射 |
| 工具注册 | s7/tools.ts | TypeBox schema + execute 薄封装 handler + TOOL_NAMES 常量 |
| extension 接入 | studybuddy-extension.ts TTS 接入 | 创建 ctx + createXxxTools + for 循环 registerTool |
| 错误码固定文案 | s7/errors.ts + whisper-adapter.ts | 不泄漏路径/stdout/stderr |
| DTO 对齐 schema | T-M1-001 前置 DTO 对齐 | 权威链 05-ERD > types.ts |
| Streams 推送 | tts/tts.ts Streams["tts.state"] | Streams["backup.progress"] 推送进度 |

## 8. 收尾流程（AGENTS.md §7 受控收尾）

1. 复验当前任务的测试和最小端到端路径（backup.course → backup.list → backup.restore 往返）
2. 更新 docs/04-Todo：
   - §7.3.1 新增 T-M2-005 行（done）
   - §9 统计 M2 5 done（M2 业务 Adapter 全部完成）
   - 版本历史追加 v0.1.29 条目
3. 创建 .record/T-M2-005-实施记录.md（8 章节：任务裁决/实际交付/偏差/问题根因/关键决定/测试证据/Git证据/未解决事项）
4. 如 API 合同变化（types.ts DTO 对齐），更新 06-API 文档（如需）
5. 在 .plan/00-当前任务.md 标明完成状态 + 保留本计划原件作为历史范围与验收证据
6. 运行文档治理检查（node scripts/check-docs-governance.mjs）
7. 停止并报告，等待用户明确指示（不自动提交/推送，AGENTS.md §8.3）

### 完成判据（AGENTS.md §8.4 三者齐全）

1. docs/04-Todo 证据已登记（T-M2-005 done）
2. master 分支复验通过（type-check + 全量测试 + build + smoke 6/6）
3. origin/master 推送成功

## 9. 风险与约束

| 风险 | 缓解措施 |
|---|---|
| DTO 对齐可能破坏现有 562 测试 | 步骤 1 先对齐 + 修复 contract 测试，确认全绿后再继续 |
| zip 打包/解压在 Windows 路径分隔符问题 | 统一用 path.join + path.normalize |
| jsonl 导入 semester.db 可能触发外键约束 | 导入顺序按表依赖关系 + 临时关闭 FK PRAGMA 后重开 |
| 大课程备份性能 | 本任务不优化，确定性测试用小夹具 |
| 归档触发备份联动未实现 | 明确列为非目标，backup.allCourses 可独立调用 |

## 10. 历史与下一步

- **本任务完成后**：M2 业务 Adapter 层全部完成（S5/S6/S7/TTS/备份恢复），M2 仅剩 09-UI S5-S7+TTS+备份恢复 UI + E2E-04~09 两个方向
- **M2 退出门槛剩余**：S1-S7 全链路冒烟 + E2E-01~09 + UUID 泄漏检测（已完成）+ TTS 朗读冒烟（已完成）+ 备份恢复 content_hash/integrity_check（本任务完成）+ 投递渠道独立失败隔离（已完成）
- **不预写下一任务计划**（AGENTS.md §4.4 单一执行任务门禁）
