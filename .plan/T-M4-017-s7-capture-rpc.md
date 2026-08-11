# 任务计划：T-M4-017 S7 采集 Tab RPC 接线

**任务 ID**：T-M4-017
**标题**：S7 采集 Tab RPC 接线（classCapture.transcribe + saveTranscription）
**日期**：2026-08-11
**状态**：✅ 已批准并实施完成（本地实施、定向验收、真实 Electron E2E、完整质量门与双维度独立审查通过；Git 收口待用户单独授权）
**关联文档**：09-UI §4.10 + 06-API §3.9 + 07-WF §2.7 + 08-Test §3.3.2/§5/§6/§7.1
**里程碑**：M4 业务接线 + 打包部署
**优先级**：P2
**治理阶段**：阶段 4（系统组装）
**用户授权**：用户明确选择并批准开工 T-M4-017（2026-08-11“计划 T-M4-017”）；批准计划（2026-08-11“批准计划”），进入实施
**集成基线**：master=origin/master=62fa21d（T-M4-016 Git 收口事实核验）
**实施分支**：agent/T-M4-017-s7-capture-rpc
**集成分支**：master
**测试运行根**：H:\pi-studybuddy-tmp\runs\T-M4-017\

---

## 1. 任务目标

### 做什么
把 S7 采集 Tab（CaptureTab）从 T-M2-008 的静态 UI 接线到既有 RPC：合规确认 → 选择受控 PCM WAV → `classCapture.transcribe` 转写 → 可编辑转写文本 → `classCapture.saveTranscription` 保存为 S2 笔记输入。

### 为什么
M4 里程碑要求 S1-S7 业务 Tab 全部打通生产 RPC 链路（04-Todo §6.6 退出门槛）。当前 CaptureTab 的"开始转写/选择文件/保存为笔记"按钮均为静态外壳，无任何 RPC 调用，生产不可用——这是 T-M4-016（S6）收官后最后一个业务 Tab 接线缺口（T-M4-017~019 为剩余业务接线）。

### 依据
- 09-UI §4.10（采集 Tab：合规确认 + PCM WAV 单一输入 + 可编辑转写 + 保存为 S2 笔记输入）
- 06-API §3.9（classCapture.transcribe/saveTranscription 契约）
- 07-WF §2.7（S7 课堂采集流程与关键约束：许可确认强制、服务端重验证文件头、tmp finally 清理、不建独立表、S7→S2 handoff）
- 08-Test §3.3.2（文件头验证断言）+ §5（安全不变量）+ §6/§7.1（E2E 闭环）
- AGENTS.md §4.4/§5/§7/§8/§9（任务门禁/TDD/受控收尾/Git/安全）

## 2. 范围与非目标

### 范围
1. **CaptureTab RPC 接线**（`src/renderer/components/tabs/CaptureTab.tsx` 重写内部实现）：
   - 合规确认 checkbox 改为受控状态（未勾选 → 转写禁用 + 提示，§7.2/07-WF §2.7 强制）
   - 文件选择：经 desktop dialog 获取受控 PCM WAV 的本地路径（09-UI §4.10"选择文件"）
   - 转写：`classCapture.transcribe({ courseId, audioFile, permissionConfirmed })`，in-flight 防重复、加载态、结果展示
   - 转写结果可编辑 textarea（09-UI §4.10"转写结果（可编辑）"）
   - 保存：`classCapture.saveTranscription({ courseId, transcription, title })`，in-flight 防重复、成功确认、标题默认从文件名派生（可编辑）
   - 课程门控（无 courseId → 禁用 + 提示）
   - 归档只读（academicContext.isReadOnly → 全部禁用 + 提示；host 侧防线核验）
   - 竞态/卸载保护、重复 mutation 防护、错误净化、隐私展示（不展示完整 UUID/路径/错误栈）
2. **桌面对话框 rawPath capability**（shell 层最小扩展，**非 RPC 契约变更**）：
   - `DialogOptions` 新增 `rawPath?: boolean`；`DialogResult` 新增 `rawPath?: string`（对齐 T-M4-011 给 DialogResult 增补 importToken 的先例）
   - `src/main/ipc.ts` `showDesktopDialog`：`type==="open" && options.rawPath` 时返回 `{ canceled:false, rawPath: filePaths[0], fileName, fileSize }`（不做 S2 staging，不签发 importToken）
   - 原因：`classCapture.transcribe` 的 `audioFile.path` 是**本地文件系统绝对路径**（whisper.cpp 直接读文件，FileMeta.path 注释明确"S7 课堂采集读取 PCM WAV 头部用"）；S2 的 importToken 模式不适用
3. **测试**：
   - 新增 `tests/integration/t-m4-017-capture-rpc.test.ts`（RED→GREEN，C-RED-01~09）
   - 新增 `tests/e2e/t-m4-017-capture-renderer.test.ts`（真实 Electron + 127.0.0.1 TCP）
   - 更新 `tests/unit/renderer-capture-tab.test.ts`（既有 14 静态断言保持，适配受控状态 props）
4. **治理同步**：`.plan/00-当前任务.md`、`docs/04-Todo`（in_progress 登记 + v0.1.128）、`docs/00-索引`（v0.1.132）、收尾时 `.record/T-M4-017-实施记录.md`

### 非目标（不做什么）
- **不新增/不改 RPC API、handler、schema**（contract 保持 127/127，`classCapture.*` 已装配于 src/agent-host/handlers/s7/，仅复用）
- 不接真实 whisper.cpp 子进程（08-Test §5.4 全 mock；生产默认 mock adapter，真实 CLI 属设置页能力）
- 不做 MP3/M4A/WebM/视频/FFmpeg 转码、实时录音/流式字幕、说话人分离、云端上传、原始音频留存（07-WF §2.7 明确"不做"清单）
- **不做拖拽导入**（需 preload 暴露 `webUtils.getPathForFile`，超出本轮范围；09-UI"或拖拽到此处"留待用户裁决/后续任务）
- 不接 TTS"朗读转写文本"按钮（属 T-M4-018 范围）
- 不自动 generateNote（07-WF §2.7 步骤 5：学生在 S2 自行生成）
- 不新增 AppShell 全局状态；不改动 S1-S6 已验收语义
- 不连接真实外部服务；不写 `%LOCALAPPDATA%\PiStudyBuddy`

## 3. 文件清单

### 将创建的文件
| 文件路径 | 用途 |
|---|---|
| `tests/integration/t-m4-017-capture-rpc.test.ts` | C-RED-01~09 集成测试（mock rpc + mock bridge.showDialog rawPath） |
| `tests/e2e/t-m4-017-capture-renderer.test.ts` | 真实 Electron renderer E2E（隔离 fixture + WAV 夹具 + 归档只读 + 隐私断言） |
| `.record/T-M4-017-实施记录.md` | 收尾时创建（8 章节） |

### 将修改的文件
| 文件路径 | 修改内容 |
|---|---|
| `src/renderer/components/tabs/CaptureTab.tsx` | 静态 UI → 受控状态 + RPC 接线（合规确认/文件选择/转写/可编辑/保存/课程门控/归档只读/竞态/净化） |
| `src/contract/types.ts` | `DialogOptions.rawPath?: boolean` + `DialogResult.rawPath?: string`（shell capability，非 RPC 契约） |
| `src/main/ipc.ts` | `showDesktopDialog` 支持 rawPath 模式（open + rawPath → 返回 rawPath/fileName/fileSize，不 staging） |
| `tests/unit/renderer-capture-tab.test.ts` | 适配受控状态 props，保留静态渲染与 §11.1 隐私断言 |
| `.plan/00-当前任务.md` | 指向本计划 |
| `docs/04-任务清单-Todo-List.md` | T-M4-017 pending→in_progress + 版本历史 v0.1.128 + §9 统计 |
| `docs/00-文档索引-Index.md` | 版本历史 v0.1.132 + 任务状态行同步 |

> preload `showDialog` 仅透传 options（通道名不变），无需修改。

## 4. 接口设计

### RPC 方法（复用既有，不新增；06-API §3.9）
```typescript
// contract/api.ts（既有，contract 保持 127/127）
interface Api {
  "classCapture.transcribe": {
    params: { courseId: string; audioFile: FileMeta; permissionConfirmed: boolean };
    result: { transcription: string };
  };
  "classCapture.saveTranscription": {
    params: { courseId: string; transcription: string; title: string };
    result: Material;
  };
}
```
host 侧已具备（T-M2-003，仅核验不改）：
- `handleTranscribe`：许可确认强制（BAD_REQUEST）→ WAV 文件头服务端重验证（BAD_REQUEST 固定文案）→ whisper adapter 转写（默认 mock）→ finally 清理 tmp
- `handleSaveTranscription`：非空校验 → `findSemesterByCourseId`（**仅搜索 deleted_at IS NULL 活跃学期**，归档写防线结构性存在）→ materials/normalized_texts/study_events 写入 → Material DTO
- 错误固定文案：`MSG_PERMISSION_REQUIRED` / `MSG_TRANSCRIBE_FAILED` / "仅支持 PCM WAV 格式（16kHz/单声道/16-bit）"——不泄漏路径/stdout/stderr

### 桌面对话框 capability（shell 层，非 RPC）
```typescript
// src/contract/types.ts
export interface DialogOptions {
  type: "open" | "save" | "message";
  // ...既有字段
  /** S7 课堂采集：true 时 open 返回本地文件原始路径（whisper.cpp 直接读文件）。S2 上传仍走 importToken，不传此字段。 */
  rawPath?: boolean;
}
export interface DialogResult {
  // ...既有字段
  /** rawPath 模式下 main 返回的本地绝对路径（S7 专用；不参与 S2 staging）。 */
  rawPath?: string;
}
```
```typescript
// src/main/ipc.ts showDesktopDialog
if (options.type === "open") {
  const result = await dialog.showOpenDialog({ title, defaultPath, filters, properties: ["openFile"] });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  if (options.rawPath) {
    const p = result.filePaths[0];
    try {
      const st = fs.statSync(p);
      return { canceled: false, rawPath: p, fileName: path.basename(p), fileSize: st.size };
    } catch { return { canceled: true }; }
  }
  // 既有 S2 staging 分支不变
  ...
}
```

### 数据表（不涉及）
无新增/修改表；S7 保存复用 05-ERD §3.2.1 materials + §3.2.2 normalized_texts + §3.1.5 study_events（host 已实现）。

## 5. 测试策略

### 单件测试（阶段 2）
- [ ] 更新 `tests/unit/renderer-capture-tab.test.ts`：保留合规确认/文件选择/WAV 提示/转写展示/保存按钮/无 UUID 断言；适配受控状态（受控 checkbox 默认未勾选 → 转写禁用）

### 集成测试（阶段 3，`tests/integration/t-m4-017-capture-rpc.test.ts`）
| ID | 设计条款 | 断言 |
|---|---|---|
| C-RED-01 | 许可确认门控（09-UI §4.10 + 07-WF §2.7 强制） | 未勾选且无文件 → 转写禁用 + 提示；勾选后仍无文件 → 禁用；勾选 + 文件 + 课程 → 可用 |
| C-RED-02 | 文件选择（09-UI §4.10 选择文件） | mock `bridge.showDialog({type:"open", rawPath:true, filters})` 返回 rawPath → FileMeta{name,size,mime:"audio/wav",path}；canceled → 状态不变；调用只发一次 |
| C-RED-03 | 转写调用（06-API §3.9） | 点击转写只调一次 `classCapture.transcribe`，参数含 courseId/audioFile/permissionConfirmed；in-flight 防重复；加载态；成功后展示 transcription |
| C-RED-04 | 转写可编辑（09-UI §4.10） | textarea 反映转写结果；编辑后内容用于保存 payload；空文本保存被阻止（host 也拒绝，renderer 先拦） |
| C-RED-05 | 保存（06-API §3.9） | 点击保存只调一次 `classCapture.saveTranscription({courseId, transcription, title})`；标题默认从文件名派生且可编辑；in-flight 防重复；成功确认 + 提示可在 S2 笔记查看 |
| C-RED-06 | 课程门控 | courseId 缺失 → 全部操作禁用 + 提示"请先选择课程" |
| C-RED-07 | 归档只读（isReadOnly） | archived 学期 → 文件选择/转写/保存禁用 + "当前学期已归档"提示；host 侧核验 `findSemesterByCourseId` 仅活跃学期（结构性防线，无需 assertSemesterWritable） |
| C-RED-08 | 竞态/卸载（08-Test §5） | 转写中切换课程 → 旧响应丢弃；卸载后 setState 不执行；超时/失败不泄漏内部状态 |
| C-RED-09 | 错误净化（AGENTS.md §9.3 + 07-WF §2.7） | BAD_REQUEST/INTERNAL_ERROR 只显示固定文案；DOM 无完整 UUID/绝对路径/file URI/错误栈/密钥 |

### E2E（阶段 5b，`tests/e2e/t-m4-017-capture-renderer.test.ts`）
- [ ] 主流程：真实 Electron 启动（127.0.0.1 TCP）→ 预置学期 + 课程 + PCM WAV 夹具（`createPcmWavBuffer`）→ 进入采集 Tab → 许可门控 → 文件选择（renderer 测试 seam，见 §6 决策 2）→ 转写成功展示 → 编辑文本 → 保存成功确认
- [ ] 归档只读：`T_M4_017_ARCHIVED=1` → 采集 Tab 只读提示 + 操作禁用
- [ ] 隐私断言：DOM 无完整 UUID / Windows 路径 / POSIX 路径 / file URI / 错误栈 / 密钥

### 安全不变量（如涉及）
- [ ] 转写不返回路径/stdout；错误固定文案；音频只暂存 tmp 且 finally 清理（host 已实现，核验不改）
- [ ] UUID 泄漏检测 `check-uuid-leak` 通过（不影响 7/7 基线）

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | 不涉及（无新组件下载） |
| 2. 单件测试 | 更新既有 renderer-capture-tab 静态测试 |
| 3. 集成测试 | ✅ 核心：C-RED-01~09（mock rpc + mock dialog rawPath） |
| 4. 系统组装 | ✅ 核心：CaptureTab RPC 接线 + main dialog rawPath capability |
| 5. 冒烟 + E2E | 真实 Electron renderer E2E + 完整质量门 |

## 7. 依赖关系

### 前置任务
- [x] T-M4-016：S6 报告 Tab RPC 接线（done；本任务执行序 36 依赖其完成）
- [x] T-M2-003：S7 handler 装配（done；classCapture.transcribe/saveTranscription 已可用）
- [x] T-M4-008：AppShell 数据流重构（done；CaptureTab 已接收 rpc/courseId/academicContext）
- [x] T-M2-007：whisper.cpp 真实 Adapter（done；mock 默认确定性）

### 组件依赖
- [x] whisper.cpp Adapter（mock 注入，08-Test §5.4 不连真实子进程）
- [x] desktop dialog capability（shell；本轮扩展 rawPath 模式，复用既有 SHOW_DIALOG 通道）

## 8. 预期产物

### 代码
- `src/renderer/components/tabs/CaptureTab.tsx`（接线）
- `src/contract/types.ts`（DialogOptions/DialogResult rawPath）
- `src/main/ipc.ts`（rawPath 模式）
- `tests/integration/t-m4-017-capture-rpc.test.ts`
- `tests/e2e/t-m4-017-capture-renderer.test.ts`
- `tests/unit/renderer-capture-tab.test.ts`（更新）

### 文档更新
- `docs/04-Todo`（v0.1.128：T-M4-017 in_progress + §9 统计 + 版本历史）
- `docs/00-索引`（v0.1.132：版本历史 + 任务行同步）
- 06-API §1.3 dialog 说明性增补（rawPath capability，如涉及）

### 实施记录
- `.record/T-M4-017-实施记录.md`（受控收尾时创建）

## 9. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（09-UI §4.10 + 06-API §3.9 + 07-WF §2.7 + 08-Test）
- [x] 步骤 2：检查文档门禁（04-Todo v0.1.127 done、单一任务门禁满足）
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [ ] 步骤 4：独立审查计划
- [ ] 步骤 5：用户批准计划（★ 用户授权）
- [ ] 步骤 6：拆分任务、逐项实现（建立隔离分支 agent/T-M4-017-s7-capture-rpc）
- [ ] 步骤 7：编写或更新测试（TDD：RED 9/9 失败 → GREEN）
- [ ] 步骤 8：type-check
- [ ] 步骤 9：build
- [ ] 步骤 10：test（定向 + 全量）
- [ ] 步骤 11：smoke / E2E（真实 Electron renderer）
- [ ] 步骤 12：独立审查并修复（双维度）
- [ ] 步骤 13：更新 04-Todo + 文档
- [ ] 步骤 14：文档治理检查
- [ ] 步骤 15：diff 检查（git diff --check）
- [ ] 步骤 16：提交交付（★ 用户 Git 收口授权）

## 10. 质量门与数据隔离

- Node 基线：`C:\node-v24.14.0-win-x64\node.exe --version` → v24.14.0；`pnpm --version` → 11.20.0（AGENTS.md §10，执行前 `$env:Path` 前置）
- 定向 unit/integration/E2E → `pnpm type-check` → `pnpm build` → `pnpm test` → `pnpm smoke` → `pnpm verify -- --stage=full`
- 不回归基线：master 基线 115 files/1096 tests（unit/integration）+ 21 files/126 tests（真实 Electron E2E）+ contract 127/127 + 安全 6/6 + smoke 6/6 + UUID 7/7 + docs 治理 + `git diff --check`
- 所有运行数据/Electron user-data/SQLite/日志写入 `H:\pi-studybuddy-tmp\runs\T-M4-017\`；禁止写 `%LOCALAPPDATA%\PiStudyBuddy`；不连真实 AI/SMTP/飞书/WPS/whisper.cpp

## 11. 需用户裁决的设计决策

| # | 决策 | 方案 A（推荐） | 方案 B |
|---|---|---|---|
| 1 | 文件获取方式 | **desktop dialog rawPath capability**（扩展 DialogOptions/DialogResult，对齐 T-M4-011 importToken 先例；仅 shell 层，contract 127/127 不变） | preload 暴露 `webUtils.getPathForFile` 支持拖拽（改动更大，留待后续） |
| 2 | E2E 文件选择自动化 | **renderer 测试 seam**：CaptureTab 文件选择 handler 优先读取 `window.__PI_CAPTURE_FIXTURE__`（受控 FileMeta fixture；原生对话框不可自动化；renderer 页面 JS 本已完全可信，无权限升级，测试注入与 VITEST 夹具先例同质） | E2E 仅断言 RPC 级链路（不覆盖 renderer 文件选择交互，覆盖弱） |
| 3 | 保存标题 | 默认从音频文件名去扩展名派生，提供可编辑小输入框 | 固定标题（不可编辑，灵活性差） |

## 12. 明确停止条件

- 需要新增/修改 RPC API、handler、schema 或 AppShell 全局状态
- 发现 host 侧归档防线缺失（按 T-M4-015/016 assertSemesterWritable 先例补齐后继续，需登记偏差）
- 真实 Electron 无法启动、Node 非 v24.14.0、工作区归属无法区分（不得混入 pi-session html 等用户 dirty 文件）
- 用户未批准本计划或未授权实施

本计划只允许本地实施与治理证据同步；未经用户另行明确授权不得 `git add`、`git commit`、`git merge`、`git push`。

---

## 审查记录

（步骤 4 独立审查）计划由实施者审阅后提交用户批准：范围仅既有 RPC 接线 + shell 层 rawPath capability，contract 127/127 不变；三项设计决策（dialog rawPath / E2E 测试 seam / 标题派生）已明确；测试隔离与质量门基线已列；用户批准计划（2026-08-11“批准计划”）。

## 完成记录

- 完成日期：2026-08-11
- 实施记录：.record/T-M4-017-实施记录.md
- 状态：✅ 已批准并实施完成（本地）；Git 收口待用户单独授权
- 验收证据：RED 初次 8/9 失败 → GREEN 9/9；unit 12/12；全量 unit/integration/security 116 files/1105 tests；真实 Electron E2E 22 files/128 tests（含 t-m4-017-capture-renderer 2/2）；`verify --stage=full` 通过（contract 127/127 + 8 PiBridge + 35 tools、安全 6/6、smoke 6/6、UUID 7/7、docs 治理与 diff-check）
