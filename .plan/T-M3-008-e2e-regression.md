# T-M3-008 E2E-01~13 全链回归 + 安全不变量最终校验（M3 收官）

**task-id**：T-M3-008
**里程碑**：M3 对话与打磨（§7.5 全局执行顺序表第 18 行，M3 收官最后一项）
**日期**：2026-08-08
**依据**：08-Test §6（E2E 框架）+ §5.7（安全不变量六条）+ 04-Todo §6.5（M3 退出门槛）+ AGENTS.md §5.3/§9.4/§11.4/§8.4
**状态**：⏳ in_progress（用户批准开工，2026-08-08）
**开工 Prompt**：`H:\pi-studybuddy-tmp\prompts\T-M3-008-start-prompt.md`（仓库外，不进 Git）
**前置依赖**：T-M1-010（E2E-01~03）✅ + T-M2-009（E2E-04~09）✅ + T-M3-007（E2E-10~13）✅ 三者均 done

---

## 1. 任务目标

对已交付的 **E2E-01~13 全部 14 个 E2E 文件（110 用例）** 执行**全链回归**，并做**安全不变量最终校验**，作为 M3（及整个 v0.1 开发）的**最终退出门禁**。这是 M3 8 项任务中的收官项，完成后 M3 done 8/8，v0.1 开发收官。

**任务性质**：回归 + 校验型，非新功能开发；以运行既有测试 + 缺陷修复为主。

**M3 退出门槛覆盖**（04-Todo §6.5 六项）：
- [ ] E2E-10~13 对话 Tab 全通过（T-M3-007 已交付，回归确认）
- [ ] 应用启动默认打开对话 Tab（DEFAULT_TAB_ID="chat"，回归确认）
- [ ] AI 自主调用工具 + 跳转结构化 Tab（T-M3-004 已交付，回归确认）
- [ ] @文件引用 + TTS 朗读 + L3 会话检索（T-M3-002~005 已交付，回归确认）
- [ ] **全部 E2E-01~13 通过**（本任务核心：110 用例全绿）
- [ ] **v0.1 发布候选**（全链回归 + 安全不变量最终校验通过后判定）

## 2. 范围与非目标

### 2.1 范围

| # | 内容 | 落点 |
|---|---|---|
| 1 | **E2E_RUN_DIR 切换**：`runs\T-M3-007\e2e` → `runs\T-M3-008\e2e`（数据隔离 AGENTS.md §5.3） | tests/e2e/helpers/electron-launcher.ts:20 + e2e-10~13 头部注释 |
| 2 | **全链 E2E 回归**：`pnpm test:e2e` 跑 14 文件 110 用例全绿（不改断言） | tests/e2e/ 既有文件 |
| 3 | **安全不变量最终校验**：check-desktop-security.mjs 六条 + check-uuid-leak.mjs 七条 | scripts/（仅运行） |
| 4 | **缺陷修复（如回归暴露）**：若 110 用例有失败，按 TDD RED→GREEN 修复根因（属缺陷修复非新功能） | 失败点对应 src/ |
| 5 | **M3 退出门槛核验**：对照 04-Todo §6.5 六项逐项勾选 | docs/04-Todo |
| 6 | **§11.4 交叉审查**：M3 收官退出门禁，≥2 独立审查者交叉核对 | 审查记录入 .record |

### 2.2 非目标（留后续 / 范围外）

- **不新增 E2E 用例**：回归仅运行既有 110 例，不扩写断言（除非缺陷修复必需）
- **不新增业务/契约代码**：Api 方法总数维持 127（除非缺陷修复必需）
- **不改 E2E 框架**：维持 vitest + child_process.fork + Node.js IPC 现状
- **不连真实外部服务**：AI/SMTP/飞书/whisper.cpp/WPS COM/OCR 全 mock（08-Test §9.3）
- **不预选 v0.1 后续**：M3 收官后等待用户对 v0.1 整体验收指示

### 2.3 红线

- 测试运行数据隔离写 `H:\pi-studybuddy-tmp\runs\T-M3-008\e2e\<suffix>\`，**绝不污染** `%LOCALAPPDATA%\PiStudyBuddy`
- 日志/事件脱敏（AGENTS.md §9.3）：不记录请求正文/模型完整输出/key/完整 UUID
- E2E 前置 `pnpm build`（dist/ 产物，test-main.js 从 dist/ 加载）
- 缺陷修复不得引入新契约方法（维持 127）

## 3. 权威条款映射

| 文档 | 条款 | 内容 |
|---|---|---|
| 08-Test v0.1.3 | §6 | E2E 框架（vitest + Electron，实际落地 test-main.js Node fork 子进程 + RpcDriver stdin/stdout JSON-lines） |
| 08-Test v0.1.3 | §6.1~6.5 | E2E-01~13 完整场景定义 + 关键断言矩阵 |
| 08-Test v0.1.3 | §5.7 | 安全不变量六条（check-desktop-security.mjs 硬断言） |
| 08-Test v0.1.3 | §7.2 | 隐私边界守护（UUID 检测 + AI 日志 allowlist + 报告禁用词扫描） |
| 04-Todo v0.1.63 | §6.5 | M3 退出门槛六项（本任务收官勾选） |
| AGENTS.md | §5.3 | 测试运行数据隔离 |
| AGENTS.md | §9.4 | 组件安全（zip 炸弹/MIME/符号链接逃逸） |
| AGENTS.md | **§11.4** | **里程碑退出门禁必须 ≥2 独立审查者交叉核对** |
| AGENTS.md | §8.4 | 完成判据三者齐全 |

## 4. 工程现状核实（2026-08-08，T-M3-007 收尾后）

- **master 基线**：`0e350be`（T-M3-007 收尾），工作区干净，已推 origin/master
- **git log（近 3）**：`0e350be`（Git 证据补全）/ `5c68557`（收尾文档）/ `cbc5e4e`（E2E-10~13 业务）
- **E2E 框架就绪**：electron-launcher.ts（fork test-main.js + PI_STUDYBUDDY_DATA_ROOT 注入）+ rpc-driver.ts（JSON-lines + waitForEvent + reuseDataRoot 二次 launch）+ fixtures.ts + test-main.js（全 handler 装配 + test.turnEndIndex + test.seedModule + eventForwardServer shim）
- **E2E 用例现状**：14 文件共 **110 用例**全绿
  - e2e-01~03（T-M1-010）：学期/资料笔记/练习→错题→薄弱点
  - e2e-04~09（T-M2-009）：冲刺/课堂采集/家长报告/TTS/备份恢复/定期调度
  - e2e-10~13（T-M3-007）：对话默认主入口/工具调用+跳转/@引用+TTS/L3 检索
  - check-uuid-leak.script.test.ts（T-M2-006）：UUID 泄漏脚本冒烟
- **基线测试数**：966 单元/集成 + 110 E2E + smoke 6/6 + verify 全绿 + 文档治理 + 契约覆盖 127 + 安全不变量 6/6 + UUID 泄漏 7/7
- **安全/UUID 脚本**：`scripts/check-desktop-security.mjs`（六条）+ `scripts/check-uuid-leak.mjs`（7 条 UUID-01~07）
- **verify.mjs 阶段**：当前 `full`（自动探测 test:e2e），含 type-check→unit→contract-coverage→desktop-security→build→smoke→e2e

### ⚠ 待切换项（开工第一步必做）
- [ ] `tests/e2e/helpers/electron-launcher.ts:20` 的 `E2E_RUN_DIR` 从 `runs\T-M3-007\e2e` 切到 `runs\T-M3-008\e2e`
- [ ] e2e-10~13 四文件头部注释的 `runs\T-M3-007\e2e\e2e-1x\` 同步改为 `runs\T-M3-008\...`（仅注释）

## 5. 执行步骤（16 步标准化流程）

| 步骤 | 内容 | 证据 |
|---|---|---|
| 1 | 读文档定边界（本计划 + 开工 Prompt + AGENTS.md §0/§5.3/§9.4/§11.4 + 04-Todo §6.5/§7.4.1 + 08-Test §6/§5.7 + 核实 E2E_RUN_DIR 现状） | 候选计划落盘 |
| 2 | 确认 T-M3-007 收尾完成（master `0e350be` ✅）+ 用户批准本任务开工 + .plan 无其他执行中任务 | 04-Todo + branch |
| 3 | 创建本计划文件（草案→批准） | .plan/T-M3-008-e2e-regression.md |
| 4 | 独立审查计划（回归范围 + 数据隔离 + 门禁核对表 + §11.4 交叉审查安排） | 审查记录 |
| 5 | 用户批准后登记 04-Todo pending→in_progress + 00-索引 + AGENTS.md 版本同步，切分支 agent/T-M3-008-e2e-regression | 04-Todo + branch |
| 6 | E2E_RUN_DIR 切换 runs\T-M3-007 → runs\T-M3-008 + e2e-10~13 注释同步 | electron-launcher.ts |
| 7 | `pnpm build`（E2E 前置 dist/ 产物） | build 日志 |
| 8 | `pnpm type-check` | 通过 |
| 9 | `pnpm test`（966 单元/集成不得回归） | 测试日志 |
| 10 | ★ `pnpm test:e2e`（110 E2E 全链回归，本任务核心）—— 失败则定位根因按 TDD 修复 | E2E 日志 |
| 11 | `pnpm smoke`（6/6） | 冒烟日志 |
| 12 | `pnpm verify`（full 阶段全绿） | verify 日志 |
| 13 | ★ 安全不变量最终校验（check-desktop-security.mjs 6/6 + check-uuid-leak.mjs 7/7） | 脚本输出 |
| 14 | §11.4 交叉审查（≥2 独立审查者）+ 04-Todo done 登记 + §6.5 M3 退出门槛全勾选 + 文档同步 + 实施记录 | 文档 |
| 15 | diff 检查（git diff --check，无意外文件）+ 文档治理检查 | diff 输出 |
| 16 | 提交交付（★ 待用户授权：显式 git add + ff-only 合并 + 推送 origin/master） | git |

## 6. 质量门（全绿才可收尾，AGENTS.md §8.4）

```bash
pnpm type-check                              # TS 双配置无错
pnpm test                                    # 966 单元/集成全绿（不得回归）
pnpm build                                   # E2E 前置 dist/ 产物
pnpm test:e2e                                # ★ 110 E2E 全绿（本任务核心）
pnpm smoke                                   # 6/6
pnpm verify                                  # full 阶段全绿
node scripts/check-docs-governance.mjs       # 文档治理
node scripts/check-contract-coverage.mjs     # 契约覆盖 127 handlers
node scripts/check-desktop-security.mjs      # ★ 安全不变量 6/6（最终校验）
node scripts/check-uuid-leak.mjs             # ★ UUID 泄漏 7/7（最终校验）
git diff --check                             # 无空白错误
```

**§8.4 三者齐全**：04-Todo 证据登记 + master 复验 + origin/master 推送

## 7. 数据隔离

- E2E_RUN_DIR = `H:\pi-studybuddy-tmp\runs\T-M3-008\e2e`
- 绝不污染真实业务数据根 `%LOCALAPPDATA%\PiStudyBuddy`
- 外部服务全 mock（08-Test §9.3）

## 8. 分支命名

```
agent/T-M3-008-e2e-regression
```

## 9. 收尾纪律（AGENTS.md §7 + §11.4）

1. 复验本任务全链 E2E（110 全绿）+ 安全不变量最终校验（6/6 + 7/7）
2. **§11.4 交叉审查**：M3 收官退出门禁，≥2 独立审查者交叉核对（版本登记一致性/文件落位/自指断言/编号连续性/跨文档契约对齐/计划与实现一致性），洞未处置前不得报告"已完成"，结论写入 .record
3. 更新 docs/04-Todo：T-M3-008 pending→done + §9 统计（M3 done 7→8）+ **§6.5 M3 退出门槛六项全勾选** + 版本号同步
4. 同步 00-索引 + AGENTS.md 版本号
5. 创建 `.record/T-M3-008-实施记录.md`（8 章节，含 §11.4 交叉审查结论）
6. 契约无新增（维持 127）→ 无 spec 变更
7. 计划文件标记完成并保留为验收证据
8. 文档治理检查通过
9. **停止并报告，等待用户明确指示**（不预选 v0.1 后续，不自动提交/推送）

## 10. 独立审查清单（计划阶段，§11.4 预安排）

- [ ] 回归范围是否完整覆盖 E2E-01~13（14 文件 110 用例）
- [ ] 数据隔离 E2E_RUN_DIR 切换是否唯一改动点（不污染业务数据根）
- [ ] M3 退出门槛六项核验清单是否与 04-Todo §6.5 一一对应
- [ ] §11.4 交叉审查安排是否明确（≥2 独立审查者 + 洞集合并去重）
- [ ] 范围外边界是否清晰（不新增用例/业务/契约，维持 127）
- [ ] 缺陷修复路径是否遵循 TDD（RED→GREEN，不补测试后置）
