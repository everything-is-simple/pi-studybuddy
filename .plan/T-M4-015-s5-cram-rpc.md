# T-M4-015 实施计划：S5 冲刺 Tab RPC 接线

- 任务 ID：T-M4-015
- 任务标题：S5 冲刺 Tab RPC 接线（mockExams + cramCards + cramPlan）
- 任务类型：M4 业务接线
- 优先级：P2
- 治理阶段：阶段 4（系统组装）
- 状态：done（本地实施、双维度独立审查、质量门与 Git 收口完成；master 集成与 origin/master 核验通过）
- 日期：2026-08-11
- 用户授权：用户明确选择并批准开工 T-M4-015（2026-08-11“现在开始 T-M4-015”）
- 集成基线：master=origin/master=2d63bf5（T-M4-015 Git 收口事实核验）
- 实施分支：agent/T-M4-015-s5-cram-rpc
- 集成分支：master
- 测试运行根：H:\pi-studybuddy-tmp\runs\T-M4-015\

## 一、前置事实与权威依据

- T-M4-014 已完成治理事实收口：`docs/04-Todo` 已登记 done，`master=origin/master=ddca0c8`，`git rev-parse master origin/master` 已核验同一提交，工作区除未跟踪的 pi-session 导出 html（用户 dirty 文件）外干净。
- 权威范围：09-UI §4.8、06-API §3.7、07-Workflow §2.6/§8.8、08-Test §5/§6/§7.4、AGENTS.md §4.4/§5/§7/§8/§9。
- 既有 contract 能力仅复用（已装配于 src/agent-host/handlers/s5/）：
  - `mockExams.generatePaper({ assessmentAttemptId, questionCount, timeLimit? })`
  - `mockExams.getPaper({ paperId })`
  - `mockExams.startAttempt({ paperId })`
  - `mockExams.submitAttempt({ attemptId, answers })`
  - `mockExams.getResult({ attemptId })`
  - `mockExams.getModuleAnalyses({ attemptId })`
  - `cramCards.get({ assessmentAttemptId })`
  - `cramPlan.get({ assessmentAttemptId })`
  - `exams.list({ courseId, confirmationStatus })`（S1 既有 API，HomeTab 已用；仅用于获取已确认考试列表以构造 assessment context 门控，不新增方法）
- 明确不新增、不改动：API contract（保持 127/127）、handler、schema、AppShell 全局状态、S3/S4 已验收语义、真实外部服务和真实业务数据根。

## 二、允许修改范围

1. `src/renderer/components/tabs/CramTab.tsx`（接通既有 S5 RPC + 已确认考试局部显式选择 + 模拟考流程 + 速背卡翻页 + 冲刺计划展示）
2. `tests/integration/t-m4-015-cram-rpc.test.ts`（新增，RPC/门控/竞态/卸载/重复 mutation 夹具）
3. `tests/e2e/t-m4-015-cram-renderer.test.ts`（新增，真实 Electron + 127.0.0.1 TCP 链路，隔离 fixture 预置）
4. `.plan/T-M4-015-s5-cram-rpc.md`（本文件）
5. `.plan/00-当前任务.md`
6. `.record/T-M4-015-实施记录.md`（受控收尾时创建）
7. `docs/04-任务清单-Todo-List.md`、`docs/00-文档索引-Index.md`（开工登记与受控收尾时同步事实）

禁止覆盖当前工作区既有用户 dirty 修改（未跟踪 pi-session html）与既有治理资产。

## 三、RED 测试追踪

| ID | 设计条款 | 失败证据 |
|---|---|---|
| S5-RED-01 | 已确认考试上下文加载与门控（09-UI §4.8 顶部“考试已确认 ✅”） | 无课程/无 confirmed exam 时不发 mockExams/cramCards/cramPlan RPC，显示明确空态；加载 `exams.list({ courseId, confirmationStatus: "confirmed" })` 只取当前课程已确认考试 |
| S5-RED-02 | 模拟卷生成与幂等（06-API §3.7 + 07-WF §2.6 2a） | 点击“生成试卷”只调用一次 `generatePaper`；重复点击不重复 mutation；未确认考试错误走固定中文拒绝文案 |
| S5-RED-03 | 开始作答/计时/提交（07-WF §2.6 2b-2d） | `startAttempt` 后展示题目与前端计时；`submitAttempt({ attemptId, answers })` 携带答案只提交一次；重复点击提交不重复 mutation |
| S5-RED-04 | 结果与模块分析展示（06-API §3.7） | `getResult`/`getModuleAnalyses` 展示总分/正确率/耗时/模块强弱项（strong/medium/weak） |
| S5-RED-05 | 速背卡翻页与只读边界（09-UI §4.8 + 08-Test §7.4） | `cramCards.get({ assessmentAttemptId })` 后上一张/下一张翻页、importance 星级、要点展示；不新增“标记已掌握”等 mutation（确定性只读 DTO，无对应 API） |
| S5-RED-06 | 冲刺计划只读展示（06-API §3.7 + 07-WF §2.6 4） | `cramPlan.get({ assessmentAttemptId })` 按 CramPlanDay DTO 展示 7 天计划；不自行写入计划、不替学生改写事实 |
| S5-RED-07 | 竞态/卸载/重复 mutation（08-Test §5） | 旧 courseId/旧 assessmentAttemptId/旧 paper/旧 attempt 的异步响应不得覆盖新状态；卸载后不得 setState；切换考试/课程后旧详情不清污染 |
| S5-RED-08 | archived 与错误净化（08-Test §5.7 + AGENTS.md §9.3） | archived 学期 generate/start/submit 在 renderer 侧禁用（isReadOnly）；host 侧既有防线拒绝；错误文案不展示路径、堆栈、完整 UUID、file URI、SQL |

先记录 RED 初次失败证据，再写最小 GREEN 实现；不得用待测实现生成 golden 预期。

## 四、实施步骤

1. 读取当前 CramTab、AppShell 传参、typed RPC、MistakesTab/PracticeTab 既有范式与 `tests/e2e/helpers/` harness，确认不需要 AppShell 状态变更。
2. 先新增 `tests/integration/t-m4-015-cram-rpc.test.ts`（S5-RED-01~08 对应用例）并确认预期失败。
3. 仅重写 CramTab 内部实现：已确认考试局部显式选择（不默认第一条的变体按既有裁决精神：显式列表选择）、模拟考三阶段（idle→answering→result）、速背卡翻页（只读）、计划展示、生命周期 guard、错误净化、归档只读。
4. 运行定向 unit/integration；修复至 GREEN，再做最小 REFACTOR。
5. 新增真实 Electron S5 E2E（隔离 fixture：预置已确认考试 + 知识模块 + 错题 + 薄弱点），覆盖启动、进入冲刺 Tab、考试选择、生成/作答/提交/结果、速背卡翻页只读、计划展示、archived 只读、错误净化、课程切换竞态、隐私断言；运行根 `H:\pi-studybuddy-tmp\runs\T-M4-015\`。
6. 运行 Node24/pnpm11 完整质量门和 `git diff --check`。
7. 两名独立审查者交叉复核（功能/契约维度 + 治理/安全维度），修复并复验 P0/P1/P2。
8. 按 AGENTS §7 创建 8 章节实施记录并同步 Todo/索引；停止等待用户 Git 收口授权。

## 五、质量门

- `C:\node-v24.14.0-win-x64\node.exe --version` → `v24.14.0`；`pnpm --version` → `11.20.0`
- 定向 unit/integration/E2E
- `pnpm type-check`、`pnpm build`、`pnpm test`、`pnpm smoke`
- `pnpm verify -- --stage=full`（在 master 基线 110 files/1068 tests + 19 files/122 E2E 之上不回归）
- contract coverage、desktop security、UUID leak、docs governance、`git diff --check`

所有运行数据、Electron user-data、SQLite、日志和结果只能写入 `H:\pi-studybuddy-tmp\runs\T-M4-015\`，禁止写 `%LOCALAPPDATA%\PiStudyBuddy`；不连接真实 AI/SMTP/飞书/WPS/whisper.cpp。

## 六、明确非目标与停止条件

- 不新增模拟考/速背/计划 API、handler 或 schema（contract 保持 127/127）
- 不接入 TTS 控制条/朗读按钮（T-M4-018）
- 不做跨 Tab S4/S5 状态重构；不新增 AppShell 全局状态
- 需要变更确认考试流程或出题规则、发现 host 侧归档防线缺失、真实 Electron 无法启动、Node 非 v24.14.0、工作区归属无法区分时立即停止并报告

本计划只允许本地实施与治理证据同步；未经用户另行明确授权不得 `git add`、`git commit`、`git merge`、`git push`，不得混入当前工作区其他 dirty 文件。
