# T-M4-012 实施计划：S2 笔记 Tab RPC 接线

- 任务 ID：T-M4-012
- 状态：in_progress
- 日期：2026-08-10
- 用户授权：已批准方案 A，并授权治理登记、唯一计划、隔离分支与随后 RED。
- 基线：master=origin/master=2497de4
- 分支：agent/T-M4-012-s2-notes-rpc
- 运行数据根：H:\pi-studybuddy-tmp\runs\T-M4-012\

## 1. 裁决与权威依据

- docs/04-任务清单-Todo-List.md 登记 T-M4-012：notes.get/update + modules.list/update。
- docs/06-API契约-API-Contracts.md §3.4：notes RPC 以 materialId 为输入，modules RPC 以 course/module id 为输入。
- docs/07-工作流-Workflow.md §2.3：学生在选课程后处理资料，并在资料维度查看/编辑笔记、更新模块学习状态。
- docs/09-使用者介面-UI-Design.md §4.4-§4.5：资料 Tab 与笔记 Tab 的业务边界，以及“选资料后”前置条件。
- live renderer 没有现成 selectedMaterialId 或 MaterialsTab→NotesTab 交接状态，因此采用用户批准的最小方案 A。

## 2. 方案 A：materialId 来源

1. NotesTab 在当前 courseId 下复用既有 materials.list({ courseId })。
2. UI 必须要求学生显式选择资料；不写死、不默认第一条、不从旧 props 猜测。
3. 选择值只保存在 NotesTab 局部状态，不新增 AppShell 全局状态或跨 Tab props 契约。
4. course/semester 上下文变化时清空选择，并拒绝旧请求覆盖新上下文。
5. 仅选择后调用 notes.get({ materialId });没有笔记时显示非致命空状态。
6. notes.update 使用当前选择的 materialId；归档上下文继续禁止写入。
7. modules.list({ courseId }) 继续按课程读取，renderer 按 module.materialId 过滤所选资料；状态变更调用 modules.updateLearnStatus。

## 3. 实施范围

允许修改：

- src/renderer/components/tabs/NotesTab.tsx
- tests/unit/renderer-notes-tab.test.ts
- 新增或修改 T-M4-012 renderer 集成测试与受控 Electron E2E 测试
- 必要的 T-M4-012 治理记录同步文件

明确不修改：

- src/agent-host/handlers/**
- src/contract/api.ts、数据库 schema、RPC 方法表
- src/renderer/components/AppShell.tsx 的全局资料状态
- T-M4-011 的已完成范围
- T-M4-013~021

## 4. TDD 执行顺序

### RED

先建立 mounted renderer 失败测试，至少覆盖：

- 资料列表加载与显式选择；未选择前不调用 notes.get；
- 选中资料后 notes.get 使用正确 materialId；
- notes.get 未找到笔记的空状态；
- 编辑保存调用 notes.update，且 archived 上下文不发写 RPC；
- modules.list 按 courseId 加载并按 materialId 过滤；
- modules.updateLearnStatus 使用模块 id 与新状态；
- 课程切换、选择切换、卸载时旧响应不会污染当前 UI；
- UI 不展示完整 UUID、绝对路径、错误栈或敏感正文日志。

测试 fixture、mock RPC 与 Electron 运行数据全部隔离到 H:\pi-studybuddy-tmp\runs\T-M4-012\。

### GREEN / REFACTOR

- 只实现使 RED 通过的最小 renderer 逻辑；
- 复用既有 typed RPC、useTabData 竞态/卸载保护与 archived 语义；
- 不新增 API/handler/schema，不把 MaterialsTab 的资料选择扩展为 AppShell 全局状态；
- 保持既有静态 props 测试兼容，随后整理组件状态与错误/空状态展示。

## 5. 验收与证据

1. 定向 unit/integration renderer 测试通过。
2. pnpm type-check、pnpm build、pnpm test、pnpm smoke 通过。
3. node scripts/verify.mjs --stage=full 通过，包含真实 Electron 代表性路径。
4. node scripts/check-docs-governance.mjs、契约覆盖、安全不变量、UUID 泄漏检查与 git diff --check 通过。
5. 两名独立审查者分别核对 materialId 来源、RPC 参数、竞态、归档写防线、隐私边界和范围边界。
6. 本地收尾后更新 Todo、计划和唯一实施记录；等待用户另行授权 Git 收口。

## 6. 停止条件

发现需要新增 API、handler、schema、AppShell 全局状态、改变 T-M4-011 语义、启动 T-M4-013~021、写入真实业务数据根、运行目录越界、E2E 无法启动、安全不变量失败、无法区分用户 dirty worktree，或需要 commit/merge/push 时，立即停止并报告。

## 7. 当前执行证据

- RED：新增 tests/integration/t-m4-012-notes-rpc.test.ts；初始运行 4 项失败，均因现有 NotesTab 没有局部资料选择器。
- GREEN：NotesTab 已使用不泄露 materialId 的局部选择 token，选择后接通 notes.get/update 与 modules.list/updateLearnStatus；归档上下文写入口禁用。
- 定向：tests/integration/t-m4-012-notes-rpc.test.ts 10/10、tests/e2e/t-m4-012-notes-renderer.test.ts 1/1 通过；type-check、build、docs-governance、git diff --check 通过。
- 当前 Node24.14.0 / pnpm11.20.0 `verify --stage=full` 通过：unit 107 files / 1047 tests，真实 Electron E2E 17 files / 119 tests；contract coverage、desktop security 6/6、smoke 与 UUID 检查均通过。
- E2E fixture 在 main 启动前于 `H:\pi-studybuddy-tmp\runs\T-M4-012\` 隔离根预置，避免 reload 后重复连接 agent-host；结果文件与错误输出不记录完整 UUID、路径或原始堆栈。
- 两名独立审查者已复核当前变更，均无 P0/P1；任务仍 in_progress，未执行 Git 收口。

## 8. 首轮独立审查与 P1 修复

- 首轮两名独立审查一致要求退回 RED：保存请求跨资料晚到回写、DOM 资料文本未作对抗性净化验证、NOT_FOUND 后手动新建不可达、模块过滤/参数覆盖不足。
- 修复：NotesTab 引入局部 view context version 与 mounted guard；读取、保存与模块状态异步回写仅在同一资料/课程上下文且组件仍挂载时生效。
- 修复：资料选择 option 使用无业务 ID 的局部 token；资料名、笔记正文、模块名/摘要在 renderer 展示边界拦截完整 UUID、Windows/POSIX/file 路径与错误栈。
- 修复：NOT_FOUND 空状态提供新建笔记，复用 notes.update 创建；补两资料两模块过滤、courseId 参数、延迟保存切换和对抗性 DOM 测试。
- 修复后历史定向与质量门数字保留为审计快照；当前最终证据以 §7 最新复验为准。
- 最终两名独立审查已回填：当前 E2E 导航、可见文本隐私断言、NotesTab 契约/竞态/归档边界均无 P0/P1；未执行 Git 收口。
