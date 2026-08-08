# T-M2-007 whisper.cpp 真实 Adapter 替换 mock

**状态**：plan（待用户批准）
**日期**：2026-08-08
**里程碑**：M2 完整闭环
**任务**：T-M2-007 whisper.cpp Adapter（真实 PCM WAV 转写 CLI 接入，替换 mock）
**关联文档**：03-Arch §3.3 + 08-Test §3.3.2/§9.3 + 07-WF §2.7 + 04-Todo §7.5 第 8 行

---

## 1. 任务目标

把 S7 课堂采集的默认 mock WhisperCppAdapter 替换为真实 whisper.cpp CLI 转写 adapter，让真实 PCM WAV 转写接入系统装配（04-Todo §7.5 第 8 行："替换 T-M2-003 的 mock，真实 PCM WAV 转写"）。

依据权威条款：
- 03-Arch §3.3：CLI/模型路径只来自配置，不猜路径不回退云端；子进程调用 stdout 返回转写文本；路径/stdout/stderr/密钥不泄漏，固定错误码
- 08-Test §3.3.2：三断言（路径未配置→INTERNAL_ERROR / 受控 PCM WAV 头部验证 / 转写成功仅返回 text）
- 08-Test §9.3：whisper.cpp 单件可真实（本机）；集成/E2E 用 mock 避免依赖模型文件

## 2. 范围与非目标

### 范围内
1. `studybuddy-extension.ts`：`createStudyBuddyExtension` 增加可选 whisper 配置参数，从配置读取 cliPath/modelPath，有路径注入 `createRealWhisperAdapter`，无路径默认 mock（08-Test §5.4 测试环境不连真实 whisper.cpp）
2. `whisper-adapter.ts`：更新 `createRealWhisperAdapter` 头注释（由"本任务范围不连真实子进程"改为"真实已接入"），确认 spawn/stdout 解析正确（真实验证：`-nt` 模式 stdout 即纯文本转写结果，日志在 stderr）
3. 单件测试：真实转写测试（受控合成 PCM WAV + 真实 whisper-cli，探测存在才跑）+ 装配测试

### 非目标（明确不做什么）
- **不实现 settings RPC handler**（settings.get/update 仅 API 契约未实现，whisper 配置走环境变量 + 调用参数，见 §4）
- 不自动下载 whisper.cpp 模型（whisper.cpp 已下载，阶段1 done）
- 不改 `class-capture.ts` handler 逻辑（已用 `ctx.whisperAdapter`，无需改动）
- 不连真实云服务；集成/E2E 保持 mock（08-Test §9.3）

## 3. 配置来源决策

03-Arch §3.3 要求"CLI/模型路径只来自配置"。settings RPC handler 未实现（仅契约），为避免过度工程，采用**环境变量 + 调用参数**双通道，对齐现有 `resolveDataRoot` 的 `PI_STUDYBUDDY_DATA_ROOT` 环境变量范式：

```
优先级：调用参数 options.whisperCliPath > 环境变量 PI_STUDYBUDDY_WHISPER_CLI > 空（默认 mock）
        options.whisperModelPath > 环境变量 PI_STUDYBUDDY_WHISPER_MODEL > 空（默认 mock）
```

- 真实环境：配置环境变量或调用参数 → 走真实 whisper.cpp 转写
- 测试环境：不配置 → 默认 mock，不连真实服务（08-Test §5.4）

## 4. 文件清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/agent/studybuddy-extension.ts` | 修改 | `createStudyBuddyExtension(options?)` 加 whisper 配置，装配 real/mock |
| `src/agent-host/handlers/s7/whisper-adapter.ts` | 修改 | 更新 createRealWhisperAdapter 头注释（真实已接入，真实验证结论） |
| `tests/unit/s7-whisper-adapter.test.ts` | 修改 | + 真实转写 describe（探测 whisper-cli 存在才跑） |
| `tests/unit/studybuddy-extension.test.ts` | 修改 | + 装配测试（传 whisper 路径 setup 不抛错 + 工具数不变） |

## 5. 接口设计

```typescript
// studybuddy-extension.ts
export interface StudyBuddyExtensionOptions {
  whisperCliPath?: string;
  whisperModelPath?: string;
}
export function createStudyBuddyExtension(
  options?: StudyBuddyExtensionOptions,
): ExtensionFactory;
```

装配逻辑（S7 部分）：
```typescript
const whisperCliPath =
  options?.whisperCliPath ?? process.env.PI_STUDYBUDDY_WHISPER_CLI ?? "";
const whisperModelPath =
  options?.whisperModelPath ?? process.env.PI_STUDYBUDDY_WHISPER_MODEL ?? "";
const s7Ctx = new S7Context(dataRoot, {
  whisperCliPath,
  whisperModelPath,
  whisperAdapter:
    whisperCliPath && whisperModelPath
      ? createRealWhisperAdapter({ cliPath: whisperCliPath, modelPath: whisperModelPath })
      : undefined, // 默认 mock（08-Test §5.4）
});
```

## 6. 测试策略

- **单件（真实，08-Test §9.3 允许）**：`s7-whisper-adapter.test.ts` 新增 `createRealWhisperAdapter 真实转写` describe：
  - 探测 `whisper-cli.exe` + `ggml-base.bin` 是否存在（存在才跑，不存在 skip 记录原因，避免 CI 依赖模型文件失败）
  - 合成 16kHz/mono/16-bit PCM WAV（内嵌正弦波，含 data chunk 数据）
  - 断言：真实路径 → transcribe 返回非空 text；result 无 stdout/stderr 字段；afterAll 清理产物
  - 数据隔离：写入 `H:\pi-studybuddy-tmp\runs\T-M2-007\`
- **单件（装配）**：`studybuddy-extension.test.ts` 新增：
  - `createStudyBuddyExtension({ whisperCliPath, whisperModelPath })` setup 不抛错 + registerTool 仍 35 个
  - 无参数调用 → 默认 mock（现有断言不变，工具数 35 不变）
- **集成/E2E**：保持 `createStudyBuddyExtension()` 无参数 → 默认 mock，不连真实 whisper.cpp（08-Test §9.3）

## 7. 五阶段治理定位

- 阶段2（单件测试）：真实转写测试（合成夹具 + 真实 whisper-cli）
- 阶段4（系统配件组装）：studybuddy-extension 装配真实 adapter

whisper.cpp 组件阶段1（下载储存）已在 T-M2-003/阶段1 done。

## 8. 依赖关系

- 前置：T-M2-003 done（WhisperCppAdapter 三态 + wav-validator 已实现）
- 组件：whisper.cpp CLI 已下载（阶段1 done），实际路径：
  - CLI：`H:\ai-studybuddy-components\local-asr-whispercpp\build-msvc-x64-release\bin\Release\whisper-cli.exe`
  - 模型：`H:\ai-studybuddy-components\local-asr-whispercpp\models\ggml-base.bin`
- 真实验证（步骤1 边界验证）：合成 3s 正弦波 PCM WAV 经 whisper-cli `-nt` 转录输出 `(crickets chirping)`，退出码 0，stdout 即纯文本 ✓

## 9. 预期产物

- 真实 whisper.cpp 转写接入系统装配（有配置走 real，无配置走 mock）
- 真实转写单件测试 + 装配测试
- 文档更新：04-Todo / 00-索引 / AGENTS.md / .record

## 10. 风险与缓解

- 单件真实测试依赖本机 whisper-cli + 模型：探测存在才跑，缺失 skip 不阻塞（08-Test §9.3 允许，但测试需稳定）
- 合成正弦波转录文本不确定（可能为环境音描述）：只断言 text 非空 + 无泄漏字段，不断言具体文本内容

---

## 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（03-Arch §3.3 + 08-Test §3.3.2/§9.3 + 真实验证）
- [x] 步骤 2：检查文档门禁（T-M2-006 done + 用户已选 T-M2-007 + master 干净）
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

## 证据登记

- 测试日志路径：`H:\pi-studybuddy-tmp\runs\T-M2-007\`
- 提交哈希：（待记录）
- 推送状态：（待记录）
- 实施记录路径：`.record/T-M2-007-实施记录.md`（✅ 已创建）

---

## 审查记录

- 2026-08-08 独立审查：计划独立审查通过（范围/配置/测试/安全一致，无阻塞问题）。