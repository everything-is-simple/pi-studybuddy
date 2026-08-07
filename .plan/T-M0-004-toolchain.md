# 任务计划：T-M0-004 toolchain 发现-探测-安装-绝对路径

**任务 ID**：T-M0-004
**日期**：2026-08-07
**状态**：✅ 已批准执行中（2026-08-07 用户批准：仅框架、14 种 capability 全保留、暂不实现组件下载）
**关联文档**：03-Arch §6.5（权威）+ 06-API §3.16 + 01-TRD §7 决策 1 + 08-Test §5.7（INV-06）
**里程碑**：M0 骨架搭建
**前置**：T-M0-001 ✅ done（rpc/host 骨架）+ T-M0-002 ✅ done（contract 契约面，ToolchainStatus 类型 + toolchains.list/install/rescan 三方法 + toolchains.changed stream 已声明）+ T-M0-003 ✅ done（credential-vault）+ T-M0-006 ✅ done（数据层 schema）

---

## 1. 任务目标

### 做什么

为 pi-studybuddy 落地 **toolchain 四段式能力**：**发现（discovery）→ 探测（probe）→ 安装（install）→ 绝对路径执行（absolute path execution）**。系统扫描系统 PATH 发现 14 种 capability，通过 probes 判定 health（unsupported/unverified/healthy），托管安装到 `app.getPath("userData")` 不染系统 PATH，最终通过 `toolchain-runtime.ts` 的 `prependPath` 统一绝对路径执行环境。

### 为什么

- **M0 退出门槛前置**：04-Todo §6.2 退出门槛含"toolchain 发现（Node/Python/uv/Git/WPS/whisper.cpp）"
- **壳层公用零件**：AGENTS.md §4.3 装配顺序——壳层就绪后先建公用零件（toolchain 是第三件），OCR venv、whisper.cpp 后续调用依赖统一绝对路径
- **01-TRD §7 决策 1 权威**：发现验证 Node/Python/uv/Git/Bash，统一绝对路径执行环境

### 依据

- 03-Arch §6.5：TOOL_CAPABILITY_IDS 14 项 + 四段式 + 内置 ripgrep/fd + 窗口 focus 60s TTL 重扫 + prependPath 统一环境
- 06-API §3.16：`toolchains.list`（→`ToolchainStatus[]`）、`toolchains.install({capabilityId})`（→`ToolchainStatus`）、`toolchains.rescan`（→`ToolchainStatus[]`）；Streams：`toolchains.changed`
- 08-Test §5.7：INV-06（toolchain 绝对路径执行）——check-desktop-security.mjs 已有占位
- contract 现有类型：`ToolchainHealth = "unsupported" | "unverified" | "healthy"`、`ToolchainStatus { capabilityId, name, health, version?, path? }`已就绪
- 用户裁决（2026-08-07）：仅框架不实现组件下载、14 种 capability 全部保留、通用 probe 框架 + Node 专用 probe

## 2. 范围与非目标

### 范围

1. **`src/main/toolchains/` 核心实现**：
   - `discovery-registry.ts`：扫描系统 PATH，发现 14 种 capability 的可执行文件候选（`TOOL_CAPABILITY_IDS`），支持 MAX_SEEDS=320、MAX_ENUMERATED_CHILDREN=64 边界
   - `probes/node.ts`：Node 专用 probe（MINIMUM_NODE_VERSION="22.19.0"，MAXIMUM_VERIFIED_NODE_MAJOR=24，health=unsupported/unverified/healthy）
   - `probes/capabilities.ts`：通用 probe 框架（其余 13 种 capability 通过 `--version` 探测版本 + health 判定）
   - `probes/common.ts`：共享 probe 工具（版本比较 `compareVersions`、环境构建 `buildProbeEnvironment`、候选构建 `candidateFromSeed` / `failedCandidate`）
   - `candidate-normalizer.ts`：候选路径归一化/去重（`normalizeToolPath`、`normalizeAndDedupeCandidates`、`toolPathComparisonKey`）
   - `public-state.ts`：构建公开 `ToolchainStatus[]` 状态（`buildPublicToolchainState`、`commandDescriptorFromCandidate`）
   - `paths.ts`：托管目录路径管理（`toolchainDir`/`installDir`）
   - `environment.ts`：Windows path 环境（`windowsNativePathToMsys`）
   - `installer.ts`：安装到 `app.getPath("userData")` 托管目录，不修改系统 PATH/注册表（本任务仅框架，不实现实际下载）
   - `manager.ts`：装配 discovery→probe→install→rescan，管理 60s TTL + focus 重扫，产出 `ToolchainStatus[]`
   - `index.ts`：统一出口（`createToolchainManager`）

2. **`src/agent-host/toolchain-runtime.ts`**：`prependPath(env, directories, platform)` 统一绝对路径执行环境

3. **`src/agent-host/handlers/toolchains.ts`**：`toolchains.list` / `install` / `rescan` 三 handler + `toolchains.changed` Stream 推送

4. **测试**：
   - 单件：discovery 扫描测试、node probe 版本阈值/health 语义、candidate-normalizer 去重、prependPath 环境构造
   - 集成：真实 PATH 探测 + 隔离目录安装 + 60s TTL 重扫
   - 安全不变量：INV-06 落地（assert toolchain prependPath 不污染系统 PATH）

5. **数据隔离**：测试写入 `H:\pi-studybuddy-tmp\runs\T-M0-004\`

### 非目标（不做什么）

- ❌ 不实现托管组件下载器（portable-git/node-lts/ripgrep bundled 等）→ 后续独立任务
- ❌ 不实现业务工具调用逻辑（OCR/whisper.cpp Adapter 等）→ M1+ 业务任务
- ❌ 不接入 UI（ToolchainsConfig 页面）→ M0 收尾系统冒烟
- ❌ 不复制 pi-desktop 代码：参考范式但独立重实现（AGENTS.md §6.2 + 03-Arch §9.3）
- ❌ file-watch → T-M0-005
- ❌ studybuddy-extension 空壳 → T-M0-007
- ❌ 09-UI 三栏布局 → T-M0-008
- ❌ M0 系统冒烟完整 → T-M0-009

## 3. 文件清单

### 将创建的文件

| 文件路径 | 用途 |
|---|---|
| `src/main/toolchains/discovery-registry.ts` | PATH 扫描发现 14 种 capability |
| `src/main/toolchains/probes/node.ts` | Node 版本探测 + health 判定 |
| `src/main/toolchains/probes/capabilities.ts` | 通用 probe 框架 |
| `src/main/toolchains/probes/common.ts` | 共享 probe 工具函数 |
| `src/main/toolchains/candidate-normalizer.ts` | 候选路径归一化/去重 |
| `src/main/toolchains/public-state.ts` | 构建 ToolchainStatus[] |
| `src/main/toolchains/paths.ts` | 托管目录路径管理 |
| `src/main/toolchains/environment.ts` | Windows 路径环境处理 |
| `src/main/toolchains/installer.ts` | 安装到 userData（不染系统 PATH，仅框架） |
| `src/main/toolchains/manager.ts` | 装配 discovery→probe→install→rescan |
| `src/main/toolchains/index.ts` | 统一出口 |
| `src/agent-host/toolchain-runtime.ts` | prependPath 统一绝对路径执行 |
| `src/agent-host/handlers/toolchains.ts` | toolchains.list/install/rescan RPC handlers |
| `tests/unit/toolchains-discovery.test.ts` | discovery+probe 单件测试 |
| `tests/unit/toolchains-runtime.test.ts` | prependPath 单件测试 |
| `tests/integration/toolchains-manager.test.ts` | 真实 PATH 探测 + 隔离安装集成测试 |

### 将修改的文件

| 文件路径 | 修改内容 |
|---|---|
| `src/agent-host/index.ts` | 注册 toolchains.list/install/rescan 三 handler + import toolchains handler |
| `scripts/check-desktop-security.mjs` | INV-06 占位→真实断言 |
| `docs/04-Todo-List.md` | T-M0-004 任务行登记 + 状态 in_progress |
| `.plan/00-当前任务.md` | 指向本计划文件 |
| `docs/00-文档索引-Index.md` | 版本历史登记（收尾时） |

## 4. 接口设计

### 4.1 TOOL_CAPABILITY_IDS（03-Arch §6.5）

```typescript
const TOOL_CAPABILITY_IDS = [
  "shell.bash", "shell.powershell", "vcs.git",
  "js.node", "js.npm", "js.npx", "js.bun",
  "python.interpreter", "python.uv", "python.uvx",
  "search.rg", "search.fd",
  "data.jq", "network.curl",
] as const;
```

### 4.2 ToolchainManager 接口

```typescript
export interface ToolchainManager {
  /** 获取全部工具状态（含缓存，60s TTL） */
  list(): ToolchainStatus[];
  /** 安装指定 capability 到 userData（本任务仅框架，不实际下载） */
  install(capabilityId: string): Promise<ToolchainStatus>;
  /** 强制重新扫描 PATH */
  rescan(): ToolchainStatus[];
  /** 注册变更回调（供 Stream 推送） */
  onChanged(cb: (statuses: ToolchainStatus[]) => void): void;
  dispose(): void;
}
```

### 4.3 prependPath（03-Arch §6.5 第 4 点）

```typescript
export function prependPath(
  env: Record<string, string | undefined>,
  directories: string[],
  platform: string,
): Record<string, string | undefined>;
// 把托管工具目录前缀到 PATH，确保 Windows 下路径分隔符正确
```

### 4.4 RPC handlers（06-API §3.16）

```typescript
// src/agent-host/handlers/toolchains.ts
"toolchains.list":     () => ToolchainStatus[]          // manager.list()
"toolchains.install":  ({ capabilityId }) => ToolchainStatus  // manager.install(capabilityId)
"toolchains.rescan":   () => ToolchainStatus[]          // manager.rescan()
// Stream: "toolchains.changed" → ToolchainStatus[]（manager.onChanged 触发）
```

## 5. 技术选型

### 5.1 发现机制

- 扫描 `process.env.PATH` 分割的每个目录，枚举可执行文件（Windows: `.exe`/`.cmd`/`.bat`/`.ps1`；其他: 有 exec 权限）
- 参考 pi-desktop `discovery-registry.ts` 的 `nodeDiscoveryFileSystem` 抽象，用 `fs.statSync`/`fs.readdirSync` 实现
- `MAX_SEEDS=320` / `MAX_ENUMERATED_CHILDREN=64` 边界防护

### 5.2 Probe 策略

- **Node**：专用 probe（`node -e "console.log(JSON.stringify({...}))"` → 解析版本 → health 判定）
- **其余 13 种**：通用 probe（`<executable> --version` → stdout 解析版本 → health=healthy 或 unsupported）

### 5.3 安装框架

- `installer.ts` 定义接口但不实现实际下载
- 安装目标：`app.getPath("userData")/toolchains/<capabilityId>/`
- `install()` 返回 `ToolchainStatus` 标记 health=unverified（表示"等待实际下载实现"）

### 5.4 数据隔离

- 所有测试写入 `H:\pi-studybuddy-tmp\runs\T-M0-004\`（AGENTS.md §5.3）
- 测试中 mock `app.getPath("userData")` 返回隔离目录

## 6. 测试策略

### 6.1 单件测试（阶段 2，`tests/unit/toolchains-discovery.test.ts`）

- [ ] **DISCOVERY-01**：discovery-registry 扫描 PATH 返回候选列表（mock 文件系统）
- [ ] **DISCOVERY-02**：对不存在的目录返回空数组
- [ ] **DISCOVERY-03**：MAX_SEEDS=320 边界（超过上限截断）
- [ ] **NODE-PROBE-01**：Node probe 对有效版本返回 healthy
- [ ] **NODE-PROBE-02**：Node probe 对低于 MINIMUM_NODE_VERSION 返回 unsupported
- [ ] **NODE-PROBE-03**：Node probe 对超出 MAXIMUM_VERIFIED_NODE_MAJOR 返回 unverified
- [ ] **NODE-PROBE-04**：Node probe 对不可执行文件返回 unsupported
- [ ] **CAPA-PROBE-01**：通用 probe 对有效命令返回 healthy
- [ ] **CAPA-PROBE-02**：通用 probe 对不存在命令返回 unsupported
- [ ] **NORMALIZER-01**：candidate-normalizer 去重相同路径
- [ ] **NORMALIZER-02**：normalizeToolPath 处理 Windows 反斜杠

### 6.2 单件测试（`tests/unit/toolchains-runtime.test.ts`）

- [ ] **RUNTIME-01**：prependPath 把目录前缀到 PATH
- [ ] **RUNTIME-02**：prependPath 保留原有 PATH 条目
- [ ] **RUNTIME-03**：prependPath 对空目录数组返回原样
- [ ] **RUNTIME-04**：prependPath 处理 Windows 路径分隔符

### 6.3 集成测试（阶段 3，`tests/integration/toolchains-manager.test.ts`）

- [ ] **MANAGER-01**：manager.list() 返回真实已知工具（至少 node）
- [ ] **MANAGER-02**：manager.rescan() 刷新缓存
- [ ] **MANAGER-03**：manager.install() 返回 ToolchainStatus（不实际下载）
- [ ] **MANAGER-04**：manager.onChanged 在 rescan 后被调用
- [ ] **ISOLATION-01**：测试写入隔离目录，不产生真实数据文件

### 6.4 安全不变量（INV-06）

- `scripts/check-desktop-security.mjs`：assert toolchain 不污染系统 PATH（prependPath 返回新对象，不修改原 env）

## 7. 五阶段治理定位

| 阶段 | 当前任务处于 |
|---|---|
| 1. 下载储存 | — 不涉及（无新外部组件） |
| 2. 单件测试 | ⏳ toolchains-discovery.test.ts + toolchains-runtime.test.ts |
| 3. 集成测试 | ⏳ toolchains-manager.test.ts（真实 PATH 探测 + 隔离安装） |
| 4. 系统组装 | src/main/toolchains/ + src/agent-host/toolchain-runtime.ts + handlers |
| 5. 冒烟 + E2E | check-desktop-security INV-06 + 依赖 M0-009 系统冒烟 |

## 8. 依赖关系

### 前置任务

- [x] T-M0-001（rpc/host 骨架）
- [x] T-M0-002（contract 契约面，含 ToolchainStatus 类型 + toolchains 方法声明）
- [x] T-M0-003（credential-vault）
- [x] T-M0-006（数据层 schema）

### 组件依赖

- [x] Node v22.16.0（满足所有版本阈值）
- [x] vitest（单件 + 集成测试）
- [x] fs / path（Node 内置，PATH 扫描）

### 参考仓库

- `H:\pi-references\pi-desktop\src\main\toolchains\`（discovery-registry / manager / probes / public-state / paths / environment / candidate-normalizer / installer）
- `H:\pi-references\pi-desktop\src\agent-host\toolchain-runtime.ts`（prependPath 范式）
- `H:\pi-references\pi-desktop\src\shared\toolchains\types.ts`（TOOL_CAPABILITY_IDS 常量）

**纪律**：参考范式但独立重实现，不复制代码。

## 9. 预期产物

- `src/main/toolchains/` 11 个文件
- `src/agent-host/toolchain-runtime.ts`
- `src/agent-host/handlers/toolchains.ts`
- `tests/unit/toolchains-discovery.test.ts`
- `tests/unit/toolchains-runtime.test.ts`
- `tests/integration/toolchains-manager.test.ts`
- `scripts/check-desktop-security.mjs`（INV-06 落地）
- `.record/T-M0-004-实施记录.md`（收尾时创建）

## 10. 16 步执行跟踪

- [x] 步骤 1：读文档、定边界（已完成：03-Arch §6.5 + 06-API §3.16 + 01-TRD §7 决策 1 + 08-Test §5.7）
- [x] 步骤 2：检查文档门禁（已完成：T-M0-003 done + master 干净 + .plan 无执行中任务）
- [x] 步骤 3：编写 .plan/ 计划（本文件）
- [x] 步骤 4：独立审查计划
- [x] 步骤 5：用户批准计划（★ 用户授权，2026-08-07 批准：仅框架、14 种 capability 全保留、暂不实现组件下载）
- [x] 步骤 6：拆分任务、逐项实现
- [x] 步骤 7：TDD 测试（RED → 最小实现 GREEN → REFACTOR）
- [x] 步骤 8：type-check（`pnpm type-check`）
- [x] 步骤 9：build（`pnpm build`）
- [x] 步骤 10：test（`pnpm test`）
- [x] 步骤 11：smoke / 安全脚本（`pnpm smoke` + check-desktop-security）
- [x] 步骤 12：独立审查并修复
- [x] 步骤 13：更新 04-Todo + 文档
- [x] 步骤 14：文档治理检查（`node scripts/check-docs-governance.mjs`）
- [x] 步骤 15：diff 检查（`git diff --check`）
- [ ] 步骤 16：提交交付（★ 用户授权后执行）

## 11. 证据登记（收尾时填写）

- 测试日志路径：`pnpm verify` 121 tests passed（2026-08-07）
- 提交哈希：待用户授权后提交
- 推送状态：待用户授权后推送
- 实施记录路径：`.record/T-M0-004-实施记录.md`

## 审查记录

### 审查项（步骤 4 独立审查）

1. **范围合理性**：仅"发现-探测-安装-绝对路径执行"框架，不实现组件下载器（bundled 延后），14 种 capability 全部保留，通用 probe + Node 专用 probe。与 03-Arch §6.5 权威条款一致，无范围蔓延。
2. **TDD 纪律**：单件测试 13 条 + 集成 5 条 + INV-06 安全不变量，先 RED 后 GREEN。
3. **不复制参考代码**：参考 pi-desktop 范式但独立重实现。
4. **INV-06 落地**：check-desktop-security.mjs 占位→真实断言（prependPath 不污染 PATH）。
5. **退出门槛明确**：discovery→probe→install→prependPath 全链路 + 三 handler 注册 + 60s TTL 重扫 + INV-06 全绿。

### 待用户审查关注点（已裁决）

- ✅ **仅框架暂缓组件下载**：`installer.ts` 定义接口但不实现实际下载，`install()` 返回 health=unverified
- ✅ **14 种 capability 全部保留**：不裁剪
- ✅ **通用 probe 框架 + Node 专用 probe**：Node 用专用 probe（版本阈值），其余用通用 `--version` probe

## 完成记录

- 完成日期：2026-08-07
- 实施记录：.record/T-M0-004-实施记录.md
- 状态：✅ 已完成（待用户授权提交）