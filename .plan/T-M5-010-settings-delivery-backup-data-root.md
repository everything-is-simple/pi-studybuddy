# T-M5-010 唯一执行计划：设置、投递、学期备份与数据根迁移闭环

**任务 ID**：T-M5-010
**状态**：done
**日期**：2026-08-15
**里程碑**：M5 用户可用性验收 + 设置与数据资产修订
**优先级**：P0
**执行序**：47
**实施分支**：`agent/T-M5-010-settings-delivery-backup-data-root`
**集成分支**：`master`
**运行根**：`H:\pi-studybuddy-tmp\runs\T-M5-010\`
**前置**：T-M5-001、T-M5-009 已 done；用户于 2026-08-15 明确裁决设置页发现问题必须完整修复。T-M5-005 blocked，仅等待既定干净机 UAT。
**权威依据**：AGENTS.md §2/§4.4/§4.5/§5/§7/§8/§9/§11；docs/03 §1/§6；docs/05；docs/06 §3.8/§3.11；docs/09 §6/§9/§10；docs/13 §2-§9。

## 1. 开工门禁

| 项目 | 当前事实 | 结论 |
|---|---|---|
| 用户裁决 | 新安装暴露的设置页问题必须完整修复，不得留给既定安装 UAT | OK |
| 单一计划 | T-M5-005 已 blocked；本文件是唯一 in_progress 详细计划 | OK |
| 任务登记 | `docs/04` 已登记 T-M5-010 in_progress | OK |
| 数据边界 | 测试和 UAT 仅用 `H:\pi-studybuddy-tmp\runs\T-M5-010\` | OK |
| 外部服务 | 自动化只用受控 SMTP/飞书 fake；真机投递仅在用户配置目标后经可见 UI 执行 | OK |
| Git | 用户已授权；功能 `ef9eece` 已推送任务分支并 ff-only 合并 master；本治理登记提交纳入本轮推送和同位核验 | OK |

## 2. 目标与范围

1. 模型供应商：现有配置按 provider 保存和可见；内置文本模型目录始终可用；中转站可通过已保存 Key 刷新目录；默认模型保存、当前选择测试、错误分类和重试均可见。
2. 报告投递：设置页以无密钥回显方式配置 SMTP/飞书目标；报告页可创建、编辑、删除投递目标，按目标发起投递、展示状态并可重试。生产 adapter 使用已配置的目标与 credential-vault；自动化以受控 fake 验证成功/失败，不访问真实服务。
3. 学期备份：选择备份目录后生成单一学期包，包含当前学期数据库、资料 storage、exports、关联报告/投递数据和 manifest；恢复前验证 zip、manifest、hash、schema 与学期标识，恢复完成后可重新打开并回读。
4. 数据根迁移：设置页仅使用原生目录选择器；申请迁移时复制全部受管资产、校验清单和 SQLite 完整性，写入启动前切换指令；下一次启动原子切换数据根。失败保留旧根，用户可见固定错误；运行中的进程不切换数据库连接。

## 3. 不变量

- 绝不在 renderer 显示绝对路径、凭据、完整 UUID 或堆栈；路径只由 main 进程 capability 获取和持久化。
- 迁移只允许受管数据根到空目录或经明确覆盖确认的目录；copy 和数据库校验全部成功前不得写入切换指令。
- 恢复不替换活跃资产，先解压和验证到 staging；按确认模式原子替换目标学期目录；失败不改目标。
- 备份 manifest 覆盖每个写入项并验证 hash；完整学期包的范围和恢复范围一一对应。
- SMTP/飞书凭据仅在 main vault/agent host 使用；日志与 UI 不泄露 endpoint、key、收件地址或完整请求正文。

## 4. RED → GREEN 顺序

1. 写 contract/handler/renderer 单元与集成 RED：provider 测试与目录、投递目标 CRUD/通道测试、学期包范围/恢复原子性、数据根迁移申请/启动切换/回滚。
2. 扩展 contract/types 与 schema；实现 host 与 main 生命周期；更新 renderer 设置、报告和备份面板。
3. 运行定向单元/集成、contract coverage、type-check、真实 Electron renderer E2E。
4. 在隔离数据根执行真实 Electron UAT：从 UI 配置模型、创建报告目标、选择备份目录与恢复 zip、申请数据根迁移并重启回读。外部真实投递仅由已配置的用户目标触发。

## 5. 验收

- 设置页不再出现需要手输但无原生选择器的目录设置；工具安装仅对受控可下载 capability 显示，失败状态可见。
- 每个模型 provider 有可见目录、默认选择、测试和明确失败反馈；DeepSeek Flash/Pro 与 Agnes 文本模型不因旧配置隐藏。
- 邮箱/飞书目标可经 UI 管理，测试和报告试投递有真实 status/error/retry 链路。
- 一个备份包可以在隔离根恢复出当前学期完整资产并重启回读。
- 数据根迁移在重启后从新根加载，失败可恢复旧根，DOM 与日志无敏感数据。

## 6. 完成状态

- [x] 2026-08-15：功能 `ef9eece` 已推送任务分支并 ff-only 合并 master；Node24 master `pnpm verify --stage=full` 通过（133 files/1221 tests、真实 Electron E2E 33 files/141 tests、contract 128/128、安全 6/6、build/smoke/docs-governance/x64 setup）。本治理登记提交随后推送并核验 `master=origin/master`，任务 done。
- [x] T-M5-005 继续 blocked；T-M5-006~008 不启动；不读取或暂存安装器，不写生产数据。

## 7. 非范围

- T-M5-006 运行依赖自包含、T-M5-007 全功能干净机 UAT、T-M5-008 最终发行不启动。
- 不读取或暂存安装器；不写生产数据；不在自动化连接真实 SMTP、飞书、模型或其他外部服务。
