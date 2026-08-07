# 任务计划：T-M0-001 Electron 四进程骨架

**任务 ID**：T-M0-001
**日期**：2026-08-07
**状态**：📝 待审查
**关联文档**：03-Arch §6.1-§6.4 + §9.2 + 08-Test §5.7 + 09-UI §1.3
**里程碑**：M0 骨架搭建

---

## 1. 任务目标

### 做什么

搭建 pi-studybuddy 最小可启动的 Electron 四进程骨架（main + preload + renderer + agent-host）+ 自研 MessagePort RPC 层，让应用可启动、窗口可打开、RPC 通道可往返。

### 为什么

- **壳层稳定先于业务**：AGENTS.md §4.3 + 03-Arch §9.2 明确"先落地四进程骨架与 contract 契约"
- **M0 退出门槛前置**：04-Todo §6.2 退出门槛首项"Electron 应用可启动 + contract RPC 可 renderer→main→agent-host 往返"
- **安全不变量可校验**：08-Test §5.7 六条硬断言需要可运行的 BrowserWindow + preload + CSP 才能落地

### 依据

- 03-Arch §6.1 五件架构骨架（直接搬运改名）
- 03-Arch §6.2 三进程 + agent-host 目录结构
- 03-Arch §6.3 自研 RPC 层（五种 wire 消息 + createRpcServer/createRpcClient）
- 03-Arch §6.4 安全骨架不变量（sandbox:true + CSP + preload 受控桥接）
- 03-Arch §9.2 装配顺序（先四进程骨架 + contract，再叠加 toolchain/credential-vault/file-watch）
- 08-Test §5.7 安全不变量校验脚本六条
- 09-UI §1.3 技术栈（React 19 + Vite）

## 2. 范围与非目标

### 范围

1. **项目工具链搭建**
   - `package.json`（pnpm workspace，无业务依赖）
   - `tsconfig.json`（strict + ES2022 + moduleResolution:bundler）
   - `vite.config.ts`（renderer Vite 配置）
   - `electron-builder.yml`（仅 Windows nsis 占位，不发布）
   - `.gitignore` 已存在（无修改）
   - `vitest.config.ts`（单件测试配置）

2. **main 进程**（`src/main/`）
   - `main.ts`：app.whenReady → createWindow → host-manager.fork
   - `window.ts`：BrowserWindow 配置（sandbox:true + webPreferences）+ 加载 app://renderer
   - `protocol.ts`：自定义 `app://` 协议 + 严格 CSP 响应头
   - `ipc.ts`：`desktop:connect-host` IPC 处理（创建 MessageChannelMain 转发到 agent-host）
   - `host-manager.ts`：`utilityProcess.fork(agent-host/index.js)` + createRendererChannel()

3. **preload**（`src/preload/preload.ts`）
   - 仅 `contextBridge.exposeInMainWorld("piBridge", bridge)`
   - bridge 仅含 `connectHost(): MessagePort` 方法（最小子集）

4. **renderer**（`src/renderer/`）
   - `index.html`（最小空壳）
   - `main.tsx`（React 19 + 一个 hello 页面）
   - `App.tsx`（显示"pi-studybuddy 骨架就绪" + 点击按钮调用 RPC ping 验证通道）

5. **agent-host**（`src/agent-host/`）
   - `index.ts`：process.parentPort 接收 + createRpcServer() attachPort
   - `handlers/ping.ts`：最小 handler 验证 RPC 链路

6. **contract**（`src/contract/`）
   - `rpc.ts`：自研 RPC（五种 wire 消息：request/response/subscribe/unsubscribe/event + createRpcServer/createRpcClient + AnyMessagePort 兼容，目标 < 200 行）
   - `desktop.ts`：PiBridge 接口最小子集（仅 connectHost）
   - `api.ts`：interface Api 空骨架（仅 `ping` 方法占位，完整接口在 T-M0-002 填充）
   - `types.ts`：共享类型（WireMessage、RpcRequest、RpcResponse）

7. **shared**（`src/shared/`）
   - `constants.ts`：CSP 常量 + IPC 通道名

8. **测试**
   - `tests/unit/rpc.test.ts`：自研 RPC 单件测试（五种 wire 消息 + 往返）
   - `tests/integration/host-rpc.test.ts`：main→agent-host RPC 集成测试（ping 往返）
   - `tests/security/invariants.test.ts`：安全不变量三条断言（sandbox:true + 严格 CSP + preload 仅 exposeInMainWorld）

9. **安全不变量校验脚本**
   - `scripts/check-desktop-security.mjs`：08-Test §5.7 六条硬断言脚本（本任务实现三条：sandbox/CSP/preload；剩余三条：credential-vault/Host RPC 契约化/HTML 预览 CSP 在 T-M0-003+ 后续任务补全）

### 非目标（不做什么）

- ❌ `contract/api.ts` 完整接口（~50 方法）→ T-M0-002
- ❌ credential-vault（safeStorage 加密存储）→ T-M0-003
- ❌ toolchain 发现（Node/Python/uv/Git/WPS/whisper.cpp 探测）→ T-M0-004
- ❌ file-watch（fs.watch recursive + 防抖）→ T-M0-005
- ❌ 数据层 schema（global.db + semester.db + 三层记忆）→ T-M0-006
- ❌ studybuddy-extension 空壳 → T-M0-007
- ❌ 09-UI 三栏布局 + 标签页骨架 → T-M0-008
- ❌ M0 系统冒烟完整覆盖（仅本任务的 RPC 往返 + 安全不变量三条）→ T-M0-009
- ❌ 业务模块（S1-S7 + TTS + 备份恢复）→ M1-M2
- ❌ HTML 预览独立 CSP → T-M0-008（与 UI 一起）

## 3. 文件清单

### 将创建的文件

| 文件路径 | 用途 |
|---|---|
| `package.json` | pnpm 项目元数据 + scripts（dev/build/type-check/test/smoke/verify） |
| `tsconfig.json` | TypeScript 严格模式配置 |
| `tsconfig.node.json` | main/preload/agent-host Node 环境 TS 配置 |
| `vite.config.ts` | renderer Vite 配置 |
| `electron-builder.yml` | Electron 打包配置占位 |
| `vitest.config.ts` | vitest 测试配置 |
| `src/main/main.ts` | Electron 主进程入口 |
| `src/main/window.ts` | BrowserWindow 配置（sandbox:true） |
| `src/main/protocol.ts` | app:// 协议 + CSP |
| `src/main/ipc.ts` | desktop:connect-host IPC 处理 |
| `src/main/host-manager.ts` | utilityProcess.fork(agent-host) |
| `src/preload/preload.ts` | contextBridge exposeInMainWorld piBridge |
| `src/renderer/index.html` | HTML 入口 |
| `src/renderer/main.tsx` | React 19 入口 |
| `src/renderer/App.tsx` | 最小页面 + ping 按钮 |
| `src/agent-host/index.ts` | process.parentPort + createRpcServer |
| `src/agent-host/handlers/ping.ts` | ping handler |
| `src/contract/rpc.ts` | 自研 RPC 层 |
| `src/contract/desktop.ts` | PiBridge 接口最小子集 |
| `src/contract/api.ts` | interface Api 空骨架（仅 ping） |
| `src/contract/types.ts` | 共享类型 |
| `src/shared/constants.ts` | CSP + IPC 通道名常量 |
| `tests/unit/rpc.test.ts` | RPC 单件测试 |
| `tests/integration/host-rpc.test.ts` | main↔agent-host RPC 集成测试 |
| `tests/security/invariants.test.ts` | 安全不变量三条断言 |
| `scripts/check-desktop-security.mjs` | 安全不变量校验脚本（六条占位 + 三条实现） |

### 将修改的文件

| 文件路径 | 修改内容 |
|---|---|
| `docs/04-Todo-List.md` | T-M0-001 任务行状态 → in_progress |
| `.plan/00-当前任务.md` | 指向本计划文件 |
| `AGENTS.md` §10 | 补全 pnpm 命令清单（M0 启动后补全条款） |
| `scripts/verify.mjs` | 检测到 package.json scripts 后自动启用 m0 阶段（无需修改，自动适配） |

## 4. 接口设计

### RPC 方法（contract/api.ts 最小子集）

```typescript
// contract/api.ts
export interface Api {
  // 最小占位：验证 RPC 通道
  "system.ping": {
    params: { message?: string };
    result: { pong: string; timestamp: number };
  };
}
```

完整 interface Api（~50 方法）在 T-M0-002 任务中填充。

### PiBridge 接口（contract/desktop.ts 最小子集）

```typescript
// contract/desktop.ts
export interface PiBridge {
  // 建立 renderer↔agent-host 的 MessagePort 通道
  connectHost(): MessagePort;
}
```

完整 PiBridge 接口（file picker / dialog / toolchain query 等）在 T-M0-002+ 任务中填充。

### RPC wire 消息（contract/rpc.ts）

```typescript
// contract/types.ts
export type WireMessage =
  | { kind: "request"; id: string; method: string; args: unknown[] }
  | { kind: "response"; id: string; result?: unknown; error?: RpcError }
  | { kind: "subscribe"; id: string; topic: string; key?: string }
  | { kind: "unsubscribe"; id: string }
  | { kind: "event"; topic: string; key?: string; payload: unknown };
```

### 数据表

不涉及（数据层在 T-M0-006）。

## 5. 测试策略

### 单件测试（阶段 2）

`tests/unit/rpc.test.ts`：
- [ ] `createRpcServer` attachPort 后可接收 request 并返回 response
- [ ] `createRpcClient` call(method, args) 返回 server 处理结果
- [ ] subscribe(topic, key, on) 收到 event 时回调被触发
- [ ] unsubscribe 后不再收到 event
- [ ] 五种 wire 消息类型校验
- [ ] request 无对应 handler → error 响应（固定错误码 UNKNOWN_METHOD）
- [ ] handler throw → error 响应（固定错误码 INTERNAL_ERROR）

### 集成测试（阶段 3）

`tests/integration/host-rpc.test.ts`：
- [ ] main fork agent-host 成功，agent-host process.parentPort 就绪
- [ ] renderer 通过 piBridge.connectHost() 获得 MessagePort
- [ ] RPC ping 往返：renderer call("system.ping") → agent-host handler → 返回 {pong, timestamp}
- [ ] agent-host 异常退出 → main 收到 exit 事件 → 可重启

### 系统冒烟（阶段 5a）

本任务仅冒烟"骨架可启动 + RPC 通道建立"：
- [ ] `pnpm dev` 启动 Electron 应用 → 窗口打开
- [ ] renderer 页面显示"pi-studybuddy 骨架就绪"
- [ ] 点击 ping 按钮 → 收到 agent-host 返回的 pong + timestamp

完整 M0 系统冒烟（建库 + credential-vault + 安全不变量六条）在 T-M0-009 任务。

### E2E（阶段 5b）

不涉及（M0 骨架无完整业务路径，E2E 从 M1 开始）。

### 安全不变量（本任务实现三条）

`tests/security/invariants.test.ts` + `scripts/check-desktop-security.mjs`：
- [ ] `windowConfig.webPreferences.sandbox === true`
- [ ] CSP 含 `default-src 'self'`
- [ ] preload 仅 `exposeInMainWorld("piBridge", ...)`（无其他暴露）

剩余三条不变量在后续任务补全：
- [ ] credential-vault 用 safeStorage → T-M0-003
- [ ] Host RPC 契约化（api.ts 完整接口） → T-M0-002
- [ ] HTML 预览独立 CSP（form-action 'none'） → T-M0-008

## 6. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | — 未进入（2026-08-07 清空重来，待开工） |
| 2. 单件测试 | — 未进入 |
| 3. 集成测试 | — 未进入 |
| 4. 系统组装 | — 未进入 |
| 5. 冒烟 + E2E | — 未进入 |

## 7. 依赖关系

### 前置任务

- [ ] 无（T-M0-001 是 M0 首个任务，也是 pi-studybuddy 首个开发任务）

### 组件依赖

- [ ] Electron（最新稳定版，经 pnpm 安装）
- [ ] React 19 + Vite（renderer 框架，03-Arch §6.2）
- [ ] TypeScript 5+（strict 模式）
- [ ] vitest（单件 + 集成测试）

### 参考仓库（仅参考，不复制实现）

- `H:\pi-references\pi-desktop\src\{main,preload,renderer,agent-host,contract}`（03-Arch §6.1 五件骨架来源）
- `H:\pi-references\pi-desktop\scripts\check-desktop-security.mjs`（08-Test §5.7 校验脚本范式）

**纪律**（03-Arch §9.3）：参考 pi-desktop 范式，但必须在主仓独立重新实现，**不复制代码**。

## 8. 预期产物

### 代码

- `src/main/{main,window,protocol,ipc,host-manager}.ts`
- `src/preload/preload.ts`
- `src/renderer/{index.html,main.tsx,App.tsx}`
- `src/agent-host/{index.ts,handlers/ping.ts}`
- `src/contract/{rpc,desktop,api,types}.ts`
- `src/shared/constants.ts`

### 测试

- `tests/unit/rpc.test.ts`
- `tests/integration/host-rpc.test.ts`
- `tests/security/invariants.test.ts`
- `scripts/check-desktop-security.mjs`

### 项目配置

- `package.json` / `tsconfig.json` / `tsconfig.node.json` / `vite.config.ts` / `electron-builder.yml` / `vitest.config.ts`

### 文档更新

- `docs/04-Todo-List.md`（T-M0-001 任务状态 in_progress → completed）
- `AGENTS.md` §10（补全 pnpm 命令清单）
- `.plan/00-当前任务.md`（指向本计划）

### 实施记录

- `.record/T-M0-001-实施记录.md`（收尾时创建，8 章节）

## 9. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（已完成：03-Arch §6 + §9.2 + 08-Test §5.7 + 09-UI §1.3）
- [x] 步骤 2：检查文档门禁（已完成：前置门禁三项 + master 干净）
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [ ] 步骤 4：独立审查计划（待审查）
- [ ] 步骤 5：用户批准计划（★ 用户授权，待批准）
- [ ] 步骤 6：拆分任务、逐项实现
- [ ] 步骤 7：编写或更新测试（TDD：先写测试 RED → 最小实现 GREEN → REFACTOR）
- [ ] 步骤 8：type-check（`pnpm type-check`）
- [ ] 步骤 9：build（`pnpm build`）
- [ ] 步骤 10：test（`pnpm test`）
- [ ] 步骤 11：smoke（`pnpm smoke` + `node scripts/check-desktop-security.mjs`）
- [ ] 步骤 12：独立审查并修复
- [ ] 步骤 13：更新 04-Todo + 文档
- [ ] 步骤 14：文档治理检查（`node scripts/check-docs-governance.mjs`）
- [ ] 步骤 15：diff 检查（`git diff --check`）
- [ ] 步骤 16：提交交付（★ 用户授权后执行）

## 10. 证据登记（收尾时填写）

- 测试日志路径：
- 提交哈希：
- 推送状态：
- 实施记录路径：

---

## 审查记录

（步骤 4 独立审查时填写）

### 审查项

1. **范围合理性**：T-M0-001 仅做"四进程骨架 + 自研 RPC + 最小 contract"，credential-vault/toolchain/file-watch/数据层/扩展层/UI 全部明确为非目标
2. **TDD 纪律**：单件测试列 7 条断言（覆盖五种 wire 消息 + 错误处理），先 RED 后 GREEN
3. **安全不变量分阶段**：本任务仅实现六条中的三条（sandbox/CSP/preload），剩余三条在后续任务按依赖关系补全
4. **不复制参考代码**：03-Arch §9.3 明确参考 pi-desktop 但独立重新实现
5. **退出门槛明确**：应用可启动 + RPC 往返 + 三条安全不变量

### 待用户审查关注点

- 范围划分是否合理（T-M0-001 仅骨架，contract/api.ts 完整接口延迟到 T-M0-002）
- 是否需要在骨架阶段就引入 ESLint + Prettier（建议引入，避免后续补配置成本）
- electron-builder.yml 是否需要占位（建议占位，避免后续补配置影响 build 流程）

## 完成记录

（步骤 5 收尾时填写）
- 完成日期：
- 实施记录：.record/T-M0-001-实施记录.md
- 状态：✅ 已完成
