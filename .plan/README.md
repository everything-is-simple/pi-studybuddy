# .plan/ — 任务计划目录

**用途**：存放 pi-studybuddy 开发任务的详细执行计划。同一时刻只允许存在一个**正在执行**的计划。

## 单一执行任务门禁（AGENTS.md §4.4）

1. 上一项任务已完成并在 [docs/04-Todo](../docs/04-任务清单-Todo-List.md) 记录
2. 用户已明确选择该任务并批准开工
3. 该任务即将进入实施

**任一未满足 → 拒绝创建计划**

## 文件结构

```
.plan/
├── 00-当前任务.md         # 当前执行中任务指针（无任务时为"⚪ 无执行中任务"）
├── T-<里程碑>-<序号>-<scope>.md   # 任务计划（10 章节模板，见 .pi/prompts/plan.md）
└── README.md              # 本文件
```

## 创建流程

1. 用户明确选择任务并批准 → 调用 `/plan <task-id>` 工作流模板（[.pi/prompts/plan.md](../.pi/prompts/plan.md)）
2. 前置门禁检查通过 → 创建 `T-XX-NNN-<scope>.md`
3. 更新 `00-当前任务.md` 指向该计划
4. 更新 [docs/04-Todo](../docs/04-任务清单-Todo-List.md) 任务状态为 `in_progress`
5. 用户审查并批准计划（步骤 5）→ 进入实施

## 收尾流程

任务完成后调用 `/wr` 工作流模板（[.pi/prompts/wr.md](../.pi/prompts/wr.md)）：
1. 复验测试
2. 更新 04-Todo
3. 创建 [.record/](../.record/) 实施记录
4. 标记计划文件"完成记录"章节（**不删除**，保留作为历史证据）
5. 复位 `00-当前任务.md` 为"⚪ 无执行中任务"

## 命名规范

- task-id：`T-<里程碑>-<序号>`（如 `T-M0-001`）
- 计划文件：`T-<里程碑>-<序号>-<scope>.md`（如 `T-M0-001-electron-skeleton.md`）

## 参考

- [AGENTS.md §4.4](../AGENTS.md) 单一执行任务门禁
- [docs/10-开发规范](../docs/10-开发规范-Dev-Rules.md) 步骤 3（编写 .plan/ 计划）
- [.pi/prompts/plan.md](../.pi/prompts/plan.md) 计划模板
- [.pi/prompts/wr.md](../.pi/prompts/wr.md) 收尾模板
