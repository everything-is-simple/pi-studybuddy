# 任务计划：T-M2-003 S7 课堂采集（许可确认 / PCM WAV / whisper.cpp / handoff）

**任务 ID**：T-M2-003
**日期**：2026-08-07
**状态**：📝 待审查
**关联文档**：07-WF §2.7 + 06-API §3.9 + 05-ERD §3.2.1/§3.2.2 + 03-Arch §3.1/§3.3 + 08-Test §3.3.2/§5.4
**里程碑**：M2 完整闭环（第 3 任务）

---

## 1. 任务目标

### 做什么

实现 S7 课堂采集子系统：2 RPC handler（`classCapture.transcribe` / `classCapture.saveTranscription`）+ 2 studybuddy_* 工具注册 + WhisperCppAdapter（外部桥）+ PCM WAV 文件头服务端验证 + handoff 到 S2 materials/normalized_texts/study_events。

### 为什么

完成 07-WF §2.7 的 S7 闭环：学生勾选许可确认 → 选受控 PCM WAV → 本机 whisper.cpp 同步转写 → 学生修改 → 保存为 S2 笔记输入（不建独立表/Job/Worker，复用 S2 既有路径）。是 M2 完整闭环的关键拼图之一。

### 依据

- [07-WF §2.7](../docs/07-工作流-Workflow.md)：5 步流程 + 7 条关键约束 + 3 条错误处理
- [06-API §3.9](../docs/06-API契约-API-Contracts.md)：2 RPC 方法契约
- [05-ERD §3.2.1](../docs/05-数据模型-ERD-Data-Model.md)：materials.source_type='class_audio_transcription' + permission_confirmed 字段已存在
- [05-ERD §3.2.2](../docs/05-数据模型-ERD-Data-Model.md)：normalized_texts.source_type='class_audio_transcription' 字段已存在
- [03-Arch §3.1](../docs/03-架构设计-Architecture-Design.md)：S7 工具表 2 工具（studybuddy_transcribe_class / studybuddy_save_transcription）
- [03-Arch §3.3](../docs/03-架构设计-Architecture-Design.md)：whisper.cpp Adapter 设计契约（CLI/模型路径只来自配置；不猜路径不回退云端；子进程 stdout；路径/stdout/stderr/密钥不泄漏；固定错误码）
- [08-Test §3.3.2](../docs/08-测试验收-Test-Plan.md)：whisper.cpp Adapter 单件测试 3 断言（路径未配置 / PCM WAV 文件头验证 / 转写成功不返回 stdout 全文）
- AGENTS.md §5.4：不连真实 whisper.cpp（全部 mock）

## 2. 范围与非目标

### 范围

- 2 RPC handler：
  - `classCapture.transcribe({courseId, audioFile, permissionConfirmed})` → `{transcription}`
  - `classCapture.saveTranscription({courseId, transcription, title})` → `Material`
- 2 studybuddy_* 工具注册（03-Arch §3.1 工具表）：
  - `studybuddy_transcribe_class` → classCapture.transcribe
  - `studybuddy_save_transcription` → classCapture.saveTranscription
- WhisperCppAdapter：可注入接口（默认 mock 确定性）+ 真实实现（spawn CLI + 解析 stdout）；CLI/模型路径只来自配置
- PCM WAV 文件头服务端重新验证（RIFF/WAVE/PCM/16kHz/单声道/16-bit，44 字节头部读取 + 不信任浏览器 MIME）
- 许可确认强制（`permissionConfirmed=false` → BAD_REQUEST + "需要课堂采集许可确认"）
- 原始音频只暂存 `tmp/class-capture/<request-id>/`，handler finally 清理
- handoff 到 S2：
  - materials 表：`file_type='text'`、`source_type='class_audio_transcription'`、`status='converted'`、`permission_confirmed=1`
  - normalized_texts 表：`source_type='class_audio_transcription'`、`content=<transcription>`、`content_hash=SHA-256(transcription)`、`char_count`
  - study_events 表：`event_type='class_handoff_saved'`、`source_system='S7'`、`source_ref_id=<material_id>`、`course_instance_id=<courseId>`
- 安全：
  - 错误消息固定文案，不返回路径/stdout/stderr/密钥
  - 3 条固定错误码（07-WF §2.7 错误处理）：
    - 文件头验证失败 → BAD_REQUEST + "仅支持 PCM WAV 格式（16kHz/单声道/16-bit）"
    - whisper.cpp 路径未配置 → INTERNAL_ERROR + "语音转写未配置，请在设置中指定 whisper.cpp 路径"
    - 转写失败 → INTERNAL_ERROR + "转写失败，请检查音频文件是否完整"
- studybuddy-extension 接入 S7 工具注册（共 26 工具）
- agent-host/handlers 装配 S7 handler

### 非目标（不做什么，07-WF §2.7 明确边界）

- 不支持 MP3/M4A/WebM/视频/FFmpeg 转码（受控 PCM WAV 单一输入）
- 不做实时录音 / 流式字幕
- 不做说话人分离
- 不做云端上传（不回退云端）
- 不留存原始音频（finally 清理）
- 不建独立 S7 表/Job/Worker（复用 S2 既有路径）
- 不自动 generateNote（学生保存后在 S2 自行触发）
- 不实现真实 whisper.cpp 子进程集成测试（08-Test §5.4 全 mock；真实 whisper.cpp 集成留待 E2E 受控夹具，本任务范围外）

## 3. 文件清单

### 将创建的文件

| 文件路径 | 用途 |
|---|---|
| `src/agent-host/handlers/s7/context.ts` | S7Context（dataRoot 句柄 + WhisperCppAdapter 注入 + whisperCliPath/whisperModelPath/tmpRoot 配置） |
| `src/agent-host/handlers/s7/whisper-adapter.ts` | WhisperCppAdapter 接口 + createMockWhisperAdapter（确定性） + createRealWhisperAdapter（spawn CLI，本任务仅实现框架，测试用 mock） |
| `src/agent-host/handlers/s7/wav-validator.ts` | validatePcmWav(filePath)：读取 44 字节头部，验证 RIFF/WAVE/PCM/16kHz/单声道/16-bit |
| `src/agent-host/handlers/s7/class-capture.ts` | handleTranscribe（许可校验 + WAV 验证 + adapter.transcribe + finally 清理）+ handleSaveTranscription（创建 material + normalized_text + study_event） |
| `src/agent-host/handlers/s7/dto.ts` | mapMaterial：materials 行 → Material DTO（复用 S2 字段映射规则） |
| `src/agent-host/handlers/s7/errors.ts` | badRequest / internalError（固定文案，不泄漏路径） |
| `src/agent-host/handlers/s7/events.ts` | writeClassHandoffSavedEvent（study_events：class_handoff_saved / source_system='S7' / source_ref_id=material_id / course_instance_id） |
| `src/agent-host/handlers/s7/lookup.ts` | findSemesterByCourseId（courseId → semester.db 定位，复用 S6 模式） |
| `src/agent-host/handlers/s7/index.ts` | createS7Handlers 装配出口（2 method→fn 映射） |
| `src/agent/tools/s7/tools.ts` | 2 个 studybuddy_* 工具 TypeBox schema + execute 薄封装 |
| `tests/unit/agent-host/s7/wav-validator.test.ts` | WAV 文件头验证单件（合法 PCM WAV + 拒绝 MP3/M4A/WebM + 拒绝非 PCM + 拒绝非 16kHz/单声道/16-bit + 拒绝空文件 + 拒绝截断头部） |
| `tests/unit/agent-host/s7/whisper-adapter.test.ts` | WhisperCppAdapter 单件（08-Test §3.3.2 三断言：路径未配置→INTERNAL_ERROR 不泄漏 / PCM WAV 文件头验证拒绝 / 转写成功不返回 stdout 全文） |
| `tests/unit/agent-host/s7/class-capture.test.ts` | handler 单件：transcribe（许可 false→BAD_REQUEST / WAV 验证失败→BAD_REQUEST / adapter 失败→INTERNAL_ERROR / 成功返回 transcription / 原始音频 finally 清理）+ saveTranscription（创建 material + normalized_text + study_event / content_hash 一致 / DTO 字段对齐 ERD） |
| `tests/integration/agent-host/s7-handoff.test.ts` | 集成：跨库 handoff 到 S2（建学期/课程 → saveTranscription → materials/normalized_texts/study_events 三表写入断言 + source_type='class_audio_transcription' + status='converted' + permission_confirmed=1） |
| `tests/integration/agent/tools-s7.test.ts` | 扩展契约：studybuddy-extension 注册 S7 2 工具（工具名/数量/schema 必填字段断言，复用 S6 集成测试模式） |

### 将修改的文件

| 文件路径 | 修改内容 |
|---|---|
| `src/agent/studybuddy-extension.ts` | 接入 S7Context + createS7Tools，注册 2 个工具（更新头部注释 + setup 内追加） |
| `src/agent-host/index.ts` | 装配 S7 handler 到 RPC 路由（如已统一通过 extension 注入则可能无需改动，待实施时确认） |
| `docs/04-任务清单-Todo-List.md` | §7.3.1 新增 T-M2-003 行（in_progress→done）+ §9 统计 M2 pending/in_progress/done |

### 前置 DTO/schema 对齐核查（已确认无需修改）

| 项 | 现状 | 结论 |
|---|---|---|
| `src/contract/api.ts` §3.9 | `classCapture.transcribe` + `classCapture.saveTranscription` 2 方法已定义（params/result 类型完整） | ✅ 无需修改 |
| `src/contract/types.ts` Material | `sourceType: "upload" \| "class_audio_transcription"` + `permissionConfirmed: number` 已存在 | ✅ 无需修改 |
| `src/data/schema/semester.sql.ts` materials | `source_type CHECK IN ('upload','class_audio_transcription')` + `permission_confirmed` 字段已存在 | ✅ 无需修改 |
| `src/data/schema/semester.sql.ts` normalized_texts | `source_type TEXT` 字段已存在（无 CHECK 约束，自由值） | ✅ 无需修改 |
| `src/data/schema/semester.sql.ts` study_events | `source_system CHECK IN ('S1'..'S7')` 已含 'S7' | ✅ 无需修改 |

> 与 T-M1-001/T-M1-002 启动时的"前置 DTO 对齐 schema"不同，本任务前置已就绪，无需 schema 修复。

## 4. 接口设计

### RPC 方法（contract/api.ts §3.9 已定义）

```typescript
"classCapture.transcribe": {
  params: {
    courseId: string;
    audioFile: FileMeta;             // 浏览器传入文件元信息（路径/mime/size）
    permissionConfirmed: boolean;    // 许可确认强制
  };
  result: { transcription: string }; // 可编辑转写文本（不返回 stdout 全文）
};

"classCapture.saveTranscription": {
  params: { courseId: string; transcription: string; title: string };
  result: Material;                  // 创建的 material（file_type='text', source_type='class_audio_transcription', status='converted'）
};
```

### registerTool 工具（03-Arch §3.1）

```typescript
// 1. studybuddy_transcribe_class → classCapture.transcribe
{
  name: "studybuddy_transcribe_class",
  label: "课堂采集转写",
  description: "本机 whisper.cpp 同步转写受控 PCM WAV（16kHz/单声道/16-bit）。许可确认强制；CLI/模型路径只来自配置；不回退云端；不返回 stdout 全文。",
  parameters: Type.Object({
    courseId: Type.String({ description: "课程实例 ID" }),
    audioFilePath: Type.String({ description: "PCM WAV 文件路径" }),
    permissionConfirmed: Type.Boolean({ description: "已获老师和相关同学允许（合规要求）" }),
  }),
  async execute(_toolCallId, params) { /* 薄封装 handler */ }
}

// 2. studybuddy_save_transcription → classCapture.saveTranscription
{
  name: "studybuddy_save_transcription",
  label: "保存课堂转写为笔记输入",
  description: "学生修改转写文本后保存为 S2 笔记输入（创建 file_type='text' material，初始 converted）。不自动 generateNote。",
  parameters: Type.Object({
    courseId: Type.String({ description: "课程实例 ID" }),
    transcription: Type.String({ description: "学生修改后的转写文本" }),
    title: Type.String({ description: "笔记标题" }),
  }),
  async execute(_toolCallId, params) { /* 薄封装 handler */ }
}
```

### WhisperCppAdapter 接口（可注入，03-Arch §3.3 + 08-Test §3.3.2）

```typescript
export interface WhisperCppAdapter {
  /** 同步转写 PCM WAV 文件，返回纯文本（不返回 stdout 全文） */
  transcribe(audioFilePath: string): Promise<{ text: string }>;
}

/** 默认 mock：确定性返回固定文本，不调真实子进程 */
export function createMockWhisperAdapter(): WhisperCppAdapter;

/** 真实实现：spawn whisper.cpp CLI，解析 stdout（本任务仅框架，测试用 mock） */
export function createRealWhisperAdapter(opts: {
  cliPath: string;
  modelPath: string;
}): WhisperCppAdapter;
```

### PCM WAV 文件头验证（wav-validator.ts）

```typescript
/**
 * 验证 PCM WAV 文件头（44 字节）。
 * 不信任浏览器 MIME，服务端重新读取文件头字节级验证。
 *
 * 校验项（任一失败 → BAD_REQUEST）：
 *   1. 文件存在且可读
 *   2. RIFF magic（bytes 0-3 = "RIFF"）
 *   3. WAVE magic（bytes 8-11 = "WAVE"）
 *   4. fmt chunk PCM format（bytes 20-21 = 0x0001）
 *   5. 单声道（bytes 22-23 = 0x0001）
 *   6. 16kHz 采样率（bytes 24-27 = 0x3E80）
 *   7. 16-bit 位深（bytes 34-35 = 0x0010）
 */
export function validatePcmWav(filePath: string): void;
```

### 数据表（无需新建，复用 S2 既有表）

```sql
-- materials（05-ERD §3.2.1，已有字段）
INSERT INTO materials (
  id, course_instance_id, file_name, file_type, file_size_bytes, mime_type,
  storage_key, source_type, status, permission_confirmed,
  uploaded_at, converted_at, created_at, updated_at
) VALUES (
  @id, @cid, @title, 'text', @size, 'text/plain',
  @storageKey, 'class_audio_transcription', 'converted', 1,
  @ts, @ts, @ts, @ts
);

-- normalized_texts（05-ERD §3.2.2，已有字段）
INSERT INTO normalized_texts (
  id, material_id, content, content_hash, char_count, source_type,
  extraction_meta_json, created_at
) VALUES (
  @id, @mid, @content, @hash, @charCount, 'class_audio_transcription',
  @metaJson, @ts
);

-- study_events（05-ERD §3.1.5，已有字段，source_system CHECK 含 'S7'）
INSERT INTO study_events (
  id, semester_id, course_instance_id, event_type, source_system,
  source_ref_id, event_data_json, occurred_at, created_at
) VALUES (
  @id, @sid, @cid, 'class_handoff_saved', 'S7',
  @materialId, @metaJson, @ts, @ts
);
```

## 5. 测试策略

### 单件测试（阶段 2）

**`tests/unit/agent-host/s7/wav-validator.test.ts`**（PCM WAV 文件头验证）：
- [ ] 合法 PCM WAV（16kHz/单声道/16-bit）→ 通过
- [ ] 拒绝 MP3 文件头（ID3 或 0xFFFB）→ BAD_REQUEST 含 "PCM WAV"
- [ ] 拒绝 M4A 文件头（ftyp box）→ BAD_REQUEST
- [ ] 拒绝 WebM 文件头（0x1A45DFA3）→ BAD_REQUEST
- [ ] 拒绝非 PCM WAV（如 IEEE float format code 0x0003）→ BAD_REQUEST
- [ ] 拒绝非 16kHz 采样率（如 44.1kHz）→ BAD_REQUEST
- [ ] 拒绝非单声道（双声道）→ BAD_REQUEST
- [ ] 拒绝非 16-bit 位深（如 24-bit）→ BAD_REQUEST
- [ ] 拒绝空文件（0 字节）→ BAD_REQUEST
- [ ] 拒绝截断头部（< 44 字节）→ BAD_REQUEST
- [ ] 拒绝不存在的文件路径 → BAD_REQUEST

**`tests/unit/agent-host/s7/whisper-adapter.test.ts`**（08-Test §3.3.2 三断言）：
- [ ] 路径未配置（cliPath=""）→ INTERNAL_ERROR + "未配置"，错误消息不含路径/stdout/stderr
- [ ] 受控 PCM WAV 文件头验证：拒绝 MP3/M4A/WebM（adapter 内部调 wavValidator）
- [ ] 转写成功返回 { text: string }，不返回 stdout 字段（result 无 stdout 属性）

**`tests/unit/agent-host/s7/class-capture.test.ts`**（handler 单件）：
- [ ] `transcribe`：permissionConfirmed=false → BAD_REQUEST + "许可确认"
- [ ] `transcribe`：permissionConfirmed=true + 合法 WAV + mock adapter 成功 → 返回 { transcription }
- [ ] `transcribe`：WAV 验证失败 → BAD_REQUEST + "PCM WAV 格式"（错误消息不含路径）
- [ ] `transcribe`：mock adapter 抛错 → INTERNAL_ERROR + "转写失败"（错误消息不含 stdout/stderr）
- [ ] `transcribe`：成功后 tmp/class-capture/<request-id>/ 目录被清理（finally 断言）
- [ ] `transcribe`：失败后 tmp/class-capture/<request-id>/ 目录也被清理（finally 断言）
- [ ] `transcribe`：错误响应不包含 audioFilePath / cliPath / modelPath / stdout / stderr（安全断言）
- [ ] `saveTranscription`：成功创建 material（file_type='text' / source_type='class_audio_transcription' / status='converted' / permission_confirmed=1）
- [ ] `saveTranscription`：成功创建 normalized_text（content_hash=SHA-256(transcription) / char_count / source_type='class_audio_transcription'）
- [ ] `saveTranscription`：成功创建 study_event（event_type='class_handoff_saved' / source_system='S7' / source_ref_id=material_id）
- [ ] `saveTranscription`：返回 Material DTO 字段对齐 ERD（13 字段）
- [ ] `saveTranscription`：courseId 不存在 → NOT_FOUND

### 集成测试（阶段 3）

**`tests/integration/agent-host/s7-handoff.test.ts`**（跨库 handoff 到 S2）：
- [ ] 建学期 + 课程 → saveTranscription → materials 行存在 + 字段值正确
- [ ] 同上 → normalized_texts 行存在 + content_hash 一致 + UNIQUE(material_id)
- [ ] 同上 → study_events 行存在 + source_system='S7' + course_instance_id 关联
- [ ] 同上 → 返回 Material DTO 与 DB 行一致
- [ ] 跨学期隔离：semester-A 的 handoff 不出现在 semester-B 的库中

**`tests/integration/agent/tools-s7.test.ts`**（扩展契约，复用 S6 模式）：
- [ ] createStudyBuddyExtension setup 后 S7 工具数 = 2
- [ ] 工具名匹配 `^studybuddy_[a-z_]+$`
- [ ] 工具名集合 = { "studybuddy_transcribe_class", "studybuddy_save_transcription" }
- [ ] 每个工具有 name/label/description/parameters/execute 必填字段
- [ ] execute 薄封装调 handler（mock ctx 注入，断言 handler 被调用）
- [ ] 全工具数累计 = 26（S1 6 + S2 6 + S3 3 + S4 4 + S5 2 + S6 3 + S7 2）

### 系统冒烟（阶段 5a）

- [ ] `pnpm smoke`：现有 6 项不退化（build + RPC + 建库 + vault + 六不变量 + 汇总）
- [ ] 测试总数增长（基线 455 → 预期 470+）

### E2E（阶段 5b，本任务范围外）

> E2E-05 课堂采集→S2 handoff（08-Test §6.2）属于 M2 E2E 任务，不在本任务范围。本任务只确保单件 + 集成测试全绿，为 E2E-05 铺路。

### 安全不变量（如涉及）

- [ ] INV-04 credential-vault 不退化（S7 不直接用 vault，但 toolchain 路径配置不泄漏）
- [ ] 不连真实 whisper.cpp（08-Test §5.4）：所有测试 mock，无真实子进程调用
- [ ] 路径不泄漏：错误消息固定文案，不含 cliPath/modelPath/audioFilePath
- [ ] stdout/stderr 不泄漏：WhisperCppAdapter 返回值无 stdout 属性
- [ ] 原始音频不留存：finally 清理 tmp/class-capture/<request-id>/

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | ⏭️ 跳过（whisper.cpp 二进制已在 H:\pi-references\whisper.cpp，本任务不重新下载，仅通过配置路径引用） |
| 2. 单件测试 | ✅ wav-validator + whisper-adapter + class-capture handler 单件 |
| 3. 集成测试 | ✅ s7-handoff 跨库 + tools-s7 扩展契约 |
| 4. 系统组装 | ✅ studybuddy-extension 接入 + agent-host 装配 |
| 5. 冒烟 + E2E | ✅ smoke 6 项不退化（E2E-05 留 M2 E2E 任务） |

## 7. 依赖关系

### 前置任务

- [x] T-M2-002 S6 家长报告（已完成，§8.4 三者齐全）
- [x] T-M0-002 contract 类型化契约面（S7 2 RPC 方法已定义）
- [x] T-M0-006 数据层 schema（materials/normalized_texts/study_events 字段已就绪，含 'S7' CHECK）
- [x] T-M1-002 S2 资料/笔记/知识模块（handoff 目标表已就绪，saveTranscription 复用 S2 字段）

### 组件依赖

- whisper.cpp 二进制（已在 H:\pi-references\whisper.cpp，本任务不集成真实子进程，仅框架）
- node:crypto（SHA-256 / randomUUID，Node 内置）
- node:fs（文件头读取 + tmp 清理）
- node:child_process（spawn，仅 createRealWhisperAdapter 框架，测试用 mock）
- typebox（工具 schema，与 S6 一致）

## 8. 预期产物

### 代码

- `src/agent-host/handlers/s7/`（9 文件：context/whisper-adapter/wav-validator/class-capture/dto/errors/events/lookup/index）
- `src/agent/tools/s7/tools.ts`
- `tests/unit/agent-host/s7/`（3 文件）
- `tests/integration/agent-host/s7-handoff.test.ts`
- `tests/integration/agent/tools-s7.test.ts`

### 文档更新

- `docs/04-任务清单-Todo-List.md`（§7.3.1 新增 T-M2-003 行 + §9 统计 + §10 版本历史）
- `docs/00-文档索引-Index.md`（§七当前状态 + §八版本历史，AGENTS.md §3.1 同步要求）
- `AGENTS.md`（§3.1 版本登记同步 + §12 修订记录，AGENTS.md §11.2 修订纪律）
- `.plan/00-当前任务.md`（状态从"候选预选"→"执行中"→"完成"）

### 实施记录

- `.record/T-M2-003-实施记录.md`（收尾时创建，8 章节模板）

## 9. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（07-WF §2.7 + 06-API §3.9 + 05-ERD §3.2 + 03-Arch §3.1/§3.3 + 08-Test §3.3.2 已核实）
- [x] 步骤 2：检查文档门禁（前置 DTO/schema 已就绪，无需修改）
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [x] 步骤 4：独立审查计划（用户审查）
- [x] 步骤 5：用户批准计划（★ 用户授权，已批准开工）
- [x] 步骤 6：拆分任务、逐项实现（wav-validator → whisper-adapter → context → class-capture → dto/errors/events/lookup → index → tools → extension 接入）
- [x] 步骤 7：编写或更新测试（TDD RED→GREEN→REFACTOR，每模块先写测试）
- [x] 步骤 8：type-check（pnpm type-check，双配置 tsconfig 全通过）
- [x] 步骤 9：build（pnpm build，tsc + vite 成功，37 模块）
- [x] 步骤 10：test（pnpm test，509 tests passed，34 test files）
- [x] 步骤 11：smoke（pnpm smoke，6/6 不退化）
- [x] 步骤 12：独立审查并修复（扩展装配测试 24→26 同步修复）
- [x] 步骤 13：更新 04-Todo v0.1.26 + 00-索引 v0.1.34 + AGENTS.md v0.1.14（任务 done + 版本号同步）
- [x] 步骤 14：文档治理检查（node scripts/check-docs-governance.mjs，exit 0，1 条既有非阻塞警告）
- [x] 步骤 15：diff 检查（git diff --check，exit 0，仅 LF→CRLF 行尾警告 Windows 正常）+ 实施记录创建（.record/T-M2-003-实施记录.md，8 章节完整）
- [ ] 步骤 16：提交交付（★ 用户授权，AGENTS.md §8.3 提交纪律：显式路径 + type(scope): 中文描述）

## 10. 证据登记

- 测试日志路径：H:\pi-studybuddy-tmp\runs\T-M2-003\（5 子目录隔离：unit-wav-validator / unit-whisper-adapter / unit-class-capture / unit-tools / integration）
- 测试总数（基线 455 → 实际）：509（+54：wav-validator 14 + whisper-adapter 8 + class-capture 14 + s7-tools 9 + s7-handlers 9）
- verify 状态：type-check ✅ + build ✅ + test 509 ✅ + smoke 6/6 ✅ + docs-governance ✅ + git diff --check ✅
- 提交哈希：（待用户授权提交）
- 推送状态：（待用户授权推送）
- 实施记录路径：.record/T-M2-003-实施记录.md

---

## 审查记录

步骤 4 独立审查：用户在会话中批准开工，计划已审查通过进入实施。

## 完成记录

- 完成日期：2026-08-07
- 实施记录：.record/T-M2-003-实施记录.md（8 章节完整）
- 状态：✅ 实施完成（待用户授权提交推送，AGENTS.md §8.4 三者齐全才算正式完成）

---

## 单一执行任务门禁核查（AGENTS.md §4.4）

创建本详细计划的三项前置条件已全部满足：
1. ✅ T-M2-002 已正式完成（§8.4 三者齐全：04-Todo v0.1.25 + master aba93e9 + origin/master 推送成功）
2. ✅ 用户已明确批准 T-M2-003 S7 课堂采集开工
3. ✅ 该任务即将进入实施

> 本计划严格遵守 §4.4：用户批准开工后才创建详细计划，含文件清单、命令、预期输出和实现步骤。
