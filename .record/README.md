# .record/ — 实施记录目录

**用途**：存放 pi-studybuddy 每个开发任务的实施记录，作为该任务"做了什么、如何做、证据是什么"的唯一历史证据。

## 文件结构

```
.record/
├── T-<里程碑>-<序号>-实施记录.md   # 每个任务一份
└── README.md                       # 本文件
```

## 命名规范

- 文件名：`T-<里程碑>-<序号>-实施记录.md`（如 `T-M0-001-实施记录.md`）
- 一个 task-id 对应一份实施记录，**不拆分不覆盖**

## 8 章节模板（AGENTS.md §7.1）

```markdown
# 实施记录：<task-id> <任务标题>

**任务 ID**：<task-id>
**日期**：YYYY-MM-DD
**计划文件**：.plan/<plan-file>.md

## 1. 任务裁决与范围
（做什么、不做什么、依据哪份设计文档）

## 2. 实际交付
（实际产出的文件/模块/测试）

## 3. 偏差
（与计划的差异，如有）

## 4. 问题及根因
（开发中遇到的问题及根因分析）

## 5. 关键决定及依据
（开发中的关键决策及权威依据）

## 6. 测试证据
（测试通过日志/截图/断言结果）

## 7. Git 证据
（提交哈希/分支名/合并记录/推送状态）

## 8. 未解决事项/下一步约束
（遗留问题、技术债、下一步约束）
```

## 创建时机

任务收尾时由 `studybuddy-task-complete` Skill（[.pi/skills/studybuddy-task-complete/SKILL.md](../.pi/skills/studybuddy-task-complete/SKILL.md)）步骤 3 创建。

**禁止**：未完成任务前预创建、用聊天记录代替实施记录、删除已完成的实施记录。

## 与 04-Todo 的关系

- [docs/04-Todo](../docs/04-任务清单-Todo-List.md) 是任务注册表（一行一任务的状态）
- `.record/` 是任务详细实施证据（每任务一份完整记录）
- 04-Todo §7 任务行的"证据"字段引用本目录的实施记录路径

## 参考

- [AGENTS.md §7](../AGENTS.md) 受控收尾流程
- [AGENTS.md §7.1](../AGENTS.md) 实施记录 8 章节
- [docs/10-开发规范](../docs/10-开发规范-Dev-Rules.md) 步骤 13（更新 04-Todo + 文档）
- [.pi/skills/studybuddy-task-complete/SKILL.md](../.pi/skills/studybuddy-task-complete/SKILL.md) 收尾 Skill
