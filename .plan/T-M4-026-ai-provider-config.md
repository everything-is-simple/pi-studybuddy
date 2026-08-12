# T-M4-026 实施计划：AI provider 多模型与凭证配置

- 任务 ID：T-M4-026
- 状态：in_progress（本地实现、配置、完整验收与 Git 收口本地完成；origin/master 推送待网络恢复）
- 日期：2026-08-12
- 用户授权：用户明确要求读取 `H:\pi-references` 中的 AI 原站/中转站凭证并配置系统使用。
- 里程碑：M4 业务接线 + AI provider 配置扩展
- 运行数据根：`H:\pi-studybuddy-tmp\runs\T-M4-026\`

## 1. 范围

- 登记已提供且可识别的 provider：DeepSeek、火山方舟、云雾 API、Agnes、小鸡 GPT、鲨鱼辣椒、小鸡 Kiro。
- provider key 只通过 Electron 主进程 `safeStorage`/Windows DPAPI 写入 `%LOCALAPPDATA%\PiStudyBuddy\config\credentials.json`。
- 非敏感 provider catalog 写入业务数据根 `pi-models.json`；默认选择写入 `models.json`。
- 文本模型、图像输入多模态聊天模型、图像/视频生成模型分级；生成模型不进入对话模型选择器。
- 模型切换成功后才替换生产 pi session 并持久化，失败不覆盖旧默认配置。
- 未提供模型清单的中转站只登记 provider 与凭证，不猜测模型 ID，不联网探测。

## 2. 实施证据

- 参考文件读取：7 个非空文件各识别 1 条 key；`vokly-wdstevens7789@qq.com-kiro-0.06.txt` 为空，未配置。
- 本机凭证：7 个 `modelProvider:*` 密文条目；磁盘结构检查未发现 `sk-*`/`cpk-*`/`ark-*` 明文。
- 默认模型：`agnes:agnes-2.5-flash`。
- provider catalog：7 个 provider；DeepSeek、火山、云雾、Agnes 有明确模型；3 个中转站保留空模型列表待后续受控探测。
- 火山 endpoint 保持参考文件原值 `https://ark.cn-beijing.volces.com/api/coding/v3`。

## 3. 修改文件

- `src/agent-host/handlers/models.ts`
- `src/agent-host/index.ts`
- `src/agent-host/studybuddy-extension-loader.ts`
- `src/contract/types.ts`
- `src/renderer/components/tabs/ChatTab.tsx`
- `tests/integration/models-config-handlers.test.ts`
- `tests/integration/studybuddy-extension-loader.test.ts`

## 4. 测试证据

- 定向模型/loader/renderer 测试：4 files / 18 tests passed。
- `pnpm type-check`：passed。
- `pnpm build`：passed。
- live config invariants：passed（默认模型、7 provider、7 密文凭证、无明文 key、火山 endpoint）。
- 未执行真实外网 API 请求；避免把学生数据或请求发送至未知原站/中转站。

## 5. 未解决事项

- 3 个中转站文件未提供模型清单，因此不能安全填入模型 ID；`models.probe` 当前契约仍显式拒绝外网探测。
- 多模态 metadata 已登记，但 ChatTab 当前只排除 image/video 生成模型；图片上传到对话的完整 UI/消息 payload 接线不属于本轮范围。

## 完成记录
- 完成日期：2026-08-12
- 实施记录：`.record/T-M4-026-实施记录.md`
- 状态：✅ 已完成
- Git 收口已完成本地部分：功能提交 `10d50eb` 与治理登记提交 `c3d2db3` 已按显式路径提交，快进合并到 `master`，Node24 master 完整质量门复验通过；`origin/master` 推送因 GitHub 443 不可达失败，待网络恢复后推送核验（v0.1.154 修正）。
