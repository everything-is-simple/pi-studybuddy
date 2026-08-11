# T-M4-014 实施计划：S4 错题 Tab RPC 接线

- 任务 ID：T-M4-014
- 任务标题：S4 错题 Tab RPC 接线（list + confirmErrorCause + redo + weakPoints）
- 任务类型：M4 业务接线
- 优先级：P1
- 治理阶段：阶段 4（系统组装）
- 状态：done（本地实施、独立审查、质量门与 Git 收口完成；v0.1.99 验收缺口补做：全部/需复习/已掌握筛选已实现并复验）
- 日期：2026-08-11
- 用户授权：用户明确选择本任务（本轮不启动 T-M4-015~T-M4-021）；2026-08-11 明确授权 Git 收口“提交 推送”
- 集成基线：master=origin/master=cb7d62d（T-M4-014 Git 收口事实核验）
- 实施分支：agent/T-M4-014-s4-mistakes-rpc
- 集成分支：master
- 测试运行根：H:\pi-studybuddy-tmp\runs\T-M4-014\

## 一、前置事实与权威依据

- T-M4-013 已完成治理事实收口：`docs/04-Todo` 已登记 done，`master=origin/master=7d93560`，`git ls-remote origin refs/heads/master` 已核验同一提交，Node24/pnpm11 下 master `pnpm verify -- --stage=full` 返回成功。
- 权威范围：09-UI §4.7、06-API §3.6、07-Workflow §2.5/§8.6/§8.7/§9.2/§9.3、08-Test §5/§6/§7、AGENTS.md §4.4/§5/§7/§8/§9。
- 既有 contract 能力仅复用：
  - `mistakes.list({ courseId?, status? })`
  - `mistakes.get({ id })`
  - `mistakes.suggestErrorCause({ id })`（AI 建议仅展示为“不确定/仅供参考”）
  - `mistakes.confirmErrorCause({ id, category, causeNote? })`
  - `mistakes.redo({ id })`
  - `weakPoints.list({ courseId?, status? })`
- 明确不新增、不改动：API contract、handler、schema、AppShell 全局状态、S3 已验收语义、真实外部服务和真实业务数据根。

## 二、允许修改范围

1. `src/renderer/components/tabs/MistakesTab.tsx`
2. `tests/unit/renderer-mistakes-tab.test.ts`（仅补充 T-M4-014 renderer 交互证据）
3. `tests/integration/t-m4-014-mistakes-rpc.test.ts`（新增，RPC/竞态/卸载/重复 mutation 夹具）
4. `tests/e2e/t-m4-014-mistakes-renderer.test.ts`（新增，真实 Electron + 127.0.0.1 TCP 链路）
5. `.plan/T-M4-014-s4-mistakes-rpc.md`
6. `.plan/00-当前任务.md`
7. `.record/T-M4-014-实施记录.md`
8. `docs/04-任务清单-Todo-List.md`、`docs/00-文档索引-Index.md` 仅在本任务受控收尾时同步事实。

禁止覆盖当前工作区已有治理资产 dirty 修改：`AGENTS.md`、`docs/10-开发规范-Dev-Rules.md`、`docs/12-目录治理-Directory-Governance.md`、`.pi/prompts/task-execution/`。

## 三、RED 测试追踪

| ID | 设计条款 | 失败证据 |
|---|---|---|
| S4-RED-01 | 当前 courseId 下加载列表与薄弱点 | `mistakes.list` / `weakPoints.list` 参数必须带当前课程；无课程不发请求 |
| S4-RED-02 | 当前错题选择与详情加载 | 选择错题调用 `mistakes.get`；旧详情响应不能覆盖新选择 |
| S4-RED-03 | AI 建议不得冒充事实 | `suggestErrorCause` 内容必须有“不确定/仅供参考”展示；没有学生确认不得写入 |
| S4-RED-04 | 六分类确认 | 选择 `ErrorCategory` 后只调用一次 `confirmErrorCause`；causeNote 可选且不泄露完整 UUID/正文 |
| S4-RED-05 | 重做状态 | `redo({ id })` 成功后刷新当前错题/列表/薄弱点；重复点击不重复 mutation；失败可安全重试 |
| S4-RED-06 | archived 与错误净化 | archived 学期 mutation 被 renderer 禁止或固定拒绝；错误文本不展示路径、堆栈、完整 UUID |
| S4-RED-07 | 课程/学期竞态与卸载 | 旧课程/旧错题/卸载后的异步结果不得 setState 或污染当前页面 |

先记录 RED 结果，再写最小 GREEN 实现；不得用待测实现生成 golden 预期。

## 四、实施步骤

1. 读取当前 MistakesTab、AppShell 传参、typed RPC 与既有 renderer 测试范式，确认不需要 AppShell 状态变更。
2. 先新增/补充 S4-RED 测试并确认预期失败。
3. 仅在 MistakesTab 内实现局部选中错题、详情加载、建议/确认、重做、刷新和生命周期 guard。
4. 运行定向 unit/integration；修复至 GREEN，再做最小 REFACTOR。
5. 运行真实 Electron S4 E2E，覆盖启动、隔离 fixture、错题列表、详情、AI 不确定标记、确认、重做、薄弱点、archived 只读、错误净化、课程切换竞态、隐私展示。
6. 运行 Node24/pnpm11 完整质量门和 `git diff --check`。
7. 请求/执行两名独立审查（功能契约与治理/安全维度），修复并复验 P0/P1/P2。
8. 按 AGENTS §7 创建本任务 8 章节实施记录并同步 Todo/索引；停止等待用户 Git 收口授权。

## 五、质量门

- `C:\node-v24.14.0-win-x64\node.exe --version` → `v24.14.0`
- `pnpm --version` → `11.20.0`
- 定向 unit/integration/E2E
- `pnpm type-check`
- `pnpm build`
- `pnpm test`
- `pnpm smoke`
- `pnpm verify -- --stage=full`
- contract coverage、desktop security、UUID leak、docs governance、`git diff --check`

所有运行数据、Electron user-data、SQLite、日志和结果只能写入 `H:\pi-studybuddy-tmp\runs\T-M4-014\`，禁止写 `%LOCALAPPDATA%\PiStudyBuddy`；不连接真实 AI/SMTP/飞书/WPS/whisper.cpp。

## 七、已完成证据（截至 2026-08-11）

- v0.1.99 验收缺口补做：按用户裁决实现 09-UI §4.7 状态筛选（全部/需复习/已掌握），MistakesTab 局部 `statusFilter` 前端过滤；integration 新增筛选用例（RED 初次失败后 GREEN），定向 26 tests + 真实 Electron E2E 2 tests 通过；完整质量门复验通过。

- RED：新增 T-M4-014 integration 失败用例，初次 5/5 失败。
- GREEN/REFACTOR：MistakesTab 已接通六个既有 RPC，保留静态 props 兼容，不改 API/handler/schema/AppShell。
- 定向证据：现有 renderer MistakesTab 14 tests + T-M4-014 integration 6 tests 通过；真实 Electron E2E 1 file/1 test 通过。
- 完整质量门：Node24.14.0/pnpm11.20.0 下 `pnpm verify -- --stage=full` 通过；type-check、build、contract/security/smoke/docs governance/UUID/diff-check 通过。
- 独立审查：功能/API/竞态与治理/安全/隐私两条审查线均需记录最终结论后闭环；当前不报告 Git 完成。
- 运行隔离：本任务运行根为 `H:\pi-studybuddy-tmp\runs\T-M4-014\`，未写真实业务数据根，未连接真实外部服务。

## 八、停止条件与 Git 边界

遇到新增 API/handler/schema、需要 AppShell 全局状态、真实 Electron 无法启动、安全不变量失败、Node 不是 v24.14.0、工作区归属无法区分、或必须修改 S3 语义时立即停止并报告。不得自动启动 T-M4-015~021。

本计划只允许本地实施与证据同步；未经用户另行明确授权不得 `git add`、`git commit`、`git merge`、`git push`，不得混入当前工作区其他 dirty 文件。
