# T-M4-008 AppShell 数据流重构计划

**任务 ID**：T-M4-008
**状态**：in_progress
**日期**：2026-08-09
**里程碑**：M4 业务接线 + 打包部署
**标题**：AppShell 数据流重构（semesterId/courseId 全局状态 + 各 Tab useEffect 拉数据）
**授权**：用户 2026-08-09 明确要求按 T-M4-008 Prompt 执行实现。

## 1. 范围

- 保留 T-M4-007 的学期/课程树、唯一上下文、标题绑定、归档只读提示。
- 建立 AppShell→Tab 的统一、类型安全学术上下文数据流。
- 为当前已有数据加载能力建立统一 effect 生命周期：上下文变化重载、无上下文不请求、loading/error/empty/ready 状态可区分。
- 建立异步请求代际/卸载保护，禁止旧课程迟到响应污染新课程。
- 不新增 RPC，不实施 T-M4-010~019 的具体业务接线。

## 2. 前置门禁

- [x] T-M4-007 已完成并推送 origin/master。
- [x] master 与 origin/master 开工前同步且工作区干净。
- [x] 无其他执行中任务计划。
- [x] 用户明确选择并授权 T-M4-008。
- [x] 已创建任务分支 `agent/T-M4-008-appshell-dataflow`。
- [x] 已将 Todo 中 T-M4-008 登记为 in_progress。

## 3. 实施步骤

1. 审计现有 AppShell、semester-course-state、rpc-client 和全部 Tab 的 props/effect/RPC 调用。
2. RED：先增加唯一上下文传递、上下文切换重载、无上下文跳过请求、竞态/卸载保护、状态显示和 UI 回归测试。
3. GREEN：以最小改动实现统一数据流和请求生命周期。
4. REFACTOR：清理重复状态、补齐类型、依赖数组、脱敏展示和过时注释。
5. 运行定向测试、type-check、unit/integration、contract/security、build、smoke、full verify、受影响 Electron E2E、UUID、文档治理和 diff 检查。
6. 完成本任务实施记录与 Todo 证据；未经用户 Git 指令不 commit/merge/push，也不将任务登记为 done。

## 4. 退出门槛

- [x] AppShell 是 semesterId/courseId 唯一真源。
- [x] Tab 切换学期/课程会重新加载且旧响应不会污染新上下文。
- [x] 无课程上下文时不调用业务 RPC。
- [x] loading/error/empty/ready 状态可观察且不泄漏敏感信息。
- [x] T-M4-007 行为无回归。
- [x] 无 API 契约变化，或变化已获权威文档批准并同步。
- [x] TDD RED→GREEN→REFACTOR 证据完整。
- [x] 所有质量门通过。
- [x] `.record/T-M4-008-实施记录.md` 完成 8 章节。
- [ ] 两名独立审查意见已处理或登记。

## 5. 未解决事项

- T-M4-009~T-M4-021 不在本计划范围内，不得自动启动。
