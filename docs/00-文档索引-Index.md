# Pi StudyBuddy 文档索引

**版本**：v0.1.0
**日期**：2026-08-06
**用途**：pi-studybuddy 项目的导航中心和单一事实来源（SoT）。AI Agent 和开发者在开始任何任务前，必须先读本文件。

---

## 一、项目定位

**pi-studybuddy = pi（AI 底座）+ pi-skills（组件供给）+ StudyBuddy 业务能力（内核）**

- **AI 底座**：[pi-coding-agent](https://github.com/earendil-works/pi)（不修改内核，通过扩展/技能接入）
- **组件供给**：[badlogic/pi-skills](https://github.com/badlogic/pi-skills)（8 个可复用技能）+ 自建技能
- **业务内核**：StudyBuddy 已验证的考试驱动学习闭环（S1-S7 业务认知迁移，实现不复制）
- **参考范本**：[inno-agent](https://github.com/hhyqhh/inno-agent)（MIT，以 pi SDK 构建的个人学习智能体，三层记忆 + 技能系统 + 练习实验室）

## 二、参考仓库（本地只读）

| 仓库 | 本地路径 | 用途 |
|---|---|---|
| earendil-works/pi | `H:\pi-references\pi` | AI 底座，扩展/skill/工具 API 来源 |
| badlogic/pi-skills | `H:\pi-references\pi-skills` | 可复用技能（brave-search、browser-tools、transcribe 等） |
| hhyqhh/inno-agent | `H:\pi-references\inno-agent` | 架构范本（MIT）：registerTool 注册、分层记忆、技能系统 |

参考仓库只读，不进入 pi-studybuddy 的 workspace；借鉴结论必须先回填到本索引对应的编号文档。

## 三、文档结构

| 编号 | 文档名 | 状态 | 用途 |
|---|---|---|---|
| 00 | 本文档 | ✅ 已创建 | 导航、门禁、参考仓库清单 |
| 01 | TRD-技术需求-Technical-Requirements.md | 📝 待创建 | 运行环境、pi 集成方式、WPS COM、格式矩阵、安全边界 |
| 02 | PRD-产品需求-Product-Requirements.md | 📝 待创建 | 产品定位、考试驱动学习闭环、使用者与边界 |
| 03 | 架构设计-Architecture-Design.md | 📝 待创建 | pi 扩展层 / 业务 Adapter / 数据层 / 技能体系 |
| 04 | 任务清单-Todo-List.md | 📝 待创建 | 任务登记、组件治理状态、完成门槛 |
| 05 | 数据模型-ERD-Data-Model.md | 📝 待创建 | SQLite schema 全量图 |
| 06 | API契约-API-Contracts.md | 📝 待创建 | `{success, data, error}` 信封、路由表 |
| 07 | 工作流-Workflow.md | 📝 待创建 | 学生主路径 / 家长报告 / 备份恢复 / 组件治理流程 |
| 08 | 测试验收-Test-Plan.md | 📝 待创建 | 单件测试 / 集成测试 / 系统冒烟 / 系统 E2E |
| subsystems/ | 业务子系统文档（S1-S7 收编） | 📝 待创建 | 学习节奏/资料笔记/限时练习/错题/冲刺/家长报告/课堂采集 |

## 四、组件治理流程（强制）

> 用户定义的五阶段组件治理，是本项目的铁律：

```text
1. 组件下载储存 → H:\pi-references 或组件专用目录
2. 组件单件测试 → 独立冒烟（合成夹具）
3. 组件集成测试 → 与 pi 底座对接契约验证
4. 系统配件组装 → 进入主仓 Adapter/扩展
5. 系统冒烟测试 + 系统端到端测试 → 全链回归
```

任何组件（开源库、技能、自写模块）必须走完五阶段才能算"已装配"；任一阶段失败退回上一阶段，不进 master。

## 五、目录治理

- `<repo-root>`：`H:\pi-studybuddy`，唯一主系统 Git 仓库，只保存有效设计文档、正式实现和可审计结论。
- `H:\pi-references\*`：参考仓库只读区，不加入 workspace。
- 运行数据必须隔离：E2E/冒烟使用 `H:\pi-studybuddy-tmp\runs\<task-id>`。
- 不提交：真实密钥、`.env.local`、资料原文、完整 UUID、node_modules。

## 六、文档门禁

1. 新建文档前先读本索引，检查目标文档是否已存在。
2. 按编号顺序推进：01-TRD → 02-PRD → 03-Design → 05-ERD → 06-API → 07-Workflow → 08-Test → 04-Todo。
3. 创建后同步更新本索引。
4. 提交前运行文档治理检查（实现中）与 `git diff --check`。

## 七、当前状态

- [x] 初始化仓库（git init + 关联远端 `https://github.com/everything-is-simple/pi-studybuddy.git`）
- [x] 下载三参考仓库到 `H:\pi-references`
- [x] 本文档（00 索引）
- [ ] 01-TRD：技术需求（下一步）

## 八、版本历史

| 版本 | 日期 | 变更 |
|---|---|---|
| v0.1.0 | 2026-08-06 | 初始版本：仓库初始化、参考仓库下载梳理、文档结构定义 |
