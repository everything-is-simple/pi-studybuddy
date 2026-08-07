# 任务计划：T-M0-005 file-watch（fs.watch + 100ms 防抖 → Streams）

**任务 ID**：T-M0-005
**日期**：2026-08-07
**状态**：✅ 已批准执行中（2026-08-07 用户批准开工）
**关联文档**：03-Arch §6.5（落位表）+ 03-Arch §6.6（权威实现条款）+ 06-API §3.2（files.watch/unwatch）+ 06-API §4（Streams files.changed）+ 08-Test §5.7（无新不变量）
**里程碑**：M0 骨架搭建
**前置**：T-M0-001 ✅ done（rpc/host 骨架）+ T-M0-002 ✅ done（contract 契约面：`files.watch`/`files.unwatch` 方法 + `files.changed` Stream 已声明）

---

## 1. 任务目标

### 做什么

为 pi-studybuddy 落地**文件变更监听服务**：`fs.watch({ recursive: true }, emitChange)` → **100ms 防抖合并** → `Streams["files.changed"]` 推送 `{ path, changeType: "add"|"change"|"unlink" }`。

### 为什么

- **M0 退出门槛前置**：04-Todo §6.2 退出门槛含"file-watch（fs.watch recursive + 100ms 防抖）"
- **壳层公用零件**：AGENTS.md §4.3 装配顺序——壳层就绪后先建公用零件（file-watch 是第三件），后续业务模块（S2 资料笔记 / S4 错题截图 @ 引用）依赖文件变更实时刷新
- **03-Arch §6.6 权威条款**：`file-watch.ts` 的 `fs.watch({ recursive: true }, emitChange)` 100ms 防抖 → `Streams["files.changed"]`
- **06-API §4 权威条款**：`files.changed` 流 payload `{ path, changeType: "add"|"change"|"unlink" }`

### 依据

- 03-Arch §6.5 表格：file-watch 落位 `src/agent-host/file-watch.ts`
- 03-Arch §6.6：`fs.watch({ recursive: true }, emitChange)` 100ms 防抖 → `Streams["files.changed"]`
- 06-API §3.2：
  - `files.watch({ path: string })` → `subscribe`（启动监听）
  - `files.unwatch({ path: string })` → `void`（取消监听）
- 06-API §4 line 454：`files.changed` payload `{ path: string, changeType: 'add'|'change'|'unlink' }`，100ms 防抖
- 04-Todo §7.1.1 line 358：file-watch 阶段 2-4
- 现有契约（T-M0-002 已就绪）：
  - `src/contract/api.ts:76-77` 已声明 `files.watch` / `files.unwatch` 方法
  - `src/contract/streams.ts:18` 已声明 `files.changed` Stream
- 现有 RPC（T-M0-001 已就绪）：
  - `RpcServer.pushEvent(topic, payload, key?)` 推送事件到匹配订阅者
  - `RpcClient.subscribe(topic, key, on)` 订阅 Stream

## 2. 范围与非目标

### 范围

1. **`src/agent-host/file-watch.ts`**：核心服务
   - `WatchEntry` 结构：`{ watcher: fs.FSWatcher, refs: number, timer: setTimeout | null, lastExists: boolean }`
   - `Map<string, WatchEntry>` 管理多条路径监听
   - `start(path)`：启动监听（已存在则 refs++）；目录用 `recursive: true`，文件直接 watch；递归不支持时回退非递归；100ms 防抖合并变更事件；通过 statSync 比较 lastExists 推断 changeType（add/change/unlink）
   - `stop(path)`：引用计数--，归零时关闭 watcher + 清理 timer
   - `dispose()`：停止全部监听，清理所有 timer

2. **`src/agent-host/handlers/files.ts`**：`files.watch` / `files.unwatch` 两个 RPC handler
   - 工厂 `createFileHandlers(service)` 返回 handler 映射（与 toolchain handlers 模式一致）
   - `files.watch({path})` → `await service.start(path)`
   - `files.unwatch({path})` → `service.stop(path)`

3. **`src/agent-host/index.ts`**：装配 file-watch
   - `createAgentHost` 内创建 `server` 后构造 `fileWatch = createFileWatchService(server)`
   - `server.handle({ ..., ...createFileHandlers(fileWatch) })`
   - `dispose()` 调用 `fileWatch.dispose()`

4. **测试**：
   - 单件 `tests/unit/file-watch.test.ts`：start/refs/stop/防抖/changeType 推断/dispose/不存在路径/非可监听路径/递归回退
   - 集成 `tests/integration/file-watch-rpc.test.ts`：真实文件系统变更 → 通过 RPC 订阅 `files.changed` 收到 `{ path, changeType }`

5. **数据隔离**：测试写入 `H:\pi-studybuddy-tmp\runs\T-M0-005\`

### 非目标（不做什么）

- ❌ 不实现文件访问权限检查（allowed-roots / file-access）→ 后续安全任务（pi-desktop 范式 `assertAllowed`）
- ❌ 不实现会话文件引用跟踪（session-file-references）→ 后续任务
- ❌ 不实现 `files.selectDirectory` / `files.list` / `files.read` / `files.previewMarkdown` / `files.previewDocx` → 后续业务任务
- ❌ 不接入 UI（FileExplorer）→ 后续 UI 任务
- ❌ 不复制 pi-desktop 代码：参考范式但独立重实现（AGENTS.md §6.2 + 03-Arch §9.3）
- ❌ 不修改 08-Test §5.7 安全不变量（六条均与 file-watch 无关，file-watch 不新增不变量）
- ❌ studybuddy-extension → T-M0-007
- ❌ 09-UI 三栏布局 → T-M0-008
- ❌ M0 系统冒烟完整 → T-M0-009

## 3. 文件清单

### 将创建的文件

| 文件路径 | 用途 |
|---|---|
| `src/agent-host/file-watch.ts` | fs.watch + 100ms 防抖 → Streams["files.changed"] 推送 |
| `src/agent-host/handlers/files.ts` | files.watch / files.unwatch RPC handler 工厂 |
| `tests/unit/file-watch.test.ts` | file-watch 服务单件测试 |
| `tests/integration/file-watch-rpc.test.ts` | 真实文件系统变更 → RPC Stream 推送集成测试 |

### 将修改的文件

| 文件路径 | 修改内容 |
|---|---|
| `src/agent-host/index.ts` | 装配 createFileWatchService + createFileHandlers + dispose 串联 |
| `docs/04-任务清单-Todo-List.md` | T-M0-005 任务行登记 + 状态 in_progress→done |
| `.plan/00-当前任务.md` | 状态从候选→执行中→完成 |
| `docs/00-文档索引-Index.md` | 版本历史登记（收尾时） |

## 4. 接口设计

### 4.1 FileWatchService 接口

```typescript
export interface FileWatchService {
  /** 启动对 path 的监听；已存在则引用计数++；100ms 防抖合并变更事件 */
  start(path: string): Promise<void>;
  /** 停止监听；引用计数--，归零时关闭 watcher + 清理 timer */
  stop(path: string): void;
  /** 停止全部监听并清理所有 timer（dispose 时调用） */
  dispose(): void;
}
```

### 4.2 WatchEntry 内部结构

```typescript
interface WatchEntry {
  watcher: fs.FSWatcher;
  refs: number;                                // 引用计数（同一 path 多次 watch 累加）
  timer: ReturnType<typeof setTimeout> | null; // 100ms 防抖定时器
  lastExists: boolean;                         // 上次 stat 结果，用于推断 changeType
}
```

### 4.3 changeType 推断规则（基于 per-target lastExists 跟踪）

实现采用 `Map<targetPath, TargetState>` 跟踪每个变更目标的上次存在状态，**不依赖 fs.watch eventType 信号**（Windows 平台对新文件创建可能发 "change" 而非 "rename"，eventType 信号不可靠）。

| stat 结果 | lastExists（前次状态） | 推断 changeType | 更新 lastExists |
|---|---|---|---|
| 成功 | true | "change"（已存在文件被修改） | 保持 true |
| 成功 | false | "add"（新增文件） | → true |
| 失败（ENOENT） | true | "unlink"（文件被删除） | → false |
| 失败（ENOENT） | false | "change"（兜底，避免事件丢失） | 保持 false |

**初始 lastExists 设置**：
- 单文件监听：start 时 stat 一次，预填 `targets[filePath].lastExists=true`（首次事件应为 "change"）
- 目录监听：targets 初始空，新 target 默认 `lastExists=false`（首次事件 = 新增文件）

**path 字段语义**：
- 单文件监听：`path` = 监听的文件路径
- 目录监听：`path` = `path.join(watchedDir, filename)`（实际变更的子文件路径）

**Stream 订阅 key**：始终为监听路径（watchedPath），便于订阅者按目录订阅接收全部子文件事件。

### 4.4 RPC handlers（06-API §3.2）

```typescript
// src/agent-host/handlers/files.ts
export function createFileHandlers(service: FileWatchService) {
  return {
    "files.watch":   async (params: unknown): Promise<void> => {
      const { path } = params as { path: string };
      await service.start(path);
    },
    "files.unwatch": (params: unknown): void => {
      const { path } = params as { path: string };
      service.stop(path);
    },
  };
}
// Stream: "files.changed" → { path, changeType }（service.start 内 fs.watch 回调触发）
```

### 4.5 装配（src/agent-host/index.ts 修改）

```typescript
import { createFileWatchService } from "./file-watch";
import { createFileHandlers } from "./handlers/files";

export function createAgentHost(parentPort: AnyMessagePort): AgentHost {
  const server = createRpcServer();
  const fileWatch = createFileWatchService(server);
  server.handle({
    "system.ping": (...args) => ping(args[0] as Api["system.ping"]["params"]),
    ...toolchainHandlers,
    ...createFileHandlers(fileWatch),
  });
  // ...（parentPort 监听部分不变）
  return {
    dispose() {
      server.dispose();
      fileWatch.dispose();   // ← 新增：清理所有 watcher + timer
      attached = false;
    },
  };
}
```

## 5. 技术选型

### 5.1 监听机制

- **目录**：`fs.watch(path, { recursive: true }, callback)` —— Windows/macOS 支持，Linux 部分支持
- **文件**：`fs.watch(path, callback)` —— 跨平台稳定
- **递归回退**：`recursive: true` 抛错时回退到非递归 `fs.watch(path, callback)`
- 参考 pi-desktop `src/agent-host/file-watch.ts` 范式，独立重实现

### 5.2 防抖策略

- 每次 fs.watch 触发 → `clearTimeout(entry.timer)` + `setTimeout(emitChange, 100)`
- 100ms 内多次变更合并为单次 pushEvent
- 与 03-Arch §6.6 + 06-API §4 一致

### 5.3 changeType 推断

- fs.watch 的 `eventType` 参数（'rename'/'change'）跨平台语义不稳定（pi-desktop 未依赖）
- 改用 `fs.statSync(path)` 推断：成功/失败 × lastExists 状态 → changeType（见 §4.3 表）
- 优势：跨平台一致；缺点：高频变更可能产生中间态 stat，但 100ms 防抖已合并

### 5.4 数据隔离

- 测试写入 `H:\pi-studybuddy-tmp\runs\T-M0-005\`（AGENTS.md §5.3）
- 绝不污染 `%LOCALAPPDATA%\PiStudyBuddy`

## 6. 测试策略

### 6.1 单件测试（阶段 2，`tests/unit/file-watch.test.ts`）

- [x] **FW-UNIT-01**：start 单文件路径 → 启动监听无错误
- [x] **FW-UNIT-02**：start 目录路径（recursive:true）→ 启动监听无错误
- [x] **FW-UNIT-03**：start 同一 path 两次 → 第二次不抛错（refs=2）
- [x] **FW-UNIT-04**：stop 不存在的 path → 静默返回（no-op）
- [x] **FW-UNIT-05**：stop 单次后 refs-- 仍 >0 → 文件变更仍推送事件
- [x] **FW-UNIT-06**：stop 至 refs=0 → 文件变更不再推送事件
- [x] **FW-UNIT-07**：dispose → 后续变更不再推送事件
- [x] **FW-UNIT-08**：start 不存在的路径 → 抛错 "Path not found"
- [x] **FW-UNIT-09**：100ms 防抖合并多次变更 → server.pushEvent 仅触发一次
- [x] **FW-UNIT-10**：changeType 推断——文件修改 → "change"
- [x] **FW-UNIT-11**：changeType 推断——目录内新增文件 → "add"
- [x] **FW-UNIT-12**：changeType 推断——文件删除 → "unlink"
- [x] **FW-UNIT-13**：dispose 幂等（重复调用不抛错）
- [x] **FW-UNIT-ISOLATION**：测试写入隔离目录，不污染业务数据根

> 原计划 FW-UNIT-09（start 非文件/非目录 → 抛错 "not watchable"）已移除：跨平台无法稳定构造非文件/非目录路径（FIFO/socket 在 Windows 需要管理员权限），该分支为防御性代码，不阻塞契约覆盖。

### 6.2 集成测试（阶段 3，`tests/integration/file-watch-rpc.test.ts`）

- [x] **FW-RPC-01**：RPC `files.watch({path})` 启动监听，订阅 `files.changed` 收到事件
- [x] **FW-RPC-02**：真实文件修改 → 100ms 后收到 `{ path, changeType: "change" }`
- [x] **FW-RPC-03**：真实文件删除 → 收到 `{ path, changeType: "unlink" }`
- [x] **FW-RPC-04**：真实文件新增（目录监听） → 收到 `{ path, changeType: "add" }`
- [x] **FW-RPC-05**：RPC `files.unwatch({path})` 后 → 文件变更不再推送事件
- [x] **FW-RPC-06**：100ms 防抖——文件连续变更 5 次 → 仅收到 1 次事件
- [x] **FW-RPC-07**：引用计数——同一 path watch 两次后 unwatch 一次 → 仍能收到事件
- [x] **FW-RPC-ISOLATION**：测试写入 `H:\pi-studybuddy-tmp\runs\T-M0-005\`，不污染业务数据根

> 原计划 FW-RPC-08（dispose 后不再推送事件）已合并到 FW-UNIT-07 单件覆盖，集成测试不再重复。

### 6.3 安全不变量

- file-watch **不新增** 08-Test §5.7 安全不变量（六条均与 file-watch 无关）
- `scripts/check-desktop-security.mjs` 不修改

## 7. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | — 不涉及（仅用 Node 内置 fs 模块） |
| 2. 单件测试 | ⏳ file-watch.test.ts（start/stop/refs/防抖/changeType/dispose） |
| 3. 集成测试 | ⏳ file-watch-rpc.test.ts（真实 fs 变更 → RPC Stream 推送） |
| 4. 系统组装 | src/agent-host/file-watch.ts + handlers/files.ts + index.ts 装配 |
| 5. 冒烟 + E2E | pnpm smoke（已有 RPC ping 通过即可）+ 依赖 M0-009 系统冒烟完整 |

## 8. 依赖关系

### 前置任务

- [x] T-M0-001（rpc/host 骨架）—— `RpcServer.pushEvent` / `RpcClient.subscribe` 已就绪
- [x] T-M0-002（contract 契约面）—— `files.watch` / `files.unwatch` 方法 + `files.changed` Stream 已声明

### 组件依赖

- [x] Node v22.16.0（fs.watch recursive 支持）
- [x] vitest（单件 + 集成测试）

### 参考仓库

- `H:\pi-references\pi-desktop\src\agent-host\file-watch.ts`（WatchEntry / refs / 防抖范式）
- `H:\pi-references\pi-desktop\src\contract\rpc.ts`（pushEvent 调用范式）

**纪律**：参考范式但独立重实现，不复制代码（AGENTS.md §6.2）。

## 9. 预期产物

- `src/agent-host/file-watch.ts`
- `src/agent-host/handlers/files.ts`
- `tests/unit/file-watch.test.ts`
- `tests/integration/file-watch-rpc.test.ts`
- `src/agent-host/index.ts`（修改：装配 file-watch + dispose 串联）
- `.record/T-M0-005-实施记录.md`（收尾时创建）

## 10. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（已完成：03-Arch §6.5/§6.6 + 06-API §3.2/§4 + 08-Test §5.7）
- [x] 步骤 2：检查文档门禁（已完成：T-M0-004 done + .plan 无执行中任务 + 用户已批准）
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [x] 步骤 4：独立审查计划（自审：与 pi-desktop 范式对齐 + 契约一致 + 测试覆盖完整）
- [x] 步骤 5：用户批准计划（★ 用户授权，2026-08-07 批准开工）
- [x] 步骤 6：拆分任务、逐项实现（file-watch.ts + handlers/files.ts + index.ts 装配）
- [x] 步骤 7：TDD 测试（RED 14 单件 + 8 集成 → GREEN 全绿 → REFACTOR 移除 FW-UNIT-09 FIFO + 重编号）
- [x] 步骤 8：type-check（`pnpm type-check` 通过）
- [x] 步骤 9：build（`pnpm build` 通过，34 modules transformed）
- [x] 步骤 10：test（`pnpm test` 144/144 通过，含 23 新增 file-watch 测试）
- [x] 步骤 11：smoke / 安全脚本（`pnpm smoke` 通过 + check-desktop-security 5/6 通过 INV-06 占位）
- [x] 步骤 12：独立审查并修复（changeType 推断改用 per-target lastExists 跟踪，避开 Windows fs.watch eventType 不可靠问题）
- [x] 步骤 13：更新 04-Todo + 文档（v0.1.8 登记 T-M0-005 开工 → 收尾时改 done）
- [x] 步骤 14：文档治理检查（`node scripts/check-docs-governance.mjs` 通过，1 warning 非阻塞）
- [x] 步骤 15：diff 检查（`git diff --check` 通过，仅 LF/CRLF 警告）
- [ ] 步骤 16：提交交付（★ 用户授权后执行）

## 11. 证据登记

- 测试日志：`pnpm verify` 全绿（执行 7 守卫，跳过 2）
  - typecheck ✅
  - docs-governance ✅（1 warning 非阻塞）
  - unit-tests ✅（144 tests passed，含 14 单件 + 8 集成 file-watch 新增）
  - contract-coverage ✅（126 Api methods + 8 PiBridge methods，files.watch/unwatch 通过 spread 注册不在静态扫描结果中，与 toolchainHandlers 一致）
  - desktop-security ✅（5/6 INV 通过，INV-06 占位 T-M0-008）
  - build ✅（34 modules transformed）
  - smoke ✅（RPC ping + 8 build artifacts）
- 实施记录：`.record/T-M0-005-实施记录.md`（收尾时创建）
