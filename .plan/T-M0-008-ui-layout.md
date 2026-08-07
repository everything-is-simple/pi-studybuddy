# T-M0-008 09-UI 三栏布局 + 标签页骨架

**状态**：🔄 执行中
**日期**：2026-08-07
**里程碑**：M0 骨架搭建
**治理阶段**：阶段4（系统组装，代码进入 src/ + 类型检查 + lint）

## 权威依据

- [09-UI v0.1.2 §2-§4](../docs/09-使用者介面-UI-Design.md)：三栏布局 + TabBar 标签页结构
- [03-Architecture v0.1.1 §6/§6.1-§6.3](../docs/03-架构设计-Architecture-Design.md)：pi-desktop 五件骨架搬运改名
- [04-Todo §6.2](../docs/04-任务清单-Todo-List.md)：M0 骨架范围

## 任务范围（仅骨架，无业务内容）

### 交付物

1. **Tab 定义** `src/renderer/tabs.ts`：9 个 Tab 纯数据（id/label/emoji，对话默认）
2. **AppShell 组件** `src/renderer/components/AppShell.tsx`：三栏布局壳
   - 标题栏（学期名/课程名占位）
   - 左侧栏（导航区占位）
   - 主内容区（TabBar + 内容占位 + 朗读控制条占位区）
   - 右侧面板（上下文区占位）
   - 状态栏（模型/备份/调度/TTS 占位）
3. **TabBar 组件** `src/renderer/components/TabBar.tsx`：标签页栏
   - 9 Tab 空壳，💬 对话默认激活
   - 切换只变更激活态，不挂接业务 RPC
4. **App.tsx 更新**：组装 AppShell，保留现有 RPC 通道验证
5. **测试** `tests/unit/renderer-layout.test.ts`：Tab 定义 + 骨架渲染断言

### 不做

- ❌ 三栏内业务组件（SessionSidebar/ChatWindow/ChatInput/右侧学习上下文/TTS 控制条真实逻辑）
- ❌ 接 agent.events / sessions.list / 任何业务 RPC
- ❌ 主题切换、快捷键、文件浏览、模型/技能管理 UI
- ❌ S1-S7 任一标签页的业务内容
- ❌ 新增未批准依赖（jsdom/@testing-library/react 等）

## TDD 计划

### RED

```
1. Tab 定义：9 个 Tab，id 正确，默认 chat
2. AppShell renderToStaticMarkup：包含三栏 + 状态栏 + TabBar
3. TabBar renderToStaticMarkup：默认对话 Tab 激活
```

### GREEN

最小实现通过。

## 测试隔离

`H:\pi-studybuddy-tmp\runs\T-M0-008\`（本任务不产生运行数据，renderer 测试为纯内存渲染）

## 完成门槛

- [ ] `pnpm type-check` 通过
- [ ] `pnpm test` 通过
- [ ] `pnpm build` 通过
- [ ] `pnpm smoke` 通过
- [ ] `pnpm verify` 全绿
- [ ] 三栏布局 + TabBar 空壳可见，默认对话 Tab

## 收尾

1. 更新 04-Todo §7.1.1 登记 T-M0-008 done + §9 统计
2. 创建 `.record/T-M0-008-实施记录.md`
3. 同步 AGENTS.md §3.1 版本登记 + 00-索引版本历史
4. 运行 `pnpm verify`，报告，等待用户授权 commit/push
